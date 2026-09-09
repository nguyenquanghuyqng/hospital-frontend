/**
 * Admin API — quản lý nhân viên, cấu hình, audit log.
 * Chỉ dành cho role admin.
 */
import { apiClient } from './client';
import type { PaginatedResponse } from '@/types';

// ── User management ───────────────────────────────────────────────────────────

export interface AdminUser {
  id:          number;
  username:    string;
  full_name:   string | null;
  role:        string;
  clinic_room: string | null;
  is_active:   boolean;
}

export interface UserCreatePayload {
  username:    string;
  password:    string;
  full_name?:  string | null;
  role:        string;
  clinic_room?: string | null;
}

export interface UserUpdatePayload {
  full_name?:   string | null;
  role?:        string;
  clinic_room?: string | null;
  password?:    string | null;
}

// ── System Config ─────────────────────────────────────────────────────────────

export interface SystemConfig {
  id:          number;
  key:         string;
  value:       string | null;
  label:       string;
  group:       string;
  description: string | null;
  is_public:   boolean;
  updated_by:  string | null;
  updated_at:  string;
}

export interface ConfigUpsertPayload {
  key:         string;
  value?:      string | null;
  label:       string;
  group:       string;
  description?: string | null;
  is_public:   boolean;
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface AuditLog {
  id:          number;
  created_at:  string;
  user_id:     number | null;
  username:    string | null;
  action:      string;
  table_name:  string | null;
  record_id:   number | null;
  old_data:    string | null;
  new_data:    string | null;
  ip_address:  string | null;
  description: string | null;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const adminApi = {
  // Users
  listUsers: (params?: { role?: string; is_active?: boolean; search?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<AdminUser>>('/admin/users', { params }),

  getUser: (id: number) =>
    apiClient.get<AdminUser>(`/admin/users/${id}`),

  createUser: (data: UserCreatePayload) =>
    apiClient.post<AdminUser>('/admin/users', data),

  updateUser: (id: number, data: UserUpdatePayload) =>
    apiClient.put<AdminUser>(`/admin/users/${id}`, data),

  toggleUser: (id: number) =>
    apiClient.patch<AdminUser>(`/admin/users/${id}/toggle`),

  deleteUser: (id: number) =>
    apiClient.delete<void>(`/admin/users/${id}`),

  // Config
  getConfig: (group?: string) =>
    apiClient.get<SystemConfig[]>('/admin/config', { params: group ? { group } : undefined }),

  getConfigByKey: (key: string) =>
    apiClient.get<SystemConfig>(`/admin/config/${key}`),

  updateConfig: (key: string, value: string | null) =>
    apiClient.put<SystemConfig>(`/admin/config/${key}`, { value }),

  upsertConfig: (data: ConfigUpsertPayload) =>
    apiClient.post<SystemConfig>('/admin/config', data),

  // Audit
  getAuditLogs: (params?: { user_id?: number; action?: string; table_name?: string; page?: number; page_size?: number }) =>
    apiClient.get<PaginatedResponse<AuditLog>>('/admin/audit-logs', { params }),

  getRecordAudit: (table_name: string, record_id: number) =>
    apiClient.get<AuditLog[]>('/admin/audit-logs/record', { params: { table_name, record_id } }),
};
