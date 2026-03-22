/**
 * 设置面板组件
 * 支持用户自定义全局快捷键和管理预设标签
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { ShortcutConfig } from '../types'

/** 将 Electron accelerator 格式转换为可读的按键显示 */
function formatShortcutDisplay(accelerator: string): string {
  if (!accelerator) return '未设置'
  return accelerator
    .replace(/CommandOrControl/g, '⌘')
    .replace(/CmdOrCtrl/g, '⌘')
    .replace(/Command/g, '⌘')
    .replace(/Control/g, '⌃')
    .replace(/Shift/g, '⇧')
    .replace(/Alt/g, '⌥')
    .replace(/Option/g, '⌥')
    .replace(/\+/g, ' ')
}

/** 将键盘事件转换为 Electron accelerator 格式 */
function keyEventToAccelerator(e: KeyboardEvent): string | null {
  // 必须有修饰键
  if (!e.metaKey && !e.ctrlKey && !e.altKey) return null

  const parts: string[] = []

  if (e.metaKey || e.ctrlKey) parts.push('CommandOrControl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  // 过滤掉单独的修饰键
  const ignoredKeys = ['Meta', 'Control', 'Shift', 'Alt', 'CapsLock', 'Tab']
  if (ignoredKeys.includes(e.key)) return null

  // 获取实际按键
  let key = e.key.toUpperCase()

  // 特殊键映射
  const specialKeys: Record<string, string> = {
    ' ': 'Space',
    'ARROWUP': 'Up',
    'ARROWDOWN': 'Down',
    'ARROWLEFT': 'Left',
    'ARROWRIGHT': 'Right',
    'BACKSPACE': 'Backspace',
    'DELETE': 'Delete',
    'ENTER': 'Return',
    'ESCAPE': 'Escape',
  }
  if (specialKeys[key]) {
    key = specialKeys[key]
  }

  parts.push(key)
  return parts.join('+')
}

interface ShortcutItemProps {
  label: string
  description: string
  value: string
  isRecording: boolean
  onStartRecording: () => void
  onStopRecording: () => void
  onClear: () => void
}

const ShortcutItem: React.FC<ShortcutItemProps> = ({
  label,
  description,
  value,
  isRecording,
  onStartRecording,
  onStopRecording,
  onClear,
}) => {
  return (
    <div className="settings-shortcut-item">
      <div className="settings-shortcut-info">
        <div className="settings-shortcut-label">{label}</div>
        <div className="settings-shortcut-desc">{description}</div>
      </div>
      <div className="settings-shortcut-actions">
        <button
          className={`settings-shortcut-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? onStopRecording : onStartRecording}
        >
          {isRecording ? (
            <span className="recording-text">按下快捷键...</span>
          ) : (
            <span className="shortcut-display">{formatShortcutDisplay(value)}</span>
          )}
        </button>
        {value && !isRecording && (
          <button className="settings-clear-btn" onClick={onClear} title="清除快捷键">
            ✕
          </button>
        )}
      </div>
    </div>
  )
}

const SettingsPanel: React.FC<{ onShortcutsChanged?: () => void }> = ({ onShortcutsChanged }) => {
  const [shortcuts, setShortcuts] = useState<ShortcutConfig>({
    openSave: '',
    openSearch: '',
  })
  const [recording, setRecording] = useState<keyof ShortcutConfig | null>(null)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const originalRef = useRef<ShortcutConfig | null>(null)

  // 标签管理状态
  const [customTags, setCustomTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [tagSaveStatus, setTagSaveStatus] = useState<string | null>(null)

  // 加载当前快捷键配置
  useEffect(() => {
    window.clipToolAPI.getShortcuts().then((config) => {
      setShortcuts(config)
      originalRef.current = { ...config }
    })
    // 加载自定义标签
    window.clipToolAPI.getCustomTags().then(setCustomTags)
  }, [])

  // 录制快捷键
  useEffect(() => {
    if (!recording) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // 按 Escape 取消录制
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }

      const accelerator = keyEventToAccelerator(e)
      if (accelerator) {
        setShortcuts((prev) => {
          const next = { ...prev, [recording]: accelerator }
          setHasChanges(
            JSON.stringify(next) !== JSON.stringify(originalRef.current)
          )
          return next
        })
        setRecording(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recording])

  // 清除某个快捷键
  const handleClear = useCallback((key: keyof ShortcutConfig) => {
    setShortcuts((prev) => {
      const next = { ...prev, [key]: '' }
      setHasChanges(
        JSON.stringify(next) !== JSON.stringify(originalRef.current)
      )
      return next
    })
  }, [])

  // 保存配置
  const handleSave = useCallback(async () => {
    try {
      const saved = await window.clipToolAPI.saveShortcuts(shortcuts)
      setShortcuts(saved)
      originalRef.current = { ...saved }
      setHasChanges(false)
      setSaveStatus('✓ 快捷键已保存')
      // 通知父组件快捷键已更新
      onShortcutsChanged?.()
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (error) {
      console.error('保存快捷键配置失败:', error)
      setSaveStatus('✕ 保存失败')
      setTimeout(() => setSaveStatus(null), 2000)
    }
  }, [shortcuts])

  // 重置为默认
  const handleReset = useCallback(async () => {
    const defaults: ShortcutConfig = {
      openSave: 'CommandOrControl+Shift+K',
      openSearch: 'CommandOrControl+Shift+S',
    }
    setShortcuts(defaults)
    setHasChanges(
      JSON.stringify(defaults) !== JSON.stringify(originalRef.current)
    )
  }, [])

  // ===== 标签管理 =====
  const handleAddTag = useCallback(async () => {
    const tag = newTagInput.trim()
    if (!tag) return
    if (customTags.includes(tag)) {
      setTagSaveStatus('⚠ 标签已存在')
      setTimeout(() => setTagSaveStatus(null), 2000)
      return
    }
    const updated = [...customTags, tag]
    const saved = await window.clipToolAPI.saveCustomTags(updated)
    setCustomTags(saved)
    setNewTagInput('')
    setTagSaveStatus('✓ 已添加')
    setTimeout(() => setTagSaveStatus(null), 2000)
  }, [newTagInput, customTags])

  const handleRemoveTag = useCallback(async (tag: string) => {
    const updated = customTags.filter((t) => t !== tag)
    const saved = await window.clipToolAPI.saveCustomTags(updated)
    setCustomTags(saved)
  }, [customTags])

  const shortcutItems: {
    key: keyof ShortcutConfig
    label: string
    description: string
  }[] = [
    {
      key: 'openSave',
      label: '📋 唤起保存',
      description: '打开窗口并进入保存模式，自动读取剪贴板',
    },
    {
      key: 'openSearch',
      label: '🔍 唤起搜索',
      description: '打开窗口并进入搜索模式，自动聚焦搜索框',
    },
  ]

  return (
    <div className="settings-panel">
      <div className="settings-section">
        <div className="settings-section-title">全局快捷键</div>
        <div className="settings-section-hint">
          点击按键区域后按下新的快捷键组合，按 Esc 取消录制
        </div>

        <div className="settings-shortcut-list">
          {shortcutItems.map((item) => (
            <ShortcutItem
              key={item.key}
              label={item.label}
              description={item.description}
              value={shortcuts[item.key]}
              isRecording={recording === item.key}
              onStartRecording={() => setRecording(item.key)}
              onStopRecording={() => setRecording(null)}
              onClear={() => handleClear(item.key)}
            />
          ))}
        </div>
      </div>

      {/* ===== 预设标签管理 ===== */}
      <div className="settings-section">
        <div className="settings-section-title">预设标签管理</div>
        <div className="settings-section-hint">
          管理保存片段时可快速选择的预设标签
        </div>

        {/* 添加标签 */}
        <div className="settings-tag-add-row">
          <input
            className="text-input"
            type="text"
            value={newTagInput}
            onChange={(e) => setNewTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTagInput.trim()) {
                e.preventDefault()
                handleAddTag()
              }
            }}
            placeholder="输入新标签名称，回车添加"
            style={{ flex: 1 }}
          />
          <button
            className="settings-tag-add-btn"
            onClick={handleAddTag}
            disabled={!newTagInput.trim()}
          >
            添加
          </button>
        </div>

        {tagSaveStatus && (
          <span className={`settings-status ${tagSaveStatus.startsWith('✓') ? 'success' : 'warning'}`}
                style={{ fontSize: 12, marginTop: 4 }}>
            {tagSaveStatus}
          </span>
        )}

        {/* 标签列表 */}
        <div className="settings-tag-list">
          {customTags.length === 0 ? (
            <div className="settings-tag-empty">暂无预设标签，请添加</div>
          ) : (
            customTags.map((tag) => (
              <div key={tag} className="settings-tag-item">
                <span className="settings-tag-name">{tag}</span>
                <button
                  className="settings-tag-remove-btn"
                  onClick={() => handleRemoveTag(tag)}
                  title="删除标签"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 窗口内快捷键说明（只读展示） */}
      <div className="settings-section">
        <div className="settings-section-title">窗口内快捷键</div>
        <div className="settings-builtin-list">
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">Enter</span>
            <span className="settings-builtin-desc">保存模式下保存并关闭</span>
          </div>
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">⌘C / Enter</span>
            <span className="settings-builtin-desc">搜索模式下复制选中项</span>
          </div>
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">← / →</span>
            <span className="settings-builtin-desc">切换 Tab 页面</span>
          </div>
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">↑ / ↓</span>
            <span className="settings-builtin-desc">搜索结果导航</span>
          </div>
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">空格 × 2</span>
            <span className="settings-builtin-desc">快速关闭窗口</span>
          </div>
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">Esc</span>
            <span className="settings-builtin-desc">关闭窗口</span>
          </div>
          <div className="settings-builtin-item">
            <span className="settings-builtin-label">⌘ 1~9</span>
            <span className="settings-builtin-desc">快速复制第 N 项</span>
          </div>
        </div>
      </div>

      {/* 操作区域 */}
      <div className="settings-footer">
        {saveStatus && (
          <span className={`settings-status ${saveStatus.startsWith('✓') ? 'success' : 'error'}`}>
            {saveStatus}
          </span>
        )}
        <div className="settings-footer-actions">
          <button className="settings-reset-btn" onClick={handleReset}>
            恢复默认
          </button>
          <button
            className="settings-save-btn"
            onClick={handleSave}
            disabled={!hasChanges}
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
