import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import Meetings from './src/pages/Meetings.jsx'

try {
  const html = renderToStaticMarkup(
    React.createElement(MemoryRouter, { initialEntries: ['/meetings'] },
      React.createElement(Meetings)
    )
  )
  console.log('SSR_RENDER_OK len=' + html.length)
  console.log(html.substring(0, 400))
} catch (e) {
  console.error('SSR_RENDER_THREW:')
  console.error((e && e.stack) || e)
  process.exit(2)
}
