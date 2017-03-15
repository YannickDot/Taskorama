import Task from '../src/index.js'

describe('Task', function () {
  it('should export Task constructor', function (done) {
    expect(Task).toBeDefined()

    var value = 42

    function computation (resolve, reject) {
      setTimeout(_ => resolve(value), 100)
    }

    var task = Task(computation)
    expect(task._isTask).toEqual(true)

    var execution = task.run(result => {
      expect(result).toEqual(value)
      done()
    })

    expect(execution.cancel).toBeDefined()
  })
})

describe('Task static', function () {
  it('.of', function (done) {
    var value = 42
    var task = Task.of(value)
    expect(task._isTask).toEqual(true)

    task.run(result => {
      expect(result).toEqual(value)
      done()
    })
  })
})

describe('Task static', function () {
  it('.reject', function (done) {
    var value = 42
    var task = Task.reject(value)
    expect(task._isTask).toEqual(true)
    task.fork(
      rejectedVal => {
        expect(rejectedVal).toEqual(value)
        done()
      },
      res => {
      }
    )
  })
})

describe('Task static', function () {
  it('.wait', function (done) {
    var promise = new Promise((resolve, reject) => {
      setTimeout(_ => resolve(42), 300)
    })
    var taskFromPromise = Task.fromPromise(promise)

    taskFromPromise.run(result => {
      expect(result).toEqual(42)
      done()
    })
  })
})

describe('Task static', function () {
  it('.all', function (done) {
    var tasks = [ Task.wait(100, 1), Task.wait(150, 2), Task.wait(50, 3) ]

    var all = Task.all(tasks)

    all.run(resultArray => {
      expect(resultArray).toEqual([ 1, 2, 3 ])
      done()
    })
  })
})

describe('Task static', function () {
  it('.race', function (done) {
    var tasks = [ Task.wait(100, 1), Task.wait(150, 2), Task.wait(50, 3) ]

    var race = Task.race(tasks)

    race.run(result => {
      expect(result).toEqual(3)
      done()
    })
  })
})

describe('Task static', function () {
  it('.sequence', function (done) {
    var tasks = [ Task.wait(100, 1), Task.wait(150, 2), Task.wait(50, 3) ]

    var sequence = Task.sequence(tasks)

    sequence.run(resultArray => {
      expect(resultArray).toEqual([ 1, 2, 3 ])
      done()
    })
  })
})

describe('Task static', function () {
  it('.parallel', function (done) {
    var tasks = [ Task.wait(100, 1), Task.wait(150, 2), Task.wait(50, 3) ]

    var parallel = Task.parallel(tasks)

    parallel.run(resultArray => {
      expect(resultArray).toEqual([ 3, 1, 2 ])
      done()
    })
  })
})

describe('Task static', function () {
  it('.fromPromise', function (done) {
    var promise = new Promise((resolve, reject) => {
      setTimeout(_ => resolve(42), 50)
    })
    var taskFromPromise = Task.fromPromise(promise)

    taskFromPromise.run(result => {
      expect(result).toEqual(42)
      done()
    })
  })
})

describe('Task static', function () {
  it('.do', function (done) {
    const program = Task.do(function*() {
      let one = yield Task.wait(100, 1)
      let two = yield Task.wait(150, 2)
      let three = yield Task.wait(50, 3)

      return [ one, two, three ]
    })

    expect(program._isTask).toEqual(true)

    program.run(resultArray => {
      expect(resultArray).toEqual([ 1, 2, 3 ])
      done()
    })
  })
})
