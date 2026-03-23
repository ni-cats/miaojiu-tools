/**
 * 腾讯云 COS 操作封装
 * 负责片段数据的云端存储和同步
 * 每条片段单独存储为一个文件，标题作为标识
 */
import COS from 'cos-nodejs-sdk-v5'
import { execSync } from 'child_process'
import { getCosConfig } from './store'
import { getCosYamlConfig } from './config'

/** 从配置文件获取 COS 存储桶和地域 */
function getBucketConfig() {
  const cfg = getCosYamlConfig()
  return {
    Bucket: cfg.bucket,
    Region: cfg.region,
  }
}

/** COS 客户端实例（懒加载） */
let cosClient: COS | null = null

/**
 * 获取 macOS Hardware UUID 作为设备唯一标识
 * 稳定不变、全局唯一、与硬件绑定
 */
export function getDeviceId(): string {
  try {
    const uuid = execSync(
      "ioreg -d2 -c IOPlatformExpertDevice | awk -F'\"' '/IOPlatformUUID/{print $(NF-1)}'"
    )
      .toString()
      .trim()
    return uuid
  } catch (error) {
    console.error('获取设备ID失败:', error)
    // 兜底：使用主机名 + 用户名生成标识
    const hostname = execSync('hostname').toString().trim()
    const username = execSync('whoami').toString().trim()
    return `${hostname}-${username}`
  }
}

/**
 * 获取或创建 COS 客户端实例
 * 使用 store 中保存的 SecretId/SecretKey
 */
export function getCosClient(): COS | null {
  const config = getCosConfig()
  console.log('getCosClient - secretId:', config.secretId ? config.secretId.substring(0, 8) + '...' : '(空)', 'enabled:', config.enabled)
  if (!config.secretId || !config.secretKey) {
    console.warn('COS 密钥未配置，请在设置中填写或检查 config.yaml')
    return null
  }

  // 如果密钥变更，重新创建客户端
  if (cosClient) {
    return cosClient
  }

  cosClient = new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey,
  })

  return cosClient
}

/**
 * 获取或创建 COS 客户端实例（强制模式，不检查 enabled 状态）
 * 用于个人信息等必须同步的场景
 */
export function getCosClientForce(): COS | null {
  const config = getCosConfig()
  if (!config.secretId || !config.secretKey) {
    console.warn('COS 密钥未配置，无法创建客户端')
    return null
  }

  if (cosClient) return cosClient

  cosClient = new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey,
  })

  return cosClient
}

/** 重置 COS 客户端（密钥变更时调用） */
export function resetCosClient(): void {
  cosClient = null
}

/**
 * 生成片段的 COS 对象 Key（路径）
 * 格式：devices/{deviceId}/snippets/{id}.json
 */
function buildSnippetKey(snippetId: string): string {
  const deviceId = getDeviceId()
  return `devices/${deviceId}/snippets/${snippetId}.json`
}

/**
 * 生成通用文件的 COS 对象 Key
 * 格式：devices/{deviceId}/{filename}
 */
function buildKey(filename: string): string {
  const deviceId = getDeviceId()
  return `devices/${deviceId}/${filename}`
}

/**
 * 生成用户个人信息的 COS 对象 Key
 * 格式：user/{deviceId}/{filename}
 */
function buildUserKey(filename: string): string {
  const deviceId = getDeviceId()
  return `user/${deviceId}/${filename}`
}

/**
 * 获取片段目录前缀
 * 格式：devices/{deviceId}/snippets/
 */
function getSnippetsPrefix(): string {
  const deviceId = getDeviceId()
  return `devices/${deviceId}/snippets/`
}

// ====== 单条片段操作 ======

/**
 * 上传单条片段到 COS
 * 每条片段独立存储为 devices/{deviceId}/snippets/{id}.json
 */
export async function uploadSnippet(snippet: unknown): Promise<boolean> {
  const cos = getCosClient()
  if (!cos) {
    console.error('uploadSnippet: COS 客户端为空，跳过上传')
    return false
  }

  const snippetObj = snippet as { id: string; title?: string }
  const key = buildSnippetKey(snippetObj.id)
  const body = JSON.stringify(snippet, null, 2)
  const { Bucket, Region } = getBucketConfig()
  console.log('uploadSnippet - Key:', key, 'title:', snippetObj.title || '(无标题)')

  return new Promise((resolve) => {
    cos.putObject(
      {
        Bucket,
        Region,
        Key: key,
        Body: body,
      },
      (err, _data) => {
        if (err) {
          console.error('上传片段失败:', err)
          resolve(false)
        } else {
          console.log('片段已同步到云端:', snippetObj.title || snippetObj.id)
          resolve(true)
        }
      }
    )
  })
}

