/**
 * PrintCostSheet — Mẫu in chi phí (Mẫu 01/BYT)
 *
 * Chỉ render khi window.print() được gọi, sẽ hiện ra và ẩn nội dung còn lại.
 * CSS print được inject trực tiếp vào component này.
 *
 * Cấu trúc mẫu 01/BYT:
 *   1. Header: Logo + Tên cơ sở + tiêu đề "BẢNG KÊ CHI PHÍ KHÁM CHỮA BỆNH"
 *   2. Thông tin bệnh nhân
 *   3. Bảng kê chi tiết: STT / Tên / ĐVT / SL / Đơn giá / Thành tiền / BHYT / BN
 *   4. Tổng hợp: Tổng / BHYT / BN / Đã nộp / Còn lại
 *   5. Chữ ký: Thu ngân + Người bệnh
 */
import type {
  ExaminationResponse, ReceptionResponse, PatientResponse, BillResponse,
} from '@/types';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  exam:      ExaminationResponse;
  reception: ReceptionResponse | null;
  patient:   PatientResponse   | null;
  bill:      BillResponse      | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(v: number | string | null | undefined): string {
  if (v == null) return '0';
  return Number(v).toLocaleString('vi-VN');
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function calcAge(dob?: string | null, birthYear?: number | null): string {
  if (dob) return `${new Date().getFullYear() - new Date(dob).getFullYear()} tuổi`;
  if (birthYear) return `${new Date().getFullYear() - birthYear} tuổi`;
  return '';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PrintCostSheet({ exam, reception, patient, bill }: Props) {
  const p        = patient;
  const age      = calcAge(p?.date_of_birth, p?.birth_year);
  const gender   = p?.gender === 'male' ? 'Nam' : p?.gender === 'female' ? 'Nữ' : '';
  const address  = [
    p?.address_street, p?.address_ward_name,
    p?.address_district_name, p?.address_province_name,
  ].filter(Boolean).join(', ') || p?.address || '';

  const primaryDiag   = exam.diagnoses.find(d => d.is_primary);
  const secondaryDiags = exam.diagnoses.filter(d => !d.is_primary);

  // Items: dùng bill.items nếu có, fallback về prescription_items
  const items = bill?.items ?? exam.prescription_items.map(i => ({
    id:             i.id,
    item_type:      i.item_type,
    item_name:      i.item_name,
    unit:           i.unit ?? '',
    quantity:       i.quantity,
    unit_price:     i.unit_price ?? 0,
    total_amount:   i.total_amount ?? 0,
    bhyt_amount:    i.bhyt_amount ?? 0,
    patient_amount: i.patient_amount ?? 0,
  }));

  const grandTotal = bill?.grand_total ?? items.reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const bhytTotal  = bill?.bhyt_pays   ?? items.reduce((s, i) => s + Number(i.bhyt_amount  ?? 0), 0);
  const bnTotal    = bill?.patient_pays ?? items.reduce((s, i) => s + Number(i.patient_amount ?? 0), 0);
  const discount   = bill?.discount_amount ?? 0;
  const deposit    = bill?.deposit_amount  ?? 0;
  const balance    = bill?.balance_due     ?? Math.max(0, bnTotal - deposit);

  const printDate = new Date().toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="print-sheet" style={{ display: 'none' }}>
      <style>{`
        @media print {
          /* Hide everything except the print sheet */
          body > * { display: none !important; }
          .print-sheet { display: block !important; }

          .print-sheet {
            font-family: 'Times New Roman', Times, serif;
            font-size: 11pt;
            color: #000;
            background: #fff;
            padding: 1.2cm 1.5cm;
            max-width: 21cm;
            margin: 0 auto;
            line-height: 1.5;
          }

          .print-sheet table {
            width: 100%;
            border-collapse: collapse;
          }
          .print-sheet th,
          .print-sheet td {
            border: 0.5pt solid #000;
            padding: 3pt 5pt;
            font-size: 10pt;
            vertical-align: top;
          }
          .print-sheet th {
            background: #f0f0f0;
            font-weight: bold;
            text-align: center;
          }
          .print-sheet .text-right { text-align: right; }
          .print-sheet .text-center { text-align: center; }
          .print-sheet .bold { font-weight: bold; }
          .print-sheet .total-row td { font-weight: bold; background: #f0f0f0; }
          .print-sheet .section-title {
            font-size: 10pt;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: .03em;
            margin: 8pt 0 4pt;
            border-bottom: 0.5pt solid #000;
            padding-bottom: 2pt;
          }

          @page {
            size: A4;
            margin: 1.5cm;
          }
        }
      `}</style>

      {/* ── HEADER ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: '9pt', lineHeight: 1.4 }}>
          <div style={{ fontWeight: 'bold', fontSize: '10pt' }}>PHÒNG KHÁM ĐA KHOA</div>
          <div>Địa chỉ: ____________________________</div>
          <div>Điện thoại: _________________</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '9pt' }}>
          <div>Mẫu số 01-BYT</div>
          <div>In lúc: {printDate}</div>
          {bill?.bill_number && <div style={{ fontFamily: 'monospace' }}>HĐ: {bill.bill_number}</div>}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: '14pt', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Bảng kê chi phí khám chữa bệnh
        </div>
        <div style={{ fontSize: '9pt' }}>
          Mã lượt khám: <strong>#{exam.reception_id}</strong>
          &nbsp;|&nbsp;Ngày khám: <strong>{fmtDate(exam.exam_date)}</strong>
        </div>
      </div>

      {/* ── THÔNG TIN BỆNH NHÂN ─────────────────────────────────────── */}
      <div className="section-title">I. Thông tin bệnh nhân</div>

      <table style={{ marginBottom: 8 }}>
        <tbody>
          <tr>
            <td style={{ width: '25%', fontWeight: 'bold', border: 'none', paddingLeft: 0 }}>Họ và tên:</td>
            <td style={{ border: 'none', fontWeight: 'bold', fontSize: '12pt' }}>
              {p?.full_name ?? `BN #${exam.patient_id}`}
            </td>
            <td style={{ width: '15%', fontWeight: 'bold', border: 'none' }}>Tuổi:</td>
            <td style={{ border: 'none' }}>{age}</td>
            <td style={{ width: '15%', fontWeight: 'bold', border: 'none' }}>Giới:</td>
            <td style={{ border: 'none' }}>{gender}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', border: 'none', paddingLeft: 0 }}>Mã BN:</td>
            <td style={{ border: 'none', fontFamily: 'monospace' }}>{p?.patient_code ?? '—'}</td>
            <td style={{ fontWeight: 'bold', border: 'none' }}>CCCD:</td>
            <td style={{ border: 'none', fontFamily: 'monospace' }}>{p?.cccd ?? '—'}</td>
            <td style={{ fontWeight: 'bold', border: 'none' }}>Phòng:</td>
            <td style={{ border: 'none' }}>{reception?.clinic_room ?? '—'}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', border: 'none', paddingLeft: 0 }}>Địa chỉ:</td>
            <td colSpan={5} style={{ border: 'none' }}>{address || '—'}</td>
          </tr>
          <tr>
            <td style={{ fontWeight: 'bold', border: 'none', paddingLeft: 0 }}>Đối tượng:</td>
            <td style={{ border: 'none' }}>{exam.subject_name ?? reception?.subject_name ?? '—'}</td>
            <td style={{ fontWeight: 'bold', border: 'none' }}>Số thẻ BHYT:</td>
            <td colSpan={3} style={{ border: 'none', fontFamily: 'monospace' }}>
              {exam.insurance_number ?? '—'}
              {exam.insurance_valid_to && ` (HH: ${fmtDate(exam.insurance_valid_to)})`}
            </td>
          </tr>
          {exam.doctor_name && (
            <tr>
              <td style={{ fontWeight: 'bold', border: 'none', paddingLeft: 0 }}>Bác sĩ điều trị:</td>
              <td style={{ border: 'none' }}>{exam.doctor_name}</td>
              <td style={{ fontWeight: 'bold', border: 'none' }}>Điều dưỡng:</td>
              <td colSpan={3} style={{ border: 'none' }}>{exam.nurse_name ?? '—'}</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── CHẨN ĐOÁN ───────────────────────────────────────────────── */}
      <div className="section-title">II. Chẩn đoán</div>
      <div style={{ marginBottom: 8, fontSize: '10pt' }}>
        {primaryDiag ? (
          <div style={{ marginBottom: 3 }}>
            <strong>Chẩn đoán chính:</strong>{' '}
            {primaryDiag.icd_code && <span style={{ fontFamily: 'monospace' }}>[{primaryDiag.icd_code}]</span>}{' '}
            {primaryDiag.icd_name}
          </div>
        ) : (
          <div><strong>Chẩn đoán chính:</strong> —</div>
        )}
        {secondaryDiags.length > 0 && (
          <div>
            <strong>Chẩn đoán kèm theo:</strong>{' '}
            {secondaryDiags.map((d, i) => (
              <span key={d.id}>
                {i > 0 ? '; ' : ''}
                {d.icd_code && <span style={{ fontFamily: 'monospace' }}>[{d.icd_code}]</span>}{' '}
                {d.icd_name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── BẢNG KÊ CHI TIẾT ────────────────────────────────────────── */}
      <div className="section-title">III. Bảng kê chi phí</div>

      <table>
        <thead>
          <tr>
            <th style={{ width: '4%' }}>STT</th>
            <th style={{ width: '8%' }}>Loại</th>
            <th style={{ width: '32%' }}>Tên thuốc / dịch vụ</th>
            <th style={{ width: '6%' }}>ĐVT</th>
            <th style={{ width: '5%' }}>SL</th>
            <th style={{ width: '12%' }}>Đơn giá (đ)</th>
            <th style={{ width: '13%' }}>Thành tiền (đ)</th>
            <th style={{ width: '10%' }}>BHYT (đ)</th>
            <th style={{ width: '10%' }}>BN trả (đ)</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={9} className="text-center" style={{ padding: '8pt', fontStyle: 'italic', color: '#666' }}>
                Chưa có kê đơn / chỉ định
              </td>
            </tr>
          ) : (
            items.map((it, i) => (
              <tr key={it.id}>
                <td className="text-center">{i + 1}</td>
                <td className="text-center">
                  {it.item_type === 'drug' ? 'Thuốc' : 'CLS'}
                </td>
                <td>{it.item_name}</td>
                <td className="text-center">{it.unit || '—'}</td>
                <td className="text-center">{it.quantity}</td>
                <td className="text-right">{fmtMoney(it.unit_price)}</td>
                <td className="text-right bold">{fmtMoney(it.total_amount)}</td>
                <td className="text-right">{fmtMoney(it.bhyt_amount)}</td>
                <td className="text-right">{fmtMoney(it.patient_amount)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr className="total-row">
            <td colSpan={6} className="text-right bold">Tổng cộng:</td>
            <td className="text-right bold">{fmtMoney(grandTotal)}</td>
            <td className="text-right bold">{fmtMoney(bhytTotal)}</td>
            <td className="text-right bold">{fmtMoney(bnTotal)}</td>
          </tr>
        </tfoot>
      </table>

      {/* ── TỔNG HỢP THANH TOÁN ─────────────────────────────────────── */}
      <div className="section-title">IV. Tổng hợp thanh toán</div>

      <table style={{ marginBottom: 16 }}>
        <tbody>
          <tr>
            <td style={{ width: '50%', fontWeight: 'bold' }}>Tổng chi phí:</td>
            <td className="text-right bold">{fmtMoney(grandTotal)} đồng</td>
          </tr>
          <tr>
            <td>Quỹ BHYT chi trả:</td>
            <td className="text-right">{fmtMoney(bhytTotal)} đồng</td>
          </tr>
          <tr>
            <td>Người bệnh cùng chi trả:</td>
            <td className="text-right">{fmtMoney(bnTotal)} đồng</td>
          </tr>
          {discount > 0 && (
            <tr>
              <td>Giảm giá:</td>
              <td className="text-right">- {fmtMoney(discount)} đồng</td>
            </tr>
          )}
          {deposit > 0 && (
            <tr>
              <td>Đã tạm ứng:</td>
              <td className="text-right">- {fmtMoney(deposit)} đồng</td>
            </tr>
          )}
          <tr className="total-row">
            <td style={{ fontWeight: 'bold', fontSize: '11pt' }}>Số tiền còn phải nộp:</td>
            <td className="text-right bold" style={{ fontSize: '12pt' }}>{fmtMoney(balance)} đồng</td>
          </tr>
        </tbody>
      </table>

      {/* ── CHỮ KÝ ───────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, fontSize: '10pt' }}>
        <div style={{ textAlign: 'center', width: '30%' }}>
          <div style={{ fontWeight: 'bold' }}>Người bệnh</div>
          <div style={{ fontSize: '9pt', fontStyle: 'italic', marginBottom: 40 }}>(Ký, ghi rõ họ tên)</div>
          <div style={{ borderTop: '0.5pt solid #000', paddingTop: 4 }}>
            {p?.full_name ?? ''}
          </div>
        </div>
        <div style={{ textAlign: 'center', width: '30%' }}>
          <div style={{ fontWeight: 'bold' }}>Thu ngân</div>
          <div style={{ fontSize: '9pt', fontStyle: 'italic', marginBottom: 40 }}>(Ký, ghi rõ họ tên)</div>
          <div style={{ borderTop: '0.5pt solid #000', paddingTop: 4 }}>&nbsp;</div>
        </div>
        <div style={{ textAlign: 'center', width: '30%' }}>
          <div style={{ fontWeight: 'bold' }}>Bác sĩ điều trị</div>
          <div style={{ fontSize: '9pt', fontStyle: 'italic', marginBottom: 40 }}>(Ký, ghi rõ họ tên)</div>
          <div style={{ borderTop: '0.5pt solid #000', paddingTop: 4 }}>
            {exam.doctor_name ?? ''}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: '8pt', color: '#666', textAlign: 'center', borderTop: '0.5pt solid #ccc', paddingTop: 6 }}>
        Phiếu in tự động từ hệ thống — Ngày in: {printDate} — Mã lượt: #{exam.reception_id}
      </div>
    </div>
  );
}
