/**
 * Yuva Blood Forum - Dedicated Admin Portal JavaScript
 */

class AdminApp {
  constructor() {
    this.schema = {
      columns: [],
      filterableOptions: {},
      totalRecords: 0
    };
    this.isAdminLoggedIn = false;
    this.adminUsername = '';
    this.selectedCSVFile = null;
    this.adminCurrentPage = 1;
    this.adminSearchQuery = '';
    this.adminStatusFilter = 'all'; // 'all', 'active', 'non-active'
    this.adminRecordsMap = {};
    this.selectedRecordIds = new Set();

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.checkAdminStatus();
    await this.loadSchema();
  }

  bindEvents() {
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

  async checkAdminStatus() {
    try {
      const res = await fetch('/api/admin/status');
      const data = await res.json();

      if (data.loggedIn) {
        this.isAdminLoggedIn = true;
        this.adminUsername = data.username;
        this.updateAdminUI(true);
        this.loadAdminTable();
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
    const logoutNavBtn = document.getElementById('logoutNavBtn');
    const loginView = document.getElementById('loginFormContainer');
    const dashboardView = document.getElementById('adminDashboardContainer');

    if (isLoggedIn) {
      adminBadge?.classList.remove('hidden');
      logoutNavBtn?.classList.remove('hidden');
      if (adminUsernameEl) adminUsernameEl.textContent = this.adminUsername;
      loginView?.classList.add('hidden');
      dashboardView?.classList.remove('hidden');
    } else {
      adminBadge?.classList.add('hidden');
      logoutNavBtn?.classList.add('hidden');
      loginView?.classList.remove('hidden');
      dashboardView?.classList.add('hidden');
    }
  }

  async loadSchema() {
    try {
      const res = await fetch('/api/schema');
      const data = await res.json();
      if (data.success) {
        this.schema = data;
        this.updateDatasetMeta();
      }
    } catch (err) {
      console.error('Failed to load schema:', err);
    }
  }

  updateDatasetMeta() {
    const adminStats = document.getElementById('adminDatasetStats');
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

  switchTab(tabName) {
    const tableBtn = document.getElementById('tabTableBtn');
    const analyticsBtn = document.getElementById('tabAnalyticsBtn');
    const uploadBtn = document.getElementById('tabUploadBtn');
    const settingsBtn = document.getElementById('tabSettingsBtn');

    const tableTab = document.getElementById('tabTable');
    const analyticsTab = document.getElementById('tabAnalytics');
    const uploadTab = document.getElementById('tabUpload');
    const settingsTab = document.getElementById('tabSettings');

    [tableBtn, analyticsBtn, uploadBtn, settingsBtn].forEach(b => b?.classList.remove('active'));
    [tableTab, analyticsTab, uploadTab, settingsTab].forEach(t => t?.classList.add('hidden'));

    if (tabName === 'table') {
      tableBtn?.classList.add('active');
      tableTab?.classList.remove('hidden');
      this.loadAdminTable();
    } else if (tabName === 'analytics') {
      analyticsBtn?.classList.add('active');
      analyticsTab?.classList.remove('hidden');
      this.loadAnalytics();
    } else if (tabName === 'upload') {
      uploadBtn?.classList.add('active');
      uploadTab?.classList.remove('hidden');
    } else {
      settingsBtn?.classList.add('active');
      settingsTab?.classList.remove('hidden');
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
        this.showToast('Logged in to Admin Portal!');
        passwordInput.value = '';
        await this.loadSchema();
        await this.loadAdminTable();
      } else {
        errorEl.textContent = data.error || 'Invalid credentials.';
        errorEl.classList.remove('hidden');
      }
    } catch (err) {
      errorEl.textContent = 'Server connection error.';
      errorEl.classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Log In to Dashboard';
    }
  }

  // --- ADMIN DATA TABLE & MARK DONATED ---

  async loadAdminTable() {
    const tableHeadRow = document.getElementById('adminTableHeadRow');
    const tableBody = document.getElementById('adminTableBody');
    const indicator = document.getElementById('adminPageIndicator');
    const prevBtn = document.getElementById('adminPrevBtn');
    const nextBtn = document.getElementById('adminNextBtn');

    if (!tableHeadRow || !tableBody) return;

    tableBody.innerHTML = `<tr><td colspan="14" style="text-align:center; padding:2rem;">⏳ Loading database records...</td></tr>`;

    try {
      const queryParams = new URLSearchParams({
        page: this.adminCurrentPage,
        limit: 15,
        q: this.adminSearchQuery,
        statusFilter: this.adminStatusFilter
      });

      const res = await fetch(`/api/admin/records?${queryParams.toString()}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      const records = data.records || [];
      const columns = this.schema.columns && this.schema.columns.length > 0 ? this.schema.columns : (records.length > 0 ? Object.keys(records[0].data) : ['Name', 'Phone', 'District', 'Blood Group']);

      // 1. Build Header
      let headHtml = `
        <th style="width:40px;"><input type="checkbox" id="selectAllCheckbox" onchange="adminApp.toggleSelectAll(this)"></th>
        <th>#</th>
        <th>Status</th>
      `;
      columns.forEach(col => {
        headHtml += `<th>${this.escapeHtml(col)}</th>`;
      });
      headHtml += `<th style="text-align:right;">Actions</th>`;
      tableHeadRow.innerHTML = headHtml;

      this.selectedRecordIds.clear();
      this.updateSelectedCount();

      // 2. Build Table Rows
      if (records.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="${columns.length + 4}" style="text-align:center; padding:2rem; color:var(--text-muted);">No matching donor records found for status "${this.adminStatusFilter}".</td></tr>`;
        if (indicator) indicator.textContent = 'Page 1 of 1';
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        return;
      }

      tableBody.innerHTML = '';
      this.adminRecordsMap = {};

      records.forEach((row, idx) => {
        this.adminRecordsMap[row.id] = row.data;
        const tr = document.createElement('tr');

        let statusStyle = row.isActive ? 'color:#16a34a; font-weight:700;' : 'color:#dc2626; font-weight:700;';

        let rowHtml = `
          <td><input type="checkbox" class="row-checkbox" value="${row.id}" onchange="adminApp.toggleRowSelect(${row.id}, this.checked)"></td>
          <td>${(this.adminCurrentPage - 1) * 15 + idx + 1}</td>
          <td><span style="${statusStyle}">${this.escapeHtml(row.statusBadge || 'Active')}</span></td>
        `;

        columns.forEach(col => {
          const val = row.data[col] !== undefined && row.data[col] !== null ? row.data[col] : '-';
          rowHtml += `<td>${this.escapeHtml(val.toString())}</td>`;
        });

        rowHtml += `
          <td style="text-align:right;">
            <div class="action-btns" style="justify-content:flex-end;">
              <button class="btn-icon btn-icon-donate" title="Mark Blood Donation Completed" onclick="adminApp.markRecordDonated(${row.id})">🩸 Donated</button>
              <button class="btn-icon" title="Edit Record" onclick="adminApp.openEditRecordModal(${row.id})">✏️ Edit</button>
              <button class="btn-icon btn-icon-danger" title="Delete Record" onclick="adminApp.confirmDeleteRecord(${row.id})">🗑️ Delete</button>
            </div>
          </td>
        `;

        tr.innerHTML = rowHtml;
        tableBody.appendChild(tr);
      });

      const pag = data.pagination;
      if (indicator) indicator.textContent = `Page ${pag.page} of ${pag.totalPages} (${pag.totalRecords} records)`;
      if (prevBtn) prevBtn.disabled = pag.page <= 1;
      if (nextBtn) nextBtn.disabled = pag.page >= pag.totalPages;

    } catch (err) {
      console.error('Failed to load admin table:', err);
      tableBody.innerHTML = `<tr><td colspan="14" style="text-align:center; padding:2rem; color:var(--danger);">Failed to load admin data table.</td></tr>`;
    }
  }

  filterByStatus(statusValue) {
    this.adminStatusFilter = statusValue;
    this.adminCurrentPage = 1;
    this.loadAdminTable();
  }

  async markRecordDonated(id) {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = prompt(`Enter donation date for record #${id} (YYYY-MM-DD):`, today);
    if (!dateInput) return;

    try {
      const res = await fetch(`/api/admin/records/${id}/mark-donated`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ donationDate: dateInput.trim() })
      });

      const data = await res.json();

      if (data.success) {
        this.showToast(`🩸 Marked donation completed on ${dateInput.trim()}`);
        await this.loadSchema();
        await this.loadAdminTable();
      } else {
        alert(data.error || 'Failed to mark donation completed.');
      }
    } catch (err) {
      alert('Error marking donation.');
    }
  }

