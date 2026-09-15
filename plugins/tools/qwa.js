export default {
  command: 'qwa',
  alias: ['walink', 'wameme'],
  category: 'tools',
  description: 'Membuat tautan langsung wa.me dengan pesan',

  async execute(m, { args }) {
    let number = args[0] ? args[0].replace(/\D/g, '') : ''
    let text = args.slice(1).join(' ')

    if (!number && m.quoted?.sender) {
      number = m.quoted.sender.split('@')[0]
      text = args.join(' ')
    }

    if (!number) {
      return m.reply('❌ Format salah!\nContoh: .qwa 62812345678 Halo saya ingin bertanya')
    }

    const encodedText = encodeURIComponent(text)
    const waLink = `https://wa.me/${number}${text ? `?text=${encodedText}` : ''}`

    await m.reply(`🔗 *WhatsApp Direct Link:*\n${waLink}`)
  }
}
