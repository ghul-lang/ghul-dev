# language basics

## syntax

ghūl syntax is inspired by a number of non-brace languages, including ALGOL 68 and Pascal

### identifiers and keywords

Identifiers in ghūl follow the convention of `snake_case` for variables, functions, methods, and properties, `PascalCase` for namespaces, traits, abstract classes, unions, and enums, and `MACRO_CASE` for concrete classes, structs, variants, and enum members. ghūl keywords are lowercase.

An identifier can be written in any script. A letter starts one, and a letter, a digit, a combining mark or a connecting punctuation mark continues one. The compiler reports a format character inside an identifier - a zero-width joiner, a bidirectional control - as an error, because such a character renders as nothing and a name that contains one reads as a name it is not. The compiler accepts characters from the basic multilingual plane only: a character above that plane is written as a surrogate pair, and the compiler reads a surrogate pair as two characters.

A letter is never a symbol, so no character is both an identifier character and an [operator](/definitions.html#operators) character. `×` is an operator and `naïve` is a name.

The compiler checks the conventions above with Unicode case. A character that has an upper-case and a lower-case form is checked for its kind whatever script it is in, so `ТИП` is a concrete class and `μέγεθος` is a property. The compiler doesn't check the case of a character with neither form, so a name written entirely in a script that has no case - Chinese, Japanese, Arabic, Hebrew - is correct for any kind.

<GhulExample name="language-basics-identifiers" />

ghūl relies on keywords for block structure where other languages use braces or indentation. Keywords are context specific and generally come in pairs where the closing keyword is the reverse or mirror image of the opening keyword. In the examples below `is` introduces a method or class body and its block is closed by the reverse keyword `si`

<GhulExample name="language-basics-1" />

### expressions and statements
Expressions in ghūl are constructs that return a value, while statements perform actions. All expressions can be used where statements are allowed, and most statements can be used as expressions. In a function or method body the last statement is the value the body returns, whenever the type of that statement is assignable to the declared return type. See [expression oriented programming](/expression-oriented-programming.html) for the forms working together.

<GhulExample name="language-basics-2" />

### function declarations
Functions in ghūl are declared with a name, a list of parameters in parentheses, an optional return type after `->`, and a body enclosed in `is` and `si` keywords.

<GhulExample name="language-basics-3" />

Functions can also have an expression body using `=>` instead of `is` / `si`:
<GhulExample name="language-basics-4" />

### control flow
ghūl supports various [control flow constructs](/control-flow.html) like `if`, `else`, `while`, `for`, and `case` expressions.

<GhulExample name="language-basics-5" />

### types

ghūl is statically typed, with some support for [type inference](/type-inference.html). Types can be explicitly specified using a colon `:` plus a type expression

<GhulExample name="language-basics-6" />
[User types](/definitions.html#types) are defined using `class`, `struct`, `trait`, `enum`, and `union` keywords.

## built-in data types

ghūl's built-in data types are primitive types, arrays, tuples, and optionals.

### primitive types

ghūl provides the following primitive data types:

* integer types: `byte`, `ubyte`, `short`, `ushort`, `int`, `uint`, `long`, `ulong`, `word`, `uword`
* arbitrary-precision integer type: `bigint`
* floating-point types: `single`, `double`
* decimal floating-point type: `decimal`
* boolean type: `bool`
* character type: `char`
* void type: `void`

<GhulExample name="language-basics-7" />
These types are used to represent basic values in ghūl programs.

`bigint` is an integer with no fixed width, so it never overflows. It is .NET's `System.Numerics.BigInteger` under a built-in name. A literal with an `n` suffix is a `bigint`, and a value of another integer type converts to one with `bigint(...)`:

<GhulExample name="language-basics-31" />

As with the other numeric types, the operands of an arithmetic operator must have the same type: `total * 2` is rejected where `total` is a `bigint`, and `total * 2n` is the way to write it.

### arrays

ghūl supports arrays, which are fixed-size, **read-only** collections of elements of the same type. Array types are denoted using square brackets [] after the element type.

<GhulExample name="language-basics-8" />

Arrays can be constructed with an [array literal](/expressions.html#array)
<GhulExample name="language-basics-9" />

Array elements can be read with indexer syntax
<GhulExample name="language-basics-10" />

Indexing with a range takes a slice rather than a single element. `..` excludes its end and `::` includes it, as they do everywhere else. `..<` counts its end back from the end of the source, and `..<<` counts both ends back, so `..<0` runs to the end:

<GhulExample name="language-basics-34" />

A slice is a view onto the source, not a copy. Arrays, strings and lists can all be sliced; slicing a string gives back a string.

### tuples
Tuples in ghūl are lightweight, immutable data structures that can hold a fixed number of elements of different types. Tuple types use parentheses `(` `)`, with elements separated by commas. Tuple literals are similarly constructed with `(` `)` and comma delimited elements. Tuples compare by structural equality: two tuples are equal when their corresponding elements are.

<GhulExample name="language-basics-11" />

Compare tuples with `=~`. The `==` operator is rejected on a tuple, as it is on any struct, because it would compare the value's bytes rather than its elements:

<GhulExample name="language-basics-35" />

Tuple elements can be accessed using the dot `.` notation followed by the element name:

<GhulExample name="language-basics-12" />

Tuple elements can be given more descriptive names, either in the type or in the tuple literal:
<GhulExample name="language-basics-13" />

ghūl also supports tuple destructuring:
<GhulExample name="language-basics-14" />

Destructuring also has a by-name form, `(local = field, ...)`, that pulls each element from a named field rather than by position; the positional and by-name forms are covered with [pattern matching](/control-flow.html#if-let).

### optional types

A type followed by `?` is an **optional** type: a value of `T?` can be present or absent. The same type written without the `?` is non-optional, and a non-optional value is always there.

<GhulExample name="language-basics-15" />

The postfix `?` operator tests whether an optional has a value. A plain `if x?` narrows `x` to its non-optional form inside the branch, so the value reads directly:

<GhulExample name="language-basics-16" />

A non-optional type never holds the absent case, so a `T?` is not assignable to a `T`. The compiler rejects it rather than warning:

<GhulExample name="language-basics-18" />

To pass a `T?` where a `T` is wanted, make the value present first: narrow it with `if x?` or `if let` (see [control flow](/control-flow.html#if-let)), assert it with `x!` (which throws when absent), or supply a fallback with `x ?? other`. Optional types work for reference types, value types, and type parameters that could be either, and a type with `has_value` and `value` properties is treated as optional too. The [optional types](/optional-types) page covers all of these, the `??` and `?.` operators, and the warnings the compiler reports on optional handling.

### type conversions

ghūl does not perform implicit type conversion (coercion) between scalar types; all scalar type conversions must be explicitly cast. However, ghūl supports polymorphic behavior by allowing upcasting, where instances of derived classes or interfaces can be automatically coerced to compatible ancestor types in the class/interface hierarchy.

<GhulExample name="language-basics-20" />

A scalar type is also a constructor from any other scalar, converting exactly as a cast to it does: `double(n)` is `cast double(n)`, and `int(x)` truncates as `cast int(x)` does. Where the context already fixes the type, `_(n)` converts to it. The source has to be a scalar, so `int("42")` is not a parse:

<GhulExample name="language-basics-scalar-constructors" />

## variables

ghūl has three kinds of variables: locals declared within the body of a function or method, function or method arguments and variables captured by a function literal.

### locals

Local variables are declared with `let` followed by the variable name, an optional explicit type, and an initializer:

<GhulExample name="language-basics-21" />

### arguments

Arguments will be covered in detail with functions and methods, but the basic form is the argument name followed by its type.

<GhulExample name="language-basics-22" />

### captured variables
Variables captured by a function literal will be covered with [function literals](/expressions.html#capturing-and-closure). They are not declared: a function literal captures the variables its body uses.

### scope

The scope of all variable definitions is from the point of declaration to the end of the innermost block that contains the declaration. Blocks will be covered later, but generally a block is a control flow statement or a function or method body.

### type inference and explicit types
ghūl infers the type of a local variable from its initializer. An explicit type can be given alongside; it's a compile time error if the initializer is not assignment compatible with it.

## literals
Literal expressions represent fixed values of a specific type.

<GhulExample name="language-basics-23" />

An integer literal can be written in hexadecimal with a `0x` prefix, and can end with a suffix that picks its type: `123L` is a `long`, `0ub` is a `ubyte`, `65c` is a `char`. The digits are read first and as far as they go, so in a hex literal `b` and `c` are digits rather than suffixes. A backtick separates a suffix that would otherwise be read as a digit:

<GhulExample name="language-basics-33" />

In a string or character literal, `\u` followed by exactly four hex digits writes a character by its code. A character above `U+FFFF` is written as its two surrogate halves:

<GhulExample name="language-basics-32" />

A run of octal digits after a `\` is the older way to write a character code. It still works, but the compiler reports a `deprecated-octal-escape` warning. Write `\u` instead.

## string interpolation
A string literal can interpolate expressions: `{` starts an expression and `}` ends it, and the value of the expression is written into the string in its place. There is no `+` operator on `string`, so interpolation is also how strings are joined.

How a value is written depends on its type. A string, a number or an enum member is written as .NET writes it, and so is any value whose type declares its own `to_string`. A `bool` is written `true` or `false`. An optional value is written as the value it holds, or as `null` when it doesn't hold a value. Any other value, such as an array, a list, a tuple, or a struct or class with no `to_string` of its own, is written by the runtime's `$` function: a sequence as its elements in brackets, a tuple as its parts, and a record as its type and members:

<GhulExample name="language-basics-37" />

A format or an alignment after the expression, as in `{value:F2}` or `{value,6}`, formats the value the way .NET does. To change how the values of a type are written, give the type a `to_string`.

## operators and expressions
### arithmetic operators
<GhulExample name="language-basics-24" />

### comparison and logical operators
<GhulExample name="language-basics-25" />

<GhulExample name="language-basics-26" />

### bitwise and shift operators

The integer types have the usual bitwise operators - `&`, `|`, `^` - and the shift operators `<<` and `>>`. A shift count is an `int`, and the result keeps the left operand's type. The count is taken modulo the operand's width, following .NET: shifting an `int` by 32 is the same as shifting it by 0. `>>>` is the unsigned right shift: it shifts zeros into the leftmost bits where `>>` keeps the sign:

<GhulExample name="language-basics-30" />

The unary `\` operator is the bitwise complement, which flips every bit of its operand:

<GhulExample name="language-basics-36" />

## assignment

variables and properties can be updated via assignment statements

<GhulExample name="language-basics-27" />
