/**
 * 本地应用扫描模块
 * 扫描 macOS /Applications 目录获取已安装的应用列表
 * 从 .app 包中解析 .icns 文件提取高清 PNG 图标
 */
import { promises as fsp, readFileSync, constants } from 'fs'
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
 * 从 .app 包的 Info.plist 中读取 CFBundleIconFile 字段
 */
function getIconFileFromPlist(appPath: string): string {
  try {
    const plistPath = join(appPath, 'Contents', 'Info.plist')
    const result = execSync(
      `/usr/libexec/PlistBuddy -c "Print :CFBundleIconFile" "${plistPath}" 2>/dev/null`,
      { encoding: 'utf-8', timeout: 3000 }
    ).trim()
    return result || ''
  } catch {
    return ''
  }
}

/**
 * 从 .icns 文件中提取最合适的 PNG 图标
 * macOS .icns 格式：文件头(4B magic + 4B size) + 多个条目(4B type + 4B size + data)
 * 较大尺寸的图标条目（ic07~ic14）内嵌的就是完整的 PNG 文件
 * 
 * 图标类型对应尺寸：
 *   ic07 = 128x128, ic08 = 256x256, ic09 = 512x512, ic10 = 1024x1024
 *   ic11 = 32x32@2x, ic12 = 64x64@2x, ic13 = 256x256@2x, ic14 = 512x512@2x
 */
function extractPngFromIcns(icnsPath: string): Buffer | null {
  try {
    const buf = readFileSync(icnsPath)
    // 校验 icns 文件头
    if (buf.length < 8 || buf.toString('ascii', 0, 4) !== 'icns') {
      return null
    }

    let offset = 8
    // 目标：找一个适中大小的 PNG（128x128 ~ 256x256 最佳，避免太大浪费传输）
    // 优先级：ic08(256x256) > ic13(256x256@2x) > ic07(128x128) > ic12(64x64@2x) > 其他
    const preferredTypes = ['ic08', 'ic13', 'ic07', 'ic12']
    const pngEntries = new Map<string, Buffer>()
    let fallbackPng: Buffer | null = null
    let fallbackSize = 0

    while (offset < buf.length - 8) {
      const type = buf.toString('ascii', offset, offset + 4)
      const size = buf.readUInt32BE(offset + 4)
      if (size <= 8 || size > buf.length - offset) break

      const data = buf.slice(offset + 8, offset + size)
      // 检查是否是 PNG 数据（PNG magic: 89 50 4E 47）
      if (data.length >= 4 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
        pngEntries.set(type, data)
        // 同时记录最大的 PNG 作为兜底
        if (data.length > fallbackSize) {
          fallbackSize = data.length
          fallbackPng = data
        }
      }
      offset += size
    }

    // 按优先级选择
    for (const t of preferredTypes) {
      if (pngEntries.has(t)) {
        return pngEntries.get(t)!
      }
    }
    // 没有优先类型，返回最大的 PNG
    return fallbackPng
  } catch {
    return null
  }
}

/**
 * 获取单个应用图标（base64 data URL）
 * 从 .app/Contents/Resources/ 中解析 .icns 文件提取嵌入的 PNG 高清图标
 * 使用 nativeImage resize 到 64x64 后转为 base64
 */
export async function getAppIcon(appPath: string): Promise<string> {
  // 先查缓存
  if (iconCache.has(appPath)) {
    return iconCache.get(appPath)!
  }

  // 从 .icns 文件中提取 PNG 图标
  try {
    let iconFileName = getIconFileFromPlist(appPath)
    if (iconFileName) {
      if (!iconFileName.endsWith('.icns')) {
        iconFileName += '.icns'
      }
      const icnsPath = join(appPath, 'Contents', 'Resources', iconFileName)
      const pngData = extractPngFromIcns(icnsPath)
      if (pngData) {
        const icon = nativeImage.createFromBuffer(pngData)
        if (icon && !icon.isEmpty()) {
          // resize 到 64x64，平衡清晰度和传输大小
          const resized = icon.resize({ width: 64, height: 64, quality: 'best' })
          const pngBuffer = resized.toPNG()
          if (pngBuffer.length > 0) {
            const dataUrl = `data:image/png;base64,${pngBuffer.toString('base64')}`
            iconCache.set(appPath, dataUrl)
            return dataUrl
          }
        }
      }
    }
  } catch {
    // icns 解析失败，继续尝试其他方案
  }

  // 回退：如果 .icns 中没有 PNG（老格式），尝试直接用 base64 编码整个 icns 中最大的 PNG
  // 或者尝试 Electron 的 app.getFileIcon()
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
  } catch {
    // getFileIcon 也失败了
  }
  return ''
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