import { apiClient } from './client';
import type {
  ExaminationResponse,
  ExaminationListItem,
  DiagnosisResponse,
  PrescriptionItemResponse,
  DispositionType,
  PaymentType,
} from '@/types';

// ─── Request shapes ───────────────────────────────────────────────────────────

export interface ExaminationCreate {
  reception_id: number;
  patient_id?: number;
  doctor_id?: number;

  // Khung II — Thông tin vào
  exam_date?: string;
  exam_start_at?: string;
  subject_type?: string;
  subject_name?: string;
  insurance_number?: string;
  insurance_valid_from?: string;
  insurance_valid_to?: string;
  referral_from_type?: string;
  referral_from_name?: string;
  referral_diagnosis?: string;
  clinical_symptoms?: string;

  // Khung III — Thông tin khám
  doctor_name?: string;
  nurse_name?: string;
  complications?: string;
  disposition?: DispositionType;
  revisit_days?: number;
  revisit_result?: string;
  transfer_to_facility?: string;
  transfer_reason?: string;
  admit_ward?: string;
  admit_priority?: boolean;
  is_near_poor?: boolean;
  is_poor?: boolean;
  flag_priority?: boolean;
}

export interface ExaminationUpdate extends Partial<Omit<ExaminationCreate, 'reception_id'>> {
  exam_end_at?: string;
  exam_end_date?: string;
}

export interface DiagnosisCreate {
  icd_code?: string;
  icd_name: string;
  is_primary?: boolean;
  note?: string;
}

export interface PrescriptionItemCreate {
  item_type: 'drug' | 'cls';
  item_name: string;
  item_code?: string;
  unit?: string;
  quantity?: number;
  unit_price?: number;
  usage_instruction?: string;
  valid_from?: string;
  valid_to?: string;
  payment_type?: PaymentType;
  bhyt_amount?: number;
  patient_amount?: number;
  total_amount?: number;
  room_name?: string;
  doctor_name?: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const examinationApi = {
  /** POST /examinations */
  create: (data: ExaminationCreate) =>
    apiClient.post<ExaminationResponse>('/examinations', data),

  /** GET /examinations/:id */
  get: (id: number) =>
    apiClient.get<ExaminationResponse>(`/examinations/${id}`),

  /** GET /examinations/by-reception/:id */
  getByReception: (receptionId: number) =>
    apiClient.get<ExaminationResponse>(`/examinations/by-reception/${receptionId}`),

  /** GET /examinations/history/:patientId — lịch sử khám tóm tắt */
  history: (patientId: number, params?: { skip?: number; limit?: number }) =>
    apiClient.get<ExaminationListItem[]>(`/examinations/history/${patientId}`, { params }),

  /** PUT /examinations/:id */
  update: (id: number, data: ExaminationUpdate) =>
    apiClient.put<ExaminationResponse>(`/examinations/${id}`, data),

  /** POST /examinations/:id/save  (DRAFT → SAVED) */
  save: (id: number) =>
    apiClient.post<ExaminationResponse>(`/examinations/${id}/save`),

  /** POST /examinations/:id/complete  (→ COMPLETED) */
  complete: (id: number) =>
    apiClient.post<ExaminationResponse>(`/examinations/${id}/complete`),

  /** POST /examinations/:id/skip */
  skip: (id: number) =>
    apiClient.post<ExaminationResponse>(`/examinations/${id}/skip`),

  /** GET /examinations/:id/cost */
  cost: (id: number) =>
    apiClient.get<Record<string, number>>(`/examinations/${id}/cost`),

  // ── Diagnoses ──────────────────────────────────────────────────────────────
  addDiagnosis: (examId: number, data: DiagnosisCreate) =>
    apiClient.post<DiagnosisResponse>(`/examinations/${examId}/diagnoses`, data),

  deleteDiagnosis: (examId: number, diagId: number) =>
    apiClient.delete<void>(`/examinations/${examId}/diagnoses/${diagId}`),

  // ── Prescription items ─────────────────────────────────────────────────────
  addItem: (examId: number, data: PrescriptionItemCreate) =>
    apiClient.post<PrescriptionItemResponse>(`/examinations/${examId}/items`, data),

  deleteItem: (examId: number, itemId: number) =>
    apiClient.delete<void>(`/examinations/${examId}/items/${itemId}`),
};
