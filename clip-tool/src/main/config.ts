/**
 * 应用配置读取模块
 * 从 resources/config.yaml 读取配置信息（密钥等敏感数据）
 */
import { readFileSync } from 'fs'
import { resolve, join } from 'path'
import yaml from 'js-yaml'
import { app } from 'electron'

/** COS 配置结构 */
export interface CosYamlConfig {
  bucket: string
  region: string
  secretId: string
  secretKey: string
  enabled: boolean
}

/** 混元大模型配置结构 */
export interface HunyuanYamlConfig {
  secretId: string
  secretKey: string
  model: string
  enabled: boolean
}

/** AI 模型预配置结构 */
export interface AiModelYamlConfig {
  provider: 'hunyuan' | 'deepseek'
  secretId: string
  secretKey: string
  model: string
  enabled: boolean
}

/** 应用默认配置结构（从 YAML 预设） */
export interface AppDefaultsYamlConfig {
  storageMode: 'local' | 'cos'
  aiTitleEnabled: boolean
  aiModels: AiModelYamlConfig[]
}

/** 完整配置结构 */
interface AppConfig {
  cos: CosYamlConfig
  hunyuan: HunyuanYamlConfig
  app: AppDefaultsYamlConfig
}

/** 默认 COS 配置（未读取到配置文件时使用） */
const DEFAULT_COS_CONFIG: CosYamlConfig = {
  bucket: 'miaojiu-tools-1327699824',
  region: 'ap-guangzhou',
  secretId: '',
  secretKey: '',
  enabled: false,
}

/** 默认混元大模型配置 */
const DEFAULT_HUNYUAN_CONFIG: HunyuanYamlConfig = {
  secretId: '',
  secretKey: '',
  model: 'hunyuan-lite',
  enabled: false,
}

/** 默认应用配置 */
const DEFAULT_APP_CONFIG: AppDefaultsYamlConfig = {
  storageMode: 'local',
  aiTitleEnabled: false,
  aiModels: [],
}

/** 缓存的配置 */
let cachedConfig: AppConfig | null = null

/**
 * 获取 config.yaml 文件路径
 * 开发模式：项目根目录/resources/config.yaml
 * 打包模式：app.asar 内的 /resources/config.yaml（通过 app.getAppPath() 定位）
 */
function getConfigPath(): string {
  if (app.isPackaged) {
    // 打包后：config.yaml 在 app.asar/resources/ 目录内
    // app.getAppPath() 返回 app.asar 的路径，Electron 会自动从 asar 中读取
    return join(app.getAppPath(), 'resources', 'config.yaml')
  }
  // 开发模式：项目根目录下的 resources
  return resolve(__dirname, '../../resources/config.yaml')
}

/**
 * 读取并解析 config.yaml
 * 配置读取后会缓存，避免重复 IO
 */
export function loadAppConfig(): AppConfig {
  if (cachedConfig) return cachedConfig

  const configPath = getConfigPath()
  try {
    const content = readFileSync(configPath, 'utf-8')
    const parsed = yaml.load(content) as Partial<AppConfig>

    cachedConfig = {
      cos: {
        ...DEFAULT_COS_CONFIG,
        ...(parsed?.cos || {}),
      },
      hunyuan: {
        ...DEFAULT_HUNYUAN_CONFIG,
        ...(parsed?.hunyuan || {}),
      },
      app: {
        ...DEFAULT_APP_CONFIG,
        ...((parsed as Record<string, unknown>)?.app || {}),
      } as AppDefaultsYamlConfig,
    }

    console.log('已加载配置文件:', configPath)
    return cachedConfig
  } catch (error) {
    console.warn('读取配置文件失败，使用默认配置:', error)
    cachedConfig = { cos: { ...DEFAULT_COS_CONFIG }, hunyuan: { ...DEFAULT_HUNYUAN_CONFIG }, app: { ...DEFAULT_APP_CONFIG } }
    return cachedConfig
  }
}

/**
 * 获取 COS 相关的 YAML 配置
 */
export function getCosYamlConfig(): CosYamlConfig {
  return loadAppConfig().cos
}

/**
 * 获取混元大模型相关的 YAML 配置
 */
export function getHunyuanYamlConfig(): HunyuanYamlConfig {
  return loadAppConfig().hunyuan
}

/**
 * 获取应用默认配置（storageMode、aiTitleEnabled、aiModels 等）
 */
export function getAppDefaultsConfig(): AppDefaultsYamlConfig {
  return loadAppConfig().app
}

/**
 * 清除配置缓存（配置文件变更后调用）
 */
export function clearConfigCache(): void {
  cachedConfig = null
}
