import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PostHogProvider } from 'posthog-js/react'
import './index.css'
import App from './App.jsx'

const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const posthogOptions = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
  person_profiles: 'identified_only',
  capture_pageview: true,
  capture_pageleave: true,
  autocapture: true,
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      {POSTHOG_KEY ? (
        <PostHogProvider apiKey={POSTHOG_KEY} options={posthogOptions}>
          <App />
        </PostHogProvider>
      ) : (
        <App />
      )}
    </BrowserRouter>
  </StrictMode>,
)
