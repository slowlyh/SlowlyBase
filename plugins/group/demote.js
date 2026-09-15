import { normalizeJid } from '../../src/utils.js'

export default {
  command: 'demote',
  alias: ['unadmin'],
  category: 'group',
  description: 'Menurunkan jabatan admin menjadi member biasa',
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
      return m.reply('❌ Tag atau reply pesan admin yang ingin diturunkan jabatannya!')
    }

    try {
      await sock.group.updateParticipants(m.chat, [normalizeJid(target)], 'demote')
      await m.reply(`✅ Berhasil menurunkan jabatan @${target.split('@')[0]} menjadi Member biasa!`, {
        mentions: [target]
      })
    } catch (err) {
      m.reply(`❌ Gagal demote member: ${err.message}`)
    }
  }
}
