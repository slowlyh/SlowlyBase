import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import chalk from 'chalk'
import qrcode from 'qrcode-terminal'
import sharp from 'sharp'
import { createStore, WaClient } from 'zapo-js'
import { createSqliteStore } from '@zapo-js/store-sqlite'
import { createMediaProcessor } from '@zapo-js/media-utils'
import config from '../config.js'
import { openSqliteConnection, getSqliteBackendKind } from './sqliteDriver.js'
import { resolveToBuffer, detectMimetype, toBase64 } from './utils.js'

const PAIRING_REQUIRED_MESSAGE = 'client is not connected'

async function resolveDimensions(buffer) {
  try {
    const meta = await sharp(buffer).metadata()
    return { width: meta.width || 300, height: meta.height || 300 }
  } catch {
    return { width: 300, height: 300 }
  }
}

function normalizePhoneNumber(input) {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (digits.length <= 6) return ''
  return digits.replace(/^0+/, '')
}

export function attachSocketHelpers(sock) {
  sock.sendReact = async (jid, emoji, target) => {
    if (!target) return

    const reactionTarget = typeof target === 'string'
      ? { remoteJid: jid, id: target, fromMe: false }
      : target

    return sock.message.send(jid, {
      type: 'reaction',
      emoji,
      target: reactionTarget
    })
  }

  sock.sendVoiceNote = async (jid, input, options = {}) => {
    const { quote, mentions, ...rest } = options
    const quoteKey = quote?.raw ?? quote
    const buffer = await resolveToBuffer(input)

    return sock.message.send(jid, {
      type: 'audio',
      media: buffer,
      ptt: true,
      ...rest
    }, {
      ...(quoteKey ? { quote: quoteKey } : {}),
      ...(mentions ? { mentions } : {})
    })
  }

  sock.uploadThumbnail = async (image, options = {}) => {
    const { favicon = false, mimetype: mimetypeOverride } = options
    const buffer = await resolveToBuffer(image)
    const mimetype = mimetypeOverride || await detectMimetype(buffer)

    const [uploaded, dims] = await Promise.all([
      sock.message.upload(buffer, { type: 'thumbnail-link', mimetype }),
      resolveDimensions(buffer)
    ])

    const result = {
      thumbnailDirectPath: uploaded.directPath,
      thumbnailSha256: toBase64(uploaded.fileSha256),
      thumbnailEncSha256: toBase64(uploaded.fileEncSha256),
      mediaKey: toBase64(uploaded.mediaKey),
      mediaKeyTimestamp: uploaded.mediaKeyTimestamp,
      thumbnailWidth: dims.width,
      thumbnailHeight: dims.height,
      mimetype
    }

    if (uploaded.url) result.url = uploaded.url

    if (!favicon) {
      try {
        const jpeg = await sharp(buffer)
          .resize({ width: 120, withoutEnlargement: true })
          .jpeg({ quality: 40 })
          .toBuffer()
        result.jpegThumbnail = toBase64(jpeg)
      } catch (e) {
        console.warn('[THUMBNAIL] Gagal membuat jpegThumbnail kecil:', e.message)
      }
    }

    return result
  }

  sock.sendThumbnail = async (jid, options = {}) => {
    const { thumbnail, title, body, url, text, quote, ...rest } = options

    const cleanUrl = String(url || '').trim()
    if (!cleanUrl) throw new Error('sendThumbnail: URL parameter diperlukan.')

    let thumbMeta = {}
    if (thumbnail) {
      thumbMeta = await sock.uploadThumbnail(thumbnail)
    }

    const payload = {
      extendedTextMessage: {
        title: String(title || '').trim() || undefined,
        description: String(body || '').trim() || undefined,
        text: `${cleanUrl}${text ? `\n${String(text).trim()}` : ''}`,
        matchedText: cleanUrl,
        previewType: 0,
        ...thumbMeta
      }
    }

    const quoteKey = quote?.raw ?? quote
    return sock.message.send(jid, payload, {
      ...(quoteKey ? { quote: quoteKey } : {}),
      ...rest
    })
  }

  sock.sendImage = async (jid, input, caption = '', options = {}) => {
    const buffer = await resolveToBuffer(input)
    const mimetype = await detectMimetype(buffer)
    const { quote, mentions, ...rest } = options
    const quoteKey = quote?.raw ?? quote

    return sock.message.send(jid, {
      type: 'image',
      media: buffer,
      mimetype,
      caption,
      ...rest
    }, {
      ...(quoteKey ? { quote: quoteKey } : {}),
      ...(mentions ? { mentions } : {})
    })
  }

  sock.sendVideo = async (jid, input, caption = '', options = {}) => {
    const buffer = await resolveToBuffer(input)
    const mimetype = await detectMimetype(buffer)
    const { quote, mentions, ...rest } = options
    const quoteKey = quote?.raw ?? quote

    return sock.message.send(jid, {
      type: 'video',
      media: buffer,
      mimetype,
      caption,
      ...rest
    }, {
      ...(quoteKey ? { quote: quoteKey } : {}),
      ...(mentions ? { mentions } : {})
    })
  }

  sock.sendDocument = async (jid, input, fileName = 'file', mimetypeOverride = null, options = {}) => {
    const buffer = await resolveToBuffer(input)
    const mimetype = mimetypeOverride || await detectMimetype(buffer)
    const { quote, mentions, caption, ...rest } = options
    const quoteKey = quote?.raw ?? quote

    return sock.message.send(jid, {
      type: 'document',
      media: buffer,
      fileName,
      mimetype,
      caption,
      ...rest
    }, {
      ...(quoteKey ? { quote: quoteKey } : {}),
      ...(mentions ? { mentions } : {})
    })
  }

  return sock
}

