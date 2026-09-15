import { normalizeJid } from '../../src/utils.js'

export default {
  command: 'kick',
  alias: ['tendang', 'dor'],
  category: 'group',
  description: 'Mengeluarkan member dari grup',
  groupOnly: true,
  adminOnly: true,
  botAdminOnly: true,

  async execute(m, { sock, args }) {
    let target = null

    if (m.mentionedJid?.length > 0) {
      target = m.mentionedJid[0]
    } else if (m.quoted?.sender) {
      target = m.quoted.sender
    } else if (args[0]) {
      const cleanNum = args[0].replace(/\D/g, '')
      target = `${cleanNum}@s.whatsapp.net`
    }

    if (!target) {
      return m.reply('❌ Tag atau reply pesan member yang ingin dikeluarkan!')
    }

    try {
      await sock.group.updateParticipants(m.chat, [normalizeJid(target)], 'remove')
      await m.reply(`✅ Berhasil mengeluarkan @${target.split('@')[0]} dari grup!`, {
        mentions: [target]
      })
    } catch (err) {
      m.reply(`❌ Gagal mengeluarkan member: ${err.message}`)
    }
  }
}
