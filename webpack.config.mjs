import path from 'node:path'
import { createRequire } from 'node:module'
import webpack from 'webpack'
import nodeExternals from 'webpack-node-externals'

const require = createRequire(import.meta.url)
const rootDir = import.meta.dirname

const inProduction = process.env.NODE_ENV === 'production' || process.argv.includes('-p')
const mode = inProduction ? 'production' : 'development'

// Manifest V3 needs Chrome 88+; the Firefox package declares strict_min_version 128
const browserTargets = { chrome: '88', firefox: '109' }
const nodeTargets = { node: '22' }

function babelRule (targets) {
  return {
    test: /\.js$/,
    exclude: /node_modules/,
    use: {
      loader: 'babel-loader',
      options: {
        babelrc: false,
        configFile: false,
        sourceMaps: !inProduction,
        presets: [['@babel/preset-env', { targets }]]
      }
    }
  }
}

const stylusRule = {
  test: /\.styl$/,
  use: ['stylus-loader'],
  type: 'asset/source'
}

const fontRule = {
  test: /\.ttf$/,
  use: 'binary-loader'
}

const srcResolve = {
  extensions: ['.js', '.json', '.styl'],
  modules: [path.resolve(rootDir, 'src'), 'node_modules']
}

// Content script of the web extension
const contentScriptConfig = {
  name: 'extension',
  entry: {
    fimfic2epub: './src/main.js'
  },
  output: {
    path: path.join(rootDir, 'extension/build'),
    filename: '[name].js'
  },
  module: {
    rules: [babelRule(browserTargets), stylusRule, fontRule]
  },
  target: 'web',
  resolve: {
    ...srcResolve,
    alias: {
      // only used in Node.js for generated cover images
      '@napi-rs/canvas': false
    },
    fallback: {
      url: false,
      fs: false,
      path: false,
      zlib: require.resolve('browserify-zlib'),
      buffer: require.resolve('buffer/'),
      assert: require.resolve('assert/'),
      stream: require.resolve('stream-browserify'),
      events: require.resolve('events/')
    }
  },
  plugins: [
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser'
    }),
    // fonteditor-core's woff2 support (emscripten/wasm, unused here) would add
    // eval-like code that extension stores flag
    new webpack.NormalModuleReplacementPlugin(/woff2[\\/]index$/, (resource) => {
      resource.request = path.resolve(rootDir, 'src/empty.js')
    })
  ],
  performance: { hints: false },
  optimization: {
    concatenateModules: inProduction,
    minimize: inProduction
  },
  // eval based source maps are not allowed by the extension CSP
  devtool: 'source-map',
  mode
}

// Background service worker (Chromium) / event page (Firefox) of the web extension
const backgroundConfig = {
  name: 'background',
  entry: {
    background: './src/background.js'
  },
  output: {
    path: path.join(rootDir, 'extension/build'),
    filename: '[name].js'
  },
  module: {
    rules: [babelRule(browserTargets)]
  },
  target: 'webworker',
  resolve: { extensions: ['.js'] },
  plugins: [],
  performance: { hints: false },
  optimization: { minimize: inProduction },
  devtool: 'source-map',
  mode
}

// Library published to npm (dist/fimfic2epub.js)
const npmModuleConfig = {
  name: 'module',
  entry: './src/FimFic2Epub.js',
  output: {
    path: rootDir,
    filename: 'dist/fimfic2epub.js',
    library: { type: 'commonjs2' }
  },
  target: 'node22',
  module: {
    rules: [babelRule(nodeTargets), stylusRule, fontRule]
  },
  resolve: srcResolve,
  node: { __dirname: false },
  externals: [nodeExternals({ allowlist: [/fontawesome-webfont\.ttf/] })],
  plugins: [],
  performance: { hints: false },
  optimization: {
    concatenateModules: inProduction,
    minimize: inProduction
  },
  devtool: 'nosources-source-map',
  mode
}

// Command line tool (build/fimfic2epub), uses the library from dist/
const cliConfig = {
  name: 'cli',
  entry: './src/cli.js',
  output: {
    path: path.join(rootDir, 'build'),
    filename: 'fimfic2epub.js'
  },
  target: 'node22',
  module: {
    rules: [babelRule(nodeTargets), stylusRule]
  },
  resolve: srcResolve,
  node: { __dirname: false },
  externals: [nodeExternals(), {
    './FimFic2Epub': 'commonjs ../dist/fimfic2epub',
    '../package.json': 'commonjs ../package.json'
  }],
  plugins: [],
  performance: { hints: false },
  optimization: {
    concatenateModules: inProduction,
    minimize: inProduction
  },
  devtool: false,
  mode
}

// Self-contained command line tool (gulp --standalone), everything bundled
// except the optional native canvas package used for generated covers
const standaloneConfig = {
  name: 'standalone',
  entry: './src/cli.js',
  output: {
    path: path.join(rootDir, 'build'),
    filename: 'fimfic2epub.js'
  },
  target: 'node22',
  module: {
    rules: [
      babelRule(nodeTargets),
      stylusRule,
      fontRule,
      {
        test: /\.node$/,
        loader: 'node-loader',
        options: { name: '[name].[ext]' }
      }
    ]
  },
  resolve: { ...srcResolve, extensions: ['.js', '.json', '.styl', '.node'] },
  node: { __dirname: false },
  externals: [{ '@napi-rs/canvas': 'commonjs @napi-rs/canvas' }],
  plugins: [],
  performance: { hints: false },
  optimization: {
    concatenateModules: inProduction,
    minimize: inProduction
  },
  devtool: false,
  mode
}

export default [
  contentScriptConfig,
  backgroundConfig,
  npmModuleConfig,
  cliConfig,
  standaloneConfig
]
