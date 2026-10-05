# example tests

Almost every example under `examples/` is compiled and run here, and what it
prints is compared against a snapshot - see "what is not covered" for the ones
that are not. The examples are the language documentation, so an example that
no longer compiles, or that prints something other than what the page shows
beside it, is a documentation bug.

One directory per example. The source is a symlink to the example itself, so
editing an example is editing what runs - there is no copy to fall out of step:

```
example-tests/control-flow-8/
├── test.ghul      -> ../../examples/control-flow-8/control-flow-8.ghul
├── ghulflags      compiler flags: --dotnet, plus --library where the example
│                  declares no entry point
└── run.expected   what the program prints
```

An example documenting a compile error carries `fail.expected` (the build is
meant to fail) and `err.expected` (the diagnostic, which is the thing the page
is illustrating). One documenting a warning carries `warn.expected` and, if it
still runs, `run.expected` as well.

## running them

```sh
dotnet tool restore
CI=true dotnet ghul-test --runtime-dll "$HOME/.nuget/packages/ghul.runtime/<version>/lib/net10.0/ghul-runtime.dll" example-tests
CI=true dotnet ghul-test example-tests/control-flow-8      # one example
```

`CI=true` picks the compiler this repository pins. Without it ghul-test looks
for a locally built compiler in a `publish/` directory, which this repository
has no reason to have, and fails at startup before it reads its arguments.

`--runtime-dll` names the runtime this repository pins, in
`example-tool/Directory.Packages.props`. Without it ghul-test uses the copy
inside the ghul.test package instead, which is a different version and is not
the one the examples are documented against. CI resolves the path from the pin
rather than spelling it out.

It settles what the examples *run* on rather than what they compile against:
the flag is what gets linked beside the binary, and the compiler resolves the
runtime it compiles against itself. An example compiled against one runtime and
run on an older one is therefore not something these tests report, which is
worth knowing when a runtime update is the thing under test.

## adding an example

Create the case, then let a failing run write the snapshot:

```sh
mkdir example-tests/<name>
ln -s ../../examples/<name>/<name>.ghul example-tests/<name>/test.ghul
echo --dotnet > example-tests/<name>/ghulflags
dotnet ghul-test example-tests/<name>          # fails; leaves run.out
mv example-tests/<name>/run.out example-tests/<name>/run.expected
```

Read the snapshot before committing it. It records what the compiler does
today, which is only worth having if that is also what the example is meant to
demonstrate.

An example whose output varies between runs - a clock, a random number, a hash,
an unordered collection - cannot be snapshotted. Make the example deterministic
rather than adding a `disabled` file, unless what it is demonstrating is the
variation itself.

## what is not covered

The three `dotnet-integration-*` examples build against ASP.NET through a
`.ghulproj` and are never run, so they are left out. `snippets/` is illustrative
and is not compiled at all.

The Rosetta Code solutions are not here at all. They are written, compiled and run in
[ghul-rosetta-code](https://github.com/ghul-lang/ghul-rosetta-code), where each one's output is pinned
by a test, and the site reads them from there when a reader opens the section. Testing them again
here would mean this repository holding an output it does not own, and a solution improved upstream
would then arrive as a failing test rather than as a better example.

`functional-programming-26` uses the function composition operators `ghul.runtime` supplies
in the `Ghul` namespace. A projectless compile here resolves the `ghul-runtime.dll` bundled
beside the pinned `ghul.compiler` tool, and the compiler versions published so far bundle a
runtime from before those operators existed, so the snippet does not compile in this suite.
It is still compiled and run on every pull, by `example-tool`, against the runtime this
repository pins.

## running on WebAssembly

The embedded editor runs an example on WebAssembly, in the browser, where the
example is known to work there, and on .NET otherwise. `wasm-capable.txt` lists
the examples that do: built with `--target wasm` and run under Node, each prints
what its `run.expected` says it prints on .NET. The example data carries the
answer as each example's `"wasm"` flag, which `npm test` checks against the list.

The build uses the compiler `wasm-compiler` names, with the ghul-core and
ghul-runtime ghul-cli pins for it, which is the toolchain the playground's
compile service builds for WebAssembly with. When the playground's compiler
moves, change `wasm-compiler` to match and run:

```sh
tools/wasm-examples.sh                  # rewrites wasm-capable.txt (about 20 minutes)
node tools/mark-wasm-examples.mjs       # records it in the example data
```

`tools/wasm-examples.sh <name> ...` checks some examples without touching the
list. The example tool reads the list too, so regenerating an example keeps its
flag.
