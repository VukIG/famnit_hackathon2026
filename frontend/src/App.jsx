import { useState } from 'react'
import { Dashboard } from './Dashboard'
import Satelite from './Satelite'

// Remove default browser spacing but keep page scroll enabled for stacked sections.
if (typeof document !== 'undefined') {
  document.documentElement.style.margin = '0'
  document.documentElement.style.padding = '0'
  document.body.style.margin = '0'
  document.body.style.padding = '0'
}

function App() {
  
  return (
    <div style={{
        padding: 0, margin:0, width:'100%', minHeight:'100vh'
      }}>
      <Dashboard />
      <Satelite />
    </div>
  )
}

export default App