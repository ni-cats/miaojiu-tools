/**
 * AI 整理面板组件
 * 顶部：AI 对话窗口，支持腾讯混元大模型调用
 * 下方：预留的 AI 智能管理功能卡片
 */
import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { IconBot, IconUser, IconSearch, IconClipboard, IconTag } from './TabIcons'
import { FileText, Lightbulb, Target, MessageSquare, Trash2, Send, Loader } from 'lucide-react'

/** 对话消息 */
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** AI 方案卡片数据 */
interface AiSolution {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  status: 'coming' | 'beta' | 'active'
}

/** 预留的 AI 方案列表 */
const AI_SOLUTIONS: AiSolution[] = [
  {
    id: 'smart-classify',
    icon: <IconTag size={16} color="#FF9800" />,
    title: '智能分类',
    description: 'AI 自动识别剪贴板内容类型，智能归类到对应标签，减少手动整理工作',
    status: 'coming',
  },
  {
    id: 'content-summary',
    icon: <FileText size={16} />,
    title: '内容摘要',
    description: 'AI 自动提取长文本关键信息，生成简洁摘要，方便快速回顾和检索',
    status: 'coming',
  },
  {
    id: 'code-explain',
    icon: <Lightbulb size={16} />,
    title: '代码解读',
    description: 'AI 分析复制的代码片段，自动添加注释说明，理解代码逻辑和功能',
    status: 'coming',
  },
  {
    id: 'duplicate-detect',
    icon: <IconSearch size={16} />,
    title: '重复检测',
    description: 'AI 智能识别语义相似的片段，合并重复内容，保持片段库整洁',
    status: 'coming',
  },
  {
    id: 'smart-template',
    icon: <IconClipboard size={16} />,
    title: '模板生成',
    description: '根据历史使用习惯，AI 自动生成常用文本模板，一键复用高频内容',
    status: 'coming',
  },
  {
    id: 'context-recommend',
    icon: <Target size={16} />,
    title: '上下文推荐',
    description: '根据当前工作上下文，AI 智能推荐可能需要的历史片段，提升效率',
    status: 'coming',
  },
]

const statusLabels: Record<AiSolution['status'], { text: string; className: string }> = {
  coming: { text: '即将推出', className: 'ai-status-coming' },
  beta: { text: '测试中', className: 'ai-status-beta' },
  active: { text: '已上线', className: 'ai-status-active' },
}

/** 网格列数 */
const GRID_COLS = 5

/** AiPanel 暴露给外部的方法 */
export interface AiPanelRef {
  /** 方向键导航卡片，返回 true 表示导航后仍处于聚焦状态 */
  navigateCard: (direction: 'up' | 'down' | 'left' | 'right') => boolean
  /** 进入卡片聚焦模式 */
  focusCards: () => void
  /** 退出卡片聚焦模式 */
  blurCards: () => void
}

