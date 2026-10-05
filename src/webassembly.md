# WebAssembly

A ghūl program can be compiled to WebAssembly as well as to .NET. The compiler writes a WasmGC module and a small JavaScript loader beside it, and the program runs under [Node.js](https://nodejs.org) 22 or newer. The same source builds for either target.

::: warning work in progress
The WebAssembly target is new and doesn't yet compile the whole language. Small programs work today; the [WebAssembly epic](https://github.com/ghul-lang/ghul/issues/3177) lists what is supported and what is still to come.
:::

## installing

A WebAssembly build is driven by the `ghul`{:sh} command, the [`ghul.cli`{:text}](https://www.nuget.org/packages/ghul.cli) .NET tool, which needs the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) to install and run. Install it, then bring its compiler up to the latest release:

```sh
dotnet tool install -g ghul.cli
ghul install-compiler
```

`ghul`{:sh} builds with the newest compiler it has installed. Each compiler release adds to what the WebAssembly target compiles, so run `ghul install-compiler`{:sh} again to update. Running the result needs Node.js 22 or newer.

## hello world

A WebAssembly program is a project: a directory holding a `ghul-project.json`{:text} manifest that names the project, its targets and its sources. `ghul new`{:sh} creates one, here for both targets:

```sh
ghul new hello --target dotnet,wasm
cd hello
```

`--target`{:sh} takes `dotnet`{:text}, `wasm`{:text} or `dotnet,wasm`{:text}, and is `dotnet`{:text} when it is left out. The new directory holds the manifest:

```json
{
    "name": "hello",
    "kind": "program",
    "targets": ["dotnet", "wasm"],
    "sources": ["src/**/*.ghul"]
}
```

a `.gitignore`{:text} for the build output in `out/`{:text}, and the program, as `src/main.ghul`{:text}:

```ghul
use IO.Std.write_line

entry() is
    write_line("hello")
si
```

`ghul run`{:sh} builds the project into `out/<target>/`{:text} and runs it. The manifest lists two targets, so name the one to run:

```sh
ghul run --target wasm      # runs out/wasm/hello.mjs under Node.js
ghul run --target dotnet    # runs out/dotnet/hello.exe with dotnet
```

The first build installs the compiler if there isn't one, and fetches the libraries a WebAssembly build compiles in. Later builds reuse them. A project's sources don't get any implicit imports: each file uses what it calls, or starts with `use default` for `write_line`, the pipes and the collections.

`ghul build`{:sh} builds without running. The [ghul-cli README](https://github.com/ghul-lang/ghul-cli#projects) covers the manifest in full.

## what works today

With the latest compiler, a WebAssembly build compiles classes, structs, traits and unions, with virtual and trait calls, `case` over a union, generics, arrays, tuples, function values and closures, strings and string interpolation with alignment and formats, `bigint`, the scalar conversions such as `double(n)`, list comprehensions, slicing, `throw`, `try`, `catch` and `finally`, generators, reading standard input, and `for` loops over `0..n` and `1::n`.

Not yet:

- asynchronous functions and `await`
- `decimal`
- an interpolated number formatted other than by the standard formats `D`, `E`, `F`, `G`, `N`, `R` and `X` or a custom pattern of `0`, `#`, `.` and `,`, and an interpolated enum given any format
- files and directories. `File`, `Directory` and the readers and writers over a file compile, but act on an empty file system that cannot be changed: `exists` answers false, reading a file throws `IO.FileNotFoundException`, and creating, writing or deleting one throws `Ghul.NotSupportedException`. `Path` works as it does on .NET, and standard input and output are read and written as on .NET

The [WebAssembly epic](https://github.com/ghul-lang/ghul/issues/3177) tracks each of these. Run `ghul install-compiler`{:sh} to pick up each release as it adds to the list.

## the same program on .NET

The program above is ordinary ghūl, and the `dotnet` target builds it into an ordinary .NET executable. On WebAssembly there is no .NET base class library. What it supplies comes from two libraries compiled into the module from source: [ghul-core](https://github.com/ghul-lang/ghul-core), which gives the built-in types their members and declares the collections, and [ghul-runtime](https://github.com/ghul-lang/ghul-runtime), which supplies the pipes and the rest of `Ghul`{:text}. A program that calls .NET APIs directly builds only for the `dotnet` target, unless it keeps those calls to the `dotnet` build.

## code for one target

`@IF.dotnet()` written before a definition or a statement keeps it only in a `dotnet` build, and `@IF.wasm()` keeps it only in a `wasm` build. That gives each target a version of its own where they need to differ:

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

The same pragma works with names of your own, which the compiler's `--define <name>`{:sh} option turns on. A name nothing turns on is off, and `dotnet` and `wasm` are always decided by the target being built.

## errors you will see

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
