import { NavLink } from 'react-router-dom'
import './Navbar.css'

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <img src="/fa-logo.jpg" alt="FA Logo" style={{ width: '44px', height: '44px', borderRadius: '4px', objectFit: 'contain' }} className="brand-icon" />
        <span className="brand-name">FA Music</span>
      </div>
      <div className="navbar-links">
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>📊</span> Dashboard
        </NavLink>
        <NavLink to="/students" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>👥</span> Students
        </NavLink>
        <NavLink to="/teachers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>🎓</span> Teachers
        </NavLink>
        <NavLink to="/schedule" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>📅</span> Schedule
        </NavLink>
        <NavLink to="/export" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>📷</span> Export
        </NavLink>
        <NavLink to="/database" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span>🗄️</span> Database
        </NavLink>
      </div>
    </nav>
  )
}
