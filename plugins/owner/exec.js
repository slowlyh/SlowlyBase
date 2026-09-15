import { exec } from 'child_process'
import util from 'util'

const execPromise = util.promisify(exec)

export default {
  command: 'exec',
  alias: ['$', 'sh', 'bash'],
  category: 'owner',
  description: 'Mengeksekusi perintah terminal shell',
  ownerOnly: true,

  async execute(m, { text }) {
    if (!text) return m.reply('❌ Masukkan perintah shell yang ingin dijalankan!')

    await m.reply('⏳ Menjalankan perintah...')

    try {
      const { stdout, stderr } = await execPromise(text, { timeout: 30000 })
      const output = stdout || stderr || '✓ (Selesai tanpa output)'
      await m.reply(output.trim())
    } catch (err) {
      await m.reply(`❌ *Error:*\n${err?.message || err}`)
    }
  }
}
