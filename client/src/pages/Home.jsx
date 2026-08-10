import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../services/api';
import DonorDetailModal from '../components/DonorDetailModal';
import { Search, MapPin, Phone, Eye, Droplet, Heart, AlertCircle, HeartHandshake, Filter, RefreshCw } from 'lucide-react';

export default function Home() {
  const [donors, setDonors] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [selectedGroup, setSelectedGroup] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);

  // Selected Donor for Modal
  const [selectedDonor, setSelectedDonor] = useState(null);

  const bloodGroups = ['All', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const fetchDonors = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedGroup !== 'All') params.bloodGroup = selectedGroup;
      if (searchQuery.trim() !== '') params.search = searchQuery.trim();
      if (availableOnly) params.availableOnly = 'true';

      const [donorRes, invRes] = await Promise.all([
        API.get('/donors', { params }),
        API.get('/inventory')
      ]);

      setDonors(donorRes.data);
      setInventory(invRes.data);
    } catch (err) {
      console.error('Error loading home portal data:', err);
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
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '30px 20px' }}>
      
      {/* Detail Modal */}
      {selectedDonor && (
        <DonorDetailModal donor={selectedDonor} onClose={() => setSelectedDonor(null)} />
      )}

      {/* HERO & QUICK SEARCH BANNER */}
      <section style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div className="badge badge-blood" style={{ marginBottom: '16px', padding: '6px 16px', fontSize: '0.85rem' }}>
          <Heart size={14} fill="var(--primary)" /> Emergency Blood Donation Directory
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3.2rem)', marginBottom: '16px', lineHeight: '1.2' }}>
          Find Blood Donors <span className="text-gradient-crimson">Instantly</span>
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '650px', margin: '0 auto 32px' }}>
          Select a blood group or enter location below to view verified donors and get immediate contact details.
        </p>

        {/* SEARCH & FILTER CONTAINER */}
        <div className="glass-card" style={{ padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
          <form onSubmit={handleSearchSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Quick Blood Group Chips */}
              <div>
                <label className="form-label" style={{ marginBottom: '10px', display: 'block', textAlign: 'left' }}>
                  Filter by Blood Group:
                </label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {bloodGroups.map((group) => (
                    <button
                      key={group}
                      type="button"
                      onClick={() => setSelectedGroup(group)}
                      className={`btn ${selectedGroup === group ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        padding: '8px 16px',
                        fontSize: '0.9rem',
                        borderRadius: '9999px',
                        minWidth: '60px'
                      }}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar + Location Input */}
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flexGrow: 1, position: 'relative', minWidth: '240px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search by city, location, or donor name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ paddingLeft: '42px', height: '48px', fontSize: '1rem' }}
                  />
                  <Search size={20} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '0 8px' }}>
                  <input
                    type="checkbox"
                    checked={availableOnly}
                    onChange={(e) => setAvailableOnly(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)' }}
                  />
                  Available Only
                </label>

                <button type="submit" className="btn btn-primary" style={{ height: '48px', padding: '0 28px', fontSize: '1rem' }}>
                  <Search size={18} /> Search
                </button>
              </div>

            </div>
          </form>
        </div>
      </section>

      {/* QUICK LIVE INVENTORY BADGES BAR */}
      <section style={{ marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>Live Stock Inventory:</h2>
          <Link to="/request" className="btn btn-secondary btn-sm" style={{ color: '#f87171', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
            <AlertCircle size={14} /> Request Emergency Blood
          </Link>
        </div>
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
          {inventory.map((inv) => (
            <div key={inv.id} className="glass-card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '10px', minWidth: '120px' }}>
              <span className="badge badge-blood" style={{ fontSize: '0.9rem' }}>{inv.blood_group}</span>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: '800' }}>{inv.units}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Units Stock</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DONOR RESULTS SECTION */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '1.6rem' }}>
            Registered Donors ({donors.length})
          </h2>
          {selectedGroup !== 'All' && (
            <span className="badge badge-blood">Showing Group: {selectedGroup}</span>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            Loading donor records...
          </div>
        ) : donors.length === 0 ? (
          <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
            <Search size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>No matching donors found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '20px' }}>
              Try selecting a different blood group or clearing your search filter.
            </p>
            <button onClick={() => { setSelectedGroup('All'); setSearchQuery(''); setAvailableOnly(false); }} className="btn btn-secondary">
              <RefreshCw size={16} /> Reset Search Filters
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' }}>
            {donors.map((donor) => (
              <div key={donor.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '4px' }}>{donor.name}</h3>
                      <span className={`badge ${donor.is_available ? 'badge-success' : 'badge-danger'}`}>
                        {donor.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </div>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '14px',
                      background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: '800',
                      fontSize: '1.2rem',
                      color: 'white',
                      boxShadow: '0 0 12px rgba(225, 29, 72, 0.4)'
                    }}>
                      {donor.blood_group}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MapPin size={15} color="var(--primary)" />
                      <span>{donor.city} {donor.address ? `(${donor.address})` : ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Phone size={15} color="#34d399" />
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{donor.phone}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => setSelectedDonor(donor)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <Eye size={14} /> View Details
                  </button>
                  <a
                    href={`tel:${donor.phone}`}
                    className="btn btn-primary btn-sm"
                    style={{ fontSize: '0.85rem' }}
                  >
                    <Phone size={14} /> Call Now
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