export function isPairingRateLimitError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  if (!message) return false

  return (
    message.includes('rate-overlimit') ||
    message.includes('429') ||
    message.includes('resource-limit') ||
    message.includes('419') ||
    message.includes('limit') ||
    message.includes('too many')
  )
}

export function isPairingNotReadyError(error) {
  const message = String(error?.message || error || '').toLowerCase()
  return message.includes(PAIRING_REQUIRED_MESSAGE)
}

function createPairingController(sock) {
  let issued = false
  let inFlight = false
  let attemptCount = 0
  let lastAttemptAt = 0
  let issuedAt = 0

  const maxAttempts = Number.isFinite(config.pairingMaxRetries) ? config.pairingMaxRetries : 3
  const retryDelayMs = Number.isFinite(config.pairingRetryDelayMs) ? config.pairingRetryDelayMs : 15000
  const cooldownMs = Number.isFinite(config.pairingCooldownMs) ? config.pairingCooldownMs : 20000
  const codeTtlMs = Number.isFinite(config.pairingCodeTtlMs) ? config.pairingCodeTtlMs : 160000
  const notReadyDelayMs = Number.isFinite(config.pairingNotReadyDelayMs) ? config.pairingNotReadyDelayMs : 3000

  function formatCode(code) {
    return String(code || '').match(/.{1,4}/g)?.join('-') ?? code
  }

  function printCode(code) {
    const formatted = formatCode(code)
    console.log(chalk.bgMagenta.white.bold('\n  ┌─────────────────────────────────┐  '))
    console.log(chalk.bgMagenta.white.bold('  │         KODE PAIRING ANDA       │  '))
    console.log(chalk.bgBlack.greenBright.bold(`  │            ${formatted}         │  `))
    console.log(chalk.bgMagenta.white.bold('  └─────────────────────────────────┘  \n'))
    console.log(chalk.yellow('Buka WhatsApp di HP > Perangkat Tertaut > Tautkan dengan nomor telepon.\n'))
  }

  async function askPhoneNumber() {
    if (config.pairingNumber) return normalizePhoneNumber(config.pairingNumber)

    if (!process.stdin.isTTY) return ''

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    try {
      const answer = await new Promise((resolve) =>
        rl.question(chalk.cyan.bold('\n[PAIRING] Masukkan nomor WhatsApp bot (contoh 628xxx): '), resolve)
      )
      return normalizePhoneNumber(answer)
    } finally {
      rl.close()
    }
  }

  function resolveCustomCode() {
    if (!config.customPairing) return null

    const customCode = String(config.customPairing).trim().toUpperCase()
    if (customCode.length !== 8 || !/^[1-9A-HJ-NP-TV-Z]{8}$/.test(customCode)) {
      console.log(chalk.red.bold(`[PAIRING] Custom code "${customCode}" tidak valid, menggunakan kode acak.`))
      return null
    }
    return customCode
  }

  async function requestCode() {
    inFlight = true

    try {
      const phoneNumber = await askPhoneNumber()
      if (!phoneNumber) {
        console.log(chalk.yellow('[PAIRING] Nomor tidak tersedia, beralih menunggu scan QR...'))
        return
      }

      while (attemptCount < maxAttempts) {
        attemptCount += 1

        try {
          const customCode = resolveCustomCode()
          const code = customCode
            ? await sock.auth.requestPairingCode(phoneNumber, true, customCode)
            : await sock.auth.requestPairingCode(phoneNumber)

          issued = true
          issuedAt = Date.now()
          printCode(code)
          return
        } catch (err) {
          if (isPairingNotReadyError(err)) {
            const delay = notReadyDelayMs * attemptCount
            console.log(chalk.yellow(
              `[PAIRING] Koneksi belum siap (${err.message}). Mencoba lagi dalam ${Math.round(delay / 1000)} detik...`
            ))
            await new Promise((r) => setTimeout(r, delay))
            continue
          }

          if (isPairingRateLimitError(err)) {
            const delay = retryDelayMs * attemptCount
            console.log(chalk.red.bold(`[PAIRING] Ditolak server (limit/rate-limit): ${err.message}`))
            console.log(chalk.yellow(
              `[PAIRING] WhatsApp membatasi permintaan kode per nomor. Menunggu ${Math.round(delay / 1000)} detik...`
            ))
            console.log(chalk.gray(
              '[PAIRING] Tips: hapus perangkat tertaut yang tidak terpakai di HP, lalu coba lagi. Jika tetap gagal, tunggu 15-40 menit.'
            ))

            if (attemptCount < maxAttempts) {
              await new Promise((r) => setTimeout(r, delay))
              continue
            }

            console.log(chalk.yellow('[PAIRING] Batas percobaan tercapai. Bot menunggu QR/pairing ulang otomatis.'))
            return
          }

          console.error(chalk.red('[PAIRING] Gagal meminta kode pairing:'), err?.message || err)
          return
        }
      }
    } finally {
      inFlight = false
      lastAttemptAt = Date.now()
    }
  }

  return {
    request() {
      if (inFlight) return
      if (Date.now() - lastAttemptAt < cooldownMs) return
      if (issued && Date.now() - issuedAt < codeTtlMs) return
      void requestCode()
    },
    reset() {
      issued = false
      attemptCount = 0
      lastAttemptAt = 0
      issuedAt = 0
    }
  }
}

