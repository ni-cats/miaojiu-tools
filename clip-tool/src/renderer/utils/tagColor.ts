/**
 * 标签颜色工具
 * 根据标签名称生成稳定的颜色方案，确保同名标签总是显示相同颜色
 * 支持传入标签列表，按索引分配不同颜色，避免同组标签颜色碰撞
 */

/** 预设标签颜色方案（背景色、文字色），相邻色相间隔大，辨识度高 */
const TAG_COLOR_PALETTE = [
  { bg: 'rgba(0, 122, 255, 0.12)', text: '#007aff' },    // 蓝色
  { bg: 'rgba(255, 149, 0, 0.12)', text: '#ff9500' },     // 橙色
  { bg: 'rgba(52, 199, 89, 0.12)', text: '#34c759' },     // 绿色
  { bg: 'rgba(175, 82, 222, 0.12)', text: '#af52de' },    // 紫色
  { bg: 'rgba(255, 59, 48, 0.12)', text: '#ff3b30' },     // 红色
  { bg: 'rgba(0, 199, 190, 0.12)', text: '#00c7be' },     // 青色
  { bg: 'rgba(255, 204, 0, 0.15)', text: '#c79800' },     // 黄色
  { bg: 'rgba(88, 86, 214, 0.12)', text: '#5856d6' },     // 靛蓝
  { bg: 'rgba(255, 45, 85, 0.12)', text: '#ff2d55' },     // 粉红
  { bg: 'rgba(90, 200, 250, 0.12)', text: '#32ade6' },    // 天蓝
  { bg: 'rgba(162, 132, 94, 0.12)', text: '#a2845e' },    // 棕色
  { bg: 'rgba(99, 218, 56, 0.12)', text: '#55c233' },     // 草绿
]

/** 已注册标签的颜色缓存（按注册顺序分配不同颜色） */
const tagColorCache = new Map<string, { bg: string; text: string }>()
let nextColorIndex = 0

/**
 * 注册标签列表，按顺序为每个标签分配唯一颜色
 * 应在获取到自定义标签列表后调用
 */
export function registerTags(tags: string[]): void {
  tagColorCache.clear()
  nextColorIndex = 0
  for (const tag of tags) {
    if (!tagColorCache.has(tag)) {
      tagColorCache.set(tag, TAG_COLOR_PALETTE[nextColorIndex % TAG_COLOR_PALETTE.length])
      nextColorIndex++
    }
  }
}

/**
 * FNV-1a 哈希函数（用于未注册标签的 fallback）
 */
function hashString(str: string): number {
  let hash = 2166136261
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

/** 根据标签名获取颜色方案 */
export function getTagColor(tagName: string): { bg: string; text: string } {
  // 如果已注册（列表中的标签），直接返回按索引分配的颜色
  const cached = tagColorCache.get(tagName)
  if (cached) return cached

  // 未注册的新标签，用哈希分配颜色并缓存
  const index = hashString(tagName) % TAG_COLOR_PALETTE.length
  const color = TAG_COLOR_PALETTE[index]
  tagColorCache.set(tagName, color)
  return color
}

/** 根据标签名获取 style 对象，可直接用于 React 组件 */
export function getTagStyle(tagName: string): React.CSSProperties {
  const color = getTagColor(tagName)
  return {
    background: color.bg,
    color: color.text,
  }
}
