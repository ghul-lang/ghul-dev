# generics

::: tip editable examples
Every example on this page can be edited and run here: click the pencil to open it in an editor, change it, and run it in your browser. Errors, hovers and completions come from the ghūl compiler as you type.

The [generics examples](/examples/generics) are whole programs you can run here, or build from the [ghul-examples repository](https://github.com/ghul-lang/ghul-examples).
:::

ghūl supports type parameters on
- classes
- structs
- traits
- methods
- unions
- global functions

A type parameter declares a named type, which can be used anywhere within its scope in type expressions.

In this global function, `T` is a type parameter, and it can be used within the function's definition and body.
When `print_something` is called, `T` is whatever type argument was supplied:

<GhulExample name="generics-1" />

<GhulExample name="generics-2" />

<GhulExample name="generics-3" />

<GhulExample name="generics-4" />

<GhulExample name="generics-5" />

Type arguments can be inferred for constructor calls as well as for function and method calls:

<GhulExample name="generics-6" />

A generic type used as a type needs its type arguments. Naming it without
them is an error:

<GhulExample name="generics-14" />

## open generics

An open generic is a generic type before any type argument is supplied.
Only reflection can hold one, so it can only be named as the operand of a
`typeof`. `BOX[_]` names the open generic, with one `_` for each type
argument the type takes, and it is the type `get_generic_type_definition()`
returns for any `BOX[T]`:

<GhulExample name="generics-13" />

A name can be declared at more than one generic arity, `BOX` and `BOX[T]`,
in which case a bare `BOX` in a `typeof` names the one that takes no type
arguments. `BOX[_]` names the generic one whatever other declarations
there are.

## type-parameter constraints

A type parameter can have one or more constraints, listed inside its declaration. Constraints restrict the types that callers can supply, and let the generic body use the operations those types are guaranteed to have. The compiler enforces all constraints, both for ghūl types that declare them and for types imported from .NET assemblies.

### type bound

A type bound `[T: SomeType]` requires the type argument to derive from `SomeType`. Within the generic body, the members of `SomeType` become available on values of type `T`.

<GhulExample name="generics-7" />

A value whose static type is a bounded type parameter also narrows and destructures through the bound, so `isa`, `if let`, and destructuring reach the bound's subtypes and variants directly, without first converting the value to the bound:

<GhulExample name="generics-10" />

Several bounds can be joined with `/\`. The value then behaves as every one of them - a member of any bound is reachable - and the actual type argument has to satisfy each. The comma spelling declares separate type parameters and is not a way to write two bounds:

<GhulExample name="generics-11" />

### members of the bound itself

The *static* members of a bound are reachable through the type parameter itself, written `T.member(...)`. This is how .NET's generic-math interfaces are used, and an operator declared as one of their static virtual members resolves as an ordinary operator once it has been imported by name with `use`:

<GhulExample name="generics-12" />

Without that `use` the operator is not in scope, and importing one leaves the built-in operators as they are. Each operator imports from the interface that declares it, so the addition operator comes from `IAdditionOperators` and the unsigned right shift from `IShiftOperators`. Comparison and equality cannot be imported this way - a type says how it orders and compares by defining `<>` and `=~`.

### kind constraint

A kind constraint requires the type argument to be a particular kind of type. Four keywords are recognised:

- `class`: a reference type
- `struct`: a value type
- `optional`: an optional (nullable) type
- `init`: a type exposing an accessible parameterless constructor

```ghul
class CELL[T: struct] is
    value: T
    init(value: T) is self.value = value si
si
```

Kinds combine with each other and with type bounds, space-separated: `[T: Named /\ Sized class init]`.

### constructor constraint

The `init` constraint requires the type argument to expose an accessible parameterless constructor:

<GhulExample name="generics-9" />

## variance

Type variance is declared on a *trait*'s type parameters (the CLR permits variance only on interfaces, which is what a ghūl trait compiles to). A `class` or `struct` cannot declare variant type parameters.

- `[T: out]`: covariant. `Producer[CAT]` is assignable to `Producer[ANIMAL]` when `CAT` derives from `ANIMAL`. Only legal when `T` appears in *output* positions (return types).
- `[T: in]`: contravariant. `Consumer[ANIMAL]` is assignable to `Consumer[CAT]`. Only legal when `T` appears in *input* positions (parameter types).

<GhulExample name="generics-8" />

Variance is also automatic in two places: a function type is contravariant in its parameter types and covariant in its return type; an array of a reference type is covariant.
