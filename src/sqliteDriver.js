import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const DEFAULT_PRAGMAS = ['journal_mode = WAL', 'synchronous = NORMAL', 'busy_timeout = 5000']
const STATEMENT_CACHE_LIMIT = 512

let cachedBackend = null

function loadNodeSqlite() {
  const mod = require('node:sqlite')
  if (!mod || typeof mod.DatabaseSync !== 'function') {
    throw new Error('DatabaseSync tidak tersedia')
  }
  return { kind: 'node:sqlite', Database: mod.DatabaseSync, spread: true }
}

function loadWasmSqlite() {
  const mod = require('node-sqlite3-wasm')
  const Database = mod?.Database ?? mod?.default?.Database
  if (typeof Database !== 'function') {
    throw new Error('export Database tidak ditemukan')
  }
  return { kind: 'node-sqlite3-wasm', Database, spread: false }
}

function resolveBackend() {
  if (cachedBackend) return cachedBackend

  const preferred = String(process.env.SLOWLYBASE_SQLITE_DRIVER || 'auto').toLowerCase()
  const loaders = preferred === 'wasm'
    ? [loadWasmSqlite]
    : preferred === 'node'
      ? [loadNodeSqlite]
      : [loadNodeSqlite, loadWasmSqlite]

  const failures = []

  for (const load of loaders) {
    try {
      cachedBackend = load()
      return cachedBackend
    } catch (err) {
      failures.push(`${load.name}: ${err?.message || err}`)
    }
  }

  throw new Error(
    `Tidak ada driver SQLite pure JavaScript yang tersedia (${failures.join('; ')}). ` +
    'Gunakan Node.js 22.5+ untuk node:sqlite, atau pastikan node-sqlite3-wasm terpasang.'
  )
}

export function getSqliteBackendKind() {
  return resolveBackend().kind
}

function normalizeValue(value) {
  if (value === undefined) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  return value
}

function normalizeParams(params) {
  if (params === undefined || params === null) return []
  if (!Array.isArray(params)) return [normalizeValue(params)]

  const values = new Array(params.length)
  for (let i = 0; i < params.length; i += 1) values[i] = normalizeValue(params[i])
  return values
}

function applyPragmas(handle, pragmas) {
  for (const pragma of pragmas) {
    try {
      handle.exec(`PRAGMA ${pragma}`)
    } catch {
      continue
    }
  }
}

export function openSqliteConnection(options = {}) {
  const filePath = options.path
  if (!filePath) throw new Error('openSqliteConnection membutuhkan parameter path')

  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
  }

  const backend = resolveBackend()
  const handle = new backend.Database(filePath)
  const pragmas = Array.isArray(options.pragmas) ? options.pragmas : DEFAULT_PRAGMAS
  applyPragmas(handle, pragmas)

  const statements = new Map()
  let closed = false
  let txDepth = 0
  let txTail = Promise.resolve()

  function ensureOpen() {
    if (closed) throw new Error('koneksi SQLite sudah ditutup')
  }

  function statementFor(sql) {
    ensureOpen()

    const cached = statements.get(sql)
    if (cached) return cached

    const prepared = handle.prepare(sql)

    if (statements.size >= STATEMENT_CACHE_LIMIT) {
      const oldestKey = statements.keys().next().value
      const oldest = statements.get(oldestKey)
      statements.delete(oldestKey)
      try {
        oldest?.finalize?.()
      } catch {
        statements.delete(oldestKey)
      }
    }

    statements.set(sql, prepared)
    return prepared
  }

  function exec(sql) {
    ensureOpen()
    handle.exec(sql)
  }

  function run(sql, params) {
    ensureOpen()
    const values = normalizeParams(params)
    const statement = statementFor(sql)
    return backend.spread ? statement.run(...values) : statement.run(values)
  }

  function get(sql, params) {
    ensureOpen()
    const values = normalizeParams(params)
    const statement = statementFor(sql)
    const row = backend.spread ? statement.get(...values) : statement.get(values)
    return row ?? null
  }

  function all(sql, params) {
    ensureOpen()
    const values = normalizeParams(params)
    const statement = statementFor(sql)
    const rows = backend.spread ? statement.all(...values) : statement.all(values)
    return Array.isArray(rows) ? rows : []
  }

  function runInTransaction(callback) {
    ensureOpen()

    if (txDepth > 0) {
      const nested = callback()
      if (nested && typeof nested.then === 'function') {
        throw new Error('callback transaksi SQLite harus sinkron')
      }
      return Promise.resolve(nested)
    }

    const previous = txTail
    let release
    txTail = new Promise((resolve) => {
      release = resolve
    })

    const queued = previous.then(() => {
      ensureOpen()
      handle.exec('BEGIN')
      txDepth += 1

      let result
      try {
        result = callback()
        if (result && typeof result.then === 'function') {
          throw new Error('callback transaksi SQLite harus sinkron')
        }
      } catch (err) {
        try {
          handle.exec('ROLLBACK')
        } catch {
          txDepth -= 1
        }
        txDepth -= 1
        throw err
      }

      handle.exec('COMMIT')
      txDepth -= 1
      return result
    })

    return queued.finally(() => release())
  }

  function close() {
    if (closed) return
    closed = true

    for (const statement of statements.values()) {
      try {
        statement?.finalize?.()
      } catch {
        continue
      }
    }
    statements.clear()

    try {
      handle.close()
    } catch {
      return
    }
  }

  return {
    driver: 'better-sqlite3',
    kind: backend.kind,
    exec,
    run,
    get,
    all,
    runInTransaction,
    transaction: runInTransaction,
    close
  }
}

export default {
  openSqliteConnection,
  getSqliteBackendKind
}