  toggleSelectAll(masterCheckbox) {
    const isChecked = masterCheckbox.checked;
    const checkboxes = document.querySelectorAll('.row-checkbox');

    checkboxes.forEach(cb => {
      cb.checked = isChecked;
      const id = parseInt(cb.value, 10);
      if (isChecked) {
        this.selectedRecordIds.add(id);
      } else {
        this.selectedRecordIds.delete(id);
      }
    });

    this.updateSelectedCount();
  }

  toggleRowSelect(id, isChecked) {
    if (isChecked) {
      this.selectedRecordIds.add(id);
    } else {
      this.selectedRecordIds.delete(id);
    }

    const masterCb = document.getElementById('selectAllCheckbox');
    const allRowCbs = document.querySelectorAll('.row-checkbox');
    if (masterCb && allRowCbs.length > 0) {
      masterCb.checked = Array.from(allRowCbs).every(cb => cb.checked);
    }

    this.updateSelectedCount();
  }

  updateSelectedCount() {
    const countEl = document.getElementById('selectedCount');
    const bulkBtn = document.getElementById('bulkDeleteBtn');
    const count = this.selectedRecordIds.size;

    if (countEl) countEl.textContent = count;

    if (bulkBtn) {
      if (count > 0) {
        bulkBtn.classList.remove('hidden');
      } else {
        bulkBtn.classList.add('hidden');
      }
    }
  }

