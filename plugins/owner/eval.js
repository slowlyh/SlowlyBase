import util from 'util'

export default {
  command: 'eval',
  alias: ['ev', 'e', '>'],
  category: 'owner',
  description: 'Mengevaluasi kode JavaScript secara langsung',
  ownerOnly: true,

  async execute(m, { sock, config, text }) {
    if (!text) return m.reply('❌ Masukkan kode JavaScript yang ingin dieksekusi!')

    let result
    try {

      const fn = new Function('m', 'sock', 'config', 'util', `return (async () => { ${text} })()`)
      result = await fn(m, sock, config, util)
      if (typeof result !== 'string') {
        result = util.inspect(result, { depth: 3, colors: false })
      }
    } catch (err) {
      result = err?.stack || err?.message || String(err)
    }

    await m.reply(String(result))
  }
}
