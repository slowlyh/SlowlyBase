import path from 'node:path'
import config from '../config.js'
import { openSqliteConnection } from './sqliteDriver.js'

let db = null

const GROUP_SETTING_KEYS = new Set(['antilink', 'welcome', 'muted'])

export function initDatabase() {
  if (db) return db

  db = openSqliteConnection({
    path: config.databasePath,
    pragmas: config.sqlitePragmas
  })

  db.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      jid TEXT PRIMARY KEY,
      push_name TEXT,
      phone_number TEXT,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS groups (
      jid TEXT PRIMARY KEY,
      subject TEXT,
      antilink INTEGER DEFAULT 0,
      welcome INTEGER DEFAULT 0,
      muted INTEGER DEFAULT 0,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS bot_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `)

  return db
}

export function closeDatabase() {
  if (!db) return
  try {
    db.close()
  } catch {
    return
  } finally {
    db = null
  }
}

export function upsertContact(jid, pushName, phoneNumber = null) {
  if (!jid) return

  const database = initDatabase()
  const now = Math.floor(Date.now() / 1000)

  return database.run(`
    INSERT INTO contacts (jid, push_name, phone_number, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(jid) DO UPDATE SET
      push_name = COALESCE(excluded.push_name, contacts.push_name),
      phone_number = COALESCE(excluded.phone_number, contacts.phone_number),
      updated_at = excluded.updated_at
  `, [jid, pushName || null, phoneNumber || null, now])
}

export function getContact(jid) {
  if (!jid) return null
  const database = initDatabase()
  return database.get('SELECT * FROM contacts WHERE jid = ?', [jid])
}

export function upsertGroup(jid, subject, options = {}) {
  if (!jid) return

  const database = initDatabase()
  const now = Math.floor(Date.now() / 1000)

  return database.run(`
    INSERT INTO groups (jid, subject, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(jid) DO UPDATE SET
      subject = COALESCE(excluded.subject, groups.subject),
      updated_at = excluded.updated_at
  `, [jid, subject || null, now])
}

export function getGroup(jid) {
  if (!jid) return null
  const database = initDatabase()
  return database.get('SELECT * FROM groups WHERE jid = ?', [jid])
}

export function setGroupSetting(jid, settingKey, value) {
  if (!jid || !GROUP_SETTING_KEYS.has(settingKey)) return

  const database = initDatabase()
  const column = settingKey
  const now = Math.floor(Date.now() / 1000)

  database.run(
    'INSERT INTO groups (jid, updated_at) VALUES (?, ?) ON CONFLICT(jid) DO NOTHING',
    [jid, now]
  )

  return database.run(
    `UPDATE groups SET ${column} = ?, updated_at = ? WHERE jid = ?`,
    [value ? 1 : 0, now, jid]
  )
}

export function getSetting(key, fallback = null) {
  if (!key) return fallback
  const database = initDatabase()
  const row = database.get('SELECT value FROM bot_settings WHERE key = ?', [key])
  return row?.value ?? fallback
}

export function setSetting(key, value) {
  if (!key) return
  const database = initDatabase()
  return database.run(`
    INSERT INTO bot_settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `, [key, value === null || value === undefined ? null : String(value)])
}

export function resolveDatabasePath() {
  return path.resolve(config.databasePath)
}

export default {
  initDatabase,
  closeDatabase,
  upsertContact,
  getContact,
  upsertGroup,
  getGroup,
  setGroupSetting,
  getSetting,
  setSetting
}
