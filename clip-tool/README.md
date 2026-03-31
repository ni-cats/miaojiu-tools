
<div align="center">

<img src="./resources/icon/miaojiu-clip-logo.png" alt="ClipTool Logo" width="128" />

# ClipTool

**macOS Clipboard & Code Snippet Manager**

[![Platform](https://img.shields.io/badge/platform-macOS-blue?logo=apple&logoColor=white)](#)
[![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](#)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](#license)

**[🇨🇳 中文](./README_ZH.md)**

</div>

---

> A macOS clipboard management tool built for developers. Save code snippets, smart categorization, fuzzy search, AI chat, quick navigation, and multi-device sync via Tencent Cloud COS.

## 📑 Table of Contents

- [Features](#-features)
- [Screenshots](#-screenshots)
- [Getting Started](#-getting-started)
- [Development](#-development)
- [Project Structure](#-project-structure)
- [Configuration](#-configuration)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Tech Stack](#-tech-stack)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

## ✨ Features

<table>
<tr>
<td width="50%">

### 📋 Clipboard Management
- **Smart Detection** — Auto-detect content type (code, text, URL, image, document, etc.)
- **Language Detection** — Auto-identify TypeScript, JavaScript, Python, Java, Go, Rust, C++, SQL, and more
- **Image Support** — Read and save clipboard images
- **History** — Configurable clipboard history retention

</td>
<td width="50%">

### 💾 Code Snippets
- **Quick Save** — One-click save clipboard content as snippets
- **Tag Management** — Custom tags for flexible categorization
- **Favorites** — Bookmark frequently used snippets
- **Syntax Highlighting** — Powered by [Shiki](https://shiki.matsu.io/)
- **Fuzzy Search** — Full-text fuzzy search via [Fuse.js](https://fusejs.io/)

</td>
</tr>
<tr>
<td width="50%">

### 🤖 AI Capabilities
- **AI Chat** — Integrated Tencent Hunyuan LLM with streaming responses
- **Smart Titles** — AI-generated titles for clipboard content
- **Multi-Model** — Support for Hunyuan and DeepSeek models

</td>
<td width="50%">

### 🚀 Quick Navigation
- **Quick Links** — Custom website/tool shortcuts, one-click open
- **Category Management** — Organize links by categories
- **URL Templates** — Dynamic URL parameter templates

</td>
</tr>
<tr>
<td width="50%">

### ☁️ Cloud Sync
- **Tencent Cloud COS** — Data sync via Tencent Cloud Object Storage
- **Multi-Device** — Full sync of snippets, favorites, tags, and settings
- **Device Identity** — Auto-generated device ID for data isolation

</td>
<td width="50%">

### 🎨 More Features
- **Vibrancy Effect** — Native macOS frosted glass window
- **System Tray** — Always accessible from the menu bar
- **Window Memory** — Remembers window size and position
- **Auto-Hide** — Window hides on blur to stay out of the way
- **Themes** — Multiple theme styles

</td>
</tr>
</table>

## 📸 Screenshots

<!-- Place screenshots in docs/screenshots/ directory -->

> 🚧 Screenshots coming soon...

<!--
<div align="center">
  <img src="./docs/screenshots/main.png" width="80%" alt="Main Interface" />
  <p><em>Main Interface — Clipboard Management</em></p>
</div>
-->

## 🚀 Getting Started

### System Requirements

- **macOS** 11.0 (Big Sur) or later
- **Chip** Apple Silicon (M1/M2/M3) or Intel

### Option 1: DMG Installer (Recommended)

1. Download the latest `ClipTool-x.x.x-arm64.dmg` from the Release page
2. Open the DMG file and drag `ClipTool.app` to `/Applications`
3. If you see a "damaged" warning, run in Terminal:

```bash
xattr -cr /Applications/ClipTool.app
```

> ⚠️ If you see "unverified developer" on first launch, go to **System Settings → Privacy & Security** and click "Open Anyway".

### Option 2: Build from Source

```bash
# Clone the repository
git clone <repo-url>
cd miaojiu-tools/clip-tool

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build DMG installer
npm run pack
```

## 🛠 Development

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 18 |
| npm | >= 9 |
| macOS | macOS only |

### Available Scripts

```bash
# Development mode (hot reload)
npm run dev

# Build main process only
npm run build:main

# Build preload script only
npm run build:preload

# Build renderer only
npm run build:renderer

# Full build
npm run build

# Build and launch
npm start

# Package as DMG
npm run pack

# Package .app only (electron-builder)
npm run pack:app
```

## 📁 Project Structure

```
clip-tool/
├── src/
│   ├── main/                        # Electron main process
│   │   ├── index.ts                 # Entry point, window creation & lifecycle
│   │   ├── clipboard.ts             # Clipboard read/write & content detection
│   │   ├── config.ts                # YAML config file reader
│   │   ├── cos.ts                   # Tencent Cloud COS sync
│   │   ├── hunyuan.ts               # Tencent Hunyuan LLM API wrapper
│   │   ├── ipc.ts                   # IPC communication handler
│   │   ├── shortcuts.ts             # Global shortcut registration
│   │   ├── store.ts                 # Local data storage (electron-store)
│   │   └── tray.ts                  # System tray
│   ├── preload/
│   │   └── index.ts                 # Preload script, expose secure APIs
│   └── renderer/                    # Renderer process (React)
│       ├── App.tsx                  # Root application component
│       ├── main.tsx                 # Renderer entry point
│       ├── types.ts                 # Global type declarations
│       ├── components/              # UI Components
│       │   ├── SavePanel.tsx        # Save panel
│       │   ├── SearchPanel.tsx      # Search panel
│       │   ├── EditorPanel.tsx      # Code editor panel
│       │   ├── AiPanel.tsx          # AI chat panel
│       │   ├── FavoritePanel.tsx    # Favorites panel
│       │   ├── SettingsPanel.tsx    # Settings panel
│       │   ├── ProfilePanel.tsx     # Profile panel
│       │   ├── LauncherPanel.tsx    # Quick navigation panel
│       │   ├── DocPanel.tsx         # Documentation panel
│       │   ├── ClipboardHistoryWindow.tsx  # Clipboard history window
│       │   ├── SnippetCard.tsx      # Snippet card component
│       │   ├── TagFilter.tsx        # Tag filter component
│       │   └── EmptyState.tsx       # Empty state component
│       ├── hooks/                   # Custom Hooks
│       │   ├── useClipboard.ts      # Clipboard hook
│       │   ├── useSearch.ts         # Search hook
│       │   └── useShortcuts.ts      # Shortcuts hook
│       ├── utils/                   # Utility functions
│       │   ├── formatTime.ts        # Time formatting
│       │   └── tagColor.ts          # Tag color utilities
│       └── styles/
│           └── global.css           # Global styles
├── resources/                       # Resource files
│   ├── config.yaml                  # App configuration
│   ├── icon.icns                    # App icon
│   └── icon/                        # Icon assets
├── scripts/                         # Build scripts
│   ├── build-dmg.sh                 # DMG packaging script
│   ├── gen-icon.sh                  # Icon generation script
│   └── sync-to-cos.js              # COS sync script
├── package.json
├── tsconfig.json
├── vite.config.ts                   # Vite renderer config
├── vite.main.config.ts              # Vite main process config
└── vite.preload.config.ts           # Vite preload config
```

## ⚙️ Configuration

App configuration is located at `resources/config.yaml`:

```yaml
# Tencent Cloud COS storage config
cos:
  bucket: "your-bucket-name"
  region: "ap-guangzhou"
  secretId: "your-secret-id"
  secretKey: "your-secret-key"
  enabled: true

# Tencent Hunyuan LLM config
hunyuan:
  secretId: "your-secret-id"
  secretKey: "your-secret-key"
  enabled: true

# App defaults
app:
  storageMode: "cos"          # local or cos
  aiTitleEnabled: true         # AI auto-generate titles
  aiModels:
    - provider: "hunyuan"
      model: "hunyuan-lite"
      enabled: true
```

> ⚠️ **Security Notice**: Never commit `config.yaml` with real secrets to a public repository. Add it to `.gitignore`.

## ⌨️ Keyboard Shortcuts

| Action | Default Shortcut | Description |
|--------|-----------------|-------------|
| Save Snippet | `⌘ + Shift + K` | Save current clipboard content |
| Search Snippets | Customizable | Full-text fuzzy search |
| Code Editor | Customizable | Open code editor panel |
| AI Chat | Customizable | Open AI chat panel |
| Favorites | Customizable | View bookmarked snippets |
| Settings | Customizable | Open settings panel |
| Profile | Customizable | Profile management |
| Quick Nav | Customizable | Open quick navigation |

> 💡 All shortcuts can be customized in the Settings panel.

## 🧩 Tech Stack

| Technology | Description |
|------------|-------------|
| [Electron 28](https://www.electronjs.org/) | Cross-platform desktop app framework |
| [React 18](https://react.dev/) | UI framework |
| [TypeScript 5](https://www.typescriptlang.org/) | Type safety |
| [Vite 5](https://vitejs.dev/) | Next-generation build tool |
| [Shiki](https://shiki.matsu.io/) | Syntax highlighting |
| [Fuse.js](https://fusejs.io/) | Fuzzy search engine |
| [electron-store](https://github.com/sindresorhus/electron-store) | Local data persistence |
| [cos-nodejs-sdk-v5](https://github.com/tencentyun/cos-nodejs-sdk-v5) | Tencent Cloud COS SDK |
| [tencentcloud-sdk-nodejs-hunyuan](https://github.com/TencentCloud/tencentcloud-sdk-nodejs) | Tencent Hunyuan LLM SDK |
| [Day.js](https://day.js.org/) | Lightweight date library |
| [electron-builder](https://www.electron.build/) | App packaging tool |

## 🗺 Roadmap

- [ ] Windows / Linux support
- [ ] More AI model integrations (OpenAI, Claude, etc.)
- [ ] Snippet version history
- [ ] Team collaboration & snippet sharing
- [ ] Plugin system
- [ ] Auto-update

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. **Fork** the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a **Pull Request**

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation update |
| `style` | Code formatting (no logic change) |
| `refactor` | Code refactoring |
| `perf` | Performance improvement |
| `chore` | Build/tooling changes |

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

<div align="center">

**Made with ❤️ by [miaojiu](https://github.com/miaojiu)**

[⬆ Back to Top](#cliptool)

</div>
