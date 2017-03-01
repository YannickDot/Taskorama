<p align="center">

  <p align="center">
   <br/>
   <img src="https://cdn.jsdelivr.net/emojione/assets/svg/2699.svg" width="180" height="180" alt="Taskorama">
   <br/>
  </p>
  <h1 align="center">Taskorama</h1>
  <p align="center">
    <b align="center">Taskorama is a tiny Task data type for JavaScript (~1.6Kb)</b>
  </p>
  <p align="center">
    <a href="https://www.npmjs.org/package/taskorama"><img src="https://img.shields.io/npm/v/taskorama.svg?style=flat" alt="npm"></a> <a href="https://github.com/YannickDot/taskorama/blob/master/LICENSE"><img src="http://img.shields.io/badge/license-MIT-lightgrey.svg?style=flat" alt="licence"></a>
  </p>

</p>

<br/>
<br/>

Taskorama is an implementation of the Task data type.
It is used to express **concurrent**, **asynchronous** and **cancellable computations** using **functional programming** constructs.

The semantics is pretty close to the ones provided by Promises but it has many subtle differencies explained in the [Rationale](#rationale) section.

Here is an example of how you can use them :

```js
import Task from 'taskorama'

// Let's create a Task
const myTimeoutTask = Task(function (resolve, reject) {

  // complete task succesfully after 3s
  let timer = setTimeout(resolve, 3000)

  // execute `cancel` to stop the timeout
  let cancel = () => clearTimeout(timer)

  return {cancel}
})

// Start `myTimeoutTask`
const myTimeoutExec = myTimeoutTask.fork(
  (err) => console.error(err),
  (res) => console.log(res)
)

// Cancel `myTimeoutTask` when you need to !
myTimeoutExec.cancel()

```

<p align="center">It's like a Promise but <strong>deferrable</strong> and <strong>cancellable</strong> 🤗 </p>


## Install

```sh
> npm install --save taskorama
```

or

```sh
> yarn add taskorama
```

## Usage

### Creating a Task

```js
const task = Task((resolve, reject) => {
  // Do your thing ...
  resolve(the_result)

  // An error ?
  reject(the_error)

  // A closure that cancels stuff running in the task
  const cancel = () => console.log('cancelled !')

  // return it inside an object
  return {cancel}
})
```

### Running (forking) and cancelling a Task

```js
// the error handling effect
const errorEffect = (err) => {}

// the success handling effect
const successEffect = (res) => {}

// Let's start the task
const runningTask = task.fork(
  errorEffect,
  successEffect
)

// Let's cancel it
runningTask.cancel() // --> 'cancelled !'

```


## Migrating some Promise-based code to Taskorama

#### With Promises :

```js
let myPromise = new Promise(function(resolve, reject) {
  setTimeout(resolve, 300)
})

myPromise
  .then(_ => "Timeout done !")
  .then(value => {
    throw "oops!"
  })
  .then(_ => "There was an error up there. I won't be received.")
  .catch(error => console.log(`Caught the error : ${error}`))
  .then(_ => "Everything's fine now !")
```

#### With Tasks :

```js
// `Task` is the constructor
let myTask = Task(function(resolve, reject) {
  setTimeout(resolve, 300)
})

// It has the same semantics with `.then` and `.catch`
myTask
  .then(_ => "Timeout done !")
  .then(value => {
    throw "oops!"
  })
  .then(_ => "There was an error up there. I won't be received.")
  .catch(error => console.log(`Caught the error : ${error}`))
  .then(_ => "Everything's fine now !")

// BUT ... the computation is deferred.
// It must be run using `.fork(errorCb, successCb)` or `.run(successCb)`.
let myRunningTask = myTask.fork(
  // No more `Unhandled rejection` errors. You're forced to handle error at the end of the chain.
  (error) => console.log(`Got the error : ${error}`),
  (finalResult) => console.log(`The final result is : ${finalResult}`)
)

// OR

// `.run(cb)` is an alias for `.fork(console.error, cb)`
let myRunningTask = myTask.run(finalResult => console.log(`The final result is : ${finalResult}`))
```

**BONUS**

You may want to cancel the computation :
```js
let myTask = Task(function(resolve, reject) {
  let timeoutHandler = setTimeout(resolve, 300)

  // If you want it to be cancellable
  let cancelTimeout = () => clearTimeout(timeoutHandler)
  return { cancel: cancelTimeout }
})

/* ... */

// Let's cancel it !
myRunningTask.cancel()
```

## API


### Instance methods

```js
// create a Task
const myTimeoutTask = Task(function (resolve, reject) {
  let timer = setTimeout(function () {
    resolve(42) // complete task succesfully with value '42' after 3s
  }, 3000)

  // execute `cancel` to stop the timeout
  let cancel = () => clearTimeout(timer)
  return {cancel}
})
```

#### .fork(errorEffect, successEffect)

```js
myTimeoutTask.fork(console.error, console.log)
// logs : 42
```

#### .run(successEffect)
`.run(myCb)` is an alias for `.fork(console.error, myCb)`

```js
myTimeoutTask.run(console.log)
// logs : 42
```

#### .map()

```js
myTimeoutTask.map(x => x * 2).fork(console.error, console.log)
// logs : 84
```

<!--
#### .ap()

```js
const taskToApply = Task.of(x => x * 2)
myTimeoutTask.ap(taskToApply).run(console.log)
// logs: 84
```
-->

#### .chain() / .flatMap()

```js
myTimeoutTask
  .chain(val => Task.of(val * 2))
  .flatMap(val => Task.of(val + 1))
  .fork(console.error, console.log)
// logs: 85
```

#### .then()

```js
myTimeoutTask
  .then(x => x * 2)
  .then(val => Task.of(val + 1))
  .fork(console.error, console.log)
// logs: 85
```

#### .catch()

```js
myTimeoutTask
  .then(x => {
    throw 'argh'
  })
  .then(x => 42)
  .catch(err => "Cool, it's fine now.")
  .fork(console.error, console.log)
// logs: "Cool, it's fine now."
```


### Static methods

#### Task.of / Task.resolve
Creates a task that completes immediately with the passed value.

```js
const task = Task.of(200)
task.fork(console.error, console.log)
// logs: 200
```

#### Task.reject
Creates a task that rejects immediately with the passed value.

```js
const task = Task.reject(404)
task.fork(console.error, console.log)
// logs error: 404
```

#### Task.fetch(url)
Creates a task that makes a request on the specified url.
It resolves with a Response object.

The `Response` object exposes the following readers at the moment :
- `.json()`
- `.text()`

`Task.fetch` try to mimic the behavior of the [fetch API](https://developers.google.com/web/updates/2015/03/introduction-to-fetch)

```js
const url = 'https://jsonplaceholder.typicode.com/users'
const requestTask = Task.fetch(url)
  .then(response => response.json())

const runningRequest = requestTask.fork(console.error, console.log)
// logs: [Object, Object, ..., Object]
```

Any inflight request can be cancelled like this :
```js
runningRequest.cancel()
```

#### Task.wait
Creates a task that completes after a certain duration (first argument).
It resolves with the value passed as second argument.

```js
const timeoutTask = Task.wait(10000, "I'm done !")
const execTimeout = timeoutTask.fork(console.error, console.log)
// logs: "I'm done !" - after 10s
```

It can be cancelled like this :
```js
execTimeout.cancel()
// the timeout is cancelled.
```

#### Task.all(array)
Creates a task that completes when all the tasks in the array are completed.
It resolves with an array containing each value of each task of the array.
If any of them rejects, the returned task rejects with the rejection reason.

If it is cancelled, it cancels all the tasks in the array as well.

```js
const taskArray = [
  Task.wait(2000,`one`),
  Task.wait(3000,`two`),
  Task.wait(1000,`three`),
  Task.wait(4000,`four`),
]

const tasksAll = Task.all(taskArray)

tasksAll.fork(console.error, console.log)
// logs: ['one', 'two', 'three', 'four'] - after 4s
```

#### Task.race
Creates a task that is fulfilled or rejected as soon as a task in the array is fulfilled or rejected.

If it is cancelled, it cancels all the tasks in the array as well.

```js
const taskArray = [
  Task.wait(2000,`one`),
  Task.wait(3000,`two`),
  Task.wait(1000,`three`),
  Task.wait(4000,`four`),
]

const tasksRace = Task.race(taskArray)

tasksRace.fork(console.error, console.log)
// logs: 'three' - after 1s
```

#### Task.sequence
Creates a task from an array of tasks, and run them in order.
It resolves with an array containing the results of the execution of every task in the array in their initial order.

If it is cancelled, it cancels all the tasks in the array as well.

```js
const taskArray = [
  Task.wait(2000,`one`),
  Task.wait(3000,`two`),
  Task.wait(1000,`three`)
]

const tasksSequence = Task.sequence(taskArray)

tasksSequence.fork(console.error, console.log)
// logs: ['one', 'two', 'three'] - after 6s
```

#### Task.parallel
Creates a task from an array of tasks, and run them concurrently.
It resolves with an array containing the results of the execution of every task in the array in their order of completion.

If it is cancelled, it cancels all the tasks in the array as well.

```js
const taskArray = [
  Task.wait(2000,`one`),
  Task.wait(3000,`two`),
  Task.wait(1000,`three`)
]

const tasksParallel = Task.parallel(taskArray)

tasksParallel.fork(console.error, console.log)
// logs: ['three', 'one', 'two'] - after 3s
```

#### Task.fromPromise
Creates a task from an existing Promise.
Such a task cannot be cancelled because a Promise is not cancellable.

```js
const p = Promise.resolve(2)
const taskFromPromise = Task.fromPromise(p)

taskFromPromise.fork(console.error, console.log)
// logs: 2
```


_You can still have a look at the [tonic-example.js](./tonic-example.js) file_

# Rationale

I created this lib when I tried to implement Tasks in JavaScript in order to understand how do they work.

I like using Promises but they have major design flaws IMHO :

- They run as soon as the promise is declared : what if I want to defer the computation ?
- They are **async by default** : i.e. `Promise.resolve(2)` ***always*** runs on the next tick
- They are not cancellable (it's unfortunate that we can't cancel `window.fetch` http request when necessary)

Tasks happen to be really simple and have richer semantics than Promises. So I decided to replace Promises by Tasks in my code in order to separate pure data processing resulting of an async computation and side-effects.

I started this project after watching [this talk](https://www.youtube.com/watch?v=uQ1zhJHclvs) about Observables.

The internals of taskorama are close to the case explained in this video.
