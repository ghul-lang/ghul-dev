# calling C libraries

A [native](/native) ghūl program can call a C function directly. `@extern` before a function with no body declares the C function, and the ghūl signature is the whole declaration:

<GhulExample name="calling-c-1" />

::: warning foreign code is unsafe
The compiler reads no C header, so it can't check that a declaration matches the C function it names. A wrong parameter type, a buffer shorter than the length passed with it, or a pointer used after the memory it points to is released is undefined behavior, as it is in C. The program can crash, or carry on with corrupted memory.
:::

Everything on this page works on the native target only. Each example here was built and run as a native executable, and the output shown is what it printed.

## declaring a C function

`@extern(module, name)` takes the library that supplies the function and the C name of the function. For a function the C library holds, the module is `"libc"`, or empty. The ghūl function can have any name.

The scalar types cross as the C types of the same width: `int` is a C `int`, `long` an `int64_t`, `double` a `double`, and `byte` and `ubyte` are a C `signed char` and `unsigned char`. A C pointer that the program only holds and passes back, such as a handle, is a `word`.

## strings

A `string` argument crosses as a NUL-terminated UTF-8 copy, made for the call and released after it. A function that answers a string says who owns the text: `result = "copy"` copies text the C library keeps, and `result = "take"` copies text the C library allocated and then frees it:

<GhulExample name="calling-c-2" />

A null pointer answers the absent string, so the return type is `string?`. For a library with a deallocator of its own, `free = "name"` names the function `result = "take"` frees the text with.

## out-parameters

A reference, such as `int ref`, crosses as the address of the variable, so a C function that writes through an `int *` writes into it:

<GhulExample name="calling-c-3" />

The address is valid for the call only. The same works for a field or an array element, and for `word ref` where the C function writes a pointer, as `sqlite3_open` does.

## buffers and variadic functions

An `ARRAY[ubyte]` crosses as the address of its first byte, so the C function reads or writes the array's own bytes. The length is a separate argument, as it is in C. `variadic = n` calls a variadic function such as `printf`, passing the parameters from the `n`th on as C passes variadic arguments:

<GhulExample name="calling-c-4" />

Nothing checks the length against the array: a length greater than the array's count is the caller's bug. A call with different argument types is a separate declaration of the same C function.

## errors

`errno = <value>` makes the function answer `Result[T, int]`. The value names the result that signals failure, and the `ERROR` variant holds the C library's `errno`, read straight after the call. `Ghul.Interop.error_text` gives the C library's description of it:

<GhulExample name="calling-c-5" />

`errno = "negative"` takes any negative result as failure. `errno = "set"` clears `errno` before the call and takes a nonzero `errno` after it as failure, for the few functions documented to be used that way, such as `strtol`.

## C structs

`@layout("c")` before a struct lays out its fields as C lays out a struct with the same fields: in the order they are declared, each aligned to its own size, with the padding C puts between them. A reference to the struct crosses as its address:

<GhulExample name="calling-c-6" />

`Ghul.Interop.size_of` gives the struct's C `sizeof`. `@layout("c")` is a promise about layout only, and nothing about the fields is checked: the declaration has to match what the C code expects. A reference field, such as a `string`, is laid out as a pointer, and a `bool` takes one byte, as a C `_Bool` does. Bit-fields and C unions have no equivalent, and a struct doesn't cross by value.

## reading memory through a pointer

`Ghul.Interop.read` reads a value of any type at an offset from an address the C library answered, and `write` writes one. `read_utf8` copies the NUL-terminated text at an address, and `copy_bytes` copies a number of bytes:

<GhulExample name="calling-c-7" />

The reads are unchecked: an address that isn't readable, or memory that doesn't hold what is read, is undefined behavior. `Ghul.Interop.elements` gives the address of an array's first element, valid while the array is kept alive.

## memory C keeps

