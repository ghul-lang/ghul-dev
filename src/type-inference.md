# type inference

::: tip editable examples
Every example on this page can be edited and run here: click the pencil to open it in an editor, change it, and run it in your browser. Errors, hovers and completions come from the ghūl compiler as you type.

The [type inference examples](/examples/type-inference) are whole programs you can run here, or build from the [ghul-examples repository](https://github.com/ghul-lang/ghul-examples).
:::

Inside a function body, you rarely need to write a type. Local variables, loop variables, destructured variables, anonymous function parameters and generic type arguments are all inferred - from initializers, from the context an expression sits in, and from how a value is used later in the same body. You get the checking of static types without typing most of them: in the compiler's own source, over 90% of local variables have no type annotation, and most of the annotations that remain are deliberate - declaring a variable at a wider type than its initializer, or as reassignable before it has a value - rather than places inference needed help.

A function's parameter and return types are always explicit, and so are fields, properties and global variables declared at namespace scope. Keeping them explicit is what keeps inference **function-local** - types inferred within one function are not visible outside it, and a type error always points into the body being edited rather than into another function entirely.

Mechanically it is bidirectional, constraint-based inference: types flow up from expressions and down from the contexts that use them, and the compiler re-walks each function body until every inferred type is known. The [implementation page](/implementation#type-inference) describes how.

Within a function, types are inferred for:

- local variables
- loop variables
- destructured variables
- anonymous function parameters
- anonymous function return types
- generic type arguments on calls to constructors, methods, static methods and global functions

In each case the inferred type is concrete. The compiler does not introduce new type parameters during inference, so an anonymous function literal takes a single concrete function type from its context - it cannot itself be generic. For polymorphic behaviour, declare a generic global function or method and pass it where the function value is needed.

ghūl also performs [type narrowing](/type-narrowing.html) - within parts of a function a value can be observed at a more specific type than the one it was declared with. Inference and narrowing work together: the inferred type is the widest type a variable has, and narrowing gives it a more specific type wherever the control flow proves one.

The examples below leave inferred types unannotated; hover over any variable to see the type the compiler worked out for it.

## what stays explicit

Type inference is local to a function body. The signature of a global function or a method is always written out in full:

<GhulExample name="type-inference-1" />

Fields and properties belong to a type rather than to a function body, so their types are written out too - for private members as well as public ones.

<GhulExample name="type-inference-2" />

## what gets inferred

### let statements and expressions

When no explicit type is given for a variable in a let statement or expression, its type is inferred from the initializer, provided one is present.

<GhulExample name="type-inference-7" />

### destructuring variables

A destructuring `let` declares several variables at once from a tuple. Each variable takes its type from the corresponding element of the right-hand side, and the pattern can nest.

<GhulExample name="type-inference-8" />

### for loop variables

A `for` loop variable takes its type from the element type of the iterable being looped over. A loop variable can be destructured: when the element type is a tuple, each destructured name takes the type of its element.

<GhulExample name="type-inference-9" />

### array literal element types

The element type of an array literal is inferred from the types of the elements: the compiler finds a type compatible with all of them.

<GhulExample name="type-inference-10" />

If an array literal contains tuple literals, the compiler finds a compatible common type for each tuple element across all elements of the array.

<GhulExample name="type-inference-11" />

### if expression result types

The result type of an if expression is inferred from the types of all the branch results: the compiler finds a type compatible with all of them.

<GhulExample name="type-inference-12" />

### generic class, struct and variant constructors

When constructing a generic class, struct or variant, the generic type arguments are inferred from the constructor method arguments where possible.

<GhulExample name="type-inference-13" />

Inference from the constructor arguments works when every type argument appears among those arguments and the constructor overload is unambiguous. A type argument that the constructor arguments do not determine - with a no-argument constructor, say - can still be resolved from later use of the value (see [inference from later use sites](#inference-from-later-use-sites)).

### generic function and method calls

When calling a generic global function, a generic method, or a static method on a generic class or struct, the compiler infers the generic type arguments from the types of the actual arguments passed.

<GhulExample name="type-inference-14" />

### anonymous function return types

The return type of an anonymous function literal is inferred from the type of its expression body, or from the types of the return expressions and the final expression in its block body.

<GhulExample name="type-inference-15" />

### anonymous function argument types

When an anonymous function literal is passed as an argument and an unambiguous overload match can be made without knowing the exact function type, the compiler infers the argument types from the matching overload.

<GhulExample name="type-inference-16" />

Here the array is already known to hold `int`, so `filter` must be given a predicate of type `int -> bool`, and the type of `i` must be `int`.

## inference from later use sites

The sections above infer a type from a declaration's initializer or from a call argument. Because inference spans the whole function body, the compiler can also work the other way: when a declaration gives no type on its own, a later use of the variable in the same body can supply one.

<GhulExample name="type-inference-17" />

The same applies to anonymous functions whose argument types are not explicit: if a later call supplies a concrete type, that flows back to the function literal.

<GhulExample name="type-inference-18" />

### recursive anonymous functions

In a recursive anonymous function, the argument type can be inferred from how the function is called, including from its own recursive calls.

<GhulExample name="type-inference-19" />

### operations on a not-yet-inferred value

When an anonymous function's parameter has no annotation, every operation the body performs on it - a member access, a method call, an index, an iteration, a destructuring - is recorded as a constraint on the parameter's type. Whatever type is eventually inferred for the parameter must satisfy all of them.

<GhulExample name="type-inference-20" />

The call passes a `string`, and `string` has a `length` member, so `x` resolves to `string`. When a call site leaves room for more than one type, a candidate that does not support every recorded operation is discarded.

### generic argument inference from sibling actuals

When a generic function or method is called with two arguments that share only a common ancestor, the type argument is inferred as their nearest shared type.

<GhulExample name="type-inference-21" />