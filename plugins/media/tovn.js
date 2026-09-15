export default {
  command: 'tovn',
  alias: ['vn', 'ptt'],
  category: 'media',
  description: 'Mengirim atau mengubah audio/video menjadi Voice Note (PTT)',

  async execute(m, { sock }) {
    const target = m.quoted?.isMedia ? m.quoted : m.isMedia ? m : null

    if (!target) {
      return m.reply('❌ Reply atau kirim audio/video dengan caption `.tovn`!')
    }

    await m.reply('⏳ Mengunduh dan memproses voice note...')

    try {
      const buffer = await target.download()
      await sock.sendVoiceNote(m.chat, buffer, {
        quote: m.raw
      })
    } catch (err) {
      m.reply(`❌ Gagal mengubah menjadi Voice Note: ${err.message}`)
    }
  }
}
