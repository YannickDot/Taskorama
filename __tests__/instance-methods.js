import Task from '../src/index.js'

describe('Task instance', function () {
  it('.map', function (done) {
    var value = 42
    var cb = x => x + 1
    var task = Task.of(value)
    var mappedTask = task.map(cb)

    mappedTask.run(result => {
      expect(result).toEqual(cb(value))
      done()
    })
  })
})

describe('Task instance', function () {
  it('.bimap', function (done) {
    var noop = () => {}
    var value = 42
    var error = 'argh'
    var cbRej = x => x.toUpperCase()
    var cbRes = x => x * 2
    var resolvingTask = Task.of(value)
    var rejectingTask = Task.reject(error)

    resolvingTask.bimap(cbRej, cbRes).fork(noop, val => {
      expect(val).toEqual(cbRes(value))
      done()
    })

    rejectingTask.bimap(cbRej, cbRes).fork(
      err => {
        expect(err).toEqual(cbRej(error))
        done()
      },
      noop
    )
  })
})

describe('Task instance', function () {
  it('.chain', function (done) {
    var value = 42
    var cb = x => Task.of(x + 1)
    var task = Task.of(value)
    var chainedTask = task.chain(cb)

    chainedTask.run(result => {
      cb(value).run(newVal => {
        expect(result).toEqual(newVal)
        done()
      })
    })
  })
})

describe('Task instance', function () {
  it('.ap', function (done) {
    var value1 = 3
    var value2 = 4
    var cb = x => y => x + y
    var newVal = cb(value1)(value2)
    var task = Task.of(cb)
    var appliedTask = task.ap(Task.of(value1)).ap(Task.of(value2))

    appliedTask.run(result => {
      expect(result).toEqual(newVal)
      done()
    })
  })
})

describe('Task instance', function () {
  it('.then', function (done) {
    var value = 42
    var cbMap = x => x + 1
    var cbChain = x => Task.of(x + 1)
    var task = Task.of(value)
    var thenMapTask = task.then(cbMap)
    var thenChainTask = task.then(cbChain)

    thenMapTask.run(result => {
      expect(result).toEqual(cbMap(value))
    })

    thenChainTask.run(result => {
      cbChain(value).run(newVal => {
        expect(result).toEqual(newVal)
        done()
      })
    })
  })
})

describe('Task instance', function () {
  it('.catch', function (done) {
    var error = 'An error'
    var cbMap = err => err
    var cbChain = err => Task.of(err)
    var task = Task.reject(error)
    var thenMapTask = task.catch(cbMap)
    var thenChainTask = task.catch(cbChain)

    thenMapTask.run(result => {
      let newVal = cbMap(error)
      expect(result).toEqual(newVal)
    })

    thenChainTask.run(result => {
      cbChain(error).run(newVal => {
        expect(result).toEqual(newVal)
        done()
      })
    })
  })
})

describe('Task instance', function () {
  it('.cache', function (done) {
    var value = 42
    var task = Task.wait(200, value)
    var cachedTask = task.cache()

    cachedTask.run(result => {
      expect(result).toEqual(value)
      let t1 = new Date()
      cachedTask.run(r => {
        let t2 = new Date()
        expect(r).toEqual(value)
        expect(t2-t1).toEqual(0)
        done()
      })
    })
  })
})

describe('Task instance', function () {
  it('.repeat', function (done) {
    done()
  })
})

describe('Task instance', function () {
  it('.clone', function (done) {
    done()
  })
})

describe('Task instance', function () {
  it('.retry', function (done) {
    done()
  })
})
