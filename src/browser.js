// @flow

import Task from './index.js'

import { leanFetch } from './leanFetch.js'

Task.fetch = function(
  url /*: string*/,
  options /*: any*/ = {}
) /*: TaskInstance*/ {
  return Task(function(reject, resolve) {
    const cancelRequest = leanFetch(url, options, resolve, reject)
    return { cancel: cancelRequest }
  })
}

function serializeParams(context) {
  const pairs = Object.keys(context)
    .map(key => `${key} : ${JSON.stringify(context[key])}`)
    .join(', ')
  return `{ ${pairs} }`
}

function buildWorkerCode(fn, context) {
  function mapArgToVariable(key, index) {
    if (index === 0) {
      return (key.length !== 0 && `var ${key} = DISPATCH_TO_MAIN_THREAD;`) || ''
    } else if (index === 1) {
      return (
        (key.length !== 0 &&
          `importScripts('https://unpkg.com/taskorama');
          var ${key} = taskorama;`) ||
        ''
      )
    } else if (index === 2) {
      return (
        (key.length !== 0 && `var ${key} = ${serializeParams(context)}`) || ''
      )
    } else {
      return ''
    }
  }

  const userWorkerCode = fn.toString()
  const argumentsStr = userWorkerCode.substring(
    userWorkerCode.indexOf('(') + 1,
    userWorkerCode.indexOf(')')
  )
  const argKeys = argumentsStr.split(',').map(s => s.trim())
  const argsCode = argKeys.map(mapArgToVariable).join('\n')

  const code = `
var DISPATCH_TO_MAIN_THREAD = (x) => postMessage(JSON.stringify(x))
${argsCode}
${userWorkerCode.substring(
    userWorkerCode.indexOf('{') + 1,
    userWorkerCode.lastIndexOf('}')
  )}
  `

  console.log(code)
  return code
}

Task.runInWorker = function(workerFn, context = {}) {
  return Task(function(reject, resolve, onError) {
    const code = buildWorkerCode(workerFn, context)
    const blob = new Blob([code], { type: 'application/javascript' })
    const worker = new Worker(URL.createObjectURL(blob))
    const cancel = () => worker.terminate()

    worker.onmessage = function(msg) {
      resolve(JSON.parse(msg.data))
      worker.terminate()
    }

    worker.onerror = function(err) {
      // reject(err)
      onError(err)
      worker.terminate()
    }

    return { cancel }
  })
}

Task.createTasklet = function(path) {
  const code = `
    export class Speaker {
      sayHello(message) {
        return 'Hello';
      }
    }

    export function add(a, b) {
      return a + b;
    }
  `
  const blob = new Blob([code], { type: 'application/javascript' })
  const worker = new Worker(URL.createObjectURL(blob))
  let cancel = () => worker.terminate()

  worker.onmessage = msg => {
    resolve(JSON.parse(msg.data))
    worker.terminate()
  }

  worker.onerror = err => {
    reject(err)
    worker.terminate()
  }
}

export default Task
