import fs from 'node:fs'
import { createRequire } from 'node:module'

// gulp and utilities
import gulp from 'gulp'
import filter from 'gulp-filter'
import change from 'gulp-change'
import rename from 'gulp-rename'
import header from 'gulp-header'
import chmod from 'gulp-chmod'
import jsonedit from 'gulp-json-editor'
import zip from 'gulp-zip'
import PluginError from 'plugin-error'
import log from 'fancy-log'
import removeNPMAbsolutePaths from 'removeNPMAbsolutePaths'

// script
import webpack from 'webpack'
import webpackConfigs from './webpack.config.mjs'

const require = createRequire(import.meta.url)

const inProduction = process.env.NODE_ENV === 'production' || process.argv.includes('-p')
const isStandalone = process.argv.includes('--standalone')

const webpackConfig = isStandalone
  ? webpackConfigs.filter((c) => c.name === 'standalone')
  : webpackConfigs.filter((c) => c.name !== 'standalone')

function readPackageVersion () {
  return JSON.parse(fs.readFileSync('./package.json', 'utf8')).version
}

let packageVersion = readPackageVersion()

const webpackDefines = new webpack.DefinePlugin({
  FIMFIC2EPUB_VERSION: JSON.stringify(packageVersion)
})

webpackConfig.forEach((c) => {
  c.plugins.push(webpackDefines)
})

let wpCompiler = webpack(webpackConfig)

function webpackTask () {
  return new Promise((resolve, reject) => {
    if (webpackDefines.definitions.FIMFIC2EPUB_VERSION !== JSON.stringify(packageVersion)) {
      webpackDefines.definitions.FIMFIC2EPUB_VERSION = JSON.stringify(packageVersion)
      wpCompiler = webpack(webpackConfig)
    }

    let p = Promise.resolve()
    if (inProduction) {
      p = removeNPMAbsolutePaths('node_modules')
    }

    p.then(() => {
      // run webpack compiler
      wpCompiler.run((err, stats) => {
        if (err) {
          reject(new PluginError('webpack', err))
          return
        }
        log('[webpack]', stats.toString({
          colors: true,
          hash: false,
          version: false,
          chunks: false,
          timings: false,
          modules: false,
          chunkModules: false,
          cached: false
        }))
        if (stats.hasErrors()) {
          reject(new PluginError('webpack', 'Build failed with errors', { showStack: false }))
          return
        }
        wpCompiler.close(() => resolve())
      })
    }).catch(reject)
  })
}

function convertFontAwesomeVars (contents) {
  const vars = {}
  const matchVar = /\$fa-var-(.*?): "\\(.*?)";/g
  let ma
  for (;(ma = matchVar.exec(contents));) {
    vars[ma[1]] = String.fromCharCode(parseInt(ma[2], 16))
  }
  return JSON.stringify(vars)
}

// Manifest tweaks for the store packages. The source manifest works unpacked
// in both browsers (Chrome uses background.service_worker, Firefox uses
// background.scripts); the packages only keep what each browser understands.
function firefoxManifest (json) {
  json.version = packageVersion
  if (json.background) {
    delete json.background.service_worker
  }
  return json
}

function chromeManifest (json) {
  json.version = packageVersion
  if (json.background) {
    delete json.background.scripts
  }
  delete json.browser_specific_settings
  return json
}

// Cleanup task
gulp.task('clean', () => Promise.all([
  'build/',
  'extension/build/',
  'dist/',
  'extension.zip',
  'extension.xpi',
  'extension.crx'
].map((p) => fs.promises.rm(p, { recursive: true, force: true }))))

gulp.task('version', () => {
  packageVersion = readPackageVersion()
  return Promise.resolve()
})

gulp.task('fontawesome', () => {
  return gulp.src(require.resolve('font-awesome/scss/_variables.scss'))
    .pipe(change(convertFontAwesomeVars))
    .pipe(rename({
      basename: 'font-awesome-codes',
      extname: '.json',
      dirname: ''
    }))
    .pipe(gulp.dest('build/'))
})

gulp.task('binaries', gulp.series('version', function binariesTask () {
  return gulp.src(['build/fimfic2epub.js'])
    .pipe(rename({ extname: '' }))
    .pipe(header('#!/usr/bin/env node\n// fimfic2epub ' + packageVersion + '\n'))
    .pipe(chmod(0o777))
    .pipe(gulp.dest('build/'))
}))

gulp.task('pack:firefox', gulp.series('version', function packFirefox () {
  const manifest = filter('extension/manifest.json', { restore: true })

  return gulp.src('extension/**/*', { encoding: false })
    .pipe(manifest)
    .pipe(jsonedit(firefoxManifest))
    .pipe(manifest.restore)
    .pipe(zip('extension.xpi'))
    .pipe(gulp.dest('./'))
}))

gulp.task('pack:chrome', gulp.series('version', function packChrome () {
  const manifest = filter('extension/manifest.json', { restore: true })

  return gulp.src('extension/**/*', { encoding: false })
    .pipe(manifest)
    .pipe(jsonedit(chromeManifest))
    .pipe(manifest.restore)
    .pipe(zip('extension.zip'))
    .pipe(gulp.dest('./'))
}))

gulp.task('pack', gulp.parallel('binaries', 'pack:firefox', 'pack:chrome'))

// Main tasks
gulp.task('webpack', gulp.series(gulp.parallel('version', 'fontawesome'), webpackTask, isStandalone ? 'binaries' : 'pack'))

gulp.task('watch:webpack', () => {
  return gulp.watch(['src/**/*.js', 'src/**/*.styl', 'package.json'], gulp.series('webpack'))
})

gulp.task('watch:pack', () => {
  return gulp.watch(['extension/**/*', '!extension/build/**/*'], gulp.series('pack'))
})

// Default task
gulp.task('default', gulp.series('clean', 'webpack'))

// Watch task
gulp.task('watch', gulp.series('default', gulp.parallel('watch:webpack', 'watch:pack')))
