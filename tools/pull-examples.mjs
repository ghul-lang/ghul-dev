// Refreshes src/.vitepress/examples-index.json, the copy of ghul-examples' index the examples
// section is built from.
//
//   npm run pull-examples                 read the index ghul-examples publishes
//   npm run pull-examples -- <file>       read an index generated locally
//
// The copy is committed, so building the site does not depend on reaching GitHub, and a change
// to the examples reaches the site as a reviewable diff of this file.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const INDEX_URL = 'https://raw.githubusercontent.com/ghul-lang/ghul-examples/index/index.json'
const TARGET = fileURLToPath(new URL('../src/.vitepress/examples-index.json', import.meta.url))
const VERSION = 1

const argument = process.argv[2]

const text = argument
  ? readFileSync(argument, 'utf-8')
  : await fetch(INDEX_URL).then(response => {
      if (!response.ok) throw new Error(`${INDEX_URL}: ${response.status} ${response.statusText}`)
      return response.text()
    })

const index = JSON.parse(text)

if (index.version !== VERSION) {
  throw new Error(`index version ${index.version}; this site reads version ${VERSION}`)
}

for (const topic of index.topics) {
  for (const piece of topic.pieces) {
    if (typeof piece.source !== 'string' || typeof piece.output !== 'string') {
      throw new Error(`${piece.id}: the index is missing its source or its output`)
    }
  }
}

writeFileSync(TARGET, JSON.stringify(index, null, 2) + '\n')

const pieces = index.topics.reduce((count, topic) => count + topic.pieces.length, 0)
console.log(`${index.topics.length} topics, ${pieces} programs, from ${index.ref ?? 'main'}`)
