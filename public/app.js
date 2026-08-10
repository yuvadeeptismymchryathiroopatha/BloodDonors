/**
 * Bloodrupatha - Yuva Blood Forum App Script
 * Supports filtering by Zone (മേഖല), Blood Group (രക്തഗ്രൂപ്പ്), and Forane (ഫൊറോന).
 * Enforces Age restriction (18 to 55) and Cooling Period (90 days).
 */

class BloodDonorApp {
  constructor() {
    this.schema = {
      columns: [],
      filterableOptions: {},
      totalRecords: 0
    };
    this.currentPage = 1;
    this.limit = 12;
    this.searchQuery = '';
    this.filters = {};
    this.activeRequestController = null;

    // Zone to Foranes official mapping
    this.zoneForaneMap = {
      'kottayam': ['Kottayam', 'Kudamaloor', 'Athirampuzha', 'Manimala', 'Nedumkunnam'],
      'changanacherry': ['Changanacherry', 'Changanassery', 'Thuruthy', 'Thrickodithanam', 'Thrikodithanam', 'Kurumpanadom'],
      'alappuzha': ['Alappuzha', 'Alapuzha', 'Muhamma'],
      'kuttanad': ['Edathua', 'Pulincunno', 'Pulinkunnoo', 'Champakulam'],
      'kollam': ['Kollam-Ayoor', 'Kollam', 'Kollam-ayoor'],
      'trivandrum': ['Trivandrum', 'Thiruvananthapuram', 'Amboori'],
      'chenganoor': ['Chenganoor', 'Chengannur']
    };

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.fetchSchema();
    this.performSearch();
  }

  setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const clearSearchBtn = document.getElementById('clearSearchBtn');

