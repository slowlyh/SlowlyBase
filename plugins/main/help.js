export default {
  command: 'help',
  alias: ['panduan', 'tutor'],
  category: 'main',
  description: 'Panduan penggunaan bot',

  async execute(m, { config, prefix }) {
    const text = `📖 *PANDUAN PENGGUNAAN BOT*

1. *Karakter Prefix:*
Gunakan salah satu dari prefix berikut di awal perintah:
*${config.prefixes.join(' ')}*
Contoh: *${prefix}menu* atau *${prefix}ping*

2. *Fitur Media:*
• Untuk mengubah audio ke Voice Note, kirim atau reply audio dengan pesan *${prefix}tovn*.
• Untuk memberi reaksi emoji, reply pesan dengan *${prefix}react <emoji>*.
• Untuk membuat link preview dengan gambar, reply gambar dengan *${prefix}thumbnail <url> [judul]*.

3. *Fitur Grup:*
• Buka/tutup grup: *${prefix}grupopen* / *${prefix}grupclose*
• Mention semua: *${prefix}hidetag [pesan]*
• Kick member: tag/reply lalu ketik *${prefix}kick*

4. *Fitur Owner:*
• Reload plugin: *${prefix}reload* (Hot-reload tanpa restart bot!)
• Ganti prefix: *${prefix}setprefix . # ! /*`

    await m.reply(text)
  }
}
