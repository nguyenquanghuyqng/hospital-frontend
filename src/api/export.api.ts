/**
 * Export API — xuất dữ liệu BHYT và báo cáo.
 */
import { tokenStorage } from './client';

const BASE_URL = '/api/v1';

/**
 * Tải XML BHYT cho một hoặc nhiều phiếu khám.
 * Dùng fetch trực tiếp vì response là binary (file download).
 */
export const exportApi = {
  /** Xuất XML BHYT cho 1 phiếu khám — mở tab download trực tiếp */
  downloadBhytXmlSingle: async (examinationId: number, batchCode?: string): Promise<void> => {
    const token = tokenStorage.get();
    const params = batchCode ? `?batch_code=${encodeURIComponent(batchCode)}` : '';
    const res = await fetch(`${BASE_URL}/export/bhyt-xml/${examinationId}${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `BHYT_exam_${examinationId}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  },

  /** Xuất XML BHYT batch cho nhiều phiếu khám */
  downloadBhytXmlBatch: async (examinationIds: number[], batchCode?: string): Promise<void> => {
    const token = tokenStorage.get();
    const res = await fetch(`${BASE_URL}/export/bhyt-xml`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ examination_ids: examinationIds, batch_code: batchCode }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(err.detail ?? `HTTP ${res.status}`);
    }
    const blob     = await res.blob();
    const url      = URL.createObjectURL(blob);
    const filename = batchCode
      ? `BHYT_${batchCode}.xml`
      : `BHYT_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xml`;
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
