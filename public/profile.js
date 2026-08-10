/**
 * Yuva Blood Forum - User Profile & Google Sign-In Script
 */

class ProfileApp {
  constructor() {
    this.currentUser = null;
    this.googleClientId = '';

    this.init();
  }

  async init() {
    await this.fetchConfig();
    await this.checkUserStatus();
  }

  async fetchConfig() {
    try {
      const res = await fetch('/api/auth/config');
      const data = await res.json();
      if (data.googleClientId) {
        this.googleClientId = data.googleClientId;
        this.initGoogleSDK();
      }
    } catch (err) {
      console.error('Failed to fetch auth config:', err);
    }
  }

  initGoogleSDK() {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      google.accounts.id.initialize({
        client_id: this.googleClientId,
        callback: (response) => this.handleGoogleCallback(response)
      });

      const btnWrapper = document.getElementById('googleSignInBtn');
      if (btnWrapper) {
        google.accounts.id.renderButton(btnWrapper, {
          theme: 'outline',
          size: 'large',
          width: '280',
          text: 'signin_with'
        });
      }
    } else {
      setTimeout(() => this.initGoogleSDK(), 500);
    }
  }

  async handleGoogleCallback(response) {
    if (!response || !response.credential) return;

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });

      const data = await res.json();

      if (data.success) {
        this.currentUser = data.user;
        this.renderProfileView();
        this.showToast('Signed in with Google successfully!');
      } else {
        alert(data.error || 'Google Sign-In failed.');
      }
    } catch (err) {
      console.error('Google callback error:', err);
      alert('Authentication error with Google Sign-In.');
    }
  }

  demoGoogleLogin() {
    // Quick Demo Sign-In simulation for local testing
    const demoPayload = {
      sub: 'google-1092837465',
      email: 'demo.donor@gmail.com',
      name: 'Demo Donor (Google)',
      picture: 'https://ui-avatars.com/api/?name=Demo+Donor&background=dc2626&color=fff'
    };

    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify(demoPayload));
    const token = `${header}.${payload}.signature`;

    this.handleGoogleCallback({ credential: token });
  }

  async checkUserStatus() {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();

      if (data.loggedIn && data.user) {
        this.currentUser = data.user;
        this.renderProfileView();
      } else {
        this.currentUser = null;
        this.renderAuthView();
      }
    } catch (err) {
      console.error('Failed to check user status:', err);
      this.renderAuthView();
    }
  }

  switchAuthTab(tabName) {
    const btnGoogle = document.getElementById('btnGoogleTab');
    const btnRegister = document.getElementById('btnRegisterTab');
    const btnLogin = document.getElementById('btnLoginTab');

    const tabGoogle = document.getElementById('tabGoogle');
    const tabRegister = document.getElementById('tabRegister');
    const tabLogin = document.getElementById('tabLogin');

    [btnGoogle, btnRegister, btnLogin].forEach(b => b?.classList.remove('active'));
    [tabGoogle, tabRegister, tabLogin].forEach(t => t?.classList.add('hidden'));

    if (tabName === 'google') {
      btnGoogle?.classList.add('active');
      tabGoogle?.classList.remove('hidden');
    } else if (tabName === 'register') {
      btnRegister?.classList.add('active');
      tabRegister?.classList.remove('hidden');
    } else {
      btnLogin?.classList.add('active');
      tabLogin?.classList.remove('hidden');
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const phone = document.getElementById('regPhone').value;
    const bloodGroup = document.getElementById('regBloodGroup').value;
    const zone = document.getElementById('regZone').value;
    const forona = document.getElementById('regForona').value;
    const age = document.getElementById('regAge').value;
    const errorEl = document.getElementById('regError');
    const submitBtn = document.getElementById('regSubmitBtn');

    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering...';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, password, phone, bloodGroup, zone, forona, age
        })
      });

      const data = await res.json();

      if (data.success) {
        this.currentUser = data.user;
        this.renderProfileView();
        this.showToast('Registration complete! Welcome!');
      } else {
        errorEl.textContent = data.error || 'Registration failed.';
        errorEl.classList.remove('hidden');
      }
    } catch (err) {
      errorEl.textContent = 'Server connection error.';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Complete Registration';
    }
  }

  async handleEmailLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const submitBtn = document.getElementById('loginSubmitBtn');

    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating...';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (data.success) {
        this.currentUser = data.user;
        this.renderProfileView();
        this.showToast('Logged in successfully!');
      } else {
        errorEl.textContent = data.error || 'Invalid credentials.';
        errorEl.classList.remove('hidden');
      }
    } catch (err) {
      errorEl.textContent = 'Server connection error.';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  }

  renderAuthView() {
    document.getElementById('authContainer')?.classList.remove('hidden');
    document.getElementById('profileContainer')?.classList.add('hidden');
  }

  renderProfileView() {
    const user = this.currentUser;
    if (!user) return;

    document.getElementById('authContainer')?.classList.add('hidden');
    document.getElementById('profileContainer')?.classList.remove('hidden');

    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const avatarEl = document.getElementById('userAvatar');
    const statusBadgeEl = document.getElementById('userStatusBadge');

    if (nameEl) nameEl.textContent = user.name || 'Donor User';
    if (emailEl) emailEl.textContent = user.email || '';
    if (avatarEl) {
      avatarEl.src = user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=dc2626&color=fff`;
    }

    // Populate Fields
    document.getElementById('profileName').value = user.name || '';
    document.getElementById('profilePhone').value = user.phone || '';
    document.getElementById('profileBloodGroup').value = user.bloodGroup || 'O+';
    document.getElementById('profileZone').value = user.zone || 'Changanacherry Zone';
    document.getElementById('profileForona').value = user.forona || '';
    document.getElementById('profileAge').value = user.age || '';

    // Donation Date
    const lastDateInput = document.getElementById('profileLastDonationDate');
    const coolingInfoEl = document.getElementById('coolingPeriodInfo');

    if (user.lastDonationDate) {
      lastDateInput.value = user.lastDonationDate;
      this.calculateCoolingPeriod(user.lastDonationDate, statusBadgeEl, coolingInfoEl);
    } else {
      lastDateInput.value = '';
      if (statusBadgeEl) {
        statusBadgeEl.className = 'profile-status-badge status-active';
        statusBadgeEl.textContent = '🟢 Active Donor (Eligible)';
      }
      if (coolingInfoEl) coolingInfoEl.classList.add('hidden');
    }
  }

  calculateCoolingPeriod(donationDateStr, badgeEl, infoEl) {
    const donationDate = new Date(donationDateStr);
    const now = new Date();
    const diffDays = Math.floor((now - donationDate) / (1000 * 60 * 60 * 24));
    const remainingDays = 90 - diffDays;

    if (diffDays < 90 && remainingDays > 0) {
      if (badgeEl) {
        badgeEl.className = 'profile-status-badge status-cooling';
        badgeEl.textContent = `🟡 In Cooling Period (${remainingDays} Days Left)`;
      }
      if (infoEl) {
        infoEl.innerHTML = `
          <strong>🩸 Cooling Period Active:</strong> You donated on ${donationDateStr} (${diffDays} days ago). 
          You will be eligible to donate again in <strong>${remainingDays} days</strong>.
        `;
        infoEl.classList.remove('hidden');
      }
    } else {
      if (badgeEl) {
        badgeEl.className = 'profile-status-badge status-active';
        badgeEl.textContent = '🟢 Active Donor (Eligible)';
      }
      if (infoEl) {
        infoEl.innerHTML = `
          <strong>✅ Eligible to Donate:</strong> Your last recorded donation was on ${donationDateStr} (${diffDays} days ago). Thank you for being a blood donor!
        `;
        infoEl.classList.remove('hidden');
      }
    }
  }

  async updateDonationDate(e) {
    e.preventDefault();
    const dateVal = document.getElementById('profileLastDonationDate').value;
    const saveBtn = document.getElementById('saveDonationBtn');

    if (!dateVal) return;

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastDonationDate: dateVal })
      });

      const data = await res.json();

      if (data.success) {
        this.currentUser = data.user;
        this.renderProfileView();
        this.showToast('Last donation date saved!');
      } else {
        alert(data.error || 'Failed to update donation date.');
      }
    } catch (err) {
      alert('Error updating donation date.');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Donation Date';
    }
  }

  async updateProfileDetails(e) {
    e.preventDefault();
    const name = document.getElementById('profileName').value;
    const phone = document.getElementById('profilePhone').value;
    const bloodGroup = document.getElementById('profileBloodGroup').value;
    const zone = document.getElementById('profileZone').value;
    const forona = document.getElementById('profileForona').value;
    const age = document.getElementById('profileAge').value;
    const alertEl = document.getElementById('profileAlert');
    const saveBtn = document.getElementById('saveProfileBtn');

    alertEl.classList.add('hidden');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving & Syncing...';

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, phone, bloodGroup, zone, forona, age
        })
      });

      const data = await res.json();

      if (data.success) {
        this.currentUser = data.user;
        this.renderProfileView();
        alertEl.className = 'alert alert-success';
        alertEl.textContent = 'Profile details updated and synced to public blood donor directory!';
        alertEl.classList.remove('hidden');
        this.showToast('Profile updated & synced to search directory!');
      } else {
        alertEl.className = 'alert alert-danger';
        alertEl.textContent = data.error || 'Failed to update profile.';
        alertEl.classList.remove('hidden');
      }
    } catch (err) {
      alertEl.className = 'alert alert-danger';
      alertEl.textContent = 'Server error during profile update.';
      alertEl.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Update Profile & Sync to Donor Directory';
    }
  }

  async logoutUser() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      this.currentUser = null;
      this.renderAuthView();
      this.showToast('Signed out successfully');
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✨ ${this.escapeHtml(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  escapeHtml(str) {
    if (typeof str !== 'string') return str;
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.profileApp = new ProfileApp();
});
