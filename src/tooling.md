# tooling

ghūl has tooling for each of its three targets. For the .NET target the compiler is a .NET tool and a ghūl project is an ordinary .NET SDK project, so most of the tooling you already use for .NET applies directly, with a language extension on top for editing. For the WebAssembly and native targets, the `ghul`{:sh} command builds, runs and updates projects; the sections below that name MSBuild, `dotnet`{:sh} or NuGet are about the .NET target.

## the compiler

The compiler is published as the [`ghul.compiler`{:text}](https://www.nuget.org/packages/ghul.compiler) .NET tool. Once installed it is invoked as `dotnet ghul-compiler`{:sh}.

You don't usually run the compiler by hand. ghūl projects are built with MSBuild through a `.ghulproj`{:text} project file, and the `ghul.runtime`{:text} package supplies the MSBuild targets that drive the compiler for you. See [creating a project](#creating-a-project) below for setting one up.

The compiler is normally installed as a *local* .NET tool, pinned per project in `.config/dotnet-tools.json`{:text}, so everyone building the project uses the same compiler version. `dotnet tool restore`{:sh} restores it.

## building and running

Because a ghūl project is a normal .NET SDK project, the standard `dotnet`{:text} commands all work:

```sh
dotnet build   # compile the project
dotnet run     # build and run an executable project
dotnet pack    # produce a NuGet package
dotnet test    # run a test project
```

A ghūl project can reference NuGet packages, produce libraries or executables, and be packed and published exactly like a C# project.

## running a script

The `ghul`{:sh} command runs a single `.ghul`{:text} file with no project file, including as an executable with a `#!`{:text} line on Linux. See [scripts, the REPL and notebooks](/scripts-and-repl#running-a-script).

## the REPL

`ghul repl`{:sh} starts an interactive session that compiles and runs each submission as you type it. See [the REPL](/scripts-and-repl#the-repl).

## notebooks

The [`ghul.jupyter`{:text}](https://www.nuget.org/packages/ghul.jupyter) tool is a Jupyter kernel for ghūl, which VS Code can run notebooks with. See [notebooks](/scripts-and-repl#notebooks).

## diagnostics

Every warning has a slug, shown in its message. A slug can be suppressed on a declaration with `@suppress("<slug>")`, for a whole source file with [`@@suppress("<slug>")`](/syntax.html) at the top of the file, or for a whole project with `--suppress <slug>`, and its severity can be changed on the compiler command line: `--warn-as-hint <slug,…>` downgrades matching warnings to editor-only hints that never appear in a batch build, and `--warn-as-info <slug,…>` downgrades them to informational diagnostics that still show in a build. Suppression wins over a demotion.

## the Visual Studio Code extension

The [ghūl language extension](https://marketplace.visualstudio.com/items?itemName=degory.ghul) provides language support while you edit:

- errors and warnings reported as you type
- code completion
- hover information
- go to definition and find references
- rename
- signature help
- source code formatting

Behind the scenes the extension runs the ghūl compiler in its analysis mode. When a project is opened the extension restores its NuGet packages and builds it, then starts the compiler, which reads every source file and builds its analysis of the project; even for a small project this takes a few seconds. The compiler then stays resident and updates that analysis incrementally as you edit, reporting diagnostics back into the editor, so hover and completion typically answer in a few milliseconds regardless of project size.

On large projects the extension updates this analysis in two stages: a quick partial pass over the file you are editing, followed by a full pass once you pause. This is usually invisible, though it does mean a diagnostic can occasionally appear or disappear a moment after an edit.

## other editors

The extension's language support lives in a standalone [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) server with no dependency on the VS Code API. It speaks stdio by default, so any editor with an LSP client can drive it - it has been tested with [Micro](https://micro-editor.github.io/), for example.

Install it from npm:

```sh
npm install -g @ghul/language-server
```

The command it installs is `ghul-language-server`{:text}, so point your editor's LSP client at that. The same package is attached as a `.tgz`{:text} to every [ghul-vsce release](https://github.com/ghul-lang/ghul-vsce/releases) if you would rather not install from npm.

## dev containers

The ghūl repository template and the examples repo both ship a `.devcontainer` configured to use a standard .NET 10 dev container image - for example [`mcr.microsoft.com/devcontainers/dotnet:10.0`](https://hub.docker.com/r/microsoft/devcontainers-dotnet). Open the project in VS Code with the Dev Containers extension, or in a GitHub Codespace, and `dotnet tool restore`{:sh} will install the compiler from the local tool manifest. Any image with the .NET 10 SDK and `dotnet`{:text} on the PATH will work.

## creating a project

### from a project template

The [`ghul.templates`{:text}](https://www.nuget.org/packages/ghul.templates) package adds ghūl project templates to the .NET SDK:

```sh
dotnet new install ghul.templates
```

Once installed, `dotnet new`{:sh} can scaffold a ghūl project pre-configured with a `.ghulproj`{:text}, the compiler pinned as a local tool, and a starting source file.

### from the repository template

If you create a new GitHub repo from the [ghūl repository template](https://github.com/ghul-lang/ghul-repository-template), the compiler comes pre-configured as a local .NET tool in your project folder - run `dotnet tool restore`{:sh} to restore it.

### from scratch

The compiler expects to be driven by MSBuild using a `.ghulproj`{:text} project file. See the [ghūl test](https://github.com/ghul-lang/ghul-test) project for a real-world example.

`Directory.Build.props`{:text}
```xml
<Project>
  <PropertyGroup>
    <Version>0.1.0-alpha.1</Version>
  </PropertyGroup>

  <ItemGroup>
    <!--
      ghul.runtime provides MSBuild targets required to drive the 
      ghul compiler
     -->
    <PackageReference Include="ghul.runtime" Version="0.0.0-latest.ghul.runtime" />
  </ItemGroup>
</Project>
```

`example.ghulproj`{:text}
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>

    <GhulCompiler>dotnet ghul-compiler</GhulCompiler>
  </PropertyGroup>

  <ItemGroup>
    <GhulSources Include="src/**/*.ghul" />
  </ItemGroup>
</Project>
```

By convention ghūl source files have the extension `.ghul`{:text}, and the `ghul.runtime`{:text} provided MSBuild targets will include `**/*.ghul`{:text} when building.

To pin the compiler as a local tool in the project folder, so everyone building the project gets the same compiler:

```sh
dotnet new tool-manifest
dotnet tool install --local ghul.compiler --version 0.0.0-latest.ghul.compiler
```

The compiler can also be installed globally instead, from the [ghūl compiler .NET tool package](https://www.nuget.org/packages/ghul.compiler/):

```sh
dotnet tool install --global ghul.compiler
```

### runtime dependencies for ghūl applications

Applications written in ghūl require the [.NET 10 runtime](https://dotnet.microsoft.com/download/dotnet/10.0).
