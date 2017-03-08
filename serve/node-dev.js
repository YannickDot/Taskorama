var fs = require('fs')
var Task = require('../main.js').default

const FileSystem = {
  readFile (path) {
    return Task((res, rej) => {
      fs.readFile(path, 'utf8', (err, contents) => {
        if (err) {
          rej(err)
        } else {
          res(path)
        }
      })
    })
  }
}

// WITH NORMAL TASKS



const main = Task.do(function*() {
  const gitignore = yield FileSystem.readFile('./.gitignore')
  const npmignore = yield FileSystem.readFile('./.npmignore')

  return {npmignore, gitignore}
})

// -> 'main' is a Task !

main.fork(
  err => console.log('error! --> ', err),
  files => console.log('success! --> ', files)
)

// -> logs : { npmignore : '...', gitignore: '...' }





// WITH TASK.ALL

const program1 = Task.do(function*() {
  const [gitignore, npmignore] = yield Task.all([
    FileSystem.readFile('./.gitignore'),
    FileSystem.readFile('./.npmignore')
  ])

  return {npmignore, gitignore}
})

program1.fork(
  err => console.log('WITH TASK.ALL : error! --> ', err),
  files => console.log('WITH TASK.ALL : success! --> ', files)
)

// WITH APPLICATIVE FUNCTORS

const program2 = Task.do(function*() {
  const [gitignore, npmignore] = yield Task.of(x => y => [x, y])
    .ap(FileSystem.readFile('./.gitignore'))
    .ap(FileSystem.readFile('./.npmignore'))

  return {gitignore, npmignore}
})

let e = program2.fork(
  err => console.log('WITH APPLICATIVE FUNCTOR : error! --> ', err),
  files => console.log('WITH APPLICATIVE FUNCTOR : success! --> ', files)
)
