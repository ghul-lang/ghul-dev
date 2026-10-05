# .NET integration

ghūl is hosted on and targets .NET 10 and can consume most types in .NET assemblies built with C#.

## projects

The ghūl compiler is driven by MSBuild and uses the .NET SDK targets for most of the build process. Provided you reference the ghūl runtime library package, things should work as you'd expect for any other .NET SDK project. You can add package references, build assemblies and pack NuGet packages etc. all using the normal `dotnet`{:text} command line tools.

### embedded resources

An `EmbeddedResource` item builds a file into the assembly, as it does in a
C# project:

```xml
<PropertyGroup>
    <RootNamespace>Greeter</RootNamespace>
</PropertyGroup>

<ItemGroup>
    <EmbeddedResource Include="data/greeting.txt" />
</ItemGroup>
```

The resource is named the way C# names it: the project's `RootNamespace`,
then the file's folder path with each separator turned into a dot, then the
file name. A `LogicalName` on the item replaces that name. The program reads
the resource back through reflection:

```ghul
let assembly = System.Reflection.Assembly.get_executing_assembly()

let use stream = assembly.get_manifest_resource_stream("Greeter.data.greeting.txt")!
let use reader = IO.StreamReader(stream)

write_line(reader.read_to_end())
```

## name mangling
When consuming C# code the ghūl compiler transforms symbol names to better match ghūl conventions:

