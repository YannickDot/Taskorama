/**
* @Author: Yannick Spark <yannickdot>
* @Date:   2017-02-09T11:28:40+01:00
* @Last modified by:   Yannick Spark
* @Last modified time: 2017-02-15T12:02:02+01:00
*/

// @flow

export type callback = (value: any) => any | void | null;

export type effectCallback = (value: any) => ?void;

export type TaskDescription = (
  resolve: callback,
  reject: callback
) => TaskExecution;

export type TaskInstance = {
  _isTask: boolean,
  fork: (reject: effectCallback, resolve: effectCallback) => TaskExecution,
  run: (resolve: effectCallback) => TaskExecution,
  map: (cb: callback) => TaskInstance,
  flatMap: (cb: callback) => TaskInstance,
  chain: (cb: callback) => TaskInstance,
  then: (cb: callback) => TaskInstance,
  catch: (cb: callback) => TaskInstance
};

export type TaskExecution = {
  cancel: effectCallback
};

export default function Task (subscribe: TaskDescription): TaskInstance {
  return Object.freeze({
    _isTask: true,
    map: map,
    ap: ap,
    chain: chain,
    flatMap: chain,
    then: then,
    bind: then,
    catch: catchError,
    clone: clone,
    repeat: repeat,
    retry: retry,
    fork: makeForkable(subscribe),
    run: function (cb) {
      return this.fork(x => console.log('rejected:', x), cb)
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

Task.do = function doT (genFn) {
  let gen = genFn()
  const nextVal = (value) => {
    var result = gen.next(value)
    if (result.done) return result.value
    if (result.value && result.value._isTask) {
      return result.value.then(nextVal)
    }
    return Task.of(result.value).then(nextVal)
  }
  return nextVal()
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
    let remainingTasks = taskArray.length
    let results = {}
    let keys = []

    const notify = index => value => {
      results[`t-${index}`] = value
      remainingTasks--
      if (remainingTasks === 0) {
        let resultsArr = keys.map(k => results[k])
        resolve(resultsArr)
      }
    }

    const notifyError = index => error => {
      cancel(index)
      reject(error, index)
    }

    const allExecutions = taskArray.map((task, index) => {
      results[`t-${index}`] = undefined
      keys = Object.keys(results)
      return task.fork(notifyError(index), notify(index))
    })

    const cancel = (exceptId = null) => {
      if (exceptId === null) {
        allExecutions.forEach(e => e.cancel())
      } else {
        allExecutions.filter((e, i) => i !== exceptId).forEach(e => e.cancel())
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
      reject(error, index)
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
  return Task(function (resolve, reject) {
    const results = []
    const [fst, ...rest] = taskArray.map((task, index) => {
      return task.catch(err => {
        console.error(
          `Caught error in task sequence - currentTask #${index}: `,
          err
        )
        return {err, index: index}
      })
    })
    const sequenceTask = rest
      .reduce(
        (prevTask, nextTask, index) => {
          return prevTask.then(val => {
            results.push(val)
            return nextTask
          })
        },
        fst
      )
      .then(val => {
        // Don't forget the last one :-)
        results.push(val)
        return results
      })
    return sequenceTask.fork(reject, resolve)
  })
}

Task.parallel = function (taskArray: Array<TaskInstance>): TaskInstance {
  return Task(function (resolve, reject) {
    let remainingTasks = taskArray.length
    let results = []
    const parallellizedTasks = taskArray.map((task, index) => {
      return task
        .catch(err => {
          console.error(
            `Caught error in parallel tasks set - currentTask #${index}: `,
            err
          )
          return {err, index: index}
        })
        .fork(reject, val => {
          results.push(val)
          remainingTasks--
          if (remainingTasks === 0) resolve(results)
        })
    })
    const cancel = () => parallellizedTasks.forEach(e => e.cancel())
    return {cancel}
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

function ap (taskToApply): TaskInstance {
  const previousTask = this
  return Task(function (resolve, reject) {
    return previousTask.fork(reject, function (fn) {
      try {
        taskToApply.fork(reject, function (val) {
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
    let nextCancelCb
    let previousCancel = previousTask.fork(
      function (err) {
        try {
          let nextResult = cb(err)
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
      },
      resolve
    )

    let cancel = () => {
      if (nextCancelCb) nextCancelCb()
      previousCancel.cancel()
    }
    return {cancel}
  })
}

function clone (): TaskInstance {
  const previousTask = this
  return Task(function (resolve, reject) {
    return previousTask.fork(reject, resolve)
  })
}

function repeat (times: number = 2): TaskInstance {
  const previousTask = this
  const taskArray = Array.from(Array(times).keys())
    .map(_ => previousTask.clone())
  return Task.sequence(taskArray)
}

function retry (times: number = 2) {
  const previousTask = this
  return Task(function (resolve, reject) {
    let fallbackTask = previousTask
    let retryiedTask = previousTask
    for (let i = 0; i < times; i++) {
      retryiedTask = retryiedTask.catch(err => {
        console.log(err)
        return fallbackTask
      })
    }
    return previousTask.fork(reject, resolve)
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
