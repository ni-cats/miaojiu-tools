# 实施计划

- [ ] 1. 安装 Tesseract.js 依赖并配置语言包资源
   - 在 `clip-tool/` 目录下执行 `npm install tesseract.js` 安装 OCR 引擎
   - 将中英文语言包（`eng.traineddata`、`chi_sim.traineddata`）下载并放置到 `clip-tool/resources/tessdata/` 目录，确保打包后可离线使用
   - 在 Vite main 进程构建配置（`vite.main.config.ts`）中确保 `tesseract.js` 被正确处理（external 或 bundle）
   - _需求：1.1、1.5、1.7_

- [ ] 2. 实现 OCR 引擎服务模块（`src/main/ocr.ts`）
   - 创建 `src/main/ocr.ts` 文件，封装 Tesseract.js Worker 的初始化、预加载和识别逻辑
   - 实现 `initOcrEngine()` 函数：应用启动时预加载 OCR 引擎和中英文语言包，使用本地 `resources/tessdata/` 路径加载语言包实现离线
   - 实现 `recognizeImage(base64Image: string): Promise<{ text: string; confidence: number }>` 函数：接收 base64 图片，返回识别文字和置信度
   - 实现并发控制：同一时间只允许一个 OCR 任务运行（使用锁机制），避免资源竞争
   - 实现引擎状态查询 `getOcrStatus(): { ready: boolean; loading: boolean }` 供 UI 层判断引擎是否就绪
   - 处理边界情况：大图片压缩（超过 4MB 时压缩）、无文字识别结果时返回空字符串
   - _需求：1.1、1.4、1.5、1.7_

- [ ] 3. 注册 OCR 相关 IPC Handler（`src/main/ipc.ts`）
   - 在 `ipc.ts` 的 `registerIpcHandlers()` 中新增 `ocr:recognize` handler：接收 base64 图片，调用 `recognizeImage()` 返回识别结果
   - 新增 `ocr:getStatus` handler：返回 OCR 引擎的就绪状态
   - 新增 `ocr:translate` handler：接收 base64 图片 + 目标语言，先调用 `recognizeImage()` 获取原文，再调用 `chatWithHunyuan()` 进行翻译，返回 `{ original: string, translated: string }`
   - 翻译时构造 system prompt：`"你是一个翻译助手。请将以下文本翻译为{目标语言}，只输出翻译结果，不要添加任何解释。"`
   - 在 `ipc.ts` 顶部 import `recognizeImage`、`getOcrStatus` 等函数
   - _需求：1.1、2.1、2.6_

- [ ] 4. 在主进程入口调用 OCR 引擎预加载（`src/main/index.ts`）
   - 在 `app.whenReady()` 回调中，于 `registerIpcHandlers()` 之后调用 `initOcrEngine()` 进行预加载
   - 预加载使用异步方式，不阻塞窗口创建和显示
   - 添加日志输出：`log('main', '🔍 OCR 引擎预加载...')` 和完成/失败日志
   - _需求：1.7_

- [ ] 5. 在 Preload 层暴露 OCR API（`src/preload/index.ts`）
   - 在 `api` 对象中新增 OCR 相关 API：
     - `ocrRecognize(base64Image: string): Promise<{ text: string; confidence: number }>` — 调用 `ipcRenderer.invoke('ocr:recognize', base64Image)`
     - `ocrGetStatus(): Promise<{ ready: boolean; loading: boolean }>` — 调用 `ipcRenderer.invoke('ocr:getStatus')`
     - `ocrTranslate(base64Image: string, targetLang: string): Promise<{ original: string; translated: string }>` — 调用 `ipcRenderer.invoke('ocr:translate', base64Image, targetLang)`
   - 在 `window.d.ts` 类型声明文件中补充对应的类型定义
   - _需求：1.1、2.1_

