import { normalizeJid } from '../../src/utils.js'

export default {
  command: 'promote',
  alias: ['admin'],
  category: 'group',
  description: 'Menaikkan jabatan member menjadi admin grup',
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
      return m.reply('❌ Tag atau reply pesan member yang ingin dijadikan Admin!')
    }

    try {
      await sock.group.updateParticipants(m.chat, [normalizeJid(target)], 'promote')
      await m.reply(`✅ Berhasil menaikkan jabatan @${target.split('@')[0]} menjadi Admin grup!`, {
        mentions: [target]
      })
    } catch (err) {
      m.reply(`❌ Gagal promote member: ${err.message}`)
    }
  }
}
