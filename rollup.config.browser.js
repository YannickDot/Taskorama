import resolve from 'rollup-plugin-node-resolve'
import babel from 'rollup-plugin-babel'
import butternut from 'rollup-plugin-butternut'

export default {
  entry: 'src/browser.js',
  format: 'umd',
  moduleName: 'taskorama',
  exports: 'named',
  plugins: [
    resolve(),
    babel({
      exclude: 'node_modules/**' // only transpile our source code
    }),
    butternut()
  ],
  dest: 'browser.js'
}
