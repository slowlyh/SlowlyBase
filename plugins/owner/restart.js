export default {
  command: 'restart',
  alias: ['reboot'],
  category: 'owner',
  description: 'Merestart proses bot',
  ownerOnly: true,

  async execute(m) {
    await m.reply('♻️ *Merestart bot...* Tunggu sebentar!')
    setTimeout(() => {
      process.exit(0)
    }, 1000)
  }
}