/**
 * 从 COS 删除单条片段文件
 */
export async function deleteSnippetFromCloud(snippetId: string): Promise<boolean> {
  const cos = getCosClient()
  if (!cos) {
    console.error('deleteSnippetFromCloud: COS 客户端为空，跳过删除')
    return false
  }

  const key = buildSnippetKey(snippetId)
  const { Bucket, Region } = getBucketConfig()
  console.log('deleteSnippetFromCloud - Key:', key)

  return new Promise((resolve) => {
    cos.deleteObject(
      {
        Bucket,
        Region,
        Key: key,
      },
      (err, _data) => {
        if (err) {
          console.error('删除云端片段失败:', err)
          resolve(false)
        } else {
          console.log('云端片段已删除:', snippetId)
          resolve(true)
        }
      }
    )
  })
}

/**
 * 批量上传所有片段到 COS（推送操作）
 * 每条片段独立上传为单独的文件
 */
export async function uploadAllSnippets(snippets: unknown[]): Promise<boolean> {
  const cos = getCosClient()
  if (!cos) {
    console.error('uploadAllSnippets: COS 客户端为空，跳过上传')
    return false
  }

  console.log(`开始批量上传 ${snippets.length} 条片段...`)
  const results = await Promise.all(snippets.map((s) => uploadSnippet(s)))
  const successCount = results.filter(Boolean).length
  console.log(`批量上传完成: ${successCount}/${snippets.length} 成功`)
  return successCount === snippets.length
}

/**
 * 从 COS 下载所有片段数据
 * 先列出 snippets/ 前缀下的所有文件，再逐个下载并解析
 */
export async function downloadSnippets(): Promise<unknown[] | null> {
  const cos = getCosClient()
  if (!cos) {
    console.error('downloadSnippets: COS 客户端为空，跳过下载')
    return null
  }

  const prefix = getSnippetsPrefix()
  const { Bucket, Region } = getBucketConfig()
  console.log('downloadSnippets - 列出前缀:', prefix)

  // 第一步：列出所有片段文件
  const keys = await new Promise<string[]>((resolve) => {
    const allKeys: string[] = []

    function listNext(marker?: string) {
      cos!.getBucket(
        {
          Bucket,
          Region,
          Prefix: prefix,
          MaxKeys: 1000,
          Marker: marker || '',
        },
        (err, data) => {
          if (err) {
            console.error('列出云端片段文件失败:', err)
            resolve([])
            return
          }

          const fileKeys = (data.Contents || [])
            .map((item) => item.Key)
            .filter((key) => key.endsWith('.json'))
          allKeys.push(...fileKeys)

          // 如果被截断，继续获取下一页
          if (data.IsTruncated === 'true' && data.NextMarker) {
            listNext(data.NextMarker)
          } else {
            resolve(allKeys)
          }
        }
      )
    }

    listNext()
  })

  if (keys.length === 0) {
    console.log('云端暂无片段数据')
    return []
  }

  console.log(`找到 ${keys.length} 个片段文件，开始下载...`)

  // 第二步：逐个下载并解析
  const snippets: unknown[] = []
  const downloadResults = await Promise.all(
    keys.map(
      (key) =>
        new Promise<unknown | null>((resolve) => {
          cos!.getObject(
            {
              Bucket,
              Region,
              Key: key,
            },
            (err, data) => {
              if (err) {
                console.error(`下载片段失败 [${key}]:`, err)
                resolve(null)
              } else {
                try {
                  const snippet = JSON.parse(data.Body as string)
                  resolve(snippet)
                } catch (parseError) {
                  console.error(`解析片段数据失败 [${key}]:`, parseError)
                  resolve(null)
                }
              }
            }
          )
        })
    )
  )

  for (const result of downloadResults) {
    if (result !== null) {
      snippets.push(result)
    }
  }

  console.log(`从云端下载了 ${snippets.length} 条片段`)
  return snippets
}

// ====== 标签操作（保持单文件模式） ======

