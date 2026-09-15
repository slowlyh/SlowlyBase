export default {
  command: 'shortlink',
  alias: ['shorturl', 'tinyurl', 'pendekkan'],
  category: 'tools',
  description: 'Memperpendek tautan panjang menggunakan TinyURL',

  async execute(m, { args }) {
    const url = args[0]
    if (!url || !/^https?:\/\//i.test(url)) {
      return m.reply('❌ Masukkan URL yang valid!\nContoh: .shortlink https://example.com/very-long-url')
    }

    try {
      const api = `https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`
      const res = await fetch(api)
      const shortUrl = await res.text()

      await m.reply(`✂️ *Link Berhasil Dipendekkan:*\n${shortUrl.trim()}`)
    } catch (err) {
      m.reply(`❌ Gagal memperpendek link: ${err.message}`)
    }
  }
}
