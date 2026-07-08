import React from 'react'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MemoryRouter } from 'react-router-dom'
import Meetings from './src/pages/Meetings.jsx'

const container = document.getElementById('root')
const root = createRoot(container)
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function run() {
  try {
    await act(async () => {
      root.render(
        React.createElement(MemoryRouter, { initialEntries: ['/meetings'] },
          React.createElement(Meetings))
      )
    })
    // flush effects + mock delay()
    await act(async () => { await sleep(300) })
    const html = container.innerHTML
    console.log('CLIENT_RENDER_OK len=' + html.length)
    console.log(html.substring(0, 800))
  } catch (e) {
    console.error('CLIENT_RENDER_THREW:')
    console.error((e && e.stack) || e)
    process.exit(2)
  }
}
run()
