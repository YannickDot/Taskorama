var fs = require('fs')
var Task = require('../main.js').default

// WITH TASK.ALL

const FileSystem = {
  readFile(path) {
    return Task((res, rej) => fs.readFile(path, 'utf8', (err, contents) => {
      if (err) rej(err)
      res(path)
    }))
  }
}

const program1 = Task.do(function*() {
  const [babelrc, packageJson] = yield Task.all([
    FileSystem.readFile('./.babelrc'),
    FileSystem.readFile('./package.json')
  ])

  return {packageJson, babelrc}
})

program1.fork(
  (err) => console.log('WITH TASK.ALL : error! --> ', err),
  (files) => console.log('WITH TASK.ALL : success! --> ', files)
)


// WITH APPLICATIVE FUNCTORS


const program2 = Task.do(function*() {
  const [babelrc, packageJson] = yield Task.of((x) => (y) => [x,y])
    .ap(FileSystem.readFile('./.babelrc'))
    .ap(FileSystem.readFile('./package.json'))

  return {packageJson, babelrc}
})

program2.fork(
  (err) => console.log('WITH APPLICATIVE FUNCTORS : error! --> ', err),
  (files) => console.log('WITH APPLICATIVE FUNCTORS : success! --> ', files)
)
