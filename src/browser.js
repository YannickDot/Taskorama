/**
* @Author: Yannick Spark <yannickdot>
* @Date:   2017-02-09T11:28:40+01:00
* @Last modified by:   yannickdot
* @Last modified time: 2017-02-09T11:52:19+01:00
*/

// @flow
import type {TaskInstance} from './index.js'
import Task from './index.js'

Task.fetch = function (url: string, options: any = {}): TaskInstance {
  return Task(function (resolve, reject) {
    var xhr = new XMLHttpRequest()
    xhr.open(options.method || 'get', url, true)
    xhr.onerror = reject
    xhr.onload = () => {
      if (xhr.status == 200) {
        resolve({
          json: () => JSON.parse(xhr.responseText),
          text: () => xhr.responseText,
          xml: () => xhr.responseXML,
          blob: () => new Blob([xhr.response]),
          xhr: xhr,
          statusText: xhr.statusText,
          status: xhr.status,
          url: url
        })
      } else {
        reject(status)
      }
    }
    xhr.send()

    return {cancel: () => xhr.abort()}
  })
}

export default Task
