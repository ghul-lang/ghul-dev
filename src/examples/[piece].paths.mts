import { EXAMPLE_PAGES, exampleMarkdown } from '../.vitepress/examples'

export default {
  paths() {
    return EXAMPLE_PAGES.map(page => ({
      params: { piece: page.slug, title: page.heading },
      content: exampleMarkdown(page, true),
    }))
  },
}
