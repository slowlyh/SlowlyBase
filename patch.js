import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

console.log(`
┌──────────────────────────────────────────────┐
│       ZAPO-JS BOT COMPATIBILITY PATCH        │
└──────────────────────────────────────────────┘
`)

const targetFiles = [
  path.join(__dirname, 'node_modules/zapo-js/dist/esm/transport/node/builders/message.js'),
  path.join(__dirname, 'node_modules/zapo-js/dist/transport/node/builders/message.js')
]

const MARKER = '/* OVERRIDE_CUSTOM_NODES_PATCH */'
const regex = /if\s*\(\s*input\.customNodes\s*\)\s*\{\s*for\s*\(\s*const\s+node\s+of\s+input\.customNodes\s*\)\s*\{\s*content\.push\(\s*node\s*\);\s*\}\s*\}/

const patchReplacement = `${MARKER}
    if (input.customNodes) {
        for (const node of input.customNodes) {
            if (!node || !node.tag) continue;
            const existingIndex = content.findIndex(
                item => item && item.tag === node.tag
            );
            if (existingIndex !== -1) {
                content[existingIndex] = node;
            } else {
                content.push(node);
            }
        }
    }`

let patchedCount = 0

for (const file of targetFiles) {
  if (!fs.existsSync(file)) continue
  let content = fs.readFileSync(file, 'utf8')
  if (content.includes(MARKER)) continue
  if (regex.test(content)) {
    content = content.replace(regex, patchReplacement)
    fs.writeFileSync(file, content, 'utf8')
    patchedCount++
  }
}

const albumTargets = [
  ...['dist', 'dist/esm'].flatMap((base) => [
    path.join(__dirname, `node_modules/zapo-js/${base}/protocol/message.js`),
    path.join(__dirname, `node_modules/zapo-js/${base}/message/encode/content.js`)
  ])
]

const ALBUM_MARKER = '/* OVERRIDE_ALBUM_COLLECTION_PATCH */'
let albumPatched = 0

for (const file of albumTargets) {
  if (!fs.existsSync(file)) continue
  let content = fs.readFileSync(file, 'utf8')
  if (content.includes(ALBUM_MARKER)) continue

  const isEsm = file.includes('/esm/')
  const nsPrefix = isEsm ? '' : 'constants_1.'

  if (file.endsWith('protocol/message.js')) {
    const oldConstant = "GROUP_HISTORY: 'group_history'\n})"
    const newConstant = `GROUP_HISTORY: 'group_history',\n    ${ALBUM_MARKER}\n    COLLECTION: 'collection'\n})`
    if (content.includes(oldConstant)) {
      content = content.replace(oldConstant, newConstant)
      fs.writeFileSync(file, content, 'utf8')
      albumPatched++
    }
  } else {
    const indent = '    '
    const oldResolver = `${indent}if (msg.messageHistoryBundle)\n${indent}    return ${nsPrefix}WA_ENC_MEDIA_TYPES.GROUP_HISTORY;`
    const newResolver = `${indent}${ALBUM_MARKER}\n${indent}if (msg.albumMessage)\n${indent}    return ${nsPrefix}WA_ENC_MEDIA_TYPES.COLLECTION;\n${oldResolver}`
    if (content.includes(oldResolver)) {
      content = content.replace(oldResolver, newResolver)
      fs.writeFileSync(file, content, 'utf8')
      albumPatched++
    }
  }
}

console.log(`[PATCH] Custom Nodes: ${patchedCount} patched, Album: ${albumPatched} patched.\n`)
