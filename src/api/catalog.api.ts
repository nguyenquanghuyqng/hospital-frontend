/**
 * Catalog API — danh mục thuốc, CLS, ICD-10.
 */
import { apiClient } from './client';
import type { PaginatedResponse } from '@/types';

// ── Drug ──────────────────────────────────────────────────────────────────────

export interface DrugList {
  id:                number;
  drug_code:         string;
  drug_name:         string;
  generic_name:      string | null;
  active_ingredient: string | null;
  unit:              string;
  unit_price:        string;
  bhyt_price:        string | null;
  bhyt_ratio:        string | null;
  stock_quantity:    number;
  is_bhyt:           boolean;
  is_active:         boolean;
}

export interface DrugResponse extends DrugList {
  drug_group:      string | null;
  dosage_form:     string | null;
  strength:        string | null;
  manufacturer:    string | null;
  country:         string | null;
  registration_no: string | null;
  min_stock:       number;
  note:            string | null;
  created_at:      string;
  updated_at:      string;
}

export interface DrugPayload {
  drug_code:         string;
  drug_name:         string;
  generic_name?:     string | null;
  active_ingredient?: string | null;
  drug_group?:       string | null;
  dosage_form?:      string | null;
  strength?:         string | null;
  unit:              string;
  unit_price:        number;
  bhyt_price?:       number | null;
  bhyt_ratio?:       number | null;
  stock_quantity?:   number;
  min_stock?:        number;
  manufacturer?:     string | null;
  country?:          string | null;
  registration_no?:  string | null;
  is_active?:        boolean;
  is_bhyt?:          boolean;
  note?:             string | null;
}

// ── CLS Service ───────────────────────────────────────────────────────────────

export interface ClsServiceList {
  id:            number;
  service_code:  string;
  service_name:  string;
  service_group: string | null;
  unit:          string;
  unit_price:    string;
  bhyt_price:    string | null;
  bhyt_ratio:    string | null;
  is_bhyt:       boolean;
  is_active:     boolean;
}

export interface ClsServiceResponse extends ClsServiceList {
  result_fields:    string | null;
  turnaround_hours: number | null;
  department:       string | null;
  note:             string | null;
  created_at:       string;
  updated_at:       string;
}

export interface ClsServicePayload {
  service_code:     string;
  service_name:     string;
  service_group?:   string | null;
  unit?:            string;
  unit_price:       number;
  bhyt_price?:      number | null;
  bhyt_ratio?:      number | null;
  result_fields?:   string | null;
  turnaround_hours?: number | null;
  department?:      string | null;
  is_active?:       boolean;
  is_bhyt?:         boolean;
  note?:            string | null;
}

// ── ICD-10 ────────────────────────────────────────────────────────────────────

export interface Icd10 {
  id:      number;
  code:    string;
  name_vi: string;
  name_en: string | null;
  chapter: string | null;
  block:   string | null;
  is_leaf: boolean;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const catalogApi = {
  // Drugs
  listDrugs: (params?: { keyword?: string; is_active?: boolean; is_bhyt?: boolean; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<DrugList>>('/catalog/drugs', { params }),

  getDrug: (id: number) =>
    apiClient.get<DrugResponse>(`/catalog/drugs/${id}`),

  createDrug: (data: DrugPayload) =>
    apiClient.post<DrugResponse>('/catalog/drugs', data),

  updateDrug: (id: number, data: Partial<DrugPayload>) =>
    apiClient.put<DrugResponse>(`/catalog/drugs/${id}`, data),

  deleteDrug: (id: number) =>
    apiClient.delete<void>(`/catalog/drugs/${id}`),

  // CLS Services
  listCls: (params?: { keyword?: string; service_group?: string; is_active?: boolean; is_bhyt?: boolean; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<ClsServiceList>>('/catalog/cls', { params }),

  getCls: (id: number) =>
    apiClient.get<ClsServiceResponse>(`/catalog/cls/${id}`),

  createCls: (data: ClsServicePayload) =>
    apiClient.post<ClsServiceResponse>('/catalog/cls', data),

  updateCls: (id: number, data: Partial<ClsServicePayload>) =>
    apiClient.put<ClsServiceResponse>(`/catalog/cls/${id}`, data),

  deleteCls: (id: number) =>
    apiClient.delete<void>(`/catalog/cls/${id}`),

  // ICD-10
  searchIcd10: (keyword: string, limit = 20) =>
    apiClient.get<Icd10[]>('/catalog/icd10', { params: { keyword, limit } }),

  getIcd10ByCode: (code: string) =>
    apiClient.get<Icd10>(`/catalog/icd10/${code}`),
};