    if (searchInput) {
      let debounceTimeout = null;
      searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (clearSearchBtn) {
          if (val.trim()) {
            clearSearchBtn.classList.remove('hidden');
          } else {
            clearSearchBtn.classList.add('hidden');
          }
        }

        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => {
          this.searchQuery = val.trim();
          this.currentPage = 1;
          this.performSearch();
        }, 300);
      });

      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.searchQuery = searchInput.value.trim();
          this.currentPage = 1;
          this.performSearch();
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => {
        if (searchInput) {
          this.searchQuery = searchInput.value.trim();
        }
        this.currentPage = 1;
        this.performSearch();
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) {
          searchInput.value = '';
          this.searchQuery = '';
          clearSearchBtn.classList.add('hidden');
          this.currentPage = 1;
          this.performSearch();
        }
      });
    }
  }

  async fetchSchema() {
    try {
      const response = await fetch('/api/schema');
      const data = await response.json();
      if (data.success) {
        this.schema = data;
        this.renderFilterControls();
      }
    } catch (err) {
      console.error('Failed to fetch schema:', err);
    }
  }

  renderFilterControls() {
    const container = document.getElementById('filterControlsContainer');
    if (!container) return;

    container.innerHTML = '';

    const filterableOpts = this.schema.filterableOptions || {};
    const columns = this.schema.columns || [];

    // Locate Filter Keys
    const zoneKey = columns.find(c => /zone|മേഖല/i.test(c)) || 'Zone (മേഖല)';
    const bloodGroupKey = columns.find(c => /blood|group|bg/i.test(c)) || 'Blood Group';
    const foronaKey = columns.find(c => /forona|forane|ഫൊറോന/i.test(c)) || 'Forane (ഫൊറോന)';

    this.zoneKey = zoneKey;
    this.foronaKey = foronaKey;

    // 1. Zone Filter (മേഖല)
    const zoneOptions = filterableOpts[zoneKey] || this.extractOptionsByRegex(/zone|മേഖല/i);
    const zoneSelect = this.createSelectFilterGroup({
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

    // 3. Forane Filter (ഫൊറോന)
    const defaultForanes = [
      'Kottayam', 'Athirampuzha', 'Kudamaloor', 'Muhamma', 'Manimala', 
      'Nedumkunnam', 'Kurumpanadom', 'Thrickodithanam', 'Thuruthy', 'Changanacherry', 
      'Edathua', 'Pulincunno', 'Champakulam', 'Chenganoor', 'Alappuzha', 
      'Kollam-Ayoor', 'Trivandrum', 'Amboori'
    ];
    const uploadedForanes = filterableOpts[foronaKey] || this.extractOptionsByRegex(/forona|forane|ഫൊറോന/i);
    const combinedForanes = Array.from(new Set([...defaultForanes, ...uploadedForanes])).sort();

    const foraneSelect = this.createSelectFilterGroup({
      container,
      columnKey: foronaKey,
      label: '🏛️ Forane (ഫൊറോന)',
      placeholder: 'All Foranes (എല്ലാ ഫൊറോനയും)',
      options: combinedForanes
    });

    this.foraneSelectEl = foraneSelect;

    // Attach Zone Change listener for Dynamic Dependent Filtering (Zone -> Foranes)
    if (zoneSelect) {
      zoneSelect.addEventListener('change', (e) => {
        const selectedZone = e.target.value;
        this.updateForaneOptionsForZone(selectedZone, foraneSelect, foronaKey);
      });
    }

    this.toggleResetButton();
  }

  updateForaneOptionsForZone(selectedZoneVal, foraneSelectEl, foronaKey) {
    if (!foraneSelectEl) return;

    const allForanes = [
      'Kottayam', 'Athirampuzha', 'Kudamaloor', 'Muhamma', 'Manimala', 
      'Nedumkunnam', 'Kurumpanadom', 'Thrickodithanam', 'Thuruthy', 'Changanacherry', 
      'Edathua', 'Pulincunno', 'Champakulam', 'Chenganoor', 'Alappuzha', 
      'Kollam-Ayoor', 'Trivandrum', 'Amboori'
    ];

    let allowedForanes = allForanes;

    if (selectedZoneVal) {
      const normZone = selectedZoneVal.toLowerCase().replace('zone', '').trim();
      const matchedKey = Object.keys(this.zoneForaneMap).find(k => normZone.includes(k) || k.includes(normZone));
      if (matchedKey) {
        allowedForanes = this.zoneForaneMap[matchedKey];
      }
    }

    const currentSelected = this.filters[foronaKey];

    foraneSelectEl.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = selectedZoneVal ? `All Foranes in ${selectedZoneVal}` : 'All Foranes (എല്ലാ ഫൊറോനയും)';
    foraneSelectEl.appendChild(defaultOpt);

    allowedForanes.forEach(val => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = val;
      if (currentSelected === val) {
        opt.selected = true;
      }
      foraneSelectEl.appendChild(opt);
    });

    if (currentSelected && !allowedForanes.includes(currentSelected)) {
      delete this.filters[foronaKey];
      foraneSelectEl.value = '';
    }
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

    return select;
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
    if (this.foraneSelectEl) {
      this.updateForaneOptionsForZone('', this.foraneSelectEl, this.foronaKey);
    }
    this.currentPage = 1;
    this.performSearch();
    this.toggleResetButton();
  }

  async performSearch() {
    if (this.activeRequestController) {
      this.activeRequestController.abort();
    }
    this.activeRequestController = new AbortController();

    const resultsContainer = document.getElementById('resultsContainer');
    const resultsCount = document.getElementById('resultsCount');

    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⏳</div>
          <h3 class="empty-title">Searching Blood Donors...</h3>
          <p class="empty-desc">Fetching active eligible donors (Age 18 to 55).</p>
        </div>
      `;
    }

    try {
      const params = new URLSearchParams({
        page: this.currentPage,
        limit: this.limit
      });

      if (this.searchQuery) {
        params.append('q', this.searchQuery);
      }

      if (Object.keys(this.filters).length > 0) {
        params.append('filters', JSON.stringify(this.filters));
      }

      const response = await fetch(`/api/search?${params.toString()}`, {
        signal: this.activeRequestController.signal
      });

      const data = await response.json();

      if (data.success) {
        this.renderResults(data.records, data.pagination);
      } else {
        this.renderError(data.error || 'Search failed.');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('Search request error:', err);
      this.renderError('Unable to load donor records. Please check server connection.');
    }
  }

  renderResults(records, pagination) {
    const container = document.getElementById('resultsContainer');
    const resultsCount = document.getElementById('resultsCount');
    const paginationContainer = document.getElementById('paginationContainer');

    if (!container) return;

    if (resultsCount) {
      const total = pagination.totalRecords || 0;
      resultsCount.textContent = `${total.toLocaleString()} Eligible Active Donor(s) Found`;
    }

    if (!records || records.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🩸</div>
          <h3 class="empty-title">No Eligible Active Donors Found</h3>
          <p class="empty-desc">Try clearing search keywords or selecting different Zone / Forane filters. Note: Only donors aged 18 to 55 are displayed.</p>
          <button class="btn btn-outline btn-sm" onclick="app.resetFilters()">Reset All Filters</button>
        </div>
      `;
      if (paginationContainer) paginationContainer.classList.add('hidden');
      return;
    }

    container.innerHTML = '';

    records.forEach(donor => {
      const card = this.createDonorCard(donor);
      container.appendChild(card);
    });

    this.renderPagination(pagination);
  }

  createDonorCard(donor) {
    const card = document.createElement('div');
    card.className = 'donor-card';

    const bloodGroupKey = Object.keys(donor).find(k => /blood|group|bg/i.test(k));
    const bloodGroup = (bloodGroupKey && donor[bloodGroupKey]) ? donor[bloodGroupKey] : 'O+';

    const nameKey = Object.keys(donor).find(k => /name|പേര്/i.test(k));
    const name = (nameKey && donor[nameKey]) ? donor[nameKey] : 'Blood Donor';

    const phoneKey = Object.keys(donor).find(k => /phone|contact|മൊബൈൽ/i.test(k));
    const phone = (phoneKey && donor[phoneKey]) ? donor[phoneKey] : '';

    const zoneKey = Object.keys(donor).find(k => /zone|മേഖല/i.test(k));
    const zone = (zoneKey && donor[zoneKey]) ? donor[zoneKey] : '';

    const foraneKey = Object.keys(donor).find(k => /forona|forane|ഫൊറോന/i.test(k));
    const forane = (foraneKey && donor[foraneKey]) ? donor[foraneKey] : '';

    const ageKey = Object.keys(donor).find(k => /age|വയസ്സ്/i.test(k));
    const age = (ageKey && donor[ageKey]) ? donor[ageKey] : '';

    let fieldsHtml = '';
    const ignoreKeys = new Set(['id', nameKey, bloodGroupKey, phoneKey]);

    Object.keys(donor).forEach(k => {
      if (ignoreKeys.has(k)) return;
      const val = donor[k];
      if (val !== undefined && val !== null && val !== '') {
        fieldsHtml += `
          <div class="field-row">
            <span class="field-label">${this.escapeHtml(k)}:</span>
            <span class="field-value">${this.escapeHtml(val.toString())}</span>
          </div>
        `;
      }
    });

    let cleanPhone = phone.replace(/[^0-9+]/g, '');
    let waPhone = cleanPhone.replace(/^\+/, '');
    if (waPhone.length === 10) waPhone = '91' + waPhone;

    card.innerHTML = `
      <div>
        <div class="donor-card-top">
          <h3 class="donor-name">${this.escapeHtml(name)}</h3>
          <span class="donor-blood-badge">${this.escapeHtml(bloodGroup)}</span>
        </div>
        
        <div class="donor-fields">
          ${fieldsHtml}
        </div>
      </div>

      <div class="donor-card-actions">
        ${cleanPhone ? `
          <a href="tel:${cleanPhone}" class="btn btn-outline btn-sm">
            📞 Call
          </a>
          <a href="https://wa.me/${waPhone}" target="_blank" rel="noopener" class="btn btn-primary btn-sm">
            💬 WhatsApp
          </a>
        ` : `
          <span class="text-muted" style="font-size:0.8rem;">No direct contact listed</span>
        `}
      </div>
    `;

    return card;
  }

  renderPagination(pagination) {
    const container = document.getElementById('paginationContainer');
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const pageIndicator = document.getElementById('pageIndicator');

    if (!container) return;

    const totalPages = pagination.totalPages || 1;
    this.currentPage = pagination.page || 1;

    if (totalPages <= 1) {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');

    if (pageIndicator) {
      pageIndicator.textContent = `Page ${this.currentPage} of ${totalPages}`;
    }

    if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
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

  renderError(message) {
    const container = document.getElementById('resultsContainer');
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3 class="empty-title">Notice</h3>
          <p class="empty-desc">${this.escapeHtml(message)}</p>
        </div>
      `;
    }
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
  window.app = new BloodDonorApp();
});
