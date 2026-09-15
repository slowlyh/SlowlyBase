import path from 'node:path'
import { fileURLToPath } from 'node:url'
import chalk from 'chalk'
import config from './config.js'
import { createConnection, setupConnectionHandler } from './src/connection.js'
import { setupMessageHandler } from './src/handler.js'
import { setupGroupHandler } from './src/groupHandler.js'
import { setupContactHandler } from './src/contactHandler.js'
import { loadPlugins, initPluginWatcher } from './src/pluginManager.js'
import { initDatabase, closeDatabase } from './src/database.js'
import { getSqliteBackendKind } from './src/sqliteDriver.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PLUGINS_DIR = path.join(__dirname, 'plugins')

console.log(chalk.cyan(`
┌─────────────────────────────────────────────────────────┐
│                   ⚡ SLOWLYBASE BOT ⚡                   │
│    Modular WhatsApp Bot · zapo-js · Pure-JS SQLite      │
└─────────────────────────────────────────────────────────┘
`))

process.on('uncaughtException', (err) => {
  console.error(chalk.red('[UNCAUGHT EXCEPTION]:'), err?.stack || err?.message || err)
})

process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('[UNHANDLED REJECTION]:'), reason)
})

let sock = null

async function startBot() {
  try {
    initDatabase()
    console.log(chalk.green(`✓ [DATABASE] SQLite siap (driver: ${getSqliteBackendKind()}).`))

    await loadPlugins(PLUGINS_DIR)
    initPluginWatcher(PLUGINS_DIR)

    sock = createConnection()

    setupConnectionHandler(sock)
    setupGroupHandler(sock)
    setupContactHandler(sock)
    setupMessageHandler(sock)

    console.log(chalk.yellow('[WA] Menghubungkan ke WhatsApp Web protocol...'))
    await sock.connect()

  } catch (err) {
    console.error(chalk.red('[FATAL] Gagal memulai bot:'), err?.stack || err?.message || err)
    process.exit(1)
  }
}

let isShuttingDown = false
async function handleShutdown(signal) {
  if (isShuttingDown) return
  isShuttingDown = true

  console.log(chalk.yellow(`\n[SHUTDOWN] Menerima sinyal ${signal}, menutup koneksi...`))
  try {
    if (sock) {
      await sock.disconnect?.()
      sock.sqliteStore?.destroy?.()
      sock.sqliteConnection?.close?.()
    }
  } catch {
    console.error(chalk.gray('[SHUTDOWN] Koneksi ditutup dengan peringatan.'))
  }
  closeDatabase()
  console.log(chalk.green('[SHUTDOWN] Selesai. Sampai jumpa!'))
  process.exit(0)
}

process.on('SIGINT', () => handleShutdown('SIGINT'))
process.on('SIGTERM', () => handleShutdown('SIGTERM'))

void startBot()
