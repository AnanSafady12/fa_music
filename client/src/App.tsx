import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import StudentsPage from './pages/StudentsPage'
import TeachersPage from './pages/TeachersPage'
import HomePage from './pages/HomePage'
import SchedulePage from './pages/SchedulePage'
import ExportPage from './pages/ExportPage'
import DatabasePage from './pages/DatabasePage'
import './index.css'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
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
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  )
}
