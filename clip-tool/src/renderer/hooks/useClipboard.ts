/**
 * 剪贴板 Hook
 * 负责读取剪贴板内容
 */
import { useState, useCallback } from 'react'
import type { ClipboardData } from '../types'

export function useClipboard() {
  const [clipboardData, setClipboardData] = useState<ClipboardData | null>(null)
  const [loading, setLoading] = useState(false)

  const readClipboard = useCallback(async () => {
    setLoading(true)
    try {
      const data = await window.clipToolAPI.readClipboard()
      setClipboardData(data)
      return data
    } catch (error) {
      console.error('读取剪贴板失败:', error)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const clearClipboard = useCallback(() => {
    setClipboardData(null)
  }, [])

  return { clipboardData, loading, readClipboard, clearClipboard }
}
