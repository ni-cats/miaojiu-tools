/**
 * 一次性脚本：将本地导航数据上传到 COS，并创建收藏目录
 * 使用方式：node scripts/sync-to-cos.js
 */
const COS = require('cos-nodejs-sdk-v5')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ===== 配置 =====
const BUCKET = 'miaojiu-tools-1327699824'
const REGION = 'ap-guangzhou'
const SECRET_ID = 'AKIDseCWaPzJPGsFNMHRM6bhaEeqmTv98sOg'
const SECRET_KEY = 'SvCxVqxpTs1vaQ1NVO2SeoqgNrY2HI4b'

// 获取设备 ID
const DEVICE_ID = execSync(
  "ioreg -d2 -c IOPlatformExpertDevice | awk -F'\"' '/IOPlatformUUID/{print $(NF-1)}'"
).toString().trim()
console.log('设备ID:', DEVICE_ID)

// 读取本地存储
const storePath = path.join(
  process.env.HOME,
  'Library/Application Support/clip-tool/clip-tool-data.json'
)
const storeData = JSON.parse(fs.readFileSync(storePath, 'utf-8'))

// 创建 COS 客户端
const cos = new COS({
  SecretId: SECRET_ID,
  SecretKey: SECRET_KEY,
})

// 上传文件到 COS
function uploadFile(key, data) {
  return new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        Body: JSON.stringify(data, null, 2),
      },
      (err, result) => {
        if (err) {
          console.error(`❌ 上传失败 [${key}]:`, err.message)
          reject(err)
        } else {
          console.log(`✅ 上传成功 [${key}]`)
          resolve(result)
        }
      }
    )
  })
}

async function main() {
  const quickLinks = storeData.quickLinks || []
  const snippets = storeData.snippets || []
  const favorites = snippets.filter(s => s.isFavorite)

  console.log(`\n📊 本地数据统计:`)
  console.log(`  - quickLinks: ${quickLinks.length} 条`)
  console.log(`  - 收藏内容: ${favorites.length} 条`)

  // 1. 上传导航数据到 launcher/ 目录
  console.log(`\n🚀 上传导航数据到 devices/${DEVICE_ID}/launcher/ ...`)
  await uploadFile(
    `devices/${DEVICE_ID}/launcher/quickLinks.json`,
    quickLinks
  )

  // 2. 创建收藏目录，并上传收藏内容
  console.log(`\n🚀 创建收藏目录 devices/${DEVICE_ID}/favorites/ ...`)

  if (favorites.length > 0) {
    // 每条收藏内容单独存储为一个文件
    for (const fav of favorites) {
      await uploadFile(
        `devices/${DEVICE_ID}/favorites/${fav.id}.json`,
        fav
      )
    }
  } else {
    // 没有收藏内容，上传一个空的索引文件来创建目录
    await uploadFile(
      `devices/${DEVICE_ID}/favorites/_index.json`,
      { created: new Date().toISOString(), description: '收藏内容目录' }
    )
  }

  console.log(`\n🎉 全部完成！COS 目录结构:`)
  console.log(`  devices/${DEVICE_ID}/`)
  console.log(`    ├── launcher/`)
  console.log(`    │   └── quickLinks.json (${quickLinks.length} 条)`)
  console.log(`    ├── favorites/`)
  if (favorites.length > 0) {
    favorites.forEach(f => {
      console.log(`    │   └── ${f.id}.json (${f.title})`)
    })
  } else {
    console.log(`    │   └── _index.json (空目录标记)`)
  }
  console.log(`    ├── settings/`)
  console.log(`    └── snippets/`)
}

main().catch(err => {
  console.error('执行失败:', err)
  process.exit(1)
})
