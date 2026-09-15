export default {
  command: 'thumbnail',
  alias: ['thumb', 'linkpreview'],
  category: 'media',
  description: 'Mengirim link preview dengan custom thumbnail gambar',

  async execute(m, { sock, args }) {

    const target = m.quoted?.isMedia ? m.quoted : m.isMedia ? m : null
    const url = args[0] || 'https://github.com/slowlyh/SlowlyBase'
    const title = args.slice(1).join(' ') || 'SlowlyBase WhatsApp Bot'

    if (!target) {
      return m.reply('❌ Reply gambar dengan caption `.thumbnail <url> [judul]` untuk membuat link preview!')
    }

    await m.reply('⏳ Mengupload thumbnail ke WhatsApp...')

    try {
      const buffer = await target.download()
      await sock.sendThumbnail(m.chat, {
        thumbnail: buffer,
        url,
        title,
        body: 'Powered by SlowlyBase & zapo-js',
        text: 'Buka tautan ini untuk informasi lebih lanjut.',
        quote: m.raw
      })
    } catch (err) {
      m.reply(`❌ Gagal mengirim thumbnail preview: ${err.message}`)
    }
  }
}
