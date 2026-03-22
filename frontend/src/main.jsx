import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            fontFamily: 'DM Sans, sans-serif',
            fontSize: '13px',
            background: '#1A1A18',
            color: '#FAFAF7',
            borderRadius: '12px',
            padding: '12px 16px',
          },
          success: { iconTheme: { primary: '#8FA68A', secondary: '#FAFAF7' } },
          error:   { iconTheme: { primary: '#D4907A', secondary: '#FAFAF7' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
)
