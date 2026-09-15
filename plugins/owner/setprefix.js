import { updateConfig } from '../../config.js'

export default {
  command: 'setprefix',
  alias: ['prefix', 'addprefix'],
  category: 'owner',
  description: 'Mengubah daftar prefix bot',
  ownerOnly: true,

  async execute(m, { args, config }) {
    if (!args[0]) {
      return m.reply(`Prefix saat ini: [ ${config.prefixes.join(' ')} ]\nContoh penggunaan: .setprefix . # ! /`)
    }

    const newPrefixes = args.map(p => p.trim()).filter(Boolean)
    const success = updateConfig('prefixes', newPrefixes)

    if (success) {
      await m.reply(`✅ *Prefix Berhasil Diperbarui!*\nPrefix baru: [ ${newPrefixes.join(' ')} ]`)
    } else {
      await m.reply('❌ Gagal memperbarui prefix di config.js.')
    }
  }
}
