/* global chrome */
'use strict'

// Manifest V3 background script. Runs as a service worker in Chromium-based
// browsers and as a non-persistent event page in Firefox, so it must not rely
// on window, document, XMLHttpRequest, FileReader or URL.createObjectURL.

const ACCEPT = 'text/*, application/json, image/png, image/jpeg, image/gif, image/svg+xml'

function bytesToBase64 (bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

async function fetchResource (url) {
  const response = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    credentials: 'include',
    cache: 'default',
    headers: { accept: ACCEPT }
  })
  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' ' + response.statusText)
  }
  const buffer = await response.arrayBuffer()
  return {
    ok: true,
    type: response.headers.get('content-type') || '',
    data: bytesToBase64(new Uint8Array(buffer))
  }
}

function ignoreErrors (promise) {
  if (promise && typeof promise.catch === 'function') {
    promise.catch(() => {})
  }
}

function setActionEnabled (enabled, tabId) {
  try {
    ignoreErrors(enabled ? chrome.action.enable(tabId) : chrome.action.disable(tabId))
  } catch (err) {
    console.warn('fimfic2epub: unable to update the toolbar button', err)
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return false
  }
  if (message.type === 'fetch' && typeof message.url === 'string') {
    console.log('fimfic2epub: fetching', message.url)
    fetchResource(message.url).then(sendResponse, (err) => {
      console.warn('fimfic2epub: failed to fetch', message.url, err)
      sendResponse({ ok: false, error: err && err.message ? err.message : String(err) })
    })
    return true // keep the message channel open for the async response
  }
  if (message.type === 'showPageAction' && sender.tab && sender.tab.id !== undefined) {
    setActionEnabled(true, sender.tab.id)
  }
  return false
})

// The toolbar button is only enabled on story pages (the content script asks
// for it), mirroring the page action of the Manifest V2 version.
chrome.runtime.onInstalled.addListener(() => setActionEnabled(false))
chrome.runtime.onStartup.addListener(() => setActionEnabled(false))

chrome.action.onClicked.addListener((tab) => {
  if (!tab || tab.id === undefined) return
  chrome.tabs.sendMessage(tab.id, { type: 'pageAction' }, () => {
    if (chrome.runtime.lastError) {
      // no content script in this tab, nothing to do
    }
  })
})
