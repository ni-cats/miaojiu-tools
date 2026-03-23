/**
 * 标签筛选组件
 */
import React from 'react'
import { getTagColor } from '../utils/tagColor'

interface TagFilterProps {
  tags: string[]
  selectedTag: string | null
  onSelectTag: (tag: string | null) => void
}

const TagFilter: React.FC<TagFilterProps> = ({ tags, selectedTag, onSelectTag }) => {
  if (tags.length === 0) return null

  return (
    <div className="tag-filter">
      <button
        className={`tag-filter-item ${selectedTag === null ? 'active' : ''}`}
        onClick={() => onSelectTag(null)}
      >
        全部
      </button>
      {tags.map((tag) => (
        <button
          key={tag}
          className={`tag-filter-item ${selectedTag === tag ? 'active' : ''}`}
          onClick={() => onSelectTag(selectedTag === tag ? null : tag)}
          style={selectedTag === tag ? {
            background: getTagColor(tag).text,
            borderColor: getTagColor(tag).text,
          } : {
            color: getTagColor(tag).text,
            borderColor: getTagColor(tag).bg,
          }}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}

export default TagFilter
