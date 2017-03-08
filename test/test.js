import Task from '../src/index.js'

describe('#Task', function () {
  it('should export Task constructor', function () {
    expect(Task).toBeDefined()
  })
})

describe('#Task static methods', function () {
  it('Task.all', function (done) {
    var tasks = [Task.wait(1000, 1), Task.wait(1500, 2), Task.wait(500, 3)]

    var all = Task.all(tasks)

    all.run(resultArray => {
      expect(resultArray).toEqual([1, 2, 3])
      done()
    })
  })
})

describe('#Task static methods', function () {
  it('Task.sequence', function (done) {
    var tasks = [Task.wait(1000, 1), Task.wait(1500, 2), Task.wait(500, 3)]

    var sequence = Task.sequence(tasks)

    sequence.run(resultArray => {
      expect(resultArray).toEqual([1, 2, 3])
      done()
    })
  })
})

describe('#Task static methods', function () {
  it('Task.parallel', function (done) {
    var tasks = [Task.wait(1000, 1), Task.wait(1500, 2), Task.wait(500, 3)]

    var parallel = Task.parallel(tasks)

    parallel.run(resultArray => {
      expect(resultArray).toEqual([3, 1, 2])
      done()
    })
  })
})

describe('#Task static methods', function () {
  it('Task.do', function (done) {
    const program = Task.do(function*() {
      let one = yield Task.wait(1000, 1)
      let two = yield Task.wait(1500, 2)
      let three = yield Task.wait(500, 3)

      return [one, two, three]
    })

    expect(program._isTask).toEqual(true)

    program.run(resultArray => {
      expect(resultArray).toEqual([1, 2, 3])
      done()
    })
  })
})
