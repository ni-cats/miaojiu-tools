/**
 * 腾讯混元大模型 API 封装
 * 支持流式对话，通过 IPC 将流式结果推送给渲染进程
 */
import { BrowserWindow } from 'electron'
import { getHunyuanYamlConfig } from './config'

// 使用 require 引入（tencentcloud-sdk 不支持 ESM）
// eslint-disable-next-line @typescript-eslint/no-var-requires
const tencentcloud = require('tencentcloud-sdk-nodejs-hunyuan')
const HunyuanClient = tencentcloud.hunyuan.v20230901.Client

/** 对话消息格式 */
export interface ChatMessage {
  Role: 'system' | 'user' | 'assistant'
  Content: string
}

/** 混元客户端实例（懒加载） */
let hunyuanClient: InstanceType<typeof HunyuanClient> | null = null

/**
 * 获取或创建混元客户端
 */
function getHunyuanClient(): InstanceType<typeof HunyuanClient> | null {
  const config = getHunyuanYamlConfig()
  if (!config.secretId || !config.secretKey) {
    console.warn('混元大模型密钥未配置')
    return null
  }

  if (hunyuanClient) return hunyuanClient

  hunyuanClient = new HunyuanClient({
    credential: {
      secretId: config.secretId,
      secretKey: config.secretKey,
    },
    region: '',
    profile: {
      httpProfile: {
        endpoint: 'hunyuan.tencentcloudapi.com',
      },
    },
  })

  return hunyuanClient
}

/** 重置客户端（密钥变更时调用） */
export function resetHunyuanClient(): void {
  hunyuanClient = null
}

/**
 * 调用混元大模型进行对话（流式响应）
 * 通过 IPC 事件 'hunyuan:stream' 将流式结果推送给渲染进程
 * @param messages 对话消息列表
 * @param win BrowserWindow 实例，用于发送 IPC 事件
 * @returns 完整的回复文本
 */
