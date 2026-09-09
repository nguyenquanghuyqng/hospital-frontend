/**
 * ExaminationPage — Phiếu khám bệnh v4
 *
 * Layout mới: Slide-over panel thay dock cố định
 * ─────────────────────────────────────────────────
 *
 *  ┌─ CONTEXT BAR (48px) ──────────────────────────────────────────────┐
 *  │  ← BN  │ Tên BN · tuổi · giới · flags │ [Tab buttons] │ 🖨 In   │
 *  └───────────────────────────────────────────────────────────────────┘
 *  ┌─ BODY (flex-1) ────────────────────────────────────────────────────┐
 *  │ [Sidebar BN 280px] │ [Form khám — toàn bộ chiều cao scroll]       │
 *  └───────────────────────────────────────────────────────────────────┘
 *  ┌─ ACTION BAR (52px) — fixed bottom ────────────────────────────────┐
 *  │  ⏸ Bỏ qua · 🚑 Chuyển viện · 🖨️ In  │  ⏭ BN tiếp · 💾 Lưu · 🏁 │
 *  └───────────────────────────────────────────────────────────────────┘
 *
 *  Slide-over: xuất hiện từ phải, 55% màn hình, form vẫn thấy bên trái
 *  - Kê đơn / Thuốc / CLS → Slide-over (cần xem form bên cạnh)
 *  - Hẹn / BHXH / Tạm ứng / Chi phí / Viện phí → Modal compact
 */
