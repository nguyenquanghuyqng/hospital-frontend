/**
 * BillingPanel — Viện phí và thanh toán.
 *
 * Hiển thị trong tab "Viện phí" của ExaminationPage.
 * Cho phép thu ngân (role=cashier/admin) tạo hóa đơn, phát hành, thu tiền.
 * Bác sĩ/điều dưỡng chỉ xem.
 */
import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { billingApi } from '@api/billing.api';
import type { PaymentCreate } from '@api/billing.api';
import { useAsync } from '@hooks/useAsync';
import { Button, Field } from '@components/ui';
import type { BillResponse, BillStatus, PaymentMethod } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────

const BILL_STATUS_LABELS: Record<BillStatus, { label: string; bg: string; color: string }> = {
  draft:     { label: 'Bản nháp',     bg: '#f1f5f9', color: '#475569' },
  issued:    { label: 'Chờ thanh toán', bg: '#dbeafe', color: '#1d4ed8' },
  partial:   { label: 'Thanh toán một phần', bg: '#fef3c7', color: '#92400e' },
  paid:      { label: '✅ Đã thanh toán', bg: '#d1fae5', color: '#065f46' },
  cancelled: { label: 'Đã huỷ',       bg: '#fee2e2', color: '#991b1b' },
  refunded:  { label: 'Hoàn tiền',    bg: '#f3e8ff', color: '#6b21a8' },
};

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:     '💵 Tiền mặt',
  transfer: '🏦 Chuyển khoản',
  card:     '💳 Thẻ ngân hàng',
  momo:     '📱 MoMo',
  vnpay:    '📱 VNPay',
  zalopay:  '📱 ZaloPay',
  bhyt:     '🏥 BHYT trực tiếp',
  defer:    '📋 Công nợ',
};

// ── Payment form schema ────────────────────────────────────────────────────────

