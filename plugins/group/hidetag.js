import { getCachedGroupMetadata } from '../../src/groupHandler.js'

export default {
  command: 'hidetag',
  alias: ['ht', 'tagall', 'h'],
  category: 'group',
  description: 'Mention semua member grup dengan pesan tersembunyi',
  groupOnly: true,
  adminOnly: true,

  async execute(m, { query }) {
    const meta = getCachedGroupMetadata(m.chat)
    if (!meta || !meta.participants) {
      return m.reply('❌ Gagal membaca daftar peserta grup.')
    }

    const participants = meta.participants.map(p => p.jid)
    const pesan = query || (m.quoted?.text ? m.quoted.text : '📢 Pengumuman Penting!')

    await m.reply(pesan, {
      mentions: participants
    })
  }
}
