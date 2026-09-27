# async and generators

::: tip editable examples
Every example on this page can be edited and run here: click the pencil to open it in an editor, change it, and run it in your browser. Errors, hovers and completions come from the ghūl compiler as you type.

The ghul-examples repository has fuller [async-await](https://github.com/ghul-lang/ghul-examples/tree/main/examples/async-await) and [generators](https://github.com/ghul-lang/ghul-examples/tree/main/examples/generators) examples to build and run locally, in a GitHub Codespace or a dev container.
:::

Two kinds of ghūl function can return control to their caller partway through and later carry on from the same point: an asynchronous function does so at an `await` whose task hasn't completed, so the thread isn't blocked while it waits, and a generator does so at each `yield`, producing its sequence one element per request. An asynchronous function is marked by its return type, `Tasks.TASK[T]`, and a generator by returning `Pipe[T]` and containing `yield`; the body reads top to bottom either way.

## asynchronous code

A function is asynchronous when its declared return type is `Tasks.TASK[T]` (or `Tasks.TASK`, for one that produces no value).

Inside such a function, `await e` evaluates to the result of the task `e` once it completes. `let x = await e;` defines a local variable holding the result, and the rest of the function continues:

<GhulExample name="control-flow-46" />

`await e;` as a bare statement is the value-less form: it waits for `e` to complete and discards any result. Use it when you only care that the work has finished:

<GhulExample name="control-flow-47" />

`await` can also appear inside the body of a `for` or `while` loop: the loop iterates, awaiting and resuming once per iteration. A `return` from inside an awaiting loop body propagates out through the loop as usual:

<GhulExample name="control-flow-48" />

`await` is not limited to tasks. Anything that follows .NET's awaiter
pattern can be awaited: a type with a parameterless `get_awaiter()` whose
result has a `bool` property `is_completed`, a parameterless
`get_result()`, and implements
`System.Runtime.CompilerServices.INotifyCompletion`. `Tasks.ValueTask[T]`
and `Tasks.TASK.yield()` both qualify, and the `await` takes the type
`get_result` returns:

<GhulExample name="async-and-generators-2" />

An `await` over a value that does not follow the pattern is reported,
naming the first member it lacks.

A `try` / `catch` / `finally` around awaiting code works as expected, including a `return` from inside the `try`. What is not yet supported is an `await` inside a `catch` or `finally` handler itself. A faulted task can also be handled at the call site: reading `.result` on a returned task throws the fault as a `System.AggregateException`.

## coroutines

What an asynchronous function returns is not fixed to `Tasks.TASK` either.
Any type carrying .NET's `AsyncMethodBuilderAttribute` can be the return
type: the attribute names a builder type, and the compiler drives that
builder instead of the one for tasks. The runtime's `Ghul.Coroutines`
namespace uses this for cooperative coroutines. A function returning
`COROUTINE` or `COROUTINE[T]` is a coroutine: calling it runs its body
until the first `await`, `pause()` gives up its turn, and `run()` resumes
waiting coroutines one at a time until none remain. Everything runs on one
thread:

<GhulExample name="async-and-generators-3" />

`sleep(milliseconds)` gives up the turn until a deadline has passed, and
`CHANNEL[T]`, `MUTEX` and `SEMAPHORE` pass values between coroutines and
guard what they share. A coroutine can also await a task, and `run()`
resumes it on its own thread when the task completes.

## generators

A function is a generator when its declared return type is `T{}`, the sequence type `Iterable[T]`, and its body contains `yield E;`. `Iterator[T]` and `Ghul.Pipes.Pipe[T]` are accepted as well. Each `yield` produces the next value in the sequence; execution suspends until the caller asks for another value, then resumes from the statement after the `yield`:

<GhulExample name="control-flow-49" />

A generator returning `T{}` or `Pipe[T]` is a sequence, so it can be looped over directly and composed with `map` / `filter` / `take` and the other [pipe stages](/runtime-library.html#stages). Each read of it runs the body from the start, with the arguments it was called with, and two reads in progress at once are independent. One returning `Iterator[T]` is read once: the iterator it returns is the one read.

<GhulExample name="control-flow-50" />

`yield in E` yields every element of `E` in turn, where `E` is anything a
`for` loop can iterate. The elements are pulled one at a time as the
consumer asks for them, so a recursive generator reads naturally:

<GhulExample name="async-and-generators-1" />

`return;` ends the sequence early; falling off the end of the body has the same effect.

As with `await`, a `yield` inside a `catch` or `finally` handler is not yet supported, and a function cannot be both a generator and asynchronous.
