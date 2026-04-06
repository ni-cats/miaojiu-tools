/**
 * 启动耗时日志工具
 * 将关键节点的耗时信息输出到日志文件，方便分析启动慢的原因
 */
import { writeFileSync, appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/** 日志文件路径 */
let logFilePath = ''

/** 启动基准时间 */
const startTime = Date.now()

/** 获取日志文件路径 */
export function getLogFilePath(): string {
  if (!logFilePath) {
    const logDir = join(app.getPath('userData'), 'logs')
    try {
      mkdirSync(logDir, { recursive: true })
    } catch {
      // 目录已存在
    }
    logFilePath = join(logDir, 'startup.log')
  }
  return logFilePath
}

/** 初始化日志文件（清空旧内容） */
export function initLog(): void {
  const filePath = getLogFilePath()
  const header = `=== ClipTool 启动日志 ===\n启动时间: ${new Date().toISOString()}\n${'='.repeat(50)}\n`
  writeFileSync(filePath, header, 'utf-8')
}

/** 记录带时间戳的日志 */
export function log(tag: string, message: string): void {
  const elapsed = Date.now() - startTime
  const line = `[+${elapsed}ms] [${tag}] ${message}\n`
  console.log(line.trim())
  try {
    appendFileSync(getLogFilePath(), line, 'utf-8')
  } catch {
    // 忽略写入失败
  }
}

/** 创建一个计时器，返回 stop 函数 */
export function timer(tag: string, label: string): () => void {
  const t0 = Date.now()
  log(tag, `⏱ 开始: ${label}`)
  return () => {
    const cost = Date.now() - t0
    log(tag, `✅ 完成: ${label} (耗时 ${cost}ms)`)
  }
}
