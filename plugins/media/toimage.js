import sharp from 'sharp'

export default {
  command: 'toimage',
  alias: ['toimg', 'stickertoimg'],
  category: 'media',
  description: 'Mengubah stiker atau media menjadi gambar JPEG',

  async execute(m, { sock }) {
    const target = m.quoted?.isMedia ? m.quoted : m.isMedia ? m : null

    if (!target) {
      return m.reply('❌ Reply stiker dengan caption `.toimage`!')
    }

    await m.reply('⏳ Mengunduh dan mengonversi media...')

    try {
      const buffer = await target.download()
      const converted = await sharp(buffer).jpeg().toBuffer()

      await sock.sendImage(m.chat, converted, '✅ Berhasil dikonversi menjadi gambar!', {
        quote: m.raw
      })
    } catch (err) {
      m.reply(`❌ Gagal konversi media: ${err.message}`)
    }
  }
}
