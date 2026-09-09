/**
 * ExaminationPage — Phiếu khám bệnh (refactored)
 *
 * Layout 3 cột:
 *   [Sidebar BN 260px] | [Form chính scroll] | [Bảng kê đơn 420px]
 *
 * Luồng nghiệp vụ:
 *   loadOrCreate → hiển thị phiếu
 *   Các section (II, III) tự auto-save khi blur
 *   Nút cuối màn hình: Tiếp | Lưu | Bỏ qua | Chuyển viện | In chi phí | Kết thúc
 *
 * Tabs phụ (dưới bảng kê đơn):
 *   Hẹn khám | Giấy BHXH | Tạm ứng | Chi phí | Viện phí
 */
import { useEffect, useCallback, useState, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { examinationApi } from '@api/examination.api';
import { receptionApi } from '@api/reception.api';
import { patientApi } from '@api/patient.api';
import { useAsync } from '@hooks/useAsync';
import {
  Button, Card, LoadingOverlay, ErrorState, ConfirmDialog, Field,
} from '@components/ui';
import { ROUTES } from '@/app/routes';
import type { ExaminationResponse, ReceptionResponse, PatientResponse } from '@/types';

// ── Feature components ─────────────────────────────────────────────────────────
import PatientInfoSidebar from '../components/PatientInfoSidebar';
import ExaminationForm    from '../components/ExaminationForm';
import ExamInfoSection    from '../components/ExamInfoSection';
import OrdersTable        from '../components/OrdersTable';

// ── Lazy-loaded sub-panels (tabs phụ) ─────────────────────────────────────────
const PrescriptionPanel = lazy(() => import('../components/PrescriptionPanel'));
const ClsPanel          = lazy(() => import('../components/ClsPanel'));
const BillingPanel      = lazy(() => import('../components/BillingPanel'));

// ── Disposition → action button label ─────────────────────────────────────────
const SAVE_LABEL_BY_DISPOSITION: Record<string, string> = {
  discharged:     '✅ Khám xong cho về',
  chronic_script: '💊 Cấp toa cho về',
  revisit:        '📅 Lưu & Hẹn tái khám',
  inpatient:      '🏥 Lưu & Nhập viện',
  transfer_out:   '🚑 Lưu & Chuyển tuyến',
  outpatient:     '🏠 Lưu ngoại trú',
  emergency:      '🚨 Lưu cấp cứu',
};

// ── Sub-tab for right panel ────────────────────────────────────────────────────
type SubTab = 'orders' | 'prescription' | 'cls' | 'appointment' | 'bhxh' | 'deposit' | 'cost' | 'billing';

const SUB_TABS: { id: SubTab; icon: string; label: string }[] = [
  { id: 'orders',       icon: '📋', label: 'Kê đơn'       },
  { id: 'prescription', icon: '💊', label: 'Đơn thuốc'    },
  { id: 'cls',          icon: '🔬', label: 'CLS'           },
  { id: 'appointment',  icon: '📅', label: 'Hẹn khám'     },
  { id: 'bhxh',         icon: '📄', label: 'Giấy BHXH'    },
  { id: 'deposit',      icon: '💰', label: 'Tạm ứng'      },
  { id: 'cost',         icon: '🧾', label: 'Chi phí'       },
  { id: 'billing',      icon: '🏦', label: 'Viện phí'      },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ExaminationPage() {
  const { receptionId } = useParams<{ receptionId: string }>();
  const navigate = useNavigate();

  const receptionAsync   = useAsync<ReceptionResponse>();
  const examinationAsync = useAsync<ExaminationResponse>();
  const patientAsync     = useAsync<PatientResponse>();
  const actionAsync      = useAsync<ExaminationResponse>();

  const [activeSubTab,    setActiveSubTab]    = useState<SubTab>('orders');
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmSkip,     setConfirmSkip]     = useState(false);
  const [confirmTransfer, setConfirmTransfer] = useState(false);

  // ── Load / create ──────────────────────────────────────────────────────────
  const loadOrCreate = useCallback(async () => {
    if (!receptionId) return;
    const rid = Number(receptionId);

    const rec = await receptionAsync.run(receptionApi.get(rid));

    let existingExam: ExaminationResponse | null = null;
    try {
      existingExam = await examinationApi.getByReception(rid);
    } catch (err: unknown) {
      const httpStatus = (err as { status?: number })?.status;
      if (httpStatus !== 404) {
        examinationAsync.run(Promise.reject(err));
        return;
      }
    }

    if (existingExam) {
      examinationAsync.run(Promise.resolve(existingExam));
      // Load patient đầy đủ (PatientResponse) song song
      if (existingExam.patient_id) patientAsync.run(patientApi.get(existingExam.patient_id));
      return;
    }

    if (rec?.status !== 'checked_in') {
      const statusLabel: Record<string, string> = {
        pending:   'chưa được tiếp nhận (pending)',
        completed: 'đã hoàn thành',
        cancelled: 'đã huỷ',
      };
      const label = statusLabel[rec?.status ?? ''] ?? rec?.status ?? 'không hợp lệ';
      examinationAsync.run(
        Promise.reject(new Error(`Lượt tiếp đón ${label}, không thể mở phiếu khám`)),
      );
      return;
    }

    const newExam = await examinationAsync.run(examinationApi.create({ reception_id: rid }));
    if (newExam?.patient_id) patientAsync.run(patientApi.get(newExam.patient_id));
  }, [receptionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void loadOrCreate(); }, [loadOrCreate]);

  const reload = useCallback(() => {
    if (receptionId)
      examinationAsync.run(examinationApi.getByReception(Number(receptionId)));
  }, [receptionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Action handlers ────────────────────────────────────────────────────────

  /** Tiếp: lưu và chuyển sang bệnh nhân tiếp theo trong hàng đợi */
  const handleNext = async () => {
    if (!exam) return;
    const res = await actionAsync.run(examinationApi.save(exam.id));
    if (res) { toast.success('Đã lưu — chuyển bệnh nhân tiếp theo'); navigate(ROUTES.DOCTOR); }
    else toast.error(actionAsync.error ?? 'Lưu thất bại');
  };

  /** Lưu: lưu trạng thái hiện tại */
  const handleSave = async () => {
    if (!exam) return;
    const res = await actionAsync.run(examinationApi.save(exam.id));
    if (res) { toast.success('Đã lưu phiếu khám'); reload(); }
    else toast.error(actionAsync.error ?? 'Lưu thất bại');
  };

  /** Bỏ qua: skip bệnh nhân, quay lại hàng đợi */
  const handleSkip = async () => {
    if (!exam) return;
    const res = await actionAsync.run(examinationApi.skip(exam.id));
    if (res) { toast.success('Đã bỏ qua — quay lại hàng đợi'); navigate(ROUTES.DOCTOR); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  /** Kết thúc: hoàn tất phiếu khám */
  const handleComplete = async () => {
    if (!exam) return;
    const res = await actionAsync.run(examinationApi.complete(exam.id));
    if (res) { toast.success('Kết thúc khám thành công!'); navigate(ROUTES.DOCTOR); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  /** Chuyển viện: mark chuyển tuyến rồi navigate về doctor */
  const handleTransfer = async () => {
    if (!exam) return;
    await actionAsync.run(examinationApi.update(exam.id, { disposition: 'transfer_out' }));
    toast.success('Đã ghi nhận chuyển viện');
    reload();
    setConfirmTransfer(false);
  };

  /** In chi phí */
  const handlePrintCost = () => window.print();

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (receptionAsync.loading || examinationAsync.loading) return <LoadingOverlay />;
  if (examinationAsync.error) return (
    <ErrorState message={examinationAsync.error} onRetry={loadOrCreate} />
  );

  const exam = examinationAsync.data;
  const rec  = receptionAsync.data;
  if (!exam) return null;

  const isCompleted  = exam.status === 'completed';
  const p            = patientAsync.data ?? null;
  const saveLabel    = exam.disposition
    ? (SAVE_LABEL_BY_DISPOSITION[exam.disposition] ?? '💾 Lưu')
    : '💾 Lưu';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      minHeight: '100vh', background: 'var(--clr-gray-50)',
    }}>

      {/* ══ Sticky header ═══════════════════════════════════════════════════ */}
      <div style={{
        position: 'sticky', top: 'var(--header-h, 56px)', zIndex: 50,
        background: '#fff', borderBottom: '2px solid var(--clr-primary)',
        boxShadow: '0 2px 8px rgba(0,0,0,.08)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 20px', flexWrap: 'wrap',
        }}>
          {/* Back */}
          <button
            onClick={() => navigate(-1)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '1.1rem', color: 'var(--clr-gray-500)', padding: '4px 8px',
            }}
            aria-label="Quay lại"
          >←</button>

          {/* Tiêu đề */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--clr-gray-900)' }}>
                📋 Phiếu khám
              </span>
              <span style={{
                fontSize: '.78rem', fontFamily: 'monospace',
                background: 'var(--clr-primary-light)', color: 'var(--clr-primary-dark)',
                padding: '2px 8px', borderRadius: 6,
              }}>#{exam.reception_id}</span>
              <ExamStatusBadge status={exam.status} />
              {rec?.clinic_room && (
                <span style={{ fontSize: '.78rem', color: 'var(--clr-gray-500)' }}>
                  📍 {rec.clinic_room}
                </span>
              )}
              {exam.exam_date && (
                <span style={{ fontSize: '.78rem', color: 'var(--clr-gray-500)' }}>
                  📅 {new Date(exam.exam_date).toLocaleDateString('vi-VN')}
                </span>
              )}
            </div>
            <div style={{ fontSize: '.82rem', color: 'var(--clr-gray-600)', marginTop: 1 }}>
              {p?.full_name ?? `BN #${exam.patient_id}`}
              {p?.birth_year && <span style={{ marginLeft: 8, color: 'var(--clr-gray-400)' }}>{new Date().getFullYear() - p.birth_year} tuổi</span>}
              {p?.gender && <span style={{ marginLeft: 8, color: 'var(--clr-gray-400)' }}>{p.gender === 'male' ? 'Nam' : 'Nữ'}</span>}
            </div>
          </div>

          {/* ── Action buttons ───────────────────────────────────────────── */}
          {!isCompleted && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <Button size="sm" variant="ghost" onClick={handleNext} loading={actionAsync.loading} title="Lưu và chuyển BN tiếp theo">
                ⏭ Tiếp
              </Button>
              <Button size="sm" variant="secondary" onClick={handleSave} loading={actionAsync.loading}>
                {saveLabel}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmSkip(true)}>
                ⏸ Bỏ qua
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmTransfer(true)}>
                🚑 Chuyển viện
              </Button>
              <Button size="sm" variant="ghost" onClick={handlePrintCost}>
                🖨️ In chi phí
              </Button>
              <Button size="sm" onClick={() => setConfirmComplete(true)}>
                🏁 Kết thúc
              </Button>
            </div>
          )}

          {isCompleted && (
            <div style={{ display: 'flex', gap: 6 }}>
              <Button size="sm" variant="ghost" onClick={handlePrintCost}>
                🖨️ In chi phí
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ══ Body: 3-column layout ════════════════════════════════════════════ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr 420px',
        gap: 0,
        flex: 1,
        alignItems: 'start',
        minHeight: 0,
      }}>

        {/* ─── Col 1: Sidebar ────────────────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 'calc(var(--header-h, 56px) + 53px)',
          height: 'calc(100vh - var(--header-h, 56px) - 53px)',
          overflowY: 'auto',
          background: '#fff',
          borderRight: '1px solid var(--clr-gray-100)',
        }}>
          <PatientInfoSidebar
            exam={exam}
            reception={rec ?? null}
            patient={p}
          />
        </div>

        {/* ─── Col 2: Main form ──────────────────────────────────────────── */}
        <div style={{
          padding: '16px 20px',
          display: 'flex', flexDirection: 'column', gap: 12,
          overflowY: 'auto',
          borderRight: '1px solid var(--clr-gray-100)',
        }}>

          {/* Section II: Thông tin vào */}
          <SectionHeader roman="II" title="Thông tin vào" />
          <ExaminationForm
            exam={exam}
            disabled={isCompleted}
            onUpdated={reload}
          />

          {/* Section III: Thông tin khám */}
          <SectionHeader roman="III" title="Thông tin khám" />
          <ExamInfoSection
            exam={exam}
            disabled={isCompleted}
            onUpdated={reload}
          />

          {/* Bottom action bar (mirror header cho màn hình nhỏ) */}
          {!isCompleted && (
            <div style={{
              position: 'sticky', bottom: 0,
              background: '#fff', borderTop: '1px solid var(--clr-gray-200)',
              padding: '10px 0',
              display: 'flex', gap: 8, flexWrap: 'wrap',
              zIndex: 10,
            }}>
              <Button size="sm" variant="ghost" onClick={handleNext} loading={actionAsync.loading}>
                ⏭ Tiếp
              </Button>
              <Button size="sm" variant="secondary" onClick={handleSave} loading={actionAsync.loading}>
                {saveLabel}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmSkip(true)}>
                ⏸ Bỏ qua
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmTransfer(true)}>
                🚑 Chuyển viện
              </Button>
              <Button size="sm" variant="ghost" onClick={handlePrintCost}>
                🖨️ In chi phí
              </Button>
              <Button size="sm" onClick={() => setConfirmComplete(true)}>
                🏁 Kết thúc
              </Button>
            </div>
          )}
        </div>

        {/* ─── Col 3: Kê đơn + tabs phụ ─────────────────────────────────── */}
        <div style={{
          position: 'sticky', top: 'calc(var(--header-h, 56px) + 53px)',
          height: 'calc(100vh - var(--header-h, 56px) - 53px)',
          overflowY: 'auto',
          background: '#fff',
          display: 'flex', flexDirection: 'column',
        }}>

          {/* Sub-tab bar */}
          <div style={{
            display: 'flex', overflowX: 'auto', flexShrink: 0,
            borderBottom: '2px solid var(--clr-gray-100)',
          }}>
            {SUB_TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveSubTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '8px 12px', border: 'none', background: 'transparent',
                  cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: '.78rem',
                  fontWeight: activeSubTab === t.id ? 700 : 400,
                  color: activeSubTab === t.id ? 'var(--clr-primary)' : 'var(--clr-gray-500)',
                  borderBottom: `2px solid ${activeSubTab === t.id ? 'var(--clr-primary)' : 'transparent'}`,
                  whiteSpace: 'nowrap', flexShrink: 0,
                  marginBottom: -2,
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
            <Suspense fallback={<LoadingOverlay />}>

              {activeSubTab === 'orders' && (
                <OrdersTable
                  examId={exam.id}
                  items={exam.prescription_items}
                  disabled={isCompleted}
                  onChanged={reload}
                />
              )}

              {activeSubTab === 'prescription' && (
                <PrescriptionPanel
                  examId={exam.id}
                  items={exam.prescription_items}
                  disabled={isCompleted}
                  onChanged={reload}
                />
              )}

              {activeSubTab === 'cls' && (
                <ClsPanel
                  examId={exam.id}
                  items={exam.prescription_items.filter(i => i.item_type === 'cls')}
                  disabled={isCompleted}
                  onChanged={reload}
                />
              )}

              {activeSubTab === 'appointment' && (
                <AppointmentSubPanel exam={exam} disabled={isCompleted} onUpdated={reload} />
              )}

              {activeSubTab === 'bhxh' && (
                <BhxhSubPanel exam={exam} patient={p} disabled={isCompleted} />
              )}

              {activeSubTab === 'deposit' && (
                <DepositSubPanel />
              )}

              {activeSubTab === 'cost' && (
                <CostSubPanel examId={exam.id} />
              )}

              {activeSubTab === 'billing' && (
                <BillingPanel
                  examId={exam.id}
                  patientName={p?.full_name}
                  canEdit={!isCompleted}
                />
              )}

            </Suspense>
          </div>
        </div>

      </div>

      {/* ══ Confirm dialogs ══════════════════════════════════════════════════ */}
      <ConfirmDialog
        open={confirmComplete}
        onClose={() => setConfirmComplete(false)}
        onConfirm={handleComplete}
        title="Kết thúc khám"
        message="Xác nhận kết thúc phiếu khám? Sau khi kết thúc bạn không thể chỉnh sửa thêm."
        confirmLabel="🏁 Kết thúc"
      />
      <ConfirmDialog
        open={confirmSkip}
        onClose={() => setConfirmSkip(false)}
        onConfirm={handleSkip}
        title="Bỏ qua bệnh nhân"
        message="Bệnh nhân này sẽ được đưa trở lại hàng đợi. Tiếp tục?"
        confirmLabel="⏸ Bỏ qua"
      />
      <ConfirmDialog
        open={confirmTransfer}
        onClose={() => setConfirmTransfer(false)}
        onConfirm={handleTransfer}
        title="Chuyển viện"
        message="Xác nhận chuyển bệnh nhân này sang cơ sở y tế khác? Hướng xử trí sẽ được ghi nhận là Chuyển tuyến."
        confirmLabel="🚑 Chuyển viện"
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper components (nhỏ, tự thân)
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ roman, title }: { roman: string; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '6px 0',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: 'var(--clr-primary)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '.75rem', fontWeight: 800, flexShrink: 0,
      }}>{roman}</div>
      <span style={{ fontWeight: 800, fontSize: '.9rem', color: 'var(--clr-gray-800)' }}>
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--clr-gray-200)' }} />
    </div>
  );
}

function ExamStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    draft:     { label: 'Đang khám',  bg: '#dbeafe', color: '#1d4ed8' },
    saved:     { label: 'Đã lưu',    bg: '#fef3c7', color: '#92400e' },
    completed: { label: '✅ Hoàn tất', bg: '#d1fae5', color: '#065f46' },
  };
  const st = map[status] ?? map.draft;
  return (
    <span style={{
      fontSize: '.75rem', fontWeight: 700, padding: '2px 10px', borderRadius: 999,
      background: st.bg, color: st.color,
    }}>{st.label}</span>
  );
}

// ── AppointmentSubPanel ────────────────────────────────────────────────────────

function AppointmentSubPanel({
  exam, disabled, onUpdated,
}: { exam: ExaminationResponse; disabled: boolean; onUpdated: () => void }) {
  const [date,   setDate]   = useState(
    exam.revisit_days ? new Date(Date.now() + exam.revisit_days * 86400000).toISOString().slice(0, 10) : '',
  );
  const [days,   setDays]   = useState(String(exam.revisit_days ?? ''));
  const [reason, setReason] = useState('');
  const [doctor, setDoctor] = useState(exam.doctor_name ?? '');
  const saveAsync = useAsync<ExaminationResponse>();

  const handleSave = async () => {
    const res = await saveAsync.run(examinationApi.update(exam.id, {
      revisit_days:   days ? Number(days) : undefined,
      revisit_result: reason || undefined,
      doctor_name:    doctor || undefined,
    }));
    if (!res) { toast.error(saveAsync.error ?? 'Lưu thất bại'); return; }
    if (date && exam.patient_id) {
      try {
        const { appointmentApi } = await import('@api/appointment.api');
        await appointmentApi.create({
          patient_id:     exam.patient_id, examination_id: exam.id,
          scheduled_date: date, appointment_type: 'revisit',
          doctor_name: doctor || undefined, reason: reason || undefined,
        });
      } catch { /* không block */ }
    }
    toast.success('Đã lưu lịch hẹn');
    onUpdated();
  };

  const handleDateChange = (d: string) => {
    setDate(d);
    if (d) {
      const diff = Math.round((new Date(d).getTime() - Date.now()) / 86400000);
      if (diff > 0) setDays(String(diff));
    }
  };

  const handleDaysChange = (d: string) => {
    setDays(d);
    if (d && Number(d) > 0) {
      setDate(new Date(Date.now() + Number(d) * 86400000).toISOString().slice(0, 10));
    }
  };

  return (
    <Card title="📅 Phiếu hẹn tái khám">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {date && (
          <div style={{
            padding: '12px 16px', background: '#f0fdf4',
            border: '1px solid #86efac', borderRadius: 10,
          }}>
            <div style={{ fontWeight: 700, color: '#166534' }}>
              📅 {new Date(date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            {days && <div style={{ fontSize: '.82rem', color: '#16a34a', marginTop: 2 }}>Sau {days} ngày</div>}
          </div>
        )}
        <div className="form-row form-row-2">
          <Field label="Ngày hẹn">
            <input type="date" className="form-input" value={date} disabled={disabled}
              min={new Date().toISOString().slice(0, 10)}
              onChange={e => handleDateChange(e.target.value)} />
          </Field>
          <Field label="Số ngày">
            <input type="number" className="form-input" value={days} disabled={disabled}
              min={1} placeholder="30" onChange={e => handleDaysChange(e.target.value)} />
          </Field>
        </div>
        <Field label="Bác sĩ phụ trách">
          <input className="form-input" value={doctor} disabled={disabled}
            placeholder="Bác sĩ khám lần sau..." onChange={e => setDoctor(e.target.value)} />
        </Field>
        <Field label="Dặn dò bệnh nhân">
          <textarea className="form-input" rows={3} value={reason} disabled={disabled}
            placeholder="Tái khám kiểm tra, uống thuốc đúng giờ..."
            onChange={e => setReason(e.target.value)} />
        </Field>
        {!disabled && (
          <Button size="sm" variant="secondary" loading={saveAsync.loading} onClick={handleSave}>
            💾 Lưu lịch hẹn
          </Button>
        )}
      </div>
    </Card>
  );
}

// ── BhxhSubPanel ──────────────────────────────────────────────────────────────

function BhxhSubPanel({
  exam, patient, disabled,
}: { exam: ExaminationResponse; patient: PatientResponse | null; disabled: boolean }) {
  const calcTo = (from: string, d: string) => {
    if (!from || !d) return '';
    const dt = new Date(from); dt.setDate(dt.getDate() + Number(d) - 1);
    return dt.toISOString().slice(0, 10);
  };
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ days: '3', from_date: today, to_date: calcTo(today, '3'), diagnosis: '', workplace: '', note: '' });
  const primaryDiag = exam.diagnoses.find(d => d.is_primary) ?? exam.diagnoses[0];

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const upd = { ...form, [key]: e.target.value };
    if (key === 'days' || key === 'from_date')
      upd.to_date = calcTo(key === 'from_date' ? e.target.value : form.from_date, key === 'days' ? e.target.value : form.days);
    setForm(upd);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card title="📄 Giấy nghỉ hưởng BHXH">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: '10px 12px', background: 'var(--clr-gray-50)', borderRadius: 8, fontSize: '.82rem' }}>
            <strong>{patient?.full_name ?? '—'}</strong>
            {patient?.birth_year && <span style={{ marginLeft: 10 }}>{patient.birth_year}</span>}
            {patient?.gender && <span style={{ marginLeft: 10 }}>{patient.gender === 'male' ? 'Nam' : 'Nữ'}</span>}
          </div>
          <div className="form-row form-row-3">
            <Field label="Số ngày nghỉ">
              <select className="form-input" value={form.days} disabled={disabled} onChange={set('days')}>
                {[1,2,3,4,5,7,10,14,21,28,30].map(d => <option key={d} value={d}>{d} ngày</option>)}
              </select>
            </Field>
            <Field label="Từ ngày">
              <input type="date" className="form-input" value={form.from_date} disabled={disabled} onChange={set('from_date')} />
            </Field>
            <Field label="Đến ngày">
              <input type="date" className="form-input" value={form.to_date} readOnly
                style={{ background: 'var(--clr-gray-100)', fontWeight: 600 }} />
            </Field>
          </div>
          <Field label="Chẩn đoán">
            <input className="form-input" value={form.diagnosis} disabled={disabled}
              placeholder={primaryDiag?.icd_name ?? 'Chẩn đoán...'}
              onChange={set('diagnosis')} />
          </Field>
          <Field label="Nơi làm việc">
            <input className="form-input" value={form.workplace} disabled={disabled}
              placeholder="Tên công ty / cơ quan..." onChange={set('workplace')} />
          </Field>
          <Field label="Ghi chú">
            <textarea className="form-input" rows={2} value={form.note} disabled={disabled}
              placeholder="Dặn dò thêm..." onChange={set('note')} />
          </Field>
          {!disabled && (
            <Button size="sm" variant="secondary" onClick={() => { window.print(); toast.success('Đang in...'); }}>
              🖨️ In giấy BHXH
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── DepositSubPanel ───────────────────────────────────────────────────────────

function DepositSubPanel() {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [note,   setNote]   = useState('');
  const [records, setRecords] = useState<Array<{ id: number; amount: string; method: string; note: string; time: string }>>([]);
  const total = records.reduce((s, r) => s + Number(r.amount), 0);

  const handleAdd = () => {
    if (!amount || Number(amount) <= 0) { toast.error('Nhập số tiền hợp lệ'); return; }
    setRecords(prev => [...prev, {
      id: Date.now(), amount, method, note,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    }]);
    setAmount(''); setNote('');
    toast.success('Đã thêm tạm ứng');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        padding: '12px 16px', background: 'var(--clr-primary-light)', borderRadius: 10,
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: '.9rem', color: 'var(--clr-primary-dark)' }}>Tổng tạm ứng</span>
        <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--clr-primary)' }}>
          {total.toLocaleString('vi-VN')} ₫
        </span>
      </div>
      <Card title="Thêm tạm ứng">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-row form-row-2">
            <Field label="Số tiền (₫)" required>
              <input type="number" min={0} step={1000} className="form-input"
                value={amount} onChange={e => setAmount(e.target.value)} placeholder="500000" />
            </Field>
            <Field label="Hình thức">
              <select className="form-input" value={method} onChange={e => setMethod(e.target.value)}>
                <option value="cash">💵 Tiền mặt</option>
                <option value="transfer">🏦 Chuyển khoản</option>
                <option value="card">💳 Thẻ</option>
                <option value="momo">📱 Ví điện tử</option>
              </select>
            </Field>
          </div>
          <Field label="Ghi chú">
            <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú..." />
          </Field>
          <Button size="sm" onClick={handleAdd}>+ Thêm tạm ứng</Button>
        </div>
      </Card>
      {records.length > 0 && (
        <Card title={`Danh sách tạm ứng (${records.length})`}>
          {records.map(r => (
            <div key={r.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '1px solid var(--clr-gray-100)', fontSize: '.85rem',
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{Number(r.amount).toLocaleString('vi-VN')} ₫</div>
                <div style={{ fontSize: '.75rem', color: 'var(--clr-gray-400)' }}>
                  {r.method} • {r.time} {r.note && `• ${r.note}`}
                </div>
              </div>
              <button onClick={() => setRecords(prev => prev.filter(x => x.id !== r.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-danger)' }}>
                ✕
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── CostSubPanel ──────────────────────────────────────────────────────────────

function CostSubPanel({ examId }: { examId: number }) {
  const { data, loading, run } = useAsync<Record<string, number>>();
  const [key, setKey] = useState(0);
  useEffect(() => { run(examinationApi.cost(examId)); }, [examId, key]); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (v?: number) => v !== undefined ? v.toLocaleString('vi-VN') + ' ₫' : '—';

  return (
    <Card title="🧾 Tổng hợp chi phí"
      actions={<Button size="sm" variant="ghost" onClick={() => setKey(k => k + 1)}>↻</Button>}
    >
      {loading ? <LoadingOverlay /> : !data
        ? <p style={{ textAlign: 'center', color: 'var(--clr-gray-400)', padding: 20, fontSize: '.85rem' }}>Chưa có dữ liệu</p>
        : (
          <div>
            {[
              { label: '💊 Thuốc',          key: 'drug_total',    color: 'var(--clr-primary)' },
              { label: '🔬 CLS',            key: 'cls_total',     color: 'var(--clr-primary)' },
              { label: '📋 Tổng cộng',      key: 'total',         color: 'var(--clr-gray-800)', bold: true },
              { label: '🏥 BHYT chi trả',   key: 'bhyt_total',    color: '#059669' },
              { label: '👤 BN chi trả (CCT)', key: 'patient_total', color: '#dc2626', bold: true },
            ].map(row => (
              <div key={row.key} style={{
                display: 'flex', justifyContent: 'space-between', padding: '10px 0',
                borderBottom: '1px solid var(--clr-gray-100)',
              }}>
                <span style={{ fontSize: '.875rem', color: 'var(--clr-gray-600)' }}>{row.label}</span>
                <span style={{ fontWeight: row.bold ? 800 : 600, fontSize: row.bold ? '1rem' : '.9rem', color: row.color }}>
                  {fmt(data[row.key])}
                </span>
              </div>
            ))}
          </div>
        )
      }
    </Card>
  );
}
