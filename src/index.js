/**
* @Author: Yannick Spark <yannickdot>
* @Date:   2017-02-09T11:28:40+01:00
* @Last modified by:   Yannick Spark
* @Last modified time: 2017-02-15T12:02:02+01:00
*/

// @flow

export type terminationCallback = (value: any) => any | void | null
export type ongoingCallback = (value: any) => any | void | null

export type effectCallback = (value: any) => ?void

export type TaskExecution = {
  _isExecution: boolean,
  cancel: effectCallback,
  inspect: (value: any) => { status: string, value?: any, reason?: any }
}

export type TaskDescription = (
  resolve: terminationCallback,
  reject: terminationCallback,
  progress?: ongoingCallback
) => {
  cancel: effectCallback
}

function TaskInstance(computation: TaskDescription) {
  this.__computation = makeForkable(computation)
  this._isTask = true
}

TaskInstance.prototype.map = map
TaskInstance.prototype.bimap = bimap
TaskInstance.prototype.ap = ap
TaskInstance.prototype.chain = chain
TaskInstance.prototype.flatMap = chain
TaskInstance.prototype.then = then
TaskInstance.prototype.bind = then
TaskInstance.prototype.catch = catchError
TaskInstance.prototype.clone = clone
TaskInstance.prototype.repeat = repeat
TaskInstance.prototype.retry = retry
TaskInstance.prototype.cache = cache

TaskInstance.prototype.fork = function(rej, res, onprogress = noop) {
  return this.__computation(rej, res, onprogress)
}

TaskInstance.prototype.run = function(cb = console.log, onprogress = noop) {
  return this.fork(x => console.log('Rejected because :', x), cb, onprogress)
}

export default function Task(subscribe: TaskDescription): TaskInstance {
  return Object.freeze(new TaskInstance(subscribe))
}

Task.of = function(value: any): TaskInstance {
  if (value && value._isTask) return value
  return Task(function(resolve, reject) {
    resolve(value)
    return { cancel: noop }
  })
}

Task.resolve = Task.of

Task.reject = function(value: any): TaskInstance {
  return Task(function(resolve, reject) {
    reject(value)
    return { cancel: noop }
  })
}

Task.do = function doT(genFn) {
  if (!isGeneratorFunction(genFn)) {
    throw Error('Task.do expects a generator function.')
  }
  let gen = genFn()
  const nextVal = value => {
    var result = gen.next(value)
    if (result.done) return result.value
    if (result.value && result.value._isTask) {
      return result.value.then(nextVal)
    }
    return Task.of(result.value).then(nextVal)
  }
  return nextVal()
}

Task.all = function(taskArray: Array<TaskInstance>): TaskInstance {
  return Task(function(resolve, reject) {
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
    return { cancel }
  })
}

Task.race = function(taskArray: Array<TaskInstance>): TaskInstance {
  return Task(function(resolve, reject) {
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
    return { cancel }
  })
}

Task.sequence = function(taskArray: Array<TaskInstance>): TaskInstance {
  return Task(function(resolve, reject) {
    const results = []
    const [fst, ...rest] = taskArray.map((task, index) => {
      return task.catch(err => {
        console.error(
          `Caught error in task sequence - currentTask #${index}: `,
          err
        )
        return { err, index: index }
      })
    })
    const sequenceTask = rest
      .reduce((prevTask, nextTask, index) => {
        return prevTask.then(val => {
          results.push(val)
          return nextTask
        })
      }, fst)
      .then(val => {
        // Don't forget the last one :-)
        results.push(val)
        return results
      })
    return sequenceTask.fork(reject, resolve)
  })
}

Task.parallel = function(taskArray: Array<TaskInstance>): TaskInstance {
  return Task(function(resolve, reject) {
    let remainingTasks = taskArray.length
    let results = []
    const parallellizedTasks = taskArray.map((task, index) => {
      return task
        .catch(err => {
          console.error(
            `Caught error in parallel tasks set - currentTask #${index}: `,
            err
          )
          return { err, index: index }
        })
        .fork(reject, val => {
          results.push(val)
          remainingTasks--
          if (remainingTasks === 0) resolve(results)
        })
    })
    const cancel = () => parallellizedTasks.forEach(e => e.cancel())
    return { cancel }
  })
}

