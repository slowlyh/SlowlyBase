export default {
  command: 'ping',
  alias: ['p'],
  category: 'main',
  description: 'Mengecek kecepatan respon bot',

  async execute(m) {
    const start = performance.now()
    await m.react('⚡')
    const end = performance.now()
    const speed = (end - start).toFixed(2)

    await m.reply(`🏓 *Pong!*\nKecepatan respon: *${speed} ms*`)
  }
}
