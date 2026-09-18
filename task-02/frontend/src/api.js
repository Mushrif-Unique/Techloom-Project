import axios from 'axios';
import { unwrapResponse } from './api-response';
export const api = axios.create({
  // Local requests stay on the browser's origin; Vite forwards them to the API.
  baseURL: import.meta.env.DEV ? '/api' : import.meta.env.VITE_API_URL || '/api',
  timeout: 20000,
});
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('atelier-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(
  (response) => unwrapResponse(response.data),
  (error) => {
    if (error.response?.status === 401 && !error.config.url.startsWith('/auth/'))
      window.dispatchEvent(new Event('session-expired'));
    return Promise.reject(
      new Error(
        error.response?.data?.error?.message ||
          'Unable to reach the store. Please check your connection and try again.',
      ),
    );
  },
);
export const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
export const date = (value) =>
  new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const label = (value) => value.replaceAll('_', ' ').toLowerCase();
