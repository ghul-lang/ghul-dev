# getting started

There are three ways to start writing ghūl: in the browser, in a GitHub Codespace, or on your own machine.

## in the browser

The [ghūl playground](https://ghul.dev/playground/) compiles and runs ghūl in your browser, with live errors, completion and hover as you type. You don't need to install anything. It is what runs the editable examples on this site, and its own menu offers complete programs to start from.

The [online REPL](https://ghul.dev/repl/) runs ghūl a submission at a time instead: each one runs as soon as it is complete, and what it defines stays available to the next.

## in a Codespace

The [ghūl scratchpad](https://github.com/ghul-lang/ghul-scratchpad) is a minimal one-file project: open it in a GitHub Codespace and it arrives with the .NET SDK, the compiler and the language extension ready to go. Paste any example from this site into `main.ghul`{:text} and `dotnet run`{:sh}. This needs only a GitHub account.

The [examples repository](https://github.com/ghul-lang/ghul-examples) works the same way, with fuller, runnable examples organised by topic.

Both repositories are configured as [dev containers](https://containers.dev), so the same ready-made environment also opens in VS Code with the Dev Containers extension, or in any other tool that supports them.

## on your own machine

There are two ways to work locally, and they match the targets. With the .NET SDK you build for .NET. Without it you build for WebAssembly or native executables with the `ghul`{:sh} command.

### with the .NET SDK

Install the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) and an editor, and get some ghūl code to start from: clone the scratchpad or the examples repository above, or start a project of your own from the [repository template](https://github.com/ghul-lang/ghul-repository-template). The compiler is pinned in each repository as a local .NET tool, so it arrives with the code: `dotnet tool restore`{:sh} fetches it. A ghūl project is a `.ghulproj`{:text} file built with `dotnet build`{:sh}.

The `ghul`{:sh} command runs a single `.ghul`{:text} file directly, or starts an interactive session, as [scripts, the REPL and notebooks](/scripts-and-repl) describes:

```sh
dotnet tool install -g ghul.cli
ghul repl
```

### without the .NET SDK

On Linux, x64 or arm64, a Raspberry Pi among them, one command installs `ghul`{:sh} as a native executable that needs nothing else:

```sh
curl -fsSL https://raw.githubusercontent.com/ghul-lang/ghul-cli/main/install.sh | sh
ghul new hello
cd hello
ghul run
```

The first build fetches the compiler and ghūl's libraries, and a Node.js to run the program if the machine has none. `ghul new --target llvm`{:sh} makes a project that builds a [native executable](/native) instead of a [WebAssembly](/webassembly) program. On macOS and Windows `ghul`{:sh} is installed as a .NET tool, so those need the SDK.

[Visual Studio Code](https://code.visualstudio.com) with the [ghūl language extension](https://marketplace.visualstudio.com/items?itemName=degory.ghul) gives you errors and warnings as you type, completion, hover, go to definition, rename and formatting. Any editor that can install VS Code extensions gets the same support; other editors can drive the underlying language server directly - see [other editors](/tooling.html#other-editors) on the tooling page.

::: info the first few seconds
When you first open a project you'll see "loading" on hover and completion, and the ghūl icon in the status bar shows what's happening: the extension restores the project's NuGet packages, builds it, and starts the compiler in analysis mode, which reads the whole project before it can answer. Even a small project takes a few seconds. Once it's up, analysis is incremental - hover, completion and diagnostics respond in a few milliseconds even on a large project.
:::

::: tip ligatures
ghūl reads best in a font with programming ligatures, which draw operators such as `=~`, `=>` and `|>` as single glyphs. Set the editor font to one that provides them, such as [Fira Code](https://github.com/tonsky/FiraCode), and turn ligatures on:

```json
"editor.fontFamily": "Fira Code",
"editor.fontLigatures": true
```
:::

## it's all ordinary .NET

A ghūl project is a normal .NET SDK project. In each repository above you'll find a `.ghulproj`{:text} - an MSBuild project file with the usual things in it - and the normal `dotnet`{:text} commands work as you'd expect:

```sh
dotnet build
dotnet run
dotnet test
dotnet pack
```

A ghūl project can reference NuGet packages, produce libraries or executables, and be packed and published exactly like a C# project.

To set up a project from scratch, or for more on the template, see [creating a project](/tooling.html#creating-a-project) on the tooling page.
