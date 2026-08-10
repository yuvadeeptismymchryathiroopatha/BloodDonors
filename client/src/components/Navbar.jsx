import React, { useContext, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Droplet, HeartHandshake, Search, AlertCircle, Shield, Settings, LogOut, Menu, X } from 'lucide-react';

export default function Navbar() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(11, 15, 25, 0.85)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)',
      padding: '12px 24px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand Logo */}
        <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px' }} id="nav-logo">
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #e11d48 0%, #9f1239 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(225, 29, 72, 0.5)'
          }}>
            <Droplet size={24} color="#ffffff" fill="#ffffff" />
          </div>
          <div>
            <span style={{ fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.03em' }}>
              Blood<span style={{ color: 'var(--primary)' }}>Life</span>
            </span>
            <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
              Donor Network
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }} className="desktop-nav">
          <Link
            to="/"
            id="nav-link-home"
            className={`btn ${isActive('/') ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.88rem' }}
          >
            Home
          </Link>

          <Link
            to="/donors"
            id="nav-link-donors"
            className={`btn ${isActive('/donors') ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.88rem' }}
          >
            <Search size={16} /> Find Donors
          </Link>

          <Link
            to="/register"
            id="nav-link-register"
            className={`btn ${isActive('/register') ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.88rem' }}
          >
            <HeartHandshake size={16} /> Become Donor
          </Link>

          <Link
            to="/request"
            id="nav-link-request"
            className={`btn ${isActive('/request') ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.88rem' }}
          >
            <AlertCircle size={16} /> Request Blood
          </Link>

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '12px', borderLeft: '1px solid var(--border)', paddingLeft: '16px' }}>
              <Link
                to="/admin/dashboard"
                id="nav-link-admin-dashboard"
                className={`btn ${isActive('/admin/dashboard') ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem' }}
              >
                <Shield size={15} /> Admin Dashboard
              </Link>
              <Link
                to="/admin/settings"
                id="nav-link-admin-settings"
                title="Admin Account Settings (Change Username/Password)"
                className={`btn ${isActive('/admin/settings') ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.85rem' }}
              >
                <Settings size={15} /> Settings
              </Link>
              <button
                onClick={handleLogout}
                id="btn-logout"
                className="btn btn-outline-danger"
                style={{ fontSize: '0.85rem' }}
              >
                <LogOut size={15} /> Logout ({user.username})
              </button>
            </div>
          ) : (
            <Link
              to="/admin/login"
              id="nav-link-admin-login"
              className={`btn ${isActive('/admin/login') ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.88rem', marginLeft: '8px' }}
            >
              <Shield size={16} /> Admin Portal
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
