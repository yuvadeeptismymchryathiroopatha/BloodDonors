import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import { AlertCircle, Hospital, Phone, User, CheckCircle2 } from 'lucide-react';

export default function RequestBlood() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    patientName: '',
    bloodGroup: 'O+',
    unitsNeeded: 1,
    hospitalName: '',
    city: '',
    contactName: '',
    contactPhone: '',
    urgency: 'Emergency',
    details: ''
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.patientName || !formData.hospitalName || !formData.city || !formData.contactName || !formData.contactPhone) {
      setErrorMsg('Please complete all required fields.');
      return;
    }

    try {
      setLoading(true);
      await API.post('/requests', formData);
      setSuccessMsg('Urgent blood request broadcasted successfully! Our admin team and available donors have been notified.');
      setTimeout(() => {
        navigate('/');
      }, 2500);
    } catch (err) {
      console.error('Failed to submit blood request:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to submit request. Please try again.');
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
            background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(239, 68, 68, 0.4)',
            marginBottom: '16px'
          }}>
            <AlertCircle size={32} color="#ffffff" />
          </div>
          <h1 style={{ fontSize: '2rem', marginBottom: '6px' }}>Request Emergency Blood</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Submit urgent patient blood requirements to get immediate help from donors and blood banks.
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
            
            {/* Patient Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="req-patient-name">Patient Name *</label>
              <input
                id="req-patient-name"
                name="patientName"
                type="text"
                className="form-input"
                placeholder="Patient's Full Name"
                value={formData.patientName}
                onChange={handleChange}
                required
              />
            </div>

            {/* Required Blood Group & Units */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="req-bloodgroup">Blood Group *</label>
                <select
                  id="req-bloodgroup"
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

              <div className="form-group">
                <label className="form-label" htmlFor="req-units">Units Needed *</label>
                <input
                  id="req-units"
                  name="unitsNeeded"
                  type="number"
                  min="1"
                  max="20"
                  className="form-input"
                  value={formData.unitsNeeded}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Hospital Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="req-hospital">Hospital Name *</label>
              <input
                id="req-hospital"
                name="hospitalName"
                type="text"
                className="form-input"
                placeholder="e.g. City General Hospital"
                value={formData.hospitalName}
                onChange={handleChange}
                required
              />
            </div>

            {/* City */}
            <div className="form-group">
              <label className="form-label" htmlFor="req-city">City / Area *</label>
              <input
                id="req-city"
                name="city"
                type="text"
                className="form-input"
                placeholder="Downtown"
                value={formData.city}
                onChange={handleChange}
                required
              />
            </div>

            {/* Contact Person Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="req-contact-name">Contact Person Name *</label>
              <input
                id="req-contact-name"
                name="contactName"
                type="text"
                className="form-input"
                placeholder="Relative / Attendant Name"
                value={formData.contactName}
                onChange={handleChange}
                required
              />
            </div>

            {/* Contact Phone */}
            <div className="form-group">
              <label className="form-label" htmlFor="req-contact-phone">Contact Phone *</label>
              <input
                id="req-contact-phone"
                name="contactPhone"
                type="tel"
                className="form-input"
                placeholder="+1 555-0999"
                value={formData.contactPhone}
                onChange={handleChange}
                required
              />
            </div>

          </div>

          {/* Urgency Level */}
          <div className="form-group">
            <label className="form-label" htmlFor="req-urgency">Urgency Priority *</label>
            <select
              id="req-urgency"
              name="urgency"
              className="form-select"
              value={formData.urgency}
              onChange={handleChange}
            >
              <option value="Emergency">CRITICAL EMERGENCY (Need immediately)</option>
              <option value="Normal">Normal (Scheduled within 24-48 hrs)</option>
            </select>
          </div>

          {/* Additional Medical Details / Notes */}
          <div className="form-group">
            <label className="form-label" htmlFor="req-details">Additional Details / Notes</label>
            <textarea
              id="req-details"
              name="details"
              rows="3"
              className="form-textarea"
              placeholder="Provide doctor notes, room number, or specific instructions..."
              value={formData.details}
              onChange={handleChange}
            ></textarea>
          </div>

          <button
            type="submit"
            id="btn-submit-blood-request"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '14px', marginTop: '16px', fontSize: '1.05rem', background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)' }}
          >
            {loading ? 'Submitting Request...' : 'Broadcast Emergency Blood Request'}
          </button>
        </form>
      </div>
    </div>
  );
}
