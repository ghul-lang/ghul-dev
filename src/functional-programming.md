# functional programming

::: tip editable examples
Every example on this page can be edited and run here: click the pencil to open it in an editor, change it, and run it in your browser. Errors, hovers and completions come from the ghūl compiler as you type.

The [ghul-examples repository](https://github.com/ghul-lang/ghul-examples/tree/main/examples/functional) has fuller functional-programming examples to build and run locally, in a GitHub Codespace or a dev container.
:::

ghūl supports a functional style of programming. Functions are values, and
they capture the variables around them. Local variables are immutable
unless declared `mut`, arrays and tuples can't be changed, and `List`, `Map`
and `Set` are read-only views. Unions with an exhaustive `case` model data
by cases. Pipes, generators and list comprehensions process sequences
without changing them. The compiler proves most functions store-free, and
takes a `pure` declaration on trust where the proof falls short.

Mutable state is there when a program needs it: a `let mut` variable, a
`LIST`, a `public` property. A few things work differently from ML-family
languages: functions are not curried, function literals are not generic, and
a function is not defined clause by clause. Each has a substitute: `curry`,
a generic named function, and a function whose body is a `case`.

## functions as values

A function literal, a named function and an operator are all values. Each
can be held in a variable, passed to another function, or returned from
one:

<GhulExample name="functional-programming-1" />

A function named with an operator is written with a backtick, since an
operator is not an identifier. A static member operator is named through its
type, as in ``V.`+``. The built-in operators on `int`, `double` and the other
scalar types are instructions rather than functions, so they can't be passed
as values; write a function literal such as `(a, b) => a + b` instead.

## closures

A function literal captures the variables of the scope it is written in. An
immutable `let` variable is captured by value, as it stood when the literal
was constructed. A `let mut` variable is captured by reference: the function
and the enclosing scope share one variable, and either can read or assign it:

<GhulExample name="functional-programming-25" />

## higher-order functions

A higher-order function takes a function as an argument, or returns one.
Global functions and methods can do both, and can be generic:

<GhulExample name="functional-programming-11" />

A function literal has one type, taken from its context, so it can't be
generic. Where the same code has to work for several types, write it as a
generic global function or method.

## data by cases

A union holds one of several variants, and `case` and `if let` take a union
value apart. The compiler checks a `case` over a union for exhaustiveness, so
a `case` that covers every variant doesn't need an `else` arm:

<GhulExample name="functional-programming-23" />

Guards, destructuring and nested patterns are covered in
[unions and pattern matching](/unions-and-pattern-matching.html).

An optional type `T?` holds a value that may be absent. It does the job an
`Option` or `Maybe` type does in other languages. `??` supplies a fallback,
`?.` reads a member only when the value is present, and `if let` tests and
unwraps in one step:

<GhulExample name="optional-types-1" />

Optional types have [their own page](/optional-types.html).

`~>` is the thread-first operator `|>` for a value that may be absent. When
the value on its left is present, `~>` passes it, unwrapped, to the call on
its right. When the value is absent, the call is skipped, its arguments are
not evaluated, and the result is absent. The result is always optional, so a
chain of `~>` stages usually ends with `??`:

<GhulExample name="functional-programming-28" />

`|>` and `~>` can be mixed in one chain: a `|>` stage always runs, and a `~>`
stage runs only when the value before it is present.

## defining functions by cases

ghūl doesn't define a function clause by clause. Two things do that job.
Overloads choose between functions by the types of the arguments. A `case`
as the body of a function chooses between arms by the values of the
arguments; over several arguments, the `case` is over a tuple of them. The
compiler checks the arms for exhaustiveness as it does any other `case`:

<GhulExample name="functional-programming-35" />

A named function calls itself by name. A function literal has no name, so
it calls itself with `rec`:

<GhulExample name="functional-programming-3" />

A function literal can't refer to a variable that is defined after it. For
two function literals that call each other, declare one as a `let mut`
variable and assign the literal to it afterwards. Global functions and
methods can refer to each other in either order, so mutually recursive
functions are simpler to write as those:

<GhulExample name="functional-programming-5" />

## immutability by default

A value that nothing can change is safe to share. The compiler reports an
error for each of these assignments:

<GhulExample name="functional-programming-6" />

- A `let` variable can't be reassigned. Declare it `let mut` to allow
  reassignment.
- An array's elements can be read but not replaced, and an array literal
  constructs a plain array.
- A tuple's elements can't be assigned. A tuple is a value type, so code you
  pass a tuple to gets a copy.
- A property can be assigned only inside the type that declares it, unless it
  is declared `public`. The members a primary constructor synthesises are
  properties too, so the same applies to them.
- `List[T]`, `Map[K, V]` and `Set[T]` have no members that change the
  collection. The mutable `LIST`, `MAP` and `SET` implement them, so a
  function that takes a `List[T]` can read the list it is given but not
  change it.
- A union value is fixed when it is constructed: its variant and its fields
  can't be changed. A method added to a union with [`partial` and `impl`
  blocks](/definitions.html#partial-and-impl-blocks) can store to the heap,
  but the compiler reports an `impure-union-method` warning for it.

These guarantees are shallow: a read-only structure can hold references to
objects that are themselves mutable. They also apply only to ghūl code, so
code written in another .NET language can change a value ghūl treats as
read-only.

## pure functions

A postfix `pure` modifier declares that a function stores nothing on the
heap, and calls nothing that does. The compiler proves most functions
store-free without it. Where the proof falls short, write `pure`: the
compiler takes the declaration on trust. What it does check is that every
override or implementation of a pure member is pure too.

A function type can be pure, so a function can require that the function it
is given is pure:

<GhulExample name="functional-programming-27" />

Declaring a class, struct or trait `pure` applies the same rule to every
instance member. What purity means for [type narrowing](/type-narrowing.html)
is covered under [methods](/definitions.html#methods).

Expression bodies, and the values an `if`, a `case` or a parenthesised block
produces, make functions without assignments easier to write; see
[expression-oriented programming](/expression-oriented-programming).

## sequences

### filter, map, reduce

The pipe combinators are global functions in `Ghul.Pipes`. Each takes the
sequence as its first argument, so the
[thread-first operator](/expressions#thread-first-calls) `|>` chains them.
They produce new sequences and leave their source as it was:

<GhulExample name="functional-programming-2" />

### list comprehensions

A list comprehension makes an array from one or more sequences. Write it in square brackets: the element first, then a `for` clause for each sequence, and optionally `if` clauses to keep only the elements you want:

<GhulExample name="functional-programming-33" />

Each `for` clause iterates over its sequence the way a `for` loop does, so it accepts any sequence a loop accepts, and its variable can destructure each element: `for (key, value) in counts`. A clause can use the variables of the clauses before it, and the element can use all of them. The clauses nest in the order you write them, so in the second example `b` runs through `1::3` once for each value of `a`, and the `if` removes the pairs where the two are equal.

An `if` clause narrows what it tests, as an `if` statement does: in `[name.length for name in names if name?]`, `name` has type `string` in the element.

The result is an array. Its element type is the type of the element expression, or the element type of the array the context expects. The closing bracket ends the comprehension, so you can use one on either side of `|>`.

A comprehension's loops are its own. You can't `break` or `continue` out of one, and it can't contain a `yield`, an `await` or a `try`. A function literal inside a comprehension is a separate function body, so these restrictions don't apply inside it.

Don't write a comprehension over a sequence that never ends. A comprehension makes its whole array before you can use any of it, so it would never finish. Use a pipe instead: a pipe produces its elements one at a time, and `take` stops it after the elements you need. A search that should stop at the first match is also better as a pipe, for the same reason. The compiler warns with `unbounded-comprehension-source` when a comprehension's source is one of the runtime's sequences that never ends, such as `from(1)`:

<GhulExample name="functional-programming-34" />

### generators

A function that returns `Pipe[T]` and contains `yield` is a generator. It
produces its elements one at a time, as the consumer asks for them, so it can
describe a sequence that never ends. `yield in` produces every element of
another sequence, which suits a recursive generator:

<GhulExample name="functional-programming-36" />

A generator's result is an ordinary `Pipe[T]`, so the pipe combinators chain
onto it. [Generators](/async-and-generators.html) have more detail.

### streams

`stream(initial, advance)` in `Ghul.Pipes` builds a sequence from a state and
a step function. The state type `S` and the element type `T` are separate
type parameters, and the result is a `Pipe[T]`, so the state is hidden from
whatever reads the sequence:

```ghul
union STREAM[T, S] is
    DONE
    YIELD(value: T, state: S)
si

stream[T, S..](
    initial: S,
    advance: S.. -> STREAM[T, S]
) -> Pipe[T]
```

`S..` makes `S` an [argument pack](#argument-packs), so when the state is a
tuple, the step function can take its elements as separate parameters.

`advance` takes the current state and returns either `DONE`, which ends the
sequence, or `YIELD(value, next_state)`, which produces an element and the
state for the next step. The `||` infix constructs a `YIELD`, so a step
usually reads `value || next_state`:

<GhulExample name="functional-programming-22" />

The type arguments to `stream` are inferred from the initial state and from
what the step function yields.

### seeds and caching

`from(start)` counts upwards from `start` without end, and
`from(start, step)` counts in steps of `step`. `repeat(value)` produces the
same value without end, and `repeat(value, count)` produces it `count` times.
A sequence that never ends needs a stage that stops reading it, such as
`take`:

<GhulExample name="functional-programming-29" />

A pipe computes its elements again each time it is read. `memo` reads its
source once, keeps the elements, and replays them on every later read:

<GhulExample name="functional-programming-30" />

## combining functions

### composition

The runtime supplies function composition in both reading orders, as `>>`
and `<<` in namespace `Ghul`, so a file that composes functions needs
`use Ghul`. `f >> g` applies `f` and then `g`, in the same direction as `|>`.
`f << g` applies `g` and then `f`, the order used in mathematics:

<GhulExample name="functional-programming-26" />

### combinators

Namespace `Ghul` also has the common function combinators. `curry` turns a
two-argument function into one that takes its arguments one at a time, and
`uncurry` turns it back. `apply` calls a function with the rest of its own
arguments. `memoize` returns a function that computes its result once for
each distinct set of arguments and returns the stored result for repeated
calls. `retry` returns a function that calls the original again when it
throws, up to a given number of attempts:

<GhulExample name="functional-programming-31" />

### partial application

Partial application fixes some of a function's arguments and leaves the rest
open. ghūl doesn't have a partial application operator; write a function
literal that supplies the fixed arguments:

<GhulExample name="functional-programming-20" />

### argument packs

A type parameter written with a trailing `..`, as in `[T..]`, is an argument
pack: it stands for however many arguments a call supplies, held as a tuple.
A formal typed `T.. -> U` takes a function of that many parameters, and a
formal typed `T..` takes the rest of the call's arguments. Together they let
one function take a function of any number of parameters, and the arguments
to call it with:

<GhulExample name="functional-programming-32" />

A pack holds at most seven arguments, the size of the largest tuple. Declare
the `T..` formal last, since it takes every argument after it. A caller that
already holds the tuple can pass it in place of the separate arguments. The
runtime's `apply`, `memoize` and `retry` take their functions this way, and
so do the pipe stages that take a function.