A foreign argument is valid for the call only. Memory the C library keeps a pointer to after the call returns has to stay where it is, and stay alive, for as long as the library uses it. A `Ghul.Interop.PINNER` holds it: `pin` gives the address of an array, `pin_utf8` the address of a NUL-terminated copy of a string, and `keep` keeps any object alive. Disposing the pinner releases every pin at once:

<GhulExample name="calling-c-8" />

`pin_struct` copies a struct into pinned memory, for a struct the library keeps the address of across calls, and answers a `Pinned` whose `value` reads back what the library wrote. A pointer the library holds after its pinner is disposed is a use-after-free, which nothing checks, so dispose the pinner only after releasing whatever C resource holds the pointers.

The garbage collector doesn't scan memory the C library allocated with `malloc`, so a ghūl object referred to only from there isn't kept alive. That is why the pin is needed.

## handles

A `Ghul.Interop.HANDLE` subclass holds a resource the C library owns, by its address, and releases it exactly once with the library's own function:

<GhulExample name="calling-c-9" />

`address` throws once the handle has been released, so a released handle can't be passed to C by mistake. A handle has no finalizer: release is explicit, with `dispose` or `use`.

## linking against a system library

A program is linked statically against musl by default, so a library it calls has to be a static archive built for musl. `"link-mode": "dynamic"` in the `llvm` section of the manifest links it against the system's glibc and shared libraries instead, and `"native"` declares the C libraries it needs:

<GhulExample name="calling-c-10" />

The example's manifest, `ghul-project.json`{:text}:

```json
{
    "name": "calling-c-10",
    "kind": "program",
    "targets": ["llvm"],
    "sources": ["calling-c-10.ghul"],
    "dependencies": { "ghul-runtime": { "version": ">=42.7.0" } },
    "llvm": {
        "link-mode": "dynamic",
        "native": {
            "zlib": { "soname": "libz.so.1", "version": "^1.2.11", "libraries": ["z"], "install": { "debian": "zlib1g" } }
        }
    }
}
```

`soname` is required: it is the shared library the program is built against, and the dynamic loader checks it again when the program starts. `libraries` lists the names linked, as `lib<name>`. `version` is a range of the library's release, checked against what pkg-config gives where it is installed. `install` says what to install, for the message a build gives where the library is missing.

`ghul build`{:sh} finds the library where the dynamic loader finds it, through the runtime file its soname names, such as `libz.so.1`{:text}. So only the library's runtime package needs to be installed (`zlib1g`{:text} on Debian and Ubuntu), not its development package, and the build needs no C compiler. The program then needs glibc and the library on the machine it runs on, where a statically linked program runs on any Linux.

## a library of bindings

A library project can declare the C libraries it binds under `llvm.native` in its own manifest, and every program that depends on it is checked and linked against them, with nothing about the C library in the program's manifest. The [zlib example](https://github.com/ghul-lang/ghul-examples/tree/main/zlib) in ghul-examples is one, `ghul-zlib`, which another project depends on from git, at a branch and in a directory of the repository:

```json
"dependencies": {
    "ghul-runtime": { "version": ">=42.7.0" },
    "ghul-zlib": { "git": "https://github.com/ghul-lang/ghul-examples", "branch": "main", "directory": "zlib/ghul-zlib" }
},
"llvm": { "link-mode": "dynamic" }
```

It keeps zlib's `z_stream` in a `PINNER` across calls to `deflate` and `inflate`, with the input and output buffers the stream points into pinned on the same one.

## linking statically

To link a C library statically, so that the program runs on any Linux, build the library for musl and name the archive in the manifest's `llvm.link`{:text}, or its directory in `llvm.library-paths`{:text}. `ghul build`{:sh} refuses the distribution's own archives, such as `/usr/lib/x86_64-linux-gnu/libz.a`{:text}, which are built for glibc, and says to link dynamically instead.

## what doesn't cross

A class, a tuple, an array of anything but `ubyte`, a function value and a struct by value are all errors at the parameter. C can't call back into ghūl yet, so an API that takes a callback, such as `qsort`, can't be called. A callback arriving from C on another thread isn't supported either: a native ghūl program has one thread.
