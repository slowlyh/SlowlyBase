import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import chalk from 'chalk'
import chokidar from 'chokidar'

let isWatching = false
let watcherInstance = null

async function importFresh(filePath) {
  const nonce = Date.now()
  const fileUrl = `${pathToFileURL(filePath).href}?v=${nonce}`
  return import(fileUrl)
}

async function collectPlugins(dir, baseDir = dir, result = []) {
  if (!fs.existsSync(dir)) return result

  const entries = await fs.promises.readdir(dir, { withFileTypes: true })
  const category = path.relative(baseDir, dir) || 'main'

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      await collectPlugins(fullPath, baseDir, result)
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      try {
        const mod = await importFresh(fullPath)
        const plugin = mod?.default || mod

        if (plugin && typeof plugin.command === 'string' && typeof plugin.execute === 'function') {
          const rawAlias = plugin.alias || plugin.aliases
          const aliasList = Array.isArray(rawAlias)
            ? rawAlias
            : typeof rawAlias === 'string'
            ? [rawAlias]
            : []

          plugin.category = plugin.category || category
          plugin.filePath = fullPath
          plugin.fileName = entry.name

          result.push({
            command: plugin.command.toLowerCase().trim(),
            aliases: aliasList.map(a => String(a).toLowerCase().trim()).filter(Boolean),
            category: plugin.category,
            plugin,
            filePath: fullPath
          })
        }
      } catch (err) {
        console.error(chalk.red(`[PLUGINS] Gagal memuat file ${entry.name}:`), err?.message || err)
      }
    }
  }

  return result
}

export async function loadPlugins(pluginsDir) {
  const pluginList = await collectPlugins(pluginsDir)
  const registry = new Map()
  const categories = new Set()

  for (const item of pluginList) {
    registry.set(item.command, item.plugin)
    for (const alias of item.aliases) {
      registry.set(alias, item.plugin)
    }
    categories.add(item.category)
  }

  global.plugins = registry
  global.pluginList = pluginList

  console.log(
    chalk.greenBright(`[PLUGINS] Berhasil memuat ${chalk.bold(pluginList.length)} plugin dari ${chalk.bold(categories.size)} kategori.`)
  )

  return {
    registry,
    pluginList,
    total: pluginList.length,
    categories: Array.from(categories)
  }
}

export async function reloadPlugins(pluginsDir) {
  console.log(chalk.cyan('[PLUGINS] Mereload semua plugin...'))
  return loadPlugins(pluginsDir)
}

export function initPluginWatcher(pluginsDir) {
  if (isWatching) return

  watcherInstance = chokidar.watch(pluginsDir, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 250,
      pollInterval: 100
    }
  })

  watcherInstance
    .on('add', (filePath) => {
      if (!filePath.endsWith('.js')) return
      const relPath = path.relative(pluginsDir, filePath)
      console.log(chalk.yellow(`[PLUGINS] Plugin baru terdeteksi: ${chalk.bold(relPath)}, merefresh...`))
      loadPlugins(pluginsDir).catch(console.error)
    })
    .on('change', (filePath) => {
      if (!filePath.endsWith('.js')) return
      const relPath = path.relative(pluginsDir, filePath)
      console.log(chalk.cyan(`[PLUGINS] Perubahan terdeteksi: ${chalk.bold(relPath)}, hot-reloading...`))
      loadPlugins(pluginsDir).catch(console.error)
    })
    .on('unlink', (filePath) => {
      if (!filePath.endsWith('.js')) return
      const relPath = path.relative(pluginsDir, filePath)
      console.log(chalk.red(`[PLUGINS] Plugin dihapus: ${chalk.bold(relPath)}, merefresh...`))
      loadPlugins(pluginsDir).catch(console.error)
    })

  isWatching = true
  console.log(chalk.gray('[PLUGINS] Hot-reload file watcher aktif.'))
}

export default {
  loadPlugins,
  reloadPlugins,
  initPluginWatcher
}
