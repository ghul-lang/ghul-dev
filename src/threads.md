# threads

::: tip native and .NET only
Threads run on the [native target](/native) and on .NET. WebAssembly runs one thread, so the examples on this page can't run in the browser: build them with `ghul build --target llvm`, or read their output beside each one.
:::

`start(body)` runs `body` on a new thread and returns at once with the thread: a `Thread[T]` for a body that returns a `T`, or a `Thread` for one that returns nothing. `join()` waits for the thread to finish and returns what its body returned. Where the body threw, `join()` throws the same exception, every time it is called:

<GhulExample name="threads-1" />

`start` and the other names on this page are in `Ghul.Threads`. A thread's stack is 8 MB; `start(body, stack_size)` gives it `stack_size` bytes instead.

## sharing state

A `Mutex` is a lock one thread holds at a time. `hold(body)` takes it, runs `body` and releases it, also where `body` throws; `lock()` and `unlock()` do the same in two steps. A mutex is not reentrant: `lock()` throws where the calling thread already holds it.

`AtomicInt`, `AtomicLong`, `AtomicBool` and `Atomic[T]` hold one value that several threads can read and change without a mutex. Each operation on one is a single atomic instruction of the processor, which no other thread's operation can interleave with, so no thread ever waits for another. Each has `load`, `store`, `exchange` and `compare_exchange`, and the two integer types add `add` and `increment`:

<GhulExample name="threads-2" />

A program is responsible for how its threads share collections and other objects: `LIST`, `MAP` and the rest are not safe to change from two threads at once, so guard them with a mutex. The runtime library's own hidden state, such as its caches, is safe to use from any thread. Every mutex and atomic operation is sequentially consistent: a value one thread writes before releasing a mutex or storing an atomic is visible to a thread that then takes that mutex or loads that atomic.

## awaiting a thread

An [asynchronous function](/async-and-generators#asynchronous-code) can `await` a thread. The `await` returns what the thread's body returned, or throws what it threw, and the function carries on once the thread finishes:

<GhulExample name="threads-3" />

On the native target the function carries on on the thread that awaited, so code after an `await` runs on the same thread as the code before it. On .NET it carries on on a thread-pool thread, as .NET's own awaits do.

## waiting runs queued work

On the native target, each thread runs its own tasks: a continuation is queued on the thread that will run it, and the queue runs while that thread waits. A thread waiting in `join()`, or for a task's `result`, keeps running its own queued work and the completions other threads hand back to it:

<GhulExample name="threads-4" />

A wait that nothing can ever satisfy, because no work is queued, no delay is pending and no other thread owes this one anything, throws an `InvalidOperationException` rather than hanging.