- Class, struct and trait (=interface) names are left unchanged
- .NET's generic arity suffix is removed, so `KeyValuePair<K, V>` is `Collections.KeyValuePair[K, V]`
- Enum names and enum member names are transformed to `MACRO_CASE`
- Method, property and field names are transformed to `snake_case`
- A name that collides with a ghūl keyword is left unchanged too. The backtick is how you write such a name where the keyword reading would otherwise win, as in ``` `class ```; it is not part of the name, and after a `.` none is needed

## namespace and type name re-mapping
Some commonly used namespace and type names are re-mapped in line with ghūl conventions

### namespaces
- `System.Collections.Generic` is mapped to `Collections`
- `System.IO` is mapped to `IO`

### framework and collection types

| Original Type                                        | Mapped Type                         |
|------------------------------------------------------|-------------------------------------|
| `System.IDisposable`                                 | `Ghul.Disposable`                   |
| `System.Console`                                     | `IO.Std`                            |
| `System.Collections.IEnumerable`                     | `Collections.NonGenericIterable`    |
| `System.Collections.Generic.IReadOnlyCollection`     | `Collections.Bag`                   |
| `System.Collections.Generic.ICollection`             | `Collections.MutableBag`            |
| `System.Collections.IEnumerator`                     | `Collections.MoveNext`              |
| `System.Collections.Generic.IEnumerable`             | `Collections.Iterable`              |
| `System.Collections.Generic.IEnumerator`             | `Collections.Iterator`              |
| `System.Collections.Generic.IReadOnlyList`           | `Collections.List`                  |
| `System.Collections.Generic.IList`                   | `Collections.MutableList`           |
| `System.Collections.Generic.List`                    | `Collections.LIST`                  |
| `System.Collections.Generic.IReadOnlyDictionary`     | `Collections.Map`                   |
| `System.Collections.Generic.IDictionary`             | `Collections.MutableMap`            |
| `System.Collections.Generic.Dictionary`              | `Collections.MAP`                   |
| `System.Collections.Generic.IReadOnlySet`            | `Collections.Set`                   |
| `System.Collections.Generic.ISet`                    | `Collections.MutableSet`            |
| `System.Collections.Generic.HashSet`                 | `Collections.SET`                   |
| `System.Collections.Generic.IComparer`               | `Collections.Comparer`              |
| `System.Collections.Generic.IEqualityComparer`       | `Collections.EqualityComparer`      |
| `System.Collections.Generic.Comparer`                | `Collections.ComparerBase`          |
| `System.Collections.Generic.EqualityComparer`        | `Collections.EqualityComparerBase`  |
| `System.Collections.Generic.Stack`                   | `Collections.STACK`                 |
| `System.Threading.Tasks.Task`                        | `Tasks.TASK`                        |
| `System.Threading.Tasks.Task<T>`                     | `Tasks.TASK[T]`                     |

### primitive types

The primitive types are declared in `Ghul.Intrinsics`, which every file sees without a `use`:

| Original Type     | Mapped Type          |
|-------------------|----------------------|
| `System.Void`     | `void`               |
| `System.Boolean`  | `bool`               |
| `System.Char`     | `char`               |
| `System.Byte`     | `ubyte`              |
| `System.SByte`    | `byte`               |
| `System.UInt16`   | `ushort`             |
| `System.Int16`    | `short`              |
| `System.UInt32`   | `uint`               |
| `System.Int32`    | `int`                |
| `System.UInt64`   | `ulong`              |
| `System.Int64`    | `long`               |
| `System.UIntPtr`  | `uword`              |
| `System.IntPtr`   | `word`               |
| `System.Single`   | `single`             |
| `System.Double`   | `double`             |
| `System.Decimal`  | `decimal`            |
| `System.Object`   | `object`             |
| `System.String`   | `string`             |
| `System.Numerics.BigInteger` | `bigint` |

## making your own types work with .NET

The mappings above are about reaching into .NET. This section is the other direction: what a ghūl type has to provide before .NET libraries treat it as a first-class value rather than as an opaque object. In each case the language already has the operator or member; the point is which one .NET is looking for.

### equality

.NET collections compare values with `Equals` and `GetHashCode`. A `MAP` or a `SET` finds a key by its hash and then checks it with `Equals`; `contains` on a list checks each element with `Equals`. A ghūl type defines its equality with `=~` and its hash with `get_hash_code`. When a type defines both, the compiler synthesises an `Equals` override that calls `=~`, so .NET collections compare the type the way ghūl code does:

<GhulExample name="dotnet-integration-4" />

Build the hash from the members `=~` compares. `System.HashCode.combine` does this.

When a type defines `=~` but not `get_hash_code`, the compiler reports an `equality-without-hash` warning and doesn't synthesise an `Equals` override. .NET collections then compare a class by reference and a struct member by member, whatever its `=~` says. The compiler does not synthesise the hash itself, because `=~` can ignore some members, and a hash of all of them would then disagree with it. The exception is a class marked [`@equality()`](/definitions.html) or a struct whose members are all public: there the compiler synthesises both `=~` and a matching `get_hash_code`.

### ordering

Sorting, `Ghul.Comparable[T]`, and the relational operators all come from `<>`, a three-way ordering returning a negative, zero, or positive `int`. Defining it gives a type `<`, `<=`, `>` and `>=` and makes it sortable by .NET at the same time:

<GhulExample name="dotnet-integration-5" />

### conversions

A .NET user-defined conversion operator (`op_Implicit` / `op_Explicit`) declared on either the source or the target type is reachable through `cast`:

<GhulExample name="dotnet-integration-8" />

`cast T(v)` calls the operator and lets it throw on failure. `cast T?(v)` never throws: a failed conversion becomes the absent value, and any other exception still propagates.

### disposal

A type that holds something to release implements `Ghul.Disposable`, which is .NET's `IDisposable`, by defining `dispose`. Write `use` in front of an expression that creates one, and the value is disposed when the enclosing block ends, however the block is left:

<GhulExample name="dotnet-integration-6" />

`use` gives back the value it disposes, so it can go wherever the expression could: an initializer, an argument, an operand. `let use x = E` is the older spelling of `let x = use E`.

`let use x = E in` disposes its local sooner: once the statement holding it has run, rather than when the block ends:

<GhulExample name="dotnet-integration-use-operator" />

### iteration

A type implementing `Collections.Iterable[T]` is a .NET `IEnumerable<T>`, so it works with `for`, with the pipe combinators, and with any .NET API taking a sequence. The requirement is an `iterator` property, and a [generator](/async-and-generators.html#generators) is usually the shortest way to supply one:

<GhulExample name="dotnet-integration-7" />

### a gotcha when reflecting over your types

An auto-property's backing field is named `$` followed by the property name, and reflection sees it alongside the property itself. A reflection-based serializer told to include fields will therefore emit everything twice. With `System.Text.Json`, leave `include_fields` alone unless the type genuinely has fields to serialize.

## attributes

A pragma whose name isn't one of the compiler's own names a .NET attribute, and the compiler emits that attribute on the definition the pragma is written before: a type, a function or method, a field or property, or a single parameter. `@Foo(...)` finds `FooAttribute` when there is no plain `Foo`, as C# does. The arguments can be positional, named (`name = value`), arrays, or `typeof`.

### deprecation

`System.Obsolete` marks a declaration as deprecated. The compiler reports every use of the declaration as a `deprecated` warning, with the attribute's message when it has one:

<GhulExample name="dotnet-integration-deprecated" />

With `true` as its second argument, `@System.Obsolete("removed", true)`, the attribute makes each use an error instead. The compiler reads the attribute on a declaration from another assembly too, whichever language it was written in, and a call to a class's constructor counts as a use of the class. A use written inside a declaration that is itself deprecated is not reported, so an old member can go on calling another. Where a use is deliberate, `@suppress("deprecated")` silences the warning like any other. In the editor, hover shows the message under the signature and completion marks the item as deprecated.

### method implementation flags

`System.Runtime.CompilerServices.MethodImpl` tells the runtime how to treat the method it is written on. Its options become the method's implementation flags rather than an attribute the method has, because the flags are where the runtime reads them: `NO_INLINING` keeps the method out of the inliner, and `SYNCHRONIZED` takes a lock around it. Reflection reads them back with `get_method_implementation_flags`:

<GhulExample name="dotnet-integration-method-impl" />

### struct layout

`System.Runtime.InteropServices.StructLayout` on a class or struct sets how its fields are laid out in memory, which is what a native structure the type stands for has to match. A struct is laid out sequentially, in the order its members are declared, unless it asks otherwise. `EXPLICIT` places each field where a `FieldOffset` on it says, so two fields can share the same bytes. Every instance field of such a type needs a `FieldOffset`, and so it has to be a `field` rather than an auto-property. On a little-endian machine the low byte of a `ushort` comes first:

<GhulExample name="dotnet-integration-struct-layout" />

## ASP.NET Core

ASP.NET Core minimal APIs work from ghūl. Extension methods aren't exposed as members, so the fluent builder calls go through the `|>` thread-first operator, which passes the left-hand side as the called method's first argument:

<GhulExample name="dotnet-integration-1" />

`app |> map_get(...)` calls the `MapGet` extension on `app`; the route handler is an anonymous function returning an `IResult`.

Controller-style APIs rely on attributes, which apply to classes and methods: `[ApiController]`, `[Route(...)]`, `[HttpGet(...)]` and so on. A parameter-binding attribute such as `[FromBody]` is written as a pragma on the parameter, as in `@Microsoft.AspNetCore.Mvc.FromBody() body: T`.

## Entity Framework Core

Entity Framework Core works from ghūl. A context extends `DbContext` and exposes each table as a `DbSet`; EF Core's conventions expect PascalCase names, so `@IL.name` maps the ghūl members onto them:

<GhulExample name="dotnet-integration-2" />

The `Products` set and the entity's `Id` and `Name` are the names EF Core's model builder and SQL generation look for. Reads and writes call the async methods directly, with `await` - `save_changes_async` here.

`@IL.name("Name")` sets the name a function, method or property has in the compiled assembly, while ghūl code goes on using the name it declares. On a property it also names the accessors `get_Name` and `set_Name`, and `@IL.name.read("...")` or `@IL.name.assign("...")` names one accessor on its own.

## mocking with NSubstitute

The .NET base libraries include no mocking framework; [NSubstitute](https://nsubstitute.github.io/) is the lowest-friction third-party option from ghūl, and the compiler's own test suite uses it. `Substitute.for` builds a stand-in for a trait, and the `Returns` extension stubs a call through `|>`:

<GhulExample name="dotnet-integration-3" />

`for` is a reserved word, so the example escapes it with a backtick. Its argument is the substitute's constructor arguments as an `object[]`; a trait has none, so the argument is an empty array. Where a full framework isn't warranted, a hand-written trait implementation is the zero-dependency alternative.

