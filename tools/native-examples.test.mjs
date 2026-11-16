// An example is native exactly when its directory holds a ghul-project.json,
// the ghul-cli project the example tool builds it with for the llvm target.
// The embedded editor never opens a native example, so one is never also
// marked as running on WebAssembly.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

import { dataDirectory } from './wasm-capable.js'

const examples = new URL('../examples/', import.meta.url)
const files = readdirSync(dataDirectory).filter(file => file.endsWith('.json'))

const isNative = name => existsSync(new URL(`${name}/ghul-project.json`, examples))

test('an example is marked native exactly when it is a ghul-cli project', () => {
  for (const file of files) {
    const data = JSON.parse(readFileSync(new URL(file, dataDirectory), 'utf8'))

    assert.equal(data.native === true, data.snippet !== true && isNative(data.name), file)
  }
})

test('a native example is not marked as running on WebAssembly', () => {
  for (const file of files) {
    const data = JSON.parse(readFileSync(new URL(file, dataDirectory), 'utf8'))

    if (data.native === true) {
      assert.equal(data.wasm, false, file)
    }
  }
})

test('every native example is tested', () => {
  const tests = new URL('../native-example-tests/', import.meta.url)

  for (const name of readdirSync(examples)) {
    if (isNative(name)) {
      assert.ok(existsSync(new URL(`${name}/run.expected`, tests)), `${name} has no native-example-tests/${name}/run.expected`)
    }
  }
})
