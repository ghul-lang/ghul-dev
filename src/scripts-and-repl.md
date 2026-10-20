# scripts, the REPL and notebooks

The `ghul`{:sh} command runs a ghūl source file directly, with no project file, or starts an interactive session that compiles and runs code as you type it. The [online REPL](https://ghul.dev/repl/) runs the same kind of session in the browser, without installing anything.

A session at a terminal:

```plaintext
$ ghul repl
ghūl repl. :help for commands.
1> let names = ["ada", "grace", "barbara"]
 | names |> map(n => n.length)
[3, 5, 7]
```

## installing

`ghul`{:sh} installs as the [`ghul.cli`{:text}](https://www.nuget.org/packages/ghul.cli) .NET tool, which needs the [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0):

```sh
dotnet tool install -g ghul.cli
```

.NET installs global tools in `~/.dotnet/tools`{:text}, which has to be on your `PATH`{:text}; the first `dotnet tool install -g`{:sh} says how to add it if it isn't.

On Linux, x64 or arm64, `ghul`{:sh} also installs without .NET, as a native executable:

```sh
curl -fsSL https://raw.githubusercontent.com/ghul-lang/ghul-cli/main/install.sh | sh
```

Scripts and projects work with either install. The .NET REPL and the Jupyter kernel need the .NET SDK, and `ghul repl --target llvm`{:sh} is the [native REPL](/native#the-repl).

`ghul`{:sh} installs its own copy of the compiler the first time it needs one. `ghul install compiler`{:sh} installs it ahead of time, and `ghul update`{:sh} brings `ghul`{:sh} and the compiler to the newest release; the compiler is always the newest. `ghul version`{:sh} shows both versions:

```plaintext
$ ghul version
ghul 9.2.0
ghul.compiler 66.11.0
```

`dotnet tool update -g ghul.cli`{:sh} updates a `ghul`{:sh} installed as a .NET tool.

## running a script

A script is one `.ghul`{:text} file of [top-level statements](/syntax.html#top-level-statements). `args`{:text} holds its command-line arguments and `env`{:text} its environment:

```ghul
#!/usr/bin/env ghul

let name = if args.count > 0 then args[0] else "world" fi

write_line("hello, {name}")
write_line("your shell is {env["SHELL"] ?? "unknown"}")
```

`ghul`{:sh} followed by the file's name compiles and runs it, and passes it everything after the name:

```plaintext
$ ghul greet.ghul ada
*** succeeded ***
hello, ada
your shell is /bin/bash
```

A script has the compiler's default imports, as the REPL does, so `write_line`, the pipes and the collections don't need a `use`. A script that declares its own `namespace` chooses its own imports instead. A file with an `entry` function instead of top-level statements runs too, and an `entry` returning an `int` sets the exit status.

On Linux, a script whose first line is `#!/usr/bin/env ghul`{:text} runs like any other executable once it is marked as one:

```plaintext
$ chmod +x greet.ghul
$ ./greet.ghul grace
hello, grace
your shell is /bin/bash
```

Each script is compiled once for each combination of its text and the compiler version, and the result is kept under `~/.cache/ghul-cli/scripts`{:text}. Running an unchanged script again starts it straight away, without the compiler's `*** succeeded ***`{:text} line. `ghul cache clear`{:sh} empties the cache, and `ghul --no-cache greet.ghul`{:sh} compiles again regardless.

`ghul -`{:sh} reads the script from standard input, and `ghul compile greet.ghul`{:sh} compiles a script without running it and prints the path of the result.

`ghul`{:sh} runs a file only if it looks like a script: its name ends in `.ghul`{:text}, or it is executable and starts with `#!`{:text}. `ghul run notes.txt`{:sh} runs a file whatever it is called.

## the REPL

`ghul repl`{:sh} starts an interactive session. Each submission is compiled and run as soon as it is complete, and what it defines stays available to every later one. The same sessions run in the browser, without installing anything, in the [online REPL](https://ghul.dev/repl/). The prompt shows the number the next submission will take, and a line that doesn't end the submission is followed by a `|`{:text} prompt.

A line that finishes an expression or a call ends the submission and shows its value. A line that finishes a `let`, an assignment or a definition doesn't, since those set something up for what follows: the `|`{:text} prompt stays, and the next line joins the same submission. So a definition and a first use of it can be typed as one submission, and a definition typed on its own is ended with a blank line:

```plaintext
1> let names = ["ada", "grace", "barbara"]
 | names |> map(n => n.length)
[3, 5, 7]
2> greet(name: string) -> string =>
 |     "hello, {name}"
 |
3> names |> map(greet)
["hello, ada", "hello, grace", "hello, barbara"]
```

An `if`, `case`, loop or `try` written over several lines doesn't end the submission when it closes either, and nor does a line that leaves something open, such as an open bracket or a block with no closing keyword. A blank line ends the submission where it stands and shows no value. A line holding only `.`{:text} ends it and shows the value it ends on:

```plaintext
4> if names.count > 2 then
 |     "several"
 | else
 |     "few"
 | fi
 | .
several
```

A line ending in a `\`{:text} on its own keeps the submission open whatever it holds, and the `\`{:text} is dropped. Alt-Enter ends the submission from any line and shows its value.

Defining a name again replaces it for later submissions, and the new definition can read the value it replaces:

```plaintext
9> let limit = 4
 |
10> let limit = limit * 10
  | limit
40
```

Types are defined the same way, and a mistake is reported with the line it points at:

```plaintext
11> union Shape is
  |     CIRCLE(radius: double)
  |     RECT(width: double, height: double)
  | si
  |
12> area(s: Shape) -> double =>
  |     case s
  |     when c: Shape.CIRCLE then 3.14159 * c.radius * c.radius
  |     when r: Shape.RECT then r.width * r.height
  |     esac
  |
13> [Shape.CIRCLE(1.0), Shape.RECT(3.0, 4.0)] |> map(area)
[3.14159, 12]
14> area(Shape.SQUARE(2.0))
cell-14: 1,12..1,18: error: member SQUARE not found in Shape
 1 | area(Shape.SQUARE(2.0))
   |            ^^^^^^
```

The compiler's default imports (`use default`) are in force in every submission, and a `use` you type stays in force for the rest of the session. `ghul repl --no-default-use`{:sh} leaves the default imports out.

### editing

At a terminal the whole submission is edited in place, however many lines it has. Enter on the last line ends the submission or waits for more as described above, and Enter on an earlier line starts a new line there. Up and Down move between lines, and past the first or last line bring back earlier submissions, including those of earlier sessions. Each line starts indented after a line that opens a block, and a closing word such as `fi`{:text} steps back out as it is typed.

Tab completes the name being typed from everything the session has defined; where more than one name fits, it writes in as much as they share and lists them. Tab again offers them as a menu: Tab and the arrow keys move through it, Enter keeps the name chosen, and Escape puts back what was typed. Shift-Tab shows what the name at the cursor is. Home and End, or Ctrl-A and Ctrl-E, go to either end of a line; Ctrl-Left and Ctrl-Right, or Alt-B and Alt-F, move by a word; Ctrl-U and Ctrl-K delete to either end of the line and Ctrl-W the word before the cursor; Ctrl-L clears the screen.

Ctrl-C while a submission is running interrupts it and brings the prompt back with the session intact. At the prompt, Ctrl-C sets aside what you have typed: it stays on the screen marked `^C`{:text}, a new prompt with the same number takes its place, and Up brings it back from history. Ctrl-D in an empty submission leaves.

What you type is coloured as you type it, in the same colours as the examples on this site, and so is the line an error points at. `ghul repl --theme dark`{:sh}, `--theme light`{:sh} or `--theme none`{:sh} chooses the colours, and setting `NO_COLOR`{:text} turns them off.

### commands

A line starting with `:`{:text} is a command:

| command | what it does |
| --- | --- |
| `:cells`{:text} | lists the submissions so far, each with how it ended |
| `:cells 3`{:text} | shows the whole of submission 3 |
| `:rerun 3`{:text} | submits submission 3 again, as a new submission |
| `:rerun 3..`{:text} | submits 3 again, then every later one that ran to the end |
| `:edit 3`{:text} | brings back submission 3 to change and submit as a new one |
| `:type EXPRESSION`{:text} | shows the type of an expression without running it |
| `:complete TEXT`{:text} | lists what could follow some text |
| `:hover TEXT`{:text} | shows what the end of some text names |
| `:ref FILE`{:text} | references an assembly in every later submission |
| `:nuget PACKAGE [VERSION]`{:text} | references a NuGet package and what it depends on, the latest stable release without a version |
| `:save FILE`{:text} | writes the submissions that ran to the end to a file |
| `:load FILE`{:text} | submits each part of a file `:save` wrote, in order |
| `:reset`{:text} | starts a fresh session |
| `:help`{:text} | lists the commands and keys |
| `:quit`{:text} | leaves |

`:rerun 3..`{:text} brings a session up to date after a change to something an earlier submission used. Here `names` is defined again, and every submission from 3 on runs again with it, including the new definition itself:

```plaintext
5> :cells
1  ok          let names = ["ada", "grace", "barbara"]  (2 lines)
2  ok          greet(name: string) -> string =>  (2 lines)
3  ok          names |> map(greet)
4  ok          if names.count > 2 then  (5 lines)
5> let names = ["alan", "edsger"]
 |
6> :rerun 3..
6> names |> map(greet)
["hello, alan", "hello, edsger"]
7> if names.count > 2 then
 |     "several"
 | else
 |     "few"
 | fi
few
8> let names = ["alan", "edsger"]
```

It stops at the first submission that no longer runs to the end.

A C# extension method is called as the static method it is, so a package's extensions are reached through their class, and `_` supplies an optional argument's default:

```plaintext
1> :nuget Humanizer.Core 2.14.1
restoring Humanizer.Core...
referenced Humanizer
1> Humanizer.NumberToWordsExtension.to_words(1234, _)
one thousand two hundred and thirty-four
```

### how a session differs from a file

Each submission is compiled as a small library of its own. Messages call the third submission `cell-3`{:text}, and code can reach what it defined as `cell3`, as in `cell3.x`.

Defining something again replaces it for later submissions rather than editing what has already run: code compiled earlier keeps what it was compiled against. A `partial` or `impl` block in a later submission defines the type again, so a function taking the earlier type still takes that one, and the REPL says so:

```plaintext
15> trait Named is
  |     name() -> string
  | si
  |
16> impl Named for Shape is
  |     name() -> string =>
  |         if isa Shape.CIRCLE(self) then "circle" else "rectangle" fi
  | si
  |
ghul: area still takes the earlier Shape; redefine it to use the new one
17> Shape.CIRCLE(1.0).name()
circle
```

A class or trait defined in a session can be extended by a later submission, since that submission is another assembly. The compiler still treats the hierarchy as closed, so a `case` that covers every subclass doesn't need an `else`. If a later submission adds a subclass, code compiled before it raises an exception when it meets a value of the new type, rather than reading it as one it knows.

A name that begins with `_` is visible to later submissions, as it is to the rest of a file:

```plaintext
18> let _hidden = 42
  |
19> _hidden + 1
43
```

.NET cannot stop a running thread from outside, so an interrupted submission is abandoned rather than ended: it keeps its definitions, and can go on running in the background until it finishes or the session ends.

`ghul repl --no-server`{:sh} starts the compiler for each submission instead of keeping one running, which takes about a second a submission rather than tens of milliseconds.

## notebooks

The [`ghul.jupyter`{:text}](https://www.nuget.org/packages/ghul.jupyter) tool is a [Jupyter](https://jupyter.org) kernel for ghūl: each notebook cell is a submission to the same kind of session the REPL runs. Install it and register it with Jupyter:

```sh
dotnet tool install -g ghul.jupyter
ghul-jupyter install
```

To use it in VS Code, install the Jupyter extension, then reload the window (**Developer: Reload Window**), since the Jupyter extension only looks for kernels when it starts. Open or create a `.ipynb`{:text} file, choose **Jupyter Kernel...** from the kernel picker, and pick **ghūl**. The ghūl extension highlights the cells. A cell keeps the language it was created with, so cells made before the ghūl kernel was chosen stay in their earlier language until you change it from the language indicator at the cell's bottom right.

The notebook's stop button interrupts a running cell, as Ctrl-C does in the REPL. Hover is not available in a notebook cell.

The kernel compiles cells with the compiler `ghul`{:sh} installs, or the `ghul-compiler`{:text} on the path. Installing `ghul.cli`{:text} and running any script once is the simplest way to have one.
