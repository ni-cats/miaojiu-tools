/**
 * 导航栏面板组件
 * 类似 RayCast / 终端风格的快速启动器
 * 支持配置快速链接并在浏览器中打开
 */
import React, { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react'
import { nanoid } from 'nanoid'
import type { QuickLink, QuickLinkParam } from '../types'
import { getTagColor } from '../utils/tagColor'

/** 预设的 Emoji 图标列表 */
const ICON_OPTIONS = ['🌐', '📚', '🔧', '💻', '📊', '🎨', '📝', '🔗', '⚡', '🏠', '📦', '🎯', '🔍', '💡', '🚀', '📮']

/**
 * 根据 URL 生成 favicon 地址
 * 优先使用 Google Favicon Service，大小 32px
 */
function getFaviconUrl(url: string): string {
  try {
    let domain: string
    if (url.startsWith('http://') || url.startsWith('https://')) {
      domain = new URL(url).hostname
    } else {
      domain = new URL('https://' + url).hostname
    }
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
  } catch {
    return ''
  }
}

/**
 * Favicon 图标组件
 * 优先显示 favicon 图片，加载失败时回退到 Emoji 图标
 */
const FaviconIcon: React.FC<{ favicon?: string; emoji: string }> = ({ favicon, emoji }) => {
  const [failed, setFailed] = useState(false)

  // favicon 变化时重置失败状态
  useEffect(() => {
    setFailed(false)
  }, [favicon])

  if (favicon && !failed) {
    return (
      <img
        src={favicon}
        alt=""
        className="launcher-favicon"
        onError={() => setFailed(true)}
        draggable={false}
      />
    )
  }
  return <span>{emoji}</span>
}

interface LauncherPanelProps {
  /** 切换到 AI 页面并传递搜索词 */
  onSwitchToAi?: (query: string) => void
}

export interface LauncherPanelRef {
  /** 聚焦到搜索框 */
  focusSearch: () => void
  /** 处理 Esc 键，返回 true 表示已消费（存在子状态需要退出），返回 false 表示无子状态可以关闭窗口 */
  handleEscape: () => boolean
}

/**
 * 解析 URL 中的占位符参数名
 * 例如 "https://example.com/{keyword}/page/{page}" => ["keyword", "page"]
 */
function parseUrlPlaceholders(url: string): string[] {
  const regex = /\{([^}]+)\}/g
  const names: string[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(url)) !== null) {
    if (!names.includes(match[1])) {
      names.push(match[1])
    }
  }
  return names
}

/**
 * 将 URL 中的占位符替换为实际值
 */
function resolveUrl(url: string, paramValues: Record<string, string>): string {
  return url.replace(/\{([^}]+)\}/g, (_, name) => {
    const val = paramValues[name]
    return val !== undefined ? encodeURIComponent(val) : ''
  })
}

