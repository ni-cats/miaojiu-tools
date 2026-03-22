/**
 * 窗口内快捷键 Hook
 * 极简交互：Enter 保存并关闭、⌘C 复制选中项、Escape 关闭
 */
import { useEffect } from 'react'

interface ShortcutHandlers {
  onEnterSave?: () => void          // Enter 直接保存并关闭
  onCopySelected?: () => void       // Command+C 复制选中项
  onEscape?: () => void             // Escape 隐藏窗口
  onArrowUp?: () => void            // ↑ 选上一条
  onArrowDown?: () => void          // ↓ 选下一条
  onQuickCopy?: (index: number) => void  // Command+1~9 快速复制
  activeTab?: string                // 当前激活的 Tab
}

export function useShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey
      const target = e.target as HTMLElement
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      // Escape：隐藏窗口
      if (e.key === 'Escape') {
        e.preventDefault()
        handlers.onEscape?.()
        return
      }

      // Enter：在保存 Tab 下直接保存并关闭（输入框中不拦截）
      if (e.key === 'Enter' && !isMeta && handlers.activeTab === 'save') {
        // 如果焦点在输入框（标题/标签），也允许 Enter 保存
        e.preventDefault()
        handlers.onEnterSave?.()
        return
      }

      // Enter：在搜索 Tab 下复制选中项
      if (e.key === 'Enter' && !isMeta && handlers.activeTab === 'search') {
        e.preventDefault()
        handlers.onCopySelected?.()
        return
      }

      // Command+C：在搜索 Tab 下复制选中项（非输入框内）
      if (isMeta && e.key === 'c' && handlers.activeTab === 'search' && !isInputFocused) {
        e.preventDefault()
        handlers.onCopySelected?.()
        return
      }

      // ↑ / ↓：在搜索 Tab 下切换选中项
      if (e.key === 'ArrowUp' && handlers.activeTab === 'search') {
        e.preventDefault()
        handlers.onArrowUp?.()
        return
      }
      if (e.key === 'ArrowDown' && handlers.activeTab === 'search') {
        e.preventDefault()
        handlers.onArrowDown?.()
        return
      }

      // Command+1~9：快速复制
      if (isMeta && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const index = parseInt(e.key) - 1
        handlers.onQuickCopy?.(index)
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handlers])
}
