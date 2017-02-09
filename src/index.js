/**
* @Author: Yannick Spark <yannickdot>
* @Date:   2017-02-09T11:28:40+01:00
* @Last modified by:   yannickdot
* @Last modified time: 2017-02-09T15:10:21+01:00
*/

// @flow

export type callback = (value: any) => any | void;

export type effectCallback = (value: any) => ?void;

export type Subscription = (resolve: callback, reject: callback) => RunningTask;

export type TaskInstance = {
  _isTask: boolean,
  fork: (reject: effectCallback, resolve: effectCallback) => RunningTask,
  run: (resolve: effectCallback) => RunningTask,
  map: (cb: callback) => TaskInstance,
  flatMap: (cb: callback) => TaskInstance,
  chain: (cb: callback) => TaskInstance,
  then: (cb: callback) => TaskInstance
};

export type RunningTask = {
  cancel: effectCallback
};

export default function Task(subscribe: Subscription): TaskInstance {
  return Object.freeze({
    _isTask: true,
    map: map,
    ap: ap,
    chain: chain,
    flatMap: chain,
    then: then,
    fork: flip2(subscribe),
    run: function(cb) {
      return subscribe(cb, console.error);
    }
  });
}

Task.of = function(value: any) {
  if (value._isTask) return value;
  return Task(function(resolve, reject) {
    resolve(value);
    return { cancel: noop };
  });
};

Task.reject = function(value: any) {
  return Task(function(resolve, reject) {
    reject(value);
    return { cancel: noop };
  });
};

Task.resolve = Task.of;

Task.all = function(taskArray: Array<TaskInstance>): TaskInstance {
  return Task(function(resolve, reject) {
    const numberOfTasks = taskArray.length;
    let results = {};
    let keys = [];
    const notify = index => value => {
      results[`t-${index}`] = value;
      const tasksFinishedCount = keys.filter(k => !!results[k]).length;
      if (tasksFinishedCount === numberOfTasks) {
        // All tasks are done so resolve the array of results
        let resultsArr = keys.map(k => results[k]);
        resolve(resultsArr);
      }
    };
    const notifyError = index => error => {
      cancel(index);
      reject(error);
    };
    let executions = taskArray.map((task, index) => {
      results[`t-${index}`] = undefined;
      keys = Object.keys(results);
      return task.fork(notifyError(index), notify(index));
    });
    const cancel = (exceptId = null) => {
      if (exceptId === null) {
        executions.forEach(e => e.cancel());
      } else {
        executions.filter((e, i) => i !== exceptId).forEach(e => e.cancel());
      }
    };
    return { cancel };
  });
};

Task.race = function(taskArray: Array<TaskInstance>): TaskInstance {
  return Task(function(resolve, reject) {
    const notify = index => value => {
      cancel(index);
      resolve(value);
    };
    const notifyError = index => error => {
      cancel(index);
      reject(error);
    };
    let executions = taskArray.map((task, index) => {
      return task.fork(notifyError(index), notify(index));
    });
    const cancel = (exceptId = null) => {
      if (exceptId === null) {
        executions.forEach(e => e.cancel());
      } else {
        executions.filter((e, i) => i !== exceptId).forEach(e => e.cancel());
      }
    };
    return { cancel };
  });
};

Task.fromPromise = function(promise: Promise<any>) {
  return Task(function(resolve, reject) {
    promise.then(resolve, reject);
    return { cancel: () => console.warn("A promise is not cancellable.") };
  });
};

Task.wait = function(time: number, value: any) {
  return Task(function(resolve, reject) {
    let timerId = setTimeout(_ => resolve(value), time);
    return { cancel: () => clearTimeout(timerId) };
  });
};

function chain(cb) {
  const previousTask = this;
  const chainedTask = Task(function(resolve, reject) {
    let nextCancelCb;
    let previousCancel = previousTask.fork(reject, function(val) {
      try {
        let nextTask = cb(val) || Task.of(undefined);
        let nextCancel = nextTask.fork(reject, resolve);
        nextCancelCb = nextCancel.cancel;
        return { cancel: nextCancel.cancel };
      } catch (e) {
        reject(e);
      }
    });
    let cancel = () => {
      if (nextCancelCb) nextCancelCb();
      previousCancel.cancel();
    };
    return { cancel };
  });
  return chainedTask;
}

function map(cb) {
  const previousTask = this;
  const mappedTask = Task(function(resolve, reject) {
    let previousCancel = previousTask.fork(reject, function(val) {
      try {
        let nextValue = cb(val);
        resolve(nextValue);
      } catch (e) {
        reject(e);
      }
    });
    return previousCancel;
  });
  return mappedTask;
}

function ap(taskFn) {
  const previousTask = this;
  const appliedTask = Task(function(resolve, reject) {
    let previousCancel = previousTask.fork(reject, function(val) {
      try {
        taskFn.fork(reject, function(fn) {
          try {
            let nextValue = fn(val);
            resolve(nextValue);
          } catch (e) {
            reject(e);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
    return previousCancel;
  });
  return appliedTask;
}

function then(cb) {
  const previousTask = this;
  const thenTask = Task(function(resolve, reject) {
    let nextCancelCb;
    let previousCancel = previousTask.fork(reject, function(val) {
      try {
        let nextResult = cb(val) || Task.of(undefined);
        let nextTask;
        if (nextResult._isTask) {
          nextTask = nextResult;
        } else {
          nextTask = Task.of(nextResult);
        }
        let nextCancel = nextTask.fork(reject, resolve);
        nextCancelCb = nextCancel.cancel;
        return { cancel: nextCancel.cancel };
      } catch (e) {
        reject(e);
      }
    });
    let cancel = () => {
      if (nextCancelCb) nextCancelCb();
      previousCancel.cancel();
    };
    return { cancel };
  });
  return thenTask;
}

function flip2(fn) {
  return function(a, b) {
    return fn(b, a);
  };
}

function noop() {}
