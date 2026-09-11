[![NPM](https://nodei.co/npm/fimfic2epub.png?compact=true)](https://www.npmjs.com/package/fimfic2epub)

![fimfic2epub logo](https://github.com/daniel-j/fimfic2epub/raw/master/assets/fimfic2epub-logo.png)

fimfic2epub
===========
This is a tool to generate better EPUB ebooks from [Fimfiction](https://fimfiction.net/) stories. It's also a Chrome/Edge/Firefox extension (Manifest V3), replacing the default EPUB download option with this tool. If you're on an Arch Linux-based system you can install it from the [Arch User Repository](https://aur.archlinux.org/packages/fimfic2epub/).

[Screenshot](http://i.imgbox.com/MalEBiuC.png) of the web extension


Features
--------
* The generated ebook is in modern EPUB3 format with fallbacks for older EPUB2 reading systems
* Improved styling and formatting of content compared to Fimfiction's export options
* Cover image can be changed from an image file or url
* Downloads and embeds artwork from the story inside the EPUB file, including YouTube thumbnails, for optimal offline reading and archiving (optional)
* Identical images are stored once, or optionally kept as separate files per link
* Rating, tags, status, story description and more info are available on the title page
* The table of contents page includes chapter modification dates and word counts
* Option to put all author notes in an index at the end of the ebook
* Option to not add a title heading for chapters (in case the story has its own)
* Tweak paragraph style from double-spaced to indented (similar to book typesetting, may not look good on every story)
* Emoji, icon and webp support
* Calculate the [Flesch reading ease](https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests#Flesch_reading_ease) value of the story
* Customize metadata of the generated ebook, such as title, author, subjects and description
* Command line tool with same features as the web extension, using the Fimfiction API


Demo
----
You can have a look at what a generated EPUB looks like [here](http://books.djazz.se/?epub=epub_content%2Fsummer_island). It was generated from the story [Summer Island](https://fimfiction.net/story/289663/summer-island).


Usage (web extension)
-----------------
You can download the Chrome extension from [Chrome Web Store](https://chrome.google.com/webstore/detail/fimfic2epub/fiijkoniocipeemlflajmmaecfhfcand) and the Firefox add-on from [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/fimfic2epub/). The Chrome package also works in Microsoft Edge and other Chromium-based browsers.

Open a story page on Fimfiction and click the fimfic2epub logo next to the story title, the toolbar button, or the story's own "Download Story (.epub)" menu entry. A dialog lets you adjust the options before the EPUB is generated in your browser.

The extension needs access to `fimfiction.net`, `cdn.jsdelivr.net` (emoji images), `googleapis.com` and YouTube's image hosts (video thumbnails) to embed remote content. Firefox lists these permissions when the add-on is installed; if you revoke them later in the add-on's settings, embedding remote images will fail.


Installation & usage (command line)
-------------------
You can install the tool by running `npm install -g fimfic2epub` (Node.js 22.12 or newer is required). On Arch Linux-based systems you can install it from the AUR like this: `yay -S fimfic2epub` (replace `yay` with your favorite AUR-helper)

You can then run the tool it like this:

`$ fimfic2epub [options] <story id/url> [<optional filename>]`

By default the EPUB will be saved in the current working directory with the filename `Author - Title.epub`. Run `fimfic2epub -h` to see a list of all flags.

### Fimfiction API token

Fimfiction protects its story pages and downloads with a bot check that only real browsers can pass, so the command line tool has to read stories through the [Fimfiction API](https://www.fimfiction.net/developers/api/v2/docs) instead. This requires an API token:

1. Log in to Fimfiction and create an application at https://www.fimfiction.net/developers/apps
2. Either pass the application's client id and secret (`--client-id` / `--client-secret`, or the `FIMFICTION_CLIENT_ID` / `FIMFICTION_CLIENT_SECRET` environment variables) and the tool requests a token for you, or pass a bearer token directly with `--token` (or the `FIMFICTION_TOKEN` environment variable).

Without a token the tool still tries the public endpoints; if Fimfiction answers with the bot check, it exits with an explanation. As an alternative to a token you can copy the cookies of a logged-in browser session and pass them with `--cookie` together with the same `--user-agent` as the browser, which may or may not be accepted by the bot check.

```
Usage: fimfic2epub [options] <story> [filename]

Tool to generate improved EPUB ebooks from Fimfiction stories

Arguments:
  story                        story id or url
  filename                     output filename, - for stdout. %id% is replaced by the story id

Options:
  -V, --version                output the version number
  -d, --dir <path>             Directory to store ebook in. Is prepended to filename
  -t, --title <value>          Set the title of the story
  -a, --author <value>         Set the author of the story
  -T, --typogrify              Enable typographic fixes (smart quotes, dashes, ellipsis, ordinal)
  -c, --no-comments-link       Don't add link to online comments
  -H, --no-headings            Don't add headings to chapters (includes chapter title, duration and word count)
  -W, --no-chapter-word-count  Don't add word count to chapter headings
  -D, --no-chapter-duration    Don't add time to read to chapter headings
  -b, --no-bars                Don't add chapter bars to show reading progress
  -r, --no-reading-ease        Don't calculate Flesch reading ease
  -e, --no-external            Don't embed external resources, such as images (breaks EPUB spec)
  -m, --no-dedupe-images       Keep a separate copy of every embedded image, even when several links return the same file
  -n, --no-notes               Don't include author notes
  -i, --notes-index            Create an index with all author notes at the end of the ebook
  -p, --paragraphs <style>     Select a paragraph style <spaced|indented|indentedall|both> (default: "spaced")
  -k, --kepubify               Add extra <span> elements for Kobo EPUB (KEPUB) format
  -j, --join-subjects          Join dc:subjects to a single value
  -w, --wpm <number>           Words per minute. Set to 0 to disable reading time estimations (default: 200)
  -C, --cover <url>            Set cover image url
  --token <token>              Fimfiction API token, or set FIMFICTION_TOKEN
  --client-id <id>             Fimfiction API application client id (or FIMFICTION_CLIENT_ID), used with --client-secret to request a token
  --client-secret <secret>     Fimfiction API application client secret (or FIMFICTION_CLIENT_SECRET)
  --cookie <cookie>            Cookie header copied from a logged-in browser session, an alternative to an API token
  --user-agent <string>        User agent to send, should match the browser the cookies were copied from
  -h, --help                   display help for command
```

Examples
--------
```
Download with automatic filename:
$ export FIMFICTION_TOKEN=...
$ fimfic2epub 289663
$ fimfic2epub https://www.fimfiction.net/story/289663/summer-island

Download and save to a specified dir/filename:
$ fimfic2epub 289663 path/to/file.epub
$ fimfic2epub --dir path/to/my/dir 289663 ebook_%id%.epub # %id% gets replaced by the story id

Pass the API application credentials instead of a token:
$ fimfic2epub --client-id <id> --client-secret <secret> 289663
```

The generated cover image for stories without artwork needs the optional `@napi-rs/canvas` package (installed automatically when prebuilt binaries are available for your platform). Without it, such stories get a text-only cover page.


Building
--------
Make sure [Node.js](https://nodejs.org) 22.18 or newer is installed (the runtime needs 22.12, the Babel 8 build tooling 22.18). After you've cloned this repository, run `npm install` and `npm run build` to build everything: the web extension (`extension/build/`, packaged as `extension.zip` for Chrome/Edge and `extension.xpi` for Firefox), the npm library (`dist/`) and the command line tool (`build/fimfic2epub`). This project uses [gulp](http://gulpjs.com/) and [webpack](https://webpack.js.org/).

`npm run build:standalone` builds a self-contained command line tool that doesn't depend on the `dist/` library (used for packaging).


Development
-----------
* `npm run watch` rebuilds the code when you save (development mode, with source maps)
* `npm run lint` lints the code with [standard](https://standardjs.com/)
* `npm test` runs the unit tests
* `npm run test:e2e` generates EPUBs from a mocked Fimfiction with the built library (run `npm run build` first)
* `npm run test:browser` drives the built extension in a real Chromium against a local mock of Fimfiction (needs `npm install --no-save puppeteer`)
* `npx web-ext lint --source-dir <unpacked extension.xpi>` validates the Firefox package with Mozilla's linter

To test the extension in Chrome or Edge, open `chrome://extensions`, enable Developer mode, click Load unpacked and pick the `extension/` directory. To test the Firefox extension, go to `about:debugging`, choose This Firefox and Load Temporary Add-on, then pick `extension/manifest.json` (or the packaged `extension.xpi`). To reload them after a rebuild, click the Reload button in Chrome and/or Firefox.

The extension is a Manifest V3 extension: `src/main.js` is the content script that adds the dialog to story pages and `src/background.js` runs as a service worker (Chromium) or event page (Firefox) that downloads remote images on behalf of the content script. The source manifest works unpacked in both browsers; the packaging step strips the keys the other browser doesn't understand.

License
-------
[MIT](LICENSE)
