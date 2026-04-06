/**
 * 本地应用扫描模块
 * 扫描 macOS /Applications 目录获取已安装的应用列表
 */
import { promises as fsp, constants } from 'fs'
import { join } from 'path'
import { shell } from 'electron'
import { execSync } from 'child_process'
import { homedir } from 'os'

export interface LocalApp {
  name: string       // 应用名称（去掉 .app 后缀）
  path: string       // 应用完整路径
  icon: string       // Emoji 图标（默认）
}

/** 缓存：避免频繁扫描文件系统 */
let cachedApps: LocalApp[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60 * 1000 // 缓存 60 秒

/**
 * 异步扫描指定目录下的 .app 应用
 */
async function scanAppsInDir(dir: string): Promise<LocalApp[]> {
  try {
    await fsp.access(dir, constants.R_OK)
  } catch {
    return []
  }
  try {
    const entries = await fsp.readdir(dir)
    return entries
      .filter((name) => name.endsWith('.app'))
      .map((name) => ({
        name: name.replace(/\.app$/, ''),
        path: join(dir, name),
        icon: '📱',
      }))
  } catch (err) {
    console.error(`扫描应用目录失败 [${dir}]:`, err)
    return []
  }
}

/**
 * 获取已安装的本地应用列表（异步）
 * 扫描 /Applications 和 ~/Applications
 */
export async function getInstalledApps(): Promise<LocalApp[]> {
  const now = Date.now()
  if (cachedApps && now - cacheTimestamp < CACHE_TTL) {
    return cachedApps
  }

  // 并行扫描两个目录，提升速度
  const [systemApps, userApps] = await Promise.all([
    scanAppsInDir('/Applications'),
    scanAppsInDir(join(homedir(), 'Applications')),
  ])

  // 合并并去重（以应用名称为准）
  const appMap = new Map<string, LocalApp>()
  for (const app of [...systemApps, ...userApps]) {
    if (!appMap.has(app.name)) {
      appMap.set(app.name, app)
    }
  }

  // 按名称排序
  cachedApps = Array.from(appMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'zh-CN')
  )
  cacheTimestamp = now

  return cachedApps
}

/**
 * 打开本地应用
 */
export function openApp(appPath: string): boolean {
  try {
    execSync(`open "${appPath}"`)
    return true
  } catch (err) {
    console.error(`打开应用失败 [${appPath}]:`, err)
    // 回退方案：使用 shell.openPath
    shell.openPath(appPath)
    return true
  }
}

/**
 * 清除应用缓存（用于手动刷新）
 */
export function clearAppCache(): void {
  cachedApps = null
  cacheTimestamp = 0
}
