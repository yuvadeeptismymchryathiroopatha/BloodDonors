/**
 * Bloodrupatha - Lightweight Search & Data Portal App Logic
 */

class App {
  constructor() {
    this.schema = {
      columns: [],
      filterableOptions: {},
      totalRecords: 0
    };
    this.filters = {};
    this.searchQuery = '';
    this.currentPage = 1;
    this.limit = 12;
    this.isAdminLoggedIn = false;
    this.adminUsername = '';
    this.selectedCSVFile = null;

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.checkAdminStatus();
    await this.loadSchema();
    await this.performSearch();
  }

  bindEvents() {
    const searchInput = document.getElementById('searchInput');
    const clearBtn = document.getElementById('clearSearchBtn');

    if (searchInput) {
      let debounceTimeout;
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        if (this.searchQuery) {
          clearBtn.classList.remove('hidden');
        } else {
          clearBtn.classList.add('hidden');
        }

        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          this.currentPage = 1;
          this.performSearch();
        }, 350);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(debounceTimeout);
          this.currentPage = 1;
          this.performSearch();
        }
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        this.searchQuery = '';
        clearBtn.classList.add('hidden');
        this.currentPage = 1;
        this.performSearch();
      });
    }

    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        this.currentPage = 1;
        this.performSearch();
      });
    }

    const dropZone = document.getElementById('dropZone');
    if (dropZone) {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
        }, false);
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('hover'), false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('hover'), false);
      });

      dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
          this.setCSVFile(files[0]);
        }
      });
    }
  }

  // --- SCHEMA & FILTER CONTROLS ---

  async loadSchema() {
    try {
      const res = await fetch('/api/schema');
      const data = await res.json();

      if (data.success) {
        this.schema = data;
        this.renderFilterControls();
        this.updateDatasetMeta();
      }
    } catch (err) {
      console.error('Failed to load schema:', err);
    }
  }

  renderFilterControls() {
    const container = document.getElementById('filterControlsContainer');
    const filterActions = document.getElementById('filterActions');
    if (!container) return;

    container.innerHTML = '';

    const filterableOpts = this.schema.filterableOptions || {};
    const columns = this.schema.columns || [];

    // Prominent Filter Target Keys: Blood Group, District, Unit / Forona
    const bloodGroupKey = columns.find(c => /blood|group|bg/i.test(c)) || 'Blood Group';
    const districtKey = columns.find(c => /district|dist/i.test(c)) || 'District';
    const foronaKey = columns.find(c => /unit|forona|ഫൊറോന/i.test(c)) || 'Unit / Forona (ഫൊറോന)';

    // Standard list of blood groups if dataset hasn't uploaded all
    const defaultBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const uploadedBloodGroups = filterableOpts[bloodGroupKey] || [];
    const combinedBloodGroups = Array.from(new Set([...defaultBloodGroups, ...uploadedBloodGroups])).sort();

    // 1. Blood Group Filter
    this.createSelectFilterGroup({
      container,
      columnKey: bloodGroupKey,
      label: '🩸 Blood Group (രക്തഗ്രൂപ്പ്)',
      placeholder: 'All Blood Groups',
      options: combinedBloodGroups
    });

    // 2. District Filter
    const districtOptions = filterableOpts[districtKey] || this.extractOptionsByRegex(/district|dist/i);
    this.createSelectFilterGroup({
      container,
      columnKey: districtKey,
      label: '📍 District (ജില്ല)',
      placeholder: 'All Districts',
      options: districtOptions
    });

    // 3. Unit / Forona Filter
    const foronaOptions = filterableOpts[foronaKey] || this.extractOptionsByRegex(/unit|forona|ഫൊറോന/i);
    this.createSelectFilterGroup({
      container,
      columnKey: foronaKey,
      label: '🏛️ Unit / Forona (യൂണിറ്റ് / ഫൊറോന)',
      placeholder: 'All Units / Foronas',
      options: foronaOptions
    });

    // 4. Any additional CSV columns
    Object.keys(filterableOpts).forEach(colName => {
      if (/blood|group|bg|district|dist|unit|forona|ഫൊറോന/i.test(colName)) return;

      const opts = filterableOpts[colName];
      if (opts && opts.length > 0) {
        this.createSelectFilterGroup({
          container,
          columnKey: colName,
          label: colName,
          placeholder: `All ${colName}s`,
          options: opts
        });
      }
    });

    this.toggleResetButton();
  }

  extractOptionsByRegex(regex) {
    const filterableOpts = this.schema.filterableOptions || {};
    const key = Object.keys(filterableOpts).find(k => regex.test(k));
    return key ? filterableOpts[key] : [];
  }

  createSelectFilterGroup({ container, columnKey, label, placeholder, options }) {
    const group = document.createElement('div');
    group.className = 'filter-group';

    const lbl = document.createElement('label');
    lbl.className = 'filter-label';
    lbl.textContent = label;

    const select = document.createElement('select');
    select.className = 'filter-select';
    select.dataset.column = columnKey;

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = placeholder;
    select.appendChild(defaultOpt);

    options.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      if (this.filters[columnKey] === val) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });

    select.addEventListener('change', (e) => {
      const col = e.target.dataset.column;
      const selectedVal = e.target.value;
      if (selectedVal) {
        this.filters[col] = selectedVal;
      } else {
        delete this.filters[col];
      }
      this.currentPage = 1;
      this.performSearch();
      this.toggleResetButton();
    });

    group.appendChild(lbl);
    group.appendChild(select);
    container.appendChild(group);
  }

  toggleResetButton() {
    const filterActions = document.getElementById('filterActions');
    const activeCount = Object.keys(this.filters).length;

    if (filterActions) {
      if (activeCount > 0) {
        filterActions.classList.remove('hidden');
      } else {
        filterActions.classList.add('hidden');
      }
    }
  }

  resetFilters() {
    this.filters = {};
    const selects = document.querySelectorAll('.filter-select');
    selects.forEach(select => select.value = '');
    this.currentPage = 1;
    this.performSearch();
    this.toggleResetButton();
  }

  updateDatasetMeta() {
    const datasetMeta = document.getElementById('datasetMeta');
    const adminStats = document.getElementById('adminDatasetStats');

    if (datasetMeta) {
      if (this.schema.totalRecords > 0) {
        datasetMeta.textContent = `(${this.schema.totalRecords} total stored records)`;
      } else {
        datasetMeta.textContent = '(No dataset uploaded)';
      }
    }

    if (adminStats) {
      if (this.schema.totalRecords > 0) {
        adminStats.innerHTML = `
          <strong>Total Records:</strong> ${this.schema.totalRecords}<br>
          <strong>Columns (${this.schema.columns.length}):</strong> ${this.schema.columns.join(', ')}
        `;
      } else {
        adminStats.innerHTML = '<em>No records currently uploaded in the database.</em>';
      }
    }
  }

  // --- DATA SEARCH & RENDERING ---

  async performSearch() {
    const container = document.getElementById('resultsContainer');
    const countEl = document.getElementById('resultsCount');
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⏳</div>
        <h3 class="empty-title">Searching...</h3>
        <p class="empty-desc">Fetching records from database</p>
      </div>
    `;

    try {
      const queryParams = new URLSearchParams({
        q: this.searchQuery,
        page: this.currentPage,
        limit: this.limit,
        filters: JSON.stringify(this.filters)
      });

      const res = await fetch(`/api/search?${queryParams.toString()}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Search failed');
      }

      this.renderResults(data.records, data.pagination);
    } catch (err) {
      console.error('Search error:', err);
      if (countEl) countEl.textContent = 'Error loading results';
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3 class="empty-title">Failed to load records</h3>
          <p class="empty-desc">${err.message || 'Please check your connection and try again.'}</p>
        </div>
      `;
    }
  }

  renderResults(records, pagination) {
    const container = document.getElementById('resultsContainer');
    const countEl = document.getElementById('resultsCount');
    const paginationContainer = document.getElementById('paginationContainer');

    if (countEl) {
      countEl.textContent = `${pagination.totalRecords} ${pagination.totalRecords === 1 ? 'Record' : 'Records'} Found`;
    }

    if (!records || records.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3 class="empty-title">No matching records found</h3>
          <p class="empty-desc">Try clearing search keywords or adjusting your selected filters.</p>
          ${Object.keys(this.filters).length > 0 || this.searchQuery ? `
            <button class="btn btn-outline btn-sm" onclick="app.resetAllSearch()">Reset Search & Filters</button>
          ` : ''}
        </div>
      `;
      if (paginationContainer) paginationContainer.classList.add('hidden');
      return;
    }

    container.innerHTML = '';

    records.forEach(record => {
      const card = this.createRecordCard(record);
      container.appendChild(card);
    });

    if (paginationContainer) {
      if (pagination.totalPages > 1) {
        paginationContainer.classList.remove('hidden');

        const indicator = document.getElementById('pageIndicator');
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');

        if (indicator) indicator.textContent = `Page ${pagination.page} of ${pagination.totalPages}`;
        if (prevBtn) prevBtn.disabled = pagination.page <= 1;
        if (nextBtn) nextBtn.disabled = pagination.page >= pagination.totalPages;
      } else {
        paginationContainer.classList.add('hidden');
      }
    }
  }

  createRecordCard(record) {
    const card = document.createElement('div');
    card.className = 'donor-card';

    const keys = Object.keys(record).filter(k => k !== 'id');
    
    let titleKey = keys.find(k => /name|donor|person|fullname|title/i.test(k)) || keys[0] || 'Record';
    let titleVal = record[titleKey] || 'N/A';

    let badgeKey = keys.find(k => /blood|group|bg/i.test(k));
    let badgeVal = badgeKey ? record[badgeKey] : null;

    let phoneKey = keys.find(k => /phone|mobile|contact|tel|whatsapp|number/i.test(k));
    let phoneVal = phoneKey ? record[phoneKey] : null;

    let fieldsHtml = '';
    keys.forEach(k => {
      if (k === titleKey || (badgeKey && k === badgeKey)) return;
      const val = record[k];
      if (val !== undefined && val !== null && val !== '') {
        fieldsHtml += `
          <div class="field-row">
            <span class="field-label">${this.escapeHtml(k)}</span>
            <span class="field-value">${this.escapeHtml(val)}</span>
          </div>
        `;
      }
    });

    let actionsHtml = '';
    if (phoneVal) {
      const cleanPhone = phoneVal.replace(/[^\d+]/g, '');
      actionsHtml = `
        <div class="donor-card-actions">
          <a href="tel:${cleanPhone}" class="btn btn-primary btn-sm">
            📞 Call
          </a>
          <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">
            💬 WhatsApp
          </a>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="donor-card-top">
        <h3 class="donor-name">${this.escapeHtml(titleVal)}</h3>
        ${badgeVal ? `<span class="donor-blood-badge">${this.escapeHtml(badgeVal)}</span>` : ''}
      </div>
      <div class="donor-fields">
        ${fieldsHtml || '<p class="field-value">No additional detail fields.</p>'}
      </div>
      ${actionsHtml}
    `;

    return card;
  }

  resetAllSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.value = '';
    this.searchQuery = '';
    document.getElementById('clearSearchBtn')?.classList.add('hidden');
    this.resetFilters();
  }

  changePage(delta) {
    this.currentPage += delta;
    this.performSearch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  changeLimit(newLimit) {
    this.limit = parseInt(newLimit, 10) || 12;
    this.currentPage = 1;
    this.performSearch();
  }

  // --- ADMIN AUTH & MODAL ---

  async checkAdminStatus() {
    try {
      const res = await fetch('/api/admin/status');
      const data = await res.json();

      if (data.loggedIn) {
        this.isAdminLoggedIn = true;
        this.adminUsername = data.username;
        this.updateAdminUI(true);
      } else {
        this.isAdminLoggedIn = false;
        this.updateAdminUI(false);
      }
    } catch (err) {
      console.error('Failed to check admin status:', err);
    }
  }

  updateAdminUI(isLoggedIn) {
    const adminBadge = document.getElementById('adminBadge');
    const adminUsernameEl = document.getElementById('adminUsername');
    const adminBtnText = document.getElementById('adminBtnText');
    const loginView = document.getElementById('loginFormContainer');
    const dashboardView = document.getElementById('adminDashboardContainer');
    const modalHeaderTitle = document.getElementById('modalHeaderTitle');

    if (isLoggedIn) {
      if (adminBadge) adminBadge.classList.remove('hidden');
      if (adminUsernameEl) adminUsernameEl.textContent = this.adminUsername;
      if (adminBtnText) adminBtnText.textContent = 'Admin Settings';
      if (loginView) loginView.classList.add('hidden');
      if (dashboardView) dashboardView.classList.remove('hidden');
      if (modalHeaderTitle) modalHeaderTitle.textContent = `Admin Panel (${this.adminUsername})`;
    } else {
      if (adminBadge) adminBadge.classList.add('hidden');
      if (adminBtnText) adminBtnText.textContent = 'Admin Portal';
      if (loginView) loginView.classList.remove('hidden');
      if (dashboardView) dashboardView.classList.add('hidden');
      if (modalHeaderTitle) modalHeaderTitle.textContent = 'Admin Login';
    }
  }

  toggleAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
      modal.classList.toggle('hidden');
    }
  }

  closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  switchAdminTab(tabName) {
    const uploadBtn = document.getElementById('tabUploadBtn');
    const settingsBtn = document.getElementById('tabSettingsBtn');
    const uploadTab = document.getElementById('tabUpload');
    const settingsTab = document.getElementById('tabSettings');

    if (tabName === 'upload') {
      uploadBtn.classList.add('active');
      settingsBtn.classList.remove('active');
      uploadTab.classList.remove('hidden');
      settingsTab.classList.add('hidden');
    } else {
      settingsBtn.classList.add('active');
      uploadBtn.classList.remove('active');
      settingsTab.classList.remove('hidden');
      uploadTab.classList.add('hidden');
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const errorEl = document.getElementById('loginError');
    const submitBtn = document.getElementById('loginSubmitBtn');

    errorEl.classList.add('hidden');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Authenticating...';

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.value,
          password: passwordInput.value
        })
      });

      const data = await res.json();

      if (data.success) {
        this.isAdminLoggedIn = true;
        this.adminUsername = data.username;
        this.updateAdminUI(true);
        this.showToast('Logged in successfully!');
        passwordInput.value = '';
      } else {
        errorEl.textContent = data.error || 'Invalid credentials.';
        errorEl.classList.remove('hidden');
      }
    } catch (err) {
      errorEl.textContent = 'Server connection error.';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In';
    }
  }

  async handleChangeCredentials(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newUsername = document.getElementById('newUsername').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    const alertEl = document.getElementById('settingsAlert');
    const saveBtn = document.getElementById('saveCredsBtn');

    alertEl.classList.add('hidden');

    if (newPassword && newPassword !== confirmNewPassword) {
      alertEl.className = 'alert alert-danger';
      alertEl.textContent = 'New passwords do not match!';
      alertEl.classList.remove('hidden');
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving changes...';

    try {
      const res = await fetch('/api/admin/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newUsername,
          newPassword
        })
      });

      const data = await res.json();

      if (data.success) {
        alertEl.className = 'alert alert-success';
        alertEl.textContent = data.message;
        alertEl.classList.remove('hidden');
        this.adminUsername = data.username;
        this.updateAdminUI(true);
        this.showToast('Admin credentials updated!');

        document.getElementById('currentPassword').value = '';
        document.getElementById('newUsername').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmNewPassword').value = '';
      } else {
        alertEl.className = 'alert alert-danger';
        alertEl.textContent = data.error || 'Failed to update credentials.';
        alertEl.classList.remove('hidden');
      }
    } catch (err) {
      alertEl.className = 'alert alert-danger';
      alertEl.textContent = 'Server error during credential change.';
      alertEl.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save New Credentials';
    }
  }

  async logoutAdmin() {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      this.isAdminLoggedIn = false;
      this.adminUsername = '';
      this.updateAdminUI(false);
      this.showToast('Logged out of Admin');
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  // --- CSV UPLOAD & DATA MANAGEMENT ---

  handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
      this.setCSVFile(file);
    }
  }

  setCSVFile(file) {
    if (!file.name.endsWith('.csv')) {
      this.showToast('Please select a valid .csv file');
      return;
    }
    this.selectedCSVFile = file;
    const fileInfo = document.getElementById('selectedFileInfo');
    const fileName = document.getElementById('fileName');

    if (fileInfo && fileName) {
      fileName.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      fileInfo.classList.remove('hidden');
    }
  }

  async uploadCSV() {
    if (!this.selectedCSVFile) return;

    const uploadBtn = document.getElementById('uploadBtn');
    const statusEl = document.getElementById('uploadStatus');
    const progressContainer = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');

    statusEl.classList.add('hidden');
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '40%';
    uploadBtn.disabled = true;

    const formData = new FormData();
    formData.append('csvFile', this.selectedCSVFile);

    try {
      progressBar.style.width = '75%';

      const res = await fetch('/api/admin/upload-csv', {
        method: 'POST',
        body: formData
      });

      progressBar.style.width = '100%';
      const data = await res.json();

      if (data.success) {
        statusEl.className = 'alert alert-success';
        statusEl.textContent = data.message;
        statusEl.classList.remove('hidden');

        this.showToast('CSV Imported Successfully!');
        document.getElementById('selectedFileInfo')?.classList.add('hidden');
        this.selectedCSVFile = null;

        await this.loadSchema();
        await this.performSearch();
      } else {
        statusEl.className = 'alert alert-danger';
        statusEl.textContent = data.error || 'Failed to upload CSV.';
        statusEl.classList.remove('hidden');
      }
    } catch (err) {
      statusEl.className = 'alert alert-danger';
      statusEl.textContent = 'Server connection error during upload.';
      statusEl.classList.remove('hidden');
    } finally {
      setTimeout(() => progressContainer.classList.add('hidden'), 500);
      uploadBtn.disabled = false;
    }
  }

  async confirmClearData() {
    if (!confirm('Are you sure you want to delete all dataset records from the database? This cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch('/api/admin/clear-data', { method: 'POST' });
      const data = await res.json();

      if (data.success) {
        this.showToast('Database records cleared!');
        await this.loadSchema();
        await this.performSearch();
      } else {
        alert(data.error || 'Failed to clear data');
      }
    } catch (err) {
      alert('Error clearing data');
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
  window.app = new App();
});