Task.fromPromise = function(promise: Promise<any>): TaskInstance {
  return Task(function(resolve, reject) {
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

Task.wait = function(time: number, value: any): TaskInstance {
  return Task(function(resolve, reject) {
    let timerId = setTimeout(_ => resolve(value), time)
    return { cancel: () => clearTimeout(timerId) }
  })
}

function cache(): TaskInstance {
  let cachedExec
  const previousTask = this
  return Task(function(resolve, reject) {
    let previousExec
    if (!cachedExec) {
      previousExec = cachedExec = previousTask.fork(reject, resolve)
      return previousExec
    } else {
      let ins = cachedExec.inspect()
      if (ins.status === 'resolved') resolve(ins.value)
      if (ins.status === 'rejected') reject(ins.reason)
      return { cancel: cachedExec.cancel }
    }
  })
}

function chain(cb): TaskInstance {
  const previousTask = this
  return Task(function(resolve, reject, onprogress) {
    let nextCancelCb
    let previousCancel = previousTask.fork(
      reject,
      try_catch(val => {
        let nextVal = cb(val)
        let nextTask
        if (!nextVal) {
          nextTask = Task.of(undefined)
        } else {
          nextTask = nextVal
        }
        let nextRunningTask = nextTask.fork(reject, v => {
          resolve(v)
        })
        nextCancelCb = nextRunningTask.cancel
        return { cancel: nextRunningTask.cancel }
      }, reject),
      onprogress
    )
    let cancel = () => {
      if (nextCancelCb) nextCancelCb()
      previousCancel.cancel()
    }
    return { cancel }
  })
}

function map(cb): TaskInstance {
  const previousTask = this
  return Task(function(resolve, reject, onprogress) {
    return previousTask.fork(
      reject,
      try_catch(
        val => {
          let nextValue = cb(val)
          resolve(nextValue)
        },
        err => {
          reject(err)
        }
      ),
      onprogress
    )
  })
}

function bimap(cbRej, cbRes): TaskInstance {
  const previousTask = this
  return Task(function(resolve, reject, onprogress) {
    return previousTask.fork(
      try_catch(err => {
        let nextValue = cbRej(err)
        reject(nextValue)
      }, reject),
      try_catch(val => {
        let nextValue = cbRes(val)
        resolve(nextValue)
      }, reject),
      onprogress
    )
  })
}

function ap(taskToApply): TaskInstance {
  const previousTask = this
  return Task(function(resolve, reject) {
    return previousTask.fork(
      reject,
      try_catch(fn => {
        taskToApply.fork(
          reject,
          try_catch(val => {
            let nextValue = fn(val)
            resolve(nextValue)
          }, reject)
        )
      }, reject),
      reject
    )
  })
}

function then(cb): TaskInstance {
  const previousTask = this
  return Task(function(resolve, reject, onprogress) {
    let nextCancelCb
    let previousCancel = previousTask.fork(
      reject,
      try_catch(val => {
        let nextResult = cb(val)
        let nextTask
        if (!nextResult) {
          nextTask = Task.of(undefined)
        } else if (nextResult && nextResult._isTask) {
          nextTask = nextResult
        } else {
          nextTask = Task.of(nextResult)
        }
        let nextCancel = nextTask.fork(reject, v => {
          resolve(v)
        })
        nextCancelCb = nextCancel.cancel
        return { cancel: nextCancel.cancel }
      }, reject),
      onprogress
    )
    let cancel = () => {
      if (nextCancelCb) nextCancelCb()
      previousCancel.cancel()
    }
    return { cancel }
  })
}

function catchError(cb): TaskInstance {
  const previousTask = this
  return Task(function(resolve, reject, onprogress) {
    let nextCancelCb
    let previousCancel = previousTask.fork(
      try_catch(err => {
        let nextResult = cb(err)
        let nextTask = Task.of(undefined)
        if (!nextResult) {
          nextTask = Task.of(undefined)
        } else if (nextResult && nextResult._isTask) {
          nextTask = nextResult
        } else {
          nextTask = Task.of(nextResult)
        }
        let nextCancel = nextTask.fork(reject, resolve)
        nextCancelCb = nextCancel.cancel
        return { cancel: nextCancel.cancel }
      }, reject),
      resolve,
      onprogress
    )

    let cancel = () => {
      if (nextCancelCb) nextCancelCb()
      previousCancel.cancel()
    }
    return { cancel }
  })
}

function clone(): TaskInstance {
  const previousTask = this
  return Task(function(resolve, reject) {
    return previousTask.fork(reject, resolve)
  })
}

function repeat(times: number = 2): TaskInstance {
  const previousTask = this
  const taskArray = Array.from(Array(times).keys()).map(_ =>
    previousTask.clone()
  )
  return Task.sequence(taskArray)
}

function retry(times: number = 2) {
  const previousTask = this
  return Task(function(resolve, reject) {
    let fallbackTask = previousTask
    let retryiedTask = previousTask
    for (let i = 0; i < times; i++) {
      retryiedTask = retryiedTask.catch(err => {
        console.log(err)
        return retryiedTask.clone()
      })
    }
    return previousTask.fork(reject, resolve)
  })
}

function makeForkable(subscription) {
  return function forkable(rej, res, onprogress) {
    let __value, __error, __isCancelled = false

    const inspector = () => {
      if (__isCancelled) return { status: 'cancelled', value: undefined }

      if (__value === undefined && __error === undefined) {
        return { status: 'pending', value: undefined }
      }

      if (__error !== undefined) return { status: 'rejected', reason: __error }

      return { status: 'resolved', value: __value }
    }

    let execution = {
      cancel: () => {
        __isCancelled = true
        noCancelHandler()
      },
      inspect: inspector,
      _isExecution: true
    }

    const wrappedResolve = (val, type) => {
      __value = val
      res(val)
    }

    const wrappedReject = (err, type) => {
      __error = err
      rej(err)
    }

    const runningTask = subscription(wrappedResolve, wrappedReject, onprogress) // flipping arguments

    if (runningTask && runningTask.cancel) {
      execution.cancel = () => {
        __isCancelled = true
        runningTask.cancel()
      }
    }

    return Object.freeze(execution)
  }
}

function noop() {}

function noCancelHandler() {
  console.log(
    'Error: Cannot cancel Task chain. One or more tasks in the chain has no cancellation handler.'
  )
}

function try_catch(fn, onError) {
  return function(...args) {
    try {
      return fn(...args)
    } catch (err) {
      onError(err)
    }
  }
}

function isGeneratorFunction(obj) {
  var constructor = obj.constructor
  if (!constructor) return false
  if (
    constructor.name === 'GeneratorFunction' ||
    constructor.displayName === 'GeneratorFunction'
  ) {
    return true
  }
  return isGenerator(constructor.prototype)
}

function isGenerator(obj) {
  return typeof obj.next === 'function' && typeof obj.throw === 'function'
}