- [ ] 6. 在 LauncherPanel 中新增 OCR 识别和 OCR 翻译内置工具卡片
   - 在 `LauncherPanel.tsx` 的 `builtinTools` 数组中新增两个工具定义：
     - `{ id: '__builtin_ocr__', name: 'OCR 文字识别', icon: '🔍', category: '工具', description: '从图片中识别文字（离线）', keywords: ['ocr', '识别', '文字', '图片', '截图'], toolKey: 'ocr' }`
     - `{ id: '__builtin_ocr_translate__', name: 'OCR 翻译', icon: '🌐', category: '工具', description: '识别图片文字并翻译', keywords: ['ocr', '翻译', 'translate', '图片', '文字'], toolKey: 'ocrTranslate' }`
   - 在 `toolIconMap` 中新增 `ocr` 和 `ocrTranslate` 的图标映射（可复用 `LauncherIcons.tsx` 中已有的 `IconOCR` 或新建 SVG 图标）
   - 在 `handleToolOpen` 中新增 OCR 工具的状态重置逻辑
   - _需求：1.1、2.1_

- [ ] 7. 实现 OCR 识别工具的 UI 交互区域（LauncherPanel 内）
   - 在 `LauncherPanel.tsx` 中新增 `activeTool === 'ocr'` 的渲染分支，参考现有 `imageBase64` 工具的 UI 结构
   - UI 包含：标题栏（含关闭按钮）、"从剪贴板读取图片"按钮、图片预览区域、识别结果文本展示区域、"复制识别结果"按钮
   - 新增状态变量：`ocrImage`（当前图片 base64）、`ocrResult`（识别结果文字）、`ocrLoading`（识别中状态）、`ocrError`（错误信息）
   - 点击"从剪贴板读取图片"时调用 `window.clipToolAPI.readClipboard()` 获取图片，若非图片类型则提示"剪贴板中没有图片"
   - 获取图片后自动调用 `window.clipToolAPI.ocrRecognize(base64)` 进行识别，识别过程中显示 loading 状态
   - 识别完成后展示结果文字，若结果为空则显示"未识别到文字内容"
   - 在 footer 区域新增 OCR 工具的快捷键提示
   - _需求：1.1、1.2、1.4、1.6_

- [ ] 8. 实现 OCR 翻译工具的 UI 交互区域（LauncherPanel 内）
   - 在 `LauncherPanel.tsx` 中新增 `activeTool === 'ocrTranslate'` 的渲染分支
   - UI 包含：标题栏、"从剪贴板读取图片"按钮、图片预览、目标语言选择下拉框（中文/英文/日文）、原文展示区域（含"复制原文"按钮）、译文展示区域（含"复制译文"按钮）
   - 新增状态变量：`ocrTranslateOriginal`、`ocrTranslateResult`、`ocrTranslateLoading`、`ocrTranslateStep`（'识别中...' / '翻译中...'）、`ocrTargetLang`（默认 '中文'）
   - 分步显示进度：先显示"正在识别文字..."，识别完成后显示原文并切换为"正在翻译..."，翻译完成后展示译文
   - 若混元未配置，识别完成后提示"翻译服务未配置，请在设置中配置混元大模型密钥"，仍展示原文
   - _需求：2.1、2.2、2.3、2.5、2.6_

- [ ] 9. 在 EditorPanel 剪贴板历史中为图片记录添加 OCR 操作按钮
   - 在 `EditorPanel.tsx` 中，图片类型历史记录的渲染区域（`item.isImage || item.content.startsWith('data:image/')` 分支）新增 "OCR" 操作按钮
   - 点击 OCR 按钮后，调用 `window.clipToolAPI.ocrRecognize(item.content)` 进行识别
   - 识别结果以 Toast 或内联展开的方式展示在该历史记录下方，并提供"复制"按钮
   - 新增状态变量管理当前正在 OCR 的历史记录 ID 和结果
   - _需求：1.3、1.2_

- [ ] 10. 为 OCR 工具 UI 添加 CSS 样式（`global.css`）
   - 在 `global.css` 中新增 OCR 工具相关样式，复用现有 `.launcher-base64-tool` 的布局结构
   - 新增样式类：`.launcher-ocr-tool`（工具容器）、`.launcher-ocr-preview`（图片预览）、`.launcher-ocr-result`（识别结果区域）、`.launcher-ocr-actions`（操作按钮组）、`.launcher-ocr-step`（翻译进度步骤指示器）
   - 新增 EditorPanel 中 OCR 按钮和内联结果的样式：`.editor-history-ocr-btn`、`.editor-history-ocr-result`
   - 确保深色/浅色主题兼容（使用 CSS 变量）
   - _需求：1.6、2.5_
