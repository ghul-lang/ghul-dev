# WebAssembly

A ghūl program can be compiled to WebAssembly as well as to .NET. The compiler writes a WasmGC module and a small JavaScript loader beside it. The program runs under [Node.js](https://nodejs.org) 22.19 or later on the 22 line, 24.15 or later on the 24 line, or 25 or later, or in a browser that supports WasmGC. Node 23 cannot run it. The same source builds for the [native target](/native) as well.

::: warning work in progress
The WebAssembly target doesn't yet compile the whole language, and it has ghūl's own libraries in place of .NET's. [What works today](#what-works-today) lists what is missing. The [WebAssembly epic](https://github.com/ghul-lang/ghul/issues/3177) tracks it.
:::

## installing

A WebAssembly build is driven by the `ghul`{:sh} command. On Linux, x64 or arm64, it installs without .NET:

```sh
curl -fsSL https://raw.githubusercontent.com/ghul-lang/ghul-cli/main/install.sh | sh
```

Anywhere the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) is installed, it is also the [`ghul.cli`{:text}](https://www.nuget.org/packages/ghul.cli) .NET tool, and macOS and Windows need that route:

```sh
dotnet tool install -g ghul.cli
```

`ghul`{:sh} fetches its compiler the first time it builds, and `ghul install compiler`{:sh} fetches it ahead of time. Tools are always the newest release: `ghul update`{:sh} brings `ghul`{:sh}, the compiler and Node.js up to date. Running the result needs one of the Node.js releases above. `ghul install node`{:sh} fetches one, and `ghul run`{:sh} says so when the Node.js it finds is older.

## hello world

A WebAssembly program is a project: a directory holding a `ghul-project.json`{:text} manifest that names the project, its targets and its sources. `ghul new`{:sh} creates one, and WebAssembly is its default target:

```sh
ghul new hello
cd hello
```

The new directory holds the manifest:

```json
{
    "name": "hello",
    "kind": "program",
    "targets": ["wasm"],
    "sources": ["src/**/*.ghul"],
    "tools": { "compiler": ">=66.11.0" },
    "dependencies": {
        "ghul-core": { "version": ">=1.0.0" },
        "ghul-runtime": { "version": ">=29.1.1" }
    }
}
```

a `.gitignore`{:text} for the build output in `out/`{:text}, and the program, as `src/main.ghul`{:text}:

```ghul
use IO.Std.write_line

entry() is
    write_line("hello")
si
```

The manifest declares the two libraries a WebAssembly build compiles in. Each takes a version range: `>=`{:text} is a floor that admits newer releases, `^1.0.0`{:text} stays within version 1, and a bare `1.0.0`{:text} is exactly that release. `ghul new`{:sh} writes the releases in use when it ran as floors.

`ghul run`{:sh} builds the project into `out/wasm/`{:text} and runs it:

```sh
ghul run      # runs out/wasm/hello.mjs under Node.js
```

The first build installs the compiler if there isn't one, and fetches the libraries. Later builds reuse them. A project's sources don't get any implicit imports: each file uses what it calls, or starts with `use default` for `write_line`, the pipes and the collections.

`ghul build`{:sh} builds without running. The [ghul-cli README](https://github.com/ghul-lang/ghul-cli#projects) covers the manifest in full.

## what works today

With the latest compiler, a WebAssembly build compiles classes, structs, traits and unions, with virtual and trait calls, `case` over a union, generics, arrays, tuples, function values and closures, strings and string interpolation with alignment and formats, `bigint`, the scalar conversions such as `double(n)`, list comprehensions, slicing, `throw`, `try`, `catch` and `finally`, generators, asynchronous functions and `await`, reading standard input, and `for` loops over ranges.

Not yet:

- `decimal`
- an interpolated number formatted other than by the standard formats `D`, `E`, `F`, `G`, `N`, `R` and `X` or a custom pattern of `0`, `#`, `.` and `,`, and an interpolated enum given any format
- reflection beyond a subset: a program that reflects on its types is built with `--rtti`{:sh}, and without it reflection throws `NotSupportedException`

There are no .NET libraries: no regular expressions, no HTTP or sockets, no culture-aware formatting. The libraries are ghūl's own, and a program can't call another library that already exists. A program run by Node reads and writes the real file system. In a browser there is no file system to reach, so `File` and `Directory` work on one held in memory, which starts empty. A program can call JavaScript only through `@extern`{:text}: each function it declares is looked up in the `externs`{:text} object the script that loads the module passes to the loader's `run`{:text}, and a program that declares one the script doesn't supply fails to start.

The [WebAssembly epic](https://github.com/ghul-lang/ghul/issues/3177) tracks what is still to come. Run `ghul update`{:sh} to pick up each release as it adds to the list.

An exception nothing catches ends the program with `Unhandled exception.`, its type and its message. A build with `--debug` also lists the functions the exception was thrown through, innermost first, one per line: `ghul run --target wasm --debug`{:sh}. Without `--debug` a throw costs much less and the report has no frames. An error the WebAssembly engine raises itself, such as dividing an integer by zero, lists its frames either way.

## the same program on .NET

The program above is ordinary ghūl, and the .NET target builds it into an ordinary .NET executable, with the .NET SDK and a `.ghulproj`{:text} project rather than `ghul`{:sh}. On WebAssembly there is no .NET base class library. What it supplies comes from two libraries compiled into the module from source: [ghul-core](https://github.com/ghul-lang/ghul-core), which gives the built-in types their members and declares the collections, and [ghul-runtime](https://github.com/ghul-lang/ghul-runtime), which supplies the pipes and the rest of `Ghul`{:text}. A program that calls .NET APIs directly builds only for .NET, unless it keeps those calls to the .NET build.

Strings, numbers and dates behave as they do in a .NET program configured for invariant globalization: strings compare and sort by UTF-16 code unit, and numbers and dates format the same way whatever the culture of the machine. A .NET program gets the same behaviour by setting `<InvariantGlobalization>true</InvariantGlobalization>` in its project.

## code for one target

`@IF.dotnet()` written before a definition or a statement keeps it only in a .NET build, `@IF.wasm()` keeps it only in a `wasm` build, and `@IF.llvm()` keeps it only in a [native](/native) build. That gives each target a version of its own where they need to differ:

```ghul
use IO.Std.write_line

entry() is
    write_line(target_name())

    @IF.wasm()
    write_line("a statement kept only for wasm")
si

@IF.dotnet()
target_name() -> string => "dotnet"

@IF.wasm()
target_name() -> string => "wasm"
```

`@IF.not.wasm()` keeps what it marks everywhere except a `wasm` build. Whatever a build leaves out is never compiled, so a `@IF.dotnet()` declaration can call a .NET API the `wasm` target doesn't have. To leave a whole file out of one target, mark its namespace.

The same pragma works with names of your own, which the compiler's `--define <name>`{:sh} option turns on. A name nothing turns on is off, and `dotnet`, `wasm` and `llvm` are always decided by the target being built.

## errors you may see

A .NET API the core library doesn't declare doesn't exist on WebAssembly, so a call to one is reported the way any other missing name is:

```text
main.ghul: 11,23..11,34: error: member Environment not found in System
```

Something the WebAssembly target can't support at all is reported where it's written, such as a pointer type or an `IL.`{:text} pragma:

```text
main.ghul: 20,15..20,22: error: pointer types not supported on the wasm target
main.ghul: 4,6..4,13: error: pragma IL.name not supported on the wasm target
```

Something the target will support but can't compile yet is reported at the function holding it:

```text
main.ghul: 3,1..3,6: error: code generation for a decimal literal is not supported on the wasm target
```
