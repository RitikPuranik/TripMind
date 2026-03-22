import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const defaultPrefs = {
  budget_level: 'mid-range',
  dietary: 'no restrictions',
  interests: [],
  trip_purpose: 'leisure',
  language: 'en',
  notification_freq: 'normal',
  travel_mode: 'leisure',
  home_city: '',
  liked_types: [],
  disliked_types: [],
  feedback_count: 0,
}

export const useStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null, preferences: defaultPrefs }),

      coords: null,
      locationName: '',
      setLocation: (coords, name) => set({ coords, locationName: name }),

      weather: null,
      setWeather: (weather) => set({ weather }),

      calEvents: [],
      setCalEvents: (calEvents) => set({ calEvents }),

      trips: [],
      setTrips: (trips) => set({ trips }),
      addTrip: (trip) => set(s => ({ trips: [trip, ...s.trips] })),
      activeTrip: null,
      setActiveTrip: (activeTrip) => set({ activeTrip }),

      suggestions: [],
      setSuggestions: (suggestions) => set({ suggestions }),
      suggestionsLoading: false,
      setSuggestionsLoading: (suggestionsLoading) => set({ suggestionsLoading }),

      alerts: [],
      setAlerts: (alerts) => set({ alerts }),
      markAlertRead: (id) => set(s => ({
        alerts: s.alerts.map(a => a.id === id ? { ...a, read: true } : a),
      })),

      preferences: defaultPrefs,
      setPreferences: (preferences) => set({ preferences }),

      thumbsLog: [],
      addThumb: (entry) => set(s => ({ thumbsLog: [...s.thumbsLog, entry].slice(-50) })),

      budgetSpent: 0,
      setBudgetSpent: (budgetSpent) => set({ budgetSpent }),

      chatHistory: [],
      addChatMsg: (msg) => set(s => ({ chatHistory: [...s.chatHistory, msg].slice(-100) })),
      clearChat: () => set({ chatHistory: [] }),

      voiceOpen: false,
      setVoiceOpen: (voiceOpen) => set({ voiceOpen }),
    }),
    {
      name: 'tripmind-store',
      partialize: (s) => ({
        token: s.token,
        user: s.user,
        preferences: s.preferences,
        thumbsLog: s.thumbsLog,
        locationName: s.locationName,
        chatHistory: s.chatHistory,
      }),
    }
  )
)
