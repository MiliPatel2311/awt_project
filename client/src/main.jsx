import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const categories = ['tech', 'fun', 'fest', 'sports', 'business'];

const blankEvent = {
  title: '',
  description: '',
  location: '',
  category: 'tech',
  date: '',
  seatLimit: 50,
  imageUrl: '',
};

const blankFilters = {
  search: '',
  location: '',
  category: '',
  startDate: '',
  endDate: '',
};

const chartColors = ['#0f6b4f', '#d28a1f', '#4267ac', '#b54f4f', '#6b7280'];

const defaultEventImages = {
  tech: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=900&q=80',
  fun: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=900&q=80',
  fest: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?auto=format&fit=crop&w=900&q=80',
  sports: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=900&q=80',
  business: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80',
};

function formatDate(value) {
  if (!value) return 'Date pending';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function apiError(error) {
  return error?.message || 'Something went wrong';
}

function isPastEvent(event) {
  return event?.date && new Date(event.date) <= new Date();
}

function normalizeAuth(payload) {
  const user = payload.user || payload;
  const token = payload.token || payload.accessToken;
  return { user, token };
}

function getEventId(registration) {
  return registration.event?._id || registration.event;
}

function getStatus(registration) {
  return registration.status || 'registered';
}

function getSeatUtilization(event) {
  if (!event?.seatLimit) return 0;
  return Math.min(100, Math.round(((event.registeredSeats || 0) / event.seatLimit) * 100));
}

function formatCategory(category) {
  if (!category) return 'Uncategorized';
  return category.charAt(0).toUpperCase() + category.slice(1);
}

async function request(path, options = {}, token) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Request failed with ${response.status}`);
  }

  return data;
}

function PieChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (!total) {
    return <p className="muted">No data yet.</p>;
  }

  let offset = 25;
  const segments = data.map((item, index) => {
    const percent = (item.value / total) * 100;
    const segment = `${chartColors[index % chartColors.length]} ${offset}% ${offset + percent}%`;
    offset += percent;
    return segment;
  });

  return (
    <div className="chart-wrap">
      <div
        className="pie"
        aria-label="Chart"
        style={{ background: `conic-gradient(${segments.join(', ')})` }}
      />
      <div className="legend">
        {data.map((item, index) => (
          <div className="legend-row" key={item.label}>
            <span style={{ backgroundColor: chartColors[index % chartColors.length] }} />
            <strong>{item.label}</strong>
            <em>{item.value}</em>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('eventAuth');
    return saved ? JSON.parse(saved) : { user: null, token: '' };
  });
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
  });
  const [events, setEvents] = useState([]);
  const [registrations, setRegistrations] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [filters, setFilters] = useState(blankFilters);
  const [eventForm, setEventForm] = useState(blankEvent);
  const [editingId, setEditingId] = useState('');
  const [feedbackDrafts, setFeedbackDrafts] = useState({});
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const isAdmin = auth.user?.role === 'admin';

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('eventAuth', JSON.stringify(auth));
  }, [auth]);

  const authHeaders = auth.token;

  const registeredEventIds = useMemo(
    () =>
      new Set(
        registrations
          .filter((registration) => getStatus(registration) === 'registered')
          .map(getEventId)
      ),
    [registrations]
  );

  const waitlistedEventIds = useMemo(
    () =>
      new Set(
        registrations
          .filter((registration) => getStatus(registration) === 'waitlisted')
          .map(getEventId)
      ),
    [registrations]
  );

  const waitlistedRegistrations = useMemo(
    () => registrations.filter((registration) => getStatus(registration) === 'waitlisted'),
    [registrations]
  );

  const averageUtilization = useMemo(() => {
    if (!events.length) return 0;
    const total = events.reduce((sum, event) => sum + getSeatUtilization(event), 0);
    return Math.round(total / events.length);
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const searchText = `${event.title} ${event.description}`.toLowerCase();
      const locationText = (event.location || '').toLowerCase();
      const eventDate = event.date ? new Date(event.date) : null;

      if (filters.search && !searchText.includes(filters.search.toLowerCase())) return false;
      if (filters.location && !locationText.includes(filters.location.toLowerCase())) return false;
      if (filters.category && event.category !== filters.category) return false;
      if (filters.startDate && eventDate < new Date(filters.startDate)) return false;
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        if (eventDate > end) return false;
      }
      return true;
    });
  }, [events, filters]);

  const loadEvents = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const data = await request(`/events${params.toString() ? `?${params}` : ''}`);
    setEvents(Array.isArray(data) ? data : data.events || []);
  };

  const loadRegistrations = async () => {
    if (!auth.token) {
      setRegistrations([]);
      return;
    }
    const path = isAdmin ? '/registrations' : '/registrations/me';
    const data = await request(path, {}, authHeaders);
    setRegistrations(Array.isArray(data) ? data : []);
  };

  const loadAnalytics = async () => {
    if (!auth.token || !isAdmin) {
      setAnalytics(null);
      return;
    }
    const data = await request('/events/analytics/overview', {}, authHeaders);
    setAnalytics(data.analytics || data);
  };

  const refresh = async () => {
    try {
      await loadEvents();
      await loadRegistrations();
      await loadAnalytics();
    } catch (error) {
      setMessage(apiError(error));
    }
  };

  useEffect(() => {
    refresh();
  }, [auth.token, auth.user?.role]);

  useEffect(() => {
    loadEvents().catch((error) => setMessage(apiError(error)));
  }, [filters]);

  const handleAuth = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const path = authMode === 'login' ? '/auth/login' : '/auth/signup';
      const payload =
        authMode === 'login'
          ? { email: authForm.email, password: authForm.password }
          : authForm;
      const data = await request(path, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const nextAuth = normalizeAuth(data);
      setAuth(nextAuth);
      setMessage(authMode === 'login' ? 'Signed in successfully.' : 'Account created.');
    } catch (error) {
      setMessage(apiError(error));
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAuth({ user: null, token: '' });
    setRegistrations([]);
    setAnalytics(null);
  };

  const saveEvent = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const payload = {
        ...eventForm,
        seatLimit: Number(eventForm.seatLimit),
      };
      await request(
        editingId ? `/events/${editingId}` : '/events',
        {
          method: editingId ? 'PUT' : 'POST',
          body: JSON.stringify(payload),
        },
        authHeaders
      );
      setEventForm(blankEvent);
      setEditingId('');
      setMessage(editingId ? 'Event updated.' : 'Event created.');
      await refresh();
    } catch (error) {
      setMessage(apiError(error));
    } finally {
      setLoading(false);
    }
  };

  const editEvent = (event) => {
    setEditingId(event._id);
    setEventForm({
      title: event.title || '',
      description: event.description || '',
      location: event.location || '',
      category: event.category || 'tech',
      date: event.date ? event.date.slice(0, 16) : '',
      seatLimit: event.seatLimit || 50,
      imageUrl: event.imageUrl || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteEvent = async (eventId) => {
    setLoading(true);
    setMessage('');
    try {
      await request(`/events/${eventId}`, { method: 'DELETE' }, authHeaders);
      setMessage('Event deleted.');
      await refresh();
    } catch (error) {
      setMessage(apiError(error));
    } finally {
      setLoading(false);
    }
  };

  const register = async (eventId) => {
    setLoading(true);
    setMessage('');
    try {
      const data = await request(`/registrations/${eventId}`, { method: 'POST' }, authHeaders);
      setMessage(data?.message || 'Registration updated.');
      await refresh();
    } catch (error) {
      setMessage(apiError(error));
    } finally {
      setLoading(false);
    }
  };

  const cancelRegistration = async (eventId) => {
    setLoading(true);
    setMessage('');
    try {
      const data = await request(`/registrations/${eventId}`, { method: 'DELETE' }, authHeaders);
      setMessage(data?.message || 'Registration cancelled.');
      await refresh();
    } catch (error) {
      setMessage(apiError(error));
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (registration) => {
    const eventId = getEventId(registration);
    const draft = feedbackDrafts[eventId] || {};
    setLoading(true);
    setMessage('');
    try {
      const data = await request(
        `/registrations/${eventId}/feedback`,
        {
          method: 'PUT',
          body: JSON.stringify({
            rating: Number(draft.rating || registration.rating || 5),
            feedback: draft.feedback || registration.feedback || '',
          }),
        },
        authHeaders
      );
      setMessage(data?.message || 'Feedback saved.');
      await refresh();
    } catch (error) {
      setMessage(apiError(error));
    } finally {
      setLoading(false);
    }
  };

  const categoryData = analytics?.categoryBreakdown?.map((item) => ({
    label: formatCategory(item._id || item.category),
    value: item.value || item.count || item.total || 0,
  })) || [];

  const registrationCategoryData = analytics?.registrationByCategory?.map((item) => ({
    label: formatCategory(item._id || item.category),
    value: item.value || item.registrations || item.count || item.total || 0,
  })) || [];

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">EM</div>
          <div>
            <span>Event Management</span>
            <h1>{auth.user ? 'Control center' : 'Event booking workspace'}</h1>
          </div>
        </div>
        <div className="top-actions">
          <button className="ghost-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
          {auth.user && (
            <>
              <div className="user-chip">
                <strong>{auth.user.name}</strong>
                <span>{auth.user.role}</span>
              </div>
              <button onClick={logout}>Logout</button>
            </>
          )}
        </div>
      </header>

      {message && <div className="notice">{message}</div>}

      {!auth.user ? (
        <section className="auth-screen">
          <div className="auth-card">
            <div className="section-heading">
              <span>Access</span>
              <h2>{authMode === 'login' ? 'Sign in' : 'Create account'}</h2>
            </div>
            <div className="tab-row">
              <button
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                className={authMode === 'signup' ? 'active' : ''}
                onClick={() => setAuthMode('signup')}
              >
                Signup
              </button>
            </div>
            <form onSubmit={handleAuth} className="form-grid compact">
              {authMode === 'signup' && (
                <label>
                  Name
                  <input
                    value={authForm.name}
                    onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                    required
                  />
                </label>
              )}
              <label>
                Email
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                  required
                />
              </label>
              {authMode === 'signup' && (
                <label>
                  Role
                  <select
                    value={authForm.role}
                    onChange={(event) => setAuthForm({ ...authForm, role: event.target.value })}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>
              )}
              <button disabled={loading}>{authMode === 'login' ? 'Login' : 'Create account'}</button>
            </form>
          </div>
        </section>
      ) : (
        <>
          {isAdmin && (
            <section className="dashboard-grid">
              <StatCard label="Total users" value={analytics?.totalUsers || 0} />
              <StatCard label="Total registrations" value={analytics?.totalRegistrations || 0} />
              <StatCard label="Waitlisted" value={analytics?.totalWaitlisted || 0} />
              <StatCard label="Avg booked" value={`${averageUtilization}%`} />
            </section>
          )}

          {isAdmin && (
            <section className="panel">
              <div className="section-heading">
                <span>Admin</span>
                <h2>{editingId ? 'Edit event' : 'Create event'}</h2>
              </div>
              <form onSubmit={saveEvent} className="form-grid">
                <label>
                  Title
                  <input value={eventForm.title} onChange={(event) => setEventForm({ ...eventForm, title: event.target.value })} required />
                </label>
                <label>
                  Location
                  <input value={eventForm.location} onChange={(event) => setEventForm({ ...eventForm, location: event.target.value })} required />
                </label>
                <label>
                  Category
                  <select value={eventForm.category} onChange={(event) => setEventForm({ ...eventForm, category: event.target.value })}>
                    {categories.map((category) => <option key={category} value={category}>{formatCategory(category)}</option>)}
                  </select>
                </label>
                <label>
                  Date
                  <input type="datetime-local" value={eventForm.date} onChange={(event) => setEventForm({ ...eventForm, date: event.target.value })} required />
                </label>
                <label>
                  Seat limit
                  <input type="number" min="1" value={eventForm.seatLimit} onChange={(event) => setEventForm({ ...eventForm, seatLimit: event.target.value })} required />
                </label>
                <label>
                  Image URL
                  <input value={eventForm.imageUrl} onChange={(event) => setEventForm({ ...eventForm, imageUrl: event.target.value })} />
                </label>
                <label className="wide">
                  Description
                  <textarea value={eventForm.description} onChange={(event) => setEventForm({ ...eventForm, description: event.target.value })} required />
                </label>
                <div className="form-actions wide">
                  <button disabled={loading}>{editingId ? 'Update event' : 'Create event'}</button>
                  {editingId && <button type="button" className="ghost-btn" onClick={() => { setEditingId(''); setEventForm(blankEvent); }}>Cancel edit</button>}
                </div>
              </form>
            </section>
          )}

          <section className="panel filter-panel">
            <div className="section-heading">
              <span>Browse</span>
              <h2>Search and filter</h2>
            </div>
            <div className="filter-grid">
              <label>
                Search
                <input placeholder="Title or description" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
              </label>
              <label>
                Location
                <input placeholder="City or venue" value={filters.location} onChange={(event) => setFilters({ ...filters, location: event.target.value })} />
              </label>
              <label>
                Category
                <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}>
                  <option value="">All categories</option>
                  {categories.map((category) => <option key={category} value={category}>{formatCategory(category)}</option>)}
                </select>
              </label>
              <label>
                Start date
                <input type="date" value={filters.startDate} onChange={(event) => setFilters({ ...filters, startDate: event.target.value })} />
              </label>
              <label>
                End date
                <input type="date" value={filters.endDate} onChange={(event) => setFilters({ ...filters, endDate: event.target.value })} />
              </label>
              <button className="ghost-btn" onClick={() => setFilters(blankFilters)}>Reset</button>
            </div>
          </section>

          <section>
            <div className="list-heading">
              <h2>Events</h2>
              <span>{filteredEvents.length} listed</span>
            </div>
            <div className="event-grid">
              {filteredEvents.map((event) => (
                <EventCard
                  key={event._id}
                  event={event}
                  isAdmin={isAdmin}
                  isRegistered={registeredEventIds.has(event._id)}
                  isWaitlisted={waitlistedEventIds.has(event._id)}
                  onRegister={() => register(event._id)}
                  onCancel={() => cancelRegistration(event._id)}
                  onEdit={() => editEvent(event)}
                  onDelete={() => deleteEvent(event._id)}
                  disabled={loading}
                />
              ))}
            </div>
            {!filteredEvents.length && <p className="empty-state">No events match the current filters.</p>}
          </section>

          {isAdmin && (
            <>
              <section className="analytics-section">
                <div className="section-heading">
                  <span>Analytics</span>
                  <h2>Dashboard overview</h2>
                </div>
                <div className="analytics-grid">
                <div className="panel chart-panel">
                  <div className="panel-title">
                    <h2>Events by category</h2>
                    <span>{categoryData.reduce((sum, item) => sum + item.value, 0)} total</span>
                  </div>
                  <PieChart data={categoryData} />
                </div>
                <div className="panel chart-panel">
                  <div className="panel-title">
                    <h2>Registrations by category</h2>
                    <span>{registrationCategoryData.reduce((sum, item) => sum + item.value, 0)} total</span>
                  </div>
                  <PieChart data={registrationCategoryData} />
                </div>
                <div className="panel chart-panel feedback-summary">
                  <div className="panel-title">
                    <h2>Feedback</h2>
                    <span>{analytics?.feedbackSummary?.feedbackCount || 0} responses</span>
                  </div>
                  <p className="score">{analytics?.feedbackSummary?.averageRating || 0} / 5</p>
                  <p>Top rated: {analytics?.topRatedEvent?.title || 'No ratings yet'}</p>
                </div>
                </div>
              </section>
              <WaitlistPanel registrations={waitlistedRegistrations} />
              <RegistrationTable registrations={registrations} />
            </>
          )}

          {!isAdmin && (
            <FeedbackPanel
              registrations={registrations}
              drafts={feedbackDrafts}
              setDrafts={setFeedbackDrafts}
              onSubmit={submitFeedback}
              onCancel={cancelRegistration}
              loading={loading}
            />
          )}
        </>
      )}
    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EventCard({ event, isAdmin, isRegistered, isWaitlisted, onRegister, onCancel, onEdit, onDelete, disabled }) {
  const filled = event.registeredSeats || 0;
  const limit = event.seatLimit || 0;
  const waitlisted = event.waitlistedCount || event.waitlistCount || 0;
  const full = limit > 0 && filled >= limit;
  const utilization = getSeatUtilization(event);
  const image = event.imageUrl || defaultEventImages[event.category] || defaultEventImages.tech;

  return (
    <article className="event-card">
      <img src={image} alt="" />
      <div className="event-body">
        <div className="event-topline">
          <span className="category-pill">{formatCategory(event.category)}</span>
          <span>{formatDate(event.date)}</span>
        </div>
        <h3>{event.title}</h3>
        <p>{event.description}</p>
        <div className="event-meta">
          <span>{event.location}</span>
          <span>{event.averageRating || 0} / 5 rating</span>
        </div>
        <div className="utilization-block">
          <div className="utilization-label">
            <span>Seat utilization</span>
            <strong>{utilization}% booked</strong>
          </div>
          <div className="utilization-track">
            <span style={{ width: `${utilization}%` }} />
          </div>
        </div>
        <div className="capacity-row">
          <div>
            <strong>{filled}</strong>
            <span>Booked</span>
          </div>
          <div>
            <strong>{Math.max(limit - filled, 0)}</strong>
            <span>Seats left</span>
          </div>
          <div>
            <strong>{waitlisted}</strong>
            <span>Waitlisted</span>
          </div>
        </div>
        {isAdmin ? (
          <div className="card-actions">
            <button className="ghost-btn" onClick={onEdit}>Edit</button>
            <button className="danger-btn" onClick={onDelete}>Delete</button>
          </div>
        ) : (
          <div className="card-actions">
            {isRegistered || isWaitlisted ? (
              <>
                <span className={`status-pill ${isWaitlisted ? 'waitlisted' : 'registered'}`}>
                  {isWaitlisted ? 'Waitlisted' : 'Registered'}
                </span>
                <button className="ghost-btn" onClick={onCancel} disabled={disabled}>Cancel</button>
              </>
            ) : (
              <button onClick={onRegister} disabled={disabled}>
                {full ? 'Join waitlist' : 'Register'}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function RegistrationTable({ registrations }) {
  return (
    <section className="panel">
      <div className="list-heading">
        <h2>Registrations and waitlist</h2>
        <span>{registrations.length} records</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Event</th>
              <th>Status</th>
              <th>Queue</th>
              <th>Rating</th>
              <th>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((registration) => (
              <tr key={registration._id}>
                <td>
                  <strong>{registration.user?.name || 'User'}</strong>
                  <span>{registration.user?.email}</span>
                </td>
                <td>{registration.event?.title || 'Deleted event'}</td>
                <td>
                  <span className={`status-pill ${getStatus(registration)}`}>
                    {getStatus(registration)}
                  </span>
                </td>
                <td>
                  {getStatus(registration) === 'waitlisted'
                    ? `#${registration.waitlistPosition || '-'}`
                    : 'Confirmed'}
                </td>
                <td>{registration.rating || '-'}</td>
                <td>{registration.feedback || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WaitlistPanel({ registrations }) {
  const grouped = registrations.reduce((groups, registration) => {
    const eventTitle = registration.event?.title || 'Deleted event';
    const current = groups.get(eventTitle) || [];
    current.push(registration);
    groups.set(eventTitle, current);
    return groups;
  }, new Map());

  return (
    <section className="panel waitlist-panel">
      <div className="list-heading">
        <div>
          <span className="eyebrow">Waitlist</span>
          <h2>Waitlisted members</h2>
        </div>
        <span>{registrations.length} waiting</span>
      </div>
      {registrations.length ? (
        <div className="waitlist-groups">
          {[...grouped.entries()].map(([eventTitle, eventRegistrations]) => (
            <article className="waitlist-group" key={eventTitle}>
              <div className="waitlist-group-header">
                <h3>{eventTitle}</h3>
                <span>{eventRegistrations.length} in queue</span>
              </div>
              {eventRegistrations
                .sort((a, b) => (a.waitlistPosition || 999) - (b.waitlistPosition || 999))
                .map((registration) => (
                  <div className="waitlist-member" key={registration._id}>
                    <strong>#{registration.waitlistPosition || '-'} {registration.user?.name || 'User'}</strong>
                    <span>{registration.user?.email || 'No email'}</span>
                  </div>
                ))}
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">No one is waiting right now.</p>
      )}
    </section>
  );
}

function FeedbackPanel({ registrations, drafts, setDrafts, onSubmit, onCancel, loading }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <span>Your events</span>
        <h2>Ratings and feedback</h2>
      </div>
      <div className="feedback-grid">
        {registrations.map((registration) => {
          const event = registration.event;
          const eventId = getEventId(registration);
          const status = getStatus(registration);
          const canRate = event && status === 'registered' && isPastEvent(event);
          const draft = drafts[eventId] || {};

          return (
            <article className="feedback-card" key={registration._id}>
              <div className="feedback-title-row">
                <div>
                  <h3>{event?.title || 'Deleted event'}</h3>
                  <p>{formatDate(event?.date)}</p>
                </div>
                <span className={`status-pill ${status}`}>{status}</span>
              </div>
              {status === 'waitlisted' && (
                <p className="waitlist-note">
                  Queue position #{registration.waitlistPosition || '-'}.
                  You can rate this event after your seat is confirmed.
                </p>
              )}
              {status === 'registered' && !isPastEvent(event) && (
                <p className="muted">Feedback opens after the event is complete.</p>
              )}
              {registration.rating && (
                <p className="feedback-result">Saved rating: {registration.rating} / 5</p>
              )}
              <label>
                Rating
                <select
                  value={draft.rating || registration.rating || 5}
                  onChange={(event) => setDrafts({ ...drafts, [eventId]: { ...draft, rating: event.target.value } })}
                  disabled={!canRate}
                >
                  {[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}</option>)}
                </select>
              </label>
              <label>
                Feedback
                <textarea
                  value={draft.feedback ?? registration.feedback ?? ''}
                  onChange={(event) => setDrafts({ ...drafts, [eventId]: { ...draft, feedback: event.target.value } })}
                  disabled={!canRate}
                  placeholder="Share your feedback"
                />
              </label>
              <div className="card-actions">
                <button onClick={() => onSubmit(registration)} disabled={!canRate || loading}>Save feedback</button>
                <button className="ghost-btn" onClick={() => onCancel(eventId)} disabled={loading}>Cancel booking</button>
              </div>
            </article>
          );
        })}
      </div>
      {!registrations.length && <p className="empty-state">Your registrations will appear here.</p>}
    </section>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