import { useEffect, useCallback, useState, lazy, Suspense, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { examinationApi } from '@api/examination.api';
import { receptionApi }   from '@api/reception.api';
import { patientApi }     from '@api/patient.api';
import { useAsync }       from '@hooks/useAsync';
import { Button, LoadingOverlay, ErrorState, ConfirmDialog, Field } from '@components/ui';
import { ROUTES } from '@/app/routes';
import type { ExaminationResponse, ReceptionResponse, PatientResponse } from '@/types';

import PatientInfoSidebar from '../components/PatientInfoSidebar';
import ExaminationForm    from '../components/ExaminationForm';
import ExamInfoSection    from '../components/ExamInfoSection';
import OrdersTable        from '../components/OrdersTable';
import PrintCostSheet     from '../components/PrintCostSheet';

const PrescriptionPanel = lazy(() => import('../components/PrescriptionPanel'));
const ClsPanel          = lazy(() => import('../components/ClsPanel'));
const BillingPanel      = lazy(() => import('../components/BillingPanel'));

// ── Constants ─────────────────────────────────────────────────────────────────

const SAVE_LABEL: Record<string, { label: string; icon: string; color: string }> = {
  discharged:     { label: 'Cho về',       icon: '✅', color: '#065f46' },
  chronic_script: { label: 'Cấp toa',      icon: '💊', color: '#1e3a5f' },
  revisit:        { label: 'Hẹn tái khám', icon: '📅', color: '#5b21b6' },
  inpatient:      { label: 'Nhập viện',    icon: '🏥', color: '#92400e' },
  transfer_out:   { label: 'Chuyển tuyến', icon: '🚑', color: '#9d174d' },
  outpatient:     { label: 'Ngoại trú',    icon: '🏠', color: '#1d4ed8' },
  emergency:      { label: 'Cấp cứu',      icon: '🚨', color: '#991b1b' },
};

type PanelId = 'orders' | 'prescription' | 'cls' | 'appointment' | 'bhxh' | 'deposit' | 'cost' | 'billing';

// Slide-over: bác sĩ cần thấy form khám bên trái trong khi kê đơn
// Modal: tính năng standalone, không cần context form
const SLIDE_OVER_PANELS = new Set<PanelId>(['orders', 'prescription', 'cls', 'billing']);

const PANELS: {
  id: PanelId; label: string; icon: string; tip: string;
  badge?: (d: number, c: number) => number | undefined;
}[] = [
  { id: 'orders',       icon: '📋', label: 'Kê đơn',   tip: 'Tất cả y lệnh — thuốc + CLS',
    badge: (d, c) => d + c || undefined },
  { id: 'prescription', icon: '💊', label: 'Thuốc',    tip: 'Kê đơn thuốc',
    badge: (d) => d || undefined },
  { id: 'cls',          icon: '🔬', label: 'CLS',      tip: 'Xét nghiệm & CĐHA',
    badge: (_d, c) => c || undefined },
  { id: 'appointment',  icon: '📅', label: 'Hẹn',      tip: 'Lịch hẹn tái khám' },
  { id: 'bhxh',         icon: '📄', label: 'BHXH',     tip: 'Giấy nghỉ BHXH' },
  { id: 'deposit',      icon: '💵', label: 'Tạm ứng',  tip: 'Thu tạm ứng' },
  { id: 'cost',         icon: '🧾', label: 'Chi phí',  tip: 'Tổng hợp chi phí' },
  { id: 'billing',      icon: '🏦', label: 'Viện phí', tip: 'Hoá đơn & thanh toán' },
];

const CONTEXT_H   = 48;
const ACTION_H    = 52;

// ─────────────────────────────────────────────────────────────────────────────

export default function ExaminationPage() {
  const { receptionId } = useParams<{ receptionId: string }>();
  const navigate = useNavigate();

  const receptionAsync   = useAsync<ReceptionResponse>();
  const examinationAsync = useAsync<ExaminationResponse>();
  const patientAsync     = useAsync<PatientResponse>();
  const actionAsync      = useAsync<ExaminationResponse>();

  const [sidebarOpen,     setSidebarOpen]     = useState(true);
  const [activePanel,     setActivePanel]     = useState<PanelId | null>(null);
  const [confirmComplete, setConfirmComplete] = useState(false);
  const [confirmSkip,     setConfirmSkip]     = useState(false);
  const [confirmTransfer, setConfirmTransfer] = useState(false);
  const [printBill,       setPrintBill]       = useState<import('@/types').BillResponse | null>(null);

  // Keyboard: Escape closes panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePanel(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // position:fixed — thoát hoàn toàn khỏi .main-content flow.
  // KHÔNG touch overflow của html/body vì nó block wheel events trên children.
  // Scroll hoạt động nhờ overflowY:auto trên các div con, không bị ảnh hưởng
  // bởi document overflow khi dùng position:fixed.
  useEffect(() => {
    // Không làm gì — position:fixed tự đủ
    return () => {};
  }, []);

  // ── Data loading ───────────────────────────────────────────────────────────
  const loadOrCreate = useCallback(async () => {
    if (!receptionId) return;
    const rid = Number(receptionId);
    const rec = await receptionAsync.run(receptionApi.get(rid));

    let existingExam: ExaminationResponse | null = null;
    try {
      existingExam = await examinationApi.getByReception(rid);
    } catch (err: unknown) {
      const httpStatus = (err as { status?: number })?.status;
      if (httpStatus !== 404) { examinationAsync.run(Promise.reject(err)); return; }
    }

    if (existingExam) {
      examinationAsync.run(Promise.resolve(existingExam));
      if (existingExam.patient_id) patientAsync.run(patientApi.get(existingExam.patient_id));
      return;
    }

    if (rec?.status !== 'checked_in') {
      const lbl: Record<string, string> = {
        pending: 'chưa được tiếp nhận', completed: 'đã hoàn thành', cancelled: 'đã huỷ',
      };
      examinationAsync.run(
        Promise.reject(new Error(`Lượt tiếp đón ${lbl[rec?.status ?? ''] ?? rec?.status}, không thể mở phiếu khám`))
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

  // Auto-set exam_start_at khi phiếu mới
  useEffect(() => {
    const d = examinationAsync.data;
    if (d && !d.exam_start_at && !examinationAsync.loading) {
      examinationApi.update(d.id, { exam_start_at: new Date().toISOString() })
        .then(reload).catch(() => {});
    }
  }, [examinationAsync.data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleNext = async () => {
    if (!exam) return;
    const res = await actionAsync.run(examinationApi.save(exam.id));
    if (res) { toast.success('Đã lưu — chuyển bệnh nhân tiếp theo'); navigate(ROUTES.DOCTOR); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const handleSave = async () => {
    if (!exam) return;
    const res = await actionAsync.run(examinationApi.save(exam.id));
    if (res) { toast.success('Đã lưu phiếu khám'); reload(); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const handleSkip = async () => {
    if (!exam) return;
    const res = await actionAsync.run(examinationApi.skip(exam.id));
    if (res) { toast.success('Đã bỏ qua — trả về hàng đợi'); navigate(ROUTES.DOCTOR); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const handleComplete = async () => {
    if (!exam) return;
    const res = await actionAsync.run(examinationApi.complete(exam.id));
    if (res) { toast.success('Kết thúc khám thành công!'); navigate(ROUTES.DOCTOR); }
    else toast.error(actionAsync.error ?? 'Thất bại');
  };

  const handleTransfer = async () => {
    if (!exam) return;
    await actionAsync.run(examinationApi.update(exam.id, { disposition: 'transfer_out' }));
    toast.success('Đã ghi nhận chuyển viện'); reload(); setConfirmTransfer(false);
  };

  const handlePrintCost = async () => {
    if (!exam) return;
    try {
      const { billingApi } = await import('@api/billing.api');
      const bill = await billingApi.getBillByExam(exam.id);
      setPrintBill(bill);
    } catch { setPrintBill(null); }
    setTimeout(() => window.print(), 200);
  };

  // ── Guards ─────────────────────────────────────────────────────────────────
  if (receptionAsync.loading || examinationAsync.loading) return <LoadingOverlay />;
  if (examinationAsync.error)
    return <ErrorState message={examinationAsync.error} onRetry={loadOrCreate} />;
  const exam = examinationAsync.data;
  const rec  = receptionAsync.data;
  if (!exam) return null;

  const isCompleted  = exam.status === 'completed';
  const p            = patientAsync.data ?? null;
  const dispInfo     = exam.disposition ? SAVE_LABEL[exam.disposition] : null;
  const isEmergency  = exam.disposition === 'emergency';
  const isPriority   = exam.flag_priority || (rec?.priority ?? 0) > 0;
  const isBhyt       = exam.subject_type === '1' || !!exam.insurance_number;
  const drugCount    = exam.prescription_items.filter(i => i.item_type === 'drug').length;
  const clsCount     = exam.prescription_items.filter(i => i.item_type === 'cls').length;
  const totalDrug    = exam.prescription_items.filter(i => i.item_type === 'drug').reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const totalCls     = exam.prescription_items.filter(i => i.item_type === 'cls').reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const totalPatient = exam.prescription_items.reduce((s, i) => s + Number(i.patient_amount ?? 0), 0);

  const panelDef = activePanel ? PANELS.find(p => p.id === activePanel) : null;
  const isSlideOver = activePanel ? SLIDE_OVER_PANELS.has(activePanel) : false;

  const openPanel = (id: PanelId) => setActivePanel(prev => prev === id ? null : id);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    /*
     * Layout đơn giản: scroll ngoài như page thường.
     * Context bar sticky top, action bar sticky bottom.
     * Form content hiển thị full — không cần scroll container bên trong.
     */
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--clr-surface)',
      minHeight: '100%',
    }}>

      {/* ═══════════════════════════════════════════════════════════
          ROW 1 — Context bar — sticky top
      ══════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        flexShrink: 0,
        height: CONTEXT_H,
        background: isEmergency ? 'linear-gradient(90deg,#7f1d1d,#991b1b)' : '#fff',
        borderBottom: `2px solid ${isEmergency ? '#b91c1c' : 'var(--clr-gray-200)'}`,
        display: 'flex', alignItems: 'center', gap: 0,
        boxShadow: '0 1px 6px rgba(0,0,0,.07)',
      }}>

        {/* ── Left: nav + BN identity ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 10px 0 8px',
          borderRight: `1px solid ${isEmergency ? 'rgba(255,255,255,.15)' : 'var(--clr-gray-200)'}`,
          height: '100%', flexShrink: 0,
        }}>
          {/* Back */}
          <button onClick={() => navigate(-1)} title="Quay lại" style={iconBtn(isEmergency)}>
            ←
          </button>
          {/* Sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            title={sidebarOpen ? 'Ẩn sidebar BN' : 'Hiện sidebar BN'}
            style={{
              ...iconBtn(isEmergency),
              background: sidebarOpen
                ? (isEmergency ? 'rgba(255,255,255,.2)' : 'var(--clr-primary-light)')
                : iconBtn(isEmergency).background,
              color: sidebarOpen && !isEmergency ? 'var(--clr-primary-dark)' : iconBtn(isEmergency).color,
              border: `1px solid ${isEmergency ? 'rgba(255,255,255,.2)' : (sidebarOpen ? 'var(--clr-primary)30' : 'var(--clr-gray-200)')}`,
            }}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>

          {/* Avatar */}
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: isEmergency ? 'rgba(255,255,255,.25)' : 'linear-gradient(135deg,var(--clr-primary),var(--clr-primary-dark))',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: '.78rem', border: '2px solid rgba(255,255,255,.3)',
          }}>
            {(p?.full_name ?? '?')[0]?.toUpperCase()}
          </div>

          {/* Name + meta */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
              <span style={{
                fontWeight: 700, fontSize: '.88rem',
                color: isEmergency ? '#fff' : 'var(--clr-gray-900)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 180,
              }}>
                {p?.full_name ?? `BN #${exam.patient_id}`}
              </span>
              {(p?.birth_year || p?.date_of_birth) && (
                <span style={{ fontSize: '.68rem', color: isEmergency ? 'rgba(255,255,255,.6)' : 'var(--clr-gray-500)', flexShrink: 0 }}>
                  {new Date().getFullYear() - (p.date_of_birth ? new Date(p.date_of_birth).getFullYear() : (p.birth_year ?? 0))} t
                </span>
              )}
              {p?.gender && (
                <span style={{ fontSize: '.68rem', color: isEmergency ? 'rgba(255,255,255,.6)' : 'var(--clr-gray-500)', flexShrink: 0 }}>
                  {p.gender === 'male' ? '♂' : '♀'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
              <ExamStatusPill status={exam.status} />
              {rec?.clinic_room && (
                <span style={{ fontSize: '.65rem', color: isEmergency ? 'rgba(255,255,255,.55)' : 'var(--clr-gray-400)' }}>
                  📍 {rec.clinic_room}
                </span>
              )}
              <span style={{ fontSize: '.65rem', fontFamily: 'var(--font-mono)', color: isEmergency ? 'rgba(255,255,255,.4)' : 'var(--clr-gray-400)' }}>
                #{exam.reception_id}
              </span>
              {isEmergency && (
                <span style={{
                  fontSize: '.65rem', fontWeight: 800, padding: '1px 7px', borderRadius: 9999,
                  background: '#fff', color: '#991b1b',
                  animation: 'pulse-badge 1.2s infinite',
                }}>🚨 CẤP CỨU</span>
              )}
              {isPriority && !isEmergency && (
                <span style={{ fontSize: '.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 9999, background: '#fef3c7', color: '#92400e' }}>
                  ⭐ Ưu tiên
                </span>
              )}
              {isBhyt && (
                <span style={{
                  fontSize: '.65rem', fontWeight: 600, padding: '1px 6px', borderRadius: 9999,
                  background: isEmergency ? 'rgba(255,255,255,.15)' : '#dbeafe',
                  color: isEmergency ? '#bfdbfe' : '#1d4ed8',
                }}>BHYT</span>
              )}
              {dispInfo && (
                <span style={{
                  fontSize: '.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 9999,
                  background: isEmergency ? 'rgba(255,255,255,.15)' : dispInfo.color + '18',
                  color: isEmergency ? '#fff' : dispInfo.color,
                }}>
                  {dispInfo.icon} {dispInfo.label}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Center: Panel tab buttons ── */}
        <div style={{
          display: 'flex', alignItems: 'center', flex: 1,
          overflowX: 'auto', height: '100%',
          scrollbarWidth: 'none',
        }}
          onWheel={e => { e.currentTarget.scrollLeft += e.deltaY; }}
        >
          {PANELS.map(tab => {
            const isActive = activePanel === tab.id;
            const isSlide  = SLIDE_OVER_PANELS.has(tab.id);
            const count    = tab.badge?.(drugCount, clsCount);
            return (
              <button
                key={tab.id}
                title={`${tab.tip}${isSlide ? ' — slide-over' : ' — modal'}`}
                onClick={() => openPanel(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '0 11px',
                  height: '100%',
                  border: 'none',
                  borderBottom: `2px solid ${isActive
                    ? (isEmergency ? '#fca5a5' : 'var(--clr-primary)')
                    : 'transparent'}`,
                  borderRight: `1px solid ${isEmergency ? 'rgba(255,255,255,.08)' : 'var(--clr-gray-100)'}`,
                  background: isActive
                    ? (isEmergency ? 'rgba(255,255,255,.1)' : 'var(--clr-primary-subtle)')
                    : 'transparent',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '.75rem',
                  fontWeight: isActive ? 700 : 400,
                  color: isActive
                    ? (isEmergency ? '#fff' : 'var(--clr-primary)')
                    : (isEmergency ? 'rgba(255,255,255,.7)' : 'var(--clr-gray-500)'),
                  whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'all .12s',
                  position: 'relative',
                }}
              >
                <span style={{ fontSize: '.8rem' }}>{tab.icon}</span>
                <span>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    minWidth: 15, height: 15, padding: '0 3px', borderRadius: 9999,
                    background: isActive
                      ? (isEmergency ? 'rgba(255,255,255,.9)' : 'var(--clr-primary)')
                      : 'var(--clr-gray-200)',
                    color: isActive ? (isEmergency ? '#991b1b' : '#fff') : 'var(--clr-gray-600)',
                    fontSize: '.58rem', fontWeight: 800, lineHeight: 1,
                  }}>
                    {count}
                  </span>
                )}
                {/* Slide-over indicator dot */}
                {isSlide && !isActive && (
                  <span style={{
                    position: 'absolute', top: 6, right: 4,
                    width: 4, height: 4, borderRadius: '50%',
                    background: isEmergency ? 'rgba(255,255,255,.4)' : 'var(--clr-primary)',
                    opacity: .4,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* ── Right: cost summary + print ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '0 10px',
          borderLeft: `1px solid ${isEmergency ? 'rgba(255,255,255,.15)' : 'var(--clr-gray-200)'}`,
          height: '100%', flexShrink: 0,
        }}>
          {/* Real-time cost chips */}
          {(totalDrug > 0 || totalCls > 0) && (
            <QuickCostStrip drug={totalDrug} cls={totalCls} patient={totalPatient} emergency={isEmergency} />
          )}
          <button onClick={handlePrintCost} title="In chi phí mẫu 01/BYT" style={iconBtn(isEmergency)}>
            🖨
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          BODY — sidebar BN (sticky) + form hiển thị full
      ══════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>

        {/* ── Sidebar BN — sticky, dính theo trang khi scroll ── */}
        {sidebarOpen && (
          <div style={{
            width: 280,
            flexShrink: 0,
            position: 'sticky',
            top: CONTEXT_H,           /* dính ngay dưới context bar */
            maxHeight: `calc(100vh - var(--header-h, 52px) - ${CONTEXT_H}px - ${ACTION_H}px)`,
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRight: '1px solid var(--clr-gray-200)',
            background: '#fff',
          }}>
            <PatientInfoSidebar exam={exam} reception={rec ?? null} patient={p} />
          </div>
        )}

        {/* ── Form — hiển thị full, page scroll ── */}
        <div style={{
          flex: 1,
          minWidth: 0,
          padding: '16px 20px 100px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {isCompleted && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 16px',
              background: 'linear-gradient(90deg,#f0fdf4,#dcfce7)',
              border: '1px solid #86efac', borderRadius: 10,
              fontSize: '.85rem', color: '#166534', fontWeight: 600,
            }}>
              <span>✅</span>
              Phiếu khám đã hoàn tất — chế độ chỉ đọc.
            </div>
          )}

          <ClinicalSection num="II" title="Thông tin vào" icon="📥" accent="#0284c7">
            <ExaminationForm exam={exam} disabled={isCompleted} onUpdated={reload} />
          </ClinicalSection>

          <ClinicalSection num="III" title="Thông tin khám" icon="🩺" accent="#7c3aed">
            <ExamInfoSection exam={exam} disabled={isCompleted} onUpdated={reload} />
          </ClinicalSection>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          ACTION BAR — sticky bottom
      ══════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        flexShrink: 0,
        height: ACTION_H,
        background: '#fff',
        borderTop: '1.5px solid var(--clr-gray-200)',
        boxShadow: '0 -3px 16px rgba(0,0,0,.07)',
        display: 'flex', alignItems: 'center',
        padding: '0 14px', gap: 8,
        zIndex: 35,
      }}>
        {isCompleted ? (
          <>
            <span style={{ fontSize: '.8rem', color: 'var(--clr-gray-400)', flex: 1 }}>
              ✅ Phiếu khám đã kết thúc — chế độ chỉ đọc
            </span>
            <Button size="sm" variant="ghost" onClick={handlePrintCost}>🖨️ In phiếu</Button>
            <Button size="sm" variant="secondary" onClick={() => navigate(-1)}>← Quay lại</Button>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 5, flex: 1 }}>
              <ActionBtn onClick={() => setConfirmSkip(true)}     label="⏸ Bỏ qua" />
              <ActionBtn onClick={() => setConfirmTransfer(true)} label="🚑 Chuyển viện" />
              <ActionBtn onClick={handlePrintCost}                label="🖨️ In chi phí" />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <ActionBtn
                onClick={handleNext}
                disabled={actionAsync.loading}
                label="⏭ BN tiếp"
                filled
              />
              <button
                onClick={handleSave}
                disabled={actionAsync.loading}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 15px', borderRadius: 8,
                  border: '1.5px solid var(--clr-primary)',
                  background: 'var(--clr-primary-subtle)',
                  color: 'var(--clr-primary-dark)',
                  fontFamily: 'var(--font-sans)', fontSize: '.8rem', fontWeight: 700,
                  cursor: 'pointer', transition: 'all .15s',
                }}
              >
                {dispInfo ? `${dispInfo.icon} ${dispInfo.label}` : '💾 Lưu'}
              </button>
              <button
                onClick={() => setConfirmComplete(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '6px 16px', borderRadius: 8, border: 'none',
                  background: 'linear-gradient(135deg,#16a34a,#15803d)',
                  color: '#fff',
                  fontFamily: 'var(--font-sans)', fontSize: '.82rem', fontWeight: 700,
                  cursor: 'pointer', letterSpacing: '.01em',
                  boxShadow: '0 2px 8px rgba(22,163,74,.35)',
                  transition: 'all .15s',
                }}
              >
                🏁 Kết thúc khám
              </button>
            </div>
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          SLIDE-OVER PANEL — xuất hiện từ phải, 55% width
      ══════════════════════════════════════════════════════════ */}
      {activePanel && isSlideOver && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setActivePanel(null)}
            style={{
              position: 'fixed',
              top: 0, left: 0, right: 0, bottom: 0,
              zIndex: 45,
              background: 'rgba(15,23,42,.22)',
              backdropFilter: 'blur(1px)',
            }}
          />
          <div style={{
            position: 'fixed',
            top: `calc(var(--header-h, 52px) + ${CONTEXT_H}px)`,
            right: 0,
            bottom: 0,
            width: 'min(58vw, 900px)',
            zIndex: 46,
            background: '#fff',
            borderLeft: '2px solid var(--clr-gray-200)',
            boxShadow: '-8px 0 40px rgba(0,0,0,.14)',
            display: 'flex', flexDirection: 'column',
            animation: 'slideInFromRight .18s var(--ease-out)',
          }}>
            <PanelHeader
              def={panelDef!}
              drugCount={drugCount} clsCount={clsCount}
              onClose={() => setActivePanel(null)}
            />
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
              <Suspense fallback={<LoadingOverlay />}>
                <PanelContent
                  id={activePanel} exam={exam}
                  patient={p} isCompleted={isCompleted}
                  onChanged={reload}
                />
              </Suspense>
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL PANEL
      ══════════════════════════════════════════════════════════ */}
      {activePanel && !isSlideOver && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setActivePanel(null); }}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 50,
            background: 'rgba(15,23,42,.4)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
            animation: 'fadeIn .15s var(--ease-out)',
          }}
        >
          <div style={{
            width: '100%', maxWidth: 640,
            maxHeight: '82vh',
            background: '#fff',
            borderRadius: 16,
            border: '1px solid var(--clr-gray-100)',
            boxShadow: '0 24px 64px rgba(0,0,0,.18)',
            display: 'flex', flexDirection: 'column',
            animation: 'slideUp .18s var(--ease-out)',
          }}>
            <PanelHeader
              def={panelDef!}
              drugCount={drugCount} clsCount={clsCount}
              onClose={() => setActivePanel(null)}
              modal
            />
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              <Suspense fallback={<LoadingOverlay />}>
                <PanelContent
                  id={activePanel} exam={exam}
                  patient={p} isCompleted={isCompleted}
                  onChanged={reload}
                />
              </Suspense>
            </div>
          </div>
        </div>
      )}

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmComplete} onClose={() => setConfirmComplete(false)}
        onConfirm={handleComplete}
        title="Kết thúc phiếu khám"
        message="Sau khi kết thúc, phiếu khám chuyển sang chỉ đọc và không thể chỉnh sửa thêm. Xác nhận?"
        confirmLabel="🏁 Kết thúc khám"
      />
      <ConfirmDialog
        open={confirmSkip} onClose={() => setConfirmSkip(false)}
        onConfirm={handleSkip}
        title="Bỏ qua bệnh nhân"
        message="Bệnh nhân sẽ trở lại hàng đợi. Tiếp tục?"
        confirmLabel="⏸ Bỏ qua" danger
      />
      <ConfirmDialog
        open={confirmTransfer} onClose={() => setConfirmTransfer(false)}
        onConfirm={handleTransfer}
        title="Chuyển viện"
        message="Xác nhận chuyển bệnh nhân sang cơ sở y tế khác? Hướng xử trí sẽ cập nhật thành 'Chuyển tuyến'."
        confirmLabel="🚑 Xác nhận chuyển viện"
      />

      <PrintCostSheet exam={exam} reception={rec ?? null} patient={p} bill={printBill} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel content dispatcher
// ─────────────────────────────────────────────────────────────────────────────

function PanelContent({
  id, exam, patient, isCompleted, onChanged,
}: {
  id: PanelId;
  exam: ExaminationResponse;
  patient: PatientResponse | null;
  isCompleted: boolean;
  onChanged: () => void;
}) {
  if (id === 'orders')       return <OrdersTable examId={exam.id} items={exam.prescription_items} disabled={isCompleted} onChanged={onChanged} />;
  if (id === 'prescription') return <PrescriptionPanel examId={exam.id} items={exam.prescription_items} disabled={isCompleted} onChanged={onChanged} />;
  if (id === 'cls')          return <ClsPanel examId={exam.id} items={exam.prescription_items.filter(i => i.item_type === 'cls')} disabled={isCompleted} onChanged={onChanged} />;
  if (id === 'billing')      return <BillingPanel examId={exam.id} patientName={patient?.full_name} canEdit={!isCompleted} />;
  if (id === 'appointment')  return <AppointmentSubPanel exam={exam} disabled={isCompleted} onUpdated={onChanged} />;
  if (id === 'bhxh')         return <BhxhSubPanel exam={exam} patient={patient} disabled={isCompleted} />;
  if (id === 'deposit')      return <DepositSubPanel />;
  if (id === 'cost')         return <CostSubPanel examId={exam.id} />;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI helpers
// ─────────────────────────────────────────────────────────────────────────────

function iconBtn(emergency: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 30, height: 30, borderRadius: 7,
    background: emergency ? 'rgba(255,255,255,.1)' : 'var(--clr-gray-100)',
    border: `1px solid ${emergency ? 'rgba(255,255,255,.2)' : 'var(--clr-gray-200)'}`,
    color: emergency ? '#fff' : 'var(--clr-gray-600)',
    cursor: 'pointer', fontSize: '.82rem', flexShrink: 0,
    transition: 'all .12s',
  };
}

function ActionBtn({ onClick, label, disabled, filled }: {
  onClick: () => void; label: string; disabled?: boolean; filled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 7,
        border: `1px solid ${filled ? 'var(--clr-gray-200)' : 'var(--clr-gray-200)'}`,
        background: filled ? 'var(--clr-gray-100)' : 'transparent',
        color: 'var(--clr-gray-600)',
        fontFamily: 'var(--font-sans)', fontSize: '.78rem', fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? .5 : 1,
        transition: 'all .12s', whiteSpace: 'nowrap' as const,
      }}
    >
      {label}
    </button>
  );
}

function PanelHeader({
  def, drugCount, clsCount, onClose, modal,
}: {
  def: typeof PANELS[0];
  drugCount: number; clsCount: number;
  onClose: () => void;
  modal?: boolean;
}) {
  const isSlide = SLIDE_OVER_PANELS.has(def.id);
  const count   = def.badge?.(drugCount, clsCount);
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 18px',
      background: 'var(--clr-gray-50)',
      borderBottom: '1px solid var(--clr-gray-200)',
      borderRadius: modal ? '16px 16px 0 0' : 0,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: '1.1rem' }}>{def.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '.92rem', color: 'var(--clr-gray-900)' }}>
          {def.label}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
          {count !== undefined && count > 0 && (
            <span style={{
              fontSize: '.68rem', fontWeight: 700,
              padding: '1px 7px', borderRadius: 9999,
              background: 'var(--clr-primary-light)', color: 'var(--clr-primary-dark)',
            }}>
              {count} mục
            </span>
          )}
          <span style={{
            fontSize: '.65rem',
            padding: '1px 6px', borderRadius: 3,
            background: isSlide ? '#eff6ff' : 'var(--clr-gray-100)',
            border: `1px solid ${isSlide ? '#bfdbfe' : 'var(--clr-gray-200)'}`,
            color: isSlide ? '#1d4ed8' : 'var(--clr-gray-500)',
          }}>
            {isSlide ? '↔ Slide-over' : '⬜ Modal'}
          </span>
          <span style={{ fontSize: '.65rem', color: 'var(--clr-gray-400)' }}>
            Esc để đóng
          </span>
        </div>
      </div>
      <button
        onClick={onClose}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28, borderRadius: 6,
          background: 'var(--clr-gray-100)', border: 'none',
          color: 'var(--clr-gray-500)', cursor: 'pointer',
          fontSize: '1rem', transition: 'all .12s', flexShrink: 0,
        }}
        title="Đóng (Esc)"
        aria-label="Đóng panel"
      >
        ✕
      </button>
    </div>
  );
}