export function createConnection() {
  const sessionDir = path.dirname(config.sessionPath)
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true })
    console.log(chalk.gray(`[SESSION] Direktori "${sessionDir}" dibuat.`))
  }

  const connection = openSqliteConnection({
    path: config.sessionPath,
    pragmas: config.sqlitePragmas
  })

  console.log(chalk.gray(`[SESSION] Driver SQLite: ${getSqliteBackendKind()} (tanpa kompilasi binary).`))

  const store = createStore({
    backends: {
      sqlite: createSqliteStore({ connection })
    },
    providers: {
      auth: 'sqlite',
      signal: 'sqlite',
      preKey: 'sqlite',
      session: 'sqlite',
      identity: 'sqlite',
      senderKey: 'sqlite',
      appState: 'sqlite',
      privacyToken: 'sqlite',
      messages: 'none',
      threads: 'none',
      contacts: 'none'
    }
  })

  const silentLogger = {
    level: 'error',
    trace() {},
    debug() {},
    info() {},
    warn() {},
    error() {},
    child() { return silentLogger }
  }

  const sock = new WaClient(
    {
      store,
      sessionId: config.sessionId || 'default',
      recoverFromClientTooOld: true,
      deviceBrowser: config.deviceBrowser || 'Chrome',
      deviceOsDisplayName: config.deviceOsDisplayName || 'Windows',
      markOnlineOnConnect: false,
      media: {
        processor: createMediaProcessor(),
        generateThumbnail: true,
        generateWaveform: true,
        normalizeVoiceNote: true
      }
    },
    silentLogger
  )

  sock.sqliteConnection = connection
  sock.sqliteStore = store

  attachSocketHelpers(sock)

  return sock
}

