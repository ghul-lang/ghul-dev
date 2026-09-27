# definitions

## variables

In ghūl local variables are defined with the `let` keyword. A variable defined with a bare `let` cannot be reassigned: an initializer is required, and the compiler reports an error if the variable is assigned again. The type is inferred from the initializer:

<GhulExample name="definitions-1" />

A bare `let` fixes the variable, not the value: after `let xs = LIST[int]();`, `xs` always refers to the same list, but the list itself can still be mutated. Whether the value can change is a property of its type: a tuple or an array cannot be modified, a `LIST` can.

An explicit type can be given alongside the initializer. The initializer must be assignment compatible with the type:

<GhulExample name="definitions-2" />

The explicit type can be wider than the initializer expression:

<GhulExample name="definitions-3" />

A trailing `mut` makes the variable reassignable: `let total mut = 0;` defines `total` with initial value 0, and `total` can be assigned again later. A `mut` variable can also be defined with no initializer, as in `let result: int mut;`. It then starts at the default value of its type: zero, `false`, or `null`.

Either form can take its value from `_`, the default-value expression: `let x = _;` initializes `x` to the default value of whatever type the context expects, and `_[T]` names the type explicitly.

Multiple variables can be defined in the same `let` statement, with each variable either taking its type from its initializer or given an explicit one:

<GhulExample name="definitions-4" />

The name `_` is a discard placeholder. It can stand in for any variable name, but the value that would be assigned to it is discarded. `_` is accepted in `let` definitions, tuple destructuring, anonymous function parameters, and `for` loop variables:

<GhulExample name="definitions-5" />

`let` can be used only in a function, method or property body, or as a top-level statement in a file. Variable names should be in `snake_case`.

## functions

In ghūl functions consist of a name and a parenthesized formal arguments list, followed by an optional return type after `->` (omitting it makes the function `void`), and then either a return expression or a function body:

<GhulExample name="definitions-6" />

`=>` introduces a single-expression body, while the `is` and `si` keywords are used to delimit block bodies.