const AiPanel = forwardRef<AiPanelRef>((_, ref) => {
  // ===== 对话窗口状态 =====
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [isAvailable, setIsAvailable] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ===== 卡片导航状态 =====
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const focusedIndexRef = useRef(-1)

  const updateFocusedIndex = (value: number) => {
    focusedIndexRef.current = value
    setFocusedIndex(value)
  }

  // 检测混元是否可用
  useEffect(() => {
    window.clipToolAPI.isHunyuanAvailable().then(setIsAvailable)
  }, [])

  // 监听流式响应
  useEffect(() => {
    const unsubscribe = window.clipToolAPI.onHunyuanStream((data) => {
      if (data.type === 'delta') {
        setStreamingContent(data.fullContent || '')
      } else if (data.type === 'done') {
        // 流式结束，将完整内容添加到消息列表
        setMessages((prev) => [...prev, { role: 'assistant', content: data.content }])
        setStreamingContent('')
        setIsLoading(false)
      } else if (data.type === 'error') {
        setMessages((prev) => [...prev, { role: 'assistant', content: `❌ 错误：${data.content}` }])
        setStreamingContent('')
        setIsLoading(false)
      }
    })
    return unsubscribe
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  // 发送消息
  const handleSend = async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    const userMsg: ChatMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setIsLoading(true)
    setStreamingContent('')

    // 构建完整的消息列表（包含历史上下文）
    const apiMessages = [...messages, userMsg].map((m) => ({
      Role: m.role,
      Content: m.content,
    }))

    try {
      await window.clipToolAPI.chatWithHunyuan(apiMessages)
    } catch (error) {
      // 错误已经通过流式回调处理
      setIsLoading(false)
    }
  }

  // 按键处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      handleSend()
    }
  }

  // 清除对话
  const handleClear = () => {
    setMessages([])
    setStreamingContent('')
    setIsLoading(false)
  }

  useImperativeHandle(ref, () => ({
    navigateCard: (direction: 'up' | 'down' | 'left' | 'right') => {
      const prev = focusedIndexRef.current
      const total = AI_SOLUTIONS.length
      if (prev < 0) {
        updateFocusedIndex(0)
        return true
      }
      const row = Math.floor(prev / GRID_COLS)
      const col = prev % GRID_COLS
      const totalRows = Math.ceil(total / GRID_COLS)
      let next = prev

      switch (direction) {
        case 'up': {
          if (row <= 0) {
            updateFocusedIndex(-1)
            return false
          }
          next = (row - 1) * GRID_COLS + col
          break
        }
        case 'down': {
          if (row >= totalRows - 1) break
          const downIndex = (row + 1) * GRID_COLS + col
          if (downIndex < total) next = downIndex
          break
        }
        case 'left': {
          if (prev > 0) next = prev - 1
          break
        }
        case 'right': {
          if (prev < total - 1) next = prev + 1
          break
        }
      }

      updateFocusedIndex(next)
      return true
    },
    focusCards: () => {
      updateFocusedIndex(0)
    },
    blurCards: () => {
      updateFocusedIndex(-1)
    },
  }))

  return (
    <div className="ai-panel">
      {/* AI 对话窗口 */}
      <div className="ai-chat-container">
        <div className="ai-chat-header">
          <div className="ai-chat-header-left">
            <span className="ai-chat-header-icon"><IconBot size={16} /></span>
            <span className="ai-chat-header-title">混元对话</span>
            {!isAvailable && (
              <span className="ai-chat-status-badge ai-status-coming">未配置</span>
            )}
          </div>
          {messages.length > 0 && (
            <button className="ai-chat-clear-btn" onClick={handleClear} title="清除对话">
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* 消息列表 */}
        <div className="ai-chat-messages">
          {messages.length === 0 && !streamingContent && (
            <div className="ai-chat-empty">
              <div className="ai-chat-empty-icon"><MessageSquare size={28} /></div>
              <div className="ai-chat-empty-text">
                {isAvailable ? '向混元 AI 提问任何问题' : '请在 config.yaml 中配置混元大模型密钥'}
              </div>
            </div>
          )}
          {messages.map((msg, index) => (
            <div key={index} className={`ai-chat-message ai-chat-message-${msg.role}`}>
              <div className="ai-chat-message-avatar">
                {msg.role === 'user' ? <IconUser size={14} /> : <IconBot size={14} />}
              </div>
              <div className="ai-chat-message-content">
                <pre className="ai-chat-message-text">{msg.content}</pre>
              </div>
            </div>
          ))}
          {/* 流式响应中 */}
          {streamingContent && (
            <div className="ai-chat-message ai-chat-message-assistant">
              <div className="ai-chat-message-avatar"><IconBot size={14} /></div>
              <div className="ai-chat-message-content">
                <pre className="ai-chat-message-text">{streamingContent}<span className="ai-chat-cursor">▍</span></pre>
              </div>
            </div>
          )}
          {/* 加载指示器 */}
          {isLoading && !streamingContent && (
            <div className="ai-chat-message ai-chat-message-assistant">
              <div className="ai-chat-message-avatar"><IconBot size={14} /></div>
              <div className="ai-chat-message-content">
                <div className="ai-chat-typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="ai-chat-input-container">
          <textarea
            ref={inputRef}
            className="ai-chat-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isAvailable ? '输入消息... (Enter 发送, Shift+Enter 换行)' : '混元未配置，请先设置密钥'}
            disabled={!isAvailable || isLoading}
            rows={1}
          />
          <button
            className={`ai-chat-send-btn ${(!inputValue.trim() || isLoading || !isAvailable) ? 'disabled' : ''}`}
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading || !isAvailable}
          >
            {isLoading ? <Loader size={14} className="ai-send-loading" /> : <Send size={14} />}
          </button>
        </div>
      </div>

      {/* 方案卡片网格 */}
      <div className="ai-solutions-grid">
        {AI_SOLUTIONS.map((solution, index) => {
          const status = statusLabels[solution.status]
          return (
            <div
              key={solution.id}
              className={`ai-solution-card ${focusedIndex === index ? 'focused' : ''}`}
              onClick={() => setFocusedIndex(index)}
            >
              <div className="ai-solution-header">
                <span className="ai-solution-icon">{solution.icon}</span>
                <span className={`ai-solution-status ${status.className}`}>{status.text}</span>
              </div>
              <div className="ai-solution-title">{solution.title}</div>
              <div className="ai-solution-desc">{solution.description}</div>
            </div>
          )
        })}
      </div>

      {/* 底部提示 */}
      <div className="ai-footer">
        <span className="ai-footer-text"><MessageSquare size={12} style={{ verticalAlign: -2, marginRight: 4 }} />有想法或建议？欢迎反馈，帮助我们优先开发你最需要的功能</span>
      </div>
    </div>
  )
})

export default AiPanel
