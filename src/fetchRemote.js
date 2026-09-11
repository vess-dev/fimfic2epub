/* global chrome */

import fetch from './fetch'
import isNode from 'detect-node'

// Inside the web extension, cross-origin requests are made by the background
// script (which holds the host permissions) and the bytes are passed back to
// the content script as base64, since extension messages must be JSON.
const hasExtensionRuntime = !isNode && typeof chrome !== 'undefined' && !!(chrome.runtime && chrome.runtime.id)

function base64ToBytes (base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function fetchViaBackground (url, responseType) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'fetch', url }, (reply) => {
      if (chrome.runtime.lastError) {
        reject(new Error('Error fetching ' + url + ' (' + chrome.runtime.lastError.message + ')'))
        return
      }
      if (!reply || typeof reply !== 'object') {
        reject(new Error('Error fetching ' + url + ' (no reply from the background script)'))
        return
      }
      if (!reply.ok) {
        reject(new Error('Error fetching ' + url + ' (' + (reply.error || 'unknown error') + ')'))
        return
      }
      const bytes = base64ToBytes(reply.data || '')
      if (responseType === 'blob') {
        resolve(new Blob([bytes], { type: reply.type || '' }))
      } else if (responseType === 'arraybuffer') {
        resolve(bytes.buffer)
      } else {
        resolve(new TextDecoder('utf-8').decode(bytes))
      }
    })
  })
}

export default function fetchRemote (url, responseType) {
  if (url.startsWith('//')) {
    url = 'https:' + url
  }
  if (!hasExtensionRuntime) {
    return fetch(url, responseType)
  }
  if (url.startsWith('/')) {
    url = globalThis.location.origin + url
  }
  return fetchViaBackground(url, responseType)
}
