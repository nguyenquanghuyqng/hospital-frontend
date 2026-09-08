import axios from 'axios'

// ── Axios instance ────────────────────────────────────────────
const http = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
})

// Tự động đính kèm JWT token nếu có
http.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
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

// ── Auth API ──────────────────────────────────────────────────
export const authApi = {
  login: (username, password) => {
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)
    return http.post('/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    })
  },
  me: () => http.get('/auth/me'),
  register: (data) => http.post('/auth/register', data),
}

// ── Doctor API ────────────────────────────────────────────────
export const doctorApi = {
  queue: (params) => http.get('/doctor/queue', { params }),
  queueStats: (params) => http.get('/doctor/queue/stats', { params }),
  updateVisitStatus: (id, visit_status) =>
    http.patch(`/doctor/receptions/${id}/visit-status`, { visit_status }),
  done: (id) => http.post(`/doctor/receptions/${id}/done`),
  transfer: (id, data) => http.patch(`/doctor/receptions/${id}/transfer`, data),
}

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

// ── Examination API ───────────────────────────────────────────
export const examinationApi = {
  create:          (data)   => http.post('/examinations', data),
  getByReception:  (rid)    => http.get(`/examinations/by-reception/${rid}`),
  get:             (id)     => http.get(`/examinations/${id}`),
  update:          (id, data) => http.put(`/examinations/${id}`, data),
  save:            (id)     => http.post(`/examinations/${id}/save`),
  complete:        (id)     => http.post(`/examinations/${id}/complete`),
  skip:            (id)     => http.post(`/examinations/${id}/skip`),
  cost:            (id)     => http.get(`/examinations/${id}/cost`),
  history:         (pid, params) => http.get(`/examinations/history/${pid}`, { params }),
  addDiagnosis:    (id, data)    => http.post(`/examinations/${id}/diagnoses`, data),
  deleteDiagnosis: (id, did)     => http.delete(`/examinations/${id}/diagnoses/${did}`),
  addItem:         (id, data)    => http.post(`/examinations/${id}/items`, data),
  deleteItem:      (id, iid)     => http.delete(`/examinations/${id}/items/${iid}`),
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