function ExamStatusPill({ status }: { status: string }) {
  const m: Record<string, { label: string; bg: string; color: string; dot: string }> = {
    draft:     { label: 'Đang khám', bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6' },
    saved:     { label: 'Đã lưu',    bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
    completed: { label: 'Hoàn tất',  bg: '#dcfce7', color: '#15803d', dot: '#22c55e' },
  };
  const s = m[status] ?? m.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: '.65rem', fontWeight: 700, padding: '1px 6px',
      borderRadius: 9999, background: s.bg, color: s.color,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.dot }} />
      {s.label}
    </span>
  );
}

function ClinicalSection({
  num, title, icon, accent, children,
}: {
  num: string; title: string; icon: string; accent: string; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: '#fff', borderRadius: 12,
      border: '1px solid var(--clr-gray-200)', borderLeft: `3px solid ${accent}`,
      overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,.04)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 16px', background: 'var(--clr-gray-50)',
        borderBottom: '1px solid var(--clr-gray-100)',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 7,
          background: accent + '18', fontSize: '.75rem', flexShrink: 0,
        }}>{icon}</span>
        <span style={{ fontSize: '.7rem', fontWeight: 800, color: accent, letterSpacing: '.08em', textTransform: 'uppercase' as const }}>
          {num}.
        </span>
        <span style={{ fontSize: '.875rem', fontWeight: 700, color: 'var(--clr-gray-800)' }}>{title}</span>
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  );
}