To return a value from a block body, you can end the body on it instead of writing `return`. Any statement that produces a value works: an expression, an `if`, a `case`, a parenthesised block. See [block bodies return their tail](/expression-oriented-programming.html#block-bodies-return-their-tail) for the rule in full.

<GhulExample name="definitions-53" />

A function can also be written among the statements of a body, with a name. It is a local variable holding a function literal, so its argument and return types can be inferred as a literal's are, and it can call itself by its own name:

<GhulExample name="definitions-54" />

A function declared at namespace scope can be overloaded on its argument types, and each call goes to the overload whose parameters fit its arguments best. Where a generic and a non-generic overload fit equally well, the compiler chooses the non-generic one if each of its parameters is at least as specific as the generic's, once the generic's type arguments are known: `f(items: List[string])` is chosen over `f[T](items: Iterable[T])` for a `string[]`, and `f(items: object)` is not.

Functions can be generic, which will be covered later. Function names should be in `snake_case`.

### the entry point

A program starts at a function named `entry`, or at the statements written at the top level of a file with no namespace. `entry` can take the command-line arguments as a `string[]`, the process environment as a `Ghul.Environment`, both, or neither, and returns either no value or an `int` exit status:

<GhulExample name="definitions-55" />

Top-level statements see the same two values as `args` and `env`.

A function that the program would start at but that has any other shape is reported, naming what rules it out:

<GhulExample name="definitions-56" />

## arguments

Arguments consist of a name followed by a type. The type is mandatory as the compiler cannot infer types here.

<GhulExample name="definitions-7" />

A formal argument can also be a tuple-destructure pattern, written in its own parentheses. It is still one argument, with the written tuple type; when the function is called, the value is unpacked into the names the pattern gives. Named functions, anonymous functions, asynchronous functions and generators all accept them, and the type can be any type that destructures positionally:

<GhulExample name="definitions-51" />

## types

### classes

Classes consist of a name optionally followed by a superclass name and the types of any traits implemented, and then the class body. The class body is delimited by keywords `is` and `si`:
<GhulExample name="definitions-8" />

A class defines a new reference type, instances of which are assignment compatible with its superclass type and any traits it implements.

Instances of classes are created via a constructor expression, which consists of a type expression followed by a parenthesis delimited list of actual constructor arguments. For a class, the type expression is the class name, qualified with any namespaces if needed:
<GhulExample name="definitions-9" />

A class can also declare its constructor parameters directly in the header. Each parameter becomes a parameter of the synthesised constructor, and a synthesised same-named field or property holds the supplied value:
<GhulExample name="definitions-8a" />

The two forms are equivalent. The primary form is the shorter shape when every field is initialized from a constructor argument; the classic form is the better fit when the body owns extra fields or properties beyond what the constructor takes. See [constructors](#constructors) for more on primary constructors.

Two postfix modifiers control the class hierarchy. Without `open`, a class can be subclassed only within the assembly that declares it; `open` allows subclassing from other assemblies. `abstract` means the class itself cannot be constructed: only its subclasses can. A class is also implicitly abstract when it declares an instance method with no body, because that method is a contract for subclasses to satisfy.

Because the compiler knows every subclass of a closed class, an `isa` test can narrow in the else branch too: ruling out the tested subclass leaves the others, and when an `abstract` root has exactly two subclasses, ruling out one leaves the other. See [type narrowing](/type-narrowing.html).

A class has no `=~` unless it defines one. `@equality()` before a class asks the compiler to synthesise `=~` and a matching `get_hash_code`, comparing the members that hold the class's state, so .NET collections find an equal value as well as the same object:

<GhulExample name="definitions-57" />

Two values are equal only when they are the same class. A subclass of a class that asks for equality has to ask for its own, or define `=~` and `get_hash_code` itself. `@equality()` cannot be used on an `open` class, or on one that already defines any of `=~`, `<>`, `get_hash_code` or `equals`.

Classes can only be defined at global scope. Classes can be generic, which will be covered later. Concrete class names should be in `MACRO_CASE`. Abstract class names should be in `PascalCase`.

### structs

Structs consist of a name, then the types of any traits implemented, and then the struct body again enclosed in `is` / `si`. A struct can also use the primary-constructor header form:
<GhulExample name="definitions-10" />

Structs are constructed the same way as classes, with a constructor expression:
<GhulExample name="definitions-11" />

A struct defines a new value type. Assigning a struct copies all of its fields, so the copy and the original are independent afterwards:
<GhulExample name="definitions-12" />

`==` is not defined for structs: it would compare the bytes of the value rather than its members. `=~` compares structs instead. For a struct whose members are all public and that declares no equality of its own, the compiler synthesises `=~` and a matching `get_hash_code`, comparing its members one by one:

<GhulExample name="definitions-58" />

The compiler doesn't synthesise these for a struct with a non-public member, or for one that declares any of `=~`, `<>`, `get_hash_code` or `equals`. Define that struct's equality as described under [defining operators](#operators) and, for the .NET side, under [making your own types work with .NET](/dotnet-integration.html#equality).

Structs can only be defined at global scope. Structs can be generic, which will be covered later. Struct names should be in `MACRO_CASE`.

### traits

A trait consists of a name, the types of any parent traits that must also be implemented, and then the trait body:

<GhulExample name="definitions-13" />

Traits are similar to interfaces in other languages. Trait methods and properties without a default implementation must be implemented by any class, struct, or union that declares the trait:
<GhulExample name="definitions-14" />

A trait method or property can provide a default body. Implementing classes inherit the default and only need to override it to change the behaviour:

<GhulExample name="definitions-15" />

A class override can call the trait's default with `super.method()`.

Traits can only be defined at global scope. Trait methods and properties can be abstract or have a default implementation. Trait names should be in `PascalCase`.

Like a class, a trait is closed to other assemblies unless it has the postfix `open` modifier. A closed trait can be implemented and derived from only within the assembly that declares it; `open` opts in to cross-assembly extension.

### unions

A union consists of a name and then a union body, which contains one or more variants. Each variant has a name, and then an optional list of fields:
<GhulExample name="definitions-16" />
Unions are a reference type. A reference of union type can point to only one variant at a time. To discover which variant a union currently holds, test it with `isa Variant(value)`:

<GhulExample name="definitions-17" />

`isa Variant(value)` does two things at once: it tests the variant, and within the then-branch it narrows the value to that variant, so the variant's own fields are accessible directly:

<GhulExample name="definitions-18" />

Unions support structural equality through the `=~` operator. Two union references compare equal when they hold the same variant with member-wise equal fields:

<GhulExample name="definitions-19" />

A variant with no fields is a *unit variant*. It is referenced by name, without parentheses, and all uses of a unit variant share one value. When exactly one variant of a union has fields, the union behaves as an option type: `u?` tests whether `u` holds that variant, and `u!` unwraps its value. A union where several variants have fields can mark one of them `default` to get the same behaviour:

<GhulExample name="definitions-41" />

A union can declare a primary-constructor header for state shared across every variant. Each variant splices the shared parameters into its field list with `..`, and a variant with no extra fields drops the list entirely. A union can also implement traits after its header, with each trait member satisfied by a default or by a property the union supplies:

<GhulExample name="definitions-42" />

Unions can only be defined at global scope. Union names should be in `PascalCase` and variant names should be in `MACRO_CASE`.

### enums

An enum consists of a name and then an enum body, which contains one or more elements. Each element has a name and an optional constant integer value.

<GhulExample name="definitions-20" />

Enums can only be defined at global scope. An enum type name should be in `PascalCase`, and its members in `MACRO_CASE`.

Enum values compare for equality and order: `=~` and `==` compare by the underlying integer, and `<`, `<=`, `>` and `>=` order by it. `=~` works over an optional enum as it does over any other optional. An individual member can be imported by name - `use Some.Namespace.Suit.HEARTS` - as well as reached through the type.

An enum marked `@System.Flags()` also gets the bitwise operators `&`, `|`, `^` and the unary `\`, each taking and returning the enum's own type, and its values print as the names they combine:

<GhulExample name="definitions-59" />

The compiler rejects these operators on an enum without the attribute, since its members are not meant to combine.

### partial and impl blocks

A `partial` block adds members to a class, struct, or union declared elsewhere in the same assembly, even in another file. The added members are ordinary members of the target, exactly as if they were written in the type's own body: public or private according to their names, virtual as usual, and with access to the type's private members. For a union, whose body holds only variants, a `partial` block is the only way to give the type methods:

<GhulExample name="definitions-43" />

An `impl Trait for Type` block additionally makes the target implement a trait, so a type can satisfy a trait without naming it in its header. The trait's type arguments are written on the target after `for`, and inside the body `self` has the concrete target type, so a union's variants can be matched directly:

<GhulExample name="definitions-44" />

The target can be a qualified name, including a single union variant (`impl Printer for List.NIL`). The interface must be a trait, and the target a type declared in the same assembly; an imported type cannot be reopened.

Every method or property accessor that a `partial` or `impl` block adds to a union must be pure. Either the compiler must be able to prove from the body that the member does not write to the heap, or the member must be declared `pure`; one that writes and is not declared is reported with an `impure-union-method` warning.

## properties

A property consists of the property name followed by the property's type and, optionally, bodies for getter and setter methods.

<GhulExample name="definitions-21" />

Public properties with no getter or setter are automatically backed by a hidden field. Private properties with no getter or setter are implemented as a plain field.

A property can take a postfix `stable` modifier. It addresses a problem specific to narrowing through a property: every read of the property calls the getter, so a narrowing like `if p.value? then ... p.value ...` is only sound if the second read agrees with the first. The compiler proves that from the getter's body where it can. Where it cannot - a getter that fills a cache, for example - declaring the property `stable` states the promise instead. The promise is narrow: two reads with nothing between them agree on whether the value is present, and on its runtime type. It does not say the value never changes - other code can still write to what the getter reads, and a call between two reads is judged the same way as for any other narrowing:

<GhulExample name="definitions-48" />

`stable` is a contract like `pure`: every override must itself be stable, declared or proven from its body.

Properties can be defined globally and within classes, structs and traits. Property names should be in `snake_case`.

## methods

Methods are syntactically the same as functions, except they are defined within classes, structs or traits.

<GhulExample name="definitions-22" />

A method or function can take a postfix `pure` modifier. It declares that the function does not write to the heap: it assigns no field, property, or array element of any object. The compiler proves this from the body for most functions without needing the modifier. The declaration matters to [type narrowing](/type-narrowing.html#calls-purity-and-stable): a call can invalidate a narrowing, because the callee might assign the member the narrowing depends on, but a call to a pure function cannot, so the compiler keeps narrowings across it. The modifier exists for bodies the compiler cannot prove; it is trusted as declared, and every override of a pure member must itself be pure:

<GhulExample name="definitions-45" />

A `pure` declaration is trusted, not checked. A function whose writes are not observable to callers, such as one that fills a cache or interns a value, can be declared `pure`. The compiler does not track what a declared-pure function writes. If a write does turn out to be observable, narrowings are unsound across calls to the function: code can rely on a value being present, or having a type, that the write no longer supports, and no error or warning reports it. A property getter that fills a cache is not this case - its write is to the state its own answer comes from - so declare it `stable`, described under [properties](#properties), rather than `pure`.

`pure` can also be written on a class, struct, or trait header. Every instance member of the type must then be pure: either the compiler must be able to prove from the member's own body that it assigns no field, property, or array element of any object - its own included - or the member must be declared `pure`. A member that writes and is not declared pure is reported as an error. Writes that are part of a type's normal operation are exempt: constructors assign fields, and static members can keep their own state.

A pure type also cannot expose a write to its callers. Declaring a property `public` would make its assign accessor callable from outside, so it is rejected; a getter that writes through an assign accessor is rejected too, because a caller sees a getter as a read. A member declared with no body in a pure type is implicitly `pure`, so a pure trait holds every implementing type to the same rule.

`pure` on a union is an error. Union members are held to purity through their `partial` and `impl` blocks regardless:

<GhulExample name="definitions-52" />

As with functions, methods should be named in `snake_case`.

## operators

An operator is a function or method whose name is an operator symbol rather than a word; there is no `operator` keyword. As an instance method the receiver is the left operand, so a binary operator takes a single parameter for the right operand:

<GhulExample name="definitions-46" />

Written as a global function or a `static` member instead, an operator takes both operands as parameters: `+(a: VECTOR, b: VECTOR) -> VECTOR`. A prefix operator is always a one-parameter function, defined globally or in the operand's type.

Every operator has a precedence taken from its first character, so an operator starting with `*` binds tighter than one starting with `+`, with no declaration needed. Unicode symbols count as operator characters and take the precedence of the ASCII operator they resemble, so `⊗` binds like `*` and `⊕` like `+`:

<GhulExample name="definitions-60" />

The `@precedence` pragma places an operator in a specific band when the default doesn't suit it: before a definition it covers that definition, and written as `@@precedence` at the start of a file it covers the rest of the file.

The comparison operators come from two backing operators. Define `<>`, a three-way ordering that returns a negative, zero, or positive `int`, and `<`, `<=`, `>`, and `>=` follow from it; define `=~`, an equality returning `bool`, and `!~` follows as its negation:

<GhulExample name="definitions-47" />

Operators can be defined globally, or as members of classes, structs and traits. An operator name is any run of symbol characters, such as `+`, `**`, `##`, or `∩`.

## constructors

In ghūl methods named `init` are constructors. When an object is constructed using a constructor expression, the corresponding `init` method overload will be called based on the actual argument types:

<GhulExample name="definitions-23" />

Constructors can be defined in classes and structs.

A member whose type is not optional has to be assigned before the constructor finishes. The compiler tracks which members each constructor definitely assigns, and reports a `field-definite-assignment` warning on a constructor that can finish with one or more of them unassigned, naming each one: the object it produces would hold null in a member whose type does not allow it:

<GhulExample name="definitions-49" />

An assignment counts if it happens on every path through the constructor: either the constructor assigns the member itself, or it calls a method on `self` that does, and that call itself happens on every path. A method call that might not happen, or that a subclass could override, does not count, and neither does an assignment to another object's members. Optional members are allowed to be absent, and value-type members cannot hold null, so neither is checked. Suppress with `@suppress("field-definite-assignment")` on the constructor or the file, or project-wide.

### primary constructors

When the constructor only assigns its arguments to same-named fields, the class or struct header can declare those parameters directly. The compiler synthesises the matching `init` and a same-named field or property for each parameter:

<GhulExample name="definitions-37" />

A trailing modifier on a primary parameter overrides the default visibility:

- `x: int public` - public read and write.
- `x: int protected` - readable from the declaring class and its subclasses.
- `x: int field` - plain field rather than the default auto-property.
- `_x: int` - private field, named `_x`.
- `x: int init` - no field is generated; `x` is in scope only inside `init`.

An explicit field or property declaration whose name matches a primary parameter, either exactly or as `_x` matching parameter `x`, replaces the synthesised member; the constructor assigns the parameter's value to it. Declaring `_x;` for a parameter `x` is also how to give the underlying storage a different name without a modifier suffix:

<GhulExample name="definitions-38" />

A class with a primary header can also include a `super(...)` body declaration that forwards expressions to its superclass `init`, and secondary `init(.., extras)` overloads. The `..` expands to the primary parameters, and a secondary constructor calls the primary `init` before running its own body:

<GhulExample name="definitions-39" />

A primary-constructor class or struct also gets a synthesised `deconstruct` built from its public-readable parameters, so `let (x, y) = POINT(3, 4)` destructures without writing one out.

A class or struct with a primary header and no body declarations can end with a terminating `;` instead of `is ... si`:

<GhulExample name="definitions-40" />

The classic form is the better fit when the body owns extra fields or properties beyond what the primary parameters cover.

## namespaces

Namespaces are introduced with the `namespace` keyword followed by the namespace name and then the namespace body.

<GhulExample name="definitions-24" />

Namespaces can be nested inside other namespaces:
<GhulExample name="definitions-25" />

A dotted namespace name is shorthand for nesting namespaces:

<GhulExample name="definitions-26" />

### namespace aggregation

A namespace definition is an instance of that namespace. Namespace instances are aggregated across all source files to form a single namespace scope. This means that all definitions within a namespace instance are visible unqualified within all other instances of that namespace in all source files:

`source-file-1.ghul`{:text}:
<GhulExample name="definitions-27" />

`source-file-2.ghul`{:text}:
<GhulExample name="definitions-28" />

### definitions outside any namespace

If a source file contains no namespaces, then all definitions in the file are placed in a namespace the compiler synthesises, private to that source file, and the file can have [top-level statements](/syntax.html#top-level-statements) that run as the program's entry point. This is useful for examples and tests:

<GhulExample name="definitions-29" />
For definitions to be visible from other files, they must be placed in an explicitly declared namespace.

### namespace usage consistency

If a source file contains any explicitly declared namespaces, then all definitions in that file must be within a namespace. Bare definitions outside of namespaces are not allowed in files with namespace declarations:

<GhulExample name="definitions-30" />

## importing symbols with `use`
Symbols can be brought into the current namespace instance's scope using the use keyword. Imported symbols can then be used without qualification:

<GhulExample name="definitions-31" />

`use` applied to a namespace imports all symbols from that namespace:
<GhulExample name="definitions-32" />

A function you declare and an imported function of the same name form one overload group, and the compiler resolves each call between them as it does [any overloads](#functions).

The other forms of `use` - `use default`, wildcard imports and type aliases - are covered under [imports](/syntax.html#imports).

Note that `use` only applies within the current `namespace` definition. It does not import a symbol into all instances of the current namespace:

<GhulExample name="definitions-33" />

## visibility of symbols

In ghūl, the visibility of symbols outside their defining scope is managed by a naming convention which is partially enforced by the compiler. The compiler also warns when a declaration's name doesn't match the convention for its kind - `non-snake-case-name`, `non-pascal-case-name`, or `non-upper-snake-case-name` - each suppressible per declaration, per file, or project-wide. A class with only `static` members is a utility container that is never constructed, and accepts either `PascalCase` or `MACRO_CASE`.

### global symbols

Classes, structs, traits, unions, global functions and global properties are accessible from any namespace. Prefixing their names with `_` makes them private to the assembly they are declared in: within the assembly they stay reachable from any namespace, but another assembly cannot see them, and a reference from one is a compile error:
<GhulExample name="definitions-34" />

### methods

Methods are public unless their name starts with `_`, which makes the method private: it is visible only within its declaring class, and the compiler enforces that:
<GhulExample name="definitions-35" />

### properties
Properties are public to read but private to assign - a property is assignable only within its defining type. A property whose name starts with `_` is private to read as well:
<GhulExample name="definitions-36" />

### protected access

The rules above describe the default, `--underscore-access private`{:sh}. Compiling with `--underscore-access protected`{:sh} instead widens an underscore member's reach to the declaring class and its subclasses within the same assembly, for a codebase that relies on subclasses reading `_` members. Underscore types, global functions and global variables are unaffected - they are private to their assembly under either setting.
