/**
 * 语雀 OpenAPI 服务模块
 * 封装语雀 REST API 的 HTTP 请求逻辑
 * 使用 Electron net 模块发送请求（打包后兼容性更好）
 * 使用 X-Auth-Token 鉴权，统一处理错误码和响应解析
 */
import { net } from 'electron'

/** 语雀 API 基础地址 */
const YUQUE_API_BASE = 'https://www.yuque.com'

// ====== 类型定义 ======

/** 语雀用户信息 */
export interface YuqueUser {
  id: number
  login: string
  name: string
  avatar_url: string
  description: string
  created_at: string
  updated_at: string
}

/** 语雀知识库信息 */
export interface YuqueRepo {
  id: number
  slug: string
  name: string
  namespace: string
  description: string
  public: number
  items_count: number
  created_at: string
  updated_at: string
  user: {
    login: string
    name: string
  }
}

/** 语雀搜索结果项 */
export interface YuqueSearchResult {
  id: number
  type: string
  title: string
  summary: string
  url: string
  info: string
  target: {
    id: number
    slug: string
    title: string
    book_id: number
    description: string
    created_at: string
    updated_at: string
    content_updated_at: string
    book?: {
      id: number
      slug: string
      name: string
      namespace: string
    }
  }
}

/** 语雀文档详情 */
export interface YuqueDoc {
  id: number
  slug: string
  title: string
  book_id: number
  body: string
  body_html: string
  description: string
  created_at: string
  updated_at: string
  content_updated_at: string
  word_count: number
  read_count: number
  like_count: number
  _serializer: string
}

/** 语雀 API 错误 */
export class YuqueApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string = '') {
    super(message)
    this.name = 'YuqueApiError'
    this.status = status
    this.code = code
  }
}

/** 搜索选项 */
export interface SearchOptions {
  type?: string       // 搜索类型：doc, repo 等
  page?: number       // 页码，默认 1
  limit?: number      // 每页数量，默认 10，最大 20
}

/** 创建/更新文档参数 */
export interface DocData {
  title: string
  body: string
  format?: 'markdown' | 'html' | 'lake'
  public?: number     // 0:私密, 1:公开, 2:企业内公开
  slug?: string
}

// ====== 基础请求方法 ======

/**
 * 发送语雀 API 请求
 * 使用 Electron net 模块（基于 Chromium 网络栈，打包后兼容性好）
 * 统一处理鉴权头、错误码和响应解析
 */
function yuqueRequest<T>(
  token: string,
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const fullUrl = `${YUQUE_API_BASE}${path}`
    console.log(`[yuque] ${method} ${fullUrl}`)

    const req = net.request({
      url: fullUrl,
      method: method.toUpperCase(),
    })

    // 设置请求头
    req.setHeader('X-Auth-Token', token)
    req.setHeader('Content-Type', 'application/json')
    req.setHeader('User-Agent', 'ClipTool/1.0')

    // 超时保护
    const timeoutId = setTimeout(() => {
      req.abort()
      reject(new YuqueApiError('请求超时', 0, 'TIMEOUT'))
    }, 15000)

    req.on('response', (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => {
        clearTimeout(timeoutId)
        const status = res.statusCode || 0
        console.log(`[yuque] Response status=${status}, dataLen=${data.length}`)

        // 处理错误状态码
        if (status === 401) {
          reject(new YuqueApiError('Token 无效或已过期，请重新配置', 401, 'UNAUTHORIZED'))
          return
        }
        if (status === 403) {
          reject(new YuqueApiError('无操作权限', 403, 'FORBIDDEN'))
          return
        }
        if (status === 404) {
          reject(new YuqueApiError('资源未找到', 404, 'NOT_FOUND'))
          return
        }
        if (status === 429) {
          reject(new YuqueApiError('请求频率超限，请稍后再试', 429, 'RATE_LIMITED'))
          return
        }
        if (status >= 500) {
          reject(new YuqueApiError('语雀服务器内部错误', status, 'SERVER_ERROR'))
          return
        }
        if (status < 200 || status >= 300) {
          // 打印响应体帮助调试
          console.error(`[yuque] Error response body: ${data.substring(0, 500)}`)
          let errMsg = `请求失败 (${status})`
          try {
            const errBody = JSON.parse(data)
            if (errBody.message) errMsg = `${errMsg}: ${errBody.message}`
          } catch { /* ignore */ }
          reject(new YuqueApiError(errMsg, status, 'UNKNOWN'))
          return
        }

        try {
          const parsed = JSON.parse(data)
          resolve(parsed as T)
        } catch (e) {
          reject(new YuqueApiError('响应解析失败', status, 'PARSE_ERROR'))
        }
      })
    })

    req.on('error', (err) => {
      clearTimeout(timeoutId)
      console.error(`[yuque] Request error:`, err)
      reject(new YuqueApiError(`网络请求失败: ${err.message}`, 0, 'NETWORK_ERROR'))
    })

    if (body) {
      req.write(JSON.stringify(body))
    }

    req.end()
  })
}

// ====== API 方法 ======

/**
 * 验证 Token 有效性并返回用户信息
 * 调用 GET /api/v2/user
 */
export async function verifyToken(token: string): Promise<YuqueUser> {
  const res = await yuqueRequest<{ data: YuqueUser }>(token, 'GET', '/api/v2/user')
  return res.data
}

/**
 * 获取用户的知识库列表
 * 调用 GET /api/v2/users/{login}/repos
 */
