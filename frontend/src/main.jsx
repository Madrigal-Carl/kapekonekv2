import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { IconContext } from 'react-icons'
import App from './app/App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Icons are decorative by default; icon-only buttons carry the aria-label. */}
    <IconContext.Provider value={{ attr: { 'aria-hidden': true, focusable: 'false' } }}>
      <App />
    </IconContext.Provider>
  </StrictMode>,
)
