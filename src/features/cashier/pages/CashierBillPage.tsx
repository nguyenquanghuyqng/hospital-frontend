/**
 * CashierBillPage — Chi tiết hóa đơn và thu tiền.
 *
 * - Xem đầy đủ hóa đơn: breakdown chi phí, danh sách dịch vụ, lịch sử thanh toán
 * - Phát hành hóa đơn (DRAFT → ISSUED)
 * - Thu tiền (form: phương thức, số tiền, mã GD)
 * - Ghi tạm ứng
 * - Huỷ hóa đơn
 * - Xuất XML BHYT (download file)
 * - In hóa đơn (window.print)
 *
 * Truy cập: cashier, admin
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { billingApi } from '@api/billing.api';
import type { PaymentCreate } from '@api/billing.api';
import { exportApi } from '@api/export.api';
import { useAsync } from '@hooks/useAsync';
import { Button, Field } from '@components/ui';
import { ROUTES } from '@/app/routes';
import type { BillResponse, BillStatus, PaymentMethod } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BillStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Bản nháp',            bg: '#f1f5f9', color: '#475569' },
  issued:    { label: '⏳ Chờ thanh toán',    bg: '#dbeafe', color: '#1d4ed8' },
  partial:   { label: '💳 Thanh toán 1 phần', bg: '#fef3c7', color: '#92400e' },
  paid:      { label: '✅ Đã thanh toán',     bg: '#d1fae5', color: '#065f46' },
  cancelled: { label: '❌ Đã huỷ',           bg: '#fee2e2', color: '#991b1b' },
  refunded:  { label: '↩️ Hoàn tiền',        bg: '#f3e8ff', color: '#6b21a8' },
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:     '💵 Tiền mặt',
  transfer: '🏦 Chuyển khoản',
  card:     '💳 Thẻ ngân hàng',
  momo:     '📱 MoMo',
  vnpay:    '📱 VNPay',
  zalopay:  '📱 ZaloPay',
  bhyt:     '🏥 BHYT trực tiếp',
  defer:    '📋 Công nợ / trả sau',
};

// ── Payment form ──────────────────────────────────────────────────────────────

const paymentSchema = z.object({
  payment_method:  z.string().default('cash'),
  amount:          z.coerce.number().positive('Số tiền phải lớn hơn 0'),
  transaction_ref: z.string().optional(),
  note:            z.string().optional(),
  is_deposit:      z.boolean().default(false),
});
type PaymentForm = z.infer<typeof paymentSchema>;

// ── Component ─────────────────────────────────────────────────────────────────

export default function CashierBillPage() {
  const { billId } = useParams<{ billId: string }>();
  const navigate   = useNavigate();

  const [bill, setBill]               = useState<BillResponse | null>(null);
  const [showPayForm, setShowPayForm] = useState(false);
  const [exportingXml, setExportingXml] = useState(false);
  const loadAsync   = useAsync<BillResponse>();
  const issueAsync  = useAsync<BillResponse>();
  const payAsync    = useAsync<BillResponse>();
  const cancelAsync = useAsync<BillResponse>();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { payment_method: 'cash', is_deposit: false },
  });

  const load = useCallback(async () => {
    if (!billId) return;
    const res = await loadAsync.run(billingApi.getBill(Number(billId)));
    if (res) setBill(res);
  }, [billId]);

  useEffect(() => { load(); }, [load]);

  const handleIssue = async () => {
    if (!bill) return;
    const res = await issueAsync.run(billingApi.issueBill(bill.id));
    if (res) { toast.success('Đã phát hành hóa đơn'); setBill(res); }
    else toast.error(issueAsync.error ?? 'Thất bại');
  };

  const handleCancel = async () => {
    if (!bill || !confirm(`Huỷ hóa đơn ${bill.bill_number}? Thao tác này không thể hoàn tác.`)) return;
    const res = await cancelAsync.run(billingApi.cancelBill(bill.id));
    if (res) { toast.success('Đã huỷ hóa đơn'); setBill(res); }
    else toast.error(cancelAsync.error ?? 'Thất bại');
  };

  const handlePay = async (data: PaymentForm) => {
    if (!bill) return;
    const payload: PaymentCreate = {
      payment_method:  data.payment_method as PaymentMethod,
      amount:          data.amount,
      transaction_ref: data.transaction_ref || undefined,
      note:            data.note || undefined,
      is_deposit:      data.is_deposit,
    };
    const res = await payAsync.run(billingApi.addPayment(bill.id, payload));
    if (res) {
      toast.success(
        res.status === 'paid'
          ? '✅ Thanh toán hoàn tất!'
          : '💳 Đã ghi nhận thanh toán'
      );
      setBill(res);
      setShowPayForm(false);
      reset();
    } else toast.error(payAsync.error ?? 'Thất bại');
  };

  const handleExportXml = async () => {
    if (!bill?.examination_id) {
      toast.error('Hóa đơn này không liên kết với phiếu khám');
      return;
    }
    setExportingXml(true);
    try {
      await exportApi.downloadBhytXmlSingle(bill.examination_id);
      toast.success('Đã tải file XML BHYT');
    } catch (err: unknown) {
      toast.error((err as Error).message ?? 'Xuất XML thất bại');
    } finally {
      setExportingXml(false);
    }
  };

  const handlePrint = () => window.print();

  const fmtMoney = (v: number | string | null | undefined) =>
    v != null ? Number(v).toLocaleString('vi-VN') + ' ₫' : '0 ₫';

  // ── Loading / Error ──────────────────────────────────────────────────────────
  if (loadAsync.loading && !bill) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--clr-gray-400)' }}>
        Đang tải hóa đơn...
      </div>
    );
  }

  if (!bill && !loadAsync.loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: 'var(--clr-gray-400)' }}>
        <div style={{ fontSize: '3rem', marginBottom: 8 }}>❌</div>
        <div style={{ fontWeight: 600 }}>Không tìm thấy hóa đơn</div>
        <Button size="sm" variant="ghost" onClick={() => navigate(ROUTES.CASHIER)} style={{ marginTop: 16 }}>
          ← Quay lại
        </Button>
      </div>
    );
  }

  if (!bill) return null;

  const st = STATUS_LABELS[bill.status] ?? STATUS_LABELS.draft;
  const canIssue   = bill.status === 'draft';
  const canPay     = bill.status === 'issued' || bill.status === 'partial';
  const canCancel  = bill.status === 'draft' || bill.status === 'issued';
  const canExport  = !!bill.examination_id;
  const isPaid     = bill.status === 'paid';

  return (
    <div style={{ padding: '24px', maxWidth: 900, margin: '0 auto' }}>

      {/* ── Back + Print (hidden when printing) ─────────────────────────────── */}
      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <Button variant="ghost" size="sm" onClick={() => navigate(ROUTES.CASHIER)}>
          ← Danh sách HĐ
        </Button>
        <span style={{ color: 'var(--clr-gray-300)' }}>|</span>
        <Button variant="ghost" size="sm" onClick={handlePrint}>🖨️ In hóa đơn</Button>
        {canExport && (
          <Button variant="ghost" size="sm" loading={exportingXml} onClick={handleExportXml}>
            📄 Xuất XML BHYT
          </Button>
        )}
      </div>

      {/* ── Print header (visible only when printing) ─────────────────────── */}
      <div className="print-only" style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: '1.3rem', fontWeight: 800 }}>HÓA ĐƠN VIỆN PHÍ</div>
        <div style={{ fontSize: '1rem' }}>Số: {bill.bill_number}</div>
        {bill.issued_at && (
          <div style={{ fontSize: '.85rem' }}>
            Ngày: {new Date(bill.issued_at).toLocaleDateString('vi-VN')}
          </div>
        )}
      </div>

      {/* ── Bill header ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '20px 24px', background: st.bg, borderRadius: 14,
        border: `1px solid ${st.color}25`, marginBottom: 20,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        flexWrap: 'wrap', gap: 16,
      }}>
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: st.color, letterSpacing: '.02em' }}>
            {bill.bill_number}
          </div>
          <div style={{ marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '.78rem', fontWeight: 700, padding: '3px 12px',
              borderRadius: 999, background: st.color + '20', color: st.color,
            }}>
              {st.label}
            </span>
            <span className="text-sm text-muted">Bệnh nhân #{bill.patient_id}</span>
            {bill.insurance_number && (
              <span className="text-sm text-muted">🎫 BHYT: {bill.insurance_number}</span>
            )}
          </div>
          {bill.issued_at && (
            <div className="text-xs text-muted" style={{ marginTop: 6 }}>
              Phát hành: {new Date(bill.issued_at).toLocaleString('vi-VN')}
              {bill.cashier_name && ` • TN: ${bill.cashier_name}`}
            </div>
          )}
          {bill.paid_at && (
            <div className="text-xs" style={{ marginTop: 2, color: '#059669' }}>
              ✅ Thanh toán xong: {new Date(bill.paid_at).toLocaleString('vi-VN')}
            </div>
          )}
        </div>

        {/* Totals summary */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '.8rem', color: st.color, opacity: 0.7 }}>Tổng cộng</div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: st.color, lineHeight: 1 }}>
            {fmtMoney(bill.grand_total)}
          </div>
          {Number(bill.balance_due) > 0 && (
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#dc2626', marginTop: 4 }}>
              Còn lại: {fmtMoney(bill.balance_due)}
            </div>
          )}
        </div>
      </div>

      {/* ── Cost breakdown ──────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', border: '1px solid var(--clr-gray-100)',
        borderRadius: 12, overflow: 'hidden', marginBottom: 16,
      }}>
        <div style={{
          padding: '10px 18px', background: '#f8fafc',
          fontWeight: 700, fontSize: '.875rem', color: 'var(--clr-gray-700)',
          borderBottom: '1px solid var(--clr-gray-100)',
        }}>
          📊 Chi tiết chi phí
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '4px 0' }}>
          {[
            { label: 'Tiền thuốc',       val: bill.drug_total,      icon: '💊' },
            { label: 'Tiền CLS',         val: bill.cls_total,       icon: '🔬' },
            { label: 'Dịch vụ khác',     val: bill.service_total,   icon: '🏥' },
            { label: 'Tổng cộng',        val: bill.grand_total,     icon: '💰', bold: true },
            { label: 'BHYT chi trả',     val: bill.bhyt_pays,       icon: '🏥', color: '#059669' },
            { label: 'BN cùng chi trả',  val: bill.patient_pays,    icon: '👤', bold: true },
            { label: 'Giảm giá',         val: bill.discount_amount, icon: '🏷️', color: '#059669' },
            { label: 'Tạm ứng',          val: bill.deposit_amount,  icon: '💵', color: '#059669' },
            { label: 'Còn phải nộp',     val: bill.balance_due,     icon: '⚠️', bold: true,
              color: Number(bill.balance_due) > 0 ? '#dc2626' : '#059669',
              colSpan: true,
            },
          ].map((row, i) => (
            <div key={row.label}
              style={{
                padding: '9px 18px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: row.bold ? '#f0f9ff' : 'transparent',
                borderBottom: '1px solid var(--clr-gray-50)',
                gridColumn: row.colSpan ? '1 / -1' : undefined,
              }}>
              <span style={{ fontSize: '.85rem', color: 'var(--clr-gray-600)' }}>
                {row.icon} {row.label}
              </span>
              <span style={{
                fontWeight: row.bold ? 800 : 400,
                fontSize: row.bold ? '1rem' : '.875rem',
                color: row.color ?? 'var(--clr-gray-800)',
              }}>
                {fmtMoney(row.val)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bill items ──────────────────────────────────────────────────────── */}
      {bill.items.length > 0 && (
        <div style={{
          background: '#fff', border: '1px solid var(--clr-gray-100)',
          borderRadius: 12, overflow: 'hidden', marginBottom: 16,
        }}>
          <div style={{ padding: '10px 18px', background: '#f8fafc', fontWeight: 700, fontSize: '.875rem', borderBottom: '1px solid var(--clr-gray-100)' }}>
            📋 Dịch vụ / thuốc ({bill.items.length} dòng)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['#', 'Tên dịch vụ / thuốc', 'ĐV', 'SL', 'Đơn giá', 'Thành tiền', 'BHYT', 'BN'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--clr-gray-500)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bill.items.map((it, i) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid var(--clr-gray-100)' }}>
                    <td style={{ padding: '9px 12px', color: 'var(--clr-gray-400)', width: 32 }}>{i + 1}</td>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontWeight: 500 }}>{it.item_name}</div>
                      {it.item_code && <div className="text-xs text-muted">{it.item_code}</div>}
                      <span style={{
                        fontSize: '.7rem', padding: '1px 6px', borderRadius: 4,
                        background: it.item_type === 'drug' ? '#dbeafe' : '#d1fae5',
                        color:      it.item_type === 'drug' ? '#1d4ed8' : '#065f46',
                      }}>
                        {it.item_type === 'drug' ? '💊 Thuốc' : '🔬 CLS'}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: 'var(--clr-gray-500)' }}>{it.unit ?? '—'}</td>
                    <td style={{ padding: '9px 12px' }}>{it.quantity}</td>
                    <td style={{ padding: '9px 12px' }}>{fmtMoney(it.unit_price)}</td>
                    <td style={{ padding: '9px 12px', fontWeight: 600 }}>{fmtMoney(it.total_amount)}</td>
                    <td style={{ padding: '9px 12px', color: '#059669' }}>{fmtMoney(it.bhyt_amount)}</td>
                    <td style={{ padding: '9px 12px', color: '#dc2626', fontWeight: 600 }}>{fmtMoney(it.patient_amount)}</td>
                  </tr>
                ))}
                <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                  <td colSpan={5} style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--clr-gray-600)', fontSize: '.8rem' }}>
                    TỔNG CỘNG
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 800 }}>{fmtMoney(bill.grand_total)}</td>
                  <td style={{ padding: '10px 12px', color: '#059669', fontWeight: 800 }}>{fmtMoney(bill.bhyt_pays)}</td>
                  <td style={{ padding: '10px 12px', color: '#dc2626', fontWeight: 800 }}>{fmtMoney(bill.patient_pays)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Payment history ─────────────────────────────────────────────────── */}
      {bill.payments.length > 0 && (
        <div style={{
          background: '#fff', border: '1px solid var(--clr-gray-100)',
          borderRadius: 12, overflow: 'hidden', marginBottom: 16,
        }}>
          <div style={{ padding: '10px 18px', background: '#f8fafc', fontWeight: 700, fontSize: '.875rem', borderBottom: '1px solid var(--clr-gray-100)' }}>
            💳 Lịch sử thanh toán ({bill.payments.length})
          </div>
          {bill.payments.map(p => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 18px', borderBottom: '1px solid var(--clr-gray-100)',
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '.875rem', display: 'flex', gap: 8, alignItems: 'center' }}>
                  {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                  {p.is_deposit && (
                    <span style={{ fontSize: '.7rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 7px', borderRadius: 999 }}>
                      Tạm ứng
                    </span>
                  )}
                  {p.is_refund && (
                    <span style={{ fontSize: '.7rem', background: '#fee2e2', color: '#dc2626', padding: '1px 7px', borderRadius: 999 }}>
                      Hoàn tiền
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted" style={{ marginTop: 2 }}>
                  {new Date(p.paid_at).toLocaleString('vi-VN')}
                  {p.transaction_ref && ` • Mã GD: ${p.transaction_ref}`}
                  {p.note && ` • ${p.note}`}
                </div>
              </div>
              <div style={{
                fontWeight: 800, fontSize: '1rem',
                color: p.is_refund ? '#dc2626' : '#059669',
              }}>
                {p.is_refund ? '−' : '+'}{fmtMoney(p.amount)}
              </div>
            </div>
          ))}

          {/* Tổng đã thu */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '10px 18px',
            background: '#f0fdf4', borderTop: '2px solid #bbf7d0',
          }}>
            <span style={{ fontWeight: 700, color: '#065f46' }}>Tổng đã thu</span>
            <span style={{ fontWeight: 800, fontSize: '1rem', color: '#065f46' }}>
              {fmtMoney(
                bill.payments
                  .filter(p => !p.is_refund)
                  .reduce((s, p) => s + Number(p.amount), 0)
              )}
            </span>
          </div>
        </div>
      )}

      {/* ── Actions (hidden when printing) ──────────────────────────────────── */}
      <div className="no-print" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
        {canIssue && (
          <Button loading={issueAsync.loading} onClick={handleIssue}>
            📤 Phát hành hóa đơn
          </Button>
        )}
        {canPay && !showPayForm && (
          <Button onClick={() => setShowPayForm(true)}>
            💰 Thu tiền
          </Button>
        )}
        {canPay && showPayForm && (
          <Button variant="ghost" onClick={() => { setShowPayForm(false); reset(); }}>
            ✕ Đóng form thu tiền
          </Button>
        )}
        {canCancel && (
          <Button variant="danger" loading={cancelAsync.loading} onClick={handleCancel}>
            Huỷ hóa đơn
          </Button>
        )}
        {canExport && (
          <Button variant="secondary" loading={exportingXml} onClick={handleExportXml}>
            📄 Xuất XML BHYT
          </Button>
        )}
        <Button variant="ghost" onClick={handlePrint}>
          🖨️ In hóa đơn
        </Button>
      </div>

      {/* ── Payment form ────────────────────────────────────────────────────── */}
      {showPayForm && canPay && (
        <form onSubmit={handleSubmit(handlePay)}
          style={{
            marginTop: 16, padding: '20px 24px',
            background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
            border: '1px solid #86efac', borderRadius: 14,
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: '#065f46' }}>
            💰 Thu tiền
            <span style={{ marginLeft: 12, fontSize: '.9rem', color: '#dc2626' }}>
              Còn lại: {fmtMoney(bill.balance_due)}
            </span>
          </div>

          <div className="form-row form-row-2">
            <Field label="Phương thức thanh toán" required>
              <select {...register('payment_method')} className="form-input">
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Số tiền (VNĐ)" required error={errors.amount?.message}>
              <input
                {...register('amount')}
                type="number"
                min={1}
                step={1000}
                className={`form-input${errors.amount ? ' error' : ''}`}
                placeholder={String(Number(bill.balance_due))}
                autoFocus
              />
            </Field>
          </div>

          <div className="form-row form-row-2">
            <Field label="Mã giao dịch">
              <input {...register('transaction_ref')} className="form-input"
                placeholder="Mã chuyển khoản / biên lai..." />
            </Field>
            <Field label="Ghi chú">
              <input {...register('note')} className="form-input" placeholder="Ghi chú..." />
            </Field>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '.875rem' }}>
            <input type="checkbox" {...register('is_deposit')} />
            Đây là <strong>tạm ứng</strong> — chưa phải thanh toán cuối
          </label>

          <div className="flex gap-3">
            <Button type="submit" loading={payAsync.loading}>
              ✅ Xác nhận thu tiền
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setShowPayForm(false); reset(); }}>
              Huỷ
            </Button>
          </div>
        </form>
      )}

      {/* ── Print styles ────────────────────────────────────────────────────── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; }
          .sidebar, .topbar { display: none !important; }
          .main-content { margin: 0 !important; padding: 0 !important; }
        }
        @media screen {
          .print-only { display: none !important; }
        }
      `}</style>
    </div>
  );
}
