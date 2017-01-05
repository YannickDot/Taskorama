# Taskorama

⚙ - Tasks for the masses

I created this lib when I tried to implement Tasks in JavaScript in order to understand how do they work.

They happen to be really simple and have richer semantics than Promises. So I decided to replace Promises by Tasks in my code in order to separate pure data processing resulting of an async computation and side-effects.

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