function QuickCostStrip({
  drug, cls, patient, emergency,
}: { drug: number; cls: number; patient: number; emergency?: boolean }) {
  const fmt = (v: number) =>
    v >= 1_000_000 ? (v / 1_000_000).toFixed(1).replace('.0', '') + 'M'
    : v >= 1000    ? Math.round(v / 1000) + 'K'
    : String(v);

  const chipStyle = (color: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: '2px 6px', borderRadius: 4,
    background: emergency ? 'rgba(255,255,255,.12)' : color + '14',
    border: `1px solid ${emergency ? 'rgba(255,255,255,.15)' : color + '25'}`,
  });
  const valStyle = (color: string, bold?: boolean): React.CSSProperties => ({
    fontSize: '.7rem', fontWeight: bold ? 800 : 600,
    color: emergency ? 'rgba(255,255,255,.85)' : color,
    fontVariantNumeric: 'tabular-nums',
  });

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {drug > 0 && (
        <span style={chipStyle('#1d4ed8')}>
          <span style={{ fontSize: '.62rem' }}>💊</span>
          <span style={valStyle('#1d4ed8')}>{fmt(drug)}₫</span>
        </span>
      )}
      {cls > 0 && (
        <span style={chipStyle('#7c3aed')}>
          <span style={{ fontSize: '.62rem' }}>🔬</span>
          <span style={valStyle('#7c3aed')}>{fmt(cls)}₫</span>
        </span>
      )}
      {patient > 0 && (
        <span style={chipStyle('#dc2626')}>
          <span style={{ fontSize: '.6rem' }}>BN</span>
          <span style={valStyle('#dc2626', true)}>{fmt(patient)}₫</span>
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-panels (Appointment, BHXH, Deposit, Cost)
// ─────────────────────────────────────────────────────────────────────────────

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
      revisit_days: days ? Number(days) : undefined,
      revisit_result: reason || undefined,
      doctor_name: doctor || undefined,
    }));
    if (!res) { toast.error(saveAsync.error ?? 'Lưu thất bại'); return; }
    if (date && exam.patient_id) {
      try {
        const { appointmentApi } = await import('@api/appointment.api');
        await appointmentApi.create({
          patient_id: exam.patient_id, examination_id: exam.id,
          scheduled_date: date, appointment_type: 'revisit',
          doctor_name: doctor || undefined, reason: reason || undefined,
        });
      } catch { /* không block */ }
    }
    toast.success('Đã lưu lịch hẹn'); onUpdated();
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
    if (d && Number(d) > 0)
      setDate(new Date(Date.now() + Number(d) * 86400000).toISOString().slice(0, 10));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {date && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'linear-gradient(90deg,#f0fdf4,#dcfce7)',
          border: '1px solid #86efac', borderRadius: 9,
        }}>
          <span style={{ fontSize: '1.1rem' }}>📅</span>
          <div>
            <div style={{ fontWeight: 700, color: '#166534', fontSize: '.88rem' }}>
              {new Date(date).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            {days && <div style={{ fontSize: '.75rem', color: '#16a34a' }}>Sau {days} ngày</div>}
          </div>
        </div>
      )}
      <div className="form-row form-row-4">
        <Field label="Ngày hẹn">
          <input type="date" className="form-input" value={date} disabled={disabled}
            min={new Date().toISOString().slice(0, 10)} onChange={e => handleDateChange(e.target.value)} />
        </Field>
        <Field label="Số ngày">
          <input type="number" className="form-input" value={days} disabled={disabled}
            min={1} placeholder="30" onChange={e => handleDaysChange(e.target.value)} />
        </Field>
        <Field label="Bác sĩ phụ trách">
          <input className="form-input" value={doctor} disabled={disabled}
            placeholder="Bác sĩ khám lần sau..." onChange={e => setDoctor(e.target.value)} />
        </Field>
        <Field label="Dặn dò BN">
          <input className="form-input" value={reason} disabled={disabled}
            placeholder="Tái khám kiểm tra..." onChange={e => setReason(e.target.value)} />
        </Field>
      </div>
      {!disabled && (
        <Button size="sm" variant="secondary" loading={saveAsync.loading} onClick={handleSave}>
          💾 Lưu lịch hẹn
        </Button>
      )}
    </div>
  );
}

