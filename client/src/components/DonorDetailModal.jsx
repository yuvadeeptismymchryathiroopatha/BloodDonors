import React from 'react';
import { X, Phone, Mail, MapPin, Calendar, User, CheckCircle2, XCircle, Copy, Check } from 'lucide-react';

export default function DonorDetailModal({ donor, onClose }) {
  const [copied, setCopied] = React.useState(false);

  if (!donor) return null;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(donor.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }} onClick={onClose}>
      <div className="glass-card" style={{
        width: '100%',
        maxWidth: '540px',
        padding: '32px',
        position: 'relative',
        animation: 'fadeIn 0.25s ease-out'
      }} onClick={(e) => e.stopPropagation()}>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          id="btn-close-donor-modal"
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: 'none',
            color: 'var(--text-primary)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'var(--transition)'
          }}
        >
          <X size={20} />
        </button>

        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
            fontWeight: '800',
            color: 'white',
            boxShadow: '0 0 20px rgba(225, 29, 72, 0.4)'
          }}>
            {donor.blood_group}
          </div>

          <div>
            <h2 style={{ fontSize: '1.6rem', marginBottom: '4px' }}>{donor.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className={`badge ${donor.is_available ? 'badge-success' : 'badge-danger'}`}>
                {donor.is_available ? <><CheckCircle2 size={12} /> Available Now</> : <><XCircle size={12} /> Unavailable</>}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Age: {donor.age} | {donor.gender}</span>
            </div>
          </div>
        </div>

        {/* Detailed Information Grid */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.8)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
              <Phone size={18} color="var(--primary)" />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Phone Number</div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-primary)' }}>{donor.phone}</div>
              </div>
            </div>
            <button
              onClick={handleCopyPhone}
              className="btn btn-secondary btn-sm"
              style={{ marginLeft: 'auto' }}
              title="Copy Phone Number"
            >
              {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {donor.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
              <Mail size={18} color="var(--accent)" />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Email Address</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{donor.email}</div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
            <MapPin size={18} color="#f59e0b" />
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Location / Area</div>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                {donor.city} {donor.address ? `- ${donor.address}` : ''}
              </div>
            </div>
          </div>

          {donor.last_donation_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
              <Calendar size={18} color="#38bdf8" />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Last Donation Date</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {new Date(donor.last_donation_date).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Primary Call Action */}
        <a
          href={`tel:${donor.phone}`}
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '1.05rem', justifyContent: 'center' }}
        >
          <Phone size={18} /> Call Donor Directly ({donor.phone})
        </a>
      </div>
    </div>
  );
}
