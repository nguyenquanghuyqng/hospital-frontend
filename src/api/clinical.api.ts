/**
 * Clinical API — kết quả CLS và kiểm tra tương tác thuốc.
 */
import { apiClient } from './client';
import type { ClsResultResponse, ClsResultUpdate, DrugInteractionResponse } from '@/types';

export const clinicalApi = {
  /** GET /clinical/cls-results/by-exam/:examId */
  listClsByExam: (examId: number) =>
    apiClient.get<ClsResultResponse[]>(`/clinical/cls-results/by-exam/${examId}`),

  /** GET /clinical/cls-results/:id */
  getClsResult: (id: number) =>
    apiClient.get<ClsResultResponse>(`/clinical/cls-results/${id}`),

  /** PUT /clinical/cls-results/:id */
  updateClsResult: (id: number, data: ClsResultUpdate) =>
    apiClient.put<ClsResultResponse>(`/clinical/cls-results/${id}`, data),

  /** GET /clinical/cls-results/pending */
  listPending: (params?: { department?: string; skip?: number; limit?: number }) =>
    apiClient.get<ClsResultResponse[]>('/clinical/cls-results/pending', { params }),

  /** POST /clinical/drug-interactions/check */
  checkInteractions: (drugCodes: string[]) =>
    apiClient.post<DrugInteractionResponse>('/clinical/drug-interactions/check', {
      drug_codes: drugCodes,
    }),

  /** GET /clinical/drug-interactions/exam/:examId */
  checkInteractionsForExam: (examId: number) =>
    apiClient.get<DrugInteractionResponse>(`/clinical/drug-interactions/exam/${examId}`),
};
