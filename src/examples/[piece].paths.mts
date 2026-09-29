import { EXAMPLE_PAGES, exampleMarkdown, examplesAside } from '../.vitepress/examples'

export default {
  paths() {
    return EXAMPLE_PAGES.map(page => ({
      params: { piece: page.slug, title: page.heading, aside: examplesAside(page) },
      content: exampleMarkdown(page, true),
    }))
  },
}
