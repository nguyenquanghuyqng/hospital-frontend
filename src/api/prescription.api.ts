/**
 * Prescription API — đơn thuốc điện tử chuẩn Bộ Y tế (donthuocquocgia.vn).
 *
 * Tất cả endpoints dưới prefix /api/v1/prescriptions.
 */
import { apiClient } from './client';
import type {
  PrescriptionResponse,
  PrescriptionUpdate,
  PrescriptionDashboard,
} from '@/types';

export const prescriptionApi = {
  /** GET /prescriptions/by-examination/:examId */
  getByExamination: (examinationId: number) =>
    apiClient.get<PrescriptionResponse>(`/prescriptions/by-examination/${examinationId}`),

  /** GET /prescriptions/:id */
  get: (id: number) =>
    apiClient.get<PrescriptionResponse>(`/prescriptions/${id}`),

  /** PATCH /prescriptions/:id — cập nhật thông tin phụ trợ (phone, guardian, treatment...) */
  update: (id: number, data: PrescriptionUpdate) =>
    apiClient.patch<PrescriptionResponse>(`/prescriptions/${id}`, data),

  /** POST /prescriptions/:id/retry — gửi lại đơn thất bại */
  retry: (id: number) =>
    apiClient.post<PrescriptionResponse>(`/prescriptions/${id}/retry`),

  /** POST /prescriptions/:id/cancel — admin huỷ đơn */
  cancel: (id: number) =>
    apiClient.post<PrescriptionResponse>(`/prescriptions/${id}/cancel`),

  /** POST /prescriptions/:id/sold — đánh dấu đã bán */
  markSold: (id: number) =>
    apiClient.post<PrescriptionResponse>(`/prescriptions/${id}/sold`),

  /**
   * GET /prescriptions/:id/qr — URL để nhúng QR code như <img src={qrUrl(id)} />
   * Endpoint trả về PNG trực tiếp nên dùng URL string thay vì apiClient.
   */
  qrUrl: (id: number) =>
    `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1/prescriptions/${id}/qr`,

  /** GET /prescriptions/dashboard — admin dashboard tỷ lệ gửi */
  dashboard: () =>
    apiClient.get<PrescriptionDashboard>('/prescriptions/dashboard'),
};

// ── Admin — mã liên thông bác sĩ ─────────────────────────────────────────────

export interface LicenseUpdatePayload {
  national_doctor_code?: string | null;
  license_status?: 'active' | 'suspended' | 'revoked';
}

export const doctorLicenseApi = {
  /** PATCH /admin/users/:id/license */
  update: (userId: number, data: LicenseUpdatePayload) =>
    apiClient.patch(`/admin/users/${userId}/license`, data),

  /** GET /admin/users/doctors/license-status */
  listDoctors: (params?: { license_status?: string; has_code?: boolean }) =>
    apiClient.get(`/admin/users/doctors/license-status`, { params }),
};
