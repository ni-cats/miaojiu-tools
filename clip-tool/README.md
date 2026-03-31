
# 🐱 ClipTool — macOS 剪贴板代码片段管理工具

![ClipTool Logo](./resources/icon/miaojiu-clip-logo.png)

<p align="center">
  一款专为开发者打造的 macOS 剪贴板管理工具，支持代码片段保存、智能分类、模糊搜索、AI 对话、快速导航等功能，并可通过腾讯云 COS 实现多设备数据同步。
</p>

---

## ✨ 功能特性

### 📋 剪贴板管理
- **智能识别** — 自动检测剪贴板内容类型（代码、文本、URL、图片、文档等）
- **语言检测** — 自动识别 TypeScript、JavaScript、Python、Java、Go、Rust、C++、SQL 等编程语言
- **图片支持** — 支持剪贴板图片的读取与保存（base64 格式）
- **历史记录** — 保留剪贴板历史，可配置保留条数

### 💾 代码片段
- **快速保存** — 一键保存剪贴板内容为代码片段
- **标签管理** — 支持自定义标签，灵活分类管理
- **收藏功能** — 常用片段一键收藏，快速访问
- **代码高亮** — 基于 [Shiki](https://shiki.matsu.io/) 的语法高亮渲染
- **模糊搜索** — 基于 [Fuse.js](https://fusejs.io/) 的全文模糊搜索

### 🤖 AI 能力
- **AI 对话** — 集成腾讯混元大模型，支持流式对话
- **智能标题** — AI 自动为剪贴板内容生成简短标题
- **多模型支持** — 支持混元（hunyuan）和 DeepSeek 模型配置

### 🚀 快速导航
- **快速链接** — 自定义常用网站/工具链接，一键打开
- **分类管理** — 链接按分类组织，支持自定义分类
- **参数模板** — 链接支持 URL 参数模板，动态填充

### ☁️ 云端同步
- **腾讯云 COS** — 基于腾讯云对象存储实现数据同步
- **多设备同步** — 片段、收藏、标签、设置、个人信息全量同步
- **设备标识** — 自动生成设备 ID，区分不同设备数据

### ⌨️ 全局快捷键
- **快速唤起** — 全局快捷键一键唤起各功能面板
- **自定义配置** — 所有快捷键均可自定义修改

| 功能 | 默认快捷键 |
|------|-----------|
| 保存片段 | `⌘ + Shift + K` |
| 搜索片段 | 自定义 |
| 代码编辑器 | 自定义 |
| AI 对话 | 自定义 |
| 收藏夹 | 自定义 |
| 设置 | 自定义 |
| 个人中心 | 自定义 |
| 快速导航 | 自定义 |

### 🎨 其他特性
- **毛玻璃效果** — macOS 原生 vibrancy 毛玻璃窗口
- **系统托盘** — 常驻菜单栏，随时访问
- **窗口记忆** — 自动记忆窗口大小和位置
- **失焦隐藏** — 窗口失去焦点自动隐藏，不干扰工作
- **主题切换** — 支持多种主题风格
- **个人中心** — 个人信息管理，头像、昵称、签名

---

## 🛠️ 技术栈

| 技术 | 说明 |
|------|------|
| [Electron](https://www.electronjs.org/) | 跨平台桌面应用框架 |
| [React 18](https://react.dev/) | UI 框架 |
| [TypeScript](https://www.typescriptlang.org/) | 类型安全 |
| [Vite](https://vitejs.dev/) | 构建工具 |
| [Shiki](https://shiki.matsu.io/) | 代码语法高亮 |
| [Fuse.js](https://fusejs.io/) | 模糊搜索引擎 |
| [electron-store](https://github.com/sindresorhus/electron-store) | 本地数据持久化 |
| [cos-nodejs-sdk-v5](https://github.com/tencentyun/cos-nodejs-sdk-v5) | 腾讯云 COS SDK |
| [tencentcloud-sdk-nodejs-hunyuan](https://github.com/TencentCloud/tencentcloud-sdk-nodejs) | 腾讯混元大模型 SDK |
| [Day.js](https://day.js.org/) | 日期处理 |
| [electron-builder](https://www.electron.build/) | 应用打包 |

---

## 📦 安装

### 方式一：DMG 安装包（推荐）

1. 从 Release 页面下载最新的 `ClipTool-x.x.x-arm64.dmg`
2. 双击打开 DMG 文件，将 `ClipTool.app` 拖拽到 `/Applications` 文件夹
3. 如果提示"已损坏"，在终端执行：`xattr -cr /Applications/ClipTool.app`

> ⚠️ 首次打开如遇到"无法验证开发者"提示，请前往 **系统设置 → 隐私与安全性** 中点击"仍要打开"。

### 方式二：从源码构建

```bash
# 克隆项目
git clone <repo-url>
cd miaojiu-tools/clip-tool

# 安装依赖
npm install

# 开发模式运行
npm run dev

# 构建 DMG 安装包
npm run pack
```

---

## 🚀 开发指南

### 环境要求

- **Node.js** >= 18
- **npm** >= 9
- **macOS**（仅支持 macOS 平台）

### 常用命令

```bash
# 开发模式（热重载）
npm run dev

# 仅构建主进程
npm run build:main

# 仅构建 preload 脚本
npm run build:preload

# 仅构建渲染进程
npm run build:renderer

# 全量构建
npm run build

# 构建并启动
npm start

# 打包为 DMG
npm run pack

# 仅打包 .app（electron-builder）
npm run pack:app
```

### 配置文件

应用配置位于 `resources/config.yaml`，包含：

```yaml
# 腾讯云 COS 云端存储配置
cos:
  bucket: "your-bucket-name"
  region: "ap-guangzhou"
  secretId: "your-secret-id"
  secretKey: "your-secret-key"
  enabled: true

# 腾讯混元大模型配置
hunyuan:
  secretId: "your-secret-id"
  secretKey: "your-secret-key"
  enabled: true
```

> ⚠️ 请勿将包含密钥的 `config.yaml` 提交到公开仓库。

---

## 📁 项目结构

```
clip-tool/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 主进程入口，窗口创建与生命周期
│   │   ├── clipboard.ts         # 剪贴板读写与内容类型检测
│   │   ├── config.ts            # YAML 配置文件读取
│   │   ├── cos.ts               # 腾讯云 COS 云端同步
│   │   ├── hunyuan.ts           # 腾讯混元大模型 API 封装
│   │   ├── ipc.ts               # IPC 通信处理
│   │   ├── shortcuts.ts         # 全局快捷键注册
│   │   ├── store.ts             # 本地数据存储（electron-store）
│   │   └── tray.ts              # 系统托盘
│   ├── preload/
│   │   └── index.ts             # 预加载脚本，暴露安全 API
│   └── renderer/                # 渲染进程（React）
│       ├── App.tsx              # 应用主组件
│       ├── main.tsx             # 渲染进程入口
│       ├── types.ts             # 全局类型声明
│       ├── components/          # UI 组件
│       │   ├── SavePanel.tsx    # 保存面板
│       │   ├── SearchPanel.tsx  # 搜索面板
│       │   ├── EditorPanel.tsx  # 代码编辑器面板
│       │   ├── AiPanel.tsx      # AI 对话面板
│       │   ├── FavoritePanel.tsx # 收藏夹面板
│       │   ├── SettingsPanel.tsx # 设置面板
│       │   ├── ProfilePanel.tsx # 个人中心面板
│       │   ├── LauncherPanel.tsx # 快速导航面板
│       │   ├── DocPanel.tsx     # 文档面板
│       │   ├── SnippetCard.tsx  # 片段卡片组件
│       │   ├── TagFilter.tsx    # 标签筛选组件
│       │   └── EmptyState.tsx   # 空状态组件
│       ├── hooks/               # 自定义 Hooks
│       │   ├── useClipboard.ts  # 剪贴板 Hook
│       │   ├── useSearch.ts     # 搜索 Hook
│       │   └── useShortcuts.ts  # 快捷键 Hook
│       ├── utils/               # 工具函数
│       │   ├── formatTime.ts    # 时间格式化
│       │   └── tagColor.ts     # 标签颜色
│       └── styles/
│           └── global.css       # 全局样式
├── resources/                   # 资源文件
│   ├── config.yaml              # 应用配置
│   ├── icon.icns                # 应用图标
│   ├── icon/                    # 图标资源
│   └── 安装.command             # DMG 安装脚本
├── scripts/                     # 构建脚本
│   ├── build-dmg.sh             # DMG 打包脚本
│   ├── gen-icon.sh              # 图标生成脚本
│   ├── crop-icon.py             # 图标裁剪脚本
│   ├── generate-icon.js         # 图标生成 JS 脚本
│   └── sync-to-cos.js           # COS 同步脚本
├── package.json
├── tsconfig.json
├── vite.config.ts               # Vite 渲染进程配置
├── vite.main.config.ts          # Vite 主进程配置
└── vite.preload.config.ts       # Vite preload 配置
```

---

## 📄 License

MIT
