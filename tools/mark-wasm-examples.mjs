// Records in each example's data whether it runs on WebAssembly: `"wasm": true`
// for an example example-tests/wasm-capable.txt lists, false for every other,
// and false for a snippet, which never runs. tools/wasm-examples.sh writes the
// list. Only the one line changes, so the rest of each file stays as the
// example tool wrote it.
//
// usage: node tools/mark-wasm-examples.mjs

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

import { wasmCapable, dataDirectory } from './wasm-capable.js'

const capable = wasmCapable()

let marked = 0

for (const file of readdirSync(dataDirectory)) {
  if (!file.endsWith('.json')) continue

  const path = new URL(file, dataDirectory)
  const text = readFileSync(path, 'utf8')
  const data = JSON.parse(text)
  const wasm = data.snippet !== true && capable.has(data.name)

  const without = text.replace(/^  "wasm": (true|false),\n/m, '')
  const updated = without.replace(/^(  "snippet": (true|false),\n)/m, `$1  "wasm": ${wasm},\n`)

  if (updated === without) {
    throw new Error(`${file}: no "snippet" line to mark after`)
  }

  if (updated !== text) {
    writeFileSync(path, updated)
  }

  if (wasm) marked++
}

console.log(`${marked} examples marked as running on WebAssembly`)
