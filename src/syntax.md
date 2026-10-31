# syntax in ghūl

## projects and files

A ghūl project is composed of a set of ghūl source files. Source files should have a `.ghul`{:text} file extension, and must be UTF-8 text.

Each source file can contain zero, one or more global definitions. Definitions can be in any order and in any file. Source files can have any name, provided they have a `.ghul`{:text} extension, and can be in any folder under the project root (subject to any source file glob pattern given in the `.ghulproj`{:text})

A file with no `namespace` can mix definitions with statements at the top level, so a whole program can read as a script with no explicit `entry` function. These are called [top-level statements](#top-level-statements).

## tokens and trees

Source files are translated into various kinds of tokens. Some tokens are a fixed sequence of characters (like the keyword `while`). Others are composed of characters according to various rules (identifiers, strings, numbers etc.)

With a couple of exceptions, ghūl tokens are similar to most common programming languages. The exceptions are:

### operators

Operators are any contiguous string of operator characters. This is only significant in the rare case where running together the characters that comprise two different operators might not have the result you expect

### escaped identifiers

A leading backtick escapes a keyword or operator so it can be used as an ordinary identifier: `` `while`` is the identifier `while`, and `` `+`` is the identifier `+`. The backtick is not part of the escaped name, so escaping a name that is not a keyword, like `` `count``, means the same as plain `count`. A backtick is only meaningful immediately before an identifier, operator, or opening bracket; anywhere else it is a dangling-backtick error.


## comments

`//` starts a comment that runs to the end of the line. `/*` starts a comment that runs to the next `*/`, across line breaks if there are any. Block comments don't nest.

### doc comments

A line comment that starts with exactly three slashes, with nothing before it on its line, is a doc comment. A block of doc comments written directly above a declaration documents that declaration:

<GhulExample name="syntax-8" />

The block documents a declaration when its last line is the line directly above the declaration, or directly above the declaration's first pragma. A blank line, an ordinary comment or any code between the block and the declaration stops the block documenting it.

The text is Markdown. The compiler removes `///` and one following space from each line and keeps the rest as written, so a `///` line with nothing after it separates two paragraphs. Describe arguments in a bullet list with one `- name: description` line for each argument, as `repeat_with` does above.

The VS Code extension shows the text in hover and completion wherever the declaration is used. The compiler stores it in the compiled assembly, so the doc comments of a library appear in the editor for code that references it.

Classes, structs, traits, unions and their variants, enums and their members, functions, methods, properties and global variables can have doc comments. A comment that starts with four or more slashes is an ordinary comment.

## block structure

ghūl is a [block structured programming language](https://en.wikipedia.org/wiki/Block_(programming)). Source code in ghūl is composed of blocks, typically many of them, with blocks nested inside other blocks.

Blocks are delimited by keywords. The keywords that begin and end a block are specific to each different kind of block. This way of delimited blocks is descended from the ALGOL family of languages, most specifically from [ALGOL 68](https://en.wikipedia.org/wiki/ALGOL_68). It has the advantage of making the block structure clearer, both to someone reading the code and to the compiler.

<GhulExample name="syntax-1" />

In this example `then`, `else` and `fi` all delimit blocks. The blocks they delimit contain statement lists, and they do so whether the `if` is used as a statement or as an expression - see [every arm is a statement block](/expression-oriented-programming.html#every-arm-is-a-statement-block).

## semicolons

Code written in the style of the examples on this site doesn't need a semicolon anywhere, except to put two statements on one line. [Statement terminators](/grammar.html#statement-terminators) in the grammar lists the rules for where a line break ends a statement.

## definitions and statements

Blocks in ghūl can contain definitions, statements, or a mix of both. Which is permitted in a given block depends on the type of block.

## file structure

At its top level a ghūl source file contains [definitions](/definitions.html) and `use` directives; a file with no `namespace` can also contain statements. There is no required ordering and no file header.

<GhulExample name="syntax-2" />

The definitions in a file can be global functions, properties, classes, structs, traits, unions and enums, or `namespace` blocks that group definitions under a name. A definition is visible to the rest of the project regardless of which file it appears in, so how source is split across files is purely a matter of organisation.

A file that declares any `namespace` must place all of its definitions inside namespaces. A file with no namespace at all has its definitions placed in a private namespace of their own, which is convenient for small programs and tests. Namespaces, `use` and symbol visibility are covered in full under [definitions](/definitions.html#namespaces).

### a `#!` first line

A file can begin with a `#!` line naming an interpreter, as a shell script does. The compiler recognises it only as the very first line, and skips it:

<GhulExample name="syntax-4" />

With the [`ghul`{:sh} command](/scripts-and-repl#running-a-script) installed, such a file can be marked executable and run directly.

### file-level pragmas

An ordinary pragma applies to the one definition written after it. A pragma written with two `@` signs applies to the whole file instead, and must come before anything else in it, after a `#!` line if there is one:

<GhulExample name="syntax-3" />

`@@suppress` is the way to suppress a warning reported at a top-level statement, which has no enclosing definition for an ordinary pragma to wrap. `@@precedence` sets an operator's precedence for the rest of the file.

## imports

A file sees the built-in types, such as `int` and `string`, and the operators on them without any `use`: they are declared in the namespace `Ghul.Intrinsics`, which every file imports implicitly. Everything else the runtime library provides is imported like any other library, with `use Ghul.Functional` for the function combinators and `use Ghul.Pipes` for the pipe functions. The rest of `use` is covered under [definitions](/definitions.html#importing-symbols-with-use).

### `use default`

`use default` imports the names most programs want before they want anything else: `IO.Std.write_line`, the pipe functions in `Ghul.Pipes`, and the collections in `Collections`:

<GhulExample name="syntax-5" />

Like any `use`, it applies only to the file or namespace block it is written in. A project can replace the set with its own list, with the `--default-use` compiler flag or the `<GhulDefaultUses>`{:text} MSBuild property.

### wildcard imports

`use X.*` imports every usable member of `X` at once. On an enum it imports the members; on a class, struct or union it imports the static members, and a union's variants:

<GhulExample name="syntax-6" />

Each name is imported exactly as if it had been named in a `use` of its own, so a clash with a name already in scope is the usual duplicate-use error.

### type aliases

A `use` whose right-hand side is a type gives that type a second name. An alias can take type parameters:

<GhulExample name="syntax-7" />

An alias is another spelling of the type it names rather than a new type, so a value of either is accepted wherever the other is expected.

## top-level statements

A file with no `namespace` can also have statements at its top level. They run in source order as the program's entry point, so a short program doesn't need an `entry` function:

<GhulExample name="top-level-statements-1" />

Definitions in the same file are still hoisted, so a top-level statement can use a function or type declared anywhere in the file. Top-level statements and a `namespace` cannot appear in the same file.

Otherwise, execution of a program begins at a function named `entry`.

