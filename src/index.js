// export {myLibrary} from './mylibrary/'

const http = require('http')

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

function Task (subscribe) {
  return {
    fork: flip2(subscribe),
    run: (cb) => subscribe(cb, console.error),
    map: map,
    ap: ap,
    chain: chain,
    flatMap: chain
  }
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


Task.wrapFn = (fn) => (...data) => {
  return Task((resolve, reject) => {
    let cancel = noop
    try {
      resolve(fn(...data))
    } catch (e) {
      reject(e)
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

Task.fetchJSON = (url) => {
  return Task((resolve, reject) => {
    let request = new XMLHttpRequest()
    request.open('get', url, true)
    request.onreadystatechange = () => {
      let status, data
      if (request.readyState == 4) {
        status = request.status;
        if (status == 200) {
          data = JSON.parse(request.responseText)
          resolve(data)
        } else {
          reject(status)
        }
      }
    }

    request.send()
    let cancel = () => {
      request.abort()
      request = null
    }
    return {cancel}
  })
}

Task.fetchJSON_Server = (url) => {
  return Task((resolve, reject) => {
    let request = http.get(url, (res) => {
      let body = ''
      res.on('data', (chunk) => {
        body += chunk
      })
      res.on('end', () => {
        let response = body
        resolve(response)
      })
    }).on('error', reject)

    let cancel = () => request.abort()
    return {cancel}
  }).map(JSON.parse)
}

// Chaining tasks and cancellation
const tasks = Task.wait(2000, `go`)
  .chain(value => Task.wait(2000, `${value} - foo`))
  .chain(value => Task.wait(2000, `${value} - bar`))
  .chain(value => Task.wait(2000, `${value} - baz`))

const canceller = Task.wait(2000, 'cancel')
const startTime = Date.now()
const execChain = tasks.fork(
  console.error,
  (x) => console.log(`Chain : Task '${x}' has finished after ${Date.now() - startTime}ms`)
)

// canceller.run(() => execChain.cancel())

// Sync Tasks (sync by default !)
const syncTask = Task.of(42)
.map(x => x * 2)
const runSync = syncTask.fork(console.error, console.log)
runSync.cancel()


// Task.all and Task.race
const taskArr = [
  Task.wait(2000,`one`),
  Task.wait(3000,`two`),
  Task.wait(1000,`three`),
  Task.wait(4000,`four`),
]

const tasksAll = Task.all(taskArr)
const execAll = tasksAll.run(
  (x) => console.log(`All : Task '${x}' has finished after ${Date.now() - startTime}ms`)
)

const tasksRace = Task.race(taskArr)
const execRace = tasksRace.run(
  (x) => console.log(`Race : Task '${x}' has finished first after ${Date.now() - startTime}ms`)
)


// fromPromise
const p = Promise.resolve(2)
const taskFromPromise = Task.fromPromise(p)
const execTaskFromPromise = taskFromPromise.run(
  (x) => console.log(`fromPromise : Task from promise -> ${x}`)
)

// Ap
const taskToApply = Task.of(x => x.toUpperCase())
const taskInput = Task.of('hey Ho, leTs gO')
const taskApplied = taskInput.ap(taskToApply)
const execTaskApplied = taskApplied.run(
  (x) => console.log(`Ap : Task applied with .ap() -> ${x}`)
)

// fetchJSON_Server
const taskFetchJSONServer = Task.fetchJSON_Server('http://jsonplaceholder.typicode.com/users')
const execTaskFetchJSONServer = taskFetchJSONServer.run(
  (json) => console.log(`fetchJSON_Server : got JSON ->`, json)
)
execTaskFetchJSONServer.cancel()
