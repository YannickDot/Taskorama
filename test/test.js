import Task from '../src/index.js'

describe('#Task', function () {
  it('should pass everytime', function () {
    expect(Task).toBeDefined()
  })
})

describe('#Task static', function () {
  it('Task.sequence', function (done) {
    var tasks = [
      Task.wait(1000, 1),
      Task.wait(1500, 2),
      Task.wait(500, 3)
    ]

    var sequence = Task.sequence(tasks)

    sequence.run(resultArray => {
      expect(resultArray).toEqual([1, 2, 3])
      done()
    })
  })
})

describe('#Task static', function () {
  it('Task.parallel', function (done) {
    var tasks = [
      Task.wait(1000, 1),
      Task.wait(2000, 2),
      Task.wait(500, 3)
    ]

    var parallel = Task.parallel(tasks)

    parallel.run(resultArray => {
      expect(resultArray).toEqual([3, 1 ,2])
      done()
    })
  })
})
