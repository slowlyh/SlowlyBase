export default {
  command: 'linkgc',
  alias: ['linkgroup', 'grouplink'],
  category: 'group',
  description: 'Mendapatkan link undangan grup WhatsApp',
  groupOnly: true,
  botAdminOnly: true,

  async execute(m, { sock }) {
    try {
      const code = await sock.group.getInviteCode(m.chat)
      const link = `https://chat.whatsapp.com/${code}`
      await m.reply(`🔗 *Link Undangan Grup:*\n${link}`)
    } catch (err) {
      m.reply(`❌ Gagal mengambil link grup: ${err.message}`)
    }
  }
}
