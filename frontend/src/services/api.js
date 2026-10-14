import axios from 'axios';
export const shopApi = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', withCredentials: true });
const api = {
  get: (path, config) => shopApi.get('/customers' + path, config),
  post: (path, body) => shopApi.post('/customers' + path, body),
  patch: (path, body) => shopApi.patch('/customers' + path, body)
};
export const errorMessage = error => error.response?.data?.message || 'Unable to connect. Please try again.';
export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);
export default api;
