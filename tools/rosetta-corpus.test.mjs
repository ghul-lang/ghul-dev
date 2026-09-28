// The Rosetta Code section reads its corpus from ghul-rosetta-code when a reader opens it, so the
// two decisions that used to be made by generating a page per task are now made in the browser:
// which task an address names, and which tasks a search leaves. Both are plain functions, and both
// are the kind of thing that is only found wrong by opening the site.

import { test } from 'node:test'
import assert from 'node:assert/strict'

import {
  taskSlugFromPath, corpusFromIndex, taskBySlug, matching, tagCounts, draw, addressOf,
  filterFromSearch, exampleName,
} from '../src/.vitepress/theme/rosetta-corpus.js'

const index = {
  version: 1,
  tags: { primes: 'prime numbers', graphics: 'draws a picture' },
  tasks: [
    {
      slug: '100-doors',
      title: '100 doors',
      url: 'https://rosettacode.org/wiki/100_doors',
      tags: ['puzzles'],
      interest: 2,
      playground: true,
      input: false,
      images: [],
      lines: 16,
      parts: [{ id: '100-doors', heading: null, source: 'tasks/100-doors/100-doors.ghul', playground: true }],
    },
    {
      slug: 'goldbachs-comet',
      title: "Goldbach's comet",
      url: 'https://rosettacode.org/wiki/Goldbach%27s_comet',
      tags: ['primes', 'graphics'],
      interest: 5,
      playground: true,
      input: false,
      images: ['tasks/goldbachs-comet/02-the-comet/comet.png.expected'],
      lines: 60,
      ahead_of_wiki: true,
      parts: [
        { id: 'goldbachs-comet/01-the-g-numbers', heading: 'The g numbers', source: 'tasks/goldbachs-comet/01-the-g-numbers/01-the-g-numbers.ghul', playground: true },
        { id: 'goldbachs-comet/02-the-comet', heading: 'The comet', source: 'tasks/goldbachs-comet/02-the-comet/02-the-comet.ghul', playground: true },
      ],
    },
    {
      slug: 'read-a-file',
      title: 'Read a file',
      url: 'https://rosettacode.org/wiki/Read_a_file',
      tags: ['files'],
      interest: 1,
      playground: false,
      input: true,
      images: [],
      lines: 12,
      parts: [{ id: 'read-a-file', heading: null, source: 'tasks/read-a-file/read-a-file.ghul', playground: false }],
    },
  ],
}

const corpus = corpusFromIndex(index)

test('a task address names its task, and the section itself names none', () => {
  assert.equal(taskSlugFromPath('/rosetta/goldbachs-comet'), 'goldbachs-comet')
  assert.equal(taskSlugFromPath('/rosetta/goldbachs-comet/'), 'goldbachs-comet')
  assert.equal(taskSlugFromPath('/rosetta/'), null)
  assert.equal(taskSlugFromPath('/rosetta/index.html'), null)
  assert.equal(taskSlugFromPath('/getting-started'), null)
  assert.equal(taskSlugFromPath('/rosetta/a/b'), null)
})

test('a task nothing solves is absent rather than an error', () => {
  assert.equal(taskBySlug(corpus, 'no-such-task'), null)
  assert.equal(taskBySlug(corpus, '100-doors').title, '100 doors')
})

test('every part carries where its source is and what to call it', () => {
  const parts = taskBySlug(corpus, 'goldbachs-comet').parts

  assert.equal(parts.length, 2)
  assert.equal(parts[0].name, 'rosetta-goldbachs-comet-01-the-g-numbers')
  assert.equal(parts[0].heading, 'The g numbers')
  assert.match(parts[0].source, /^https:\/\/raw\.githubusercontent\.com\/.*01-the-g-numbers\.ghul$/)
  assert.match(parts[0].unsupported, /01-the-g-numbers\/playground-unsupported$/)
  assert.equal(exampleName('a/b'), 'rosetta-a-b')
})

test('a task that draws or reads input says so, whatever shape the index gives it', () => {
  assert.equal(taskBySlug(corpus, 'goldbachs-comet').images, true)
  assert.equal(taskBySlug(corpus, '100-doors').images, false)
  assert.equal(taskBySlug(corpus, 'read-a-file').input, true)
  assert.equal(taskBySlug(corpus, 'read-a-file').playground, false)
})

test('only a task the index marks as ahead of the wiki says so', () => {
  assert.equal(taskBySlug(corpus, 'goldbachs-comet').aheadOfWiki, true)
  assert.equal(taskBySlug(corpus, '100-doors').aheadOfWiki, false)
})

test('a search matches a title or a tag, and every word has to match', () => {
  const titles = filter => matching(corpus, filter).map(task => task.title)

  assert.deepEqual(titles({ query: 'goldbach' }), ["Goldbach's comet"])
  assert.deepEqual(titles({ query: 'PRIMES' }), ["Goldbach's comet"])
  assert.deepEqual(titles({ query: 'doors' }), ['100 doors'])
  assert.deepEqual(titles({ query: 'goldbach doors' }), [])
  assert.equal(matching(corpus, {}).length, 3)
})

test('tags narrow together, and the runnable filter drops what a browser cannot run', () => {
  assert.deepEqual(matching(corpus, { tags: ['primes'] }).map(t => t.slug), ['goldbachs-comet'])
  assert.deepEqual(matching(corpus, { tags: ['primes', 'files'] }), [])
  assert.deepEqual(
    matching(corpus, { runnableOnly: true }).map(t => t.slug),
    ['100-doors', 'goldbachs-comet'])
})

test('the tag chips count only the tags in use, most used first', () => {
  assert.deepEqual(tagCounts(corpus), [['puzzles', 1], ['primes', 1], ['graphics', 1], ['files', 1]])
})

test('the random pick is weighted by interest and never repeats what is shown', () => {
  const tasks = matching(corpus, {})

  assert.equal(draw(tasks, null, () => 0.001).slug, '100-doors')
  assert.notEqual(draw(tasks, '100-doors', () => 0.001).slug, '100-doors')

  // The one task left is drawn however the number falls, rather than nothing being drawn.
  assert.equal(draw([tasks[0]], '100-doors', () => 0.999).slug, '100-doors')
  assert.equal(draw([], null), null)
})

test('a view has an address, and an address is a view', () => {
  assert.equal(addressOf({ slug: 'goldbachs-comet' }), '/rosetta/goldbachs-comet')
  assert.equal(addressOf({}), '/rosetta/')
  assert.equal(addressOf({ query: '  sort ' }), '/rosetta/?q=sort')

  const address = addressOf({ query: 'sort', tags: ['primes', 'graphics'] })

  assert.deepEqual(
    filterFromSearch(new URL(address, 'https://ghul.dev').search),
    { query: 'sort', tags: ['graphics', 'primes'] })

  assert.deepEqual(filterFromSearch(''), { query: '', tags: [] })
})
