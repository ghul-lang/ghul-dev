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
dotnet restore example-tool
dotnet ghul-test example-tests
dotnet ghul-test example-tests/control-flow-8      # one example
```

The default configuration in `ghul-test.json` runs the compiler this repository
pins in its tool manifest, against the runtime it pins in
`example-tool/Directory.Packages.props`, which is the one the examples are
documented against. `dotnet restore example-tool` puts that runtime in the
package cache, where the run finds it.

That settles what the examples *run* on rather than what they compile against:
the runtime is what gets linked beside the binary, and the compiler resolves the
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

## running on WebAssembly

The embedded editor runs an example on WebAssembly, in the browser, where the
example is known to work there, and on .NET otherwise. `wasm-capable.txt` lists
the examples that do: built with `--target wasm` and run under Node, each prints
what its `run.expected` says it prints on .NET. The example data carries the
answer as each example's `"wasm"` flag, which `npm test` checks against the list.

The build uses the newest compiler and ghul-runtime, as ghul-cli
always does. The playground's compile service builds with its own compiler,
which can be older, so run this again when that moves:

```sh
tools/wasm-examples.sh                  # rewrites wasm-capable.txt (about 20 minutes)
node tools/mark-wasm-examples.mjs       # records it in the example data
```

`tools/wasm-examples.sh <name> ...` checks some examples without touching the
list. The example tool reads the list too, so regenerating an example keeps its
flag.
