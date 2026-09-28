# unions and pattern matching

::: tip editable examples
Every example on this page can be edited and run here: click the pencil to open it in an editor, change it, and run it in your browser. Errors, hovers and completions come from the ghūl compiler as you type.

The [unions](/examples/unions) and [pattern-matching](/examples/pattern-matching) examples are whole programs you can run here, or build from the [ghul-examples repository](https://github.com/ghul-lang/ghul-examples).
:::

A union is a type whose values each hold one of a fixed set of variants. Each variant has a name and its own fields, or no fields at all. A `Shape` below is always either a `CIRCLE` or a `SQUARE`:

<GhulExample name="functional-programming-14" />

A variant's own fields can be read only from a value the compiler knows holds that variant. `if let`, `case` and `isa` each test which variant a value holds and narrow it to the variant they find. A union with one field-carrying variant, or with one variant marked `default`, can also use `?` and `!`. The [definitions page](/definitions.html#unions) covers declaring unions: unit variants, the `default` variant, primary-constructor headers, and traits.

## matching with if let

`if let c: CIRCLE = s` tests whether `s` holds a `CIRCLE`. If it does, the branch runs with a new local variable `c` holding the same value at type `CIRCLE`, so `c.radius` can be read directly. If it doesn't, `elif let` makes the next test:

<GhulExample name="functional-programming-18" />

The compiler doesn't check an `if let` chain for exhaustiveness, so `area` needs the final `return`. A `case` expression is checked.

## matching with case

A `case` expression tests one value, the scrutinee, against a series of `when` arms and evaluates the first arm that matches. Where the scrutinee's type is a [closed domain](/control-flow.html#exhaustiveness), such as a union, the compiler checks that the arms cover every value. The arms below cover both variants of `Shape`, so `area` doesn't need a fallback `return`, and leaving an arm out is a compile error:

<GhulExample name="functional-programming-23" />

A `when` arm takes the same patterns as `if let`: a type test with a new local variable (`c: CIRCLE`), or a destructure, whose literal leaves and `~`-marked leaves test values rather than define variables. An arm can end in a `/\` guard. When an arm's pattern or guard fails, the next arm is tried.

A `when` arm can instead list values. The compiler compares the scrutinee with each value the way `=~` does, so a string matches by its characters, and `when null` matches an absent value.

A unit variant has a single shared instance, so a `when` arm that names one covers that variant, the same as a type test. Arms that name every unit variant of a union cover it without an `else`:

<GhulExample name="unions-and-pattern-matching-1" />

A value in a `when` arm takes its type from the scrutinee, so a unit variant of a generic union doesn't need type arguments there: `when Option.NONE then` works over an `Option[int]`.

See [the case statement](/control-flow.html#case-statement) for more details.

## option-shaped unions

In a union with exactly one variant that has fields of its own, or with one variant marked `default`, the postfix `?` tests whether a value holds that variant, and `!` reads the variant's value, throwing if the value holds another variant. A variant with one field reads as that field; a variant with several fields reads as the variant:

<GhulExample name="functional-programming-16" />

The `Option` union here is declared only to show the shape. For a value that could be present or absent, use ghūl's optional types, `T?`, which work over reference types, value types and unconstrained type parameters. See [optional types](/optional-types) for more details, including how a union like this one compares with `T?`.

## testing a variant with isa

`isa Option.SOME(an_option)` tests whether `an_option` holds a `SOME`, and if it does, narrows `an_option` itself to `SOME` in the then-branch, without defining a new variable:

<GhulExample name="functional-programming-15" />

On a union with two variants, the `else` branch is narrowed to the other variant, so each branch can read its own variant's fields:

<GhulExample name="functional-programming-17" />

`isa` can test a member path such as `shape.outline`, or `self`, as well as a local variable. See [type narrowing](/type-narrowing.html) for more details.
