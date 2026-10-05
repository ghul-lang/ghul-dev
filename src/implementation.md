# implementation

The ghūl compiler is itself written in ghūl. It is published as the
[`ghul.compiler`{:text}](https://www.nuget.org/packages/ghul.compiler) .NET
tool, with source in the [`ghul-lang/ghul`](https://github.com/ghul-lang/ghul)
repository.

## overall shape

A ghūl build moves through three broad stages:

1. **Read the source.** Source text is split into tokens, and the tokens
   are parsed into a syntax tree describing the program.
2. **Make sense of the source.** A series of passes walks the syntax tree,
   working out what every name refers to, what type every expression has,
   and reporting any errors.
3. **Emit the assembly.** A final pass walks the syntax tree and writes a
   `.dll`{:text} or `.exe`{:text} to disk, encoding .NET metadata and
   method bodies directly.

When the compiler runs as the back end of the VS Code extension it follows
the same first two stages but stops short of emitting IL, and runs many
passes incrementally as the user edits.

## source layout

The compiler's source is organised around the stages above. Each top-level
folder under `src/`{:text} in the compiler repository covers one
concern:

| Folder            | Role                                                           |
|-------------------|----------------------------------------------------------------|
| `lexical/`{:text}    | Turns source text into a stream of tokens.                  |
| `syntax/trees/`{:text} | The syntax-tree node classes themselves.                  |
| `syntax/parsers/`{:text} | Recursive-descent parsers that build the syntax tree from tokens. |
| `syntax/process/`{:text} | Passes that walk the syntax tree: name resolution, type checking, IL generation, plus the editor-facing passes for completion and signature help. |
| `semantic/`{:text}   | The symbol table, scopes, types and supporting machinery used by the passes. |
| `ir/`{:text}         | A small set of nodes that model individual IL instructions, used while emitting code. |
| `compiler/`{:text}   | The `COMPILER` orchestrator that registers the passes and runs them over each source file. |
| `driver/`{:text}     | A thin command-line front-end that parses arguments and decides whether to run a build or the language service. |
| `analysis/`{:text}   | The language-service request handlers used in analysis mode. |
| `ioc/`{:text}        | A small inversion-of-control container. Mostly used by the parsers so they can refer to one another without circular constructor wiring. |
| `source/`{:text}     | Source-location bookkeeping. Every syntax-tree node has a `LOCATION`, so diagnostics, hovers and go-to-definition can point at the right span of text. |
| `logging/`{:text}    | Diagnostic reporting and per-pass timers. All compiler messages flow through `Logger` so that the IDE can intercept them. |

The boundaries are deliberately ordinary: anyone who has worked on a
classical compiler will recognise most of them. The interesting parts are
inside `syntax/process/`{:text} and `semantic/`{:text}.

## from source to tokens

The tokenizer in `lexical/`{:text} reads source text a character at a time
and produces a sequence of `TOKEN` values. Whitespace and comments are
discarded; tokens know their kind (identifier, keyword, operator, string
literal, …), their text and their source location.

The parser in `syntax/parsers/`{:text} is a hand-written recursive-descent
parser. Each grammar production has its own parser class implementing a
small `Parser[T]` trait. The grammar is mutually recursive (an expression
parser needs a statement parser which itself needs the expression
parser), so the parser classes are too. The IoC container breaks the
resulting cyclic constructor dependency by resolving each parser's
references lazily.

The output of the parser is a tree of `Node` subclasses defined in
`syntax/trees/`{:text}. The nodes fall into four broad groups:

- **Definitions** - namespaces, classes, traits, structs, variants,
  functions, methods, fields, properties.
- **Statements** - `if`, `for`, `while`, `try`, and so on.
- **Expressions** - literals, calls, operators, anonymous functions, tuple constructors.
- **Type expressions** - types as they appear written in source, before
  the semantic layer turns them into the type objects described below.

Every node knows the source location it came from, and the tree is the
single shared data structure that the rest of the compiler walks.

## passes over the syntax tree

The bulk of the compiler is a series of *passes* over the syntax tree.
Each pass is a class whose name describes what it does; most are
subclasses of the `Visitor` hierarchy in `syntax/process/`{:text}. The
`COMPILER` class registers them in order, and each pass runs over every
source file before the next pass starts. This means later passes can rely
on the work the earlier passes have already done.

The order matters. For example, the pass that works out the type of an
expression depends on the pass that has already resolved what every name
refers to, which in turn depends on the pass that has put every
declaration into the symbol table.

The full pass list, in the order `COMPILER` runs them:

| Pass                                  | What it does |
|---------------------------------------|--------------|
| `conditional-compilation`{:text}      | Nullifies any definition or statement disabled by its `@IF.flag()` pragma. |
| `collect-modifier-keyword-locations`{:text} | Records the source location of every contextually-lexed modifier keyword before a later rewrite consumes it, for the editor's semantic-token colouring. |
| `rewrite-syntax-trees`{:text}         | Light syntax-tree rewrites that simplify later passes: expanding dotted namespace names into nested form, synthesising accessor methods for properties, indexers and union variants, and spilling operand-position subexpressions sitting to the left of an `await` so their values survive the suspend. |
| `collect-suppress-pragmas`{:text}     | Registers a suppression region for each `@suppress("slug")`{:text} pragma, covering the definition or statement it wraps. |
| `declare-symbols`{:text}              | Registers the type-level skeleton in the symbol table: namespaces, types, variants and their generic type parameters - everything a type expression can name. |
| `resolve-uses`{:text}                 | First round of `use` resolution: binds imports of namespaces and types, so short type names work in subsequent passes. |
| `declare-members`{:text}              | Declares every type's members - methods, fields, properties, parameters - plus global functions and variables, and classifies each function body as plain, generator or asynchronous. |
| `resolve-member-uses`{:text}          | Second round of `use` resolution: binds imports of members - static methods, global functions, enum members - and reports any `use` still unresolved. |
| `check-name-conventions`{:text}       | Warns where a declaration's name does not follow the naming convention for its kind. |
| `resolve-type-expressions`{:text}     | Turns type annotations in declarations, signatures, and in expression-position uses like `cast`, `isa`, `typeof` and `_` into the semantic `Type` objects later passes use. |
| `resolve-ancestors`{:text}            | Attaches base classes, trait parents and default ancestors to classes, traits, structs, unions and enums, and validates the inheritance constraints. |
| `synthesize-class-equality`{:text}   | Settles the `=~` and `get_hash_code` synthesised for an `@equality()` class once its ancestors are known: the class joins a synthesised base's operator, and keeps an equality it inherits from elsewhere instead of its own. |
| `synthesize-iterator-reset`{:text}   | A type implementing `Collections.Iterator[T]` that declares no `reset` gets a synthesised one that throws `System.NotSupportedException`. |
| `resolve-explicit-types`{:text}       | Registers each variable's, property's and parameter's declared type on its symbol, so the declared type is available to constrain inference later. |
| `check-type-argument-bounds`{:text}   | Checks each type argument written in a type-expression position against its type parameter's declared bound. |
| `resolve-overrides`{:text}            | Pulls inherited symbols down into each container type's scope; for every method whose signature matches an ancestor's virtual or abstract method, records the override link and checks the override is consistent. Reports duplicate top-level functions. |
| `definition-virtuality`{:text}        | Editor-only: reports each declaration's place in the dispatch hierarchy as an inlay hint. |
| `register-source-intrinsics`{:text}   | Registers an intrinsic handler for each built-in operator the compilation itself declares in source, so the runtime library can be built. |
| `record-type-argument-uses`{:text}    | For every closure body, records which of the enclosing scope's generic type parameters the body references, so the closure frame can plumb them through at runtime. |
| `mark-boxed-locals`{:text}            | Marks `let mut` locals (and parameters) that are both captured by an anonymous function and reassigned, so the IL pass wraps them in a `Ghul.BOX[T]` cell shared between the enclosing scope and every capturer. |
| `compile-expressions`{:text}          | The largest pass. Walks every expression in every function body, working out its type, resolving operator and method overloads, running type inference, applying flow-sensitive narrowing, and producing IR values that describe what the IL should look like. |
| `infer-effects`{:text}                | Re-walks every body with resolved types, solves which members each function can read and write, and judges every use of a flow-narrowed value against the calls recorded across its narrowing. |
| `verify-compile-state`{:text}        | Checks that the state `compile-expressions`{:text} left is complete before `generate-il`{:text} reads it: every type settled, and every function literal's argument and return types known. A gap is reported as an internal error. |
| `select-entry-point`{:text}          | Chooses the program's entry point from the candidates the project declares - an `@entry` function, the function `--entry` names, a function named `entry`, or a file's top-level statements - and reports an entry function of the wrong shape. |
| `generate-il`{:text}                  | Walks the syntax tree one last time and writes the assembly, encoding the IR values produced by `compile-expressions`{:text}. |

Whether each pass actually runs depends on the build flags. A plain syntax
check stops after the early passes; a full build runs all of them.
Analysis mode runs everything except `generate-il`{:text}, so the IDE
sees every diagnostic a batch build would report.

A short overview of each:

### `conditional-compilation`{:text}

ghūl's conditional compilation is a pragma annotation: a `@IF.flag()`
applied to a single definition or statement gates that item on whether
`flag` is on: passed with `--define`, or the name of the target being
built. There is no else/endif form; a
disabled item is omitted. This pass walks the syntax tree and
nullifies each disabled item - definitions are replaced by an empty
definition list, statements by `null` - so subsequent passes can skip
them.

### `collect-modifier-keyword-locations`{:text}

Records the source location of every contextually-lexed modifier keyword -
currently `init` and `open`. A later rewrite consumes some of these
tokens, so the locations are captured up front for the editor's
semantic-token colouring, which lights them as keywords. Hard keywords
like `abstract` don't need any help; only the contextually-lexed modifiers do.

### `rewrite-syntax-trees`{:text}

A handful of syntax-tree rewrites that are easier to do up front than to
handle everywhere afterwards. The notable ones are:

- **expand namespaces** - expands dotted namespace names like
  `namespace Foo.Bar is …` into explicitly nested form
  `namespace Foo is namespace Bar is … si si`.
- **add accessors** - synthesises the getter and setter methods that a
  property declaration stands for, and (despite the historical name) the
  equivalent accessors for indexers and for union variants (the per-variant
  `=~`, `get_hash_code`, `value` and `has_value` members).
- **spill awaits** - at each composite expression containing an `await`,
  wraps every earlier-evaluated sub-expression in a `SPILL` node. The
  async state machine described below suspends with an internal `leave`
  instruction, and the CLR requires its evaluation stack to be empty at
  the suspend point; anything spilled is stashed into a field on the
  state-machine frame so it survives the suspend. The rule is purely
  structural - if a later-evaluated child contains an `await`, every
  earlier child is wrapped - so no type information is needed yet.

### `collect-suppress-pragmas`{:text}

Finds every `@suppress("slug", …)`{:text} pragma and registers a
suppression region for each slug, covering the definition or statement
the pragma wraps. The diagnostics store consults the regions whenever a
coded warning is about to be reported, so every warning honours
`@suppress` without each pass handling it separately.

### `declare-symbols`{:text}

Walks the definitions in the syntax tree and creates symbol-table entries
for the type-level skeleton: each namespace, class, trait, struct, union,
variant and enum, and each type's generic type parameters - everything a
type expression can name. Each declaration goes into the appropriate
scope so that later passes can look it up. Members are deliberately left
to `declare-members`{:text}, which runs after the first round of `use`
resolution.

### `resolve-uses`{:text}

Processes the `use` declarations that appear in each `namespace` block.
`use` resolution runs in two rounds, and this first one binds imports of
namespaces and types - the only symbols that exist yet - attaching each
result to the namespace's scope, so short type names are findable by the
namespace-scope lookups that subsequent passes perform.

Identifier resolution inside expressions and function bodies - looking up
a local, a parameter, a field, or a member access - is deferred to
`compile-expressions`{:text}, where types are available to resolve
overloads.

### `declare-members`{:text}

Declares every type's members - methods, fields, properties and their
parameters - along with global functions and variables. It runs after the
first round of `use` resolution so that a `partial` or `impl` block's
target name can be reached through a `use` import, wherever the block
sits relative to its target.

While declaring each function the pass scans its body for `yield` and
`await` expressions and classifies the function accordingly: plain,
generator (returns `T{}`, `Iterator[T]` or `Ghul.Pipes.Pipe[T]` and contains `yield`), or
asynchronous (contains `await`). The classification is what later tells
the IL pass to emit a generator or async state machine for the function
instead of a straight method body.

### `resolve-member-uses`{:text}

The second round of `use` resolution: binds imports of members - static
methods, global functions, enum members - now that `declare-members`{:text}
has created them, and reports any `use` that still doesn't resolve to anything.

### `check-name-conventions`{:text}

Reports a warning for each declaration whose name does not follow the
naming convention for its kind: `snake_case` for variables, functions and
properties, `PascalCase` for traits, abstract classes, unions and enums,
`UPPER_SNAKE_CASE` for concrete classes, structs, variants and enum
members. It runs after `declare-members`{:text} so it can read each
class's computed abstractness - explicit or implied by a body-less
method - rather than just the written modifier.

### `resolve-type-expressions`{:text}

The shape of a type as written in source (`List[Pair[int, string]]`,
`(int, string) -> bool`, and so on) is parsed into syntax-tree nodes
under `type_expressions/`{:text}. This pass turns the type expressions
that appear in declarations and signatures - return types, parameter
types, field and property types, generic-parameter bounds, ancestor type
references - and in expression-position uses like `cast`, `isa`, `typeof`
and `_` into the `Type` objects (described under [types](#types)
below) that the rest of the compiler manipulates. Type arguments that the
compiler has to *infer* at a call site are produced later, in
`compile-expressions`{:text}, when argument types are known.

### `resolve-ancestors`{:text}

Attaches each container type to the types it inherits from: a class to its
declared base class and traits, a trait to its parent traits, a struct to
the traits it implements, a union variant to its enclosing union (with
the union's generic arguments threaded through). Where no ancestor is
declared, the pass injects the default one - `Object` for classes, traits
and unions, `VALUE_TYPE` for structs, `ENUM_TYPE` for enums.

It also validates the inheritance constraints: at most one class ancestor,
class before any traits, traits and structs can only inherit traits, no
ancestor can be `void`.

The inheritance graph is then available for later passes to walk. Member
symbols are not yet pulled down into the derived type's scope; that
happens in `resolve-overrides`{:text}.

### `resolve-explicit-types`{:text}

For every variable, property, parameter or function return whose type is
written out, attaches the resolved `Type` to the corresponding symbol.
By the time `compile-expressions`{:text} runs, every explicitly-typed
symbol already knows its declared type, and that declared type becomes
one of the constraints that bidirectional inference uses for the
unannotated parts of the same expression. The pass also performs a few
annotation-only checks (field and property types can't be `ref`
types; variable types can't be `void`).

Note that this pass does *not* check that an initializer's type matches
the declared type. It cannot - `compile-expressions`{:text} has not yet
typed any expression. The assignability check happens there, against the
declared type this pass attached.

### `check-type-argument-bounds`{:text}

Checks each type argument written in a type-expression position - a
field, parameter, return, local or nested annotation - against its type
parameter's declared bound (`[T: SomeBase]`). The bound is only attached
to the parameter symbol during `resolve-explicit-types`{:text}, after
every type expression has resolved, which is why this check is a
separate pass rather than part of type-expression resolution. Call and
construction positions are checked later, in `compile-expressions`{:text},
where inferred type arguments become known.

### `resolve-overrides`{:text}

Two jobs. First, for every container type, the pass walks its ancestors
and pulls their inherited symbols down into the container's own scope, so
that later lookups against a derived class find the members it inherits.

Second, for every method whose signature matches a virtual or abstract
method on an ancestor, the pass records the override link and checks the
override is consistent: covariant return type, matching IL name, no
override of a non-virtual member, and so on. ghūl has no `override`
keyword - whether a method overrides its ancestor is determined by
signature match, not by source annotation - so this pass is where the
override relationship is established. It also reports a handful of
related conditions: ineffective override of a trait default, a static
method accidentally hiding an instance method, a method whose signature
narrows an ancestor's argument types just enough to miss the override.

Once every source file has been visited, the pass reports any pair of
top-level functions whose signatures cannot be told apart.

### `definition-virtuality`{:text}

An editor-only pass. For each declared method and property it reports,
as an inlay hint, what the compiler now knows about the declaration's
place in the dispatch hierarchy: whether it overrides, is overridden, or
dispatches statically. ghūl writes none of this in source - there is no
`virtual`, `override`, `sealed` or `final` keyword - so the hints save a
reader reconstructing the answer from the rest of the program.

### `register-source-intrinsics`{:text}

The built-in operators are declared as ordinary ghūl source in the
runtime library and marked as intrinsics; compiling any other project,
the compiler reads them from the runtime assembly's metadata. This pass
covers the one project that cannot do that - the runtime library itself -
by registering an intrinsic handler for each such declaration found in
the source being compiled.

### `record-type-argument-uses`{:text}

For every closure (anonymous function) body, this pass records which of
the enclosing function's or type's generic type parameters the body
references. The closure compiler later uses that list to plumb those type
parameters through the closure frame at runtime, so the closure can be
invoked with the right instantiation.

### `mark-boxed-locals`{:text}

A `let mut` local that is both captured by an anonymous function and
reassigned has to be shared between the enclosing scope and every
capturer; if it stayed in a normal local slot, the two would see
independent copies. This pass walks the syntax tree and marks each such
local (and parameter that meets the same conditions) so the IL pass
wraps it in a `Ghul.BOX[T]` cell - one heap-allocated holder that every
party reads and writes through.

That is the whole job of the pass. Generator and async functions are
also state-machine-compiled so their locals survive `yield` or `await`,
but that lowering is done by `generate-il`{:text} (with help from
information attached by `declare-members`{:text} and the `spill-awaits`
rewrite), not here.

### `compile-expressions`{:text}

The most substantial pass. It walks every expression in every function
body and:

- works out the type of every expression and sub-expression;
- resolves operator and method overloads;
- runs type inference for unannotated locals, anonymous function
  parameters and return types, list literal element types, generic type
  arguments at call sites, and generic constructors;
- applies flow-sensitive type narrowing through `isa` checks, `if let`,
  null tests, variant tests, and divergent guards (where an early `return`
  / `throw` / `break` / `continue` leaves the code below the guard narrowed
  to the stronger type), recording each call that could store to the heap
  against the facts live across it - whether a later use of a narrowed
  value is still safe is judged in `infer-effects`{:text} below;
- produces *IR values* that describe, for each expression, the sequence
  of IL operations it stands for.

Inference inside this pass is bidirectional: information flows up from
inner expressions, and back down from contexts that constrain what an
expression's type can be. A function's signature is always explicit, so
inference is confined to function bodies and never changes anything
visible from outside the function.

### `infer-effects`{:text}

Runs after `compile-expressions`{:text}, re-walking every function body
with the types that pass resolved. For each function it records what the
body reads and writes - which members, and whether it stores to the heap
at all - and then solves those facts across the whole program's call
graph, overrides and invoked function values included, so that for any
call the compiler can answer which members it might write.

The answers feed the *reliance judge*. Narrowing treats calls
optimistically: a call drops no facts, but each call that could store is
recorded against the facts live across it, and every later use that
relies on a fact is judged here, against what the recorded calls can
actually write. A use the solve cannot prove safe is reported at the use
site. The same pass verifies `pure` declarations whose bodies the
earlier walk could not settle on its own.

### `generate-il`{:text}

The final pass writes the IR values produced by `compile-expressions`{:text}
out as a .NET assembly, using `System.Reflection.Metadata`{:text} to encode
the metadata tables, the method bodies and a portable PDB, and writing the
`.dll`{:text} or `.exe`{:text} itself. Nothing outside the compiler is
involved, so a build doesn't need a platform-specific tool beyond the .NET
runtime the compiler is already running on.

Names, signatures and attribute blobs are all encoded from the resolved
symbols and types, so the emitted assembly doesn't depend on how the
compiler would display those things to a reader.

Some metadata tables are stored as runs: a type points at the first of its
members, and the run ends where the next type's begins. Those runs are not
validated when an assembly loads, so a type written with more members than
it was counted for still loads, with the surplus attached to the following
type. The emitter therefore numbers every row in one pass and writes the
rows in a second, both replaying a single recorded sequence rather than
each working the order out for itself.

Emission is deterministic: the module version id is a hash of the content
rather than a fresh value, and the build doesn't record its time. Two
builds of the same source produce the same bytes, which is what lets the
bootstrap compare assemblies directly.

## the main data structures

A handful of data structures are visible across most of the passes.

### the syntax tree

The output of the parser and the working medium of every subsequent pass.
Each `Node` subclass models one piece of syntax (a class definition, an
`if` statement, a method call) and knows the source location it came
from. As later passes work, they attach additional information to the
nodes: an identifier use gets a reference to the symbol it refers to, an
expression gets its inferred type, and the IL pass attaches IR values
that record how to emit it.

### symbols

A `SYMBOL` is the compiler's record of one thing declared in the program:
a type, a function, a method, a field, a local variable, a parameter, a
generic type argument, and so on. There is one subclass per flavour
(`CLASS`, `INSTANCE_METHOD`, `VARIABLE` and the rest), and they all live
under `semantic/symbols/`{:text}.

The `SYMBOL_TABLE` is a central registry; the `NAMESPACES` object tracks
namespace membership. Together they answer the question "what does this
name refer to?".

### scopes

A scope is the answer to "what names are visible here?". Scopes nest:
the innermost is typically a block scope, inside a method scope, inside a
class scope, inside a namespace scope. Name resolution walks outwards
through the chain of scopes until it finds a match.

The base `Scope` and its specialisations (`BLOCK_SCOPE`,
`NAMESPACE_SCOPE`) live under `semantic/scope/`{:text}.

### types

A `Type` represents a ghūl type in the form the compiler uses internally.
The hierarchy under `semantic/types/`{:text} is fairly small:

- `NAMED` - a reference to a named type (class, trait, struct, variant,
  primitive).
- `GENERIC` - a generic type applied to type arguments, such as
  `List[int]`.
- `FUNCTION` - a function type, used for first-class functions, anonymous
  functions, and methods; `PURE_FUNCTION` is its store-free refinement.
- `TUPLE` - a tuple type, with optional element names.
- `ARRAY` - a fixed array type.
- `NULLABLE`, `MAYBE`, `NONE`, `NULL` - the machinery behind optional
  types: the wrappers that carry `T?` over a value type or a type
  parameter, and the types of the absent value.
- `ONE_OF`, `INTERSECTION` - a value known to be one of several types, or
  several types at once, produced by inference and flow narrowing.
- `INFERRED_VARIABLE_TYPE` and `INFERRED_RETURN_TYPE` - placeholders used
  during inference, replaced by concrete types as constraints accumulate.
- `ERROR` - stands in for the type of an expression the compiler could
  not work out, so that later passes can continue without cascading every
  diagnostic.

`Type` objects answer most of the questions the compiler has about
expressions: is this assignable to that, what is the common type of these
branches, what overload best matches these argument types.

### IR values

`IR.Value` subclasses model individual operations to be emitted as IL.
Most map one-for-one to a single IL instruction; a few (`tuple`, `isa`,
generic boxing helpers) expand into a small sequence.
`compile-expressions`{:text} builds an IR value tree for each expression;
`generate-il`{:text} walks those trees and encodes their instructions into
the method body being built.

### diagnostics

Errors, warnings and informational messages all flow through `Logger` in
`logging/`{:text}, which attaches a `Source.LOCATION` to each message and
stores them in `DIAGNOSTICS_STORE`. In analysis mode, the response to
each edit or compile request carries the store's contents back to the
IDE.

## type inference

Type inference runs inside `compile-expressions`{:text} and stays within
function bodies; every declared signature is explicit, so inference never
changes anything visible from outside a function. The [type inference](/type-inference)
page covers what is and isn't inferred; this section is the mechanism.

It is bidirectional. Bottom-up, an expression's type is computed from its
sub-expressions. Top-down, the context the expression sits in - a typed
`let`, an assignment, a `return`, a call argument, an `if` or `case`
branch - pushes an expected type back down into it. Where several types
meet, such as the branches of an `if` or the elements of a list literal,
`LEAST_UPPER_BOUND_MAP` finds the most specific type compatible with all
of them.

An unknown type - a local whose type isn't settled yet, an anonymous
function parameter, a not-yet-bound generic argument - is held by an
`INFERRED_VARIABLE_TYPE` placeholder. As the body is walked, each use of
the variable attaches a *constraint* to the placeholder: a member access
records that the type must have that member, a call records an argument
and return shape, a `for` loop records that it must be iterable, an
index records an indexer. These are the `MEMBER_CONSTRAINT`,
`CALL_CONSTRAINT`, `ITERABLE_CONSTRAINT`, `INDEX_CONSTRAINT` and
`DESTRUCTURE_CONSTRAINT` types under `semantic/`{:text}. When the
placeholder is resolved, the accumulated constraints filter the candidate
types, rejecting any that don't support how the variable is used.

One walk of a body cannot always see enough: an anonymous function
assigned to a `let` variable is used after it is defined, and a constructor's type arguments
can be fixed by a later call. So `compile-expressions`{:text} re-walks
each function body. Constraints attached during a walk persist into the
next and only ever narrow, so each pass either tightens the unknowns or
leaves them unchanged; the walk repeats until it settles - no new errors
and no expression left consuming an unresolved type. Anything still
unknown at that point is reported where it could not be inferred.

Inference is interleaved with flow-sensitive narrowing. Alongside each
variable's inferred type, the pass tracks what the control flow has
proved about it - that an `isa` test succeeded, that an optional was
checked for presence, that a guard returned on the other case - and
joins those facts where branches merge. Narrowing changes the type a
variable is seen at within a region without changing its declared type.

## analysis mode

The same compiler executable runs the IDE's language service. When the
ghūl VS Code extension starts, it launches `ghul-compiler`{:text} with
the `--analyse`{:text} flag, then talks to it over the process's standard
input and output streams.

Communication is newline-delimited JSON. Each request is a single JSON
object on one line, discriminated by a `command`{:text} field -
`edit`{:text}, `compile`{:text}, `hover`{:text}, `definition`{:text},
`complete`{:text} and so on - and each response is a single object
discriminated by a `kind`{:text} field. JSON escapes any newline inside
a string, so reading a line is a complete framing operation on either
end. At startup the analyser answers a `listen`{:text} request with the
capabilities it supports, and a client sends a newer request only after
seeing the matching capability, so either side can be upgraded first.

The interesting work happens around two requests:

- **`edit`{:text}** - sent on every keystroke (after a short debounce).
  Re-parses the file the user is editing and re-runs the early passes
  over it, keeping the rest of the project's syntax trees untouched.
  This is fast enough to keep up with typing, and it is what produces the
  squiggles and hovers that appear as the user types. A client can send
  `edit_delta`{:text} instead, carrying just the changed span of the file
  rather than its whole text.
- **`compile`{:text}** - sent during a longer pause in typing. Runs the
  full pass sequence over the whole project so that any consequences of
  the edit ripple through the rest of the analysis.

This two-stage pattern keeps the typical-case latency low without
sacrificing correctness once the user pauses. Hover information,
go-to-definition, completions and signature help all come from the state
these passes maintain: the symbol table, the scopes, the per-node type
annotations and the symbol-use map.

A query that arrives while a compile is running is answered during it:
the compile pauses at the next per-file boundary of its walk, answers
what is queued, and resumes. An edit that arrives while a compile is
running cuts the compile short instead - the rest of the walk would
compute diagnostics the edit has already made stale.

### incremental analysis

An `edit`{:text} does not rebuild the project from scratch. The analyser
retains the whole compiled state between requests - syntax trees, symbol
table, scopes, types - and how much of it an edit invalidates depends on
what the edit changed:

- **An edit that preserves every declared signature** - the common case,
  typing inside a function body - is spliced into the retained syntax
  tree: the new bodies replace the old ones, and only those bodies are
  re-checked. Every symbol, type and override link survives untouched,
  which is what makes the per-keystroke path fast; on the compiler's own
  source it is around two orders of magnitude faster than re-running the
  early passes over the file.
- **An edit that changes a declaration** - a signature, a type, a new or
  removed member - invalidates more: the file's declarations are
  re-declared and re-resolved, and the consequences for the rest of the
  project are picked up by the next whole-project `compile`{:text}.

The splice relies on a language rule doing structural work: a function's
signature is always explicit and inference never escapes a body, so a
body-only edit provably cannot change anything another file can see.
Where any guard on the incremental path fails, the analyser falls back
to the full rebuild, which is slower.

### batch requests and lifetime

Two convenience requests, `hover_map`{:text} and
`semantic_tokens`{:text}, dump every recorded hover or every recorded
symbol use for a file in one batch. They are mainly used by the example
pipeline on this website, which feeds each example through the analyser
and uses the results to drive hover popups and semantic-token colouring
in the rendered output.

The compiler runs as a long-lived process. A `WATCHDOG` component watches
for sustained handler failures or excessive heap growth and asks the IDE
to recycle the process when either threshold is crossed; the extension
schedules recycles during idle periods so the user rarely notices. The
analyser also exits of its own accord after half an hour without a
request: a warm analyser retains the whole symbol table, so an editor
window left open overnight would otherwise hold hundreds of megabytes while
answering no requests, and the cold rebuild the next request pays is the
cheaper side of that trade. Even with the recycles, the long-lived shape
is much cheaper than starting a fresh compiler for every request.

## bootstrap and self-hosting

The ghūl compiler is *self-hosting*: it is written in ghūl and is
compiled by an earlier version of itself. Every CI build re-bootstraps
the compiler by compiling the source under the published version and
then comparing the assemblies two further passes produce; the compiler
that the publish produced should compile itself byte-for-byte
identically. A divergence between the two is treated as a build failure.

The historical story of how the first version of the compiler came to
exist, back when no ghūl compiler existed to compile it, is on the
[history](/history) page.