function BhxhSubPanel({
  exam, patient, disabled,
}: { exam: ExaminationResponse; patient: PatientResponse | null; disabled: boolean }) {
  const calcTo = (from: string, d: string) => {
    if (!from || !d) return '';
    const dt = new Date(from); dt.setDate(dt.getDate() + Number(d) - 1);
    return dt.toISOString().slice(0, 10);
  };
  const todayStr = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    days: '3', from_date: todayStr, to_date: calcTo(todayStr, '3'),
    diagnosis: '', workplace: '',
  });
  const primaryDiag = exam.diagnoses.find(d => d.is_primary) ?? exam.diagnoses[0];

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const upd = { ...form, [key]: e.target.value };
    if (key === 'days' || key === 'from_date')
      upd.to_date = calcTo(key === 'from_date' ? e.target.value : form.from_date,
        key === 'days' ? e.target.value : form.days);
    setForm(upd);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', background: 'var(--clr-gray-50)',
        border: '1px solid var(--clr-gray-200)', borderRadius: 8, fontSize: '.82rem',
      }}>
        <span>👤</span>
        <strong>{patient?.full_name ?? '—'}</strong>
        {patient?.birth_year && <span style={{ color: 'var(--clr-gray-500)' }}>• {patient.birth_year}</span>}
        {patient?.gender && <span style={{ color: 'var(--clr-gray-500)' }}>• {patient.gender === 'male' ? 'Nam' : 'Nữ'}</span>}
        {exam.insurance_number && (
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--clr-primary)', fontSize: '.75rem' }}>
            BHYT: {exam.insurance_number}
          </span>
        )}
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
            style={{ background: 'var(--clr-gray-100)', fontWeight: 700 }} />
        </Field>
      </div>
      <div className="form-row form-row-2">
        <Field label="Chẩn đoán">
          <input className="form-input" value={form.diagnosis} disabled={disabled}
            placeholder={primaryDiag?.icd_name ?? 'Nhập chẩn đoán...'} onChange={set('diagnosis')} />
        </Field>
        <Field label="Nơi làm việc">
          <input className="form-input" value={form.workplace} disabled={disabled}
            placeholder="Tên công ty / cơ quan..." onChange={set('workplace')} />
        </Field>
      </div>
      {!disabled && (
        <Button size="sm" variant="secondary" onClick={() => { window.print(); toast.success('Đang in...'); }}>
          🖨️ In giấy BHXH
        </Button>
      )}
    </div>
  );
}

