import Task from '../src/index.js'

describe('Execution', function () {
  it('#fork should return an Execution', function () {
    var value = 42

    function computation (resolve, reject) {
      setTimeout(_ => resolve(value), 100)
    }

    var task = Task(computation)

    var execution = task.fork(err => {}, res => {})

    expect(execution).toBeDefined()
    expect(execution.cancel).toBeDefined()
    expect(execution.inspect).toBeDefined()

    var executionState = execution.inspect()

    expect(executionState).toEqual({ status: 'PENDING', value: undefined })
  })
})

describe('Execution', function () {
  it('should handle resolved/rejected states', function () {
    var value = 42
    var resolvingTask = Task.of(value)
    var execution = resolvingTask.fork(err => {}, res => {})
    var executionState1 = execution.inspect()

    expect(executionState1).toEqual({ status: 'RESOLVED', value: value })

    var rejectingTask = Task.reject(value)
    var execution = rejectingTask.fork(err => {}, res => {})
    var executionState2 = execution.inspect()

    expect(executionState2).toEqual({ status: 'REJECTED', value: value })
  })
})
