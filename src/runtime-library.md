# runtime library

`Ghul.Runtime` ships alongside the compiler and supplies `Pipe[T]` and other
everyday building blocks used throughout this site. The reference below
covers `Ghul.Pipes`, the sequence-processing library behind
[filter, map, reduce](/functional-programming#filter-map-reduce) and the
[thread-first operator](/expressions#thread-first-calls), and then
[how the runtime displays values](#displaying-values).

A pipe combinator chain is written with the thread-first operator `|>` over
free functions, which pass the sequence in as the first argument:

<GhulExample name="pipes-intro-thread-first" />

## how a pipe runs

The combinators come in two kinds. A **stage** returns a new sequence, a `T{}`,
which is what lets stages chain: `map` returns a sequence that maps, `filter`
returns one that filters. A **terminal** returns something else - a value, a list, a count -
so it is where a pipe ends.

Elements travel through a pipe one at a time, and the terminal is what pulls
them through. It asks the pipe it was called on for an element, that pipe asks
the one it was built from, and so on back to the iterable at the start; the
element then makes its way down the pipe, each stage working on it before
passing it on to the next stage. No stage buffers the whole sequence - typical
stages hold only one element at a time - so a `map` over a million elements
doesn't construct a million-element list.

Pipes are lazy: until something - a terminal - asks a pipe for elements, no
stage runs. An inert pipe can be held or passed around until it's needed. And if
the consumer stops pulling elements from the pipe, the pipe will stop pulling
elements from its source iterator. Every read of a pipe starts from the
beginning, pulling elements through its chain of stages from the source again,
and two reads in progress at once are independent of each other.

<GhulExample name="pipes-lazy-chain" />

Because pipes are lazy, a source can have an infinite number of elements, such
as a [generator](/async-and-generators.html#generators) that yields
indefinitely. Something downstream decides when to stop reading it: `take(n)`
stops pulling after `n` elements have passed through it, and a terminal such as
`find` stops at the first match.

`reverse`, the `sort` family, `transpose` and `permutations` do buffer: they
need the whole sequence before they can produce anything, so they read the
whole source first. They are listed separately below.

A source that holds a resource has to be disposed: the lines of a file, a
directory listing, a database reader. Take its iterator with `use`, and build
the pipe over that iterator with `cursor`. Here `open_lines` stands in for
`IO.File.read_lines(path).iterator`, and prints a line when it is disposed:

<GhulExample name="pipes-held-iterator" />

`cursor` reads the iterator it is given, rather than asking the source for a
new one. `use` disposes that iterator when the function returns, before its
result is printed. Without `use` the lines would stay open: `find` stops at the
first long line, and a terminal never disposes the iterator it reads.

The compiler reports an `undisposed-source` warning where a read of one of these
sources can stop early with nothing to dispose it.

## reading the signatures

The `pure` on a function type - `predicate: (T) -> bool pure` - asks that the
function you pass only reads, and doesn't write to the heap. Most anonymous
functions satisfy it without any thought; see [type narrowing](/type-narrowing.html#calls-purity-and-stable)
for what the compiler does with the guarantee.

A combinator that might not find anything returns `T?`, an [optional type](/optional-types.html#unconstrained-generic-types):
it holds a `T` or doesn't hold one, and `??`, `!` and `if let` read the value out.

## making a pipe

### pipe

Turns any `Iterable[T]` - an array, a `LIST[T]`, a `MAP[K, V]`'s values,
anything with an `.iterator` - into a `Pipe[T]`. A chain rarely needs it: the
free functions all take an `Iterable[T]`, so a chain can start from the source
itself.

<GhulExample name="pipes-ref-pipe-function" signature />

## stages

A stage returns a new sequence, so stages chain onto one another.

### filter

<GhulExample name="pipes-ref-filter-function" signature />

### map

<GhulExample name="pipes-ref-map-function" signature />

### flat_map

Maps each element to an iterable and runs the results together into one sequence.

<GhulExample name="pipes-ref-flat_map-function" signature />

### skip

<GhulExample name="pipes-ref-skip-function" signature />

### take

<GhulExample name="pipes-ref-take-function" signature />

### skip_while

<GhulExample name="pipes-ref-skip_while-function" signature />

### take_while

<GhulExample name="pipes-ref-take_while-function" signature />

The four set operations that follow all discard duplicates. This is what they do to the same pair of sources:

<GhulExample name="pipes-set-operations" />

### distinct

Removes duplicates, keeping the first occurrence of each element. `distinct`, `union_with`, `intersect_with` and `except` all do this, so each produces a sequence with no repeats, in the order first seen. Elements are compared with `=~` and `get_hash_code`, so a type used with these needs [both](/dotnet-integration.html#equality).

<GhulExample name="pipes-ref-distinct-function" signature />

### union_with

Every element of both sources with duplicates removed, taking the left source's elements first.

<GhulExample name="pipes-ref-union_with-function" signature />

### intersect_with

Elements the left and right sources have in common, in the order the left source has them.

<GhulExample name="pipes-ref-intersect_with-function" signature />

### except

Elements of the left source that the right source doesn't have.

<GhulExample name="pipes-ref-except-function" signature />

### peek

Calls `action` on each element and passes it through unchanged.

<GhulExample name="pipes-ref-peek-function" signature />

`chunk` and `windows` both produce groups of elements, and differ in how the groups are cut:

<GhulExample name="pipes-chunk-windows" />

### chunk

The first `size` elements, then the next `size`, and so on, each element appearing in one group only. The last group is short when the source doesn't divide evenly. Compare `windows`, below.

<GhulExample name="pipes-ref-chunk-function" signature />

### windows

Every run of `size` neighbouring elements: the first `size`, then the same run moved along by one, and so on. Each window therefore shares all but one of its elements with the window before it. A window is always `size` long, so a source with fewer than `size` elements produces none.

<GhulExample name="pipes-ref-windows-function" signature />

### group

Runs of neighbouring equal elements, each a read-only list, compared with `=~`. A new run starts wherever an element differs from the one before it, so equal elements that are not neighbours go into separate runs. Compare `group_by`, below, which gathers every element with the same key wherever it appears.

<GhulExample name="pipes-group" />

<GhulExample name="pipes-ref-group-function" signature />

### cat

Concatenation: every element of the left source, then every element of the right.

<GhulExample name="pipes-ref-cat-function" signature />

### index

Pairs each element with its index. `INDEXED_VALUE[T]` has `index` and `value`, and destructures positionally, so `for (i, x) in xs |> index() do` reads the pair apart. The second form starts the index at a given number rather than at 0.

<GhulExample name="pipes-ref-index-function" signature />

### zip

Pairs elements of the source with elements of `other`, stopping when either side runs out. The second form combines each pair with a mapper instead of yielding a tuple.

<GhulExample name="pipes-ref-zip-function" signature />

## stages that buffer

These return a sequence, like any other stage, but they cannot work out their
first element without having seen the last one. So they buffer the whole source
before producing anything, rather than passing elements along one at a time.
`reverse` and the `sort` family read the source the moment they are called, and
`transpose` and `permutations` read it each time their result is read.

### reverse

Yields the source's elements last to first.

<GhulExample name="pipes-ref-reverse-function" signature />

### sort

Yields the source's elements in order. The first form uses the element type's own ordering: sorting without a comparer needs an element type that defines `<>`, or is comparable on the .NET side. The other two forms take an `IComparer[T]` or a comparison function returning negative, zero or positive.

<GhulExample name="pipes-ref-sort-function" signature />

### sort_descending

<GhulExample name="pipes-ref-sort_descending-function" signature />

### sort_by

<GhulExample name="pipes-ref-sort_by-function" signature />

### sort_by_descending

<GhulExample name="pipes-ref-sort_by_descending-function" signature />

`transpose` and `permutations` both produce read-only lists built from the whole source:

<GhulExample name="pipes-transpose-permutations" />

### transpose

The source's rows and columns exchanged, each column a read-only list: the first column holds the first element of each row, in row order, and so on. Transposing stops at the shortest row, so a ragged source is read as its rectangular part.

<GhulExample name="pipes-ref-transpose-function" signature />

### permutations

Every ordering of the source's elements, each a read-only list. The orderings come in the order of the source's own positions, which is sorted order when the source is sorted.

<GhulExample name="pipes-ref-permutations-function" signature />

## terminals

A terminal returns something other than a pipe, so it is where a pipe ends. They
fall into three loose groups:
finding a single element, collecting the elements into a container, and folding
or consuming the sequence as a whole.

The searching combinators come in pairs. `find`-style ones take a predicate or
a mapper and scan; `first`-style ones look only at the leading element. Each has a
variant returning `T?` and one that throws instead:

<GhulExample name="pipes-searching" />

### find

The first element matching the predicate, absent if none does. `first` is the same question with no predicate.

<GhulExample name="pipes-ref-find-function" signature />

### find_map

Calls `mapper` on each element in turn and returns the first present result. `first_map` differs: it calls the mapper on the *first* element only, and returns absent if the mapper returns absent for it.

<GhulExample name="pipes-ref-find_map-function" signature />

### find_or_throw

As `find`, throwing instead of returning absent when no element matches.

<GhulExample name="pipes-ref-find_or_throw-function" signature />

### find_map_or_throw

As `find_map`, throwing instead of returning absent when no element maps.

<GhulExample name="pipes-ref-find_map_or_throw-function" signature />

### first

The leading element, absent when the source is empty.

<GhulExample name="pipes-ref-first-function" signature />

### first_map

Calls `mapper` on the leading element only. Compare `find_map`, above, which keeps going.

<GhulExample name="pipes-ref-first_map-function" signature />

### first_or_throw

As `first`, throwing instead of returning absent when the source is empty.

<GhulExample name="pipes-ref-first_or_throw-function" signature />

### first_map_or_throw

As `first_map`, throwing instead of returning absent.

<GhulExample name="pipes-ref-first_map_or_throw-function" signature />

### last

The final element, absent when the source is empty. `last` reads the whole source to find it.

<GhulExample name="pipes-ref-last-function" signature />

### only

The single element the source holds, throwing when it is empty or holds more than one.

<GhulExample name="pipes-ref-only-function" signature />

### any

<GhulExample name="pipes-ref-any-function" signature />

### all

<GhulExample name="pipes-ref-all-function" signature />

### count

The first form counts every element. The second counts the elements the predicate accepts: `numbers |> count(n => n % 2 == 1)`.

<GhulExample name="pipes-ref-count-function" signature />

### sum

Every element added together. An empty source sums to zero.

<GhulExample name="pipes-ref-sum-function" signature />

### sum_by

The total of what `selector` returns for each element, zero for an empty source. `sum_by(f)` gives the same total as `map(f) |> sum()`:

<GhulExample name="pipes-sum_by-last" />

<GhulExample name="pipes-ref-sum_by-function" signature />

### product

Every element multiplied together. An empty source gives one.

<GhulExample name="pipes-ref-product-function" signature />

### min

The smallest element, absent when the source is empty.

<GhulExample name="pipes-ref-min-function" signature />

### max

<GhulExample name="pipes-ref-max-function" signature />

### min_by

<GhulExample name="pipes-ref-min_by-function" signature />

### max_by

<GhulExample name="pipes-ref-max_by-function" signature />

The collecting combinators differ in what they hand back:

<GhulExample name="pipes-collecting" />

### collect

Collects into an array, `T[]`, which is a read-only `Collections.List[T]`. `collect_mutable` gives back the mutable `LIST[T]` instead, and the others collect into a set or a map.

Each collecting function is a [collection constructor](/functional-programming.html#filter-map-reduce) written as a function: `collect` is `ARRAY(p)`, `collect_mutable` is `LIST(p)`, `collect_set` is `SET(p)`, `collect_mutable_map` is `MAP(p)`, and `join` is `string(p, separator)`. `collect_map` has no constructor of its own, because it gives back the read-only `Map[K, V]`.

<GhulExample name="pipes-ref-collect-function" signature />

### collect_mutable

<GhulExample name="pipes-ref-collect_mutable-function" signature />

### collect_set

<GhulExample name="pipes-ref-collect_set-function" signature />

### collect_map

The first form takes each element's key and value from two functions. The second collects a sequence of key and value pairs, which is how a map with fixed contents is written: `[("a", 1), ("b", 2)] |> collect_map()`.

<GhulExample name="pipes-ref-collect_map-function" signature />

### collect_mutable_map

As `collect_map`, giving back the mutable `MAP[K, V]` rather than the read-only `Map[K, V]`, so entries can be added to it afterwards.

<GhulExample name="pipes-ref-collect_mutable_map-function" signature />

### partition

Splits the source in two on a predicate. The elements matching the predicate come first, then the elements not matching.

<GhulExample name="pipes-ref-partition-function" signature />

### group_by

Collects the elements into a map, keyed by what `key_selector` returns for each.

<GhulExample name="pipes-ref-group_by-function" signature />

### reduce

Folds the source into a single value, starting at `seed` and calling `accumulator` with the running value and each element in turn. The second form passes the final running value through a mapper before returning it.

<GhulExample name="pipes-ref-reduce-function" signature />

### each

Calls `action` on every element. It doesn't return a value and, alone among these, is not `pure` - it exists for its side effects.

<GhulExample name="pipes-ref-each-function" signature />

### append_to

Appends each element to a `StringBuilder`, separated by `separator`, or by `", "` when that is left off. `join` does the same and returns a new string.

<GhulExample name="pipes-ref-append_to-function" signature />

### join

Joins the elements into one string, separated by `separator`, or by `", "` when left off.

<GhulExample name="pipes-ref-join-function" signature />

### render_elements

Writes the elements in brackets, as `[1, 2, 3]`, whatever `to_string` the source's own type declares. It stops at 100 elements with `...`, so an unbounded pipe is written too. This is the text a pipe gives as its own `to_string` and in string interpolation.

<GhulExample name="pipes-ref-render_elements-function" signature />

## displaying values

The runtime formats any value as text in two ways. `$(value)` gives the text a program shows its user: string interpolation uses it for any value whose type gives no text of its own, as [string interpolation](/language-basics#string-interpolation) describes. `inspect(value)` gives the detailed form a REPL or a debugging session wants: the same structure, with each string and character quoted wherever it appears inside a value. `$` doesn't need a `use`, and `inspect` is in `Ghul`:

<GhulExample name="display-values" />

At the top, a string or character is the whole answer, so both functions write it as itself. Inside a value, `inspect` quotes it and `$` does not.

`$` and `inspect` write a value by the first of these rules that fits:

- They write an absent value as `null`, and a `bool` as `true` or `false`.
- They let a type that implements `Displayable` write itself, as described below.
- They write a tuple as its parts in parentheses, and a map entry as `(key, value)`.
- They write a value whose type declares its own `to_string` with that `to_string`, even when the value is also a sequence. The runtime's own pipes, and generators, are the exception: their `to_string` writes their elements.
- They write a sequence, such as an array, a list or a pipe, as its elements in brackets.
- They write a class, struct or union variant with no `to_string` of its own as its type and members, such as `POINT(x = 3, y = 4)`.
- They write a value of a type from another language with no `to_string` of its own as its .NET type name. They do not read its properties, because a property getter can run any code: reading a task's result waits for the task.

They stop a sequence after 100 elements and end it with `, ...]`, so they can write an unbounded pipe. Stopping there leaves nothing behind for the next read of the pipe. Where a value contains itself, they write `<cycle>` at the point it recurs. The same value appearing in two places is not a cycle, and they write it in full both times.

A type chooses how it is displayed by implementing `Displayable`. Its one method writes the value through a `DISPLAY_STATE`. Write each child value with `state.render(child)` rather than `$(child)`: the state carries the element limit and the values already being written, and a fresh call to `$` starts without them. `state.mode` says whether the text is for `$`, `DisplayMode.CLEAN`, or for `inspect`, `DisplayMode.DETAILED`:

<GhulExample name="display-displayable" />

A `DISPLAY_STATE` can also be created directly, with a mode and a different element limit, and read back with `to_string()` after writing into it.

`display(value)` shows a value while the code goes on running, rather than only at the end. A host that shows values, such as a REPL, a notebook or the playground, installs a `DisplaySink`, and `display` sends the value to it. With no host installed, `display` writes what `inspect` gives for the value as a line of standard output. `display(value, id)` names what it shows, and `update_display(value, id)` replaces what was shown under that name, which is how a cell shows progress in place. With no host there isn't a display to replace, so `update_display` writes another line. All three are in `Ghul`:

<GhulExample name="display-show" />

`Displayable` customises the text `$` and `inspect` produce for a value. `Renderable` offers other media for the same value, such as an image, which a host can show in place of that text. Its `representations()` method gives each as a MIME type and its content, best first:

<GhulExample name="display-renderable" />

The host chooses which MIME types it shows, and the text `$` writes is always the fallback. A host that shows output in a web page does not insert `text/html` or `image/svg+xml` from a value into its own document, since either can carry script.
