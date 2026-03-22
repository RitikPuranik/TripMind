import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '../store'
import { weatherAPI, alertsAPI, tripsAPI, gmailAPI } from '../services/api'
import toast from 'react-hot-toast'

// Rule: always select ONE primitive or stable ref at a time from useStore.
// Never do: const { a, b } = useStore() — this creates a new object every render.

export function useLocation() {
  const coords      = useStore(s => s.coords)
  const locationName = useStore(s => s.locationName)
  const setLocation  = useStore(s => s.setLocation)
  const hasFetched   = useRef(false)

  useEffect(() => {
    if (hasFetched.current || coords) return
    hasFetched.current = true
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
          const d = await r.json()
          const name = d.address?.city || d.address?.town || d.address?.suburb || 'Your location'
          setLocation({ lat, lng }, name)
        } catch {
          setLocation({ lat, lng }, 'Your location')
        }
      },
      () => setLocation({ lat: 23.2599, lng: 77.4126 }, 'Bhopal, MP'),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { coords, locationName }
}

export function useWeather() {
  const coordsLat  = useStore(s => s.coords?.lat)
  const coordsLng  = useStore(s => s.coords?.lng)
  const weather    = useStore(s => s.weather)
  const setWeather = useStore(s => s.setWeather)
  const [loading, setLoading] = useState(false)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (!coordsLat || hasFetched.current) return
    hasFetched.current = true
    setLoading(true)
    weatherAPI.get(coordsLat, coordsLng)
      .then(setWeather)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [coordsLat, coordsLng]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!coordsLat) return
    const id = setInterval(() => {
      weatherAPI.get(coordsLat, coordsLng).then(setWeather).catch(() => {})
    }, 15 * 60 * 1000)
    return () => clearInterval(id)
  }, [coordsLat, coordsLng]) // eslint-disable-line react-hooks/exhaustive-deps

  return { weather, loading }
}

export function useCalendar() {
  const token        = useStore(s => s.token)
  const calEvents    = useStore(s => s.calEvents)
  const setCalEvents = useStore(s => s.setCalEvents)
  const [loading, setLoading]     = useState(false)
  const [freeSlots, setFreeSlots] = useState([])
  const hasFetched = useRef(false)

  const refresh = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await calendarAPI.getToday()
      setCalEvents(data.events || [])
      setFreeSlots(data.free_slots || [])
    } catch {}
    setLoading(false)
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    refresh()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return { calEvents, freeSlots, loading, refresh }
}

export function useAlerts() {
  const token         = useStore(s => s.token)
  const alerts        = useStore(s => s.alerts)
  const setAlerts     = useStore(s => s.setAlerts)
  const markAlertRead = useStore(s => s.markAlertRead)
  const coordsLat     = useStore(s => s.coords?.lat)
  const coordsLng     = useStore(s => s.coords?.lng)
  const hasFetched    = useRef(false)

  const fetchAlerts = useCallback(async () => {
    if (!token) return
    try { setAlerts(await alertsAPI.list()) } catch {}
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const checkTriggers = useCallback(async () => {
    if (!token || !coordsLat) return
    try {
      await alertsAPI.checkAll({ lat: coordsLat, lng: coordsLng })
      fetchAlerts()
    } catch {}
  }, [token, coordsLat]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    fetchAlerts()
    checkTriggers()
    const id = setInterval(checkTriggers, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return { alerts, unreadCount: alerts.filter(a => !a.read).length, markAlertRead, refresh: fetchAlerts }
}

export function useVoice() {
  const [phase,        setPhase]        = useState('idle')
  const [transcript,   setTranscript]   = useState('')
  const [detectedLang, setDetectedLang] = useState('en')
  const [response,     setResponse]     = useState(null)
  const mediaRecorderRef = useRef(null)
  const recognitionRef   = useRef(null)
  const chunksRef        = useRef([])

  const startBrowserSTT = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setPhase('idle'); toast.error('Voice not supported. Please type.'); return }
    const rec = new SR()
    rec.continuous = false
    rec.interimResults = true
    recognitionRef.current = rec
    rec.onresult = e => setTranscript(Array.from(e.results).map(r => r[0].transcript).join(' '))
    rec.onend = () => setPhase('processing')
    rec.onerror = () => setPhase('idle')
    rec.start()
    setPhase('listening')
  }, [])

  const startListening = useCallback(async () => {
    setTranscript(''); setResponse(null); setPhase('listening')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      chunksRef.current = []
      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setPhase('processing')
        try {
          const { voiceAPI } = await import('../services/api')
          const res = await voiceAPI.transcribe(new Blob(chunksRef.current, { type: 'audio/webm' }))
          setTranscript(res.transcript || '')
          setDetectedLang(res.detected_language || 'en')
        } catch { startBrowserSTT() }
      }
      mediaRecorderRef.current = recorder
      recorder.start()
    } catch { startBrowserSTT() }
  }, [startBrowserSTT])

  const stopListening  = useCallback(() => mediaRecorderRef.current?.stop(), [])

  const processQuery = useCallback(async (text, context) => {
    if (!text?.trim()) return
    setPhase('processing')
    try {
      const { voiceAPI } = await import('../services/api')
      setResponse(await voiceAPI.query({ transcript: text, detected_language: detectedLang, context }))
    } catch {
      setResponse({ reply: 'Could not process that. Please try again.', reply_language: 'en' })
    }
    setPhase('done')
  }, [detectedLang])

  return { phase, transcript, detectedLang, response, startListening, stopListening, processQuery, setPhase, setTranscript }
}

export function useTrips() {
  const token         = useStore(s => s.token)
  const trips         = useStore(s => s.trips)
  const setTrips      = useStore(s => s.setTrips)
  const setActiveTrip = useStore(s => s.setActiveTrip)
  const [loading, setLoading] = useState(false)
  const hasFetched = useRef(false)

  const loadTrips = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const data = await tripsAPI.list()
      setTrips(data.trips || [])
      const active = await tripsAPI.getActive()
      if (active.active) setActiveTrip(active.trip)
    } catch {}
    setLoading(false)
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  const importFromGmail = useCallback(async () => {
    setLoading(true)
    try {
      const emails = await gmailAPI.parseTrips(90)
      const result = await tripsAPI.importFromGmail(emails)
      toast.success(`Imported ${result.imported} trips from Gmail`)
      loadTrips()
      return result
    } catch { toast.error('Gmail sync failed. Is the backend running?') }
    setLoading(false)
  }, [loadTrips])

  useEffect(() => {
    if (hasFetched.current) return
    hasFetched.current = true
    loadTrips()
  }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  return { trips, loading, loadTrips, importFromGmail }
}