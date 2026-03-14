import axios from 'axios';

// Set default base URL for API requests
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

// Add auth token to requests if available
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Handle token expiration
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (userData) => axios.post('/api/auth/register', userData),
  login: (credentials) => axios.post('/api/auth/login', credentials),
  getUser: () => axios.get('/api/auth/user')
};

// Events API
export const eventsAPI = {
  getEvents: (params) => axios.get('/api/events', { params }),
  getRecentEvents: () => axios.get('/api/events/recent'),
  getHighRiskEvents: () => axios.get('/api/events/high-risk'),
  getEventById: (id) => axios.get(`/api/events/${id}`),
  getEventStats: () => axios.get('/api/events/stats')
};

// Analytics API
export const analyticsAPI = {
  getRiskSummary: () => axios.get('/api/analytics/risk-summary'),
  getAnomalies: () => axios.get('/api/analytics/anomalies'),
  getEventTimeline: () => axios.get('/api/analytics/event-timeline'),
  getExternalDriveActivity: () => axios.get('/api/analytics/external-drive-activity')
};

// Settings API
export const settingsAPI = {
  getSettings: () => axios.get('/api/settings'),
  updateSettings: (settings) => axios.put('/api/settings', settings),
  addMonitoringPath: (path) => axios.post('/api/settings/monitoring-paths', { path }),
  deleteMonitoringPath: (path) => axios.delete('/api/settings/monitoring-paths', { data: { path } })
};

export default {
  auth: authAPI,
  events: eventsAPI,
  analytics: analyticsAPI,
  settings: settingsAPI
};
