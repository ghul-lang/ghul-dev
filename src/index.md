#  ghūl programming language

<img class="ghul-logo" src="/ghul-logo-draft.png" alt="ghūl programming language logo" />

ghūl (pronounced 'ghoul') is a statically typed programming language for .NET 10, with experimental [WebAssembly](/webassembly) and [native](/native) targets. The [compiler](https://github.com/ghul-lang/ghul) is about 120,000 lines of ghūl, and compiles itself.

Every example on this site is a whole program. Press **edit & run**, change it, and run it in your browser.

<GhulExampleSwitcher
  names="fractal-tree,optionals-narrowing,expression-functional,fibonacci-generators,word-frequency"
  labels="drawing: a fractal tree,optionals: `T?` + narrowing,expression trees: union + pattern matching,fibonacci: generators + pipes,word frequency: maps + pipes"
/>

## where to go next

- [Rosetta Code](/rosetta/) - several hundred tasks solved in ghūl, from one-liners to graphics and games, searchable and nearly all runnable here. The page opens on one picked at random.
- [the tour](/expression-oriented-programming) - the language a topic at a time, every example editable.
- [the online REPL](https://ghul.dev/repl/) - type ghūl a submission at a time and see each result, in your browser.
- [scripts, the REPL and notebooks](/scripts-and-repl) - run a `.ghul`{:text} file directly, or type ghūl into an interactive session or a notebook. No project needed.
- [getting started](/getting-started) - ghūl on your own machine. A ghūl repository pins the compiler as a local .NET tool, so the compiler arrives with the code.

## what is distinctive

- **[type narrowing](/type-narrowing)** - a value's type follows control flow. A null test, an `isa`, a union variant test or an `if let` narrows whatever was tested - a local, a field, or a whole member-access path - and the compiler keeps the narrowed type across any call it can show leaves the tested value unchanged.

- **[everything is an expression](/expression-oriented-programming)** - `if`, `case`, loops and blocks all yield values. A `for` loop that finds something evaluates to what it found.

- **[unions and pattern matching](/unions-and-pattern-matching)** - refutable patterns match by type and by value, and a `case` over a closed domain - a union, an enum, `bool`, a closed class hierarchy, a tuple of those - is checked for coverage.

- **keywords, not braces** - blocks open with a keyword and close with its mirror: `is` ... `si`, `if` ... `fi`, `do` ... `od`. No semicolons, except to put [two statements on one line](/grammar.html#statement-terminators).

The rest is what you would expect of a .NET language: classes, structs, traits and generics, first-class functions and closures, generators, `async`/`await`, and NuGet packages. ghūl produces ordinary assemblies and packages, and other .NET languages can call them.

The language is under active development: whatever the compiler accepts is the definitive reference.
