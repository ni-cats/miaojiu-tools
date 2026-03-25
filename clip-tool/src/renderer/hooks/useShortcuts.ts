/**
 * 窗口内快捷键 Hook
 * 极简交互：Enter 保存并关闭、⌘C 复制选中项、Escape 关闭
 *           ←→ 切换 Tab、双击空格关闭窗口
 */
import { useEffect, useRef } from 'react'

interface ShortcutHandlers {
  onEnterSave?: () => void          // Enter 直接保存并关闭
  onCopySelected?: () => void       // Command+C 复制选中项
  onEscape?: () => boolean | void   // Escape 隐藏窗口，返回 true 表示已被子组件消费
  onArrowUp?: () => void            // ↑ 选上一条
  onArrowDown?: () => void          // ↓ 选下一条
  onQuickCopy?: (index: number) => void  // Command+1~9 快速复制
  onSwitchTab?: (direction: 'left' | 'right') => void  // ←→ 切换 Tab
  onClose?: () => void              // 双击空格关闭窗口
  activeTab?: string                // 当前激活的 Tab
  onSettingsNavFocus?: () => void   // ↓ 进入设置子导航
  onSettingsNavBlur?: () => void    // ↑ 退出设置子导航
  onSettingsNavSwitch?: (direction: 'left' | 'right') => void  // ←→ 切换设置子标签页
  settingsNavFocused?: boolean      // 设置子导航是否处于聚焦状态
  onAiCardNavigate?: (direction: 'up' | 'down' | 'left' | 'right') => void  // AI 卡片导航
  onAiCardFocus?: () => void        // ↓ 进入 AI 卡片聚焦
  onAiCardBlur?: () => void         // ↑ 退出 AI 卡片聚焦
  aiCardFocused?: boolean           // AI 卡片是否处于聚焦状态
}

export function useShortcuts(handlers: ShortcutHandlers) {
  // 记录上次按空格的时间，用于检测双击空格
  const lastSpaceTimeRef = useRef<number>(0)
  // 用 ref 保存最新的 handlers，彻底避免闭包陷阱
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const h = handlersRef.current
      const isMeta = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      // Escape：先让子组件处理，未被消费则隐藏窗口
      if (e.key === 'Escape') {
        e.preventDefault()
        const consumed = h.onEscape?.()
        if (!consumed) {
          h.onClose?.()
        }
        return
      }

      // 双击空格：关闭窗口（非输入框聚焦时）
      if (e.key === ' ' && !isInputFocused && !isMeta) {
        e.preventDefault()
        const now = Date.now()
        if (now - lastSpaceTimeRef.current < 400) {
          // 双击空格，关闭窗口
          lastSpaceTimeRef.current = 0
          h.onClose?.()
          return
        }
        lastSpaceTimeRef.current = now
        return
      }

      // Enter：在保存 Tab 下直接保存并关闭（输入框中不拦截）
      if (e.key === 'Enter' && !isMeta && h.activeTab === 'save') {
        // 如果焦点在输入框（标题/标签），也允许 Enter 保存
        e.preventDefault()
        h.onEnterSave?.()
        return
      }

      // Enter：在搜索 Tab 下复制选中项
      if (e.key === 'Enter' && !isMeta && h.activeTab === 'search') {
        e.preventDefault()
        h.onCopySelected?.()
        return
      }

      // Command+C：在搜索 Tab 下复制选中项（非输入框内）
      if (isMeta && e.key === 'c' && h.activeTab === 'search' && !isInputFocused) {
        e.preventDefault()
        h.onCopySelected?.()
        return
      }

      // ← / →：子导航聚焦时切换子标签页/卡片，否则切换顶部 Tab
      if (e.key === 'ArrowLeft') {
        const canSwitch = !isInputFocused || (isInputFocused && (target as HTMLInputElement).value === '')
        if (canSwitch) {
          e.preventDefault()
          if (h.activeTab === 'settings' && h.settingsNavFocused) {
            h.onSettingsNavSwitch?.('left')
          } else if (h.activeTab === 'ai' && h.aiCardFocused) {
            h.onAiCardNavigate?.('left')
          } else {
            h.onSwitchTab?.('left')
          }
          return
        }
      }
      if (e.key === 'ArrowRight') {
        const canSwitch = !isInputFocused || (isInputFocused && (target as HTMLInputElement).value === '')
        if (canSwitch) {
          e.preventDefault()
          if (h.activeTab === 'settings' && h.settingsNavFocused) {
            h.onSettingsNavSwitch?.('right')
          } else if (h.activeTab === 'ai' && h.aiCardFocused) {
            h.onAiCardNavigate?.('right')
          } else {
            h.onSwitchTab?.('right')
          }
          return
        }
      }

      // ↑ / ↓：设置/AI Tab 下控制子导航聚焦，搜索 Tab 下切换选中项
      // 注意：launcher Tab 的 ↑↓ 由 LauncherPanel 内部搜索框的 onKeyDown 处理
      // 编辑 Tab 的 ↑↓ 由 EditorPanel 内部 textarea 的 onKeyDown 处理
      // 收藏 Tab 的 ↑↓ 由 FavoritePanel 内部事件处理
      if (e.key === 'ArrowDown') {
        if (h.activeTab === 'settings' && !isInputFocused) {
          e.preventDefault()
          h.onSettingsNavFocus?.()
          return
        }
        if (h.activeTab === 'ai' && !isInputFocused) {
          e.preventDefault()
          if (h.aiCardFocused) {
            h.onAiCardNavigate?.('down')
          } else {
            h.onAiCardFocus?.()
          }
          return
        }
        if (h.activeTab === 'search') {
          e.preventDefault()
          h.onArrowDown?.()
          return
        }
        // launcher、editor、favorite 不在此处拦截
      }
      if (e.key === 'ArrowUp') {
        if (h.activeTab === 'settings' && h.settingsNavFocused && !isInputFocused) {
          e.preventDefault()
          h.onSettingsNavBlur?.()
          return
        }
        if (h.activeTab === 'ai' && h.aiCardFocused && !isInputFocused) {
          e.preventDefault()
          h.onAiCardNavigate?.('up')
          return
        }
        if (h.activeTab === 'search') {
          e.preventDefault()
          h.onArrowUp?.()
          return
        }
        // launcher、editor、favorite 不在此处拦截
      }

      // Command+1~9：快速复制
      if (isMeta && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        h.onQuickCopy?.(index)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // 依赖为空数组，只注册一次，通过 ref 拿到最新 handlers
}
