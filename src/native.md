# native executables

A ghūl program can be compiled to a native executable for Linux on x64 or arm64, as well as to .NET and WebAssembly. The compiler writes an LLVM module and links it into a single statically linked file, which runs on its own.

::: warning work in progress
The native target doesn't yet compile the whole language, and it has ghūl's own libraries in place of .NET's. [What works today](#what-works-today) lists what is missing. The [native target epic](https://github.com/ghul-lang/ghul/issues/3454) tracks it.
:::

## installing

The `ghul`{:sh} command builds native programs. On Linux, x64 or arm64, it installs without .NET:

```sh
curl -fsSL https://raw.githubusercontent.com/ghul-lang/ghul-cli/main/install.sh | sh
```

Where the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) is installed, `ghul`{:sh} is also available as the [`ghul.cli`{:text}](https://www.nuget.org/packages/ghul.cli) .NET tool. The native target is released for Linux only, so macOS and Windows can't build native programs.

The first native build fetches the compiler, and `ghul-llvm`{:text}, the linker and runtime library a native program links against, into `~/.cache/ghul-cli`{:text}. `ghul install llvm`{:sh} fetches `ghul-llvm`{:text} ahead of time, and `ghul update`{:sh} keeps the tools at their newest releases. On x64 the executables need an x86-64-v3 processor (AVX2 and BMI2, from about 2013 on).

## hello world

`ghul new`{:sh} creates a project for the native target:

```sh
ghul new hello --target llvm
cd hello
```

The new directory holds a `ghul-project.json`{:text} manifest listing the `llvm`{:text} target and declaring ghul-core and ghul-runtime, a `.gitignore`{:text} for the build output in `out/`{:text}, and the program, as `src/main.ghul`{:text}:

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

`ghul build`{:sh} builds without running, and `out/llvm/hello`{:text} is then an ordinary executable that can be copied to another Linux machine of the same architecture and run there. A project can list more than one target, as in `ghul new hello --target wasm,llvm`{:sh}; name the one to build with `--target`{:sh}.

## the REPL

`ghul repl --target llvm`{:sh} starts an interactive session that compiles each submission natively and runs it in a process that keeps every earlier one loaded, in about a second a submission. Ctrl-C ends a running submission and keeps the session, and completion and hover work as they do in the [.NET session](/scripts-and-repl#the-repl).

```sh
ghul repl --target llvm
```

## calling C

`@extern("libc", "abs")`{:text} before a function with no body declares a C function the program is linked with, and the ghūl signature is the whole declaration. The scalar types cross as the C types of the same width, and a string argument crosses as a NUL-terminated UTF-8 copy. Pointers and `ref` arguments don't cross on this target. The program links statically against musl, so a library it names has to be available as a static archive built for musl, which `--native-library <name>`{:sh} and `--native-library-path <dir>`{:sh} point at. The [language reference](https://github.com/ghul-lang/ghul/blob/main/GHUL.md) describes `@extern`{:text} for each target.

## debugging

`--debug`{:sh} builds with debug information, into `out/llvm-debug/`{:text} beside the ordinary build:

```sh
ghul build --debug
```

A debug build is unoptimised and has line tables and variables, so a debugger and a crash's backtrace name ghūl files, lines and variables. `objdump`{:sh} shows the source beside the machine code, and `gdb`{:sh} steps through it:

```sh
objdump -d -S out/llvm-debug/hello
gdb out/llvm-debug/hello
```

`--optimise <0-3>`{:sh} sets the optimisation level, which is otherwise 2, or 0 for a debug build. A build at another level goes into a directory of its own, such as `out/llvm-O3/`{:text}, or `out/llvm-debug-O2/`{:text} for an optimised build with debug information. The manifest's `options`{:text} can name a default level, as `"optimise": 3`{:text}.

## what works today

With the latest compiler, a native build compiles classes, structs, traits and unions, with virtual and trait calls, type tests and casts, generics, arrays, tuples, optional value types, function values and closures, strings and string interpolation, `bigint`, generators, asynchronous functions and `await`, exceptions with `try`, `catch` and `finally`, loops, writing to the console, reading and writing files, calls into C with `@extern`{:text}, and an `entry` taking the command-line arguments.

A native program fails the way a .NET one does: reading through a null reference throws `NullReferenceException`, a failed cast throws `InvalidCastException`, an array index out of range throws `IndexOutOfRangeException`, and an integer division by zero throws `DivideByZeroException`, each of which a `try` can catch.

Strings, numbers and dates behave as they do in a .NET program configured for invariant globalization: strings compare and sort by UTF-16 code unit, and numbers and dates format the same way whatever the culture of the machine. A .NET program gets the same behaviour by setting `<InvariantGlobalization>true</InvariantGlobalization>` in its project.

Not yet:

- `decimal`
- reflection beyond a subset, and the .NET libraries: a native program has no regular expressions, HTTP, sockets or culture-aware formatting, and can't call a library written in ghūl or C# that already exists. It can call C with `@extern`{:text}

The [native target epic](https://github.com/ghul-lang/ghul/issues/3454) tracks what is still to come. Run `ghul update`{:sh} to pick up each release as it adds to the list.

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

## errors

A call to a .NET API that the core library doesn't declare is reported the way any other missing name is. Something the native target will support but can't compile yet is reported at the function holding it, but only in code the program reaches:

```text
main.ghul: 3,1..3,6: error: code generation for a decimal literal is not supported on the llvm target
```

LLVM keeps names starting `llvm.` for itself, so a namespace named `llvm` at the root of a program is reported as an error. To use the name, nest it inside another namespace, as `Outer.llvm`.
