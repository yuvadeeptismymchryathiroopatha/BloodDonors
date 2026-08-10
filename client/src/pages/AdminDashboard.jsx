import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import { UploadCloud, FileText, Download, CheckCircle, AlertCircle, Users, Package, Settings, RefreshCw, Trash2, Edit3, Check, X, Shield, Phone, MapPin, Eye } from 'lucide-react';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('csv'); // 'csv' | 'donors' | 'requests' | 'inventory'
  const [stats, setStats] = useState({ totalDonors: 0, availableDonors: 0, pendingRequests: 0, totalBloodUnits: 0 });
  
  const [donors, setDonors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // CSV Import State
  const [csvFile, setCsvFile] = useState(null);
  const [parsedCsvData, setParsedCsvData] = useState([]);
  const [importingCsv, setImportingCsv] = useState(false);
  const [csvParseError, setCsvParseError] = useState('');

  // Inventory Editing
  const [editingGroup, setEditingGroup] = useState(null);
  const [newUnits, setNewUnits] = useState(0);

  // Toast notification
  const [notification, setNotification] = useState(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, donorsRes, reqRes, invRes] = await Promise.all([
        API.get('/stats'),
        API.get('/donors/admin/all'),
        API.get('/requests'),
        API.get('/inventory')
      ]);

      setStats(statsRes.data);
      setDonors(donorsRes.data);
      setRequests(reqRes.data);
      setInventory(invRes.data);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      showToast('Failed to fetch dashboard data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // CSV Parsing logic
  const handleCsvFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setCsvParseError('Please upload a valid .csv file.');
      return;
    }

    setCsvFile(file);
    setCsvParseError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
          setCsvParseError('CSV file is empty or missing data rows.');
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          if (values.length < 4) continue;

          const rowObj = {};
          headers.forEach((header, index) => {
            rowObj[header] = values[index] !== undefined ? values[index] : '';
          });

          // Standardize column keys
          const donorObj = {
            name: rowObj.name || rowObj.donorname || rowObj.fullname || '',
            age: rowObj.age || 25,
            gender: rowObj.gender || 'Male',
            blood_group: rowObj.blood_group || rowObj.bloodgroup || rowObj.group || 'O+',
            phone: rowObj.phone || rowObj.mobile || rowObj.contact || '',
            email: rowObj.email || '',
            city: rowObj.city || rowObj.location || rowObj.area || '',
            address: rowObj.address || '',
            last_donation_date: rowObj.last_donation_date || rowObj.lastdate || null,
            is_available: rowObj.is_available === 'false' || rowObj.is_available === '0' ? false : true
          };

          if (donorObj.name && donorObj.phone && donorObj.city) {
            rows.push(donorObj);
          }
        }

        if (rows.length === 0) {
          setCsvParseError('No valid donor records parsed. Ensure columns: name, age, gender, blood_group, phone, city.');
        } else {
          setParsedCsvData(rows);
        }
      } catch (err) {
        console.error('Error parsing CSV:', err);
        setCsvParseError('Error parsing CSV file formatting.');
      }
    };
    reader.readAsText(file);
  };

  // Submit CSV batch import to server
  const handleImportCsvSubmit = async () => {
    if (parsedCsvData.length === 0) return;

    try {
      setImportingCsv(true);
      const res = await API.post('/donors/bulk', { donors: parsedCsvData });
      showToast(res.data.message || `Imported ${parsedCsvData.length} records successfully!`);
      setCsvFile(null);
      setParsedCsvData([]);
      fetchDashboardData();
      setActiveTab('donors');
    } catch (err) {
      console.error('Failed to import CSV:', err);
      showToast(err.response?.data?.error || 'Failed to import CSV records.', 'error');
    } finally {
      setImportingCsv(false);
    }
  };

  // Download Sample CSV
  const handleDownloadSampleCsv = () => {
    window.open('http://localhost:5000/api/donors/sample-csv', '_blank');
  };

  // Donor Status & Delete
  const handleToggleDonorAvailable = async (donor) => {
    try {
      await API.put(`/donors/${donor.id}`, { ...donor, is_available: !donor.is_available });
      showToast(`Donor ${donor.name} availability updated.`);
      fetchDashboardData();
    } catch (err) {
      showToast('Failed to update status.', 'error');
    }
  };

  const handleDeleteDonor = async (id, name) => {
    if (!window.confirm(`Delete donor record for ${name}?`)) return;
    try {
      await API.delete(`/donors/${id}`);
      showToast(`Donor ${name} deleted.`);
      fetchDashboardData();
    } catch (err) {
      showToast('Failed to delete donor.', 'error');
    }
  };

  // Inventory Save
  const handleSaveInventory = async (bloodGroup) => {
    try {
      await API.put('/inventory', { bloodGroup, units: newUnits });
      showToast(`Stock level for ${bloodGroup} updated to ${newUnits} units.`);
      setEditingGroup(null);
      fetchDashboardData();
    } catch (err) {
      showToast('Failed to update inventory.', 'error');
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 20px' }}>
      
      {/* Notification Toast */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          background: notification.type === 'error' ? 'rgba(239, 68, 68, 0.95)' : 'rgba(16, 185, 129, 0.95)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-lg)',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
          {notification.msg}
        </div>
      )}

      {/* Header Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '28px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Shield size={28} color="var(--primary)" />
            <h1 style={{ fontSize: '2rem' }}>Admin Management Panel</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Upload CSV donor databases, manage patient requests, and update Admin credentials.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={fetchDashboardData} className="btn btn-secondary" id="btn-refresh-data">
            <RefreshCw size={16} /> Refresh Data
          </button>
          <Link to="/admin/settings" id="btn-admin-settings" className="btn btn-primary">
            <Settings size={16} /> Change Username & Password
          </Link>
        </div>
      </div>

      {/* Stats Cards Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Donors</div>
          <div style={{ fontSize: '2.2rem', fontWeight: '800', color: 'var(--text-primary)', margin: '4px 0' }}>{stats.totalDonors}</div>
          <div style={{ fontSize: '0.8rem', color: '#34d399' }}>{stats.availableDonors} currently available</div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Pending Requests</div>
          <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#f59e0b', margin: '4px 0' }}>{stats.pendingRequests}</div>
          <div style={{ fontSize: '0.8rem', color: '#f87171' }}>{stats.emergencyRequests || 0} emergency priority</div>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Blood Stock</div>
          <div style={{ fontSize: '2.2rem', fontWeight: '800', color: '#38bdf8', margin: '4px 0' }}>{stats.totalBloodUnits} <span style={{ fontSize: '0.9rem' }}>Units</span></div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Spread across 8 groups</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border)', marginBottom: '24px', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('csv')}
          id="tab-csv-import"
          className={`btn ${activeTab === 'csv' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <UploadCloud size={18} /> Bulk Import CSV Data
        </button>
        <button
          onClick={() => setActiveTab('donors')}
          id="tab-donors-list"
          className={`btn ${activeTab === 'donors' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Users size={18} /> Donors Database ({donors.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          id="tab-requests-list"
          className={`btn ${activeTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <AlertCircle size={18} /> Blood Requests ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          id="tab-inventory-list"
          className={`btn ${activeTab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Package size={18} /> Inventory Stock ({inventory.length})
        </button>
      </div>

      {/* TAB CONTENT */}

      {/* 1. CSV BULK DATA IMPORT TAB */}
      {activeTab === 'csv' && (
        <div>
          <div className="glass-card" style={{ padding: '32px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '6px' }}>Upload Donor Database (.CSV File)</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Select or drag a CSV file containing donor records to instantly populate the PostgreSQL database.
                </p>
              </div>

              <button onClick={handleDownloadSampleCsv} className="btn btn-secondary btn-sm" id="btn-download-sample-csv">
                <Download size={15} /> Download Sample CSV Template
              </button>
            </div>

            {/* Drag and Drop Zone */}
            <div style={{
              border: '2px dashed var(--border-active)',
              borderRadius: 'var(--radius-lg)',
              padding: '40px 20px',
              textAlign: 'center',
              background: 'rgba(17, 24, 39, 0.6)',
              cursor: 'pointer',
              transition: 'var(--transition)'
            }}>
              <input
                type="file"
                accept=".csv"
                id="csv-file-input"
                onChange={handleCsvFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="csv-file-input" style={{ cursor: 'pointer', display: 'block' }}>
                <UploadCloud size={48} color="var(--primary)" style={{ marginBottom: '12px' }} />
                <div style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '6px' }}>
                  {csvFile ? `Selected: ${csvFile.name}` : 'Click here to choose a CSV file'}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Supported headers: <code>name, age, gender, blood_group, phone, email, city, address, is_available</code>
                </div>
              </label>
            </div>

            {csvParseError && (
              <div style={{
                marginTop: '16px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#f87171',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.9rem'
              }}>
                <AlertCircle size={18} /> {csvParseError}
              </div>
            )}
          </div>

          {/* PARSED CSV PREVIEW TABLE */}
          {parsedCsvData.length > 0 && (
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.3rem' }}>Parsed Records Preview ({parsedCsvData.length} Donors)</h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Review the data below before saving to the Neon PostgreSQL database.
                  </p>
                </div>
                <button
                  onClick={handleImportCsvSubmit}
                  id="btn-confirm-csv-import"
                  className="btn btn-primary"
                  disabled={importingCsv}
                  style={{ padding: '12px 24px' }}
                >
                  {importingCsv ? 'Saving to Database...' : `Import ${parsedCsvData.length} Donors to Database`}
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '750px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <th style={{ padding: '10px' }}>#</th>
                      <th style={{ padding: '10px' }}>Name</th>
                      <th style={{ padding: '10px' }}>Group</th>
                      <th style={{ padding: '10px' }}>Phone</th>
                      <th style={{ padding: '10px' }}>City</th>
                      <th style={{ padding: '10px' }}>Age/Gender</th>
                      <th style={{ padding: '10px' }}>Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedCsvData.slice(0, 10).map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.88rem' }}>
                        <td style={{ padding: '10px', color: 'var(--text-muted)' }}>{idx + 1}</td>
                        <td style={{ padding: '10px', fontWeight: '600' }}>{row.name}</td>
                        <td style={{ padding: '10px' }}><span className="badge badge-blood">{row.blood_group}</span></td>
                        <td style={{ padding: '10px' }}>{row.phone}</td>
                        <td style={{ padding: '10px' }}>{row.city}</td>
                        <td style={{ padding: '10px' }}>{row.age} / {row.gender}</td>
                        <td style={{ padding: '10px' }}>
                          <span className={`badge ${row.is_available ? 'badge-success' : 'badge-danger'}`}>
                            {row.is_available ? 'True' : 'False'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {parsedCsvData.length > 10 && (
                  <div style={{ textAlign: 'center', paddingTop: '14px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    ... and {parsedCsvData.length - 10} more records ready to import.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. DONORS DATABASE TAB */}
      {activeTab === 'donors' && (
        <div className="glass-card" style={{ padding: '24px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '12px' }}>Donor Name</th>
                <th style={{ padding: '12px' }}>Group</th>
                <th style={{ padding: '12px' }}>Contact Phone</th>
                <th style={{ padding: '12px' }}>City / Location</th>
                <th style={{ padding: '12px' }}>Availability</th>
                <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {donors.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No donor records found. Use the CSV Bulk Import tab to add records.
                  </td>
                </tr>
              ) : (
                donors.map((d) => (
                  <tr key={d.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '14px' }}>
                      <div style={{ fontWeight: '600' }}>{d.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Age: {d.age} | {d.gender}</div>
                    </td>
                    <td style={{ padding: '14px' }}>
                      <span className="badge badge-blood">{d.blood_group}</span>
                    </td>
                    <td style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={14} color="var(--primary)" /> {d.phone}
                      </div>
                    </td>
                    <td style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={14} color="var(--text-muted)" /> {d.city}
                      </div>
                    </td>
                    <td style={{ padding: '14px' }}>
                      <button
                        onClick={() => handleToggleDonorAvailable(d)}
                        className={`badge ${d.is_available ? 'badge-success' : 'badge-danger'}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                      >
                        {d.is_available ? 'Available' : 'Unavailable'}
                      </button>
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDeleteDonor(d.id, d.name)}
                        className="btn btn-outline-danger btn-sm"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 3. BLOOD REQUESTS TAB */}
      {activeTab === 'requests' && (
        <div className="glass-card" style={{ padding: '24px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <th style={{ padding: '12px' }}>Patient / Urgency</th>
                <th style={{ padding: '12px' }}>Blood Group & Units</th>
                <th style={{ padding: '12px' }}>Hospital & Location</th>
                <th style={{ padding: '12px' }}>Contact Phone</th>
                <th style={{ padding: '12px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No blood requests.
                  </td>
                </tr>
              ) : (
                requests.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                    <td style={{ padding: '14px' }}>
                      <div style={{ fontWeight: '600' }}>{r.patient_name}</div>
                      <span className={`badge ${r.urgency === 'Emergency' ? 'badge-danger' : 'badge-warning'}`}>
                        {r.urgency}
                      </span>
                    </td>
                    <td style={{ padding: '14px' }}>
                      <span className="badge badge-blood">{r.blood_group}</span>
                      <span style={{ marginLeft: '8px', fontWeight: '600' }}>{r.units_needed} Units</span>
                    </td>
                    <td style={{ padding: '14px' }}>
                      <div>{r.hospital_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{r.city}</div>
                    </td>
                    <td style={{ padding: '14px' }}>
                      <div>{r.contact_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--primary)' }}>{r.contact_phone}</div>
                    </td>
                    <td style={{ padding: '14px' }}>
                      <span className={`badge ${r.status === 'Fulfilled' ? 'badge-success' : 'badge-warning'}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 4. BLOOD INVENTORY STOCK TAB */}
      {activeTab === 'inventory' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '20px' }}>
          {inventory.map((item) => (
            <div key={item.id} className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', fontWeight: '800', color: 'var(--primary)', marginBottom: '8px' }}>
                {item.blood_group}
              </div>

              {editingGroup === item.blood_group ? (
                <div style={{ marginTop: '12px' }}>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    value={newUnits}
                    onChange={(e) => setNewUnits(e.target.value)}
                    style={{ textAlign: 'center', marginBottom: '12px', fontSize: '1.2rem', fontWeight: '700' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    <button onClick={() => handleSaveInventory(item.blood_group)} className="btn btn-primary btn-sm">
                      <Check size={14} /> Save
                    </button>
                    <button onClick={() => setEditingGroup(null)} className="btn btn-secondary btn-sm">
                      <X size={14} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '2.5rem', fontWeight: '800', margin: '8px 0' }}>
                    {item.units} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Units</span>
                  </div>
                  <button
                    onClick={() => {
                      setEditingGroup(item.blood_group);
                      setNewUnits(item.units);
                    }}
                    className="btn btn-secondary btn-sm"
                    style={{ marginTop: '12px', width: '100%' }}
                  >
                    <Edit3 size={14} /> Edit Stock Units
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