const LauncherPanel = forwardRef<LauncherPanelRef, LauncherPanelProps>(({ onSwitchToAi }, ref) => {
  const [links, setLinks] = useState<QuickLink[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  // 分类标签筛选
  const [activeCategory, setActiveCategory] = useState<string>('全部')
  // 持久化的分类列表
  const [categoryOptions, setCategoryOptions] = useState<string[]>(['常用', '工作', '文档', '工具', '社交', '其他'])

  // 内置工具激活状态（null=未激活, 'base64'=Base64工具, 'timestamp'=时间戳工具, 'imageBase64'=图片Base64工具）
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [base64Input, setBase64Input] = useState('')
  const [base64Encoded, setBase64Encoded] = useState('')
  const [base64Decoded, setBase64Decoded] = useState('')
  const [base64Error, setBase64Error] = useState('')
  // Base64 工具结果选中索引（0=encode, 1=decode）
  const [base64SelectedIndex, setBase64SelectedIndex] = useState(0)
  const base64InputRef = useRef<HTMLTextAreaElement>(null)

  // 时间戳转换工具状态
  const [tsInput, setTsInput] = useState('')
  const [tsResult, setTsResult] = useState('')
  const [tsNow, setTsNow] = useState('')
  const [tsSelectedIndex, setTsSelectedIndex] = useState(0) // 0=转换结果, 1=当前时间戳
  const tsInputRef = useRef<HTMLInputElement>(null)
  const tsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 图片Base64工具状态
  const [imgBase64Result, setImgBase64Result] = useState('')
  const [imgPreviewSrc, setImgPreviewSrc] = useState('')
  const [imgBase64Input, setImgBase64Input] = useState('')
  const [imgBase64Mode, setImgBase64Mode] = useState<'toBase64' | 'toImage'>('toBase64') // 当前模式
  const imgFileInputRef = useRef<HTMLInputElement>(null)

  // 复制提示 toast
  const [copyToast, setCopyToast] = useState<string | null>(null)
  const copyToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 参数输入弹窗状态
  const [paramLink, setParamLink] = useState<QuickLink | null>(null)
  const [paramValues, setParamValues] = useState<Record<string, string>>({})

  // AI 搜索内联结果状态
  const [aiSearching, setAiSearching] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [aiStreamContent, setAiStreamContent] = useState('')
  const [showAiResult, setShowAiResult] = useState(false)
  const aiResultRef = useRef<HTMLDivElement>(null)

  // 新增/编辑表单
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formIcon, setFormIcon] = useState('🌐')
  const [formCategory, setFormCategory] = useState('常用')
  const [formFavicon, setFormFavicon] = useState('')
  const [faviconPreviewFailed, setFaviconPreviewFailed] = useState(false)
  const [formParams, setFormParams] = useState<QuickLinkParam[]>([])

  // 显示复制提示
  const showCopyToast = useCallback((msg: string) => {
    if (copyToastTimer.current) clearTimeout(copyToastTimer.current)
    setCopyToast(msg)
    copyToastTimer.current = setTimeout(() => setCopyToast(null), 1500)
  }, [])

  // 通用复制方法（复制 + 提示）
  const copyWithToast = useCallback((text: string) => {
    navigator.clipboard.writeText(text)
    showCopyToast('✓ 已复制到剪贴板')
  }, [showCopyToast])

  // 暴露方法
  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchInputRef.current?.focus()
    },
    handleEscape: () => {
      // 层层退出：参数弹窗 > AI结果 > 内置工具 > 搜索框有内容 > 添加表单 > 无子状态
      // 每步退出后都重新聚焦搜索框
      if (paramLink) {
        setParamLink(null)
        setParamValues({})
        setTimeout(() => searchInputRef.current?.focus(), 0)
        return true
      }
      if (showAiResult) {
        setShowAiResult(false)
        setAiResult('')
        setAiStreamContent('')
        setAiSearching(false)
        setTimeout(() => searchInputRef.current?.focus(), 0)
        return true
      }
      if (activeTool) {
        setActiveTool(null)
        setTimeout(() => searchInputRef.current?.focus(), 0)
        return true
      }
      if (searchQuery.trim()) {
        setSearchQuery('')
        setSelectedIndex(0)
        // 搜索框本身已有焦点，确保聚焦
        searchInputRef.current?.focus()
        return true
      }
      if (isAdding) {
        resetForm()
        setTimeout(() => searchInputRef.current?.focus(), 0)
        return true
      }
      return false // 无子状态，可以关闭窗口
    },
  }))

  // 加载数据
  useEffect(() => {
    window.clipToolAPI.getQuickLinks().then(setLinks)
    window.clipToolAPI.getLauncherCategories().then(setCategoryOptions)
  }, [])

  // 监听 AI 流式响应
  useEffect(() => {
    const unsubscribe = window.clipToolAPI.onHunyuanStream((data) => {
      if (data.type === 'delta') {
        setAiStreamContent(data.fullContent || '')
      } else if (data.type === 'done') {
        setAiResult(data.content)
        setAiStreamContent('')
        setAiSearching(false)
      } else if (data.type === 'error') {
        setAiResult(`❌ 错误：${data.content}`)
        setAiStreamContent('')
        setAiSearching(false)
      }
    })
    return unsubscribe
  }, [])

  // AI 结果自动滚动到底部
  useEffect(() => {
    if (aiResultRef.current) {
      aiResultRef.current.scrollTop = aiResultRef.current.scrollHeight
    }
  }, [aiStreamContent, aiResult])

  // 计算可用的分类列表
  const availableCategories = React.useMemo(() => {
    const cats = new Set<string>()
    links.forEach((link) => cats.add(link.category))
    return ['全部', ...Array.from(cats)]
  }, [links])

  /** 内置工具列表定义 */
  const builtinTools = React.useMemo(() => [
    {
      id: '__builtin_base64__',
      name: 'Base64 编解码',
      icon: '🔧',
      category: '工具',
      description: '文本与 Base64 互相转换',
      keywords: ['base64', '编码', '解码', 'encode', 'decode', '工具'],
      toolKey: 'base64',
    },
    {
      id: '__builtin_timestamp__',
      name: '时间戳转换',
      icon: '🕐',
      category: '工具',
      description: '时间戳与日期时间互相转换',
      keywords: ['timestamp', '时间戳', '时间', '日期', '转换', 'unix', 'date', '工具'],
      toolKey: 'timestamp',
    },
    {
      id: '__builtin_image_base64__',
      name: '图片 Base64 转换',
      icon: '🖼️',
      category: '工具',
      description: '图片转 Base64 / Base64 转图片',
      keywords: ['图片', 'image', 'base64', '转换', '编码', 'img', 'png', 'jpg', '工具'],
      toolKey: 'imageBase64',
    },
  ], [])

  // 筛选结果（搜索 + 分类）
  const filteredLinks = links.filter((link) => {
    // 分类筛选
    if (activeCategory !== '全部' && link.category !== activeCategory) return false
    // 搜索筛选
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      link.name.toLowerCase().includes(q) ||
      link.url.toLowerCase().includes(q) ||
      link.category.toLowerCase().includes(q)
    )
  }).sort((a, b) => a.order - b.order)

  // 匹配的内置工具
  const matchedTools = React.useMemo(() => {
    if (!searchQuery.trim()) return builtinTools // 无搜索时显示全部内置工具
    const q = searchQuery.toLowerCase()
    return builtinTools.filter((tool) =>
      tool.name.toLowerCase().includes(q) ||
      tool.keywords.some((kw) => kw.toLowerCase().includes(q))
    )
  }, [searchQuery, builtinTools])

  // 合并后的总列表长度（链接 + 内置工具）
  const totalItems = filteredLinks.length + matchedTools.length

  // Base64 实时编解码
  const handleBase64InputChange = useCallback((value: string) => {
    setBase64Input(value)
    setBase64Error('')
    if (!value.trim()) {
      setBase64Encoded('')
      setBase64Decoded('')
      return
    }
    // Encode
    try {
      setBase64Encoded(btoa(unescape(encodeURIComponent(value))))
    } catch {
      setBase64Encoded('编码失败')
    }
    // Decode
    try {
      setBase64Decoded(decodeURIComponent(escape(atob(value))))
    } catch {
      setBase64Decoded('（输入不是有效的 Base64）')
    }
  }, [])

  // 时间戳转换逻辑
  const handleTsInputChange = useCallback((value: string) => {
    setTsInput(value)
    if (!value.trim()) {
      setTsResult('')
      return
    }
    const trimmed = value.trim()
    // 尝试解析为时间戳（纯数字）
    if (/^\d+$/.test(trimmed)) {
      let ts = parseInt(trimmed, 10)
      // 自动判断秒级/毫秒级
      if (ts < 1e12) ts *= 1000 // 秒级转毫秒
      const date = new Date(ts)
      if (!isNaN(date.getTime())) {
        const pad = (n: number) => n.toString().padStart(2, '0')
        const formatted = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
        setTsResult(`📅 ${formatted}\n⏱️ 秒级: ${Math.floor(ts / 1000)}\n⏱️ 毫秒级: ${ts}`)
        return
      }
    }
    // 尝试解析为日期字符串
    const date = new Date(trimmed)
    if (!isNaN(date.getTime())) {
      setTsResult(`⏱️ 秒级时间戳: ${Math.floor(date.getTime() / 1000)}\n⏱️ 毫秒级时间戳: ${date.getTime()}`)
      return
    }
    setTsResult('❌ 无法识别的格式，请输入时间戳或日期字符串')
  }, [])

  // 实时更新当前时间戳
  useEffect(() => {
    if (activeTool === 'timestamp') {
      const update = () => {
        const now = new Date()
        const pad = (n: number) => n.toString().padStart(2, '0')
        const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
        setTsNow(`${Math.floor(now.getTime() / 1000)}  |  ${formatted}`)
      }
      update()
      tsTimerRef.current = setInterval(update, 1000)
      return () => {
        if (tsTimerRef.current) clearInterval(tsTimerRef.current)
      }
    }
  }, [activeTool])

  // 图片转 Base64
  const handleImageFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setImgBase64Result(result)
      setImgPreviewSrc(result)
    }
    reader.readAsDataURL(file)
    // 重置 input 以便重复选择同一文件
    e.target.value = ''
  }, [])

  // Base64 转图片
  const handleImgBase64InputChange = useCallback((value: string) => {
    setImgBase64Input(value)
    if (!value.trim()) {
      setImgPreviewSrc('')
      return
    }
    // 自动补全 data URI 前缀
    let src = value.trim()
    if (!src.startsWith('data:')) {
      src = `data:image/png;base64,${src}`
    }
    setImgPreviewSrc(src)
  }, [])

  // 修正选中索引（当有搜索结果时才修正，无结果时 selectedIndex 用于 fallback 选项切换）
  useEffect(() => {
    if (totalItems > 0 && selectedIndex >= totalItems) {
      setSelectedIndex(Math.max(0, totalItems - 1))
    }
  }, [totalItems, selectedIndex])

  // 打开链接（如果含占位符参数则弹出输入框）
  const handleOpen = useCallback((link: QuickLink) => {
    const placeholders = parseUrlPlaceholders(link.url)
    if (placeholders.length > 0) {
      // 初始化参数值：使用定义的默认值
      const defaults: Record<string, string> = {}
      placeholders.forEach((name) => {
        const paramDef = link.params?.find((p) => p.name === name)
        defaults[name] = paramDef?.defaultValue || ''
      })
      setParamValues(defaults)
      setParamLink(link)
      return
    }
    let url = link.url
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    window.clipToolAPI.openExternal(url)
    // 跳转后关闭窗口
    window.clipToolAPI.hideWindow()
  }, [])

  // 确认参数并打开链接
  const handleConfirmParams = useCallback(() => {
    if (!paramLink) return
    let url = resolveUrl(paramLink.url, paramValues)
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    window.clipToolAPI.openExternal(url)
    setParamLink(null)
    setParamValues({})
    // 跳转后关闭窗口
    window.clipToolAPI.hideWindow()
  }, [paramLink, paramValues])

  // 判断输入是否为 URL
  const isUrl = useCallback((text: string) => {
    const trimmed = text.trim()
    // 匹配 http(s):// 开头、域名格式（如 example.com）、localhost、IP 地址等
    return /^https?:\/\//i.test(trimmed) ||
      /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+(\/.*)?$/.test(trimmed) ||
      /^localhost(:\d+)?(\/.*)?$/.test(trimmed) ||
      /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/.test(trimmed)
  }, [])

  // 直接在浏览器中打开 URL
  const handleOpenUrl = useCallback((text: string) => {
    let url = text.trim()
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    window.clipToolAPI.openExternal(url)
    // 跳转后关闭窗口
    window.clipToolAPI.hideWindow()
  }, [])

  // 浏览器搜索
  const handleBrowserSearch = useCallback((query: string) => {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
    window.clipToolAPI.openExternal(url)
    // 跳转后关闭窗口
    window.clipToolAPI.hideWindow()
  }, [])

  // AI 搜索（在当前页面内展示结果）
  const handleAiSearch = useCallback(async (query: string) => {
    setShowAiResult(true)
    setAiSearching(true)
    setAiResult('')
    setAiStreamContent('')

    try {
      const isAvailable = await window.clipToolAPI.isHunyuanAvailable()
      if (!isAvailable) {
        setAiResult('❌ AI 模型未配置，请先在设置中配置密钥')
        setAiSearching(false)
        return
      }
      await window.clipToolAPI.chatWithHunyuan([
        { Role: 'user', Content: query },
      ])
    } catch {
      setAiSearching(false)
    }
  }, [])

  // URL 变化时自动检测占位符并生成参数定义
  const syncParamsFromUrl = useCallback((url: string) => {
    const placeholders = parseUrlPlaceholders(url)
    setFormParams((prev) => {
      // 保留已有参数的标签和默认值，新增的用默认
      return placeholders.map((name) => {
        const existing = prev.find((p) => p.name === name)
        return existing || { name, label: name, defaultValue: '' }
      })
    })
  }, [])

  // URL 失焦时自动解析 favicon
  const handleUrlBlur = useCallback(() => {
    const url = formUrl.trim()
    if (url) {
      const faviconUrl = getFaviconUrl(url)
      setFormFavicon(faviconUrl)
      setFaviconPreviewFailed(false)
    }
    syncParamsFromUrl(url)
  }, [formUrl, syncParamsFromUrl])

  // 添加链接
  const handleAdd = useCallback(async () => {
    if (!formName.trim() || !formUrl.trim()) return
    const favicon = formFavicon || getFaviconUrl(formUrl.trim())
    const newLink: QuickLink = {
      id: nanoid(),
      name: formName.trim(),
      url: formUrl.trim(),
      icon: formIcon,
      favicon,
      category: formCategory,
      order: links.length,
      params: formParams.length > 0 ? formParams : undefined,
    }
    const updated = await window.clipToolAPI.addQuickLink(newLink)
    setLinks(updated)
    resetForm()
  }, [formName, formUrl, formIcon, formFavicon, formCategory, formParams, links.length])

  // 编辑链接
  const handleEdit = useCallback((link: QuickLink) => {
    setEditingId(link.id)
    setFormName(link.name)
    setFormUrl(link.url)
    setFormIcon(link.icon)
    setFormFavicon(link.favicon || '')
    setFaviconPreviewFailed(false)
    setFormCategory(link.category)
    setFormParams(link.params || [])
    setIsAdding(true)
  }, [])

  // 保存编辑
  const handleSaveEdit = useCallback(async () => {
    if (!editingId || !formName.trim() || !formUrl.trim()) return
    const favicon = formFavicon || getFaviconUrl(formUrl.trim())
    const updated = await window.clipToolAPI.updateQuickLink(editingId, {
      name: formName.trim(),
      url: formUrl.trim(),
      icon: formIcon,
      favicon,
      category: formCategory,
      params: formParams.length > 0 ? formParams : undefined,
    })
    setLinks(updated)
    resetForm()
  }, [editingId, formName, formUrl, formIcon, formFavicon, formCategory, formParams])

  // 删除链接
  const handleDelete = useCallback(async (id: string) => {
    const updated = await window.clipToolAPI.deleteQuickLink(id)
    setLinks(updated)
  }, [])

  // 重置表单
  const resetForm = () => {
    setIsAdding(false)
    setEditingId(null)
    setFormName('')
    setFormUrl('')
    setFormIcon('🌐')
    setFormFavicon('')
    setFaviconPreviewFailed(false)
    setFormCategory('常用')
    setFormParams([])
  }

  // 处理内置工具选中
  const handleToolOpen = useCallback((toolKey: string) => {
    setActiveTool(toolKey)
    // 重置 Base64 工具状态
    setBase64Input('')
    setBase64Encoded('')
    setBase64Decoded('')
    setBase64Error('')
    setBase64SelectedIndex(0)
    // 重置时间戳工具状态
    setTsInput('')
    setTsResult('')
    setTsSelectedIndex(0)
    // 重置图片Base64工具状态
    setImgBase64Result('')
    setImgPreviewSrc('')
    setImgBase64Input('')
    setImgBase64Mode('toBase64')
    // 自动聚焦到对应工具输入框
    setTimeout(() => {
      if (toolKey === 'base64') base64InputRef.current?.focus()
      else if (toolKey === 'timestamp') tsInputRef.current?.focus()
    }, 50)
  }, [])

  // 搜索框键盘事件
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    // 搜索无结果时的特殊键盘处理（链接+工具都没有匹配时）
    if (totalItems === 0 && searchQuery.trim() && !showAiResult && !activeTool) {
      const fallbackCount = isUrl(searchQuery) ? 3 : 2 // URL 时有 3 个选项，否则 2 个
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, fallbackCount - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (isUrl(searchQuery)) {
          // URL 模式：0=打开URL, 1=Google搜索, 2=AI搜索
          if (selectedIndex === 0) {
            handleOpenUrl(searchQuery.trim())
          } else if (selectedIndex === 1) {
            handleBrowserSearch(searchQuery.trim())
          } else {
            handleAiSearch(searchQuery.trim())
          }
        } else {
          // 非 URL 模式：0=Google搜索, 1=AI搜索
          if (selectedIndex === 0) {
            handleBrowserSearch(searchQuery.trim())
          } else {
            handleAiSearch(searchQuery.trim())
          }
        }
      }
      return
    }
    // 如果已经展示 AI 结果
    if (showAiResult) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setShowAiResult(false)
        setAiResult('')
        setAiStreamContent('')
        setAiSearching(false)
      } else if (e.key === 'Enter' && searchQuery.trim() && !aiSearching) {
        // 允许多次回车重新搜索
        e.preventDefault()
        handleAiSearch(searchQuery.trim())
      }
      return
    }
    // 如果处于内置工具模式，支持键盘导航
    if (activeTool) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setActiveTool(null)
      } else if (activeTool === 'base64') {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setBase64SelectedIndex((prev) => Math.min(prev + 1, 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setBase64SelectedIndex((prev) => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          const textToCopy = base64SelectedIndex === 0 ? base64Encoded : base64Decoded
          if (textToCopy && textToCopy !== '编码失败' && !textToCopy.startsWith('（') && textToCopy !== '等待输入...') {
            copyWithToast(textToCopy)
          }
        }
      } else if (activeTool === 'timestamp') {
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setTsSelectedIndex((prev) => Math.min(prev + 1, 1))
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          setTsSelectedIndex((prev) => Math.max(prev - 1, 0))
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          if (tsSelectedIndex === 0 && tsResult) {
            copyWithToast(tsResult.replace(/📅 |⏱️ |❌ /g, ''))
          } else if (tsSelectedIndex === 1 && tsNow) {
            copyWithToast(tsNow.split('  |  ')[0])
          }
        }
      } else if (activeTool === 'imageBase64') {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          if (imgBase64Mode === 'toBase64' && imgBase64Result) {
            copyWithToast(imgBase64Result)
          }
        }
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // 判断选中的是链接还是内置工具
      if (selectedIndex < filteredLinks.length) {
        if (filteredLinks[selectedIndex]) {
          handleOpen(filteredLinks[selectedIndex])
        }
      } else {
        const toolIdx = selectedIndex - filteredLinks.length
        if (matchedTools[toolIdx]) {
          handleToolOpen(matchedTools[toolIdx].toolKey)
        }
      }
    }
  }

  // 按分类分组
  const groupedLinks: { category: string; links: QuickLink[] }[] = []
  const categoryMap = new Map<string, QuickLink[]>()
  filteredLinks.forEach((link) => {
    if (!categoryMap.has(link.category)) {
      categoryMap.set(link.category, [])
    }
    categoryMap.get(link.category)!.push(link)
  })
  categoryMap.forEach((catLinks, category) => {
    groupedLinks.push({ category, links: catLinks })
  })

  // 计算全局索引
  let globalIndex = 0

  return (
    <div className="launcher-panel">
      {/* 搜索栏 - RayCast 风格 */}
      <div className="launcher-search-bar">
        <span className="launcher-search-icon">🚀</span>
          <input
          ref={searchInputRef}
          className="launcher-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setSelectedIndex(0)
            // 清空搜索时关闭 AI 结果
            if (!e.target.value.trim()) {
              setShowAiResult(false)
              setAiResult('')
              setAiStreamContent('')
            }
          }}
          onKeyDown={handleSearchKeyDown}
          placeholder="搜索或输入 URL 快速打开..."
          autoFocus
        />
        <button
          className="launcher-add-trigger"
          onClick={() => {
            if (isAdding) {
              resetForm()
            } else {
              setActiveTool(null)
              setIsAdding(true)
            }
          }}
          title={isAdding ? '取消' : '添加链接'}
        >
          {isAdding ? '✕' : '+'}
        </button>
      </div>

      {/* 分类标签筛选栏 */}
      {!isAdding && !activeTool && !showAiResult && availableCategories.length > 2 && (
        <div className="launcher-category-filter">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              className={`launcher-category-filter-btn ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => {
                setActiveCategory(cat)
                setSelectedIndex(0)
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* 内置工具区域 - Base64 */}
      {activeTool === 'base64' && (
        <div className="launcher-base64-tool">
          <div className="launcher-base64-header">
            <span className="launcher-base64-title">🔧 Base64 编解码工具</span>
            <button
              className="launcher-base64-close-btn"
              onClick={() => setActiveTool(null)}
              title="关闭工具 (Esc)"
            >
              ✕
            </button>
          </div>
          <div className="launcher-base64-input-area">
            <textarea
              ref={base64InputRef}
              className="launcher-base64-textarea"
              value={base64Input}
              onChange={(e) => handleBase64InputChange(e.target.value)}
              onKeyDown={(e) => {
                // textarea 内 ↑↓ 切换结果选中（无内容时或在首/末行时）
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setBase64SelectedIndex((prev) => Math.min(prev + 1, 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setBase64SelectedIndex((prev) => Math.max(prev - 1, 0))
                } else if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                // ⌘Enter 复制当前选中结果
                  const textToCopy = base64SelectedIndex === 0 ? base64Encoded : base64Decoded
                  if (textToCopy && textToCopy !== '编码失败' && !textToCopy.startsWith('（') && textToCopy !== '等待输入...') {
                    copyWithToast(textToCopy)
                  }
                }
              }}
              placeholder="输入文本，↑↓ 切换结果，⌘Enter 复制选中结果..."
              autoFocus
            />
          </div>
          <div className="launcher-base64-results">
            <div className={`launcher-base64-result-block ${base64SelectedIndex === 0 ? 'selected' : ''}`}
              onClick={() => setBase64SelectedIndex(0)}
            >
              <div className="launcher-base64-result-label">
                <span>📤 Encode 结果 {base64SelectedIndex === 0 ? '◀' : ''}</span>
                {base64Encoded && base64Encoded !== '编码失败' && (
                  <button
                    className="launcher-base64-copy-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      copyWithToast(base64Encoded)
                    }}
                  >
                    {base64SelectedIndex === 0 ? '⌘↵ 复制' : '复制'}
                  </button>
                )}
              </div>
              <pre className="launcher-base64-result-text">{base64Encoded || '等待输入...'}</pre>
            </div>
            <div className={`launcher-base64-result-block ${base64SelectedIndex === 1 ? 'selected' : ''}`}
              onClick={() => setBase64SelectedIndex(1)}
            >
              <div className="launcher-base64-result-label">
                <span>📥 Decode 结果 {base64SelectedIndex === 1 ? '◀' : ''}</span>
                {base64Decoded && !base64Decoded.startsWith('（') && (
                  <button
                    className="launcher-base64-copy-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      copyWithToast(base64Decoded)
                    }}
                  >
                    {base64SelectedIndex === 1 ? '⌘↵ 复制' : '复制'}
                  </button>
                )}
              </div>
              <pre className="launcher-base64-result-text">{base64Decoded || '等待输入...'}</pre>
            </div>
          </div>
          {base64Error && <div className="launcher-base64-error">{base64Error}</div>}
        </div>
      )}

      {/* 内置工具区域 - 时间戳转换 */}
      {activeTool === 'timestamp' && (
        <div className="launcher-base64-tool">
          <div className="launcher-base64-header">
            <span className="launcher-base64-title">🕐 时间戳转换工具</span>
            <button
              className="launcher-base64-close-btn"
              onClick={() => setActiveTool(null)}
              title="关闭工具 (Esc)"
            >
              ✕
            </button>
          </div>
          <div className="launcher-ts-now-bar">
            <span className="launcher-ts-now-label">⏱️ 当前时间</span>
            <span className="launcher-ts-now-value">{tsNow}</span>
            <button
              className="launcher-base64-copy-btn"
              onClick={() => tsNow && copyWithToast(tsNow.split('  |  ')[0])}
            >
              复制
            </button>
          </div>
          <div className="launcher-base64-input-area">
            <input
              ref={tsInputRef}
              className="launcher-ts-input"
              type="text"
              value={tsInput}
              onChange={(e) => handleTsInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setTsSelectedIndex((prev) => Math.min(prev + 1, 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setTsSelectedIndex((prev) => Math.max(prev - 1, 0))
                } else if (e.key === 'Enter' && !e.shiftKey && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  if (tsSelectedIndex === 0 && tsResult) {
                    copyWithToast(tsResult.replace(/📅 |⏱️ |❌ /g, ''))
                  } else if (tsSelectedIndex === 1 && tsNow) {
                    copyWithToast(tsNow.split('  |  ')[0])
                  }
                }
              }}
              placeholder="输入时间戳（秒/毫秒）或日期字符串（如 2024-01-01 12:00:00）"
              autoFocus
            />
          </div>
          <div className="launcher-base64-results">
            <div className={`launcher-base64-result-block ${tsSelectedIndex === 0 ? 'selected' : ''}`}
              onClick={() => setTsSelectedIndex(0)}
            >
              <div className="launcher-base64-result-label">
                <span>📅 转换结果 {tsSelectedIndex === 0 ? '◀' : ''}</span>
                {tsResult && !tsResult.startsWith('❌') && (
                  <button
                    className="launcher-base64-copy-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      copyWithToast(tsResult.replace(/📅 |⏱️ |❌ /g, ''))
                    }}
                  >
                    {tsSelectedIndex === 0 ? '⌘↵ 复制' : '复制'}
                  </button>
                )}
              </div>
              <pre className="launcher-base64-result-text">{tsResult || '等待输入...'}</pre>
            </div>
            <div className={`launcher-base64-result-block ${tsSelectedIndex === 1 ? 'selected' : ''}`}
              onClick={() => setTsSelectedIndex(1)}
            >
              <div className="launcher-base64-result-label">
                <span>⏱️ 当前时间戳 {tsSelectedIndex === 1 ? '◀' : ''}</span>
                <button
                  className="launcher-base64-copy-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    tsNow && copyWithToast(tsNow.split('  |  ')[0])
                  }}
                >
                  {tsSelectedIndex === 1 ? '⌘↵ 复制' : '复制'}
                </button>
              </div>
              <pre className="launcher-base64-result-text">{tsNow || '加载中...'}</pre>
            </div>
          </div>
        </div>
      )}

      {/* 内置工具区域 - 图片 Base64 转换 */}
      {activeTool === 'imageBase64' && (
        <div className="launcher-base64-tool">
          <div className="launcher-base64-header">
            <span className="launcher-base64-title">🖼️ 图片 Base64 转换</span>
            <button
              className="launcher-base64-close-btn"
              onClick={() => setActiveTool(null)}
              title="关闭工具 (Esc)"
            >
              ✕
            </button>
          </div>
          {/* 模式切换 */}
          <div className="launcher-img-mode-tabs">
            <button
              className={`launcher-img-mode-tab ${imgBase64Mode === 'toBase64' ? 'active' : ''}`}
              onClick={() => {
                setImgBase64Mode('toBase64')
                setImgPreviewSrc('')
                setImgBase64Result('')
                setImgBase64Input('')
              }}
            >
              📤 图片 → Base64
            </button>
            <button
              className={`launcher-img-mode-tab ${imgBase64Mode === 'toImage' ? 'active' : ''}`}
              onClick={() => {
                setImgBase64Mode('toImage')
                setImgPreviewSrc('')
                setImgBase64Result('')
                setImgBase64Input('')
              }}
            >
              📥 Base64 → 图片
            </button>
          </div>

          {imgBase64Mode === 'toBase64' ? (
            <div className="launcher-img-to-base64">
              <input
                ref={imgFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageFileSelect}
              />
              <div
                className="launcher-img-drop-zone"
                onClick={() => imgFileInputRef.current?.click()}
              >
                {imgPreviewSrc ? (
                  <img src={imgPreviewSrc} alt="预览" className="launcher-img-preview" />
                ) : (
                  <div className="launcher-img-drop-hint">
                    <span className="launcher-img-drop-icon">📁</span>
                    <span>点击选择图片文件</span>
                    <span className="launcher-img-drop-sub">支持 PNG、JPG、GIF、SVG 等格式</span>
                  </div>
                )}
              </div>
              {imgBase64Result && (
                <div className="launcher-base64-results">
                  <div className="launcher-base64-result-block selected">
                    <div className="launcher-base64-result-label">
                      <span>📤 Base64 结果（{(imgBase64Result.length / 1024).toFixed(1)} KB）</span>
                      <button
                        className="launcher-base64-copy-btn"
                        onClick={() => copyWithToast(imgBase64Result)}
                      >
                        复制
                      </button>
                    </div>
                    <pre className="launcher-base64-result-text launcher-img-base64-text">{imgBase64Result.substring(0, 200)}...</pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="launcher-base64-to-img">
              <div className="launcher-base64-input-area">
                <textarea
                  className="launcher-base64-textarea"
                  value={imgBase64Input}
                  onChange={(e) => handleImgBase64InputChange(e.target.value)}
                  placeholder="粘贴 Base64 字符串（支持带 data:image/... 前缀或纯 Base64）"
                  autoFocus
                />
              </div>
              {imgPreviewSrc && (
                <div className="launcher-img-preview-area">
                  <div className="launcher-base64-result-label">
                    <span>🖼️ 图片预览</span>
                  </div>
                  <div className="launcher-img-preview-box">
                    <img
                      src={imgPreviewSrc}
                      alt="预览"
                      className="launcher-img-preview"
                      onError={() => setImgPreviewSrc('')}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 添加/编辑表单 */}
      {isAdding && (
        <div className="launcher-form">
          <div className="launcher-form-row">
            <div className="launcher-form-icon-picker">
              {ICON_OPTIONS.map((icon) => (
                <button
                  key={icon}
                  className={`launcher-icon-option ${formIcon === icon ? 'active' : ''}`}
                  onClick={() => setFormIcon(icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <div className="launcher-form-row">
            <input
              className="text-input launcher-form-input"
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="名称（如：GitHub）"
            />
            <div className="launcher-url-input-wrapper">
              {formFavicon && !faviconPreviewFailed && (
                <img
                  src={formFavicon}
                  alt=""
                  className="launcher-url-favicon-preview"
                  onError={() => setFaviconPreviewFailed(true)}
                  draggable={false}
                />
              )}
              <input
                className={`text-input launcher-form-input ${formFavicon && !faviconPreviewFailed ? 'has-favicon' : ''}`}
                type="text"
                value={formUrl}
                onChange={(e) => {
                  setFormUrl(e.target.value)
                  setFormFavicon('')
                  setFaviconPreviewFailed(false)
                }}
                onBlur={handleUrlBlur}
                placeholder="URL（如：github.com/{user}/{repo}）"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    editingId ? handleSaveEdit() : handleAdd()
                  }
                }}
              />
            </div>
          </div>

          {/* URL 占位符参数提示与配置 */}
          {formParams.length > 0 && (
            <div className="launcher-form-params">
              <div className="launcher-form-params-title">🔗 URL 参数配置（检测到 {formParams.length} 个占位符）</div>
              {formParams.map((param, i) => (
                <div key={param.name} className="launcher-form-param-row">
                  <span className="launcher-form-param-name">{`{${param.name}}`}</span>
                  <input
                    className="text-input launcher-form-param-input"
                    type="text"
                    value={param.label}
                    onChange={(e) => {
                      setFormParams((prev) => {
                        const next = [...prev]
                        next[i] = { ...next[i], label: e.target.value }
                        return next
                      })
                    }}
                    placeholder="参数标签"
                  />
                  <input
                    className="text-input launcher-form-param-input"
                    type="text"
                    value={param.defaultValue}
                    onChange={(e) => {
                      setFormParams((prev) => {
                        const next = [...prev]
                        next[i] = { ...next[i], defaultValue: e.target.value }
                        return next
                      })
                    }}
                    placeholder="默认值（可选）"
                  />
                </div>
              ))}
            </div>
          )}
          <div className="launcher-form-row">
            <div className="launcher-category-picker">
              {categoryOptions.map((cat) => (
                <button
                  key={cat}
                  className={`launcher-category-option ${formCategory === cat ? 'active' : ''}`}
                  onClick={() => setFormCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            <button
              className="launcher-form-submit"
              onClick={editingId ? handleSaveEdit : handleAdd}
              disabled={!formName.trim() || !formUrl.trim()}
            >
              {editingId ? '保存' : '添加'}
            </button>
          </div>
        </div>
      )}

      {/* AI 内联搜索结果展示 */}
      {showAiResult && (
        <div className="launcher-ai-result" ref={aiResultRef}>
          <div className="launcher-ai-result-header">
            <span className="launcher-ai-result-title">🤖 AI 搜索结果</span>
            <button
              className="launcher-ai-result-close"
              onClick={() => {
                setShowAiResult(false)
                setAiResult('')
                setAiStreamContent('')
                setAiSearching(false)
              }}
            >
              ✕
            </button>
          </div>
          <div className="launcher-ai-result-content">
            {aiSearching && !aiStreamContent && (
              <div className="launcher-ai-result-loading">
                <span>✨</span> AI 正在思考中...
              </div>
            )}
            {aiStreamContent && (
              <pre className="launcher-ai-result-text">{aiStreamContent}<span className="ai-chat-cursor">▍</span></pre>
            )}
            {aiResult && !aiStreamContent && (
              <pre className="launcher-ai-result-text">{aiResult}</pre>
            )}
          </div>
        </div>
      )}

      {/* 链接列表 */}
      {!showAiResult && !activeTool && (
      <div className="launcher-list">
        {totalItems === 0 ? (
          <div className="launcher-empty">
            {links.length === 0 && !searchQuery.trim() ? (
              <>
                <span className="launcher-empty-icon">🚀</span>
                <span>点击右上角 <strong>+</strong> 添加你的第一个快速链接</span>
              </>
            ) : searchQuery.trim() && matchedTools.length === 0 ? (
              <>
                <span className="launcher-empty-icon">🔍</span>
                <span>未找到匹配的链接，你可以：</span>
                <div className="launcher-fallback-actions">
                  {isUrl(searchQuery) && (
                    <button
                      className={`launcher-fallback-btn ${selectedIndex === 0 ? 'selected' : ''}`}
                      onClick={() => handleOpenUrl(searchQuery.trim())}
                      onMouseEnter={() => setSelectedIndex(0)}
                    >
                      <span className="launcher-fallback-icon">🔗</span>
                      <div className="launcher-fallback-info">
                        <span className="launcher-fallback-title">打开 URL</span>
                        <span className="launcher-fallback-desc">在浏览器中打开「{searchQuery.trim()}」</span>
                      </div>
                      {selectedIndex === 0 && <span className="launcher-fallback-hint">↵</span>}
                    </button>
                  )}
                  <button
                    className={`launcher-fallback-btn ${selectedIndex === (isUrl(searchQuery) ? 1 : 0) ? 'selected' : ''}`}
                    onClick={() => handleBrowserSearch(searchQuery.trim())}
                    onMouseEnter={() => setSelectedIndex(isUrl(searchQuery) ? 1 : 0)}
                  >
                    <span className="launcher-fallback-icon">🌐</span>
                    <div className="launcher-fallback-info">
                      <span className="launcher-fallback-title">Google 搜索</span>
                      <span className="launcher-fallback-desc">在浏览器中搜索「{searchQuery.trim()}」</span>
                    </div>
                    {selectedIndex === (isUrl(searchQuery) ? 1 : 0) && <span className="launcher-fallback-hint">↵</span>}
                  </button>
                  <button
                    className={`launcher-fallback-btn ${selectedIndex === (isUrl(searchQuery) ? 2 : 1) ? 'selected' : ''}`}
                    onClick={() => handleAiSearch(searchQuery.trim())}
                    onMouseEnter={() => setSelectedIndex(isUrl(searchQuery) ? 2 : 1)}
                  >
                    <span className="launcher-fallback-icon">🤖</span>
                    <div className="launcher-fallback-info">
                      <span className="launcher-fallback-title">AI 搜索</span>
                      <span className="launcher-fallback-desc">在当前页面使用 AI 搜索「{searchQuery.trim()}」</span>
                    </div>
                    {selectedIndex === (isUrl(searchQuery) ? 2 : 1) && <span className="launcher-fallback-hint">↵</span>}
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="launcher-empty-icon">🔍</span>
                <span>未找到匹配的链接</span>
              </>
            )}
          </div>
        ) : (
          groupedLinks.map(({ category, links: catLinks }) => (
            <div key={category} className="launcher-group">
              <div className="launcher-group-title">{category}</div>
              {catLinks.map((link) => {
                const idx = globalIndex++
                return (
                  <div
                    key={link.id}
                    className={`launcher-item ${idx === selectedIndex ? 'selected' : ''}`}
                    onClick={() => handleOpen(link)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <span className="launcher-item-icon">
                      <FaviconIcon favicon={link.favicon} emoji={link.icon} />
                    </span>
                    <div className="launcher-item-info">
                    <span className="launcher-item-name">
                      {link.name}
                      <span
                        className="launcher-item-category-tag"
                        style={{
                          background: getTagColor(link.category).bg,
                          color: getTagColor(link.category).text,
                        }}
                      >
                        {link.category}
                      </span>
                      {link.params && link.params.length > 0 && (
                        <span className="launcher-item-param-badge">参数×{link.params.length}</span>
                      )}
                    </span>
                      <span className="launcher-item-url">
                        {link.url}
                      </span>
                    </div>
                    <div className="launcher-item-actions">
                      <button
                        className="launcher-item-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(link)
                        }}
                        title="编辑"
                      >
                        ✏️
                      </button>
                      <button
                        className="launcher-item-btn danger"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(link.id)
                        }}
                        title="删除"
                      >
                        🗑️
                      </button>
                    </div>
                    {idx < 9 && (
                      <span className="launcher-item-hint">⌘{idx + 1}</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))
        )}

        {/* 内置工具条目（在链接列表后面显示） */}
        {matchedTools.length > 0 && (
          <div className="launcher-group">
            <div className="launcher-group-title">内置工具</div>
            {matchedTools.map((tool, i) => {
              const idx = filteredLinks.length + i
              return (
                <div
                  key={tool.id}
                  className={`launcher-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleToolOpen(tool.toolKey)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <span className="launcher-item-icon">
                    <span>{tool.icon}</span>
                  </span>
                  <div className="launcher-item-info">
                    <span className="launcher-item-name">
                      {tool.name}
                      <span
                        className="launcher-item-category-tag"
                        style={{
                          background: getTagColor(tool.category).bg,
                          color: getTagColor(tool.category).text,
                        }}
                      >
                        {tool.category}
                      </span>
                    </span>
                    <span className="launcher-item-url">{tool.description}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      )}

      {/* 底部提示 */}
      <div className="launcher-footer">
        {activeTool === 'base64' ? (
          <>
            <span>↑↓ 切换结果</span>
            <span>⌘↵ 复制</span>
            <span>Esc 退出</span>
          </>
        ) : activeTool === 'timestamp' ? (
          <>
            <span>↑↓ 切换结果</span>
            <span>⌘↵ 复制</span>
            <span>Esc 退出</span>
          </>
        ) : activeTool === 'imageBase64' ? (
          <>
            <span>↵ 复制结果</span>
            <span>Esc 退出</span>
          </>
        ) : (
          <>
            <span>↑↓ 选择</span>
            <span>↵ 打开</span>
            <span>⌘1-9 快速打开</span>
          </>
        )}
      </div>

      {/* 复制提示 Toast */}
      {copyToast && (
        <div className="launcher-copy-toast">{copyToast}</div>
      )}

      {/* 参数输入弹窗 */}
      {paramLink && (
        <div className="launcher-param-overlay">
          <div className="launcher-param-dialog">
            <div className="launcher-param-header">
              <span className="launcher-param-title">
                <FaviconIcon favicon={paramLink.favicon} emoji={paramLink.icon} />
                {' '}{paramLink.name}
              </span>
              <button className="launcher-param-close" onClick={() => { setParamLink(null); setParamValues({}) }}>✕</button>
            </div>
            <div className="launcher-param-url-preview">{paramLink.url}</div>
            <div className="launcher-param-fields">
              {parseUrlPlaceholders(paramLink.url).map((name) => {
                const paramDef = paramLink.params?.find((p) => p.name === name)
                return (
                  <div key={name} className="launcher-param-field">
                    <label className="launcher-param-label">{paramDef?.label || name}</label>
                    <input
                      className="text-input launcher-param-input"
                      type="text"
                      value={paramValues[name] || ''}
                      onChange={(e) => setParamValues((prev) => ({ ...prev, [name]: e.target.value }))}
                      placeholder={paramDef?.defaultValue ? `默认: ${paramDef.defaultValue}` : `请输入 ${paramDef?.label || name}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleConfirmParams()
                        } else if (e.key === 'Escape') {
                          setParamLink(null)
                          setParamValues({})
                        }
                      }}
                      autoFocus={parseUrlPlaceholders(paramLink.url).indexOf(name) === 0}
                    />
                  </div>
                )
              })}
            </div>
            <div className="launcher-param-actions">
              <button className="launcher-param-cancel" onClick={() => { setParamLink(null); setParamValues({}) }}>取消</button>
              <button className="launcher-param-confirm" onClick={handleConfirmParams}>打开 ↵</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

LauncherPanel.displayName = 'LauncherPanel'

export default LauncherPanel
