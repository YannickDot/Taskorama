/**
* @Author: Yannick Spark <yannickdot>
* @Date:   2017-02-09T11:28:40+01:00
* @Last modified by:   Yannick Spark
* @Last modified time: 2017-02-15T12:02:02+01:00
*/

// @flow

export type callback = (value: any) => any | void | null;

export type effectCallback = (value: any) => ?void;

export type Subscription = (resolve: callback, reject: callback) => RunningTask;

export type TaskInstance = {
  _isTask: boolean,
  fork: (reject: effectCallback, resolve: effectCallback) => RunningTask,
  run: (resolve: effectCallback) => RunningTask,
  map: (cb: callback) => TaskInstance,
  flatMap: (cb: callback) => TaskInstance,
  chain: (cb: callback) => TaskInstance,
  then: (cb: callback) => TaskInstance,
  catch: (cb: callback) => TaskInstance
};

export type RunningTask = {
  cancel: effectCallback
};

export default function Task (subscribe: Subscription): TaskInstance {
  return Object.freeze({
    _isTask: true,
    map: map,
    ap: ap,
    chain: chain,
    flatMap: chain,
    then: then,
    catch: catchError,
    fork: makeForkable(subscribe),
    run: function (cb) {
      return this.fork(console.error, cb)
    }
  })
}

Task.of = function (value: any): TaskInstance {
  if (value && value._isTask) return value
  return Task(function (resolve, reject) {
    resolve(value)
    return {cancel: noop}
  })
}

Task.reject = function (value: any): TaskInstance {
  return Task(function (resolve, reject) {
    reject(value)
    return {cancel: noop}
  })
}

Task.resolve = Task.of

Task.all = function (taskArray: Array<TaskInstance>): TaskInstance {
  return Task(function (resolve, reject) {
    const numberOfTasks = taskArray.length
    let results = {}
    let keys = []
    const notify = index => value => {
      results[`t-${index}`] = value
      const tasksFinishedCount = keys.filter(k => !!results[k]).length
      if (tasksFinishedCount === numberOfTasks) {
        // All tasks are done so resolve the array of results
        let resultsArr = keys.map(k => results[k])
        resolve(resultsArr)
      }
    }
    const notifyError = index => error => {
      cancel(index)
      reject(error)
    }
    let executions = taskArray.map((task, index) => {
      results[`t-${index}`] = undefined
      keys = Object.keys(results)
      return task.fork(notifyError(index), notify(index))
    })
    const cancel = (exceptId = null) => {
      if (exceptId === null) {
        executions.forEach(e => e.cancel())
      } else {
        executions.filter((e, i) => i !== exceptId).forEach(e => e.cancel())
      }
    }
    return {cancel}
  })
}

Task.race = function (taskArray: Array<TaskInstance>): TaskInstance {
  return Task(function (resolve, reject) {
    const notify = index => value => {
      cancel(index)
      resolve(value)
    }
    const notifyError = index => error => {
      cancel(index)
      reject(error)
    }
    let executions = taskArray.map((task, index) => {
      return task.fork(notifyError(index), notify(index))
    })
    const cancel = (exceptId = null) => {
      if (exceptId === null) {
        executions.forEach(e => e.cancel())
      } else {
        executions
          .filter((e, index) => index !== exceptId)
          .forEach(e => e.cancel())
      }
    }
    return {cancel}
  })
}


Task.sequence = function (taskArray: Array<TaskInstance>): TaskInstance {
  let currentTask = 1

  return Task(function(resolve, reject) {
    const results = []
    const [fst, ...rest] = taskArray
    const sequenceTask = rest.reduce((prevTask, nextTask) => {
      return prevTask.then(val => {
        currentTask++
        results.push(val)
        return nextTask
      })
    }, fst)
    .then(val => { // Don't forget the last one :-)
      currentTask++
      results.push(val)
      return results
    })
    return sequenceTask.fork(reject, resolve)
  })
  .catch(err => {
    console.error(`Caught error in task sequence - currentTask #${currentTask}: `, err)
    return {
      msg: `Caught error in task sequence - currentTask #${currentTask}`,
      error: err
    }
  })

}