function DepositSubPanel() {
  const [amount,  setAmount]  = useState('');
  const [method,  setMethod]  = useState('cash');
  const [note,    setNote]    = useState('');
  const [records, setRecords] = useState<Array<{ id: number; amount: string; method: string; note: string; time: string }>>([]);
  const total = records.reduce((s, r) => s + Number(r.amount), 0);

  const handleAdd = () => {
    if (!amount || Number(amount) <= 0) { toast.error('Nhập số tiền hợp lệ'); return; }
    setRecords(p => [...p, {
      id: Date.now(), amount, method, note,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    }]);
    setAmount(''); setNote('');
    toast.success('Đã thêm khoản tạm ứng');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        background: total > 0 ? 'linear-gradient(90deg,var(--clr-primary-subtle),var(--clr-primary-light))' : 'var(--clr-gray-50)',
        border: `1px solid ${total > 0 ? 'var(--clr-primary)30' : 'var(--clr-gray-200)'}`,
        borderRadius: 9,
      }}>
        <span style={{ fontSize: '.82rem', color: 'var(--clr-gray-600)', fontWeight: 600 }}>Tổng tạm ứng</span>
        <span style={{ fontSize: '1.05rem', fontWeight: 800, color: total > 0 ? 'var(--clr-primary)' : 'var(--clr-gray-400)' }}>
          {total.toLocaleString('vi-VN')} ₫
        </span>
      </div>
      <div className="form-row form-row-4" style={{ alignItems: 'flex-end' }}>
        <Field label="Số tiền (₫)" required>
          <input type="number" min={0} step={1000} className="form-input"
            value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="500,000" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
        </Field>
        <Field label="Hình thức">
          <select className="form-input" value={method} onChange={e => setMethod(e.target.value)}>
            <option value="cash">💵 Tiền mặt</option>
            <option value="transfer">🏦 Chuyển khoản</option>
            <option value="card">💳 Thẻ</option>
            <option value="momo">📱 Ví điện tử</option>
          </select>
        </Field>
        <Field label="Ghi chú">
          <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Ghi chú..." />
        </Field>
        <div><Button size="sm" onClick={handleAdd} style={{ width: '100%' }}>+ Thêm</Button></div>
      </div>
      {records.map((r, i) => (
        <div key={r.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 10px',
          background: i % 2 === 0 ? '#fff' : 'var(--clr-gray-50)',
          borderBottom: '1px solid var(--clr-gray-100)', fontSize: '.8rem',
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ color: 'var(--clr-gray-400)', fontFamily: 'var(--font-mono)', fontSize: '.7rem' }}>{r.time}</span>
            <span style={{ fontWeight: 600, color: 'var(--clr-success)' }}>+{Number(r.amount).toLocaleString('vi-VN')} ₫</span>
            <span style={{ color: 'var(--clr-gray-500)' }}>{r.method}</span>
            {r.note && <span style={{ color: 'var(--clr-gray-400)' }}>• {r.note}</span>}
          </div>
          <button onClick={() => setRecords(p => p.filter(x => x.id !== r.id))}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-gray-400)', fontSize: '.8rem' }}>✕</button>
        </div>
      ))}
    </div>
  );
}

