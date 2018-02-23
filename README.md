<p align="center">

  <p align="center">
   <br/>
   <img src="https://cdn.jsdelivr.net/emojione/assets/svg/2699.svg" width="150" height="150" alt="Taskorama">
   <br/>
  </p>
  <h1 align="center">Taskorama</h1>
  <p align="center">
    <b align="center">Taskorama is a Task/Future data type for JavaScript</b>
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
const myTimeoutTask = Task(function (reject, resolve) {

  // complete task succesfully after 3s
  let timer = setTimeout(resolve, 3000)

  // execute `cancel` to stop the timeout
  let cancel = () => clearTimeout(timer)

  return {cancel}
})

// Start `myTimeoutTask`
const myTimeoutExec = myTimeoutTask.fork(
  (rej) => console.log('failure:', rej),
  (res) => console.log('success:', res),
  (err) => console.error('caught error:', err)
)

// Cancel `myTimeoutTask` when you need to !
myTimeoutExec.cancel()

```

<p align="center">It's like a Promise but <strong>pure</strong>, <strong>deferrable</strong> and <strong>cancellable</strong> 🤗 </p>


## Install

```sh
> npm install --save taskorama
```

or

```sh
> yarn add taskorama
```

or CDN

```
https://unpkg.com/taskorama
```

## Usage

_The full API docs is available here : [Taskorama Docs](https://github.com/YannickDot/taskorama/wiki/API)_

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
// the failure handler
const failureEffect = (err) => {}

// the success handler
const successEffect = (res) => {}

// the error handler (optional)
const errorEffect = (res) => {}

// Let's start the task
const runningTask = task.fork(
  failureEffect,
  successEffect,
  errorEffect
)

// Let's cancel it
runningTask.cancel() // --> 'cancelled !'

```

# Rationale

I created this lib when I tried to implement Tasks in JavaScript in order to understand how do they work.

I like using Promises but they have major design flaws IMHO :

- They run as soon as the promise is declared : what if I want to defer the computation ?
- They are **async by default** : i.e. `Promise.resolve(2)` ***always*** runs on the next tick
- They are not cancellable (it's unfortunate that we can't cancel `window.fetch` http request when necessary)

Tasks happen to be really simple and have richer semantics than Promises :

- Tasks are pure : they do not perform any side-effect as long as they are not executed by calling `.fork()` .
- Tasks make a clear separation between **definition** and **execution**, while Promises mix the two. **@andrestaltz** explained it way better than me in [this comment](https://gist.github.com/jakearchibald/199f4e44880aa07c0b78f025238d14ed#gistcomment-2014667) and [this post](https://staltz.com/promises-are-not-neutral-enough.html)

So I decided to replace Promises by Tasks in my code in order to separate pure data processing resulting of an async computation and side-effects.

I started this project after watching [this talk](https://www.youtube.com/watch?v=uQ1zhJHclvs) about Observables.

The internals of Taskorama are similar to the one used in case explained in this video.


## License

Taskorama is released under the MIT license. See LICENSE for details.