  async confirmBulkDelete() {
    const ids = Array.from(this.selectedRecordIds);
    if (ids.length === 0) return;

    if (!confirm(`Are you sure you want to delete ${ids.length} selected record(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/records/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });

      const data = await res.json();

      if (data.success) {
        this.showToast(data.message);
        this.selectedRecordIds.clear();
        await this.loadSchema();
        await this.loadAdminTable();
      } else {
        alert(data.error || 'Failed to bulk delete records.');
      }
    } catch (err) {
      alert('Error performing bulk delete.');
    }
  }

  filterAdminTable() {
    const input = document.getElementById('adminSearchInput');
    this.adminSearchQuery = input ? input.value : '';
    this.adminCurrentPage = 1;
    this.loadAdminTable();
  }

  changeAdminPage(delta) {
    this.adminCurrentPage += delta;
    this.loadAdminTable();
  }

  // --- ANALYTICS DASHBOARD ---

  async loadAnalytics() {
    const totalEl = document.getElementById('statTotalDonors');
    const eligibleEl = document.getElementById('statEligibleDonors');
    const nonActiveEl = document.getElementById('statNonActiveDonors');
    const recentlyEl = document.getElementById('statDonatedRecently');
    const zoneListEl = document.getElementById('zoneBreakdownList');
    const foronaListEl = document.getElementById('foronaBreakdownList');
    const bgGridEl = document.getElementById('bloodGroupBreakdownGrid');

    if (totalEl) totalEl.textContent = '...';
    if (eligibleEl) eligibleEl.textContent = '...';
    if (nonActiveEl) nonActiveEl.textContent = '...';
    if (recentlyEl) recentlyEl.textContent = '...';

    try {
      const res = await fetch('/api/admin/analytics');
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      if (totalEl) totalEl.textContent = data.totalRecords;
      if (eligibleEl) eligibleEl.textContent = data.eligibleCount;
      if (nonActiveEl) nonActiveEl.textContent = data.nonActiveCount || (data.totalRecords - data.eligibleCount);
      if (recentlyEl) recentlyEl.textContent = data.donatedRecentlyCount;

      const maxCount = Math.max(1, data.totalRecords);

      // 1. Zone Breakdown
      if (zoneListEl) {
        zoneListEl.innerHTML = '';
        const zoneEntries = Object.entries(data.byZone || {}).sort((a, b) => b[1] - a[1]);
        zoneEntries.forEach(([zoneName, count]) => {
          const pct = Math.round((count / maxCount) * 100);
          const item = document.createElement('div');
          item.className = 'breakdown-item';
          item.innerHTML = `
            <div class="breakdown-label-row">
              <span>${this.escapeHtml(zoneName)}</span>
              <span><strong>${count}</strong> donors (${pct}%)</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%;"></div>
            </div>
          `;
          zoneListEl.appendChild(item);
        });
      }

      // 2. Forona Breakdown
      if (foronaListEl) {
        foronaListEl.innerHTML = '';
        const foronaEntries = Object.entries(data.byForona || {}).sort((a, b) => b[1] - a[1]);
        foronaEntries.forEach(([foronaName, count]) => {
          const pct = Math.round((count / maxCount) * 100);
          const item = document.createElement('div');
          item.className = 'breakdown-item';
          item.innerHTML = `
            <div class="breakdown-label-row">
              <span>${this.escapeHtml(foronaName)}</span>
              <span><strong>${count}</strong></span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${pct}%;"></div>
            </div>
          `;
          foronaListEl.appendChild(item);
        });
      }

      // 3. Blood Group Breakdown
      if (bgGridEl) {
        bgGridEl.innerHTML = '';
        const standardGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        standardGroups.forEach(bg => {
          const count = data.byBloodGroup[bg] || 0;
          const pill = document.createElement('div');
          pill.className = 'bg-stat-pill';
          pill.innerHTML = `
            <span class="bg-stat-type">${bg}</span>
            <span class="bg-stat-count">${count} donors</span>
          `;
          bgGridEl.appendChild(pill);
        });
      }

    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
  }

  // --- ADD / EDIT RECORD MODAL ---

  openAddRecordModal() {
    const modal = document.getElementById('editRecordModal');
    const title = document.getElementById('editModalTitle');
    const idInput = document.getElementById('editRecordId');
    const fieldsContainer = document.getElementById('dynamicFormFields');
    const alertEl = document.getElementById('editRecordAlert');

    alertEl.classList.add('hidden');
    idInput.value = '';
    title.textContent = 'Add New Record';

    const columns = this.schema.columns && this.schema.columns.length > 0 ? this.schema.columns : ['Name', 'Blood Group', 'Zone', 'Forane', 'Phone', 'Age', 'Availability'];

    fieldsContainer.innerHTML = '';
    columns.forEach(col => {
      const group = document.createElement('div');
      group.className = 'form-group';

      const label = document.createElement('label');
      label.textContent = col;

      let input;
      if (/blood|group|bg/i.test(col)) {
        input = document.createElement('select');
        const defaultOpts = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        defaultOpts.forEach(bg => {
          const opt = document.createElement('option');
          opt.value = bg;
          opt.textContent = bg || `-- Select ${col} --`;
          input.appendChild(opt);
        });
      } else if (/date|donation|last/i.test(col)) {
        input = document.createElement('input');
        input.type = 'date';
        input.max = new Date().toISOString().split('T')[0];
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Enter ${col}`;
      }

      input.name = col;
      group.appendChild(label);
      group.appendChild(input);
      fieldsContainer.appendChild(group);
    });

