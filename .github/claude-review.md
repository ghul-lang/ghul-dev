# Cloud code review brief

What this repository is, and what to watch for in it. Everything else - what PR
context is available, how to post a review, what makes a finding worth raising,
comment hygiene, PR-description shape, the versioning mechanism - comes from the
review workflow's runtime notes. Don't restate it here: this file is read first,
so a stale copy would silently override the current text.

Not loaded by local Claude Code; only the cloud reviewer reads this.

## What this repo is

`ghul-dev` is the ghul.dev website: a VitePress site whose pages are the
language's public documentation, with runnable ghūl in `<GhulExample/>` blocks.
`STYLE.md`, fetched from `ghul-lang/ghul-style`, is authoritative for prose here and
does most of the work for this brief - this is a prose-heavy repo.

The audience is someone deciding whether to use ghūl, so register matters as much
as accuracy.

## What to watch for here

- Prose that violates `STYLE.md`. Lead with the strongest evidence: the hard
  ban (`lambda` for a ghūl anonymous function); conditional bans (`binding` for
  a variable, `carry` where *have* would do, `may` only in the capability
  sense; `simply`/`just`/`easily`/`of course`/`obviously` only where the
  sentence reads the same without them); em-dash use; capitalised-first-letter
  comments; banner headings; marketing register; page-opening clichés
  (`In this guide...`, `Let's dive into...`); summary-style page closings.
- ghūl in `<GhulExample/>` blocks or inline backticks that is wrong, non-idiomatic,
  or would not compile. `GHUL.md` is the source of truth.
- Documentation drifting from current language behaviour - a page describing a
  rule the compiler no longer enforces is worse than no page.
- Broken internal links and `<GhulExample/>` references that will not resolve.

## Versioning

This repo publishes a website, not a package. Version bumps are not a concern
here.