function CostSubPanel({ examId }: { examId: number }) {
  const { data, loading, run } = useAsync<Record<string, number>>();
  const [, setK] = useState(0);
  useEffect(() => { run(examinationApi.cost(examId)); }, [examId]); // eslint-disable-line

  const fmt = (v?: number) => v !== undefined ? v.toLocaleString('vi-VN') + ' ₫' : '—';
  const rows = [
    { label: 'Tiền thuốc',    key: 'drug_total',    icon: '💊', color: 'var(--clr-primary)' },
    { label: 'Tiền CLS',      key: 'cls_total',     icon: '🔬', color: '#7c3aed' },
    { label: 'Tổng chi phí',  key: 'total',         icon: '📋', color: 'var(--clr-gray-900)', bold: true },
    { label: 'BHYT chi trả',  key: 'bhyt_total',    icon: '🏥', color: '#059669' },
    { label: 'Bệnh nhân trả', key: 'patient_total', icon: '👤', color: '#dc2626', bold: true },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--clr-gray-800)' }}>🧾 Tổng hợp chi phí</span>
        <button onClick={() => setK(k => { run(examinationApi.cost(examId)); return k + 1; })}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-primary)', fontSize: '.78rem', fontFamily: 'var(--font-sans)' }}>
          ↻ Cập nhật
        </button>
      </div>
      {loading ? <LoadingOverlay /> : !data ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--clr-gray-400)', fontSize: '.82rem' }}>
          Chưa có dữ liệu chi phí
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
          {rows.map(row => (
            <div key={row.key} style={{
              padding: '12px 8px', textAlign: 'center',
              background: row.bold ? 'var(--clr-gray-50)' : '#fff',
              border: `1px solid ${row.bold ? 'var(--clr-gray-200)' : 'var(--clr-gray-100)'}`,
              borderRadius: 10,
            }}>
              <div style={{ fontSize: '.75rem', marginBottom: 3 }}>{row.icon}</div>
              <div style={{ fontSize: '.65rem', color: 'var(--clr-gray-500)', marginBottom: 4 }}>{row.label}</div>
              <div style={{ fontSize: '.82rem', fontWeight: row.bold ? 800 : 600, color: row.color, fontVariantNumeric: 'tabular-nums' }}>
                {fmt(data[row.key])}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
