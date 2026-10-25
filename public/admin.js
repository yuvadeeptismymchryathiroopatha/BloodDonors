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
    this.adminLimit = 50;
    this.adminTotalPages = 1;
    this.adminTotalRecords = 0;
    this.adminSearchQuery = '';
    this.adminStatusFilter = 'all'; // 'all', 'active', 'non-active'
    this.adminSort = 'newest';
    this.adminFilters = {}; // { Zone, Forane, Blood Group }
    this.currentFilteredRecordIds = [];
    this.adminRecordsMap = {};
    this.selectedRecordIds = new Set();
    this.visitorTimeframe = 'all';
    this.visitorCurrentPage = 1;
    this.visitorLimit = 25;
    this.visitorTotalPages = 1;

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
        this.loadVisitorTopStats();
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
        this.renderAdminFilterDropdowns();
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
    const visitorsBtn = document.getElementById('tabVisitorsBtn');
    const uploadBtn = document.getElementById('tabUploadBtn');
    const settingsBtn = document.getElementById('tabSettingsBtn');

    const tableTab = document.getElementById('tabTable');
    const analyticsTab = document.getElementById('tabAnalytics');
    const visitorsTab = document.getElementById('tabVisitors');
    const uploadTab = document.getElementById('tabUpload');
    const settingsTab = document.getElementById('tabSettings');

    [tableBtn, analyticsBtn, visitorsBtn, uploadBtn, settingsBtn].forEach(b => b?.classList.remove('active'));
    [tableTab, analyticsTab, visitorsTab, uploadTab, settingsTab].forEach(t => t?.classList.add('hidden'));

    if (tabName === 'table') {
      tableBtn?.classList.add('active');
      tableTab?.classList.remove('hidden');
      this.loadAdminTable();
    } else if (tabName === 'analytics') {
      analyticsBtn?.classList.add('active');
      analyticsTab?.classList.remove('hidden');
      this.loadAnalytics();
    } else if (tabName === 'visitors') {
      visitorsBtn?.classList.add('active');
      visitorsTab?.classList.remove('hidden');
      this.loadVisitorStats();
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
        this.loadVisitorTopStats();
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
    if (!this.isAdminLoggedIn) return;

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
        limit: this.adminLimit,
        q: this.adminSearchQuery,
        statusFilter: this.adminStatusFilter,
        sort: this.adminSort
      });

      if (Object.keys(this.adminFilters).length > 0) {
        queryParams.append('filters', JSON.stringify(this.adminFilters));
      }

      const res = await fetch(`/api/admin/records?${queryParams.toString()}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      const records = data.records || [];
      this.currentFilteredRecordIds = data.allFilteredIds || [];
      const columns = this.schema.columns && this.schema.columns.length > 0 ? this.schema.columns : (records.length > 0 ? Object.keys(records[0].data) : ['Name', 'Phone', 'District', 'Blood Group']);

      // Update Filtered Count & Delete Filtered Donors Button Visibility
      const filteredCountEl = document.getElementById('filteredCount');
      const deleteFilteredBtn = document.getElementById('deleteFilteredBtn');
      if (filteredCountEl) filteredCountEl.textContent = this.currentFilteredRecordIds.length;
      
      const hasActiveFilters = this.adminSearchQuery || this.adminStatusFilter !== 'all' || Object.keys(this.adminFilters).length > 0;
      if (deleteFilteredBtn) {
        if (hasActiveFilters && this.currentFilteredRecordIds.length > 0) {
          deleteFilteredBtn.classList.remove('hidden');
        } else {
          deleteFilteredBtn.classList.add('hidden');
        }
      }

      // Update Active Filter Tags Banner
      const filterBanner = document.getElementById('adminFilterStatusBanner');
      const filterTextEl = document.getElementById('adminFilterStatusText');
      if (filterBanner && filterTextEl) {
        if (hasActiveFilters) {
          let summaryParts = [];
          if (this.adminSearchQuery) summaryParts.push(`Search: "${this.adminSearchQuery}"`);
          if (this.adminStatusFilter !== 'all') summaryParts.push(`Status: ${this.adminStatusFilter}`);
          Object.entries(this.adminFilters).forEach(([k, v]) => {
            if (v) summaryParts.push(`${k}: ${v}`);
          });
          filterTextEl.innerHTML = `<strong>🔍 Active Filters (${this.currentFilteredRecordIds.length} donors found):</strong> ${summaryParts.join(' | ')}`;
          filterBanner.classList.remove('hidden');
        } else {
          filterBanner.classList.add('hidden');
        }
      }

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

      // Automatically refresh Analytics Overview Stats
      this.loadAnalytics();

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

      const startIdx = (this.adminCurrentPage - 1) * this.adminLimit;

      records.forEach((row, idx) => {
        this.adminRecordsMap[row.id] = row.data;
        const tr = document.createElement('tr');

        let statusStyle = row.isActive ? 'color:#16a34a; font-weight:700;' : 'color:#dc2626; font-weight:700;';

        let rowHtml = `
          <td><input type="checkbox" class="row-checkbox" value="${this.escapeHtml(row.id.toString())}"></td>
          <td>${startIdx + idx + 1}</td>
          <td><span style="${statusStyle}">${this.escapeHtml(row.statusBadge || 'Active')}</span></td>
        `;

        columns.forEach(col => {
          const val = row.data[col] !== undefined && row.data[col] !== null ? row.data[col] : '-';
          const formattedVal = (col.toLowerCase().includes('phone') || col.toLowerCase().includes('age') || /blood/i.test(col)) ? val.toString() : this.toSentenceCase(val.toString());
          rowHtml += `<td>${this.escapeHtml(formattedVal)}</td>`;
        });

        if (row.isDeleted) {
          rowHtml += `
            <td style="text-align:right;">
              <div class="action-btns" style="justify-content:flex-end;">
                <button class="btn-icon btn-icon-donate btn-restore" title="Restore Soft-Deleted Record">♻️ Restore</button>
              </div>
            </td>
          `;
        } else {
          rowHtml += `
            <td style="text-align:right;">
              <div class="action-btns" style="justify-content:flex-end;">
                <button class="btn-icon btn-icon-donate btn-donated" title="Mark Blood Donation Completed">🩸 Donated</button>
                <button class="btn-icon btn-edit" title="Edit Record">✏️ Edit</button>
                <button class="btn-icon btn-icon-danger btn-delete" title="Delete Record">🗑️ Delete</button>
              </div>
            </td>
          `;
        }

        tr.innerHTML = rowHtml;

        const checkbox = tr.querySelector('.row-checkbox');
        if (checkbox) {
          checkbox.addEventListener('change', (e) => this.toggleRowSelect(row.id, e.target.checked));
        }

        const restoreBtn = tr.querySelector('.btn-restore');
        if (restoreBtn) {
          restoreBtn.addEventListener('click', () => this.restoreRecord(row.id));
        }

        const donatedBtn = tr.querySelector('.btn-donated');
        if (donatedBtn) {
          donatedBtn.addEventListener('click', () => this.markRecordDonated(row.id));
        }

        const editBtn = tr.querySelector('.btn-edit');
        if (editBtn) {
          editBtn.addEventListener('click', () => this.openEditRecordModal(row.id));
        }

        const deleteBtn = tr.querySelector('.btn-delete');
        if (deleteBtn) {
          deleteBtn.addEventListener('click', () => this.confirmDeleteRecord(row.id));
        }

        tableBody.appendChild(tr);
      });

      const pag = data.pagination || {};
      this.adminTotalPages = pag.totalPages || 1;
      this.adminTotalRecords = pag.totalRecords || 0;
      const fromCount = records.length > 0 ? (startIdx + 1) : 0;
      const toCount = startIdx + records.length;

      if (indicator) {
        indicator.textContent = `Showing ${fromCount} - ${toCount} of ${this.adminTotalRecords} records (Page ${this.adminCurrentPage} of ${this.adminTotalPages})`;
      }
      if (prevBtn) {
        prevBtn.disabled = this.adminCurrentPage <= 1;
        prevBtn.style.display = 'inline-flex';
      }
      if (nextBtn) {
        nextBtn.disabled = this.adminCurrentPage >= this.adminTotalPages;
        nextBtn.style.display = 'inline-flex';
      }

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
      const id = cb.value;
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

  async restoreRecord(id) {
    try {
      const res = await fetch(`/api/admin/records/${id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await res.json();

      if (data.success) {
        this.showToast(data.message || `Record #${id} restored successfully!`);
        await this.loadSchema();
        await this.loadAdminTable();
      } else {
        alert(data.error || 'Failed to restore record.');
      }
    } catch (err) {
      alert('Error restoring record.');
    }
  }

  async confirmBulkDelete() {
    const ids = Array.from(this.selectedRecordIds);
    if (ids.length === 0) return;

    if (!confirm(`Are you sure you want to soft-delete ${ids.length} selected record(s)? They will be moved to Trash and automatically purged after 90 days.`)) {
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
        this.showToast(data.message || `Deleted ${ids.length} record(s).`);
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

  async confirmDeleteFiltered() {
    const count = this.currentFilteredRecordIds.length;
    if (count === 0) return;

    if (!confirm(`⚠️ CRITICAL WARNING:\n\nAre you sure you want to delete ALL ${count} donor record(s) matching your current search & condition filters?\n\nThis action will permanently delete ${count} records from the database and cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/records/delete-filtered', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: this.currentFilteredRecordIds })
      });

      const data = await res.json();

      if (data.success) {
        this.showToast(data.message || `Deleted ${count} filtered record(s).`);
        this.resetAdminFilters();
      } else {
        alert(data.error || 'Failed to delete filtered records.');
      }
    } catch (err) {
      alert('Error performing delete filtered records.');
    }
  }

  renderAdminFilterDropdowns() {
    const container = document.getElementById('adminFiltersContainer');
    if (!container) return;

    container.innerHTML = '';
    const filterableOpts = (this.schema && this.schema.filterableOptions) ? this.schema.filterableOptions : {};

    const keyFields = ['Zone', 'Forane', 'Blood Group'];

    keyFields.forEach(field => {
      const matchingKey = Object.keys(filterableOpts).find(k => k.toLowerCase().trim() === field.toLowerCase().trim());
      const opts = matchingKey ? filterableOpts[matchingKey] : [];

      if (opts && opts.length > 0) {
        const select = document.createElement('select');
        select.className = 'filter-select';
        select.style.minWidth = '140px';
        select.innerHTML = `<option value="">All ${field}s</option>`;
        
        opts.forEach(optVal => {
          if (optVal) {
            select.innerHTML += `<option value="${this.escapeHtml(optVal)}">${this.escapeHtml(optVal)}</option>`;
          }
        });

        select.addEventListener('change', (e) => {
          const val = e.target.value;
          if (val) {
            this.adminFilters[field] = val;
          } else {
            delete this.adminFilters[field];
          }
          this.adminCurrentPage = 1;
          this.loadAdminTable();
        });

        container.appendChild(select);
      }
    });
  }

  resetAdminFilters() {
    this.adminSearchQuery = '';
    this.adminStatusFilter = 'all';
    this.adminFilters = {};
    this.adminCurrentPage = 1;

    const searchInput = document.getElementById('adminSearchInput');
    const statusSelect = document.getElementById('adminStatusFilter');
    const sortSelect = document.getElementById('adminSortSelect');
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'newest';
    this.adminSort = 'newest';

    this.renderAdminFilterDropdowns();
    this.loadSchema();
    this.loadAdminTable();
  }

  changeAdminSort(newSort) {
    this.adminSort = newSort || 'newest';
    this.adminCurrentPage = 1;
    this.loadAdminTable();
  }

  filterAdminTable() {
    const input = document.getElementById('adminSearchInput');
    this.adminSearchQuery = input ? input.value : '';
    this.adminCurrentPage = 1;
    this.loadAdminTable();
  }

  changeAdminPage(delta) {
    const targetPage = this.adminCurrentPage + delta;
    if (targetPage >= 1 && targetPage <= this.adminTotalPages) {
      this.adminCurrentPage = targetPage;
      this.loadAdminTable();
      window.scrollTo({ top: 350, behavior: 'smooth' });
    }
  }

  changePageSize(newSize) {
    this.adminLimit = parseInt(newSize, 10) || 50;
    this.adminCurrentPage = 1;
    this.loadAdminTable();
  }

  // --- ANALYTICS DASHBOARD ---

  async loadAnalytics() {
    if (!this.isAdminLoggedIn) return;

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

  // --- SITE VISITOR ANALYTICS & LOGS ---

  async loadVisitorTopStats() {
    try {
      const res = await fetch('/api/admin/visitors/stats?timeframe=all&limit=1');
      const data = await res.json();
      if (data.success && data.overview) {
        const topTotalEl = document.getElementById('statTotalVisitors');
        const topTodayEl = document.getElementById('statTodayVisitors');
        if (topTotalEl) topTotalEl.textContent = (data.overview.totalVisits || 0).toLocaleString();
        if (topTodayEl) topTodayEl.textContent = (data.overview.todayVisits || 0).toLocaleString();
      }
    } catch (e) {
      console.warn('Visitor top stats notice:', e);
    }
  }

  changeVisitorTimeframe(timeframe) {
    this.visitorTimeframe = timeframe || 'all';
    this.visitorCurrentPage = 1;
    this.loadVisitorStats();
  }

  changeVisitorPage(delta) {
    const target = this.visitorCurrentPage + delta;
    if (target >= 1 && target <= this.visitorTotalPages) {
      this.visitorCurrentPage = target;
      this.loadVisitorStats();
    }
  }

  changeVisitorLimit(limit) {
    this.visitorLimit = parseInt(limit, 10) || 25;
    this.visitorCurrentPage = 1;
    this.loadVisitorStats();
  }

  async confirmClearVisitorLogs() {
    const range = prompt('Choose logs to clear:\nType "all" for all logs\nType "30days" for older than 30 days\nType "90days" for older than 90 days', '30days');
    if (!range || !['all', '30days', '90days'].includes(range.toLowerCase().trim())) {
      return;
    }

    if (!confirm(`Are you sure you want to clear ${range} visitor logs? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch('/api/admin/visitors/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ range: range.toLowerCase().trim() })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message || 'Visitor logs cleared!');
        this.loadVisitorStats(true);
      } else {
        alert(data.error || 'Failed to clear logs.');
      }
    } catch (err) {
      alert('Error clearing visitor logs.');
    }
  }

  async loadVisitorStats(forceRefresh = false) {
    if (!this.isAdminLoggedIn) return;

    const totalEl = document.getElementById('statVisitorTotal');
    const uniqueEl = document.getElementById('statVisitorUnique');
    const todayEl = document.getElementById('statVisitorToday');
    const todayUniqueEl = document.getElementById('statVisitorTodayUnique');
    const weekEl = document.getElementById('statVisitorWeek');
    const trendChartEl = document.getElementById('visitorTrendChart');
    const topPagesEl = document.getElementById('visitorTopPagesList');
    const deviceListEl = document.getElementById('visitorDeviceList');
    const referrerListEl = document.getElementById('visitorReferrerList');
    const browserGridEl = document.getElementById('visitorBrowserGrid');
    const tableBody = document.getElementById('visitorLogTableBody');
    const pageIndicator = document.getElementById('visitorPageIndicator');
    const prevBtn = document.getElementById('visitorPrevBtn');
    const nextBtn = document.getElementById('visitorNextBtn');

    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">⏳ Loading visitor analytics...</td></tr>`;
    }

    try {
      const queryParams = new URLSearchParams({
        timeframe: this.visitorTimeframe,
        page: this.visitorCurrentPage,
        limit: this.visitorLimit
      });

      const res = await fetch(`/api/admin/visitors/stats?${queryParams.toString()}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      // 1. Overview cards
      const ov = data.overview || {};
      if (totalEl) totalEl.textContent = (ov.totalVisits || 0).toLocaleString();
      if (uniqueEl) uniqueEl.textContent = (ov.uniqueVisitors || 0).toLocaleString();
      if (todayEl) todayEl.textContent = (ov.todayVisits || 0).toLocaleString();
      if (todayUniqueEl) todayUniqueEl.textContent = (ov.todayUnique || 0).toLocaleString();
      if (weekEl) weekEl.textContent = (ov.last7DaysVisits || 0).toLocaleString();

      // Also update top header stat cards
      const topTotalEl = document.getElementById('statTotalVisitors');
      const topTodayEl = document.getElementById('statTodayVisitors');
      if (topTotalEl) topTotalEl.textContent = (ov.totalVisits || 0).toLocaleString();
      if (topTodayEl) topTodayEl.textContent = (ov.todayVisits || 0).toLocaleString();

      // 2. Trend Bar Chart
      if (trendChartEl && data.dailyTrend && data.dailyTrend.length > 0) {
        trendChartEl.innerHTML = '';
        const maxViews = Math.max(...data.dailyTrend.map(d => d.pageviews), 1);

        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'trend-bars-wrapper';

        data.dailyTrend.forEach(day => {
          const heightPct = Math.max(12, Math.round((day.pageviews / maxViews) * 100));
          const col = document.createElement('div');
          col.className = 'trend-bar-column';
          col.innerHTML = `
            <div class="trend-bar-tooltip">
              <strong>${this.escapeHtml(day.label)}</strong><br>
              ${day.pageviews} visits &bull; ${day.unique} unique
            </div>
            <div class="trend-bar-track">
              <div class="trend-bar-fill" style="height: ${heightPct}%;">
                <span class="trend-bar-val">${day.pageviews > 0 ? day.pageviews : ''}</span>
              </div>
            </div>
            <div class="trend-bar-label">${this.escapeHtml(day.label)}</div>
          `;
          chartWrapper.appendChild(col);
        });

        trendChartEl.appendChild(chartWrapper);
      }

      // 3. Top Pages
      if (topPagesEl) {
        topPagesEl.innerHTML = '';
        if (!data.topPages || data.topPages.length === 0) {
          topPagesEl.innerHTML = '<p class="text-muted" style="padding:0.75rem 0;">No pageviews recorded yet.</p>';
        } else {
          data.topPages.forEach(p => {
            const item = document.createElement('div');
            item.className = 'breakdown-item';
            item.innerHTML = `
              <div class="breakdown-label-row">
                <span class="breakdown-label-path" title="${this.escapeHtml(p.path)}">${this.escapeHtml(p.label)}</span>
                <span><strong>${p.count}</strong> views (${p.percentage}%)</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${p.percentage}%;"></div>
              </div>
            `;
            topPagesEl.appendChild(item);
          });
        }
      }

      // 4. Device Breakdown
      if (deviceListEl) {
        deviceListEl.innerHTML = '';
        if (!data.devices || data.devices.length === 0) {
          deviceListEl.innerHTML = '<p class="text-muted" style="padding:0.75rem 0;">No device data.</p>';
        } else {
          const deviceIcons = {
            'Mobile': '📱',
            'Desktop': '💻',
            'Tablet': '📟',
            'Other': '🌐'
          };
          data.devices.forEach(d => {
            const icon = deviceIcons[d.name] || '💻';
            const item = document.createElement('div');
            item.className = 'breakdown-item';
            item.innerHTML = `
              <div class="breakdown-label-row">
                <span><span style="margin-right:0.35rem;">${icon}</span><strong>${this.escapeHtml(d.name)}</strong></span>
                <span><strong>${d.count}</strong> (${d.percentage}%)</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${d.percentage}%;"></div>
              </div>
            `;
            deviceListEl.appendChild(item);
          });
        }
      }

      // 5. Top Referrers
      if (referrerListEl) {
        referrerListEl.innerHTML = '';
        if (!data.referrers || data.referrers.length === 0) {
          referrerListEl.innerHTML = '<p class="text-muted" style="padding:0.75rem 0;">No referrer data.</p>';
        } else {
          data.referrers.forEach(r => {
            const item = document.createElement('div');
            item.className = 'breakdown-item';
            item.innerHTML = `
              <div class="breakdown-label-row">
                <span>🧭 <strong>${this.escapeHtml(r.name)}</strong></span>
                <span><strong>${r.count}</strong> (${r.percentage}%)</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${r.percentage}%;"></div>
              </div>
            `;
            referrerListEl.appendChild(item);
          });
        }
      }

      // 6. Browsers & OS Pills
      if (browserGridEl) {
        browserGridEl.innerHTML = '';
        const allItems = [
          ...(data.browsers || []).map(b => ({ icon: '🌐', label: b.name, count: b.count })),
          ...(data.operatingSystems || []).map(o => ({ icon: '💻', label: o.name, count: o.count }))
        ];

        if (allItems.length === 0) {
          browserGridEl.innerHTML = '<p class="text-muted" style="grid-column: 1/-1;">No browser data recorded yet.</p>';
        } else {
          allItems.forEach(item => {
            const pill = document.createElement('div');
            pill.className = 'bg-stat-pill';
            pill.innerHTML = `
              <span class="bg-stat-type">${item.icon} ${this.escapeHtml(item.label)}</span>
              <span class="bg-stat-count">${item.count}</span>
            `;
            browserGridEl.appendChild(pill);
          });
        }
      }

      // 7. Recent Activity Logs Table
      if (tableBody) {
        tableBody.innerHTML = '';
        const logs = data.logs || [];
        if (logs.length === 0) {
          tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2.5rem; color: var(--text-muted);">No visitor activity recorded in this timeframe yet.</td></tr>`;
        } else {
          const deviceIcons = { 'Mobile': '📱', 'Desktop': '💻', 'Tablet': '📟', 'Other': '🌐' };
          logs.forEach(log => {
            const tr = document.createElement('tr');
            const d = new Date(log.visitedAt);
            const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            const devIcon = deviceIcons[log.deviceType] || '💻';

            let pageBadgeClass = 'badge-general';
            if (log.path === '/' || log.path === '/index.html') pageBadgeClass = 'badge-home';
            else if (log.path.includes('profile')) pageBadgeClass = 'badge-profile';
            else if (log.path.includes('admin')) pageBadgeClass = 'badge-admin';

            tr.innerHTML = `
              <td>
                <div style="font-weight: 600; font-size: 0.85rem;">${timeStr}</div>
                <div class="text-muted" style="font-size: 0.75rem;">${dateStr}</div>
              </td>
              <td>
                <span class="visitor-page-badge ${pageBadgeClass}" title="${this.escapeHtml(log.path)}">${this.escapeHtml(log.path)}</span>
              </td>
              <td>
                <span class="visitor-device-badge">
                  <span>${devIcon}</span>
                  <span>${this.escapeHtml(log.deviceType)}</span>
                </span>
              </td>
              <td>
                <div style="font-size: 0.85rem; font-weight: 600;">${this.escapeHtml(log.browser)}</div>
                <div class="text-muted" style="font-size: 0.75rem;">${this.escapeHtml(log.os)}</div>
              </td>
              <td>
                <span class="visitor-source-badge">${this.escapeHtml(log.referrer)}</span>
              </td>
              <td>
                <code style="font-size: 0.8rem; background: var(--bg-subtle); padding: 0.15rem 0.4rem; border-radius: 4px; border: 1px solid var(--border-color);">${this.escapeHtml(log.ip)}</code>
              </td>
            `;
            tableBody.appendChild(tr);
          });
        }
      }

      // 8. Pagination
      const pagination = data.pagination || {};
      this.visitorTotalPages = pagination.totalPages || 1;
      this.visitorCurrentPage = pagination.page || 1;
      if (pageIndicator) {
        pageIndicator.textContent = `Page ${this.visitorCurrentPage} of ${this.visitorTotalPages} (${pagination.totalLogs || 0} total)`;
      }
      if (prevBtn) prevBtn.disabled = this.visitorCurrentPage <= 1;
      if (nextBtn) nextBtn.disabled = this.visitorCurrentPage >= this.visitorTotalPages;

    } catch (err) {
      console.error('Failed to load visitor stats:', err);
      if (tableBody) {
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #dc2626;">Failed to load visitor data: ${this.escapeHtml(err.message)}</td></tr>`;
      }
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

  openAddRecordModal() {
    const modal = document.getElementById('editRecordModal');
    const title = document.getElementById('editModalTitle');
    const idInput = document.getElementById('editRecordId');
    const fieldsContainer = document.getElementById('dynamicFormFields');
    const alertEl = document.getElementById('editRecordAlert');

    if (!modal) return;
    alertEl.classList.add('hidden');
    idInput.value = '';
    title.textContent = '➕ Add New Donor Record';

    const columns = this.schema.columns && this.schema.columns.length > 0 ? this.schema.columns : ['Name', 'Phone', 'District', 'Blood Group'];

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

  toSentenceCase(str) {
    if (typeof str !== 'string' || !str) return str;
    const trimmed = str.trim();
    if (/^(A|B|AB|O)[+-]$/i.test(trimmed)) return trimmed.toUpperCase();
    if (/^\+?[0-9\s-]+$/.test(trimmed) || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

    return trimmed.split(/\s+/).map(word => {
      if (!word) return '';
      if (/^Fr\.?$/i.test(word)) return 'Fr';
      if (/^Dr\.?$/i.test(word)) return 'Dr';
      if (word.length === 1) return word.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }).join(' ');
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
