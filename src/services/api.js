import axios from 'axios'

// ── Axios instance ────────────────────────────────────────────
const http = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

// Normalise error messages from FastAPI validation / detail fields
http.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const detail = err.response?.data?.detail
    let message = 'Đã xảy ra lỗi, vui lòng thử lại.'
    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail)) {
      message = detail.map((d) => d.msg).join('; ')
    } else if (err.message) {
      message = err.message
    }
    const error = new Error(message)
    error.status = err.response?.status
    error.raw = err.response?.data
    return Promise.reject(error)
  },
)

// ── Patient API ───────────────────────────────────────────────
export const patientApi = {
  list: (params) => http.get('/patients', { params }),
  get: (id) => http.get(`/patients/${id}`),
  getByCccd: (cccd) => http.get(`/patients/cccd/${encodeURIComponent(cccd)}`),
  create: (data) => http.post('/patients', data),
  update: (id, data) => http.put(`/patients/${id}`, data),
  history: (id, params) => http.get(`/patients/${id}/history`, { params }),
}

// ── Queue API ─────────────────────────────────────────────────
export const queueApi = {
  takeTicket: (data) => http.post('/queue/ticket', data),
  summary: (params) => http.get('/queue/summary', { params }),
  waiting: (params) => http.get('/queue/waiting', { params }),
  tickets: (params) => http.get('/queue/tickets', { params }),
  getTicket: (id) => http.get(`/queue/tickets/${id}`),
  callNext: (counter_number) =>
    http.post('/queue/call-next', null, { params: { counter_number } }),
  updateStatus: (id, data) => http.patch(`/queue/tickets/${id}/status`, data),
  skipTicket: (id) => http.patch(`/queue/tickets/${id}/skip`),
  doneTicket: (id) => http.patch(`/queue/tickets/${id}/done`),
}

// ── Reception API ─────────────────────────────────────────────
export const receptionApi = {
  scanCccd: (data) => http.post('/receptions/scan-cccd', data),
  create: (data) => http.post('/receptions', data),
  stats: () => http.get('/receptions/stats'),
  clinicStats: (params) => http.get('/receptions/clinic-stats', { params }),
  list: (params) => http.get('/receptions', { params }),
  get: (id) => http.get(`/receptions/${id}`),
  update: (id, data) => http.put(`/receptions/${id}`, data),
  checkIn: (id, data) => http.post(`/receptions/${id}/check-in`, data),
  complete: (id) => http.post(`/receptions/${id}/complete`),
  cancel: (id) => http.post(`/receptions/${id}/cancel`),
}
