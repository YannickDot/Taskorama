/**
* @Author: Yannick Spark <yannickdot>
* @Date:   2017-02-09T11:28:40+01:00
* @Last modified by:   yannickdot
* @Last modified time: 2017-02-09T11:52:19+01:00
*/

// @flow

import type { TaskInstance } from "./index.js";

import Task from "./index.js";

Task.fetch = function(url: string): TaskInstance {
  return Task(function(resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open("get", url, true);
    xhr.onerror = reject;
    xhr.onreadystatechange = function() {
      var status, data;
      if (xhr.readyState == 4) {
        status = xhr.status;
        if (status == 200) {
          resolve({
            json: () => JSON.parse(xhr.responseText),
            text: () => xhr.responseText,
            xhr: xhr,
            status: status,
            url: url
          });
        } else {
          reject(status);
        }
      }
    };
    xhr.send();

    let cancel = () => xhr.abort();
    return { cancel };
  });
};
