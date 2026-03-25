/**
 * COS 拉取测试脚本
 * 用法: node test-cos.js
 */
const COS = require('cos-nodejs-sdk-v5')

const config = {
  SecretId: 'AKIDvnQr68xa4LQI1XpvqcDJDyXzMcjgmiU8',
  SecretKey: 'b9b4ReeVBew1pRr46zis0682mQuCKJBt',
  Bucket: 'miaojiu-tools-1327699824',
  Region: 'ap-guangzhou',
}

const cos = new COS({
  SecretId: config.SecretId,
  SecretKey: config.SecretKey,
})

const targetKey = 'devices/9EF6F651-F153-54BA-A3B6-13DF2D5FC6AF/snippets/3BM3okr4uqKBVFtN3RQ94.json'

console.log('=== 测试1: headBucket 连接测试 ===')
cos.headBucket({
  Bucket: config.Bucket,
  Region: config.Region,
}, (err, data) => {
  if (err) {
    console.error('❌ 连接失败:', err.message || err.code)
    console.error('详细错误:', JSON.stringify(err, null, 2))
  } else {
    console.log('✅ 连接成功:', data.statusCode)
  }

  console.log('\n=== 测试2: 列出 snippets 目录 ===')
  const prefix = 'devices/9EF6F651-F153-54BA-A3B6-13DF2D5FC6AF/snippets/'
  cos.getBucket({
    Bucket: config.Bucket,
    Region: config.Region,
    Prefix: prefix,
    MaxKeys: 10,
  }, (err2, data2) => {
    if (err2) {
      console.error('❌ 列出文件失败:', err2.message || err2.code)
      console.error('详细错误:', JSON.stringify(err2, null, 2))
    } else {
      const files = (data2.Contents || []).map(item => item.Key)
      console.log(`✅ 找到 ${files.length} 个文件:`)
      files.forEach(f => console.log('  -', f))
    }

    console.log('\n=== 测试3: 直接下载目标片段 ===')
    console.log('Key:', targetKey)
    cos.getObject({
      Bucket: config.Bucket,
      Region: config.Region,
      Key: targetKey,
    }, (err3, data3) => {
      if (err3) {
        console.error('❌ 下载失败:', err3.message || err3.code)
        console.error('statusCode:', err3.statusCode)
        console.error('详细错误:', JSON.stringify(err3, null, 2))
      } else {
        console.log('✅ 下载成功')
        console.log('Body 类型:', typeof data3.Body)
        console.log('Body constructor:', data3.Body?.constructor?.name)
        console.log('Body 是否 Buffer:', Buffer.isBuffer(data3.Body))
        
        // 测试直接 as string 的问题
        console.log('\n--- 直接 JSON.parse(Body as string) 的结果 ---')
        try {
          const directResult = JSON.parse(data3.Body)
          console.log('✅ 直接解析成功:', typeof directResult)
          console.log('id:', directResult.id)
          console.log('title:', directResult.title)
        } catch (e) {
          console.error('❌ 直接解析失败:', e.message)
        }

        // 测试 toString 后的结果
        console.log('\n--- JSON.parse(Body.toString("utf-8")) 的结果 ---')
        try {
          const bodyStr = typeof data3.Body === 'string' ? data3.Body : Buffer.from(data3.Body).toString('utf-8')
          console.log('转换后字符串前200字符:', bodyStr.substring(0, 200))
          const result = JSON.parse(bodyStr)
          console.log('✅ toString 后解析成功:', typeof result)
          console.log('id:', result.id)
          console.log('title:', result.title)
          console.log('tags:', result.tags)
          console.log('type:', result.type)
        } catch (e) {
          console.error('❌ toString 后解析失败:', e.message)
        }
      }
    })
  })
})
