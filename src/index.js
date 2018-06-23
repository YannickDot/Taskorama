// @flow

import { curry } from 'ramda'

/*::
export type terminationCallback = (value: any) => any | void | null

export type effectCallback = (value: any) => ?void

export type TaskExecution = {
  _isExecution: boolean,
  cancel: effectCallback,
  getStatus: (value: any) => { status: string, value?: any, reason?: any }
}

export type TaskDescription = (
  reject: terminationCallback,
  resolve: terminationCallback
) => {
  cancel: effectCallback
}
*/

const DEBUG = false

function ctd(type, fn) {
  return { type, fn }
}

var toNumHash = str =>
  str
    .split('')
    .map(x => x.charCodeAt())
    .reduce((acc, curr) => acc + curr, 0)

function TaskInstance(computation /*: TaskDescription*/, previousTasks) {
  this._taskID = new Date().valueOf()
  Math.floor(new Date().valueOf() * Math.random()) *
    toNumHash(computation.toString())
  this.__computation = makeForkable(computation, this._taskID)
  this._isTask = true
  this.previousTasks = previousTasks || []
  // this._isCancelled = false
}

TaskInstance.prototype.map = map_
TaskInstance.prototype.mapIf = mapIf_
TaskInstance.prototype.join = join_
TaskInstance.prototype.combine = combine_
TaskInstance.prototype.bimap = bimap_
TaskInstance.prototype.ap = ap_
TaskInstance.prototype.chain = chain_
TaskInstance.prototype.chainIf = chainIf_
TaskInstance.prototype.flatMap = chain_
TaskInstance.prototype.flatMapIf = chainIf_
TaskInstance.prototype.bind = chain_
TaskInstance.prototype.then = then_
TaskInstance.prototype.thenIf = thenIf_
TaskInstance.prototype.catch = catchError_
TaskInstance.prototype.clone = clone_
TaskInstance.prototype.repeat = repeat_
TaskInstance.prototype.retry = retry_
TaskInstance.prototype.cache = cache_
TaskInstance.prototype.fork = fork_
TaskInstance.prototype.run = run_

export default function Task(
  subscribe /*: TaskDescription*/,
  previousTasks
) /*: TaskInstance */ {
  return new TaskInstance(subscribe, previousTasks)
}

Task.flippedArgs = function(fn) {
  return Task(flip2(fn))
}

Task.of = of_
Task.resolve = of_
Task.reject = reject
Task.do = doTask
Task.all = all
Task.race = race
Task.wait = wait
Task.parallel = parallel
Task.sequence = sequence
Task.fromPromise = fromPromise

function of_(value /*: any*/) /*: TaskInstance*/ {
  return Task(function(reject, resolve, onError) {
    resolve(value)
    return { cancel: noop }
  }, [])
}

export function resolve(v) {
  return of_(v)
}

export function reject(value /*: any*/) /*: TaskInstance*/ {
  return Task(function(reject, resolve, onError) {
    reject(value)
    return { cancel: noop }
  }, [])
}

