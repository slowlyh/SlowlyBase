import os from 'os'
import { formatRuntime } from '../../src/utils.js'

export default {
  command: 'menu',
  alias: ['help', 'list', 'allmenu'],
  category: 'main',
  description: 'Menampilkan daftar menu dan perintah bot',

  async execute(m, { config, prefix, pluginList }) {
    const uptime = formatRuntime(process.uptime())
    const totalCommands = pluginList?.length || 0

    const categories = {}
    for (const item of (pluginList || [])) {
      const cat = item.category || 'other'
      if (!categories[cat]) categories[cat] = []
      categories[cat].push(item.command)
    }

    let menuText = `┌─── ⚡ *${config.botName.toUpperCase()}* ⚡ ───
│ 👤 *User:* ${m.pushName}
│ 👑 *Owner:* ${config.ownerName}
│ ⏳ *Uptime:* ${uptime}
│ ⌨️ *Prefix:* [ ${config.prefixes.join(' ')} ]
│ 📊 *Total Fitur:* ${totalCommands} Perintah
└───────────────────────\n\n`

    const categoryTitles = {
      main: '🏠 MENU UTAMA',
      group: '👥 MENU GRUP',
      media: '🎨 MENU MEDIA',
      owner: '👑 MENU OWNER',
      tools: '🛠️ MENU TOOLS'
    }

    for (const [cat, commands] of Object.entries(categories)) {
      const title = categoryTitles[cat] || `📁 MENU ${cat.toUpperCase()}`
      menuText += `┌──『 *${title}* 』\n`
      for (const cmd of commands.sort()) {
        menuText += `│ • ${prefix}${cmd}\n`
      }
      menuText += `└────────────────────\n\n`
    }

    menuText += `_Ketik ${prefix}ping untuk tes kecepatan bot._`

    await m.reply(menuText)
  }
}
