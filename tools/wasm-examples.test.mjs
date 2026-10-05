// An example is marked as running on WebAssembly exactly when
// example-tests/wasm-capable.txt lists it, and a snippet never is, so the
// embedded editor is only told to use WebAssembly for an example that has
// been run there.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'

import { wasmCapable, dataDirectory } from './wasm-capable.js'

const capable = wasmCapable()
const files = readdirSync(dataDirectory).filter(file => file.endsWith('.json'))

test('every example says whether it runs on WebAssembly', () => {
  for (const file of files) {
    const data = JSON.parse(readFileSync(new URL(file, dataDirectory), 'utf8'))

    assert.equal(typeof data.wasm, 'boolean', `${file} has no "wasm" flag`)
  }
})

test('the flag follows the list, and a snippet is never marked', () => {
  for (const file of files) {
    const data = JSON.parse(readFileSync(new URL(file, dataDirectory), 'utf8'))

    assert.equal(data.wasm, data.snippet !== true && capable.has(data.name), file)
  }
})

test('every listed example has data', () => {
  const names = new Set(files.map(file => file.replace(/\.json$/, '')))

  for (const name of capable) {
    assert.ok(names.has(name), `${name} is listed but has no example data`)
  }
})
