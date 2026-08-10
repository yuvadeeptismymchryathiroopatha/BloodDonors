import React from 'react';
import { Droplet, Heart, PhoneCall, ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer style={{
      background: 'rgba(11, 15, 25, 0.95)',
      borderTop: '1px solid var(--border)',
      padding: '48px 24px 24px',
      marginTop: '80px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '40px',
        marginBottom: '40px'
      }}>
        {/* About */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Droplet size={22} color="var(--primary)" fill="var(--primary)" />
            <span style={{ fontSize: '1.3rem', fontWeight: '800' }}>BloodLife</span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: '1.6' }}>
            Connecting willing blood donors with patients in urgent medical need. Built with precision and care to save lives every single day.
          </p>
        </div>

        {/* Emergency Hotline */}
        <div>
          <h4 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-primary)' }}>Emergency Helpline</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--primary-light)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-active)' }}>
            <PhoneCall size={24} color="var(--primary)" />
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--primary)' }}>24/7 Toll Free Hotline</div>
              <div style={{ fontSize: '1.1rem', fontWeight: '700' }}>1-800-BLOOD-SAVE</div>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 style={{ fontSize: '1.1rem', marginBottom: '16px' }}>Quick Navigation</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            <li><a href="/" style={{ color: 'inherit', textDecoration: 'none' }}>Home</a></li>
            <li><a href="/donors" style={{ color: 'inherit', textDecoration: 'none' }}>Find Donors Directory</a></li>
            <li><a href="/register" style={{ color: 'inherit', textDecoration: 'none' }}>Register as a Donor</a></li>
            <li><a href="/request" style={{ color: 'inherit', textDecoration: 'none' }}>Emergency Blood Request</a></li>
            <li><a href="/admin/login" style={{ color: 'inherit', textDecoration: 'none' }}>Admin Portal</a></li>
          </ul>
        </div>
      </div>

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        paddingTop: '20px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '0.85rem',
        color: 'var(--text-muted)'
      }}>
        <div>&copy; {new Date().getFullYear()} BloodLife Donation System. All rights reserved.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Powered by Neon PostgreSQL & Express</span>
          <ShieldCheck size={16} color="var(--success)" />
        </div>
      </div>
    </footer>
  );
}
