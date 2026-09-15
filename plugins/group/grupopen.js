export default {
  command: 'grupopen',
  alias: ['buka', 'opengroup', 'bukagrup'],
  category: 'group',
  description: 'Membuka grup agar semua member dapat mengirim pesan',
  groupOnly: true,
  adminOnly: true,
  botAdminOnly: true,

  async execute(m, { sock }) {
    try {
      await sock.group.setSetting(m.chat, 'announcement', false)
      await m.reply('🔓 *Grup Dibuka!* Sekarang seluruh member dapat mengirim pesan.')
    } catch (err) {
      m.reply(`❌ Gagal membuka grup: ${err.message}`)
    }
  }
}
