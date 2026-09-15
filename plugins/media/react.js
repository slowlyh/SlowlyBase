export default {
  command: 'react',
  alias: ['r'],
  category: 'media',
  description: 'Memberikan reaksi emoji ke pesan',

  async execute(m, { sock, args }) {
    const emoji = args[0] || '👍'
    const targetId = m.quoted?.id || m.id

    try {
      await sock.sendReact(m.chat, emoji, targetId)
    } catch (err) {
      m.reply(`❌ Gagal memberikan reaksi: ${err.message}`)
    }
  }
}
