#!/usr/bin/env bash
# Finds the examples that run on WebAssembly: each example test that runs on
# .NET is built with --target wasm and run under Node, and is listed when it
# prints what example-tests/<name>/run.expected says it prints on .NET.
#
# The build uses the compiler named in example-tests/wasm-compiler, which has to
# be the one the playground's compile service pins, and ghul-cli fetches the
# ghul-core and ghul-runtime it pins for that compiler: the same toolchain the
# embedded editor compiles for WebAssembly with. When the playground's compiler
# moves, change that file and run this again.
#
# Writes the sorted list to example-tests/wasm-capable.txt, one name a line.
# tools/mark-wasm-examples.mjs then records it in the example data.
#
# usage: tools/wasm-examples.sh [example-test-name ...]

set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tests="$repo/example-tests"
compiler="$(tr -d '[:space:]' < "$tests/wasm-compiler")"

cd "$repo"
dotnet tool restore > /dev/null

cli_version="$(node -p "require('./.config/dotnet-tools.json').tools['ghul.cli'].version")"
cli="$HOME/.nuget/packages/ghul.cli/$cli_version/tools/net10.0/any/ghul-cli.dll"

if [ ! -f "$cli" ]; then
    echo "wasm-examples: no ghul-cli at $cli" >&2
    exit 2
fi

work="$(mktemp -d "${TMPDIR:-/tmp}/wasm-examples.XXXXXX")"
trap 'rm -rf "$work"' EXIT

names=("$@")

if [ ${#names[@]} -eq 0 ]; then
    for dir in "$tests"/*/; do
        names+=("$(basename "$dir")")
    done
fi

capable=()

for name in "${names[@]}"; do
    dir="$tests/$name"

    # An example that only compiles, or is meant to fail, has no output to
    # compare; one built as a library has no entry point to run.
    if [ ! -f "$dir/run.expected" ] || [ -f "$dir/fail.expected" ] ||
        grep -q -- '--library' "$dir/ghulflags" 2> /dev/null; then
        continue
    fi

    project="$work/$name"
    mkdir -p "$project"
    cp -L "$dir/test.ghul" "$project/"

    cat > "$project/ghul-project.json" <<EOF
{
    "name": "example",
    "targets": ["wasm"],
    "compiler": "$compiler",
    "sources": ["*.ghul"]
}
EOF

    if ! (cd "$project" && timeout 300 dotnet "$cli" build --target wasm > build.log 2>&1); then
        echo "$name: does not build" >&2
        continue
    fi

    if ! timeout 60 node "$project/out/wasm/example.mjs" > "$project/run.out" 2> "$project/run.err"; then
        echo "$name: does not run" >&2
        continue
    fi

    if diff -b "$project/run.out" "$dir/run.expected" > /dev/null; then
        capable+=("$name")
        echo "$name: runs" >&2
    else
        echo "$name: prints something else" >&2
    fi
done

if [ $# -eq 0 ]; then
    printf '%s\n' "${capable[@]}" | sort > "$tests/wasm-capable.txt"
    echo "${#capable[@]} examples run on WebAssembly; listed in example-tests/wasm-capable.txt" >&2
else
    printf '%s\n' "${capable[@]}"
fi
