export default function Task (subscribe) {
  return Object.freeze({
    isTask: true,
    fork: flip2(subscribe),
    run: (cb) => subscribe(cb, console.error),
    map: map,
    ap: ap,
    chain: chain,
    flatMap: chain
  })
}

Task.of = (value) => {
  return Task((resolve, reject) => {
    resolve(value)
    let cancel = noop
    return {cancel}
  })
}

Task.reject = (value) => {
  return Task((resolve, reject) => {
    reject(value)
    let cancel = noop
    return {cancel}
  })
}

Task.resolve = Task.of

Task.all = (taskArray) => {
  return Task((resolve, reject) => {
    const numberOfTasks = taskArray.length
    let results = {}
    let keys = []
    const notify = (index) => (value) => {
      results[`t-${index}`] = value
      const tasksFinishedCount = keys.filter(k => !!results[k]).length
      if(tasksFinishedCount === numberOfTasks) {
        // All tasks are done so resolve the array of results
        let resultsArr = keys.map(k => results[k])
        resolve(resultsArr)
      }
    }
    const notifyError = (index) => (error) => {
      cancel(index)
      reject(error)
    }
    let executions = taskArray.map((task, index) => {
      results[`t-${index}`] = undefined
      keys = Object.keys(results)
      return task.fork(notifyError(index), notify(index))
    })
    const cancel = (exceptId = null) => {
      if(exceptId === null) {
        executions.forEach(e => e.cancel())
      } else {
        executions.filter((e,i) => i !== exceptId).forEach(e => e.cancel())
      }
    }
    return {cancel}
  })
}


Task.race = (taskArray) => {
  return Task((resolve, reject) => {
    const notify = (index) => (value) => {
      cancel(index)
      resolve(value)
    }
    const notifyError = (index) => (error) => {
      cancel(index)
      reject(error)
    }
    let executions = taskArray.map((task, index) => {
      return task.fork(notifyError(index), notify(index))
    })
    const cancel = (exceptId = null) => {
      if(exceptId === null) {
        executions.forEach(e => e.cancel())
      } else {
        executions.filter((e,i) => i !== exceptId).forEach(e => e.cancel())
      }
    }
    return {cancel}
  })
}

Task.fromPromise = (promise) => {
  return Task((resolve, reject) => {
    promise.then(resolve, reject)
    let cancel = () => console.warn('A promise is not cancellable.')
    return {cancel}
  })
}

Task.wait = (time, value) => {
  return Task((resolve, reject) => {
    let timerId = setTimeout(_ => resolve(value), time)
    let cancel = () => clearTimeout(timerId)
    return {cancel}
  })
}

function chain (cb) {
  const previousTask = this
  const chainedTask = Task((resolve, reject) => {
    let nextCancelCb
    let previousCancel = previousTask.fork(
      reject,
      (val) => {
        try {
          let nextTask = cb(val)
          let nextCancel = nextTask.fork(reject, resolve)
          nextCancelCb = nextCancel.cancel
          return {cancel: nextCancel.cancel}
        } catch (e) {
          reject(e)
        }
      }
    )
    let cancel = () => {
      if (nextCancelCb) nextCancelCb()
      previousCancel.cancel()
    }
    return {cancel}
  })
  return chainedTask
}

function map (cb) {
  const previousTask = this
  const mappedTask = Task((resolve, reject) => {
    let previousCancel = previousTask.fork(
      reject,
      (val) => {
        try {
          let nextValue = cb(val)
          resolve(nextValue)
        } catch (e) {
          reject(e)
        }
      }
    )
    return previousCancel
  })
  return mappedTask
}

function ap (taskFn) {
  const previousTask = this
  const appliedTask = Task((resolve, reject) => {
    let previousCancel = previousTask.fork(
      reject,
      (val) => {
        try {
          taskFn.fork(
            reject,
            (fn) => {
              try {
                let nextValue = fn(val)
                resolve(nextValue)
              } catch (e) {
                reject(e)
              }
            }
          )
        } catch (e) {
          reject(e)
        }
      }
    )
    return previousCancel
  })
  return appliedTask
}

function flip2 (fn) {
  return (a, b) => fn(b, a)
}

function noop () {}
