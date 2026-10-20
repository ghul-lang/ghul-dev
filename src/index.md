#  ghūl programming language

<img class="ghul-logo" src="/ghul-logo-draft.png" alt="ghūl programming language logo" />

ghūl (pronounced 'ghoul') is a statically typed programming language with three targets: .NET 10, [WebAssembly](/webassembly) and [native executables](/native) through LLVM. The [compiler](https://github.com/ghul-lang/ghul) is about 200,000 lines of ghūl, and compiles itself.

Every example on this site is a whole program. Press **edit & run**, change it, and run it in your browser.

<GhulExampleSwitcher
  names="fractal-tree,optionals-narrowing,expression-functional,fibonacci-generators,word-frequency"
  labels="drawing: a fractal tree,optionals: `T?` + narrowing,expression trees: union + pattern matching,fibonacci: generators + pipes,word frequency: maps + pipes"
/>

## choosing a target

The .NET target is the full one. A ghūl project is an ordinary .NET SDK project, ghūl code can use any .NET library and NuGet package, and other .NET languages can call it. It is the best choice for a real project today.

The WebAssembly and native targets need no .NET SDK. A WebAssembly program runs under Node.js, or in a browser that supports WasmGC, which is how the examples on this site run. A native program is a single statically linked executable for Linux on x64 or arm64. Both are built with the `ghul`{:sh} command, which installs without .NET on those two Linux platforms.

| | .NET | WebAssembly | native |
| --- | --- | --- | --- |
| build with | `dotnet build`{:sh} | `ghul build`{:sh} | `ghul build`{:sh} |
| runs on | the .NET 10 runtime | Node.js, or a browser | Linux x64 and arm64 |
| libraries | all of .NET and NuGet | ghūl's own libraries | ghūl's own libraries |
| calls into | any .NET API | functions the loading script supplies, with `@extern`{:text} | C, with `@extern`{:text} |

WebAssembly and native programs use ghūl's own libraries, [ghul-core](https://github.com/ghul-lang/ghul-core) and [ghul-runtime](https://github.com/ghul-lang/ghul-runtime), about 22,000 lines of ghūl, in place of .NET's. They build the compiler and run most of the [Rosetta Code](/rosetta/) solutions on this site, but they don't have everything. There are no regular expressions, no HTTP or sockets, no culture-aware formatting, and no `decimal`{:text} on WebAssembly, and a program can't call a library that already exists. A WebAssembly program can call JavaScript only through the functions the script that loads it supplies for its `@extern`{:text} declarations. [WebAssembly](/webassembly) and [native executables](/native) list what each target supports.

## where to go next

- [Rosetta Code](/rosetta/) - over a thousand tasks solved in ghūl, from one-liners to graphics and games, searchable and nearly all runnable here. The page opens on one picked at random.
- [the tour](/expression-oriented-programming) - the language a topic at a time, every example editable.
- [the online REPL](https://ghul.dev/repl/) - type ghūl a submission at a time and see each result, in your browser.
- [scripts, the REPL and notebooks](/scripts-and-repl) - run a `.ghul`{:text} file directly, or type ghūl into an interactive session or a notebook. No project needed.
- [getting started](/getting-started) - ghūl on your own machine, with the .NET SDK or without it.

## what is distinctive

- **[type narrowing](/type-narrowing)** - a value's type follows control flow. A null test, an `isa`, a union variant test or an `if let` narrows whatever was tested - a local, a field, or a whole member-access path - and the compiler keeps the narrowed type across any call it can show leaves the tested value unchanged.

- **[everything is an expression](/expression-oriented-programming)** - `if`, `case`, loops and blocks all yield values. A `for` loop that finds something evaluates to what it found.

- **[unions and pattern matching](/unions-and-pattern-matching)** - refutable patterns match by type and by value, and a `case` over a closed domain - a union, an enum, `bool`, a closed class hierarchy, a tuple of those - is checked for coverage.

- **keywords, not braces** - blocks open with a keyword and close with its mirror: `is` ... `si`, `if` ... `fi`, `do` ... `od`. No semicolons, except to put [two statements on one line](/grammar.html#statement-terminators).

The rest is what you would expect of a statically typed language: classes, structs, traits and generics, first-class functions and closures, generators and `async`/`await`. On .NET, ghūl produces ordinary assemblies and NuGet packages, and other .NET languages can call them.

The language is under active development: whatever the compiler accepts is the definitive reference.
