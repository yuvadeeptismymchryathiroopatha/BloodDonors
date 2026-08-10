import React, { useEffect, useState } from 'react';
import API from '../services/api';
import { Search, Phone, MapPin, CheckCircle, XCircle, Filter } from 'lucide-react';

export default function FindDonors() {
  const [donors, setDonors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [cityFilter, setCityFilter] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  const bloodGroups = ['All', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const fetchDonors = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedGroup !== 'All') params.bloodGroup = selectedGroup;
      if (cityFilter.trim() !== '') params.city = cityFilter.trim();
      if (availableOnly) params.availableOnly = 'true';

      const res = await API.get('/donors', { params });
      setDonors(res.data);
    } catch (error) {
      console.error('Failed to fetch donors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonors();
  }, [selectedGroup, availableOnly]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDonors();
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 20px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '2.2rem', marginBottom: '8px' }}>Find Blood Donors</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
          Search for verified blood donors near your location by blood group and city.
        </p>
      </div>

      {/* FILTER SEARCH CARD */}
      <div className="glass-card" style={{ padding: '24px', marginBottom: '36px' }}>
        <form onSubmit={handleSearchSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', alignItems: 'end' }}>
            
            {/* Blood Group Select */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Blood Group</label>
              <select
                id="filter-blood-group"
                className="form-select"
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                {bloodGroups.map((group) => (
                  <option key={group} value={group}>{group === 'All' ? 'All Blood Groups' : `Group ${group}`}</option>
                ))}
              </select>
            </div>

            {/* City Search Input */}
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">City / Location</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="filter-city-input"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Downtown, North Park"
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  style={{ paddingLeft: '40px' }}
                />
                <MapPin size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              </div>
            </div>

            {/* Available Toggle & Search Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)', userSelect: 'none' }}>
                <input
                  id="filter-available-checkbox"
                  type="checkbox"
                  checked={availableOnly}
                  onChange={(e) => setAvailableOnly(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                />
                Available Only
              </label>

              <button type="submit" id="btn-search-donors" className="btn btn-primary" style={{ flexGrow: 1 }}>
                <Filter size={16} /> Filter Results
              </button>
            </div>

          </div>
        </form>
      </div>

      {/* DONOR RESULTS GRID */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          Searching donor registry...
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '16px', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            Showing <strong>{donors.length}</strong> matching donors
          </div>

          {donors.length === 0 ? (
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
              <Search size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
              <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>No Donors Found</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Try adjusting your blood group filter or city search keywords.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
              {donors.map((d) => (
                <div key={d.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                      <div>
                        <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{d.name}</h3>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Age: {d.age} | Gender: {d.gender}
                        </div>
                      </div>
                      <span className="badge badge-blood" style={{ fontSize: '1.2rem', padding: '6px 14px' }}>
                        {d.blood_group}
                      </span>
                    </div>

                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <MapPin size={16} color="var(--primary)" />
                        <span><strong>City:</strong> {d.city} {d.address ? `(${d.address})` : ''}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {d.is_available ? (
                          <>
                            <CheckCircle size={16} color="#34d399" />
                            <span style={{ color: '#34d399', fontWeight: '600' }}>Available for donation</span>
                          </>
                        ) : (
                          <>
                            <XCircle size={16} color="#f87171" />
                            <span style={{ color: '#f87171' }}>Currently Unavailable</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <a
                    href={`tel:${d.phone}`}
                    className="btn btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    <Phone size={16} /> Contact Donor ({d.phone})
                  </a>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