export async function chatWithHunyuan(
  messages: ChatMessage[],
  win: BrowserWindow | null
): Promise<string> {
  const client = getHunyuanClient()
  if (!client) {
    throw new Error('混元大模型未配置，请在 config.yaml 中填写密钥')
  }

  const config = getHunyuanYamlConfig()
  const params = {
    Model: config.model || 'hunyuan-lite',
    Messages: messages,
    Stream: true,
  }

  try {
    const res = await client.ChatCompletions(params)
    let fullContent = ''

    if (typeof res.on === 'function') {
      // 流式响应
      return new Promise<string>((resolve, reject) => {
        res.on('message', (message: { data: string }) => {
          try {
            const data = JSON.parse(message.data)
            if (data.Choices && data.Choices.length > 0) {
              const delta = data.Choices[0].Delta
              if (delta && delta.Content) {
                fullContent += delta.Content
                // 推送流式内容到渲染进程
                win?.webContents.send('hunyuan:stream', {
                  type: 'delta',
                  content: delta.Content,
                  fullContent,
                })
              }
              // 检查是否结束
              if (data.Choices[0].FinishReason === 'stop') {
                win?.webContents.send('hunyuan:stream', {
                  type: 'done',
                  content: fullContent,
                })
                resolve(fullContent)
              }
            }
          } catch (e) {
            // 忽略解析错误（可能是 [DONE] 标记）
            if (message.data === '[DONE]') {
              win?.webContents.send('hunyuan:stream', {
                type: 'done',
                content: fullContent,
              })
              resolve(fullContent)
            }
          }
        })

        res.on('error', (err: Error) => {
          win?.webContents.send('hunyuan:stream', {
            type: 'error',
            content: err.message,
          })
          reject(err)
        })

        // 超时保护：30秒后自动结束
        setTimeout(() => {
          if (fullContent) {
            win?.webContents.send('hunyuan:stream', {
              type: 'done',
              content: fullContent,
            })
            resolve(fullContent)
          }
        }, 30000)
      })
    } else {
      // 非流式响应
      const content = res.Choices?.[0]?.Message?.Content || ''
      win?.webContents.send('hunyuan:stream', {
        type: 'done',
        content,
      })
      return content
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    win?.webContents.send('hunyuan:stream', {
      type: 'error',
      content: errMsg,
    })
    throw error
  }
}

/**
 * 检测混元大模型是否可用
 */
export function isHunyuanAvailable(): boolean {
  const config = getHunyuanYamlConfig()
  return !!(config.enabled && config.secretId && config.secretKey)
}

/**
 * 使用 AI 为剪贴板内容生成简短标题（非流式）
 * @param content 剪贴板文本内容
 * @param contentType 内容类型
 * @returns 生成的标题字符串，失败返回 null
 */
/**
 * 判断 AI 生成的标题是否有效
 * 无效情况：空、太短、包含明显的 AI 拒绝/无效标记、与原文几乎相同等
 */
function isValidTitle(title: string, originalContent: string): boolean {
  if (!title || title.length < 2) return false
  // AI 返回的无效标记
  const invalidMarkers = ['INVALID', 'invalid', '无法生成', '无法提取', '无意义', '不可读', '乱码']
  if (invalidMarkers.some((m) => title.includes(m))) return false
  // 标题不应该太长（超过30字说明 AI 没有正确理解指令）
  if (title.length > 40) return false
  // 标题不应该和原文前30字完全相同（说明 AI 只是复读了原文）
  const contentHead = originalContent.trim().substring(0, 30).replace(/\n/g, ' ')
  if (title === contentHead) return false
  return true
}

/**
 * 从内容开头截取一段作为 fallback 标题
 * 取第一行非空文本，最多20个字
 */
function fallbackTitle(content: string): string {
  const firstLine = content.trim().split('\n').find((line) => line.trim().length > 0) || ''
  const cleaned = firstLine.trim().replace(/^[#/*\-=]+\s*/, '') // 去掉 markdown/注释前缀
  return cleaned.substring(0, 20) || content.trim().substring(0, 20)
}

export async function generateTitle(content: string, contentType: string): Promise<string | null> {
  const client = getHunyuanClient()
  if (!client) return fallbackTitle(content)

  const config = getHunyuanYamlConfig()
  // 截取前500字符避免 token 过长
  const truncated = content.length > 500 ? content.substring(0, 500) + '...' : content

  const params = {
    Model: config.model || 'hunyuan-lite',
    Messages: [
      {
        Role: 'system',
        Content: '你是一个极简标题提取器。为用户复制的内容生成一个简短的中文摘要标题。规则：1.标题2-20个字，概括核心主题；2.只输出标题文本，不加引号、书名号、序号或任何符号；3.代码内容提取功能描述（如"用户登录验证"、"数组去重工具函数"）；4.URL提取网站或页面用途；5.普通文本提取关键主题。',
      },
      {
        Role: 'user',
        Content: `内容类型：${contentType}\n内容：${truncated}`,
      },
    ],
    Stream: false,
  }

  try {
    const res = await client.ChatCompletions(params)
    const title = res.Choices?.[0]?.Message?.Content?.trim()
    if (title) {
      // 清理标题中可能存在的引号和多余符号
      const cleaned = title.replace(/^["'《「【\s]|["'》」】\s]$/g, '').trim()
      // 验证 AI 生成的标题是否有效
      if (isValidTitle(cleaned, content)) {
        return cleaned.substring(0, 30)
      }
    }
    // AI 返回无效结果，使用 fallback
    return fallbackTitle(content)
  } catch (error) {
    console.error('AI 生成标题失败:', error)
    // 异常时也使用 fallback，而不是返回 null
    return fallbackTitle(content)
  }
}

/**
 * 使用 AI 为剪贴板内容匹配最合适的预设标签（非流式）
 * @param content 剪贴板文本内容
 * @param contentType 内容类型
 * @param availableTags 可选的预设标签列表
 * @returns 匹配到的标签数组，失败返回空数组
 */
export async function matchTags(
  content: string,
  contentType: string,
  availableTags: string[]
): Promise<string[]> {
  if (!availableTags || availableTags.length === 0) return []

  const client = getHunyuanClient()
  if (!client) return []

  const config = getHunyuanYamlConfig()
  // 截取前300字符，标签匹配不需要太多内容
  const truncated = content.length > 300 ? content.substring(0, 300) + '...' : content

  const params = {
    Model: config.model || 'hunyuan-lite',
    Messages: [
      {
        Role: 'system',
        Content: `你是一个内容分类助手。根据用户复制的内容，从给定的标签列表中选择最匹配的标签。规则：1.只能从给定的标签列表中选择，不要创造新标签；2.选择1-3个最相关的标签；3.只输出标签名，多个标签用英文逗号分隔；4.如果没有合适的标签，输出 NONE。`,
      },
      {
        Role: 'user',
        Content: `可选标签：${availableTags.join('、')}\n内容类型：${contentType}\n内容：${truncated}`,
      },
    ],
    Stream: false,
  }

  try {
    const res = await client.ChatCompletions(params)
    const result = res.Choices?.[0]?.Message?.Content?.trim()
    if (!result || result.toUpperCase() === 'NONE') return []

    // 解析 AI 返回的标签，只保留在预设列表中存在的
    const matched = result
      .split(/[,，、]/)
      .map((t: string) => t.trim())
      .filter((t: string) => t && availableTags.includes(t))

    return matched
  } catch (error) {
    console.error('AI 匹配标签失败:', error)
    return []
  }
}

