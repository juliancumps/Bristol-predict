import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/BristolBayMap.css'
import './styles/DatePicker.css'
import './styles/DistrictStats.css'
import './styles/Charts.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
