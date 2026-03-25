/**
 * 保存面板组件
 * 极简交互：自动读取剪贴板 → 预览 → Enter 直接保存并关闭
 * 标签支持从预设枚举中选择，也支持自由输入
 */
import React, { useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { useClipboard } from '../hooks/useClipboard'
import { nanoid } from 'nanoid'
import type { SnippetData } from '../types'
import { getTagColor, registerTags } from '../utils/tagColor'

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
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [customTagInput, setCustomTagInput] = useState('')
  const [customTags, setCustomTags] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  // AI 生成标题状态
  const [aiTitleEnabled, setAiTitleEnabled] = useState(false)
  const [aiTitleLoading, setAiTitleLoading] = useState(false)

  // 加载自定义标签列表和 AI 标题配置
  useEffect(() => {
    window.clipToolAPI.getCustomTags().then((tags) => {
      setCustomTags(tags)
      registerTags(tags)
      // 默认选中「临时」标签
      if (tags.includes('临时')) {
        setSelectedTags(['临时'])
      }
    })
    window.clipToolAPI.getAiTitleEnabled().then(setAiTitleEnabled)
  }, [])

  // 组件挂载时和 triggerRead 变化时自动读取剪贴板
  useEffect(() => {
    readClipboard()
  }, [readClipboard, triggerRead])

  // 剪贴板内容变化时自动设置默认标题
  useEffect(() => {
    if (clipboardData?.content) {
      // 图片类型不取前30字，而是用固定标题
      if (clipboardData.isImage || clipboardData.type === 'image') {
        setTitle('图片片段')
      } else {
        const defaultTitle = clipboardData.content.trim().substring(0, 30).replace(/\n/g, ' ')
        setTitle(defaultTitle)
      }
      setSaved(false)
      // 重置标签为默认选中「临时」
      setSelectedTags(customTags.includes('临时') ? ['临时'] : [])
      setCustomTagInput('')

      // 如果启用了 AI 生成标题，异步调用
      if (aiTitleEnabled && !clipboardData.isImage && clipboardData.type !== 'image') {
        setAiTitleLoading(true)
        window.clipToolAPI.generateAiTitle(clipboardData.content, clipboardData.type).then((generatedTitle) => {
          if (generatedTitle) {
            setTitle(generatedTitle)
          }
        }).catch(() => {
          // AI 生成失败，保留默认标题
        }).finally(() => {
          setAiTitleLoading(false)
        })
      }
    }
  }, [clipboardData])

  // 切换标签选中状态
  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }, [])

  // 添加自定义标签（手动输入的）
  const addCustomTagFromInput = useCallback(() => {
    const tag = customTagInput.trim()
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag])
    }
    setCustomTagInput('')
  }, [customTagInput, selectedTags])

  const doSave = useCallback(async () => {
    if (!clipboardData?.content.trim()) return
    if (saved) return // 防止重复保存

    // 合并预选标签和自定义输入标签
    const allTags = [...selectedTags]
    if (customTagInput.trim()) {
      const extraTags = customTagInput.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
      extraTags.forEach((t) => {
        if (!allTags.includes(t)) allTags.push(t)
      })
    }

    const snippet: SnippetData = {
      id: nanoid(),
      title: title || clipboardData.content.trim().substring(0, 30),
      content: clipboardData.content,
      tags: allTags,
      type: clipboardData.type,
      language: clipboardData.language,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      copyCount: 0,
      isFavorite: false,
    }

    onSave(snippet)
    setSaved(true)
  }, [clipboardData, title, selectedTags, customTagInput, onSave, saved])

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
          clipboardData!.isImage || clipboardData!.type === 'image' ? (
            <div className="clipboard-preview clipboard-image-preview">
              <img src={clipboardData!.content} alt="剪贴板图片" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 6 }} />
            </div>
          ) : (
            <div className="clipboard-preview">{clipboardData!.content}</div>
          )
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
          {clipboardData!.isImage ? (
            <span>图片</span>
          ) : (
            <span>{clipboardData!.content.split('\n').length} 行</span>
          )}
        </div>
      )}

      {/* 标题输入 */}
      <div className="input-group">
        <div className="input-label">
          标题（可选，Enter 保存）
          {aiTitleLoading && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--accent-color)' }}>✨ AI 生成中...</span>}
          {aiTitleEnabled && !aiTitleLoading && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-tertiary)' }}>🤖 AI 标题</span>}
        </div>
        <input
          className="text-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入标题（默认取内容前30字）"
        />
      </div>

      {/* 标签选择 - 枚举标签 */}
      <div className="input-group">
        <div className="input-label">标签（点击选择，也可自由输入）</div>
        {customTags.length > 0 && (
          <div className="tag-enum-list">
            {customTags.map((tag) => (
              <button
                key={tag}
                className={`tag-enum-item ${selectedTags.includes(tag) ? 'active' : ''}`}
                onClick={() => toggleTag(tag)}
                style={selectedTags.includes(tag) ? {
                  background: getTagColor(tag).bg,
                  color: getTagColor(tag).text,
                  borderColor: getTagColor(tag).text,
                } : undefined}
              >
                {selectedTags.includes(tag) ? '✓ ' : ''}{tag}
              </button>
            ))}
          </div>
        )}
        {/* 自由输入补充标签 */}
        <div className="tag-custom-input-row">
          <input
            className="text-input"
            type="text"
            value={customTagInput}
            onChange={(e) => setCustomTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && customTagInput.trim()) {
                e.preventDefault()
                e.stopPropagation()
                addCustomTagFromInput()
              }
            }}
            placeholder="输入自定义标签，回车添加"
            style={{ flex: 1 }}
          />
          {customTagInput.trim() && (
            <button
              className="tag-add-btn"
              onClick={addCustomTagFromInput}
            >
              +
            </button>
          )}
        </div>
        {/* 已选标签展示 */}
        {selectedTags.length > 0 && (
          <div className="selected-tags-display">
            {selectedTags.map((tag) => (
              <span key={tag} className="selected-tag-item" style={{
                background: getTagColor(tag).bg,
                color: getTagColor(tag).text,
              }}>
                {tag}
                <button
                  className="selected-tag-remove"
                  onClick={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                  style={{ color: getTagColor(tag).text }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
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
