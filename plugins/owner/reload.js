import path from 'path'
import { fileURLToPath } from 'url'
import { reloadPlugins } from '../../src/pluginManager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PLUGINS_DIR = path.join(__dirname, '..', '..', 'plugins')

export default {
  command: 'reload',
  alias: ['refresh', 'rload'],
  category: 'owner',
  description: 'Reload seluruh plugin tanpa restart node process',
  ownerOnly: true,

  async execute(m) {
    const start = performance.now()
    await m.reply('⏳ Mereload seluruh plugin ke memory...')

    try {
      const res = await reloadPlugins(PLUGINS_DIR)
      const duration = (performance.now() - start).toFixed(2)

      await m.reply(
        `✅ *HOT RELOAD SUKSES!*\n\n` +
        `• Total Plugin: *${res.total}*\n` +
        `• Kategori: *${res.categories.join(', ')}*\n` +
        `• Waktu Reload: *${duration} ms*\n\n` +
        `_Semua fitur langsung aktif tanpa restart bot._`
      )
    } catch (err) {
      await m.reply(`❌ Gagal mereload plugin: ${err.message}`)
    }
  }
}