export function doTask(genFn) {
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

export function all(taskArray /*: Array<TaskInstance>*/) /*: TaskInstance*/ {
  return Task(function(reject, resolve, onError) {
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

    const notifyReject = index => error => {
      cancel(index)
      reject(error, index)
    }

    const notifyError = index => error => {
      setTimeout(function() {
        cancel(index)
        onError(error, index)
      }, 0)
    }

    const allExecutions = taskArray.map((task, index) => {
      results[`t-${index}`] = undefined
      keys = Object.keys(results)
      return task.fork(notifyReject(index), notify(index), notifyError(index))
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

export function race(taskArray /*: Array<TaskInstance>*/) /*: TaskInstance*/ {
  return Task(function(reject, resolve, onError) {
    const notify = index => value => {
      cancel(index)
      resolve(value)
    }
    const notifyReject = index => error => {
      cancel(index)
      reject(error, index)
    }
    const notifyError = index => error => {
      setTimeout(function() {
        cancel(index)
        onError(error, index)
      }, 0)
    }
    let executions = taskArray.map((task, index) => {
      return task.fork(notifyReject(index), notify(index), notifyError(index))
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

export function sequence(
  taskArray /*: Array<TaskInstance>*/
) /*: TaskInstance*/ {
  return Task(function(reject, resolve, onError) {
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
    return sequenceTask.fork(reject, resolve, onError)
  })
}

export function parallel(
  taskArray /*: Array<TaskInstance>*/
) /*: TaskInstance*/ {
  return Task(function(reject, resolve, onError) {
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
        .fork(
          reject,
          val => {
            results.push(val)
            remainingTasks--
            if (remainingTasks === 0) resolve(results)
          },
          onError
        )
    })
    const cancel = () => parallellizedTasks.forEach(e => e.cancel())
    return { cancel }
  })
}

export function fromPromise(promise /*: Promise<any>*/) /*: TaskInstance*/ {
  return Task(function(reject, resolve, onError) {
    let shouldIgnore = false
    promise.then(
      v => {
        if (!shouldIgnore) {
          resolve(v)
        }
      },
      err => {
        if (!shouldIgnore) {
          reject(err)
        }
      }
    )
    return {
      cancel: () => {
        shouldIgnore = true
      }
    }
  })
}

export function wait(time /*: number*/, value /*: any*/) /*: TaskInstance*/ {
  return Task(function(reject, resolve, onError) {
    let timerId = setTimeout(_ => resolve(value), time)
    return { cancel: () => clearTimeout(timerId) }
  }, [])
}

// Operators

function fork_(rej, res, onError) {
  return this.__computation(rej, res, onError)
}

export const fork = curry(function(rej, res, onError, task) {
  return task.fork(rej, res, onError)
})

function run_(cb) {
  cb = cb || noop
  return this.fork(x => console.log('Rejected - reason : ', x), cb)
}

export const run = curry(function(cb, task) {
  if (!task) return cb.run()
  return task.run(cb)
})

function cache_(/*: TaskInstance*/) {
  let cachedExec
  const previousTask = this
  return Task(function(reject, resolve, onError) {
    let previousExec
    if (!cachedExec) {
      previousExec = cachedExec = previousTask.fork(reject, resolve, onError)
      return previousExec
    } else {
      let ins = cachedExec.getStatus()
      if (ins.status === 'resolved') resolve(ins.value)
      if (ins.status === 'rejected') reject(ins.reason)
      return { cancel: cachedExec.cancel }
    }
  })
}

function map_(cb) /*: TaskInstance*/ {
  const previousTask = this
  return Task(
    function(reject, resolve, onError) {
      return previousTask.fork(
        reject,
        try_catch((...values) => {
          let nextValues = cb(...values)
          // console.warn('map --> ', values, nextValues)
          resolve(nextValues)
        }, onError),
        onError
      )
    },
    [...previousTask.previousTasks, ctd('map', cb)]
  )
}

export const map = curry(function(cb, task) {
  return task.map(cb)
})

function mapIf_(pred, branchIf, branchElse) /*: TaskInstance*/ {
  const previousTask = this
  return Task(
    function(reject, resolve, onError) {
      return previousTask.fork(
        reject,
        try_catch((...values) => {
          if (pred(...values)) {
            resolve(branchIf(...values))
          } else {
            resolve(branchElse(...values))
          }
        }, onError),
        onError
      )
    },
    [...previousTask.previousTasks, ctd('mapIf', [pred, branchIf, branchElse])]
  )
}

export const mapIf = curry(function(pred, branchIf, branchElse, task) {
  return task.mapIf(pred, branchIf, branchElse)
})

function join_() /*: TaskInstance*/ {
  const previousTask = this
  return Task(
    function(reject, resolve, onError) {
      let nextCancelCb
      let previousCancel = previousTask.fork(
        reject,
        nextTask => {
          let nextRunningTask = nextTask.fork(reject, resolve, onError)
          nextCancelCb = nextRunningTask.cancel
          return { cancel: nextRunningTask.cancel }
        },
        onError
      )
      let cancel = () => {
        if (nextCancelCb) nextCancelCb()
        previousCancel.cancel()
      }
      return { cancel }
    },
    [...previousTask.previousTasks, ctd('join')]
  )
}

export const join = curry(function(task) {
  return task.join()
})

function chain_(cb) /*: TaskInstance*/ {
  const previousTask = this
  return previousTask.map(cb).join()
}

export const chain = curry(function(cb, task) {
  return task.chain(cb)
})

function chainIf_(pred, branchIf, branchElse) /*: TaskInstance*/ {
  const previousTask = this
  return previousTask.mapIf(pred, branchIf, branchElse).join()
}

export const chainIf = curry(function(pred, branchIf, branchElse, task) {
  return task.chainIf(pred, branchIf, branchElse)
})

function combine_(...callbacks) /*: TaskInstance*/ {
  const previousTask = this
  return Task(function(reject, resolve, onError) {
    return previousTask.fork(
      reject,
      try_catch(val => {
        let nextValues = callbacks.map(cb => cb(val))
        console.warn('combine --> ', callbacks, val, nextValues, resolve)
        resolve.apply(null, nextValues)
        // resolve(...nextValues)
      }, onError),
      onError
    )
  })
}

function bimap_(cbRej, cbRes) /*: TaskInstance*/ {
  const previousTask = this
  return Task(function(reject, resolve, onError) {
    return previousTask.fork(
      try_catch(err => {
        let nextValue = cbRej(err)
        reject(nextValue)
      }, onError),
      try_catch(val => {
        let nextValue = cbRes(val)
        resolve(nextValue)
      }, onError),
      onError
    )
  })
}

export const bimap = curry(function(cbRej, cbRes, task) {
  return task.bimap(cbRej, cbRes)
})

function ap_(taskToApply) /*: TaskInstance*/ {
  const previousTask = this
  return previousTask.chain(f => taskToApply.map(f))
}

export const ap = curry(function(taskToApply, task) {
  return task.ap(taskToApply)
})

function then_(cb) /*: TaskInstance*/ {
  const previousTask = this
  return Task(
    function(reject, resolve, onError) {
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
          let nextCancel = nextTask.fork(reject, resolve, onError)
          nextCancelCb = nextCancel.cancel
          return { cancel: nextCancel.cancel }
        }, onError),
        onError
      )
      let cancel = () => {
        if (nextCancelCb) nextCancelCb()
        previousCancel.cancel()
      }
      return { cancel }
    },
    [...previousTask.previousTasks, ctd('then', cb)]
  )
}

export const then = curry(function(cb, task) {
  return task.then(cb)
})

function thenIf_(pred, branchIf, branchElse) /*: TaskInstance*/ {
  const previousTask = this
  return Task(function(reject, resolve, onError) {
    let nextCancelCb
    let previousCancel = previousTask.fork(
      reject,
      try_catch(val => {
        let nextResult
        if (pred(val)) {
          nextResult = branchIf(val)
        } else {
          nextResult = branchElse(val)
        }
        let nextTask
        if (!nextResult) {
          nextTask = Task.of(undefined)
        } else if (nextResult && nextResult._isTask) {
          nextTask = nextResult
        } else {
          nextTask = Task.of(nextResult)
        }
        let nextCancel = nextTask.fork(reject, resolve, onError)
        nextCancelCb = nextCancel.cancel
        return { cancel: nextCancel.cancel }
      }, onError),
      onError
    )
    let cancel = () => {
      if (nextCancelCb) nextCancelCb()
      previousCancel.cancel()
    }
    return { cancel }
  })
}

export const thenIf = curry(function(pred, branchIf, branchElse, task) {
  return task.thenIf(pred, branchIf, branchElse)
})

function catchError_(cb) /*: TaskInstance*/ {
  const previousTask = this
  return Task(
    function(reject, resolve, onError) {
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
          let nextCancel = nextTask.fork(reject, resolve, onError)
          nextCancelCb = nextCancel.cancel
          return { cancel: nextCancel.cancel }
        }, onError),
        resolve,
        onError
      )

      let cancel = () => {
        if (nextCancelCb) nextCancelCb()
        previousCancel.cancel()
      }
      return { cancel }
    },
    [...previousTask.previousTasks, ctd('catch', cb)]
  )
}

export const catchError = curry(function(cb, task) {
  return task.catch(cb)
})

function clone_(/*: TaskInstance*/) {
  const previousTask = this
  return Task(function(reject, resolve, onError) {
    return previousTask.fork(reject, resolve, onError)
  })
}

function repeat_(times /*: number*/ = 2) /*: TaskInstance*/ {
  const previousTask = this
  const taskArray = Array.from(Array(times).keys()).map(_ =>
    previousTask.clone()
  )
  return Task.sequence(taskArray)
}

function retry_(times /*: number*/ = 2) {
  const previousTask = this
  return Task(function(reject, resolve, onError) {
    let fallbackTask = previousTask
    let retryiedTask = previousTask
    for (let i = 0; i < times; i++) {
      retryiedTask = retryiedTask.catch(err => {
        console.log(err)
        return fallbackTask
      })
    }
    return previousTask.fork(reject, resolve, onError)
  })
}

// Execution

function throwError(e) {
  let g = new Error('from Task :  ' + e)
  throw g
}

function makeForkable(subscription, taskID) {
  return function forkable(rej, res, onError = throwError) {
    let __value,
      __error,
      __cause,
      __isCancelled = false,
      em = eventEmitter()

    const inspector = () => {
      if (__isCancelled) return { status: 'cancelled', value: undefined }
      if (__error !== undefined) return { status: 'error', reason: __error }
      if (
        __value === undefined &&
        __error === undefined &&
        __cause === undefined
      ) {
        return { status: 'pending', value: undefined }
      }
      if (__cause !== undefined) return { status: 'rejected', reason: __cause }
      return { status: 'resolved', value: __value }
    }

    const checkTermination = () => {
      const ins = inspector()
      return ins.status !== 'pending'
    }

    const promisify = () => {
      return new Promise((resolve, reject) => {
        const { status, reason, value } = inspector()
        switch (status) {
          case 'pending':
            em.once('error', reject)
            em.once('reject', reject)
            em.once('value', resolve)
            break
          case 'error':
            reject(reason)
            break
          case 'rejected':
            reject(reason)
            break
          case 'resolved':
            resolve(value)
            break
          case 'cancelled':
            resolve('cancelled')
            break
          default:
        }
      })
    }

    let execution = {
      cancel: () => {
        __isCancelled = true
        noCancelHandler()
      },
      getID: () => taskID,
      getStatus: inspector,
      inspect: () => {
        const { status, value } = inspector()
        return `Task({status:'${status.toUpperCase()}', value: ${value}})`
      },
      promisify: promisify,
      _isExecution: true
    }

    const wrappedResolve = val => {
      if (checkTermination()) {
        if (DEBUG) {
          console.error(
            `It is not possible to resolve/reject a Task more than once.`
          )
        }
        return
      }
      __value = val
      em.emit('value', val)
      res(val)
      // trigger promise
    }

    const wrappedReject = cause => {
      if (checkTermination()) {
        if (DEBUG) {
          console.error(
            `It is not possible to resolve/reject a Task more than once.`
          )
        }
        return
      }
      __cause = cause
      em.emit('reject', cause)
      rej(cause)
      // trigger promise
    }

    const wrappedOnError = err => {
      if (checkTermination()) {
        if (DEBUG) {
          console.error(`It is not possible to throw in a Task more than once.`)
        }
        return
      }
      __error = err
      em.emit('error', err)
      onError(err)
    }

    const runningTask = subscription(
      wrappedReject,
      wrappedResolve,
      wrappedOnError
    )

    // flipping arguments
    if (runningTask && runningTask.cancel) {
      execution.cancel = () => {
        __isCancelled = true
        runningTask.cancel()
      }
    }
    return execution
  }
}

// Utils

function noop() {}

function noCancelHandler() {
  if (DEBUG) {
    console.log(
      'Error: Cannot cancel Task chain. One or more tasks in the chain has no cancellation handler.'
    )
  }
}

function try_catch(fn, onError) {
  return function(arg) {
    try {
      return fn(arg)
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

function flip2(fn) {
  return (a, b) => fn(b, a)
}

function eventEmitter() {
  const registered = {}

  const off = (type, handler) => {
    if (registered[type]) {
      registered[type] = null
    }
  }

  const emit = (type, evt) => {
    const handler = registered[type]
    if (handler) handler(evt)
  }

  const on = (type, handler) => {
    registered[type] = handler
  }

  const once = (type, handler) => {
    on(type, (...args) => {
      handler(...args)
      off(type, handler)
    })
  }

  return { once, on, off, emit }
}