const paymentSchema = z.object({
  payment_method:  z.string().default('cash'),
  amount:          z.coerce.number().positive('Số tiền phải lớn hơn 0'),
  transaction_ref: z.string().optional(),
  note:            z.string().optional(),
  is_deposit:      z.boolean().default(false),
});
type PaymentForm = z.infer<typeof paymentSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  examId:     number;
  patientName?: string | null;
  /** Chỉ cashier/admin được phép thao tác */
  canEdit:    boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BillingPanel({ examId, patientName, canEdit }: Props) {
  const [bill, setBill] = useState<BillResponse | null>(null);
  const [showPayForm, setShowPayForm] = useState(false);
  const [discount, setDiscount] = useState('');
  const loadAsync   = useAsync<BillResponse>();
  const createAsync = useAsync<BillResponse>();
  const issueAsync  = useAsync<BillResponse>();
  const payAsync    = useAsync<BillResponse>();
  const cancelAsync = useAsync<BillResponse>();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { payment_method: 'cash', is_deposit: false },
  });

  const load = useCallback(async () => {
    try {
      const res = await loadAsync.run(billingApi.getBillByExam(examId));
      if (res) setBill(res);
    } catch {
      // Chưa có bill — bình thường
      setBill(null);
    }
  }, [examId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    const res = await createAsync.run(
      billingApi.createBill({
        examination_id:  examId,
        discount_amount: discount ? Number(discount) : 0,
      })
    );
    if (res) { toast.success('Đã tạo hóa đơn'); setBill(res); setDiscount(''); }
    else toast.error(createAsync.error ?? 'Tạo thất bại');
  };

  const handleIssue = async () => {
    if (!bill) return;
    const res = await issueAsync.run(billingApi.issueBill(bill.id));
    if (res) { toast.success('Đã phát hành hóa đơn'); setBill(res); }
    else toast.error(issueAsync.error ?? 'Thất bại');
  };

  const handleCancel = async () => {
    if (!bill || !confirm('Huỷ hóa đơn này?')) return;
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
      toast.success('Đã ghi nhận thanh toán');
      setBill(res); setShowPayForm(false); reset();
    } else toast.error(payAsync.error ?? 'Thất bại');
  };

  const fmtMoney = (v: number | string | null | undefined) =>
    v != null ? Number(v).toLocaleString('vi-VN') + ' ₫' : '0 ₫';

  const isAmountField = watch('amount');

  // ── No bill yet ──────────────────────────────────────────────────────────────
  if (!bill) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          padding: '24px', background: 'var(--clr-gray-50)', borderRadius: 12,
          textAlign: 'center', color: 'var(--clr-gray-500)',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🧾</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Chưa có hóa đơn</div>
          <div className="text-sm" style={{ marginBottom: 16 }}>
            Hóa đơn sẽ được tạo sau khi phiếu khám hoàn tất.
          </div>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <label className="text-xs text-muted" style={{ display: 'block', marginBottom: 4 }}>Giảm giá (VNĐ)</label>
                <input
                  type="number" min={0} className="form-input" style={{ width: 140 }}
                  value={discount} placeholder="0"
                  onChange={e => setDiscount(e.target.value)}
                />
              </div>
              <Button
                size="sm" loading={createAsync.loading}
                onClick={handleCreate}
              >
                🧾 Tạo hóa đơn
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const stStyle = BILL_STATUS_LABELS[bill.status] ?? BILL_STATUS_LABELS.draft;

  // ── Bill exists ──────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '14px 20px', background: stStyle.bg, borderRadius: 12,
        border: `1px solid ${stStyle.color}30`,
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.05rem', color: stStyle.color }}>
            {bill.bill_number}
          </div>
          <div className="text-sm" style={{ color: stStyle.color, opacity: 0.8 }}>
            {stStyle.label}
            {bill.issued_at && ` • Phát hành: ${new Date(bill.issued_at).toLocaleString('vi-VN')}`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: stStyle.color }}>
            {fmtMoney(bill.grand_total)}
          </div>
          {bill.balance_due > 0 && (
            <div className="text-sm" style={{ color: '#dc2626', fontWeight: 600 }}>
              Còn lại: {fmtMoney(bill.balance_due)}
            </div>
          )}
        </div>
      </div>

      {/* Cost breakdown */}
      <div style={{ background: '#fff', border: '1px solid var(--clr-gray-100)', borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', background: 'var(--clr-gray-50)', fontWeight: 700, fontSize: '.85rem', color: 'var(--clr-gray-700)' }}>
          📊 Chi tiết chi phí
        </div>
        {[
          { label: 'Tiền thuốc',        value: bill.drug_total,      icon: '💊' },
          { label: 'Tiền CLS',          value: bill.cls_total,       icon: '🔬' },
          { label: 'Dịch vụ khác',      value: bill.service_total,   icon: '🏥' },
          { label: 'Tổng cộng',         value: bill.grand_total,     icon: '💰', bold: true },
          { label: 'BHYT chi trả',      value: bill.bhyt_pays,       icon: '🏥', color: '#059669' },
          { label: 'Bệnh nhân CC trả',  value: bill.patient_pays,    icon: '👤', bold: true },
          { label: 'Giảm giá',          value: bill.discount_amount, icon: '🏷️', color: '#059669' },
          { label: 'Tạm ứng',           value: bill.deposit_amount,  icon: '💵', color: '#059669' },
          { label: 'Còn phải nộp',      value: bill.balance_due,     icon: '⚠️', bold: true, color: bill.balance_due > 0 ? '#dc2626' : '#059669' },
        ].map(row => (
          <div key={row.label} style={{
            display: 'flex', justifyContent: 'space-between', padding: '8px 16px',
            borderBottom: '1px solid var(--clr-gray-100)',
            background: row.bold ? '#f8fafc' : 'transparent',
          }}>
            <span style={{ fontSize: '.85rem', color: 'var(--clr-gray-600)' }}>
              {row.icon} {row.label}
            </span>
            <span style={{
              fontWeight: row.bold ? 700 : 400,
              fontSize: row.bold ? '.9rem' : '.85rem',
              color: row.color ?? 'var(--clr-gray-800)',
            }}>
              {fmtMoney(row.value)}
            </span>
          </div>
        ))}
      </div>

      {/* Bill items */}
      {bill.items.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--clr-gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: 'var(--clr-gray-50)', fontWeight: 700, fontSize: '.85rem' }}>
            📋 Danh sách dịch vụ ({bill.items.length})
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['#', 'Tên', 'ĐV', 'SL', 'Đơn giá', 'Thành tiền', 'BHYT', 'BN'].map(h => (
                    <th key={h} style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--clr-gray-500)', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bill.items.map((it, i) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid var(--clr-gray-100)' }}>
                    <td style={{ padding: '7px 10px', color: 'var(--clr-gray-400)' }}>{i + 1}</td>
                    <td style={{ padding: '7px 10px' }}>
                      {it.item_name}
                      <span style={{ marginLeft: 4, fontSize: '.72rem', color: 'var(--clr-gray-400)' }}>
                        [{it.item_type === 'drug' ? '💊' : '🔬'}]
                      </span>
                    </td>
                    <td style={{ padding: '7px 10px', color: 'var(--clr-gray-500)' }}>{it.unit ?? '—'}</td>
                    <td style={{ padding: '7px 10px' }}>{it.quantity}</td>
                    <td style={{ padding: '7px 10px' }}>{fmtMoney(it.unit_price)}</td>
                    <td style={{ padding: '7px 10px', fontWeight: 600 }}>{fmtMoney(it.total_amount)}</td>
                    <td style={{ padding: '7px 10px', color: '#059669' }}>{fmtMoney(it.bhyt_amount)}</td>
                    <td style={{ padding: '7px 10px', color: '#dc2626' }}>{fmtMoney(it.patient_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment history */}
      {bill.payments.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid var(--clr-gray-100)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', background: 'var(--clr-gray-50)', fontWeight: 700, fontSize: '.85rem' }}>
            💳 Lịch sử thanh toán ({bill.payments.length})
          </div>
          {bill.payments.map(p => (
            <div key={p.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px 16px', borderBottom: '1px solid var(--clr-gray-100)',
            }}>
              <div>
                <div className="text-sm font-medium">
                  {PAYMENT_METHOD_LABELS[p.payment_method] ?? p.payment_method}
                  {p.is_deposit && <span style={{ marginLeft: 6, fontSize: '.72rem', background: '#dbeafe', color: '#1d4ed8', padding: '1px 7px', borderRadius: 999 }}>Tạm ứng</span>}
                  {p.is_refund  && <span style={{ marginLeft: 6, fontSize: '.72rem', background: '#fee2e2', color: '#dc2626', padding: '1px 7px', borderRadius: 999 }}>Hoàn tiền</span>}
                </div>
                <div className="text-xs text-muted">
                  {new Date(p.paid_at).toLocaleString('vi-VN')}
                  {p.transaction_ref && ` • ${p.transaction_ref}`}
                  {p.note && ` • ${p.note}`}
                </div>
              </div>
              <div style={{ fontWeight: 700, color: p.is_refund ? '#dc2626' : '#059669' }}>
                {p.is_refund ? '-' : '+'}{fmtMoney(p.amount)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {bill.status === 'draft' && (
            <Button size="sm" loading={issueAsync.loading} onClick={handleIssue}>
              📤 Phát hành hóa đơn
            </Button>
          )}
          {(bill.status === 'issued' || bill.status === 'partial') && (
            <Button size="sm" onClick={() => setShowPayForm(!showPayForm)}>
              💰 {showPayForm ? 'Đóng form' : 'Thu tiền'}
            </Button>
          )}
          {(bill.status === 'draft' || bill.status === 'issued') && (
            <Button size="sm" variant="danger" loading={cancelAsync.loading} onClick={handleCancel}>
              Huỷ hóa đơn
            </Button>
          )}
        </div>
      )}

      {/* Payment form */}
      {showPayForm && canEdit && (
        <form onSubmit={handleSubmit(handlePay)}
          style={{ padding: 16, background: 'var(--clr-gray-50)', borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontWeight: 700, fontSize: '.9rem' }}>
            💰 Thu tiền — còn lại: <span style={{ color: '#dc2626' }}>{fmtMoney(bill.balance_due)}</span>
          </div>

          <div className="form-row form-row-2">
            <Field label="Phương thức thanh toán">
              <select {...register('payment_method')} className="form-input">
                {Object.entries(PAYMENT_METHOD_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Số tiền (VNĐ)" required error={errors.amount?.message}>
              <input {...register('amount')} type="number" min={1} step={1000}
                className={`form-input${errors.amount ? ' error' : ''}`}
                placeholder={String(bill.balance_due)}
                defaultValue={bill.balance_due > 0 ? bill.balance_due : undefined}
              />
            </Field>
          </div>

          <div className="form-row form-row-2">
            <Field label="Mã giao dịch">
              <input {...register('transaction_ref')} className="form-input" placeholder="Mã GD ngân hàng..." />
            </Field>
            <Field label="Ghi chú">
              <input {...register('note')} className="form-input" placeholder="Ghi chú..." />
            </Field>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.85rem', cursor: 'pointer' }}>
            <input type="checkbox" {...register('is_deposit')} />
            Đây là khoản tạm ứng (chưa phải thanh toán cuối)
          </label>

          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={payAsync.loading}>✅ Xác nhận thu tiền</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setShowPayForm(false); reset(); }}>Huỷ</Button>
          </div>
        </form>
      )}
    </div>
  );
}
