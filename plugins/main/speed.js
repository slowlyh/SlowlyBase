import os from 'os'
import { formatBytes, formatRuntime } from '../../src/utils.js'

export default {
  command: 'speed',
  alias: ['status', 'info', 'server'],
  category: 'main',
  description: 'Menampilkan informasi status server & bot',

  async execute(m) {
    const memory = process.memoryUsage()
    const totalMem = os.totalmem()
    const freeMem = os.freemem()
    const usedMem = totalMem - freeMem

    const text = `📊 *SYSTEM & BOT STATUS*

💻 *Platform:* ${os.platform()} (${os.arch()})
🖥️ *CPU:* ${os.cpus()[0]?.model || 'Generic CPU'} (${os.cpus().length} Core)
⏳ *Uptime Host:* ${formatRuntime(os.uptime())}
⌛ *Uptime Bot:* ${formatRuntime(process.uptime())}
📦 *Node Version:* ${process.version}

🧠 *Memory Usage:*
• RSS: *${formatBytes(memory.rss)}*
• Heap Used: *${formatBytes(memory.heapUsed)} / ${formatBytes(memory.heapTotal)}*
• RAM Host: *${formatBytes(usedMem)} / ${formatBytes(totalMem)}* (Free: ${formatBytes(freeMem)})`

    await m.reply(text)
  }
}
