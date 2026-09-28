# type narrowing

::: tip editable examples
Every example on this page can be edited and run here: click the pencil to open it in an editor, change it, and run it in your browser. Errors, hovers and completions come from the ghūl compiler as you type.

The [type inference examples](/examples/type-inference), several of which narrow, are whole programs you can run here, or build from the [ghul-examples repository](https://github.com/ghul-lang/ghul-examples).
:::

When a check proves a value has a more specific type, ghūl narrows the value for the code the check covers: inside the branch, the value has the narrower type, with no cast and no unwrap needed. Union variant tests, `isa` class checks, presence tests on optionals, and `if let` all narrow, and narrowing follows the control flow, [covered below](#flow-sensitive-narrowing).

::: tip narrowing inlays
Open ghūl in an editor with the [ghūl language extension](/tooling.html) and small triangle hints mark where type narrowing changes: `►` where a variable is narrowed to a more specific type, `◄` where a narrowing ends and the variable widens back to its declared type, and `◄►` where an assignment does both at once. Hovering a hint shows the types and the reason; on an `if` it shows the narrowing for both the taken and the not-taken branch. The same sigils appear in the code examples on this site.
:::

## narrowing in a condition

An `isa` test in an `if` condition narrows the variable to the tested type inside the then-branch. This holds for a union variant or a class:

<GhulExample name="control-flow-8" />

An [optional type](/optional-types) narrows the same way. A `?` test in the condition narrows the optional to its non-optional form in the then-branch, so the value can be used directly:

<GhulExample name="control-flow-9" />

For a two-variant union, the `else` branch is narrowed to the complementary variant:

<GhulExample name="control-flow-10" />

The `else` narrowing extends to a class hierarchy declared in the current assembly without `open`: the compiler knows every subclass, so ruling out the tested one narrows the `else` branch to the others. When an `abstract` root has exactly two subclasses, ruling out one leaves the other. The [object oriented programming](/object-oriented-programming) page covers open, closed, and abstract classes.

A `while` condition narrows its body the same way an `if` condition narrows its then-branch, so `while isa CAT(a) do a.purr() od` reaches a `CAT`-only member without an inner cast.

## flow-sensitive narrowing

Narrowing follows the control flow, not just the branch structure. A common shape is a guard: when the test fails, the guard leaves the block with `return`, `throw`, `break` or `continue`, so the code after the guard runs only when the test passed, and the value is narrowed there:

<GhulExample name="control-flow-11" />

## locals and parameters

Narrowing applies to local variables, including a function's own parameters.

<GhulExample name="type-inference-3" />

## fields and properties

Narrowing also applies to a member-access path like `x.field` or `x.property`. A presence test (`?`) narrows the path: after `if x.field? then`, uses of `x.field` inside the branch are non-optional.

<GhulExample name="type-inference-4a" />

An `isa` check or variant test narrows a path the same way:

<GhulExample name="type-inference-4" />

## narrowing on assignment

Reassigning a local narrows it: when the new value's static type is more specific than the declared type, the local narrows to that type from the assignment on, so a following call resolves on the assigned type without an `isa`:

<GhulExample name="control-flow-57" />

If the local is already narrowed, assigning a value of a different type cancels that narrowing and introduces one for the new type, so the following call resolves on the assigned type:

<GhulExample name="control-flow-56" />

## how long a narrowing lasts

A narrowing is a fact about a value at a point in the program, and values change: one that was present can be reassigned to null, and one that was a `CAT` can be replaced by some other `Animal`. So a narrowing has a lifetime, and the compiler works out where it ends.

A narrowing lasts at most to the end of the code the test covers - the then or else arm of the `if`, the loop body, or the rest of the block after a guard. It can end earlier, because the value can change before the block ends: by an explicit reassignment, or because a call to a function or method changes it, directly or indirectly.

The compiler tracks the calls that might do that, conservatively: it builds a call graph and works out which fields each call might write. A narrowing runs from the test to the first call the compiler cannot show left the value alone. From there the value reads at its declared type again, so a use that needed the narrowing - reading a member through it, or passing it where only the non-optional or narrower type is accepted - is an ordinary type error. The `◄` marks where the narrowing ended:

<GhulExample name="type-inference-22" />

When the compiler can prove that the calls in between could not have changed the value, the narrowing runs to the end of the block:

<GhulExample name="type-inference-5" />

Where it cannot, there are two ways out. Test the value again: `?`, `!`, `?.`, `isa`, and `if let` all check at run time and re-establish what they test, whatever calls came before. Or copy the value into a local variable:

<GhulExample name="type-inference-23" />

Narrowings of local variables are more stable than narrowings of fields and properties, because there are fewer ways a local variable can change: explicit reassignment, capture by a closure, or being passed by reference to another function. A local variable that is not `mut` cannot change at all, so its narrowing always lasts to the end of the block. That is why `if let` is the best way to get a narrowing that lasts: it copies the value into a fresh immutable local variable in one step, and works for any expression - the result of a call, not only a variable or path. See [if let](/control-flow.html#if-let) for the full construct.

## calls, purity, and stable

Whether a call can invalidate a narrowing depends on what the call can write. The compiler works this out from function bodies: a function that doesn't write anything that existed before the call cannot invalidate any narrowing, and most functions are proven that way with no annotation. Where the proof falls short, declare it with the postfix [`pure` modifier](/definitions.html#methods). The compiler trusts the declaration, and requires every override to be pure as well. The compiler treats some imported .NET collection mutators, such as `LIST.add` and `STACK.push`, as writing only their own receiver's internal state, so they invalidate only a narrowing that reads through that state.

A narrowing through a property has one more dependency: the property is read once at the test and again at each use, and every read calls the getter. The narrowing is only sound if the getter's later answers agree with the answer the test saw. The compiler proves that from the getter's body where it can. Where it cannot - a getter that can replace a cached value, for example - the test does not narrow at all, and the editor shows a hint at the test naming the getter. Declaring the property [`stable`](/definitions.html#properties) restores the narrowing: it promises that two reads with nothing between them agree on whether the value is present, and on its runtime type.
