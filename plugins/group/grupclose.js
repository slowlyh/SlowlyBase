export default {
  command: 'grupclose',
  alias: ['tutup', 'closegroup', 'tutupgrup'],
  category: 'group',
  description: 'Menutup grup sehingga hanya admin yang dapat mengirim pesan',
  groupOnly: true,
  adminOnly: true,
  botAdminOnly: true,

  async execute(m, { sock }) {
    try {
      await sock.group.setSetting(m.chat, 'announcement', true)
      await m.reply('🔒 *Grup Ditutup!* Sekarang hanya Admin yang dapat mengirim pesan.')
    } catch (err) {
      m.reply(`❌ Gagal menutup grup: ${err.message}`)
    }
  }
}
