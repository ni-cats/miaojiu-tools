/**
 * 收藏面板组件
 * 支持键盘 ↑↓ 选中、Enter 复制
 * 支持内联编辑标题和标签
 * 支持批量导入/导出到语雀
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { SnippetData, YuqueSearchResult, YuqueDoc } from '../types'
import SnippetCard from './SnippetCard'
import EmptyState from './EmptyState'
import { TabFavoriteIcon } from './TabIcons'
import { IconUpload, IconDownload, IconLoading } from './LauncherIcons'

interface FavoritePanelProps {
  snippets: SnippetData[]
  onCopy: (snippet: SnippetData) => void
  onDelete: (id: string) => void
  onToggleFavorite: (id: string) => void
  onUpdateTags?: (id: string, tags: string[]) => void
  onUpdateTitle?: (id: string, title: string) => void
  onAddSnippet?: (snippet: SnippetData) => Promise<void>
}

const FavoritePanel: React.FC<FavoritePanelProps> = ({ snippets, onCopy, onDelete, onToggleFavorite, onUpdateTags, onUpdateTitle, onAddSnippet }) => {
  const favorites = snippets.filter((s) => s.isFavorite)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [editTitleValue, setEditTitleValue] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // 语雀导入/导出状态
  const [syncToast, setSyncToast] = useState<string | null>(null)

  // 导出状态
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')

  // 导入状态
  const [importMode, setImportMode] = useState(false)
  const [importQuery, setImportQuery] = useState('')
  const [importResults, setImportResults] = useState<YuqueSearchResult[]>([])
  const [importLoading, setImportLoading] = useState(false)
  const [importSelectedIndex, setImportSelectedIndex] = useState(0)
  const [importing, setImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const importSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 导入模式时自动聚焦搜索框
  useEffect(() => {
    if (importMode) {
      setTimeout(() => importInputRef.current?.focus(), 50)
    }
  }, [importMode])

  // 批量导出所有收藏到语雀（合并为一篇文档）
  const handleExportToYuque = useCallback(async () => {
    if (favorites.length === 0) return

    // 先检查语雀配置是否完整
    try {
      const configResult = await window.clipToolAPI.getYuqueConfig()
      if (!configResult?.token) {
        setSyncToast('✖ 语雀 Token 未配置，请先在设置中配置语雀 Token')
        setTimeout(() => setSyncToast(null), 4000)
        return
      }
      if (!configResult?.targetRepoNamespace) {
        setSyncToast('✖ 未选择目标知识库，请先在设置中选择要导出到的语雀知识库')
        setTimeout(() => setSyncToast(null), 4000)
        return
      }
    } catch {
      // 配置检查失败，继续尝试导出（让后端报错）
    }

    setExporting(true)
    setExportProgress('正在合并收藏内容...')
    setSyncToast(null)

    try {
      // 将所有收藏合并为一篇 markdown 文档
      const now = new Date()
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const title = 'ClipTool 收藏集'
      const sections = favorites.map((snippet, idx) => {
        const tags = snippet.tags?.length ? `\`${snippet.tags.join('` `')}\`` : ''
        const time = snippet.createdAt ? new Date(snippet.createdAt).toLocaleString('zh-CN') : ''
        // 处理内容：将 base64 图片替换为占位文本，避免 body 过大
        let content = snippet.content || ''
        content = content.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]{100,}/g, '[图片内容已省略]')
        // 单条内容限制 50KB
        if (content.length > 50000) {
          content = content.substring(0, 50000) + '\n\n> ⚠️ 内容过长，已截断'
        }
        // 动态计算包裹用的反引号数量，确保比内容中最长的连续反引号多
        const maxBackticks = (content.match(/`+/g) || []).reduce((max, m) => Math.max(max, m.length), 0)
        const fence = '`'.repeat(Math.max(3, maxBackticks + 1))
        return [
          `## ${snippet.title}`,
          '',
          fence,
          content,
          fence,
        ].filter(Boolean).join('\n')
      })

      const body = [
        `> 由 ClipTool 导出 | 共 ${favorites.length} 条收藏 | ${dateStr}`,
        '',
        '---',
        '',
        sections.join('\n\n---\n\n'),
      ].join('\n')

      setExportProgress('正在导出到语雀...')
      const result = await window.clipToolAPI.exportAllToYuque(title, body)

      if (result.success) {
        const actionText = result.action === 'updated' ? '更新' : '创建'
        setSyncToast(`✓ 已${actionText}语雀文档「${title}」，共 ${favorites.length} 条收藏`)
      } else {
        setSyncToast(`✖ 导出失败：${result.error || '未知错误'}`)
      }
    } catch (err) {
      setSyncToast(`✖ 导出失败：${err instanceof Error ? err.message : '未知错误'}`)
    } finally {
      setExporting(false)
      setExportProgress('')
      setTimeout(() => setSyncToast(null), 4000)
    }
  }, [favorites])

  // 打开导入模式
  const handleOpenImport = useCallback(() => {
    setImportMode(true)
    setImportQuery('')
    setImportResults([])
    setImportSelectedIndex(0)
  }, [])

  // 搜索语雀文档（导入用）
  const [importError, setImportError] = useState<string | null>(null)
  const handleImportSearch = useCallback((query: string) => {
    setImportQuery(query)
    setImportSelectedIndex(0)
    setImportError(null)
    if (importSearchTimer.current) clearTimeout(importSearchTimer.current)
    if (query.trim().length < 2) {
      setImportResults([])
      setImportLoading(false)
      return
    }
    setImportLoading(true)
    importSearchTimer.current = setTimeout(async () => {
      try {
        const result = await window.clipToolAPI.searchYuqueDocs(query.trim(), { limit: 10 })
        if (result.success && result.data) {
          setImportResults(result.data as YuqueSearchResult[])
          setImportError(null)
        } else {
          setImportResults([])
          setImportError(result.error || '搜索失败')
        }
      } catch (err) {
        setImportResults([])
        setImportError(`请求异常: ${err instanceof Error ? err.message : '未知错误'}`)
      } finally {
        setImportLoading(false)
      }
    }, 300)
  }, [])

  // 导入选中的语雀文档为收藏片段
  const handleImportDoc = useCallback(async (item: YuqueSearchResult) => {
    setImporting(true)
    setSyncToast('⏳ 正在从语雀导入...')
    try {
      const detailResult = await window.clipToolAPI.getYuqueDocDetail(item.target.book_id, item.target.id)
      if (detailResult.success && detailResult.doc) {
        const doc = detailResult.doc as YuqueDoc
        const newSnippet: SnippetData = {
          id: `yuque-${doc.id}-${Date.now()}`,
          title: doc.title,
          content: doc.body || '',
          tags: ['语雀导入'],
          type: 'text',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          copyCount: 0,
          isFavorite: true,
        }
        if (onAddSnippet) {
          await onAddSnippet(newSnippet)
        } else {
          await window.clipToolAPI.addSnippet(newSnippet)
        }
        setSyncToast(`✓ 已导入「${doc.title}」`)
        // 关闭导入模式
        setImportMode(false)
        setImportQuery('')
        setImportResults([])
      } else {
        setSyncToast(`✖ ${detailResult.error || '获取文档内容失败'}`)
      }
    } catch {
      setSyncToast('✖ 导入失败')
    } finally {
      setImporting(false)
      setTimeout(() => setSyncToast(null), 2500)
    }
  }, [onAddSnippet])

  // 收藏列表变化时重置选中
  useEffect(() => {
    setSelectedIndex(0)
  }, [favorites.length])

  // 编辑标题时自动聚焦
  useEffect(() => {
    if (editingTitleId && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [editingTitleId])

  // 滚动选中项到可视区域
  const scrollToSelected = useCallback((index: number) => {
    const listEl = listRef.current
    if (!listEl) return
    const cards = listEl.querySelectorAll('.snippet-card')
    if (cards[index]) {
      cards[index].scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [])

  // 开始编辑标题
  const startEditTitle = useCallback((snippet: SnippetData, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTitleId(snippet.id)
    setEditTitleValue(snippet.title)
  }, [])

  // 保存标题编辑
  const saveTitle = useCallback(() => {
    if (editingTitleId && onUpdateTitle) {
      const trimmed = editTitleValue.trim()
      if (trimmed) {
        onUpdateTitle(editingTitleId, trimmed)
      }
    }
    setEditingTitleId(null)
    setEditTitleValue('')
  }, [editingTitleId, editTitleValue, onUpdateTitle])

  // 取消标题编辑
  const cancelEditTitle = useCallback(() => {
    setEditingTitleId(null)
    setEditTitleValue('')
  }, [])

  // 全局键盘事件
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'

      // 导入模式下的键盘事件
      if (importMode && isInputFocused) {
        if (e.key === 'Escape') {
          e.preventDefault()
          setImportMode(false)
          setImportQuery('')
          setImportResults([])
          return
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault()
          setImportSelectedIndex((prev) => Math.min(prev + 1, importResults.length - 1))
          return
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault()
          setImportSelectedIndex((prev) => Math.max(prev - 1, 0))
          return
        }
        if (e.key === 'Enter' && importResults.length > 0) {
          e.preventDefault()
          handleImportDoc(importResults[importSelectedIndex])
          return
        }
        return
      }

      // 如果正在编辑标题，不拦截键盘事件
      if (editingTitleId) return
      if (isInputFocused) return
      if (favorites.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev < favorites.length - 1 ? prev + 1 : 0
          scrollToSelected(next)
          return next
        })
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : favorites.length - 1
          scrollToSelected(next)
          return next
        })
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (favorites[selectedIndex]) {
          onCopy(favorites[selectedIndex])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [favorites, selectedIndex, onCopy, scrollToSelected, editingTitleId, importMode, importResults, importSelectedIndex, handleImportDoc])

  if (favorites.length === 0 && !importMode) {
    return (
      <EmptyState
        icon={<TabFavoriteIcon size={36} />}
        title="暂无收藏的片段"
        description="点击片段上的 ☆ 按钮来收藏常用片段"
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 同步提示 Toast */}
      {syncToast && (
        <div style={{
          padding: '6px 12px',
          fontSize: 12,
          textAlign: 'center',
          background: syncToast.startsWith('✓') ? 'rgba(52, 199, 89, 0.1)' : syncToast.startsWith('✖') ? 'rgba(255, 59, 48, 0.1)' : 'rgba(0, 122, 255, 0.1)',
          color: syncToast.startsWith('✓') ? '#34c759' : syncToast.startsWith('✖') ? '#ff3b30' : '#007aff',
          borderRadius: 8,
          margin: '4px 8px',
          flexShrink: 0,
        }}>
          {syncToast}
        </div>
      )}

      {/* 导入模式：搜索语雀文档 */}
      {importMode && (
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 500 }}>📗 从语雀导入</span>
            <button
              onClick={() => { setImportMode(false); setImportQuery(''); setImportResults([]) }}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-tertiary)' }}
            >✕ 关闭</button>
          </div>
          <input
            ref={importInputRef}
            className="text-input"
            type="text"
            value={importQuery}
            onChange={(e) => handleImportSearch(e.target.value)}
            placeholder="搜索语雀文档关键词（至少 2 个字符）..."
            style={{ width: '100%', fontSize: 12 }}
            spellCheck={false}
          />
          {importLoading && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'center' }}>⏳ 搜索中...</div>
          )}
          {!importLoading && importError && (
            <div style={{ fontSize: 11, color: '#ff3b30', marginTop: 6, textAlign: 'center', padding: '4px 8px', background: 'rgba(255,59,48,0.08)', borderRadius: 6 }}>
              ✖ {importError}
            </div>
          )}
          {!importLoading && !importError && importQuery.trim().length >= 2 && importResults.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6, textAlign: 'center' }}>未找到相关文档</div>
          )}
          {importResults.length > 0 && (
            <div style={{ marginTop: 6, maxHeight: 240, overflowY: 'auto' }}>
              {importResults.map((item, idx) => (
                <div
                  key={item.id}
                  onClick={() => handleImportDoc(item)}
                  onMouseEnter={() => setImportSelectedIndex(idx)}
                  style={{
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: importing ? 'wait' : 'pointer',
                    background: idx === importSelectedIndex ? 'var(--hover-bg)' : 'transparent',
                    transition: 'background 0.1s',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {item.target?.title || item.title}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', gap: 8 }}>
                    {item.target?.book?.name && <span>📚 {item.target.book.name}</span>}
                    {item.target?.content_updated_at && (
                      <span>{new Date(item.target.content_updated_at).toLocaleDateString()}</span>
                    )}
                  </div>
                  {item.summary && (
                    <div style={{ fontSize: 10, color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.summary.replace(/<[^>]+>/g, '').substring(0, 80)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 导出进度条 */}
      {exporting && (
        <div style={{
          padding: '6px 12px',
          fontSize: 12,
          textAlign: 'center',
          background: 'rgba(0, 122, 255, 0.08)',
          color: '#007aff',
          flexShrink: 0,
        }}>
          <IconLoading size={14} color="#007aff" /> {exportProgress}
        </div>
      )}

      <div className="panel-content" ref={listRef} style={{ padding: 0, flex: 1 }}>
        {favorites.map((snippet, index) => (
          <SnippetCard
            key={snippet.id}
            snippet={snippet}
            index={index}
            showIndex={index < 9}
            isSelected={index === selectedIndex}
            onCopy={onCopy}
            onDelete={onDelete}
            onToggleFavorite={onToggleFavorite}
            onUpdateTags={onUpdateTags}
            onMouseEnter={() => setSelectedIndex(index)}
            editingTitleId={editingTitleId}
            editTitleValue={editTitleValue}
            titleInputRef={editingTitleId === snippet.id ? titleInputRef : undefined}
            onStartEditTitle={(e) => startEditTitle(snippet, e)}
            onEditTitleChange={setEditTitleValue}
            onSaveTitle={saveTitle}
            onCancelEditTitle={cancelEditTitle}
          />
        ))}
      </div>

      {/* 快捷键提示 + 语雀导入/导出按钮 */}
      <div className="shortcut-hint" style={{ borderTop: 'none', paddingTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <kbd>↑↓</kbd> 选择 &nbsp;
          <kbd>Enter</kbd> 复制 &nbsp;
          <kbd>双击标题</kbd> 编辑 &nbsp;
          <kbd>Esc</kbd> 关闭
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            onClick={handleExportToYuque}
            disabled={exporting || importing || favorites.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: '3px 10px',
              fontSize: 11,
              cursor: exporting || importing || favorites.length === 0 ? 'not-allowed' : 'pointer',
              opacity: exporting || importing || favorites.length === 0 ? 0.45 : 1,
              transition: 'all 0.15s',
            }}
            title={`导出到语雀${favorites.length > 0 ? ` (${favorites.length})` : ''}`}
          >
            {exporting ? <IconLoading size={14} color="#07650d" /> : <IconUpload size={12} />} <span style={{ color: 'var(--text-secondary)' }}>{exporting ? '导出中' : '导出'}</span>
          </button>
          <button
            onClick={handleOpenImport}
            disabled={exporting || importing}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              border: '1px solid var(--border-color)',
              borderRadius: 6,
              padding: '3px 10px',
              fontSize: 11,
              cursor: exporting || importing ? 'not-allowed' : 'pointer',
              opacity: exporting || importing ? 0.45 : 1,
              transition: 'all 0.15s',
            }}
            title="从语雀导入"
          >
            <IconDownload size={12} /> <span style={{ color: 'var(--text-secondary)' }}>导入</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default FavoritePanel
