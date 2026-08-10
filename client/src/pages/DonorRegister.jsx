import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import { HeartHandshake, User, Phone, Mail, MapPin, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

export default function DonorRegister() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: '',
    age: '',
    gender: 'Male',
    bloodGroup: 'A+',
    phone: '',
    email: '',
    city: '',
    address: '',
    lastDonationDate: '',
    isAvailable: true
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.name || !formData.age || !formData.phone || !formData.city) {
      setErrorMsg('Please fill in all required fields (Name, Age, Phone, City).');
      return;
    }

    try {
      setLoading(true);
      const res = await API.post('/donors', formData);
      setSuccessMsg('Thank you for registering! Your donor profile is now active.');
      setTimeout(() => {
        navigate('/donors');
      }, 2000);
    } catch (err) {
      console.error('Registration failed:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to register donor. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '40px auto', padding: '0 20px' }}>
      <div className="glass-card" style={{ padding: '36px' }}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(225, 29, 72, 0.4)',
            marginBottom: '16px'
          }}>
            <HeartHandshake size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '2rem', marginBottom: '6px' }}>Become a Blood Donor</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Register your details so patients in urgent need can reach out to you.
          </p>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <AlertCircle size={20} /> {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#34d399',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <CheckCircle2 size={20} /> {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            
            {/* Full Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="donor-name">Full Name *</label>
              <input
                id="donor-name"
                name="name"
                type="text"
                className="form-input"
                placeholder="John Doe"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            {/* Age & Gender */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="donor-age">Age *</label>
                <input
                  id="donor-age"
                  name="age"
                  type="number"
                  min="18"
                  max="65"
                  className="form-input"
                  placeholder="25"
                  value={formData.age}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="donor-gender">Gender *</label>
                <select
                  id="donor-gender"
                  name="gender"
                  className="form-select"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            {/* Blood Group */}
            <div className="form-group">
              <label className="form-label" htmlFor="donor-bloodgroup">Blood Group *</label>
              <select
                id="donor-bloodgroup"
                name="bloodGroup"
                className="form-select"
                value={formData.bloodGroup}
                onChange={handleChange}
              >
                {bloodGroups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>

            {/* Phone */}
            <div className="form-group">
              <label className="form-label" htmlFor="donor-phone">Phone Number *</label>
              <input
                id="donor-phone"
                name="phone"
                type="tel"
                className="form-input"
                placeholder="+1 555-0199"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>

            {/* Email */}
            <div className="form-group">
              <label className="form-label" htmlFor="donor-email">Email Address</label>
              <input
                id="donor-email"
                name="email"
                type="email"
                className="form-input"
                placeholder="john@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            {/* City */}
            <div className="form-group">
              <label className="form-label" htmlFor="donor-city">City / Area *</label>
              <input
                id="donor-city"
                name="city"
                type="text"
                className="form-input"
                placeholder="Downtown"
                value={formData.city}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          {/* Address */}
          <div className="form-group">
            <label className="form-label" htmlFor="donor-address">Full Address</label>
            <input
              id="donor-address"
              name="address"
              type="text"
              className="form-input"
              placeholder="123 Main Street"
              value={formData.address}
              onChange={handleChange}
            />
          </div>

          {/* Last Donation Date & Available Switch */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', alignItems: 'center' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="donor-lastdate">Last Donation Date (if any)</label>
              <input
                id="donor-lastdate"
                name="lastDonationDate"
                type="date"
                className="form-input"
                value={formData.lastDonationDate}
                onChange={handleChange}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '12px' }}>
                <input
                  id="donor-isavailable"
                  name="isAvailable"
                  type="checkbox"
                  checked={formData.isAvailable}
                  onChange={handleChange}
                  style={{ width: '20px', height: '20px', accentColor: 'var(--primary)' }}
                />
                <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Available for Immediate Donation</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            id="btn-submit-donor-register"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '14px', marginTop: '24px', fontSize: '1rem' }}
          >
            {loading ? 'Submitting Registration...' : 'Complete Donor Registration'}
          </button>
        </form>
      </div>
    </div>
  );
}
