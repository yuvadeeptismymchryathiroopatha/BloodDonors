/**
 * Bloodrupatha - Public Search Directory Application Logic
 * Supports filtering by Zone (മേഖല), Blood Group (രക്തഗ്രൂപ്പ്), Forona (ഫൊറോന), and Unit (യൂണിറ്റ്).
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

    this.init();
  }

  async init() {
    this.bindEvents();
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
  }

  // --- PUBLIC SCHEMA & FILTER CONTROLS ---

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
    if (!container) return;

    container.innerHTML = '';

    const filterableOpts = this.schema.filterableOptions || {};
    const columns = this.schema.columns || [];

    // Locate Keys
    const zoneKey = columns.find(c => /zone|മേഖല/i.test(c)) || 'Zone (മേഖല)';
    const bloodGroupKey = columns.find(c => /blood|group|bg/i.test(c)) || 'Blood Group';
    const foronaKey = columns.find(c => /forona|ഫൊറോന/i.test(c)) || 'Forona (ഫൊറോന)';
    const unitKey = columns.find(c => /unit|യൂണിറ്റ്/i.test(c)) || 'Unit (യൂണിറ്റ്)';

    // 1. Zone Filter (മേഖല)
    const zoneOptions = filterableOpts[zoneKey] || this.extractOptionsByRegex(/zone|മേഖല/i);
    this.createSelectFilterGroup({
      container,
      columnKey: zoneKey,
      label: '🗺️ Zone (മേഖല)',
      placeholder: 'All Zones (എല്ലാ മേഖലയും)',
      options: zoneOptions
    });

    // 2. Blood Group Filter (രക്തഗ്രൂപ്പ്)
    const defaultBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const uploadedBloodGroups = filterableOpts[bloodGroupKey] || [];
    const combinedBloodGroups = Array.from(new Set([...defaultBloodGroups, ...uploadedBloodGroups])).sort();

    this.createSelectFilterGroup({
      container,
      columnKey: bloodGroupKey,
      label: '🩸 Blood Group (രക്തഗ്രൂപ്പ്)',
      placeholder: 'All Blood Groups',
      options: combinedBloodGroups
    });

    // 3. Forona Filter (ഫൊറോന)
    const foronaOptions = filterableOpts[foronaKey] || this.extractOptionsByRegex(/forona|ഫൊറോന/i);
    this.createSelectFilterGroup({
      container,
      columnKey: foronaKey,
      label: '🏛️ Forona (ഫൊറോന)',
      placeholder: 'All Foronas (എല്ലാ ഫൊറോനയും)',
      options: foronaOptions
    });

    // 4. Unit Filter (യൂണിറ്റ്)
    const unitOptions = filterableOpts[unitKey] || this.extractOptionsByRegex(/unit|യൂണിറ്റ്/i);
    this.createSelectFilterGroup({
      container,
      columnKey: unitKey,
      label: '🏢 Unit (യൂണിറ്റ്)',
      placeholder: 'All Units (എല്ലാ യൂണിറ്റും)',
      options: unitOptions
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
    if (datasetMeta) {
      if (this.schema.totalRecords > 0) {
        datasetMeta.textContent = `(${this.schema.totalRecords} total active records)`;
      } else {
        datasetMeta.textContent = '(No dataset uploaded)';
      }
    }
  }

  // --- DATA SEARCH & CARD RENDERING ---

  async performSearch() {
    const container = document.getElementById('resultsContainer');
    const countEl = document.getElementById('resultsCount');
    if (!container) return;

    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⏳</div>
        <h3 class="empty-title">Searching Donors...</h3>
        <p class="empty-desc">Fetching eligible donor records (Age 18 - 55)</p>
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
      countEl.textContent = `${records.length} Eligible Donor(s) Found`;
    }

    if (!records || records.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3 class="empty-title">No matching eligible donors found</h3>
          <p class="empty-desc">Try clearing search keywords or selecting different Zone / Forona / Unit filters. Note: Only donors aged 18 to 55 are displayed.</p>
          ${Object.keys(this.filters).length > 0 || this.searchQuery ? `
            <button class="btn btn-outline btn-sm" onclick="app.resetAllSearch()">Reset Filters</button>
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
