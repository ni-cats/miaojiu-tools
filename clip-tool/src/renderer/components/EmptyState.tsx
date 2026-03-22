/**
 * 空状态组件
 */
import React from 'react'

interface EmptyStateProps {
  icon: string
  title: string
  description: string
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description }) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <div className="empty-state-title">{title}</div>
      <div className="empty-state-desc">{description}</div>
    </div>
  )
}

export default EmptyState
