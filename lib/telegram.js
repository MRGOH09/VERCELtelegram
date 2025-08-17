import { sendTelegramMessage } from './helpers.js'

const DEFAULT_BATCH = parseInt(process.env.BATCH_SIZE || '25', 10)
const DEFAULT_SLEEP = parseInt(process.env.BATCH_SLEEP_MS || '1100', 10)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

export async function sendBatchMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    console.warn('sendBatchMessages: 空消息数组')
    return { sent: 0, failed: 0 }
  }

  const maxSend = process.env.MAX_SEND_PER_RUN ? parseInt(process.env.MAX_SEND_PER_RUN, 10) : null
  const slice = maxSend ? messages.slice(0, maxSend) : messages
  
  console.info(`[sendBatchMessages] 开始发送 ${slice.length} 条消息，批次大小: ${DEFAULT_BATCH}`)
  
  let sent = 0, failed = 0
  const startTime = Date.now()
  
  try {
    for (let i = 0; i < slice.length; i += DEFAULT_BATCH) {
      const batch = slice.slice(i, i + DEFAULT_BATCH)
      const batchNum = Math.floor(i / DEFAULT_BATCH) + 1
      
      console.info(`[sendBatchMessages] 处理批次 ${batchNum}/${Math.ceil(slice.length / DEFAULT_BATCH)}，消息数: ${batch.length}`)
      
      // 小并发（<=5）
      const chunks = []
      for (let j = 0; j < batch.length; j += 5) chunks.push(batch.slice(j, j + 5))
      
      for (const chunk of chunks) {
        const chunkStart = Date.now()
        const results = await Promise.allSettled(chunk.map(async m => {
          try { 
            await sendTelegramMessage(m.chat_id, m.text, { parse_mode: m.parse_mode })
            return { success: true, chat_id: m.chat_id }
          } catch (e) { 
            console.warn(`发送失败 [${m.chat_id}]:`, String(e?.message || e))
            return { success: false, chat_id: m.chat_id, error: e?.message || String(e) }
          }
        }))
        
        // 统计结果
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            sent += 1
          } else {
            failed += 1
          }
        }
        
        const chunkTime = Date.now() - chunkStart
        console.debug(`[sendBatchMessages] 批次 ${batchNum} 子块完成，耗时: ${chunkTime}ms，成功: ${results.filter(r => r.status === 'fulfilled' && r.value.success).length}`)
      }
      
      // 批次间延迟（最后一个批次不需要延迟）
      if (i + DEFAULT_BATCH < slice.length) {
        console.debug(`[sendBatchMessages] 批次 ${batchNum} 完成，等待 ${DEFAULT_SLEEP}ms`)
        await sleep(DEFAULT_SLEEP)
      }
    }
  } catch (e) {
    console.error('[sendBatchMessages] 批量发送异常:', e)
    // 继续处理已发送的消息统计
  }
  
  const totalTime = Date.now() - startTime
  const rate = totalTime > 0 ? Math.round((sent / totalTime) * 1000 * 100) / 100 : 0
  
  console.info(`[sendBatchMessages] 完成，总计: ${sent + failed}，成功: ${sent}，失败: ${failed}，耗时: ${totalTime}ms，速率: ${rate} 条/秒`)
  
  return { sent, failed, totalTime, rate }
}

