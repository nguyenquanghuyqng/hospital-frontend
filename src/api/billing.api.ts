/**
 * Billing API — viện phí và thanh toán.
 */
import { apiClient } from './client';
import type { BillResponse, PaymentMethod, BillStatus } from '@/types';

export interface BillCreate {
  examination_id:  number;
  deposit_amount?: number;
  discount_amount?: number;
  note?:           string;
}

export interface PaymentCreate {
  payment_method:  PaymentMethod;
  amount:          number;
  transaction_ref?: string;
  note?:           string;
  is_deposit?:     boolean;
  is_refund?:      boolean;
}

export const billingApi = {
  /** POST /billing/bills */
  createBill: (data: BillCreate) =>
    apiClient.post<BillResponse>('/billing/bills', data),

  /** GET /billing/bills */
  listBills: (params?: { status?: BillStatus; skip?: number; limit?: number }) =>
    apiClient.get<BillResponse[]>('/billing/bills', { params }),

  /** GET /billing/bills/by-exam/:examId */
  getBillByExam: (examId: number) =>
    apiClient.get<BillResponse>(`/billing/bills/by-exam/${examId}`),

  /** GET /billing/bills/:id */
  getBill: (id: number) =>
    apiClient.get<BillResponse>(`/billing/bills/${id}`),

  /** PUT /billing/bills/:id */
  updateBill: (id: number, data: Partial<{ discount_amount: number; deposit_amount: number; note: string; bhyt_approved_code: string }>) =>
    apiClient.put<BillResponse>(`/billing/bills/${id}`, data),

  /** POST /billing/bills/:id/issue */
  issueBill: (id: number) =>
    apiClient.post<BillResponse>(`/billing/bills/${id}/issue`),

  /** POST /billing/bills/:id/payment */
  addPayment: (id: number, data: PaymentCreate) =>
    apiClient.post<BillResponse>(`/billing/bills/${id}/payment`, data),

  /** POST /billing/bills/:id/cancel */
  cancelBill: (id: number) =>
    apiClient.post<BillResponse>(`/billing/bills/${id}/cancel`),
};
