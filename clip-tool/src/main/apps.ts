/**
 * 本地应用扫描模块
 * 扫描 macOS /Applications 目录获取已安装的应用列表
 * 使用 Electron app.getFileIcon() 获取应用真实图标
 */
import { promises as fsp, constants } from 'fs'
import { join } from 'path'
import { app, shell, nativeImage } from 'electron'
import { execSync } from 'child_process'
import { homedir } from 'os'

export interface LocalApp {
  name: string       // 应用名称（去掉 .app 后缀）
  path: string       // 应用完整路径
  icon: string       // 应用图标（base64 data URL，空字符串表示未加载）
}

/** 缓存：避免频繁扫描文件系统 */
let cachedApps: LocalApp[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 60 * 1000 // 缓存 60 秒

/** 图标缓存：避免重复提取图标 */
const iconCache = new Map<string, string>()

/**
 * 获取单个应用图标（base64 data URL）
 * 使用 Electron 的 app.getFileIcon() API
 */
export async function getAppIcon(appPath: string): Promise<string> {
  // 先查缓存
  if (iconCache.has(appPath)) {
    return iconCache.get(appPath)!
  }
  try {
    const icon = await app.getFileIcon(appPath, { size: 'large' })
    if (icon && !icon.isEmpty()) {
      const pngBuffer = icon.toPNG()
      if (pngBuffer.length > 0) {
        const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`
        iconCache.set(appPath, dataUrl)
        return dataUrl
      }
    }
  } catch (err) {
    console.error(`获取应用图标失败 [${appPath}]:`, err)
  }
  return '' // 返回空字符串表示无图标
}

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
        icon: '', // 图标稍后按需加载
      }))
  } catch (err) {
    console.error(`扫描应用目录失败 [${dir}]:`, err)
    return []
  }
}

/**
 * 获取已安装的本地应用列表（异步）
 * 扫描 /Applications 和 ~/Applications
 * 注意：返回的应用列表中 icon 为空，图标通过 getAppIcon 按需加载
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
  for (const a of [...systemApps, ...userApps]) {
    if (!appMap.has(a.name)) {
      appMap.set(a.name, a)
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