    modal.classList.remove('hidden');
  }

  openEditRecordModal(id) {
    const recordData = this.adminRecordsMap[id];
    if (!recordData) return;

    const modal = document.getElementById('editRecordModal');
    const title = document.getElementById('editModalTitle');
    const idInput = document.getElementById('editRecordId');
    const fieldsContainer = document.getElementById('dynamicFormFields');
    const alertEl = document.getElementById('editRecordAlert');

    alertEl.classList.add('hidden');
    idInput.value = id;
    title.textContent = `Edit Record #${id}`;

    const columns = this.schema.columns && this.schema.columns.length > 0 ? this.schema.columns : Object.keys(recordData);

    fieldsContainer.innerHTML = '';
    columns.forEach(col => {
      const group = document.createElement('div');
      group.className = 'form-group';

      const label = document.createElement('label');
      label.textContent = col;

      let input;
      const currentVal = recordData[col] !== undefined && recordData[col] !== null ? recordData[col] : '';

      if (/blood|group|bg/i.test(col)) {
        input = document.createElement('select');
        const defaultOpts = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        defaultOpts.forEach(bg => {
          const opt = document.createElement('option');
          opt.value = bg;
          opt.textContent = bg || `-- Select ${col} --`;
          if (bg === currentVal) opt.selected = true;
          input.appendChild(opt);
        });
      } else if (/date|donation|last/i.test(col)) {
        input = document.createElement('input');
        input.type = 'date';
        input.max = new Date().toISOString().split('T')[0];
        input.value = currentVal;
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = currentVal;
        input.placeholder = `Enter ${col}`;
      }

      input.name = col;
      group.appendChild(label);
      group.appendChild(input);
      fieldsContainer.appendChild(group);
    });

    modal.classList.remove('hidden');
  }

  closeEditRecordModal() {
    const modal = document.getElementById('editRecordModal');
    if (modal) modal.classList.add('hidden');
  }

  async saveRecordForm(e) {
    e.preventDefault();
    const idInput = document.getElementById('editRecordId');
    const recordId = idInput.value;
    const fieldsContainer = document.getElementById('dynamicFormFields');
    const alertEl = document.getElementById('editRecordAlert');
    const saveBtn = document.getElementById('saveRecordBtn');

    alertEl.classList.add('hidden');

    const inputs = fieldsContainer.querySelectorAll('input, select');
    const dataObj = {};
    inputs.forEach(input => {
      dataObj[input.name] = input.value.trim();
    });

    for (const [key, val] of Object.entries(dataObj)) {
      if (/date|donation|last/i.test(key) && val) {
        const dDate = new Date(val);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (dDate > today) {
          alertEl.className = 'alert alert-danger';
          alertEl.textContent = `${key} cannot be in the future!`;
          alertEl.classList.remove('hidden');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Record';
          return;
        }
      }
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      const url = recordId ? `/api/admin/records/${recordId}` : '/api/admin/records';
      const method = recordId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataObj })
      });

      const data = await res.json();

      if (data.success) {
        this.showToast(data.message);
        this.closeEditRecordModal();

        await this.loadSchema();
        await this.loadAdminTable();
      } else {
        alertEl.textContent = data.error || 'Failed to save record.';
        alertEl.classList.remove('hidden');
      }
    } catch (err) {
      alertEl.textContent = 'Server connection error.';
      alertEl.classList.remove('hidden');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Record';
    }
  }

  async confirmDeleteRecord(id) {
    if (!confirm(`Are you sure you want to delete record #${id}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/records/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (data.success) {
        this.showToast('Record deleted successfully!');
        await this.loadSchema();
        await this.loadAdminTable();
      } else {
        alert(data.error || 'Failed to delete record.');
      }
    } catch (err) {
      alert('Error deleting record');
    }
  }

  // --- CREDENTIALS & LOGOUT ---

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
      this.showToast('Logged out of Admin Portal');
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  // --- CSV UPLOAD & DATA CLEAR ---

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

        this.showToast('CSV Dataset Imported Successfully!');
        document.getElementById('selectedFileInfo')?.classList.add('hidden');
        this.selectedCSVFile = null;

        await this.loadSchema();
        await this.loadAdminTable();
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
        await this.loadAdminTable();
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
  window.adminApp = new AdminApp();
});