export async function getUserRepos(token: string, login: string): Promise<YuqueRepo[]> {
  const res = await yuqueRequest<{ data: YuqueRepo[] }>(
    token,
    'GET',
    `/api/v2/users/${encodeURIComponent(login)}/repos?type=Book&include_membered=true`
  )
  return res.data || []
}

/**
 * 通用搜索（搜索文档/知识库）
 * 调用 GET /api/v2/search
 */
export async function searchDocs(
  token: string,
  query: string,
  options: SearchOptions = {}
): Promise<{ data: YuqueSearchResult[]; total: number }> {
  const params = new URLSearchParams()
  params.set('q', query)
  params.set('type', options.type || 'doc')
  params.set('page', String(options.page || 1))
  params.set('limit', String(Math.min(options.limit || 10, 20)))

  const res = await yuqueRequest<{ data: YuqueSearchResult[] }>(
    token,
    'GET',
    `/api/v2/search?${params.toString()}`
  )
  return {
    data: res.data || [],
    total: (res as Record<string, unknown>).meta
      ? ((res as Record<string, unknown>).meta as { total: number }).total
      : (res.data || []).length,
  }
}

/**
 * 获取文档详情（含正文内容）
 * 调用 GET /api/v2/repos/{book_id}/docs/{id}
 */
export async function getDocDetail(
  token: string,
  bookId: number,
  docId: number
): Promise<YuqueDoc> {
  const res = await yuqueRequest<{ data: YuqueDoc }>(
    token,
    'GET',
    `/api/v2/repos/${bookId}/docs/${docId}?raw=1`
  )
  return res.data
}

/**
 * 创建文档
 * 调用 POST /api/v2/repos/{namespace}/docs
 * @param namespace 知识库的 namespace（如 "user/repo-slug"）
 */
export async function createDoc(
  token: string,
  namespace: string,
  data: DocData
): Promise<YuqueDoc> {
  // namespace 格式为 "user/repo-slug"，不能对 / 进行编码
  // 构建请求体，过滤掉 undefined 字段
  const reqBody: Record<string, unknown> = {
    title: data.title,
    body: data.body,
    format: data.format || 'markdown',
    public: data.public ?? 0,
  }
  if (data.slug) reqBody.slug = data.slug

  const res = await yuqueRequest<{ data: YuqueDoc }>(
    token,
    'POST',
    `/api/v2/repos/${namespace}/docs`,
    reqBody
  )
  return res.data
}

/**
 * 更新文档
 * 调用 PUT /api/v2/repos/{namespace}/docs/{id}
 */
export async function updateDoc(
  token: string,
  namespace: string,
  docId: number,
  data: DocData
): Promise<YuqueDoc> {
  // namespace 格式为 "user/repo-slug"，不能对 / 进行编码
  // 构建请求体，过滤掉 undefined 字段
  const updateBody: Record<string, unknown> = {
    title: data.title,
    body: data.body,
    format: data.format || 'markdown',
  }
  if (data.public !== undefined) updateBody.public = data.public
  if (data.slug) updateBody.slug = data.slug

  const res = await yuqueRequest<{ data: YuqueDoc }>(
    token,
    'PUT',
    `/api/v2/repos/${namespace}/docs/${docId}`,
    updateBody
  )
  return res.data
}

/** 语雀目录节点 */
export interface YuqueTocItem {
  uuid: string
  type: 'TITLE' | 'DOC'
  title: string
  url: string | null
  id: number | null
  doc_id: number | null
  level: number
  parent_uuid: string | null
  child_uuid: string | null
  sibling_uuid: string | null
}

/**
 * 获取知识库目录
 * 调用 GET /api/v2/repos/{namespace}/toc
 */
export async function getRepoToc(
  token: string,
  namespace: string
): Promise<YuqueTocItem[]> {
  const res = await yuqueRequest<{ data: YuqueTocItem[] }>(
    token,
    'GET',
    `/api/v2/repos/${namespace}/toc`
  )
  return res.data || []
}

/**
 * 将文档插入到知识库目录中
 * 调用 PUT /api/v2/repos/{namespace}/toc
 * @param targetUuid 目标目录节点的 uuid（文档将作为该节点的子节点插入）
 * @param docId 要插入的文档 ID
 */
export async function appendDocToToc(
  token: string,
  namespace: string,
  targetUuid: string,
  docId: number
): Promise<YuqueTocItem[]> {
  const res = await yuqueRequest<{ data: YuqueTocItem[] }>(
    token,
    'PUT',
    `/api/v2/repos/${namespace}/toc`,
    {
      action: 'appendNode',
      action_mode: 'child',
      target_uuid: targetUuid,
      type: 'DOC',
      doc_ids: [docId],
    }
  )
  return res.data || []
}

/**
 * 在知识库目录中创建分组节点（TITLE 类型）
 * 调用 PUT /api/v2/repos/{namespace}/toc
 * @param title 分组节点标题
 * @returns 创建后的完整目录列表
 */
export async function createTocTitleNode(
  token: string,
  namespace: string,
  title: string
): Promise<YuqueTocItem[]> {
  const res = await yuqueRequest<{ data: YuqueTocItem[] }>(
    token,
    'PUT',
    `/api/v2/repos/${namespace}/toc`,
    {
      action: 'appendNode',
      action_mode: 'child',
      type: 'TITLE',
      title,
    }
  )
  return res.data || []
}
