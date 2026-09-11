const { Command } = require('commander')
const pkg = require('../package.json')

const program = new Command()
program
  .name('fimfic2epub')
  .description(pkg.description)
  .version(pkg.version)
  .argument('<story>', 'story id or url')
  .argument('[filename]', 'output filename, - for stdout. %id% is replaced by the story id')
  .option('-d, --dir <path>', 'Directory to store ebook in. Is prepended to filename')
  .option('-t, --title <value>', 'Set the title of the story')
  .option('-a, --author <value>', 'Set the author of the story')
  .option('-T, --typogrify', 'Enable typographic fixes (smart quotes, dashes, ellipsis, ordinal)')
  .option('-c, --no-comments-link', 'Don\'t add link to online comments')
  .option('-H, --no-headings', 'Don\'t add headings to chapters (includes chapter title, duration and word count)')
  .option('-W, --no-chapter-word-count', 'Don\'t add word count to chapter headings')
  .option('-D, --no-chapter-duration', 'Don\'t add time to read to chapter headings')
  .option('-b, --no-bars', 'Don\'t add chapter bars to show reading progress')
  .option('-r, --no-reading-ease', 'Don\'t calculate Flesch reading ease')
  .option('-e, --no-external', 'Don\'t embed external resources, such as images (breaks EPUB spec)')
  .option('-m, --no-dedupe-images', 'Keep a separate copy of every embedded image, even when several links return the same file')
  .option('-n, --no-notes', 'Don\'t include author notes')
  .option('-i, --notes-index', 'Create an index with all author notes at the end of the ebook')
  .option('-p, --paragraphs <style>', 'Select a paragraph style <spaced|indented|indentedall|both>', 'spaced')
  .option('-k, --kepubify', 'Add extra <span> elements for Kobo EPUB (KEPUB) format')
  .option('-j, --join-subjects', 'Join dc:subjects to a single value')
  .option('-w, --wpm <number>', 'Words per minute. Set to 0 to disable reading time estimations', (value) => parseInt(value, 10), 200)
  .option('-C, --cover <url>', 'Set cover image url')
  .option('--token <token>', 'Fimfiction API token, or set FIMFICTION_TOKEN. Recommended: Fimfiction\'s bot protection blocks story downloads for non-browser clients')
  .option('--client-id <id>', 'Fimfiction API application client id (or FIMFICTION_CLIENT_ID), used with --client-secret to request a token')
  .option('--client-secret <secret>', 'Fimfiction API application client secret (or FIMFICTION_CLIENT_SECRET)')
  .option('--cookie <cookie>', 'Cookie header copied from a logged-in browser session, an alternative to an API token')
  .option('--user-agent <string>', 'User agent to send, should match the browser the cookies were copied from')
  .parse(process.argv)

const options = program.opts()
const STORY_ID = program.args[0]
const outputArg = program.args[1]

const outputStdout = outputArg === '-' || outputArg === '/dev/stdout'

if (outputStdout) {
  console.log = console.error
  console.log('Outputting to stdout')
}

const htmlToText = require('./utils').htmlToText
const FimFic2Epub = require('./FimFic2Epub').default
const fs = require('fs')
const path = require('path')

async function main () {
  let token = options.token || process.env.FIMFICTION_TOKEN || null
  const clientId = options.clientId || process.env.FIMFICTION_CLIENT_ID
  const clientSecret = options.clientSecret || process.env.FIMFICTION_CLIENT_SECRET
  if (!token && clientId && clientSecret) {
    console.log('Requesting a Fimfiction API token...')
    token = await FimFic2Epub.requestApiToken(clientId, clientSecret)
  }
  if (options.cookie !== undefined || options.userAgent !== undefined) {
    FimFic2Epub.configureFetch({ cookie: options.cookie, userAgent: options.userAgent })
  }

  const ffc = new FimFic2Epub(STORY_ID, {
    typogrify: !!options.typogrify,
    addCommentsLink: !!options.commentsLink,
    includeAuthorNotes: !!options.notes,
    useAuthorNotesIndex: !!options.notesIndex,
    showChapterHeadings: !!options.headings,
    showChapterWordCount: !!options.chapterWordCount,
    showChapterDuration: !!options.chapterDuration,
    includeExternal: !!options.external,
    dedupeImages: !!options.dedupeImages,
    paragraphStyle: options.paragraphs,
    kepubify: !!options.kepubify,
    joinSubjects: !!options.joinSubjects,
    calculateReadingEase: !!options.readingEase,
    readingEaseWakeupInterval: 800,
    wordsPerMinute: isNaN(options.wpm) ? 200 : options.wpm,
    addChapterBars: !!options.bars,
    apiToken: token
  })
  ffc.coverUrl = options.cover

  await ffc.fetchMetadata()
  if (options.title) {
    ffc.setTitle(options.title)
  }
  if (options.author) {
    ffc.setAuthorName(options.author)
  }
  ffc.storyInfo.short_description = htmlToText(ffc.storyInfo.description) || ffc.storyInfo.short_description

  await ffc.fetchAll()
  await ffc.build()

  let filename = ffc.filename
  if (ffc.options.kepubify) {
    filename = filename.replace(/\.epub$/, '.kepub.epub')
  }
  filename = (outputArg || '').replace('%id%', ffc.storyInfo.id) || filename

  if (options.dir) {
    filename = path.join(options.dir, filename)
  }

  const stream = outputStdout ? process.stdout : fs.createWriteStream(filename)

  await new Promise((resolve, reject) => {
    const source = ffc.streamFile(null).on('error', reject)
    if (outputStdout) {
      // stdout is never closed by pipe(), wait for the archive to be fully written instead
      source.on('end', resolve)
    } else {
      stream.on('error', reject).on('finish', resolve)
    }
    source.pipe(stream)
  })
  if (!outputStdout) {
    console.log('Saved story as ' + filename)
  }
}

main().catch((err) => {
  if (err && (err.name === 'CloudflareChallengeError' || err.name === 'FimfictionApiError')) {
    console.error('Error: ' + err.message)
  } else if (err && err.stack) {
    console.error(err.stack)
  } else {
    console.error('Error: ' + (err || 'Unknown error'))
  }
  process.exit(1)
})
