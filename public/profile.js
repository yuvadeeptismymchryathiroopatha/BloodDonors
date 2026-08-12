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
    this.setupDobDateLimits();
    await this.fetchConfig();
    await this.checkUserStatus();
  }

  setupDobDateLimits() {
    const today = new Date();
    const maxDob = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()).toISOString().split('T')[0];
    const minDob = new Date(today.getFullYear() - 55, today.getMonth(), today.getDate()).toISOString().split('T')[0];

    const regDobEl = document.getElementById('regDob');
    if (regDobEl) {
      regDobEl.max = maxDob;
      regDobEl.min = minDob;
    }

    const profileDobEl = document.getElementById('profileDob');
    if (profileDobEl) {
      profileDobEl.max = maxDob;
      profileDobEl.min = minDob;
    }
  }

  async fetchConfig() {
    try {
      const res = await fetch('/api/auth/config');
      const data = await res.json();
      if (data.googleClientId) {
        this.googleClientId = data.googleClientId;
      }
      this.initGoogleSDK();
    } catch (err) {
      console.error('Failed to fetch auth config:', err);
      this.initGoogleSDK();
    }
  }

  initGoogleSDK() {
    const btnWrapper = document.getElementById('googleSignInBtn');

    if (!this.googleClientId) {
      this.googleClientId = '788181288036-3q8gb7vubkp0raidlqkngd8j3l8aetcv.apps.googleusercontent.com';
    }

    const renderGoogleBtn = () => {
      if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
        try {
          google.accounts.id.initialize({
            client_id: this.googleClientId,
            callback: (response) => this.handleGoogleCallback(response),
            auto_select: false
          });

          if (btnWrapper) {
            btnWrapper.innerHTML = '';
            google.accounts.id.renderButton(btnWrapper, {
              theme: 'outline',
              size: 'large',
              width: '100%',
              text: 'signin_with',
              shape: 'rectangular',
              logo_alignment: 'left'
            });
          }
        } catch (e) {
          console.warn('Google SDK init error:', e);
        }
      }
    };

    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      renderGoogleBtn();
    } else {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
          clearInterval(interval);
          renderGoogleBtn();
        } else if (attempts > 20) {
          clearInterval(interval);
        }
      }, 200);
    }
  }

  promptGoogleEmailLogin() {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      try {
        google.accounts.id.initialize({
          client_id: this.googleClientId || '788181288036-3q8gb7vubkp0raidlqkngd8j3l8aetcv.apps.googleusercontent.com',
          callback: (response) => this.handleGoogleCallback(response)
        });
        google.accounts.id.prompt();
        return;
      } catch (e) {
        console.warn('Google One Tap prompt failed:', e);
      }
    }
    alert('Loading Google Sign-In... Please ensure your network allows connecting to Google services.');
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

  toggleRegistrationForm() {
    const regTab = document.getElementById('tabRegister');
    const toggleBtn = document.getElementById('toggleRegBtn');
    if (!regTab) return;

    if (regTab.classList.contains('hidden')) {
      regTab.classList.remove('hidden');
      if (toggleBtn) toggleBtn.textContent = '❌ Close Registration Form';
      regTab.scrollIntoView({ behavior: 'smooth' });
    } else {
      regTab.classList.add('hidden');
      if (toggleBtn) toggleBtn.textContent = '✍️ Create New Donor Profile';
    }
  }

  toggleEditProfileForm() {
    const editBox = document.getElementById('profileEditBox');
    const toggleBtn = document.getElementById('toggleEditProfileBtn');
    if (!editBox) return;

    if (editBox.classList.contains('hidden')) {
      editBox.classList.remove('hidden');
      if (toggleBtn) toggleBtn.textContent = '❌ Close Edit Form';
      editBox.scrollIntoView({ behavior: 'smooth' });
    } else {
      editBox.classList.add('hidden');
      if (toggleBtn) toggleBtn.textContent = '✏️ Edit Profile Information';
    }
  }

  getZoneFromForane(forane) {
    if (!forane) return 'Changanacherry Zone';
    const f = forane.trim().toLowerCase();
    if (['kottayam', 'kudamaloor', 'athirampuzha', 'manimala', 'nedumkunnam'].includes(f)) return 'Kottayam Zone';
    if (['changanacherry', 'thuruthy', 'thrickodithanam', 'thrikodithanam', 'kurumpanadom'].includes(f)) return 'Changanacherry Zone';
    if (['alappuzha', 'muhamma'].includes(f)) return 'Alappuzha Zone';
    if (['edathua', 'pulinkunnoo', 'champakulam'].includes(f)) return 'Kuttanad Zone';
    if (['kollam-ayoor', 'kollam', 'ayoor'].includes(f)) return 'Kollam-ayoor Zone';
    if (['trivandrum', 'amboori'].includes(f)) return 'Trivandrum Zone';
    if (['chenganoor'].includes(f)) return 'Chenganoor Zone';
    return `${forane} Zone`;
  }

  calculateAge(dobStr) {
    if (!dobStr) return null;
    const dob = new Date(dobStr);
    if (isNaN(dob.getTime())) return null;

    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  async handleRegister(e) {
    e.preventDefault();
    const name = (document.getElementById('regName')?.value || '').trim();
    const email = (document.getElementById('regEmail')?.value || '').trim();
    const password = document.getElementById('regPassword')?.value || '';
    const phoneInput = (document.getElementById('regPhone')?.value || '').trim();
    const bloodGroup = document.getElementById('regBloodGroup')?.value || '';
    const forona = document.getElementById('regForane')?.value || '';
    const unit = (document.getElementById('regUnit')?.value || '').trim();
    const dob = document.getElementById('regDob')?.value || '';
    const errorEl = document.getElementById('regError');
    const submitBtn = document.getElementById('regSubmitBtn');

    // Email format validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email || !emailRegex.test(email)) {
      errorEl.textContent = 'Please enter a valid email address (e.g. name@example.com).';
      errorEl.classList.remove('hidden');
      return;
    }

    // Password format validation
    if (!password || password.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters long.';
      errorEl.classList.remove('hidden');
      return;
    }

    // Indian Phone Number Range Validation (10 digits between 6000000000 and 9999999999)
    const cleanPhone = phoneInput.replace(/[\s\-\(\)\+]/g, '').replace(/^91/, '');
    const phoneNum = Number(cleanPhone);
    if (!/^[6-9]\d{9}$/.test(cleanPhone) || isNaN(phoneNum) || phoneNum < 6000000000 || phoneNum > 9999999999) {
      errorEl.textContent = 'Phone number must be a valid 10-digit Indian phone number (between 6000000000 and 9999999999).';
      errorEl.classList.remove('hidden');
      return;
    }

    if (!dob) {
      errorEl.textContent = 'Date of birth is required to register.';
      errorEl.classList.remove('hidden');
      return;
    }

    const age = this.calculateAge(dob);
    if (age === null || age < 18 || age > 55) {
      errorEl.textContent = 'Only donors between 18 and 55 years of age are eligible to register.';
      errorEl.classList.remove('hidden');
      return;
    }

    // Derive Zone automatically from Forane
    const zone = this.getZoneFromForane(forona);

    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering...';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, password, phone: cleanPhone, bloodGroup, zone, forona, unit, dob
        })
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.error('Failed to parse JSON response:', jsonErr);
      }

      if (res.ok && data && data.success) {
        this.currentUser = data.user;
        this.renderProfileView();
        this.showToast('Registration complete! Welcome!');
      } else {
        errorEl.textContent = (data && data.error) ? data.error : `Registration failed (${res.status || 'Server error'}).`;
        errorEl.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Registration fetch error:', err);
      errorEl.textContent = 'Server connection error. Please check if server is running.';
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

  toggleForgotPasswordForm(e) {
    if (e) e.preventDefault();
    const forgotTab = document.getElementById('tabForgotPassword');
    if (!forgotTab) return;
    const isHidden = forgotTab.classList.contains('hidden');
    if (isHidden) {
      forgotTab.classList.remove('hidden');
      forgotTab.scrollIntoView({ behavior: 'smooth' });
    } else {
      forgotTab.classList.add('hidden');
    }
  }

  async handleForgotPasswordVerify(e) {
    e.preventDefault();
    const email = (document.getElementById('forgotEmail')?.value || '').trim();
    const phone = (document.getElementById('forgotPhone')?.value || '').trim();
    const errorEl = document.getElementById('forgotStep1Error');
    const submitBtn = document.getElementById('forgotStep1Btn');

    if (!email) {
      errorEl.textContent = 'Please enter your registered email address.';
      errorEl.classList.remove('hidden');
      return;
    }

    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Verifying Account...';

    try {
      const res = await fetch('/api/auth/forgot-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        document.getElementById('forgotStep2Form')?.classList.remove('hidden');
        if (data.resetCode) {
          const resetCodeInput = document.getElementById('resetCode');
          if (resetCodeInput) resetCodeInput.value = data.resetCode;
        }
        submitBtn.textContent = '✅ Identity Verified';
        this.showToast('Account verified! Enter new password.');
      } else {
        errorEl.textContent = data.error || 'Account verification failed.';
        errorEl.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Verify Account Details';
      }
    } catch (err) {
      console.error('Forgot password verify error:', err);
      errorEl.textContent = 'Server connection error. Please try again.';
      errorEl.classList.remove('hidden');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Verify Account Details';
    }
  }

  async handleResetPasswordSubmit(e) {
    e.preventDefault();
    const email = (document.getElementById('forgotEmail')?.value || '').trim();
    const resetCode = (document.getElementById('resetCode')?.value || '').trim();
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmNewPassword = document.getElementById('confirmNewPassword')?.value || '';
    const errorEl = document.getElementById('forgotStep2Error');
    const successEl = document.getElementById('forgotStep2Success');
    const submitBtn = document.getElementById('forgotStep2Btn');

    if (newPassword.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters long.';
      errorEl.classList.remove('hidden');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      errorEl.textContent = 'Passwords do not match.';
      errorEl.classList.remove('hidden');
      return;
    }

    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving New Password...';

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, resetCode, newPassword })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        successEl.textContent = data.message || 'Password reset successfully! You can now sign in.';
        successEl.classList.remove('hidden');
        this.showToast('Password reset successfully!');

        const loginEmailInput = document.getElementById('loginEmail');
        if (loginEmailInput) loginEmailInput.value = email;

        setTimeout(() => {
          document.getElementById('tabForgotPassword')?.classList.add('hidden');
          document.getElementById('loginPassword')?.focus();
        }, 2000);
      } else {
        errorEl.textContent = data.error || 'Failed to reset password.';
        errorEl.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      errorEl.textContent = 'Server connection error. Please try again.';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '🔑 Save New Password';
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

    const nameEl = document.getElementById('profileNameHeading');
    const emailEl = document.getElementById('profileEmail');
    const avatarEl = document.getElementById('profilePic');
    const statusBadgeEl = document.getElementById('profileStatusBadge');

    if (nameEl) nameEl.textContent = user.name || 'Donor Profile';
    if (emailEl) emailEl.textContent = user.email || '';
    if (avatarEl) {
      avatarEl.src = user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=dc2626&color=fff`;
      avatarEl.style.display = 'block';
    }

    // Update Header and Summary Display Card
    const displayDonorName = document.getElementById('displayDonorName');
    const displayDonorPhone = document.getElementById('displayDonorPhone');
    const displayDonorBloodGroup = document.getElementById('displayDonorBloodGroup');
    const displayDonorForane = document.getElementById('displayDonorForane');
    const displayDonorZone = document.getElementById('displayDonorZone');
    const displayDonorUnit = document.getElementById('displayDonorUnit');
    const displayDonorDob = document.getElementById('displayDonorDob');
    const displayDonorAvailability = document.getElementById('displayDonorAvailability');
    const displayDonorLastDonation = document.getElementById('displayDonorLastDonation');

    if (displayDonorName) displayDonorName.textContent = user.name || '-';
    if (displayDonorPhone) displayDonorPhone.textContent = user.phone || 'Not provided';
    if (displayDonorBloodGroup) displayDonorBloodGroup.textContent = user.bloodGroup || 'Not specified';
    if (displayDonorForane) displayDonorForane.textContent = user.forona || 'Not specified';
    if (displayDonorZone) displayDonorZone.textContent = user.zone || (user.forona ? this.getZoneFromForane(user.forona) : 'Not specified');
    if (displayDonorUnit) displayDonorUnit.textContent = user.unit || 'None';
    if (displayDonorDob) {
      const ageStr = user.age ? ` (Age ${user.age})` : '';
      displayDonorDob.textContent = user.dob ? `${user.dob}${ageStr}` : 'Not provided';
    }
    const isAvailable = user.isAvailable !== false;
    if (displayDonorAvailability) {
      displayDonorAvailability.textContent = isAvailable ? '🟢 Available for Donation' : '🔴 Unavailable for Donation';
      displayDonorAvailability.style.color = isAvailable ? '#10b981' : '#dc2626';
    }
    if (displayDonorLastDonation) displayDonorLastDonation.textContent = user.lastDonationDate || 'No previous donation recorded';

    // Ensure DOB date limits are set
    this.setupDobDateLimits();

    // Populate Edit Form Fields
    const profileNameEl = document.getElementById('profileName');
    if (profileNameEl) profileNameEl.value = user.name || '';
    const profilePhoneEl = document.getElementById('profilePhone');
    if (profilePhoneEl) profilePhoneEl.value = user.phone || '';
    const profileBloodEl = document.getElementById('profileBloodGroup');
    if (profileBloodEl) profileBloodEl.value = user.bloodGroup || 'O+';
    const profileForaneEl = document.getElementById('profileForane');
    if (profileForaneEl) profileForaneEl.value = user.forona || 'Changanacherry';
    const unitEl = document.getElementById('profileUnit');
    if (unitEl) unitEl.value = user.unit || '';
    const dobEl = document.getElementById('profileDob');
    if (dobEl) dobEl.value = user.dob || '';

    // Check for Incomplete Profile (e.g., after Google Sign-In)
    const isProfileIncomplete = !user.phone || !user.bloodGroup || !user.forona || !user.dob;
    const alertEl = document.getElementById('profileAlert');
    const profileEditBox = document.getElementById('profileEditBox');
    const toggleEditBtn = document.getElementById('toggleEditProfileBtn');

    if (isProfileIncomplete) {
      if (alertEl) {
        alertEl.className = 'alert alert-warning';
        alertEl.innerHTML = '<strong>⚠️ Action Required:</strong> Please complete your Phone Number, Blood Group, Forane, and Date of Birth details below to activate your donor profile in the public search directory.';
        alertEl.classList.remove('hidden');
      }
      if (profileEditBox) {
        profileEditBox.classList.remove('hidden');
        if (toggleEditBtn) toggleEditBtn.textContent = '❌ Close Edit Form';
        setTimeout(() => {
          profileEditBox.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      }
    } else if (profileEditBox) {
      profileEditBox.classList.add('hidden');
      if (toggleEditBtn) toggleEditBtn.textContent = '✏️ Edit Profile Information';
    }

    // Availability Status Toggle Switch State
    const availCheckbox = document.getElementById('availabilityToggleCheckbox');
    const availLabel = document.getElementById('availabilityStatusLabel');

    if (availCheckbox) {
      availCheckbox.checked = isAvailable;
    }
    if (availLabel) {
      availLabel.textContent = isAvailable ? '🟢 Available for Donation' : '🔴 Marked Unavailable (Inactive)';
      availLabel.style.color = isAvailable ? '#10b981' : '#dc2626';
    }

    // Donation Date
    const lastDateInput = document.getElementById('profileLastDonationDate');
    const coolingInfoEl = document.getElementById('coolingPeriodInfo');
    if (lastDateInput) {
      lastDateInput.max = new Date().toISOString().split('T')[0];
    }

    if (!isAvailable) {
      if (statusBadgeEl) {
        statusBadgeEl.className = 'profile-status-badge status-ineligible';
        statusBadgeEl.textContent = '🔴 Unavailable for Donation';
      }
      if (coolingInfoEl) coolingInfoEl.classList.add('hidden');
    } else if (user.lastDonationDate) {
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

  async toggleAvailabilityStatus() {
    const availCheckbox = document.getElementById('availabilityToggleCheckbox');
    const newAvailable = availCheckbox ? availCheckbox.checked : true;
    const availLabel = document.getElementById('availabilityStatusLabel');

    if (availLabel) {
      availLabel.textContent = 'Updating...';
    }

    try {
      const res = await fetch('/api/user/availability', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: newAvailable })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (this.currentUser) this.currentUser.isAvailable = newAvailable;
        this.renderProfileView();
        this.showToast(data.message || (newAvailable ? 'Marked as Available!' : 'Marked as Unavailable.'));
      } else {
        if (availCheckbox) availCheckbox.checked = !newAvailable;
        alert(data.error || 'Failed to update availability status.');
        this.renderProfileView();
      }
    } catch (err) {
      console.error('Error toggling availability:', err);
      if (availCheckbox) availCheckbox.checked = !newAvailable;
      alert('Server error while updating availability.');
      this.renderProfileView();
    }
  }

  async updateDonationDate(e) {
    e.preventDefault();
    const lastDateInput = document.getElementById('profileLastDonationDate');
    const dateVal = lastDateInput ? lastDateInput.value : '';
    const saveBtn = document.getElementById('saveDonationBtn');

    if (!dateVal) return;

    const selectedD = new Date(dateVal);
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (selectedD > today) {
      alert('Last donation date cannot be in the future.');
      return;
    }

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
    const name = (document.getElementById('profileName')?.value || '').trim();
    const phoneInput = (document.getElementById('profilePhone')?.value || '').trim();
    const bloodGroup = document.getElementById('profileBloodGroup')?.value || '';
    const forona = document.getElementById('profileForane')?.value || '';
    const unit = (document.getElementById('profileUnit')?.value || '').trim();
    const dob = document.getElementById('profileDob')?.value || '';
    const alertEl = document.getElementById('profileAlert');
    const saveBtn = document.getElementById('saveProfileBtn');

    // Indian Phone Number Range Validation (10 digits between 6000000000 and 9999999999)
    const cleanPhone = phoneInput.replace(/[\s\-\(\)\+]/g, '').replace(/^91/, '');
    const phoneNum = Number(cleanPhone);
    if (!/^[6-9]\d{9}$/.test(cleanPhone) || isNaN(phoneNum) || phoneNum < 6000000000 || phoneNum > 9999999999) {
      alertEl.className = 'alert alert-danger';
      alertEl.textContent = 'Phone number must be a valid 10-digit Indian phone number (between 6000000000 and 9999999999).';
      alertEl.classList.remove('hidden');
      return;
    }

    if (dob) {
      const age = this.calculateAge(dob);
      if (age === null || age < 18 || age > 55) {
        alertEl.className = 'alert alert-danger';
        alertEl.textContent = 'Only donors between 18 and 55 years of age are eligible to register.';
        alertEl.classList.remove('hidden');
        return;
      }
    }

    // Derive Zone automatically from Forane
    const zone = this.getZoneFromForane(forona);

    alertEl.classList.add('hidden');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving & Syncing...';

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, phone: cleanPhone, bloodGroup, zone, forona, unit, dob
        })
      });

      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        console.error('Failed to parse JSON response:', jsonErr);
      }

      if (res.ok && data && data.success) {
        this.currentUser = data.user;
        this.renderProfileView();
        alertEl.className = 'alert alert-success';
        alertEl.textContent = 'Profile details updated and synced to public blood donor directory!';
        alertEl.classList.remove('hidden');
        this.showToast('Profile updated & synced to search directory!');

        // Collapse edit form after successful save
        const profileEditBox = document.getElementById('profileEditBox');
        const toggleEditBtn = document.getElementById('toggleEditProfileBtn');
        if (profileEditBox) profileEditBox.classList.add('hidden');
        if (toggleEditBtn) toggleEditBtn.textContent = '✏️ Edit Profile Information';
      } else {
        alertEl.className = 'alert alert-danger';
        alertEl.textContent = (data && data.error) ? data.error : `Failed to update profile (${res.status || 'Server error'}).`;
        alertEl.classList.remove('hidden');
      }
    } catch (err) {
      console.error('Profile update error:', err);
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
