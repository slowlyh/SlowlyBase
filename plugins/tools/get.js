import { formatBytes } from '../../src/utils.js'

export default {
  command: 'get',
  alias: ['fetch'],
  category: 'tools',
  description: 'Mengambil konten dari URL (teks atau media)',

  async execute(m, { sock, args }) {
    const url = args[0]
    if (!url || !/^https?:\/\//i.test(url)) {
      return m.reply('❌ Masukkan URL yang valid dengan awalan http:// atau https://\nContoh: .get https://example.com')
    }

    await m.reply('⏳ Mengambil data dari URL...')

    try {
      const res = await fetch(url)
      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('application/json')) {
        const json = await res.json()
        return m.reply(JSON.stringify(json, null, 2).slice(0, 4000))
      }

      if (contentType.startsWith('text/')) {
        const text = await res.text()
        return m.reply(text.slice(0, 4000))
      }

      if (contentType.startsWith('image/')) {
        const buffer = Buffer.from(await res.arrayBuffer())
        return sock.sendImage(m.chat, buffer, `✓ ${url} (${formatBytes(buffer.length)})`, { quote: m.raw })
      }

      if (contentType.startsWith('audio/')) {
        const buffer = Buffer.from(await res.arrayBuffer())
        return sock.sendVoiceNote(m.chat, buffer, { quote: m.raw })
      }

      const buffer = Buffer.from(await res.arrayBuffer())
      const fileName = url.split('/').pop().split('?')[0] || 'download'
      return sock.sendDocument(m.chat, buffer, fileName, contentType, { quote: m.raw })

    } catch (err) {
      m.reply(`❌ Gagal mengambil data dari URL: ${err.message}`)
    }
  }
}
