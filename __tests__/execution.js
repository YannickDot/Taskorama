import Task from '../src/index.js'

describe('Execution', function() {
  it('#fork should return an Execution', function() {
    var value = 42

    function computation(resolve, reject) {
      setTimeout(_ => resolve(value), 100)
    }

    var task = Task(computation)

    var execution = task.fork(err => {}, res => {})

    expect(execution).toBeDefined()
    expect(execution.cancel).toBeDefined()
    expect(execution.inspect).toBeDefined()

    var executionState = execution.inspect()

    expect(executionState).toEqual({ status: 'pending', value: undefined })
  })
})

describe('Execution', function() {
  it('should handle resolved/rejected/cancelled states', function() {
    var value = 42
    var resolvingTask = Task.of(value)
    var execution1 = resolvingTask.fork(err => {}, res => {})
    var executionState1 = execution1.inspect()

    expect(executionState1).toEqual({ status: 'resolved', value: value })

    var rejectingTask = Task.reject(value)
    var execution2 = rejectingTask.fork(err => {}, res => {})
    var executionState2 = execution2.inspect()

    expect(executionState2).toEqual({ status: 'rejected', reason: value })

    var taskToCancel = Task.wait(100, value)
    var execution3 = taskToCancel.fork(err => {}, res => {})
    execution3.cancel()
    var executionState3 = execution3.inspect()

    expect(executionState3).toEqual({ status: 'cancelled' })
  })
})
