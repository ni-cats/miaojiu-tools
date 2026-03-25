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
export async function generateTitle(content: string, contentType: string): Promise<string | null> {
  const client = getHunyuanClient()
  if (!client) return null

  const config = getHunyuanYamlConfig()
  // 截取前500字符避免 token 过长
  const truncated = content.length > 500 ? content.substring(0, 500) + '...' : content

  const params = {
    Model: config.model || 'hunyuan-lite',
    Messages: [
      {
        Role: 'system',
        Content: '你是一个标题生成助手。请为以下内容生成一个简短的中文标题（不超过20个字），只返回标题本身，不要有任何解释、引号或标点。',
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
      // 清理标题中可能存在的引号
      return title.replace(/^["'《「【]|["'》」】]$/g, '').trim().substring(0, 30)
    }
    return null
  } catch (error) {
    console.error('AI 生成标题失败:', error)
    return null
  }
}
