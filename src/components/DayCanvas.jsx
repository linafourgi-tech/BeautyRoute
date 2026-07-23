import React, { useState } from 'react';
import { appointments, clients, professionals, visits, aiRecommendations } from '../data/mockData';

const DayCanvas = () => {
  const [expandedCard, setExpandedCard] = useState(null);

  const today = '2026-07-20';
  const pro = professionals.find(p => p.id === 'pro_001');
  const todaysAppointments = appointments.filter(a => a.date === today);
  
  const todayRevenue = todaysAppointments.reduce((sum, a) => sum + a.price, 0);
  const depositsCollected = todaysAppointments.reduce((sum, a) => sum + (a.depositPaid ? a.deposit : 0), 0);

  const getClient = (clientId) => clients.find(c => c.id === clientId);
  const getClientVisits = (clientId) => visits.filter(v => v.clientId === clientId);

  const toggleCard = (id) => {
    setExpandedCard(expandedCard === id ? null : id);
  };

  const getStatusClass = (status) => {
    if (status === 'confirmed') return 'confirmed';
    if (status === 'pending') return 'pending';
    return 'completed';
  };

  const getAvatarGradient = (name) => {
    const gradients = {
      'S': 'from-rose-400 to-pink-600',
      'N': 'from-blue-400 to-indigo-600',
      'R': 'from-amber-400 to-orange-600',
      'F': 'from-violet-400 to-purple-600',
      'L': 'from-emerald-400 to-teal-600',
      'A': 'from-pink-400 to-rose-500',
    };
    return gradients[name[0]] || 'from-stone-400 to-stone-600';
  };

  const formatTime = (time) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${m} ${ampm}`;
  };

  return (
    <div className="day-canvas">
      {/* Date Header */}
      <div className="date-header">
        <div className="date-day">20 July 2026</div>
        <div className="date-weekday">Monday</div>
      </div>

      {/* Route Ribbon */}
      <div className="ribbon">
        <div className={`ribbon-avatar bg-gradient-to-br ${pro.gradient}`}>
          {pro.avatar}
        </div>
        <div className="ribbon-info">
          <div className="ribbon-name">{pro.name}</div>
          <div className="ribbon-meta">
            {pro.categories.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ')} Specialist · {pro.city}
          </div>
        </div>
        <div className="ribbon-status">
          <span className="dot"></span>
          On route
        </div>
      </div>

      {/* AI Insights */}
      <div className="ai-card">
        <div className="ai-header">
          <div className="ai-icon">AI</div>
          <div className="ai-title">Today's insights</div>
        </div>
        {todaysAppointments.slice(0, 2).map((apt, i) => {
          const client = getClient(apt.clientId);
          const clientVisits = getClientVisits(apt.clientId);
          const lastVisit = clientVisits[clientVisits.length - 1];
          return (
            <div key={i} className="ai-suggestion">
              <strong>{client.name.split(' ')[0]}</strong> — {lastVisit?.aiSuggestion || 'No specific insight available.'}
            </div>
          );
        })}
      </div>

      {/* Section Header */}
      <div className="section-header">
        <div className="section-title">Today's appointments</div>
        <div className="section-count">{todaysAppointments.length} booked</div>
      </div>

      {/* Timeline */}
      <div className="timeline">
        {todaysAppointments.map((apt, index) => {
          const client = getClient(apt.clientId);
          const clientVisits = getClientVisits(apt.clientId);
          const lastVisit = clientVisits[0];
          const isExpanded = expandedCard === apt.id;

          return (
            <div className="moment" key={apt.id}>
              <div className={`moment-dot ${getStatusClass(apt.status)}`}></div>
              <div 
                className={`card ${isExpanded ? 'expanded' : ''}`}
                onClick={() => toggleCard(apt.id)}
              >
                <div className="card-header">
                  <div className={`client-avatar bg-gradient-to-br ${getAvatarGradient(client.avatar)}`}>
                    {client.avatar}
                  </div>
                  <div className="card-main">
                    <div className="card-top">
                      <div className="client-name">{client.name}</div>
                      <div className="time-badge">{formatTime(apt.time)}</div>
                    </div>
                    <div className="service-name">
                      {apt.service} · {apt.duration}m · {apt.price} SAR
                    </div>
                    <div className="location-row">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
                        <circle cx="12" cy="10" r="3"/>
                      </svg>
                      {apt.location}
                      {client.notes?.includes('Gate code') && ` · ${client.notes.match(/Gate code \d+/)?.[0]}`}
                      {client.notes?.includes('Ring twice') && ' · Ring twice'}
                    </div>
                    <div className="status-row">
                      <span className={`status-pill ${getStatusClass(apt.status)}`}>
                        {apt.status === 'confirmed' ? 'Confirmed' : apt.status === 'pending' ? 'Pending deposit' : 'Completed'}
                      </span>
                      <span className="deposit-tag">
                        {apt.depositPaid ? `Deposit paid · ${apt.deposit} SAR` : 'No deposit yet'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="card-details">
                    <div className="detail-row">
                      <span className="detail-label">Client since</span>
                      <span className="detail-value">
                        {new Date(client.since).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} · {client.visits} visits
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Tier</span>
                      <span className="detail-value" style={{ 
                        color: client.tier === 'Platinum' ? '#C8A96A' : client.tier === 'Gold' ? '#C8A96A' : 'inherit',
                        fontWeight: 600 
                      }}>
                        {client.tier}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Lifetime value</span>
                      <span className="detail-value">{client.lifetimeValue.toLocaleString()} SAR</span>
                    </div>

                    {/* Beauty Passport Preview */}
                    <div className="passport-preview">
                      <div className="passport-title">Beauty Passport</div>
                      {lastVisit?.formula && Object.entries(lastVisit.formula).slice(0, 2).map(([key, val]) => (
                        <div className="passport-item" key={key}>
                          {key.charAt(0).toUpperCase() + key.slice(1)}: <span>{val}</span>
                        </div>
                      ))}
                      {client.allergies?.length > 0 && (
                        <div className="passport-item">
                          Allergy: <span>{client.allergies.join(', ')}</span>
                        </div>
                      )}
                      {client.preferences?.length > 0 && (
                        <div className="passport-item">
                          Preference: <span>{client.preferences.join(', ')}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="action-btns">
                      <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); }}>
                        Start service
                      </button>
                      <button className="btn btn-ghost" onClick={(e) => { e.stopPropagation(); }}>
                        View passport
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Revenue Strip */}
      <div className="revenue-strip">
        <div>
          <div className="revenue-label">Today's revenue</div>
          <div className="revenue-amount">
            {todayRevenue.toLocaleString()} <span className="revenue-currency">SAR</span>
          </div>
        </div>
        <div className="revenue-meta">
          <div className="revenue-count">{todaysAppointments.length} appointments</div>
          <div className="revenue-sub">{depositsCollected.toLocaleString()} SAR deposits collected</div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <nav className="nav-bar">
        <div className="nav-item active">
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span>Day</span>
        </div>
        <div className="nav-item">
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/>
            <path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          <span>Atelier</span>
        </div>
        <div className="nav-item">
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="1 6 1 22 8 18 16 22 21 18 21 2 16 6 8 2 1 6"/>
            <line x1="8" y1="2" x2="8" y2="18"/>
            <line x1="16" y1="6" x2="16" y2="22"/>
          </svg>
          <span>Route</span>
        </div>
        <div className="nav-item">
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>AI</span>
        </div>
        <div className="nav-item">
          <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span>Profile</span>
        </div>
      </nav>
    </div>
  );
};

export default DayCanvas;