import axios from 'axios'
import { useStore } from '../store'

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
})

// Attach JWT token to every request
API.interceptors.request.use(config => {
  const token = useStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 — logout
API.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      useStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authAPI = {
  getLoginUrl: () => API.get('/api/auth/login').then(r => r.data.auth_url),
  getMe: () => API.get('/api/auth/me').then(r => r.data),
  logout: () => API.post('/api/auth/logout'),
}

// ── Gmail ─────────────────────────────────────────────────────────────────────
export const gmailAPI = {
  parseTrips: (days = 90) => API.get('/api/gmail/parse-trips', { params: { days_back: days } }).then(r => r.data),
  getBudgetEmails: () => API.get('/api/gmail/budget-emails').then(r => r.data),
  checkVisaPassport: () => API.get('/api/gmail/visa-passport').then(r => r.data),
}

// ── Calendar ──────────────────────────────────────────────────────────────────
export const calendarAPI = {
  getEvents: (days = 14) => API.get('/api/calendar/events', { params: { days_ahead: days } }).then(r => r.data),
  getToday: () => API.get('/api/calendar/today').then(r => r.data),
  getUpcomingTrips: () => API.get('/api/calendar/upcoming-trips').then(r => r.data),
}

// ── Suggestions ───────────────────────────────────────────────────────────────
export const suggestionsAPI = {
  get: (payload) => API.post('/api/suggestions/', payload).then(r => r.data),
  feedback: (id, vote) => API.post('/api/suggestions/feedback', null, { params: { suggestion_id: id, vote } }),
  etiquette: (city) => API.get(`/api/suggestions/etiquette/${city}`).then(r => r.data),
}

// ── Voice ─────────────────────────────────────────────────────────────────────
export const voiceAPI = {
  transcribe: (audioBlob, filename = 'audio.webm') => {
    const form = new FormData()
    form.append('audio', audioBlob, filename)
    return API.post('/api/voice/transcribe', form, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data)
  },
  query: (payload) => API.post('/api/voice/query', payload).then(r => r.data),
}

// ── Itinerary ─────────────────────────────────────────────────────────────────
export const itineraryAPI = {
  build: (params) => API.post('/api/itinerary/build', null, { params }).then(r => r.data),
  get: (tripId) => API.get(`/api/itinerary/${tripId}`).then(r => r.data),
  rebalance: (tripId, reason, delay) => API.post(`/api/itinerary/${tripId}/rebalance`, null, { params: { reason, delay_minutes: delay } }),
  getToday: (tripId) => API.get(`/api/itinerary/${tripId}/today`).then(r => r.data),
}

// ── Trips ─────────────────────────────────────────────────────────────────────
export const tripsAPI = {
  list: () => API.get('/api/trips/').then(r => r.data),
  create: (data) => API.post('/api/trips/', data).then(r => r.data),
  importFromGmail: (emails) => API.post('/api/trips/import-from-gmail', emails || [], { headers: { 'Content-Type': 'application/json' } }).then(r => r.data),
  get: (id) => API.get(`/api/trips/${id}`).then(r => r.data),
  addExpense: (id, amount, category, description) =>
    API.put(`/api/trips/${id}/expense`, null, { params: { amount, category, description } }),
  getActive: () => API.get('/api/trips/active/current').then(r => r.data),
}

// ── Alerts ────────────────────────────────────────────────────────────────────
export const alertsAPI = {
  list: () => API.get('/api/alerts/').then(r => r.data),
  markRead: (id) => API.post(`/api/alerts/${id}/read`),
  checkAll: (params) => API.post('/api/alerts/check-all', null, { params }),
}

// ── Preferences ───────────────────────────────────────────────────────────────
export const prefsAPI = {
  get: () => API.get('/api/preferences/').then(r => r.data),
  update: (data) => API.put('/api/preferences/', data).then(r => r.data),
  learnFromText: (text) => API.post('/api/preferences/learn-from-text', null, { params: { text } }).then(r => r.data),
  feedbackSignal: (type, vote) => API.post('/api/preferences/feedback-signal', null, { params: { suggestion_type: type, vote } }),
  getModes: () => API.get('/api/preferences/travel-modes').then(r => r.data),
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsAPI = {
  getTripAnalytics: (tripId) => API.get(`/api/analytics/trip/${tripId}`).then(r => r.data),
  getDashboard: () => API.get('/api/analytics/dashboard').then(r => r.data),
  getWeeklyDigest: () => API.get('/api/analytics/weekly-digest').then(r => r.data),
}

// ── Weather (direct to Open-Meteo, no key needed) ─────────────────────────────
export const weatherAPI = {
  get: async (lat, lng) => {
    const r = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: lat, longitude: lng,
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,weathercode,apparent_temperature',
        hourly: 'temperature_2m,precipitation_probability,weathercode',
        timezone: 'auto', forecast_days: 1,
      }
    })
    return r.data
  }
}

export default API
