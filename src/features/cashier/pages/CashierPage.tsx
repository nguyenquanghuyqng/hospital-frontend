/**
 * CashierPage — Trang chủ thu ngân.
 *
 * Hiển thị danh sách hóa đơn viện phí với:
 * - Filter theo trạng thái (draft / issued / partial / paid / cancelled)
 * - Tìm kiếm theo số HĐ
 * - Stats bar: chờ TT / đã TT / tổng tiền hôm nay
 * - Click vào hàng → CashierBillPage để xử lý
 *
 * Truy cập: cashier, admin
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { billingApi } from '@api/billing.api';
import { useAsync } from '@hooks/useAsync';
import { Button } from '@components/ui';
import { ROUTES, toPath } from '@/app/routes';
import type { BillResponse, BillStatus } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BillStatus, { label: string; bg: string; color: string; dot: string }> = {
  draft:     { label: 'Bản nháp',            bg: '#f1f5f9', color: '#475569', dot: '#94a3b8' },
  issued:    { label: 'Chờ thanh toán',       bg: '#dbeafe', color: '#1d4ed8', dot: '#3b82f6' },
  partial:   { label: 'Thanh toán một phần',  bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
  paid:      { label: 'Đã thanh toán',        bg: '#d1fae5', color: '#065f46', dot: '#10b981' },
  cancelled: { label: 'Đã huỷ',              bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' },
  refunded:  { label: 'Hoàn tiền',           bg: '#f3e8ff', color: '#6b21a8', dot: '#a855f7' },
};

const STATUS_TABS: Array<{ key: BillStatus | ''; label: string }> = [
  { key: '',          label: 'Tất cả'   },
  { key: 'issued',    label: 'Chờ TT'   },
  { key: 'partial',   label: 'Một phần' },
  { key: 'paid',      label: 'Đã TT'    },
  { key: 'draft',     label: 'Nháp'     },
  { key: 'cancelled', label: 'Huỷ'      },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function CashierPage() {
  const navigate = useNavigate();
  const [activeStatus, setActiveStatus] = useState<BillStatus | ''>('issued');
  const [search, setSearch]             = useState('');
  const [bills,  setBills]              = useState<BillResponse[]>([]);
  const loadAsync = useAsync<BillResponse[]>();

  const load = useCallback(async () => {
    const params: Record<string, unknown> = { limit: 100 };
    if (activeStatus) params.status = activeStatus;
    const res = await loadAsync.run(
      billingApi.listBills(activeStatus ? { status: activeStatus as BillStatus } : {})
    );
    if (res) setBills(res);
  }, [activeStatus]);

  useEffect(() => { load(); }, [load]);

  // Lọc theo search (client-side trên bill_number)
  const filtered = bills.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      b.bill_number.toLowerCase().includes(q) ||
      String(b.patient_id).includes(q)
    );
  });

  // Stats
  const stats = {
    waiting:   bills.filter(b => b.status === 'issued').length,
    partial:   bills.filter(b => b.status === 'partial').length,
    paid_today: bills.filter(b => b.status === 'paid' && b.paid_at?.startsWith(new Date().toISOString().slice(0, 10))).length,
    total_due: bills
      .filter(b => b.status === 'issued' || b.status === 'partial')
      .reduce((s, b) => s + Number(b.balance_due), 0),
  };

  const fmtMoney = (v: number) => v.toLocaleString('vi-VN') + ' ₫';

  return (
    <div style={{ padding: '24px', maxWidth: 1100, margin: '0 auto' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 4px' }}>💰 Thu ngân</h1>
        <p className="text-sm text-muted">Quản lý hóa đơn viện phí và thu tiền bệnh nhân</p>
      </div>

      {/* ── Stats bar ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          {
            label: 'Chờ thanh toán',
            value: stats.waiting,
            sub: 'hóa đơn',
            bg: '#dbeafe', color: '#1d4ed8', icon: '⏳',
          },
          {
            label: 'Thanh toán 1 phần',
            value: stats.partial,
            sub: 'hóa đơn',
            bg: '#fef3c7', color: '#92400e', icon: '💳',
          },
          {
            label: 'Đã thu hôm nay',
            value: stats.paid_today,
            sub: 'hóa đơn',
            bg: '#d1fae5', color: '#065f46', icon: '✅',
          },
          {
            label: 'Tổng tiền chờ thu',
            value: fmtMoney(stats.total_due),
            sub: '',
            bg: '#fff7ed', color: '#c2410c', icon: '💵',
            big: true,
          },
        ].map(s => (
          <div key={s.label} style={{
            flex: '1 1 180px', padding: '16px 20px',
            background: s.bg, borderRadius: 12,
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <span style={{ fontSize: '1.8rem' }}>{s.icon}</span>
            <div>
              <div style={{
                fontSize: s.big ? '1.1rem' : '1.6rem',
                fontWeight: 800, color: s.color, lineHeight: 1.1,
              }}>
                {s.value}
              </div>
              <div style={{ fontSize: '.75rem', color: s.color, opacity: 0.75 }}>
                {s.label} {s.sub}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Status tabs */}
        <div style={{ display: 'flex', background: 'var(--clr-gray-100)', borderRadius: 10, padding: 3, gap: 2 }}>
          {STATUS_TABS.map(t => (
            <button key={t.key} onClick={() => setActiveStatus(t.key as BillStatus | '')}
              style={{
                padding: '6px 14px', border: 'none', borderRadius: 8, cursor: 'pointer',
                fontFamily: 'var(--font-sans)', fontSize: '.8rem', fontWeight: 600,
                background: activeStatus === t.key ? '#fff' : 'transparent',
                color: activeStatus === t.key ? 'var(--clr-primary)' : 'var(--clr-gray-500)',
                boxShadow: activeStatus === t.key ? 'var(--shadow-sm)' : 'none',
                transition: 'all .12s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          className="form-input"
          style={{ width: 220 }}
          placeholder="Số HĐ / mã BN..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <Button size="sm" variant="ghost" loading={loadAsync.loading} onClick={load}>
          🔄 Làm mới
        </Button>
      </div>

      {/* ── Bill list ───────────────────────────────────────────────────────── */}
      {loadAsync.loading && bills.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--clr-gray-400)' }}>
          Đang tải...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--clr-gray-400)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 8 }}>🧾</div>
          <div style={{ fontWeight: 600 }}>Không có hóa đơn nào</div>
          <div className="text-sm">
            {activeStatus ? `Trạng thái: ${STATUS_LABELS[activeStatus as BillStatus]?.label}` : ''}
          </div>
        </div>
      ) : (
        <div style={{ background: '#fff', border: '1px solid var(--clr-gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '160px 80px 1fr 110px 110px 110px 100px',
            padding: '10px 16px',
            background: '#f8fafc',
            fontSize: '.78rem', fontWeight: 700, color: 'var(--clr-gray-500)',
            borderBottom: '1px solid var(--clr-gray-100)',
            gap: 8,
          }}>
            <span>Số HĐ</span>
            <span>Mã BN</span>
            <span>Tổng tiền</span>
            <span>BHYT</span>
            <span>BN chi trả</span>
            <span>Còn lại</span>
            <span>Trạng thái</span>
          </div>

          {/* Rows */}
          {filtered.map(bill => {
            const st = STATUS_LABELS[bill.status] ?? STATUS_LABELS.draft;
            const isUrgent = bill.status === 'issued' || bill.status === 'partial';

            return (
              <div
                key={bill.id}
                onClick={() => navigate(toPath(ROUTES.CASHIER_BILL, { billId: bill.id }))}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 80px 1fr 110px 110px 110px 100px',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--clr-gray-100)',
                  cursor: 'pointer',
                  gap: 8,
                  alignItems: 'center',
                  background: isUrgent ? '#fefce8' : '#fff',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                onMouseLeave={e => (e.currentTarget.style.background = isUrgent ? '#fefce8' : '#fff')}
              >
                <span style={{ fontWeight: 700, fontSize: '.875rem', color: 'var(--clr-primary)' }}>
                  {bill.bill_number}
                </span>
                <span className="text-sm text-muted">#{bill.patient_id}</span>
                <span style={{ fontWeight: 600, fontSize: '.9rem' }}>
                  {Number(bill.grand_total).toLocaleString('vi-VN')} ₫
                </span>
                <span className="text-sm" style={{ color: '#059669' }}>
                  {Number(bill.bhyt_pays).toLocaleString('vi-VN')} ₫
                </span>
                <span className="text-sm">
                  {Number(bill.patient_pays).toLocaleString('vi-VN')} ₫
                </span>
                <span style={{
                  fontWeight: 700, fontSize: '.875rem',
                  color: Number(bill.balance_due) > 0 ? '#dc2626' : '#059669',
                }}>
                  {Number(bill.balance_due).toLocaleString('vi-VN')} ₫
                </span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: '.75rem', fontWeight: 700,
                  padding: '3px 10px', borderRadius: 999,
                  background: st.bg, color: st.color,
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