export function setupConnectionHandler(sock) {
  let reconnectAttempts = 0
  let reconnectTimer = null
  let isStopped = false

  const maxReconnect = Number.isFinite(config.maxReconnectAttempts) ? config.maxReconnectAttempts : 10
  const pairing = createPairingController(sock)

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  }

  async function scheduleReconnect() {
    if (isStopped) return
    if (reconnectAttempts >= maxReconnect) {
      console.log(chalk.red.bold('[WA] Gagal reconnect setelah batas percobaan maksimal.'))
      return
    }

    reconnectAttempts += 1
    const delay = Math.min(30000, 2000 * 2 ** reconnectAttempts)

    console.log(chalk.yellow(
      `[WA] Mencoba menyambung kembali dalam ${Math.round(delay / 1000)} detik (percobaan ${reconnectAttempts}/${maxReconnect})...`
    ))

    clearReconnectTimer()
    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null
      if (isStopped) return
      try {
        await sock.connect()
      } catch (err) {
        console.error(chalk.red('[WA] Reconnect error:'), err?.message || err)
        void scheduleReconnect()
      }
    }, delay)
  }

  sock.on('connection', async (event) => {
    if (event.status === 'open') {
      reconnectAttempts = 0
      clearReconnectTimer()
      console.log(chalk.bgGreen.black.bold('\n  🚀 [SLOWLYBASE] BOT BERHASIL TERHUBUNG KE WHATSAPP!  \n'))
      return
    }

    if (event.isLogout) {
      isStopped = true
      clearReconnectTimer()
      pairing.reset()
      console.log(chalk.bgRed.white.bold('\n  ⚠️ [SLOWLYBASE] Sesi dikeluarkan dari WhatsApp! Perlu pairing ulang.  \n'))
      return
    }

    if (event.reason === 'client_disconnected') {
      isStopped = true
      clearReconnectTimer()
      return
    }

    console.log(chalk.yellow(`[WA] Koneksi terputus: ${event.reason || 'Network timeout'}`))
    await scheduleReconnect()
  })

  sock.on('auth_qr', ({ qr, ttlMs }) => {
    if (!config.usePairingCode) {
      console.log(chalk.cyan.bold('\n── SCAN QR CODE DI BAWAH INI ──'))
      qrcode.generate(qr, { small: true })
      console.log(chalk.gray(`(Berlaku ${Math.round(ttlMs / 1000)} detik)\n`))
    } else {
      pairing.request()
    }
  })

  sock.on('auth_pairing_required', () => {
    if (config.usePairingCode) pairing.request()
  })

  sock.on('auth_pairing_code', ({ code }) => {
    if (code) console.log(chalk.green(`[PAIRING] Kode aktif: ${code.match(/.{1,4}/g)?.join('-') ?? code}`))
  })

  sock.on('auth_paired', ({ credentials }) => {
    pairing.reset()
    console.log(chalk.green.bold(`\n✅ [AUTH] Berhasil terotentikasi sebagai ${chalk.yellow(credentials.meJid)}\n`))
  })

  sock.on('debug_client_error', ({ error }) => {
    console.error(chalk.red('[WA ERROR]:'), error?.message || error)
  })

  return sock
}

export default {
  createConnection,
  setupConnectionHandler,
  attachSocketHelpers,
  isPairingRateLimitError,
  isPairingNotReadyError
}
