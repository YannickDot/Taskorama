const {resolve, join} = require('path')
const webpack = require('webpack')

module.exports = env => {
  const libraryName = 'taskorama'
  const addPlugin = (add, plugin) => add ? plugin : undefined
  const ifProd = plugin => addPlugin(env.prod, plugin)
  const ifDev = plugin => addPlugin(env.dev, plugin)
  const removeEmpty = array => array.filter(i => !!i)

  return {
    devtool: env.prod ? 'source-map' : 'eval',
    entry: {
      main: removeEmpty([
        './src/index.js',
      ]),
      browser: removeEmpty([
        './src/browser.js',
      ]),
      // server: removeEmpty([
      //   './src/server.js',
      // ])
    },
    context: resolve(__dirname, ''),
    output: {
      path: join(__dirname, 'dist'),
      filename: '[name].js',
      publicPath: '',
      library: libraryName,
      libraryTarget: 'umd',
      umdNamedDefine: true
    },
    module: {
      loaders: [
        { test: /\.js$/, loaders: ['babel-loader'], exclude: /node_modules/ },
        { test: /\.json$/, loaders: ["json-loader"], exclude: /node_modules/},
      ]
    },
    plugins: removeEmpty([
      ifProd(new webpack.LoaderOptionsPlugin({
         minimize : true,
         debug: false
      })),
      ifProd(new webpack.optimize.UglifyJsPlugin({
        mangle: true,
        compress: {
          screw_ie8: true,
          warnings: false
        }
      })),
    ]),
    resolve: {
      extensions: ['.js', '.json']
    }

  }
}
