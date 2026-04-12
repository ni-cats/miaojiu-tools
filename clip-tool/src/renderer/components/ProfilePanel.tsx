/**
 * 个人中心面板组件
 * 支持编辑个人信息并同步到 COS 云端
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import type { ProfileData, StorageMode } from '../types'
import { IconUser } from './TabIcons'
import { Upload, Download } from 'lucide-react'

const DEFAULT_PROFILE: ProfileData = {
  nickname: '',
  avatar: '',
  bio: '',
  email: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

const ProfilePanel: React.FC = () => {
  const [profile, setProfile] = useState<ProfileData>({ ...DEFAULT_PROFILE })
  const [originalProfile, setOriginalProfile] = useState<ProfileData>({ ...DEFAULT_PROFILE })
  const [hasChanges, setHasChanges] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [storageMode, setStorageMode] = useState<StorageMode>('local')
  const [deviceId, setDeviceId] = useState<string>('')
  const [hasCosKey, setHasCosKey] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 加载个人信息
  useEffect(() => {
    window.clipToolAPI.getProfile().then((data) => {
      setProfile(data)
      setOriginalProfile(data)
    })
    window.clipToolAPI.getStorageMode().then(setStorageMode)
    window.clipToolAPI.getDeviceId().then(setDeviceId)
    // 检查是否有 COS 密钥（有密钥就能同步个人信息）
    window.clipToolAPI.getCosConfig().then((config) => {
      setHasCosKey(!!config.secretId && !!config.secretKey)
    })
  }, [])

  // 检测是否有变更
  useEffect(() => {
    setHasChanges(JSON.stringify(profile) !== JSON.stringify(originalProfile))
  }, [profile, originalProfile])

  // 更新字段
  const updateField = useCallback((field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }))
  }, [])

  // 选择头像
  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const base64 = event.target?.result as string
      setProfile((prev) => ({ ...prev, avatar: base64 }))
    }
    reader.readAsDataURL(file)
  }, [])

  // 保存个人信息
  const handleSave = useCallback(async () => {
    try {
      const updated = {
        ...profile,
        updatedAt: new Date().toISOString(),
        createdAt: profile.createdAt || new Date().toISOString(),
      }
      const saved = await window.clipToolAPI.saveProfile(updated)
      setProfile(saved)
      setOriginalProfile(saved)
      setStatus('✓ 个人信息已保存')
      setTimeout(() => setStatus(null), 2000)
    } catch (error) {
      console.error('保存个人信息失败:', error)
      setStatus('✕ 保存失败')
      setTimeout(() => setStatus(null), 2000)
    }
  }, [profile])

  // 推送到云端
  const handlePush = useCallback(async () => {
    setSyncing(true)
    setStatus(null)
    try {
      // 先保存本地
      const updated = {
        ...profile,
        updatedAt: new Date().toISOString(),
        createdAt: profile.createdAt || new Date().toISOString(),
      }
      await window.clipToolAPI.saveProfile(updated)
      const ok = await window.clipToolAPI.pushProfile()
      if (ok) {
        setStatus('✓ 个人信息已推送到云端')
        setOriginalProfile(updated)
        setProfile(updated)
      } else {
        setStatus('✕ 推送失败')
      }
      setTimeout(() => setStatus(null), 3000)
    } catch (error) {
      setStatus('✕ 推送失败')
      setTimeout(() => setStatus(null), 3000)
    } finally {
      setSyncing(false)
    }
  }, [profile])

  // 从云端拉取
  const handlePull = useCallback(async () => {
    setSyncing(true)
    setStatus(null)
    try {
      const data = await window.clipToolAPI.pullProfile()
      if (data) {
        setProfile(data)
        setOriginalProfile(data)
        setStatus('✓ 已从云端拉取个人信息')
      } else {
        setStatus('⚠ 云端暂无个人信息')
      }
      setTimeout(() => setStatus(null), 3000)
    } catch (error) {
      setStatus('✕ 拉取失败')
      setTimeout(() => setStatus(null), 3000)
    } finally {
      setSyncing(false)
    }
  }, [])

  // 清除头像
  const handleRemoveAvatar = useCallback(() => {
    setProfile((prev) => ({ ...prev, avatar: '' }))
  }, [])

  return (
    <div className="profile-panel">
      {/* 头像区域 */}
      <div className="profile-avatar-section">
        <div className="profile-avatar-wrapper" onClick={handleAvatarClick}>
          {profile.avatar ? (
            <img src={profile.avatar} alt="头像" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar-placeholder">
              <span className="profile-avatar-icon"><IconUser size={32} color="var(--text-tertiary)" /></span>
              <span className="profile-avatar-hint">点击上传</span>
            </div>
          )}
          {profile.avatar ? (
            <button className="profile-avatar-remove" onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }} title="移除头像">
              ✕ 删除
            </button>
          ) : (
            <div className="profile-avatar-overlay">📷</div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleAvatarChange}
          style={{ display: 'none' }}
        />
      </div>

      {/* 信息编辑区域 */}
      <div className="profile-fields">
        <div className="profile-field">
          <label className="profile-label">昵称</label>
          <input
            className="text-input"
            type="text"
            value={profile.nickname}
            onChange={(e) => updateField('nickname', e.target.value)}
            placeholder="输入你的昵称"
            maxLength={20}
          />
        </div>

        <div className="profile-field">
          <label className="profile-label">个人签名</label>
          <input
            className="text-input"
            type="text"
            value={profile.bio}
            onChange={(e) => updateField('bio', e.target.value)}
            placeholder="一句话介绍自己"
            maxLength={100}
          />
        </div>

        <div className="profile-field">
          <label className="profile-label">邮箱</label>
          <input
            className="text-input"
            type="email"
            value={profile.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="输入你的邮箱"
          />
        </div>
      </div>

      {/* 设备信息 */}
      <div className="profile-info-section">
        <div className="profile-info-item">
          <span className="profile-info-label">设备 ID</span>
          <code className="profile-info-value">{deviceId || '获取中...'}</code>
        </div>
        <div className="profile-info-item">
          <span className="profile-info-label">存储模式</span>
          <span className="profile-info-value">{storageMode === 'cos' ? '☁️ 云端存储' : '💾 本地存储'}</span>
        </div>
        {profile.createdAt && profile.createdAt !== new Date(0).toISOString() && (
          <div className="profile-info-item">
            <span className="profile-info-label">创建时间</span>
            <span className="profile-info-value">
              {new Date(profile.createdAt).toLocaleDateString('zh-CN')}
            </span>
          </div>
        )}
      </div>

      {/* 状态提示 */}
      {status && (
        <div className={`settings-status ${status.startsWith('✓') ? 'success' : status.startsWith('⚠') ? 'warning' : 'error'}`}
             style={{ fontSize: 12, textAlign: 'center', marginTop: 4 }}>
          {status}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="profile-actions">
        <button
          className="profile-btn primary"
          onClick={handleSave}
          disabled={!hasChanges}
        >
          💾 保存
        </button>
        {hasCosKey && (
          <>
            <button
              className="profile-btn"
              onClick={handlePush}
              disabled={syncing}
            >
            {syncing ? <><Download size={12} style={{ verticalAlign: -2 }} /> 同步中...</> : <><Upload size={12} style={{ verticalAlign: -2 }} /> 推送到云端</>}
            </button>
            <button
              className="profile-btn"
              onClick={handlePull}
              disabled={syncing}
            >
            {syncing ? <><Download size={12} style={{ verticalAlign: -2 }} /> 同步中...</> : <><Download size={12} style={{ verticalAlign: -2 }} /> 从云端拉取</>}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default ProfilePanel
