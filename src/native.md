# native executables

A ghūl program can be compiled to a native executable for Linux on x86-64, as well as to .NET and WebAssembly. The compiler writes an LLVM module and links it into a single statically linked file, which runs on its own with nothing else installed.

::: warning work in progress
The native target is new and doesn't yet compile the whole language. Small programs work today; the [native target epic](https://github.com/ghul-lang/ghul/issues/3454) lists what is supported and what is still to come.
:::

## installing

A native build is driven by the `ghul`{:sh} command, the [`ghul.cli`{:text}](https://www.nuget.org/packages/ghul.cli) .NET tool, which needs the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) to install and run. Install it, then bring its compiler up to the latest release:

```sh
dotnet tool install -g ghul.cli
ghul install-compiler
```

The first native build also fetches `ghul-llvm`{:text}, the linker and the runtime library a native program links against, into `~/.cache/ghul-cli`{:text}. The executables it builds need an x86-64-v3 processor (AVX2 and BMI2, from about 2013 on).

## hello world

`ghul new`{:sh} creates a project for the native target:

```sh
ghul new hello --target llvm
cd hello
```

The new directory holds a `ghul-project.json`{:text} manifest listing the `llvm`{:text} target, a `.gitignore`{:text} for the build output in `out/`{:text}, and the program, as `src/main.ghul`{:text}:

```ghul
use IO.Std.write_line

entry() is
    write_line("hello")
si
```

`ghul run`{:sh} builds the project into `out/llvm/`{:text} and runs the executable it built:

```sh
ghul run
```

`ghul build`{:sh} builds without running, and `out/llvm/hello`{:text} is then an ordinary executable that can be copied to another Linux machine and run there. A project can list more than one target, as in `ghul new hello --target dotnet,llvm`{:sh}; name the one to build with `--target`{:sh}.

## debugging

`--debug`{:sh} builds with debug information, into `out/llvm-debug/`{:text} beside the ordinary build:

```sh
ghul build --debug
```

A debug build is unoptimised and carries line tables and variables, so a debugger and a crash's backtrace name ghūl files, lines and variables. `objdump`{:sh} shows the source beside the machine code, and `gdb`{:sh} steps through it:

```sh
objdump -d -S out/llvm-debug/hello
gdb out/llvm-debug/hello
```

`--optimise <0-3>`{:sh} sets the optimisation level, which is otherwise 2, or 0 for a debug build. A build at another level goes into a directory of its own, such as `out/llvm-O3/`{:text}, or `out/llvm-debug-O2/`{:text} for an optimised build with debug information. The manifest's `options`{:text} can name a default level, as `"optimise": 3`{:text}.

## what works today

With the latest compiler, a native build compiles classes, structs, traits and unions, with virtual and trait calls, type tests and casts, generics, arrays, tuples, optional value types, function values and closures, strings and string interpolation, `bigint`, generators, exceptions with `try`, `catch` and `finally`, loops, writing to the console, and an `entry` taking the command-line arguments.

Not yet:

- asynchronous functions and `await`
- `decimal`
- reading the text of a file

The [native target epic](https://github.com/ghul-lang/ghul/issues/3454) tracks each of these. Run `ghul install-compiler`{:sh} to pick up each release as it adds to the list.

## code for one target

`@IF.llvm()` written before a definition or a statement keeps it only in a native build, and `@IF.source_core()` keeps it in both a native and a WebAssembly build, the two targets whose core library is compiled from source rather than taken from .NET:

```ghul
use IO.Std.write_line

entry() is
    write_line(target_name())
si

@IF.dotnet()
target_name() -> string => "dotnet"

@IF.llvm()
target_name() -> string => "native"
```

[Code for one target](/webassembly#code-for-one-target) on the WebAssembly page covers the pragma in full.

## errors you will see

A .NET API the core library doesn't declare doesn't exist in a native build, so a call to one is reported the way any other missing name is. Something the native target will support but can't compile yet is reported at the function holding it, but only in code the program reaches:

```text
main.ghul: 3,1..3,6: error: code generation for a decimal literal is not supported on the llvm target
```

LLVM keeps names starting `llvm.` for itself, so a namespace named `llvm` at the root of a program is reported as an error. To use the name, nest it inside another namespace, as `Outer.llvm`.
