import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import StudentsPage from './pages/StudentsPage'
import TeachersPage from './pages/TeachersPage'
import HomePage from './pages/HomePage'
import SchedulePage from './pages/SchedulePage'
import ExportPage from './pages/ExportPage'
import DatabasePage from './pages/DatabasePage'
import LoginPage from './pages/LoginPage'
import './index.css'
import './App.css'

export default function App() {
  const isAuthenticated = !!localStorage.getItem('fa_music_token')

  return (
    <BrowserRouter>
      {isAuthenticated ? (
        <div className="app-shell">
          <Navbar />
          <div className="app-content">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/teachers" element={<TeachersPage />} />
              <Route path="/schedule" element={<SchedulePage />} />
              <Route path="/export" element={<ExportPage />} />
              <Route path="/database" element={<DatabasePage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  )
}
