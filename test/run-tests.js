// Runs the test files against the sources (transpiled on the fly with Babel).
// Usage: npm test

const babelRegister = require('@babel/register')
;(babelRegister.default || babelRegister)({
  presets: [['@babel/preset-env', { targets: { node: 'current' } }]],
  ignore: [/node_modules/]
})

global.FIMFIC2EPUB_VERSION = 'test'

const tests = [
  './test-imageSize',
  './test-kepubify',
  './test-cleanMarkup'
]

async function run () {
  let failures = 0
  for (const file of tests) {
    const suite = require(file)
    for (const name of Object.keys(suite)) {
      try {
        await suite[name]()
        console.log('  ok   ' + file.replace('./test-', '') + ': ' + name)
      } catch (err) {
        failures++
        console.error('  FAIL ' + file.replace('./test-', '') + ': ' + name)
        console.error(err && err.stack ? err.stack : err)
      }
    }
  }
  if (failures > 0) {
    console.error('\n' + failures + ' test(s) failed')
    process.exit(1)
  }
  console.log('\nAll tests passed')
}

run()
