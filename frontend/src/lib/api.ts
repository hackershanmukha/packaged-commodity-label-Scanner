import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 120000,
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const requestUrl = error.config?.url || '';
      const isAuthEndpoint = requestUrl.includes('/auth/');
      // Only clear token and redirect for non-auth 401s
      if (!isAuthEndpoint) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Only redirect if user is not already on the login page
        // and we're not in the middle of an active page (let the page handle it)
        if (!window.location.pathname.includes('/login') && !window.location.pathname.includes('/scan')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const authAPI = {
  register: (data: any) => api.post('/auth/register', data),
  login: (data: any) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const scanAPI = {
  create: (formData: FormData) => api.post('/scans', formData),
  list: (params?: any) => api.get('/scans', { params }),
  get: (id: number) => api.get(`/scans/${id}`),
  report: (id: number) => api.get(`/scans/${id}/report`, { responseType: 'blob' }),
  review: (id: number, data: any) => api.post(`/scans/${id}/review`, data),
};

export const dashboardAPI = {
  stats: () => api.get('/dashboard/stats'),
  heatmap: () => api.get('/dashboard/heatmap'),
};

export const productAPI = {
  search: (q: string) => api.get('/products', { params: { q } }),
  getByBarcode: (barcode: string) => api.get(`/products/${barcode}`),
  verify: (barcode: string) => api.get(`/products/${barcode}/verify`),
  report: (barcode: string) => api.get(`/products/${barcode}/report`, { responseType: 'blob' }),
};

export const manufacturerAPI = {
  checkLabel: (formData: FormData) => api.post('/manufacturer/check-label', formData),
  listLabels: () => api.get('/manufacturer/labels'),
  getLabel: (id: number) => api.get(`/manufacturer/labels/${id}`),
};
