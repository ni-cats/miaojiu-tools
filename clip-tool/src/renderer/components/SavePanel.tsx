/**
 * 保存面板组件
 * 极简交互：自动读取剪贴板 → 预览 → Enter 直接保存并关闭
 */
import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { useClipboard } from '../hooks/useClipboard'
import { nanoid } from 'nanoid'
import type { SnippetData } from '../types'

interface SavePanelProps {
  onSave: (snippet: SnippetData) => void
  triggerRead?: number // 外部触发读取剪贴板的计数器
}

export interface SavePanelRef {
  doSave: () => void
}

const SavePanel = forwardRef<SavePanelRef, SavePanelProps>(({ onSave, triggerRead }, ref) => {
  const { clipboardData, readClipboard } = useClipboard()
  const [title, setTitle] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [saved, setSaved] = useState(false)

  // 组件挂载时和 triggerRead 变化时自动读取剪贴板
  useEffect(() => {
    readClipboard()
  }, [readClipboard, triggerRead])

  // 剪贴板内容变化时自动设置默认标题
  useEffect(() => {
    if (clipboardData?.content) {
      const defaultTitle = clipboardData.content.trim().substring(0, 30).replace(/\n/g, ' ')
      setTitle(defaultTitle)
      setSaved(false)
    }
  }, [clipboardData])

  const doSave = useCallback(async () => {
    if (!clipboardData?.content.trim()) return
    if (saved) return // 防止重复保存

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const snippet: SnippetData = {
      id: nanoid(),
      title: title || clipboardData.content.trim().substring(0, 30),
      content: clipboardData.content,
      tags,
      type: clipboardData.type,
      language: clipboardData.language,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      copyCount: 0,
      isFavorite: false,
    }

    onSave(snippet)
    setSaved(true)
  }, [clipboardData, title, tagsInput, onSave, saved])

  // 暴露 doSave 给父组件
  useImperativeHandle(ref, () => ({
    doSave,
  }))

  const hasContent = clipboardData?.content && clipboardData.content.trim().length > 0

  return (
    <div className="save-panel">
      {/* 顶部提示 */}
      <div className="save-hint">
        {saved ? (
          <span className="save-hint-done">✓ 已保存，窗口即将关闭...</span>
        ) : hasContent ? (
          <span className="save-hint-ready">按 <kbd>Enter</kbd> 直接保存并关闭</span>
        ) : null}
      </div>

      {/* 剪贴板预览 */}
      <div className="input-group">
        <div className="input-label">📋 剪贴板内容预览</div>
        {hasContent ? (
          <div className="clipboard-preview">{clipboardData!.content}</div>
        ) : (
          <div className="clipboard-preview" style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>
            剪贴板为空，请先复制内容
          </div>
        )}
      </div>

      {/* 检测信息 */}
      {hasContent && (
        <div className="detected-info">
          <span className={`snippet-type ${clipboardData!.type}`}>
            {clipboardData!.type}
          </span>
          {clipboardData!.language && (
            <span>检测到语言: {clipboardData!.language}</span>
          )}
          <span>{clipboardData!.content.split('\n').length} 行</span>
        </div>
      )}

      {/* 标题输入 */}
      <div className="input-group">
        <div className="input-label">标题（可选，Enter 保存）</div>
        <input
          className="text-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入标题（默认取内容前30字）"
        />
      </div>

      {/* 标签输入 */}
      <div className="input-group">
        <div className="input-label">标签（可选，英文逗号分隔）</div>
        <input
          className="text-input"
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="例如: react, hook, 工具函数"
        />
      </div>

      {/* 保存按钮（备用） */}
      <button
        className="save-btn"
        onClick={doSave}
        disabled={!hasContent || saved}
      >
        {saved ? '✓ 已保存' : '保存片段'}
      </button>
    </div>
  )
})

SavePanel.displayName = 'SavePanel'

export default SavePanel
