import chalk from 'chalk'
import { getContentType } from 'zapo-js'
import config from '../config.js'
import { normalizeJid, stripDeviceId, detectMimetype } from './utils.js'
import { trackContact } from './contactHandler.js'
import {
  getGroupMetadata,
  isAdminInGroup,
  isBotAdminInGroup,
  getCachedGroupMetadata
} from './groupHandler.js'

export function extractCommand(text) {
  if (!text || typeof text !== 'string') return { prefix: '', command: '', args: [], query: '' }

  const trimmed = text.trim()
  const matchedPrefix = config.prefixes.find((p) => trimmed.startsWith(p))

  if (matchedPrefix) {
    const afterPrefix = trimmed.slice(matchedPrefix.length).trim()
    const parts = afterPrefix.split(/\s+/)
    const command = parts[0]?.toLowerCase() || ''
    const args = parts.slice(1)
    const query = args.join(' ')
    return { prefix: matchedPrefix, command, args, query }
  }

  if (config.noPrefix) {
    const parts = trimmed.split(/\s+/)
    const command = parts[0]?.toLowerCase() || ''
    const args = parts.slice(1)
    const query = args.join(' ')
    return { prefix: '', command, args, query }
  }

  return { prefix: '', command: '', args: [], query: '' }
}

function serializeQuoted(contextInfo, chatJid, sock) {
  if (!contextInfo?.quotedMessage) return null

  const qMsg = contextInfo.quotedMessage
  const qType = getContentType(qMsg)
  const qContent = qMsg[qType]
  const sender = normalizeJid(contextInfo.participant || contextInfo.remoteJid)

  const text =
    qMsg.conversation ??
    qMsg.extendedTextMessage?.text ??
    qContent?.caption ??
    qContent?.text ??
    null

  const mime = qContent?.mimetype || ''

  return {
    id: contextInfo.stanzaId,
    chat: chatJid,
    sender,
    type: qType,
    text,
    body: text,
    isMedia: Boolean(mime),
    mimetype: mime,
    caption: qContent?.caption ?? null,
    download: async () => {
      if (typeof sock.message?.downloadBytes === 'function') {
        return sock.message.downloadBytes(qContent)
      }
      throw new Error('Metode downloadBytes tidak tersedia.')
    }
  }
}

export async function serializeMessage(event, sock) {
  if (!event?.message) return null

  const messageType = getContentType(event.message)
  if (!messageType) return null

  const msgContent = event.message[messageType]
  const chat = event.key?.remoteJid
  const isGroup = chat?.endsWith('@g.us') ?? false
  const sender = normalizeJid(isGroup ? event.key?.participant : chat)
  const senderNumber = sender ? sender.split('@')[0] : ''

  const ownerClean = config.ownerNumber.replace(/\D/g, '')
  const isOwner = senderNumber === ownerClean || event.key?.fromMe === true

  const text =
    event.message.conversation ??
    event.message.extendedTextMessage?.text ??
    msgContent?.caption ??
    msgContent?.text ??
    null

  const mime = msgContent?.mimetype || ''
  const contextInfo = event.message.extendedTextMessage?.contextInfo ?? msgContent?.contextInfo
  const { prefix, command, args, query } = extractCommand(text)

  const m = {
    raw: event,
    key: event.key,
    id: event.key?.id,
    chat,
    sender,
    senderNumber,
    pushName: event.pushName || 'Pengguna',
    isGroup,
    isOwner,
    isFromMe: event.key?.fromMe ?? false,

    type: messageType,
    text,
    body: text,
    isMedia: Boolean(mime),
    mimetype: mime,
    caption: msgContent?.caption ?? null,

    prefix,
    command,
    args,
    query,

    mentionedJid: contextInfo?.mentionedJid || [],
    quoted: serializeQuoted(contextInfo, chat, sock)
  }

  if (isGroup) {
    if (!getCachedGroupMetadata(chat)) {
      await getGroupMetadata(chat, sock).catch(() => null)
    }

    m.groupName = getCachedGroupMetadata(chat)?.subject || 'Grup'
    m.isAdmin = isAdminInGroup(chat, sender)
    m.isBotAdmin = isBotAdminInGroup(chat, sock)
  }

  m.reply = async (content, options = {}) => {
    let payload = content
    if (typeof content === 'string') {
      payload = { text: content }
    }

    const mentions = options.mentions || (typeof content === 'string' && /@\d+/.test(content) ? [sender] : [])

    return sock.message.send(chat, payload, {
      quote: event,
      ...(mentions.length ? { mentions } : {}),
      ...options
    })
  }

  m.react = (emoji) => sock.sendReact(chat, emoji, m.id)

  m.download = async () => {
    if (!m.isMedia) throw new Error('Pesan ini tidak berisi media.')
    if (typeof sock.message?.downloadBytes === 'function') {
      return sock.message.downloadBytes(msgContent)
    }
    throw new Error('Metode downloadBytes tidak tersedia pada client.')
  }

  return m
}

export function setupMessageHandler(sock) {
  sock.on('message', async (event) => {
    try {

      if (event.key?.remoteJid === 'status@broadcast') return

      const m = await serializeMessage(event, sock)
      if (!m) return

      trackContact(m.sender, m.pushName)

      if (config.logMessages) {
        const time = new Date().toLocaleTimeString('id-ID', { hour12: false })
        const chatType = m.isGroup ? chalk.yellow(`[GRUP: ${m.groupName}]`) : chalk.green('[PRIVATE]')
        const cmdBadge = m.command ? chalk.bgCyan.black(` ${m.prefix}${m.command} `) : chalk.gray('[TEXT]')
        console.log(
          `${chalk.gray(time)} ${chatType} ${chalk.bold(m.pushName)} (${chalk.cyan(m.senderNumber)}): ${cmdBadge} ${m.text ? chalk.white(m.text.slice(0, 80)) : ''}`
        )
      }

      if (!m.command) return

      const plugin = global.plugins?.get(m.command)
      if (!plugin) return

      if (config.selfMode && !m.isOwner) return

      if (plugin.ownerOnly && !m.isOwner) {
        return m.reply(config.pesan.ownerOnly)
      }

      if (plugin.groupOnly && !m.isGroup) {
        return m.reply(config.pesan.groupOnly)
      }

      if (plugin.privateOnly && m.isGroup) {
        return m.reply(config.pesan.privateOnly)
      }

      if (plugin.adminOnly && m.isGroup && !m.isAdmin && !m.isOwner) {
        return m.reply(config.pesan.adminOnly)
      }

      if (plugin.botAdminOnly && m.isGroup && !m.isBotAdmin) {
        return m.reply(config.pesan.botAdmin)
      }

      await plugin.execute(m, {
        sock,
        config,
        args: m.args,
        text: m.query,
        query: m.query,
        prefix: m.prefix,
        command: m.command,
        plugins: global.plugins,
        pluginList: global.pluginList
      })

    } catch (err) {
      console.error(chalk.red('[HANDLER ERROR]:'), err?.stack || err?.message || err)
      try {
        await sock.message.send(event.key.remoteJid, {
          text: `${config.pesan.error}\n\n*Error Detail:* ${err?.message || 'Unknown error'}`
        }, { quote: event })
      } catch (sendErr) {

      }
    }
  })
}

export default {
  extractCommand,
  serializeMessage,
  setupMessageHandler
}
