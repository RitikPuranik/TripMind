import { Routes, Route, Navigate } from 'react-router-dom'
import { useStore } from './store'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import AuthCallback from './pages/AuthCallback'
import HomePage from './pages/HomePage'
import TripsPage from './pages/TripsPage'
import ExplorePage from './pages/ExplorePage'
import ItineraryPage from './pages/ItineraryPage'
import ChatPage from './pages/ChatPage'
import AnalyticsPage from './pages/AnalyticsPage'
import SettingsPage from './pages/SettingsPage'

function PrivateRoute({ children }) {
  const token = useStore(s => s.token)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<HomePage />} />
        <Route path="trips" element={<TripsPage />} />
        <Route path="explore" element={<ExplorePage />} />
        <Route path="itinerary/:tripId?" element={<ItineraryPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}
