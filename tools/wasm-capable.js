// Where the list of examples that run on WebAssembly lives, and where the
// example data that records it does.

import { readFileSync } from 'node:fs'

export const dataDirectory = new URL('../src/.vitepress/example-data/', import.meta.url)

const listFile = new URL('../example-tests/wasm-capable.txt', import.meta.url)

// The names example-tests/wasm-capable.txt lists.
export function wasmCapable() {
  return new Set(
    readFileSync(listFile, 'utf8').split('\n').map(line => line.trim()).filter(line => line !== ''))
}
