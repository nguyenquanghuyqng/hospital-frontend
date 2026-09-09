/**
 * Appointment API — lịch hẹn khám.
 */
import { apiClient } from './client';
import type { AppointmentResponse, AppointmentCreate, AppointmentStatus } from '@/types';

export interface AppointmentUpdate {
  scheduled_date?:  string;
  scheduled_time?:  string;
  status?:          AppointmentStatus;
  appointment_type?: 'new' | 'revisit' | 'followup';
  reason?:          string;
  doctor_id?:       number;
  doctor_name?:     string;
  department?:      string;
  clinic_room?:     string;
  note?:            string;
  patient_note?:    string;
  cancel_reason?:   string;
}

export const appointmentApi = {
  /** POST /appointments */
  create: (data: AppointmentCreate) =>
    apiClient.post<AppointmentResponse>('/appointments', data),

  /** GET /appointments?scheduled_date=&doctor_id=&status= */
  list: (params?: { scheduled_date?: string; doctor_id?: number; department?: string; status?: AppointmentStatus }) =>
    apiClient.get<AppointmentResponse[]>('/appointments', { params }),

  /** GET /appointments/patient/:patientId */
  listByPatient: (patientId: number, params?: { skip?: number; limit?: number }) =>
    apiClient.get<AppointmentResponse[]>(`/appointments/patient/${patientId}`, { params }),

  /** GET /appointments/:id */
  get: (id: number) =>
    apiClient.get<AppointmentResponse>(`/appointments/${id}`),

  /** PUT /appointments/:id */
  update: (id: number, data: AppointmentUpdate) =>
    apiClient.put<AppointmentResponse>(`/appointments/${id}`, data),

  /** POST /appointments/:id/confirm */
  confirm: (id: number) =>
    apiClient.post<AppointmentResponse>(`/appointments/${id}/confirm`),

  /** POST /appointments/:id/arrive */
  arrive: (id: number) =>
    apiClient.post<AppointmentResponse>(`/appointments/${id}/arrive`),

  /** POST /appointments/:id/complete */
  complete: (id: number) =>
    apiClient.post<AppointmentResponse>(`/appointments/${id}/complete`),

  /** POST /appointments/:id/cancel */
  cancel: (id: number, reason?: string) =>
    apiClient.post<AppointmentResponse>(`/appointments/${id}/cancel`, { cancel_reason: reason }),
};
