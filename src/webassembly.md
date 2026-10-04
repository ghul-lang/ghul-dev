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

A WebAssembly program is a project: a directory holding a `ghul-project.json`{:text} manifest that names the project, its targets and its sources. In an empty directory, write the manifest:

```json
{
    "name": "hello",
    "kind": "program",
    "targets": ["dotnet", "wasm"],
    "sources": ["src/**/*.ghul"]
}
```

and the program, as `src/hello.ghul`{:text}:

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

## the same program on .NET

The program above is ordinary ghūl, and the `dotnet` target builds it into an ordinary .NET executable. On WebAssembly there is no .NET base class library, so the members of the built-in types and the rest of `Ghul`{:text} come from libraries compiled into the module from source: [ghul-core](https://github.com/ghul-lang/ghul-core) and [ghul-runtime](https://github.com/ghul-lang/ghul-runtime). A program that calls .NET APIs directly builds only for the `dotnet` target.
