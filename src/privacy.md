# privacy

ghul.dev counts visits so that we can see the site works and which pages and examples people use. It doesn't use cookies, and it doesn't follow anyone across other sites.

## what is counted

The counter is [GoatCounter](https://www.goatcounter.com), running on this site's own server. For each page view it records the page, the page you came from, your browser, operating system and screen size, and the country and region worked out from your address. The address itself is not stored.

It also counts what happens on a page: which examples are opened, edited and run, whether a run compiled and finished, whether the editor's analysis connected, how long the first run took, in bands such as 1-3 seconds, and failures in the browser, by kind. Nothing you type, no source code and no message from the compiler is ever part of a count.

Page views from one visit share a random value, held for at most eight hours, so a path through the site can be seen. Nothing is written to your browser to do this. Counts are kept for 180 days.

## server logs

The web server logs each request with the address it came from, and keeps that log for 14 days. A second log keeps only the network part of the address (the first three numbers of an IPv4 address, the first 48 bits of an IPv6 one) for 180 days. The compile and analysis services log how each request ended and how long it took, never the code or the address.

## code you run

The playground, the REPL and the example editors send your code to the server to be compiled, and run the compiled program in your browser. The source is written to a temporary file for the compile and deleted afterwards. What the compiler produced is kept in a cache under a hash of the source, so the same program isn't compiled twice. The cache doesn't record who sent it, and the oldest entries are removed first. The editor's analysis works on a copy of your code that is deleted when its session ends, at the latest when you leave the page.

## other services

The playground, the REPL and the example editors load their font from [jsDelivr](https://www.jsdelivr.com). The Rosetta Code pages and the playground's examples fetch their source from GitHub, and the install instructions ask NuGet for the current version numbers. Those services see these requests as they would any other.

## what your browser keeps

The playground keeps what is in its editor, so that it is still there when you come back, and remembers an access token if you enter one. The site remembers whether you chose the light or dark theme.

## not being counted

Visit [ghul.dev/#toggle-goatcounter](https://ghul.dev/#toggle-goatcounter) once in each browser you use and nothing from that browser is counted, on the site, the playground or the REPL. Visiting it again turns counting back on. Clearing the site's data in your browser also turns counting back on.