Task.parallel = function (taskArray: Array<TaskInstance>): TaskInstance {
  let remainingTasks = taskArray.length

  return Task(function(resolve, reject) {
    const results = []
    const [fst, ...rest] = taskArray
    const parallellizedTasks = taskArray.map(task => {
      return task.fork(
        reject,
        val => {
          results.push(val)
          remainingTasks--
          if(remainingTasks === 0) resolve(results)
        }
      )
    })
    const cancel = () => parallellizedTasks.forEach(e => e.cancel())
    return {cancel}
  })
  .catch(err => {
    console.error(`Caught error in parallel tasks set: `, err)
    return {
      msg: `Caught error in parallel tasks set`,
      error: err
    }
  })
}

Task.fromPromise = function (promise: Promise<any>): TaskInstance {
  return Task(function (resolve, reject) {
    promise.then(resolve, reject)
    return {
      cancel: () => {
        throw Error(
          'There is a promise is the task chain. A promise is not cancellable.'
        )
      }
    }
  })
}

Task.wait = function (time: number, value: any): TaskInstance {
  return Task(function (resolve, reject) {
    let timerId = setTimeout(_ => resolve(value), time)
    return {cancel: () => clearTimeout(timerId)}
  })
}

function chain (cb): TaskInstance {
  const previousTask = this
  return Task(function (resolve, reject) {
    let nextCancelCb
    let previousCancel = previousTask.fork(reject, function (val) {
      try {
        let nextVal = cb(val)
        let nextTask
        if (!nextVal) {
          nextTask = Task.of(undefined)
        } else {
          nextTask = nextVal
        }
        let nextRunningTask = nextTask.fork(reject, resolve)
        nextCancelCb = nextRunningTask.cancel
        return {cancel: nextRunningTask.cancel}
      } catch (e) {
        reject(e)
      }
    })
    let cancel = () => {
      if (nextCancelCb) nextCancelCb()
      previousCancel.cancel()
    }
    return {cancel}
  })
}

function map (cb): TaskInstance {
  const previousTask = this
  return Task(function (resolve, reject) {
    return previousTask.fork(reject, function (val) {
      try {
        let nextValue = cb(val)
        resolve(nextValue)
      } catch (e) {
        reject(e)
      }
    })
  })
}

function ap (taskFn): TaskInstance {
  const previousTask = this
  return Task(function (resolve, reject) {
    return previousTask.fork(reject, function (val) {
      try {
        taskFn.fork(reject, function (fn) {
          try {
            let nextValue = fn(val)
            resolve(nextValue)
          } catch (e) {
            reject(e)
          }
        })
      } catch (e) {
        reject(e)
      }
    })
  })
}

function then (cb): TaskInstance {
  const previousTask = this
  return Task(function (resolve, reject) {
    let nextCancelCb
    let previousCancel = previousTask.fork(reject, function (val) {
      try {
        let nextResult = cb(val)
        let nextTask
        if (!nextResult) {
          nextTask = Task.of(undefined)
        } else if (nextResult && nextResult._isTask) {
          nextTask = nextResult
        } else {
          nextTask = Task.of(nextResult)
        }
        let nextCancel = nextTask.fork(reject, resolve)
        nextCancelCb = nextCancel.cancel
        return {cancel: nextCancel.cancel}
      } catch (e) {
        reject(e)
      }
    })
    let cancel = () => {
      if (nextCancelCb) nextCancelCb()
      previousCancel.cancel()
    }
    return {cancel}
  })
}

function catchError (cb): TaskInstance {
  const previousTask = this
  return Task(function (resolve, reject) {
    return previousTask.fork(
      function (err) {
        try {
          let val = cb(err)
          resolve(val)
        } catch (e) {
          reject(e)
        }
      },
      resolve
    )
  })
}

function makeForkable (subscription) {
  return function forkable (rej, res) {
    var result = subscription(res, rej) // flipping arguments
    if (!result || !result.cancel) return {cancel: noCancelHandler}
    return result
  }
}

function noop () {}

function noCancelHandler () {
  console.log(
    'Error: Cannot cancel Task chain. One or more tasks in the chain has no cancellation handler.'
  )
}