/**
 * 上传自定义标签到 COS
 */
export async function uploadCustomTags(tags: string[]): Promise<boolean> {
  const cos = getCosClient()
  if (!cos) return false

  const key = buildKey('customTags.json')
  const body = JSON.stringify(tags, null, 2)
  const { Bucket, Region } = getBucketConfig()

  return new Promise((resolve) => {
    cos.putObject(
      {
        Bucket,
        Region,
        Key: key,
        Body: body,
      },
      (err, _data) => {
        if (err) {
          console.error('上传标签数据失败:', err)
          resolve(false)
        } else {
          console.log('标签数据已同步到云端')
          resolve(true)
        }
      }
    )
  })
}

/**
 * 从 COS 下载自定义标签
 */
export async function downloadCustomTags(): Promise<string[] | null> {
  const cos = getCosClient()
  if (!cos) return null

  const key = buildKey('customTags.json')
  const { Bucket, Region } = getBucketConfig()

  return new Promise((resolve) => {
    cos.getObject(
      {
        Bucket,
        Region,
        Key: key,
      },
      (err, data) => {
        if (err) {
          if (err.statusCode === 404 || err.code === 'NoSuchKey') {
            console.log('云端暂无标签数据')
            resolve([])
          } else {
            console.error('下载标签数据失败:', err)
            resolve(null)
          }
        } else {
          try {
            const tags = JSON.parse(data.Body as string)
            console.log(`从云端下载了 ${tags.length} 个标签`)
            resolve(tags)
          } catch (parseError) {
            console.error('解析云端标签数据失败:', parseError)
            resolve(null)
          }
        }
      }
    )
  })
}

// ====== 个人信息操作 ======

/**
 * 上传个人信息到 COS
 * 存储路径：user/{deviceId}/profile.json
 * 不受存储模式影响，只要有密钥就同步
 */
export async function uploadProfile(profile: unknown): Promise<boolean> {
  const cos = getCosClientForce()
  if (!cos) return false

  const key = buildUserKey('profile.json')
  const body = JSON.stringify(profile, null, 2)
  const { Bucket, Region } = getBucketConfig()
  console.log('uploadProfile - Key:', key)

  return new Promise((resolve) => {
    cos.putObject(
      {
        Bucket,
        Region,
        Key: key,
        Body: body,
      },
      (err, _data) => {
        if (err) {
          console.error('上传个人信息失败:', err)
          resolve(false)
        } else {
          console.log('个人信息已同步到云端, 路径:', key)
          resolve(true)
        }
      }
    )
  })
}

/**
 * 从 COS 下载个人信息
 * 存储路径：user/{deviceId}/profile.json
 * 不受存储模式影响，只要有密钥就可以拉取
 */
export async function downloadProfile(): Promise<unknown | null> {
  const cos = getCosClientForce()
  if (!cos) return null

  const key = buildUserKey('profile.json')
  const { Bucket, Region } = getBucketConfig()
  console.log('downloadProfile - Key:', key)

  return new Promise((resolve) => {
    cos.getObject(
      {
        Bucket,
        Region,
        Key: key,
      },
      (err, data) => {
        if (err) {
          if (err.statusCode === 404 || err.code === 'NoSuchKey') {
            console.log('云端暂无个人信息')
            resolve(null)
          } else {
            console.error('下载个人信息失败:', err)
            resolve(null)
          }
        } else {
          try {
            const profile = JSON.parse(data.Body as string)
            console.log('从云端下载了个人信息')
            resolve(profile)
          } catch (parseError) {
            console.error('解析云端个人信息失败:', parseError)
            resolve(null)
          }
        }
      }
    )
  })
}

/**
 * 测试 COS 连接是否正常
 * 通过 headBucket 接口检测
 */
export async function testCosConnection(): Promise<{ success: boolean; message: string }> {
  const cos = getCosClient()
  if (!cos) {
    return { success: false, message: 'COS 密钥未配置' }
  }

  const { Bucket, Region } = getBucketConfig()

  return new Promise((resolve) => {
    cos.headBucket(
      {
        Bucket,
        Region,
      },
      (err, _data) => {
        if (err) {
          console.error('COS 连接测试失败:', err)
          resolve({ success: false, message: `连接失败: ${err.message || err.code}` })
        } else {
          resolve({ success: true, message: '连接成功' })
        }
      }
    )
  })
}
