export function leanFetch(
  url /*: string*/,
  options /*: any*/ = {},
  onResult,
  onError
) {
  var xhr = new XMLHttpRequest()
  xhr.open(options.method || 'get', url, true)
  xhr.onerror = onError

  xhr.onload = () => {
    if (xhr.status == 200) {
      onResult({
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
      onError(status)
    }
  }
  xhr.send()

  return () => xhr.abort()
}
