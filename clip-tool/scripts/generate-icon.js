/**
 * 生成托盘图标脚本
 * 运行: node scripts/generate-icon.js
 * 
 * 由于 macOS 托盘图标需要 Template 格式，
 * 这里创建一个简单的 22x22 黑色剪贴板图标
 */

// 如果你没有图标文件，可以暂时使用 Electron 的默认图标
// 或者使用以下方法在运行时创建图标：
//
// const { nativeImage } = require('electron')
// const icon = nativeImage.createFromDataURL('data:image/png;base64,...')
//
// 推荐在 https://www.figma.com 或 https://iconify.design 
// 下载一个 22x22 的剪贴板图标，命名为 iconTemplate.png 放在 resources/ 目录下
// macOS 规范：Template 图标必须是黑色+透明背景，系统会自动适配暗色菜单栏

console.log('请将 22x22 的 PNG 图标放置在 resources/iconTemplate.png')
console.log('图标规范：黑色 + 透明背景，macOS 会自动适配暗色/亮色菜单栏')
