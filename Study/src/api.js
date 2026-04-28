import axios from 'axios';

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export default api;
