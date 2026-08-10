import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import { User, Lock, KeyRound, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function AdminSettings() {
  const { user, updateCredentials } = useContext(AuthContext);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPassword) {
      setErrorMsg('Please enter your current password to verify identity.');
      return;
    }

    if (!newUsername.trim() && !newPassword.trim()) {
      setErrorMsg('Please provide a new Username or a new Password to update.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      const result = await updateCredentials(
        currentPassword,
        newUsername.trim() || undefined,
        newPassword.trim() || undefined
      );

      setSuccessMsg(result.message || 'Admin credentials updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNewUsername('');
    } catch (err) {
      console.error('Failed to update credentials:', err);
      const apiError = err.response?.data?.error || 'Failed to update credentials. Please check your current password.';
      setErrorMsg(apiError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '40px auto', padding: '0 20px' }}>
      <div className="glass-card" style={{ padding: '36px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--primary-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border-active)'
          }}>
            <ShieldCheck size={28} color="var(--primary)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.8rem' }}>Admin Profile Settings</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Update your Admin Username and Password credentials securely.
            </p>
          </div>
        </div>

        {/* User Badge Info */}
        <div style={{
          background: 'rgba(17, 24, 39, 0.8)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          padding: '16px',
          marginBottom: '28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Admin Account</span>
            <div style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <User size={18} color="var(--primary)" /> {user?.username}
            </div>
          </div>
          <span className="badge badge-blood">Role: {user?.role || 'Admin'}</span>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            color: '#f87171',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.95rem'
          }}>
            <AlertTriangle size={20} /> {errorMsg}
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            color: '#34d399',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '0.95rem'
          }}>
            <CheckCircle size={20} /> {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Current Password Verification */}
          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" htmlFor="current-password-input">
              Current Password <span style={{ color: 'var(--primary)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="current-password-input"
                type="password"
                className="form-input"
                placeholder="Enter current password to authorize changes"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                style={{ paddingLeft: '42px' }}
              />
              <KeyRound size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Required for security validation before saving changes.
            </span>
          </div>

          <div style={{ borderTop: '1px dashed var(--border)', margin: '24px 0' }}></div>

          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-primary)' }}>New Credentials</h3>

          {/* New Username */}
          <div className="form-group">
            <label className="form-label" htmlFor="new-username-input">New Username (Optional)</label>
            <div style={{ position: 'relative' }}>
              <input
                id="new-username-input"
                type="text"
                className="form-input"
                placeholder={`Leave blank to keep "${user?.username}"`}
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                style={{ paddingLeft: '42px' }}
              />
              <User size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          {/* New Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="new-password-input">New Password (Optional)</label>
            <div style={{ position: 'relative' }}>
              <input
                id="new-password-input"
                type="password"
                className="form-input"
                placeholder="Enter new password (min. 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ paddingLeft: '42px' }}
              />
              <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          {/* Confirm New Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="confirm-password-input">Confirm New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="confirm-password-input"
                type="password"
                className="form-input"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{ paddingLeft: '42px' }}
              />
              <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
          </div>

          <button
            type="submit"
            id="btn-update-credentials"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', marginTop: '12px', padding: '14px', fontSize: '1rem' }}
          >
            {loading ? 'Updating Credentials...' : 'Save New Credentials'}
          </button>
        </form>
      </div>
    </div>
  );
}
