const { resolve, join } = require('path')
const webpack = require('webpack')
const CompressionPlugin = require('compression-webpack-plugin')

module.exports = (env = {}) => {
  console.log('env : ', env)
  const libraryName = 'taskorama'
  const addPlugin = (add, plugin) => (add ? plugin : undefined)
  const ifProd = plugin => addPlugin(env.prod, plugin)
  const ifDev = plugin => addPlugin(env.dev, plugin)
  const removeEmpty = array => array.filter(i => !!i)

  const config = {
    devtool: env.prod ? 'source-map' : 'eval',
    entry: {
      main: removeEmpty(['./src/index.js']),
      browser: removeEmpty(['./src/browser.js'])
    },
    context: resolve(__dirname, ''),
    output: {
      path: env.prod ? join(__dirname, '') : join(__dirname, 'dist'),
      filename: '[name].js',
      publicPath: '',
      library: libraryName,
      libraryTarget: 'umd',
      umdNamedDefine: true
    },
    module: {
      loaders: [
        { test: /\.js$/, loaders: ['babel-loader'], exclude: /node_modules/ },
        { test: /\.json$/, loaders: ['json-loader'], exclude: /node_modules/ }
      ]
    },
    plugins: removeEmpty([
      ifProd(
        new webpack.LoaderOptionsPlugin({
          minimize: true,
          debug: false
        })
      ),
      ifProd(
        new webpack.optimize.UglifyJsPlugin({
          mangle: false,
          comments: false,
          compress: {
            screw_ie8: true,
            warnings: false,
            drop_console: true
          }
        })
      ),
      new CompressionPlugin()
    ]),
    resolve: {
      extensions: ['.js', '.json']
    }
  }

  if (env.devServer) config.entry['dev'] = removeEmpty(['./serve/dev.js'])
  return config
}
