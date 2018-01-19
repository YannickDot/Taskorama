// @flow

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

function TaskInstance(computation /*: TaskDescription*/) {
  this.__computation = makeForkable(computation)
  this._isTask = true
}

TaskInstance.prototype.map = map
TaskInstance.prototype.mapIf = mapIf
TaskInstance.prototype.join = join
TaskInstance.prototype.combine = combine
TaskInstance.prototype.bimap = bimap
TaskInstance.prototype.ap = ap
TaskInstance.prototype.chain = chain
TaskInstance.prototype.chainIf = chainIf
TaskInstance.prototype.flatMap = chain
TaskInstance.prototype.flatMapIf = chainIf
TaskInstance.prototype.bind = chain
TaskInstance.prototype.then = then
TaskInstance.prototype.thenIf = thenIf
TaskInstance.prototype.catch = catchError
TaskInstance.prototype.clone = clone
TaskInstance.prototype.repeat = repeat
TaskInstance.prototype.retry = retry
TaskInstance.prototype.cache = cache

TaskInstance.prototype.fork = function(rej, res, onError) {
  return this.__computation(rej, res, onError)
}

TaskInstance.prototype.run = function(cb) {
  cb = cb || noop
  return this.fork(x => console.log('Rejected - reason : ', x), cb)
}

export default function Task(
  subscribe /*: TaskDescription*/
) /*: TaskInstance */ {
  return new TaskInstance(subscribe)
}

Task.flippedArgs = function(fn) {
  return Task(flip2(fn))
}

Task.of = function(value /*: any*/) /*: TaskInstance*/ {
  return Task(function(reject, resolve, onError) {
    resolve(value)
    return { cancel: noop }
  })
}

Task.resolve = Task.of

Task.reject = function(value /*: any*/) /*: TaskInstance*/ {
  return Task(function(reject, resolve, onError) {
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

Task.all = function(taskArray /*: Array<TaskInstance>*/) /*: TaskInstance*/ {
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

Task.race = function(taskArray /*: Array<TaskInstance>*/) /*: TaskInstance*/ {
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

Task.sequence = function(
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

Task.parallel = function(
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

Task.fromPromise = function(promise /*: Promise<any>*/) /*: TaskInstance*/ {
  return Task(function(reject, resolve, onError) {
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

Task.wait = function(time /*: number*/, value /*: any*/) /*: TaskInstance*/ {
  return Task(function(reject, resolve, onError) {
    let timerId = setTimeout(_ => resolve(value), time)
    return { cancel: () => clearTimeout(timerId) }
  })
}

function cache(/*: TaskInstance*/) {
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

function map(cb) /*: TaskInstance*/ {
  const previousTask = this
  return Task(function(reject, resolve, onError) {
    return previousTask.fork(
      reject,
      try_catch((...values) => {
        let nextValues = cb(...values)
        // console.warn('map --> ', values, nextValues)
        resolve(nextValues)
      }, onError),
      onError
    )
  })
}

function mapIf(pred, branchIf, branchElse) /*: TaskInstance*/ {
  const previousTask = this
  return Task(function(reject, resolve, onError) {
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
  })
}

function join() /*: TaskInstance*/ {
  const previousTask = this
  return Task(function(reject, resolve, onError) {
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
  })
}

function chain(cb) /*: TaskInstance*/ {
  const previousTask = this
  return previousTask.map(cb).join()
}

function chainIf(pred, branchIf, branchElse) /*: TaskInstance*/ {
  const previousTask = this
  return previousTask.mapIf(pred, branchIf, branchElse).join()
}

function combine(...callbacks) /*: TaskInstance*/ {
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

function bimap(cbRej, cbRes) /*: TaskInstance*/ {
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

function ap(taskToApply) /*: TaskInstance*/ {
  const previousTask = this
  return previousTask.chain(f => taskToApply.map(f))
}

function then(cb) /*: TaskInstance*/ {
  const previousTask = this
  return Task(function(reject, resolve, onError) {
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
  })
}

function thenIf(pred, branchIf, branchElse) /*: TaskInstance*/ {
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

function catchError(cb) /*: TaskInstance*/ {
  const previousTask = this
  return Task(function(reject, resolve, onError) {
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
  })
}

function clone(/*: TaskInstance*/) {
  const previousTask = this
  return Task(function(reject, resolve, onError) {
    return previousTask.fork(reject, resolve, onError)
  })
}

function repeat(times /*: number*/ = 2) /*: TaskInstance*/ {
  const previousTask = this
  const taskArray = Array.from(Array(times).keys()).map(_ =>
    previousTask.clone()
  )
  return Task.sequence(taskArray)
}

function retry(times /*: number*/ = 2) {
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

function throwError(e) {
  let g = new Error('from Task :  ' + e)
  throw g
}

function makeForkable(subscription) {
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
      const { status } = inspector()
      return status !== 'pending'
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
        return console.error(
          `It is not possible to resolve/reject a Task more than once.`
        )
      }
      __value = val
      em.emit('value', val)
      res(val)
      // trigger promise
    }

    const wrappedReject = cause => {
      if (checkTermination()) {
        return console.error(
          `It is not possible to resolve/reject a Task more than once.`
        )
      }
      __cause = cause
      em.emit('reject', cause)
      rej(cause)
      // trigger promise
    }

    const wrappedOnError = err => {
      if (checkTermination()) {
        return console.error(
          `It is not possible to throw in a Task more than once.`
        )
      }
      __error = err
      em.emit('error', err)
      onError(err)
    }

    const runningTask = subscription(
      wrappedReject,
      wrappedResolve,
      wrappedOnError
    ) // flipping arguments
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
