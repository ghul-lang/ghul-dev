# object oriented programming

::: tip editable examples
Every example on this page can be edited and run here: click the pencil to open it in an editor, change it, and run it in your browser. Errors, hovers and completions come from the ghūl compiler as you type.

The [object-oriented examples](/examples/object-oriented) are whole programs you can run here, or build from the [ghul-examples repository](https://github.com/ghul-lang/ghul-examples).
:::

ghūl is a class-based object-oriented language. Classes and structs hold state and behaviour, traits describe shared behaviour, and a value can be used at the type of any ancestor class or trait it satisfies. The [definitions](/definitions.html#types) page has the syntax for each in isolation.

## classes and objects

A [class](/definitions.html#classes) defines a reference type: fields and properties for its state, methods for its behaviour, and one or more `init` constructors. An object is an instance of a class, created by calling the class like a function, as in `POINT(3, 4)`. `self` refers to the current instance inside a method. A class with no declared superclass extends `object`, and `==` compares objects by reference identity. A class compares by value with `=~` only when it defines `=~` or asks for it with `@equality()`.

## encapsulation

There are no `public` or `private` keywords. A leading underscore on a name marks it non-public, and the compiler enforces it: `_balance` is reachable only within the class that declares it, while `balance` is public to read. A property is public to read but assignable only within its defining type, so state stays behind the methods that maintain it.

## inheritance

A class extends at most one superclass, named after a colon in the header, and inherits its members. A constructor runs the superclass constructor with `super.init(...)`, and a method replaces an inherited one by declaring it again. A call to that method dispatches on the object's runtime type, so a method inherited from the superclass reaches the override:

<GhulExample name="object-oriented-programming-2" />

Calling `describe` through the `Animal[]` is polymorphism: the static type is `Animal`, the behaviour is each subclass's overriding `speak`.

## abstract and closed classes

`speak` above has no body. A class with a body-less instance method is implicitly abstract: it names a method the class can't perform on its own, so constructing the class directly is rejected and only subclasses that supply the method can exist. Marking a class `abstract` has the same effect without a body-less method.

By default a class is closed to subclassing outside its own assembly; the postfix `open` modifier opts in to cross-assembly subclassing. Closing the hierarchy lets the compiler narrow on the `else` edge of an `isa` test, and an `abstract` root can narrow to a single remaining subclass (see [type narrowing](/type-narrowing.html)).

## traits

A [trait](/definitions.html#traits) is ghūl's interface: a set of members a type promises to provide. A class, struct, or union implements a trait by naming it in the header, and the value can then be used at the trait's type wherever the trait is expected. A class extends one superclass but implements any number of traits. A type can also implement a trait from a separate [`impl … for` block](/definitions.html#partial-and-impl-blocks) instead of naming it in the header, which is how a union gains trait methods.

A trait member can provide a default body. An implementing type inherits the default, and can override it with different behaviour, reaching the default with `super`. Traits combine with generics: a generic trait like `Operation[T]` gives a whole family of implementations one shared shape.

## narrowing

`isa` and `if let` test an object's runtime type and narrow the value to it inside the matching branch, and a `case` over a closed hierarchy is checked for exhaustiveness. The [type narrowing](/type-narrowing.html) page covers it in full.

## a generic calculator

<GhulExample name="object-oriented-programming-1" />
