const Task = require("taskorama").default


// Task.of()
const syncTask = Task.of(42)


// Task.map()
const mappedTask = syncTask.map(x => x * 2)


// .fork(cbError, cbSuccess) or .run(cbSuccess)
syncTask.fork(console.error, console.log)
// or
syncTask.run(console.log)

// They both log 42 to the console


// Task.chain() or Task.flatMap()
const taskChain = Task.wait(2000, `go`)
  .chain(value => Task.wait(2000, `${value} - foo`))
  .chain(value => Task.wait(2000, `${value} - bar`))
  .flatMap(value => Task.wait(2000, `${value} - baz`))

const startTime = Date.now()

const execChain = taskChain.fork(
  console.error,
  (x) => console.log(`Chain : Task '${x}' has finished after ${Date.now() - startTime}ms`)
)


// Task.all() and Task.race()
const taskArray = [
  Task.wait(2000,`one`),
  Task.wait(3000,`two`),
  Task.wait(1000,`three`),
  Task.wait(4000,`four`),
]

const tasksAll = Task.all(taskArray)
const execAll = tasksAll.run(
  (x) => console.log(`All : Task '${x}' has finished after ${Date.now() - startTime}ms`)
)

const tasksRace = Task.race(taskArray)
const execRace = tasksRace.run(
  (x) => console.log(`Race : Task '${x}' has finished first after ${Date.now() - startTime}ms`)
)


// Task.fromPromise()
const p = Promise.resolve(2)
const taskFromPromise = Task.fromPromise(p)
const execTaskFromPromise = taskFromPromise.run(
  (x) => console.log(`fromPromise : Task from promise -> ${x}`)
)


// Cancelling a task
const timeoutTask = Task.wait(10000, "I'm done !")
const canceller = Task.wait(3000, "I cancelled it !")

const execTimeout = timeoutTask.fork(console.error, console.log)
const execCanceller = canceller.fork(
  console.error,
  function (result) {
    execTimeout.cancel()
    console.log(result)
  }
)

// Outputs "I cancelled it !" after 3 sec
