/**
 * ReceptionPage — Quầy tiếp đón bệnh nhân.
 *
 * Layout 2 tab:
 * ┌──────────────────────────────────────────────────────────────┐
 * │  [📝 Đăng ký]  [📋 Danh sách]                              │
 * ├──────────────────────────────────────────────────────────────┤
 * │  Tab Đăng ký (default):                                      │
 * │  - Stats hôm nay (ngang)                                     │
 * │  - Form đăng ký full width                                   │
 * ├──────────────────────────────────────────────────────────────┤
 * │  Tab Danh sách:                                              │
 * │  - Filter + Table + Pagination                               │
 * └──────────────────────────────────────────────────────────────┘
 */
import { useEffect, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { receptionApi } from '@api/reception.api';
import { patientApi } from '@api/patient.api';
import { useReceptionStore } from '@store/reception.store';
import { useAsync } from '@hooks/useAsync';
import { usePagination } from '@hooks/usePagination';
import { useWebSocket } from '@hooks/useWebSocket';
import {
  Button, StatusBadge, EmptyState, ErrorState,
  LoadingOverlay, Pagination, ConfirmDialog, Modal, Field,
} from '@components/ui';
import { fmtDate, today } from '@lib/utils';
import { ROUTES, toPath } from '@/app/routes';
import type { PatientResponse, ReceptionList, ClinicRoomStatResponse } from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────
const CLINIC_ROOMS = ['Phòng 1', 'Phòng 2', 'Phòng 3', 'Phòng 4', 'Phòng Tim Mạch', 'Phòng Nhi', 'Phòng Da Liễu'];
const SUBJECT_TYPES = [
  { value: '1', label: 'BHYT' },
  { value: '2', label: 'Viện phí' },
  { value: '3', label: 'Miễn phí' },
  { value: '4', label: 'Theo yêu cầu' },
];
const PATIENT_CATEGORIES = ['Người lớn', 'Trẻ em', 'Sơ sinh'];
const POLICY_TYPES = ['Không', 'Hộ nghèo', 'Cận nghèo', 'Bảo trợ xã hội', 'Người có công'];
const NATIONALITIES = [
  { code: 'VN', name: 'VIET NAM' },
  { code: 'CN', name: 'CHINA' },
  { code: 'US', name: 'UNITED STATES' },
  { code: 'FR', name: 'FRANCE' },
  { code: 'KH', name: 'CAMBODIA' },
  { code: 'LA', name: 'LAOS' },
];
const ETHNICITIES = [
  { code: '01', name: 'Kinh' }, { code: '02', name: 'Tày' }, { code: '03', name: 'Thái' },
  { code: '04', name: 'Mường' }, { code: '05', name: 'Khmer' }, { code: '06', name: 'Mông' },
  { code: '07', name: 'Nùng' }, { code: '08', name: 'Dao' }, { code: '09', name: 'Hoa' },
];

type TabId = 'register' | 'list';

// ─────────────────────────────────────────────────────────────────────────────
export default function ReceptionPage() {
  const navigate    = useNavigate();
  const store       = useReceptionStore();
  const listAsync   = useAsync<{ items: ReceptionList[]; total: number; total_pages: number }>();
  const statsAsync  = useAsync<Record<string, number>>();
  const clinicStatsAsync = useAsync<ClinicRoomStatResponse>();
  const { page, pageSize, goTo } = usePagination({ initialPageSize: 25 });

  const [activeTab,     setActiveTab]     = useState<TabId>('register');
  const [cancelTarget,  setCancelTarget]  = useState<ReceptionList | null>(null);
  const [checkInTarget, setCheckInTarget] = useState<ReceptionList | null>(null);
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterDate,    setFilterDate]    = useState(today());
  const cancelAsync  = useAsync<unknown>();
  const checkInAsync = useAsync<unknown>();

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(() => {
    listAsync.run(
      receptionApi.list({
        visit_date: filterDate,
        status:     filterStatus || undefined,
        page, page_size: pageSize,
      }) as Promise<{ items: ReceptionList[]; total: number; total_pages: number }>,
    ).then(res => { if (res) store.setList(res.items, res.total); });

    statsAsync.run(receptionApi.stats() as Promise<Record<string, number>>);
    clinicStatsAsync.run(receptionApi.clinicRoomStats(filterDate) as Promise<ClinicRoomStatResponse>);
  }, [filterDate, filterStatus, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // ── WebSocket realtime ────────────────────────────────────────────────────
  useWebSocket({
    room: 'reception',
    onMessage: (type) => {
      if (['reception_update', 'reception_created', 'reception_updated', 'doctor_queue_update'].includes(type)) {
        load();
      }
    },
  });

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleQuickCheckIn = async (r: ReceptionList) => {
    const res = await checkInAsync.run(receptionApi.checkIn(r.id, {}));
    if (res !== null) { toast.success(`✅ Check-in: ${r.patient?.full_name}`); load(); }
    else toast.error(checkInAsync.error ?? 'Thất bại');
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    const res = await cancelAsync.run(receptionApi.cancel(cancelTarget.id));
    if (res !== null) { toast.success('Đã huỷ'); load(); }
    else toast.error(cancelAsync.error ?? 'Thất bại');
    setCancelTarget(null);
  };

  const s = statsAsync.data;

  // ── Tab bar ───────────────────────────────────────────────────────────────
  const tabs: { id: TabId; icon: string; label: string }[] = [
    { id: 'register', icon: '📝', label: 'Đăng ký' },
    { id: 'list',     icon: '📋', label: `Danh sách${store.total > 0 ? ` (${store.total})` : ''}` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - var(--header-h))' }}>

      {/* ── Tab bar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: '2px solid var(--clr-gray-100)',
        background: '#fff',
        padding: '0 24px',
        position: 'sticky', top: 'var(--header-h)', zIndex: 40,
        boxShadow: 'var(--shadow-sm)',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '13px 20px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: '.9rem', fontWeight: 600,
              color: activeTab === tab.id ? 'var(--clr-primary)' : 'var(--clr-gray-500)',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--clr-primary)' : 'transparent'}`,
              marginBottom: -2,
              transition: 'color .15s, border-color .15s',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* ══ TAB: ĐĂNG KÝ ══════════════════════════════════════════════════ */}
      {activeTab === 'register' && (
        <div style={{ flex: 1, padding: '24px 28px' }}>

          {/* Stats hôm nay — ngang */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Tổng hôm nay',   value: s?.total      ?? 0, color: '#0284c7', bg: '#e0f2fe' },
              { label: 'Chờ tiếp nhận',  value: s?.pending    ?? 0, color: '#92400e', bg: '#fef3c7' },
              { label: 'Đã tiếp nhận',   value: s?.checked_in ?? 0, color: '#1e40af', bg: '#dbeafe' },
              { label: 'Hoàn thành',     value: s?.completed  ?? 0, color: '#065f46', bg: '#d1fae5' },
            ].map(item => (
              <div key={item.label} style={{
                padding: '16px 20px', borderRadius: 12,
                background: item.bg,
              }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: item.color, lineHeight: 1 }}>
                  {item.value}
                </div>
                <div style={{ fontSize: '.875rem', color: item.color, opacity: .8, marginTop: 4 }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Form đăng ký full width */}
          <RegisterPanel onSuccess={load} visitDate={filterDate} clinicStats={clinicStatsAsync.data} />
        </div>
      )}

      {/* ══ TAB: DANH SÁCH ════════════════════════════════════════════════ */}
      {activeTab === 'list' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Toolbar */}
          <div style={{
            padding: '14px 24px',
            borderBottom: '1px solid var(--clr-gray-100)',
            display: 'flex', gap: 10, alignItems: 'center',
            background: '#fff', flexWrap: 'wrap',
          }}>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--clr-gray-800)', flex: 1 }}>
              Danh sách tiếp đón
            </span>
            <input type="date" className="form-input"
              style={{ width: 150 }}
              value={filterDate}
              onChange={e => { setFilterDate(e.target.value); goTo(1); }}
            />
            <select className="form-input" style={{ width: 170 }}
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); goTo(1); }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="pending">⏳ Chờ tiếp nhận</option>
              <option value="checked_in">✅ Đã tiếp nhận</option>
              <option value="completed">🏁 Hoàn thành</option>
              <option value="cancelled">❌ Đã huỷ</option>
            </select>
            <Button size="sm" variant="ghost" onClick={load}>↻ Làm mới</Button>
          </div>

          {/* Table */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
            {listAsync.loading && <LoadingOverlay />}
            {listAsync.error   && <ErrorState message={listAsync.error} onRetry={load} />}
            {!listAsync.loading && !listAsync.error && store.list.length === 0 && (
              <EmptyState icon="📋" title="Chưa có lượt tiếp đón"
                description="Chuyển sang tab Đăng ký để tạo lượt khám mới." />
            )}
            {!listAsync.loading && store.list.length > 0 && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9375rem' }}>
                <thead>
                  <tr style={{ background: 'var(--clr-gray-50)', position: 'sticky', top: 0, zIndex: 1 }}>
                    <th style={thStyle}>STT</th>
                    <th style={thStyle}>Bệnh nhân</th>
                    <th style={thStyle}>Giờ</th>
                    <th style={thStyle}>Phòng</th>
                    <th style={thStyle}>Đối tượng</th>
                    <th style={thStyle}>Trạng thái</th>
                    <th style={{ ...thStyle, width: 160 }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {store.list.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--clr-gray-50)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--clr-gray-50)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '#fff')}
                    >
                      {/* STT */}
                      <td style={tdStyle}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 8,
                          background: r.priority >= 2 ? '#fee2e2' : r.priority === 1 ? '#fef3c7' : 'var(--clr-primary-light)',
                          color:      r.priority >= 2 ? '#991b1b' : r.priority === 1 ? '#92400e' : 'var(--clr-primary-dark)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 800, fontSize: '.95rem',
                        }}>
                          {r.visit_number ?? '—'}
                        </div>
                      </td>

                      {/* Bệnh nhân */}
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: 'var(--clr-gray-900)', lineHeight: 1.3 }}>
                          {r.patient?.full_name ?? '—'}
                        </div>
                        <div style={{ fontSize: '.8125rem', color: 'var(--clr-gray-400)', marginTop: 2 }}>
                          {r.patient?.cccd ?? r.patient?.phone ?? ''}
                        </div>
                      </td>

                      {/* Giờ */}
                      <td style={{ ...tdStyle, color: 'var(--clr-gray-500)', fontSize: '.875rem' }}>
                        {r.visit_time ?? fmtDate(r.visit_date)}
                      </td>

                      {/* Phòng */}
                      <td style={{ ...tdStyle, fontSize: '.875rem', fontWeight: 500 }}>
                        {r.clinic_room ?? '—'}
                      </td>

                      {/* Đối tượng */}
                      <td style={tdStyle}>
                        {r.subject_name ? (
                          <span style={{
                            fontSize: '.8125rem', fontWeight: 600, padding: '2px 10px',
                            borderRadius: 9999, background: r.subject_name.includes('BHYT') ? '#dbeafe' : '#f3e8ff',
                            color: r.subject_name.includes('BHYT') ? '#1e40af' : '#6b21a8',
                          }}>
                            {r.subject_name}
                          </span>
                        ) : <span style={{ color: 'var(--clr-gray-300)' }}>—</span>}
                      </td>

                      {/* Trạng thái */}
                      <td style={tdStyle}><StatusBadge status={r.status} /></td>

                      {/* Thao tác */}
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => navigate(toPath(ROUTES.RECEPTION_DETAIL, { id: r.id }))}
                            style={actionBtnStyle}
                            title="Xem chi tiết"
                          >
                            👁
                          </button>
                          {r.status === 'pending' && (
                            <button
                              onClick={() => setCheckInTarget(r)}
                              style={{ ...actionBtnStyle, background: '#dbeafe', color: '#1e40af' }}
                              title="Check-in nhanh"
                            >
                              ✅ Check-in
                            </button>
                          )}
                          {r.status === 'checked_in' && (
                            <button
                              onClick={() => navigate(toPath(ROUTES.RECEPTION_DETAIL, { id: r.id }))}
                              style={{ ...actionBtnStyle, background: '#d1fae5', color: '#065f46' }}
                              title="Mở phiếu khám"
                            >
                              🩺
                            </button>
                          )}
                          {(r.status === 'pending' || r.status === 'checked_in') && (
                            <button
                              onClick={() => setCancelTarget(r)}
                              style={{ ...actionBtnStyle, background: '#fee2e2', color: '#991b1b' }}
                              title="Huỷ lượt"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {(listAsync.data?.total_pages ?? 0) > 1 && (
            <div style={{
              padding: '12px 24px', borderTop: '1px solid var(--clr-gray-100)',
              display: 'flex', justifyContent: 'flex-end', background: '#fff',
            }}>
              <Pagination page={page} totalPages={listAsync.data?.total_pages ?? 1} onChange={goTo} />
            </div>
          )}
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────── */}
      {checkInTarget && (
        <CheckInQuickModal
          reception={checkInTarget}
          onClose={() => setCheckInTarget(null)}
          onQuick={() => { handleQuickCheckIn(checkInTarget); setCheckInTarget(null); }}
          onSuccess={() => { setCheckInTarget(null); load(); }}
        />
      )}

      <ConfirmDialog
        open={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="Huỷ lượt tiếp đón"
        message={`Xác nhận huỷ lượt khám của ${cancelTarget?.patient?.full_name ?? 'bệnh nhân này'}?`}
        confirmLabel="Huỷ lượt"
        danger
      />
    </div>
  );
}

// ── CSS-in-JS helpers ─────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: '.8125rem',
  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em',
  color: 'var(--clr-gray-500)', borderBottom: '2px solid var(--clr-gray-100)',
  whiteSpace: 'nowrap', background: 'var(--clr-gray-50)',
};
const tdStyle: React.CSSProperties = {
  padding: '12px 14px', verticalAlign: 'middle',
};
const actionBtnStyle: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 7, border: 'none',
  background: 'var(--clr-gray-100)', color: 'var(--clr-gray-600)',
  cursor: 'pointer', fontSize: '.8125rem', fontWeight: 600,
  fontFamily: 'var(--font-sans)', transition: 'opacity .15s',
  display: 'inline-flex', alignItems: 'center', gap: 4,
};

// ─────────────────────────────────────────────────────────────────────────────
// RegisterPanel — form đăng ký với layout 2 cột, tối ưu workflow
// ─────────────────────────────────────────────────────────────────────────────
interface RegisterPanelProps {
  onSuccess: () => void;
  visitDate?: string;
  clinicStats?: ClinicRoomStatResponse | null;
}

function RegisterPanel({ onSuccess, clinicStats }: RegisterPanelProps) {
  // ── Hành chính bệnh nhân ────────────────────────────────────────────────
  const [cccd,             setCccd]             = useState('');
  const [cccdIssuedBy,     setCccdIssuedBy]     = useState('');
  const [cccdIssuedDate,   setCccdIssuedDate]   = useState('');
  const [fullName,         setFullName]         = useState('');
  const [dateOfBirth,      setDateOfBirth]      = useState('');
  const [birthYear,        setBirthYear]        = useState('');
  const [gender,           setGender]           = useState('');
  const [occupation,       setOccupation]       = useState('');
  const [ethnicityCode,    setEthnicityCode]    = useState('');
  const [ethnicityName,    setEthnicityName]    = useState('');
  const [nationalityCode,  setNationalityCode]  = useState('VN');
  const [nationalityName,  setNationalityName]  = useState('VIET NAM');
  const [addressStreet,    setAddressStreet]    = useState('');
  const [addressVillage,   setAddressVillage]   = useState('');
  const [addressWardName,  setAddressWardName]  = useState('');
  const [addressDistrictName, setAddressDistrictName] = useState('');
  const [addressProvinceName, setAddressProvinceName] = useState('');
  const [workplace,        setWorkplace]        = useState('');
  const [phone,            setPhone]            = useState('');
  const [email,            setEmail]            = useState('');
  const [policyType,       setPolicyType]       = useState('');
  const [contactName,      setContactName]      = useState('');
  const [contactAddress,   setContactAddress]   = useState('');
  const [contactPhone,     setContactPhone]     = useState('');
  const [contactCccd,      setContactCccd]      = useState('');

  // ── Thông tin đăng ký khám ───────────────────────────────────────────────
  const [clinicRoom,           setClinicRoom]           = useState('');
  const [subjectType,          setSubjectType]          = useState('1');
  const [insuranceNo,          setInsuranceNo]          = useState('');
  const [insuranceValidFrom,   setInsuranceValidFrom]   = useState('');
  const [insuranceValidTo,     setInsuranceValidTo]     = useState('');
  const [initialRegistration,  setInitialRegistration]  = useState('');
  const [referralNote,         setReferralNote]         = useState('');
  const [referralFacility,     setReferralFacility]     = useState('');
  const [patientCategory,      setPatientCategory]      = useState('Người lớn');
  const [priority,             setPriority]             = useState('0');
  const [reason,               setReason]               = useState('');
  const [isReferral,           setIsReferral]           = useState(false);

  const [foundPatient,  setFoundPatient]  = useState<PatientResponse | null>(null);
  const [showExtraInfo, setShowExtraInfo] = useState(false);

  const scanAsync   = useAsync<unknown>();
  const createAsync = useAsync<unknown>();
  const cccdRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setCccd(''); setCccdIssuedBy(''); setCccdIssuedDate('');
    setFullName(''); setDateOfBirth(''); setBirthYear(''); setGender('');
    setOccupation(''); setEthnicityCode(''); setEthnicityName('');
    setNationalityCode('VN'); setNationalityName('VIET NAM');
    setAddressStreet(''); setAddressVillage(''); setAddressWardName('');
    setAddressDistrictName(''); setAddressProvinceName('');
    setWorkplace(''); setPhone(''); setEmail(''); setPolicyType('');
    setContactName(''); setContactAddress(''); setContactPhone(''); setContactCccd('');
    setClinicRoom(''); setSubjectType('1'); setInsuranceNo('');
    setInsuranceValidFrom(''); setInsuranceValidTo('');
    setInitialRegistration(''); setReferralNote(''); setReferralFacility('');
    setPatientCategory('Người lớn'); setPriority('0'); setReason(''); setIsReferral(false);
    setFoundPatient(null); setShowExtraInfo(false);
    setTimeout(() => cccdRef.current?.focus(), 50);
  };

  const fillFromPatient = (p: PatientResponse) => {
    setFoundPatient(p);
    setFullName(p.full_name);
    setDateOfBirth(p.date_of_birth ?? '');
    setBirthYear(String(p.birth_year ?? ''));
    setGender(p.gender ?? '');
    setPhone(p.phone ?? '');
    setEmail(p.email ?? '');
    setOccupation(p.occupation ?? '');
    setEthnicityCode(p.ethnicity_code ?? '');
    setEthnicityName(p.ethnicity_name ?? '');
    setNationalityCode(p.nationality_code ?? 'VN');
    setNationalityName(p.nationality_name ?? 'VIET NAM');
    setCccdIssuedBy(p.cccd_issued_by ?? '');
    setCccdIssuedDate(p.cccd_issued_date ?? '');
    setAddressStreet(p.address_street ?? '');
    setAddressVillage(p.address_village ?? '');
    setAddressWardName(p.address_ward_name ?? '');
    setAddressDistrictName(p.address_district_name ?? '');
    setAddressProvinceName(p.address_province_name ?? '');
    setWorkplace(p.workplace ?? '');
    setPolicyType(p.policy_type ?? '');
    setContactName(p.contact_name ?? '');
    setContactAddress(p.contact_address ?? '');
    setContactPhone(p.contact_phone ?? '');
    setContactCccd(p.contact_cccd ?? '');
  };

  const handleScanCccd = async () => {
    if (!cccd || cccd.length < 9) return;
    const res = await scanAsync.run(
      receptionApi.scanCccd({ cccd }) as unknown as Promise<{ patient: PatientResponse; is_new_patient: boolean; message: string }>,
    );
    if (res) {
      const r = res as { patient: PatientResponse; is_new_patient: boolean; message: string };
      fillFromPatient(r.patient);
      if (r.is_new_patient) {
        toast('👤 Bệnh nhân mới — vui lòng bổ sung thêm thông tin', { icon: '✨' });
        setShowExtraInfo(true);
      } else {
        toast.success(`Tìm thấy: ${r.patient.full_name}`);
      }
    } else {
      toast('Chưa có trong hệ thống — vui lòng nhập thông tin', { icon: 'ℹ️' });
      setShowExtraInfo(true);
    }
  };

  const handleSearchByName = async () => {
    if (!fullName.trim() || fullName.length < 2) return;
    const res = await scanAsync.run(
      patientApi.list({ search: fullName, page: 1, page_size: 1 }) as unknown as Promise<{ items: PatientResponse[] }>,
    );
    if (res) {
      const list = (res as { items: PatientResponse[] }).items;
      if (list.length > 0 && list[0]) {
        fillFromPatient(list[0]);
        toast.success(`Tìm thấy: ${list[0].full_name}`);
      }
    }
  };

  const handleEthnicityChange = (code: string) => {
    setEthnicityCode(code);
    const found = ETHNICITIES.find(e => e.code === code);
    if (found) setEthnicityName(found.name);
  };

  const handleNationalityChange = (code: string) => {
    setNationalityCode(code);
    const found = NATIONALITIES.find(n => n.code === code);
    if (found) setNationalityName(found.name);
  };

  const calcAge = (): string => {
    const year = parseInt(birthYear);
    if (!isNaN(year) && year > 1900) return `${new Date().getFullYear() - year} tuổi`;
    if (dateOfBirth) {
      const d = new Date(dateOfBirth);
      if (!isNaN(d.getTime())) return `${new Date().getFullYear() - d.getFullYear()} tuổi`;
    }
    return '';
  };

  const handleRegister = async () => {
    if (!fullName.trim()) { toast.error('Vui lòng nhập họ tên'); return; }
    if (!clinicRoom)       { toast.error('Vui lòng chọn phòng khám'); return; }

    const patientData = foundPatient ? undefined : {
      full_name: fullName,
      date_of_birth: dateOfBirth || undefined,
      birth_year: birthYear ? Number(birthYear) : undefined,
      gender: (gender as 'male' | 'female') || undefined,
      phone: phone || undefined,
      email: email || undefined,
      cccd: cccd || undefined,
      cccd_issued_by: cccdIssuedBy || undefined,
      cccd_issued_date: cccdIssuedDate || undefined,
      occupation: occupation || undefined,
      ethnicity_code: ethnicityCode || undefined,
      ethnicity_name: ethnicityName || undefined,
      nationality_code: nationalityCode || undefined,
      nationality_name: nationalityName || undefined,
      address_street: addressStreet || undefined,
      address_village: addressVillage || undefined,
      address_ward_name: addressWardName || undefined,
      address_district_name: addressDistrictName || undefined,
      address_province_name: addressProvinceName || undefined,
      workplace: workplace || undefined,
      policy_type: policyType || undefined,
      contact_name: contactName || undefined,
      contact_address: contactAddress || undefined,
      contact_phone: contactPhone || undefined,
      contact_cccd: contactCccd || undefined,
    };

    const payload = {
      patient_id: foundPatient?.id ?? undefined,
      patient_data: patientData,
      clinic_room: clinicRoom,
      subject_type: subjectType || undefined,
      subject_name: SUBJECT_TYPES.find(s => s.value === subjectType)?.label,
      insurance_number: insuranceNo || undefined,
      insurance_valid_from: insuranceValidFrom || undefined,
      insurance_valid_to: insuranceValidTo || undefined,
      initial_registration: initialRegistration || undefined,
      referral_note: referralNote || undefined,
      referral_facility: referralFacility || undefined,
      patient_category: patientCategory || undefined,
      priority: Number(priority),
      reason: reason || undefined,
      is_referral: isReferral,
    };

    const res = await createAsync.run(receptionApi.create(payload));
    if (res !== null) {
      toast.success('🎉 Đăng ký thành công!');
      resetForm();
      onSuccess();
    } else {
      toast.error(createAsync.error ?? 'Đăng ký thất bại');
    }
  };

  const isLocked = !!foundPatient;
  const ageLabel = calcAge();

  // ── Layout: 2 cột ─────────────────────────────────────────────────────────
  // Cột trái (7/12): thông tin thiết yếu + đăng ký khám
  // Cột phải (5/12): thống kê phòng khám + thông tin chi tiết (collapsible)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 20, alignItems: 'start' }}>

      {/* ══════════════════════════════════════════════════════════════════
          CỘT TRÁI — Form chính (thiết yếu, thao tác hàng ngày)
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Khối 1: Tra cứu bệnh nhân ── */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--clr-primary)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              🔍 Tra cứu bệnh nhân
            </span>
            {foundPatient && (
              <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '.8125rem', color: 'var(--clr-gray-400)', padding: 0 }}>
                ✕ Xoá / Đăng ký mới
              </button>
            )}
          </div>
          <div style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={cccdRef} className="form-input"
                value={cccd} onChange={e => setCccd(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleScanCccd()}
                placeholder="Quét thẻ hoặc nhập số CCCD / CMND..."
                autoFocus style={{ flex: 1 }}
              />
              <Btn onClick={handleScanCccd} loading={scanAsync.loading} primary>
                🔍 Tra cứu
              </Btn>
            </div>

            {/* Kết quả tìm kiếm */}
            {foundPatient ? (
              <div style={{
                marginTop: 10, padding: '10px 14px', borderRadius: 8,
                background: 'linear-gradient(135deg, #d1fae5, #ecfdf5)',
                border: '1px solid #6ee7b7',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#059669', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1rem', flexShrink: 0,
                  }}>
                    {foundPatient.full_name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#065f46', fontSize: '.9375rem' }}>{foundPatient.full_name}</div>
                    <div style={{ fontSize: '.8rem', color: '#047857', marginTop: 2, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {foundPatient.patient_code && <span>Mã: {foundPatient.patient_code}</span>}
                      {foundPatient.birth_year   && <span>Năm sinh: {foundPatient.birth_year}</span>}
                      {foundPatient.phone        && <span>📞 {foundPatient.phone}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p style={{ marginTop: 8, fontSize: '.8125rem', color: 'var(--clr-gray-400)', margin: '8px 0 0' }}>
                Quét CCCD hoặc nhập số rồi nhấn Enter / Tra cứu để tìm bệnh nhân cũ.
              </p>
            )}
          </div>
        </div>

        {/* ── Khối 2: Thông tin cơ bản bệnh nhân ── */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--clr-primary)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              👤 Thông tin bệnh nhân
            </span>
            {isLocked && (
              <span style={{ fontSize: '.75rem', color: '#059669', fontWeight: 600, background: '#d1fae5', padding: '2px 8px', borderRadius: 9999 }}>
                ✓ Đã tra cứu
              </span>
            )}
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Họ tên */}
            <div>
              <FLabel required>Họ và tên</FLabel>
              <input className="form-input" style={{ marginTop: 5 }}
                value={fullName} onChange={e => setFullName(e.target.value)}
                onBlur={!foundPatient ? handleSearchByName : undefined}
                placeholder="Nguyễn Văn A" readOnly={isLocked} />
            </div>

            {/* Ngày sinh + Năm sinh + Tuổi + Giới tính trên 1 hàng */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 0.8fr 1fr', gap: 10 }}>
              <div>
                <FLabel>Sinh ngày</FLabel>
                <input className="form-input" style={{ marginTop: 5 }} type="date"
                  value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                  readOnly={isLocked} />
              </div>
              <div>
                <FLabel>Năm sinh</FLabel>
                <input className="form-input" style={{ marginTop: 5 }} type="number"
                  min={1900} max={2030} placeholder="1990"
                  value={birthYear} onChange={e => setBirthYear(e.target.value)}
                  readOnly={isLocked} />
              </div>
              <div>
                <FLabel>Tuổi</FLabel>
                <input className="form-input" style={{ marginTop: 5, background: 'var(--clr-gray-50)', color: 'var(--clr-gray-500)', textAlign: 'center' }}
                  value={ageLabel} readOnly placeholder="—" />
              </div>
              <div>
                <FLabel>Giới tính</FLabel>
                <select className="form-input" style={{ marginTop: 5 }}
                  value={gender} onChange={e => setGender(e.target.value)} disabled={isLocked}>
                  <option value="">—</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </div>
            </div>

            {/* Di động + Email trên 1 hàng */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <FLabel>Di động</FLabel>
                <input className="form-input" style={{ marginTop: 5 }}
                  value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="0912 345 678" readOnly={isLocked} />
              </div>
              <div>
                <FLabel>Email</FLabel>
                <input className="form-input" style={{ marginTop: 5 }} type="email"
                  value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com" readOnly={isLocked} />
              </div>
            </div>

            {/* Toggle thêm thông tin chi tiết */}
            <button
              onClick={() => setShowExtraInfo(v => !v)}
              style={{
                background: 'none', border: '1px dashed var(--clr-gray-200)',
                borderRadius: 7, padding: '7px 14px', cursor: 'pointer',
                fontSize: '.8125rem', color: 'var(--clr-gray-500)', fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center',
                transition: 'border-color .15s, color .15s',
              }}
            >
              {showExtraInfo ? '▲ Ẩn thông tin bổ sung' : '▼ Bổ sung: địa chỉ, dân tộc, nghề nghiệp, người thân...'}
            </button>

            {/* Thông tin bổ sung — collapsible */}
            {showExtraInfo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4, borderTop: '1px solid var(--clr-gray-100)' }}>

                {/* Nghề nghiệp + Dân tộc + Quốc tịch + Đối tượng chính sách */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <FLabel>Nghề nghiệp</FLabel>
                    <input className="form-input" style={{ marginTop: 5 }} value={occupation}
                      onChange={e => setOccupation(e.target.value)} placeholder="Nông dân..."
                      readOnly={isLocked} />
                  </div>
                  <div>
                    <FLabel>Dân tộc</FLabel>
                    <select className="form-input" style={{ marginTop: 5 }}
                      value={ethnicityCode} onChange={e => handleEthnicityChange(e.target.value)}
                      disabled={isLocked}>
                      <option value="">— Chọn —</option>
                      {ETHNICITIES.map(e => <option key={e.code} value={e.code}>{e.code} - {e.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <FLabel>Quốc tịch</FLabel>
                    <select className="form-input" style={{ marginTop: 5 }}
                      value={nationalityCode} onChange={e => handleNationalityChange(e.target.value)}
                      disabled={isLocked}>
                      {NATIONALITIES.map(n => <option key={n.code} value={n.code}>{n.code} - {n.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <FLabel>Đối tượng c/sách</FLabel>
                    <select className="form-input" style={{ marginTop: 5 }}
                      value={policyType} onChange={e => setPolicyType(e.target.value)}
                      disabled={isLocked}>
                      <option value="">—</option>
                      {POLICY_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {/* CCCD chi tiết + Nơi làm việc */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <div>
                    <FLabel>Nơi cấp CCCD·CMND</FLabel>
                    <input className="form-input" style={{ marginTop: 5 }} value={cccdIssuedBy}
                      onChange={e => setCccdIssuedBy(e.target.value)}
                      placeholder="Cục Cảnh sát QLHC..." readOnly={isLocked} />
                  </div>
                  <div>
                    <FLabel>Ngày cấp</FLabel>
                    <input className="form-input" style={{ marginTop: 5 }} type="date"
                      value={cccdIssuedDate} onChange={e => setCccdIssuedDate(e.target.value)}
                      readOnly={isLocked} />
                  </div>
                  <div>
                    <FLabel>Nơi làm việc</FLabel>
                    <input className="form-input" style={{ marginTop: 5 }} value={workplace}
                      onChange={e => setWorkplace(e.target.value)} placeholder="Tên cơ quan/công ty"
                      readOnly={isLocked} />
                  </div>
                </div>

                {/* Địa chỉ */}
                <div>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--clr-gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Địa chỉ</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <FLabel>Số nhà · Thôn · Phố</FLabel>
                      <input className="form-input" style={{ marginTop: 5 }} value={addressStreet}
                        onChange={e => setAddressStreet(e.target.value)} placeholder="123 Đường ABC, Thôn 1"
                        readOnly={isLocked} />
                    </div>
                    <div>
                      <FLabel>Phường · Xã</FLabel>
                      <input className="form-input" style={{ marginTop: 5 }} value={addressWardName}
                        onChange={e => setAddressWardName(e.target.value)} placeholder="P. Nghĩa Lộ"
                        readOnly={isLocked} />
                    </div>
                    <div>
                      <FLabel>Quận · Huyện</FLabel>
                      <input className="form-input" style={{ marginTop: 5 }} value={addressDistrictName}
                        onChange={e => setAddressDistrictName(e.target.value)} placeholder="H. Tư Nghĩa"
                        readOnly={isLocked} />
                    </div>
                    <div>
                      <FLabel>Tỉnh · Thành phố</FLabel>
                      <input className="form-input" style={{ marginTop: 5 }} value={addressProvinceName}
                        onChange={e => setAddressProvinceName(e.target.value)} placeholder="Tỉnh Quảng Ngãi"
                        readOnly={isLocked} />
                    </div>
                  </div>
                </div>

                {/* Người thân */}
                <div>
                  <div style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--clr-gray-400)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 8 }}>Người thân / Người đi cùng</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <FLabel>Họ tên</FLabel>
                      <input className="form-input" style={{ marginTop: 5 }} value={contactName}
                        onChange={e => setContactName(e.target.value)} placeholder="Nguyễn Thị B"
                        readOnly={isLocked} />
                    </div>
                    <div>
                      <FLabel>Địa chỉ</FLabel>
                      <input className="form-input" style={{ marginTop: 5 }} value={contactAddress}
                        onChange={e => setContactAddress(e.target.value)} placeholder="Địa chỉ người thân"
                        readOnly={isLocked} />
                    </div>
                    <div>
                      <FLabel>Điện thoại</FLabel>
                      <input className="form-input" style={{ marginTop: 5 }} value={contactPhone}
                        onChange={e => setContactPhone(e.target.value)} placeholder="0912 345 678"
                        readOnly={isLocked} />
                    </div>
                    <div>
                      <FLabel>CMND · CCCD</FLabel>
                      <input className="form-input" style={{ marginTop: 5 }} value={contactCccd}
                        onChange={e => setContactCccd(e.target.value)} placeholder="012345678"
                        readOnly={isLocked} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Khối 3: Thông tin đăng ký khám ── */}
        <div style={cardStyle}>
          <div style={cardHeaderStyle}>
            <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--clr-primary)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
              🏥 Thông tin đăng ký khám
            </span>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Hàng 1: Phòng + Đối tượng + Khám + Ưu tiên */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', gap: 10 }}>
              <div>
                <FLabel required>Phòng khám</FLabel>
                <select className="form-input" style={{ marginTop: 5 }} value={clinicRoom}
                  onChange={e => setClinicRoom(e.target.value)}>
                  <option value="">— Chọn phòng —</option>
                  {CLINIC_ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <FLabel>Đối tượng</FLabel>
                <select className="form-input" style={{ marginTop: 5 }} value={subjectType}
                  onChange={e => setSubjectType(e.target.value)}>
                  {SUBJECT_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <FLabel>Khám</FLabel>
                <select className="form-input" style={{ marginTop: 5 }} value={patientCategory}
                  onChange={e => setPatientCategory(e.target.value)}>
                  {PATIENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <FLabel>Ưu tiên</FLabel>
                <select className="form-input" style={{ marginTop: 5, fontWeight: 600,
                  color: priority === '2' ? '#dc2626' : priority === '1' ? '#d97706' : undefined }}
                  value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="0">Bình thường</option>
                  <option value="1">⚡ Ưu tiên</option>
                  <option value="2">🚨 Cấp cứu</option>
                </select>
              </div>
            </div>

            {/* BHYT fields — chỉ khi chọn BHYT */}
            {subjectType === '1' && (
              <div style={{ padding: '12px 14px', background: '#eff6ff', borderRadius: 8, border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                  🎫 Thông tin BHYT
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.4fr', gap: 10 }}>
                  <div>
                    <FLabel>Số thẻ BHYT</FLabel>
                    <input className="form-input" style={{ marginTop: 5 }} value={insuranceNo}
                      onChange={e => setInsuranceNo(e.target.value)} placeholder="DN4012345678" />
                  </div>
                  <div>
                    <FLabel>Từ ngày</FLabel>
                    <input className="form-input" style={{ marginTop: 5 }} type="date"
                      value={insuranceValidFrom} onChange={e => setInsuranceValidFrom(e.target.value)} />
                  </div>
                  <div>
                    <FLabel>Đến ngày</FLabel>
                    <input className="form-input" style={{ marginTop: 5 }} type="date"
                      value={insuranceValidTo} onChange={e => setInsuranceValidTo(e.target.value)} />
                  </div>
                  <div>
                    <FLabel>ĐKKCB ban đầu</FLabel>
                    <input className="form-input" style={{ marginTop: 5 }} value={initialRegistration}
                      onChange={e => setInitialRegistration(e.target.value)} placeholder="Bệnh viện đăng ký..." />
                  </div>
                </div>
              </div>
            )}

            {/* Chuyển tuyến */}
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={isReferral} onChange={e => setIsReferral(e.target.checked)}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--clr-primary)' }} />
                <span style={{ fontSize: '.875rem', fontWeight: 600, color: 'var(--clr-gray-600)' }}>Chuyển tuyến / Giới thiệu từ cơ sở khác</span>
              </label>
              {isReferral && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <div>
                    <FLabel>Cơ sở giới thiệu</FLabel>
                    <input className="form-input" style={{ marginTop: 5 }} value={referralFacility}
                      onChange={e => setReferralFacility(e.target.value)} placeholder="Tên cơ sở chuyển tuyến..." />
                  </div>
                  <div>
                    <FLabel>Nội dung giới thiệu (CĐ)</FLabel>
                    <input className="form-input" style={{ marginTop: 5 }} value={referralNote}
                      onChange={e => setReferralNote(e.target.value)} placeholder="Chẩn đoán nơi giới thiệu..." />
                  </div>
                </div>
              )}
            </div>

            {/* Lý do khám */}
            <div>
              <FLabel>Lý do khám</FLabel>
              <textarea className="form-input" style={{ marginTop: 5 }} value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2} placeholder="Triệu chứng, lý do đến khám..." />
            </div>
          </div>
        </div>

        {/* ── Action buttons ── */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn onClick={resetForm} title="Xoá form và bắt đầu đăng ký mới">
              🔄 Nhập mới
            </Btn>
            <Btn onClick={() => window.print()} title="In số thứ tự bệnh nhân">
              🖨️ In STT BN
            </Btn>
          </div>
          <Btn onClick={handleRegister} loading={createAsync.loading} primary
            disabled={!fullName.trim() || !clinicRoom}>
            ✅ Đăng ký lượt khám
          </Btn>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          CỘT PHẢI — Thống kê + thông tin hỗ trợ
      ══════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Bảng thống kê phòng khám ── */}
        {clinicStats && clinicStats.rooms.length > 0 && (
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <span style={{ fontSize: '.8rem', fontWeight: 700, color: 'var(--clr-primary)', textTransform: 'uppercase', letterSpacing: '.08em' }}>
                📊 Thống kê hôm nay
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.8125rem' }}>
                <thead>
                  <tr>
                    {['Phòng', 'Tổng', 'Chờ', 'BHYT', 'DV'].map(h => (
                      <th key={h} style={{
                        padding: '8px 10px',
                        textAlign: h === 'Phòng' ? 'left' : 'center',
                        fontSize: '.75rem', fontWeight: 700,
                        textTransform: 'uppercase', letterSpacing: '.04em',
                        color: 'var(--clr-gray-400)',
                        borderBottom: '2px solid var(--clr-gray-100)',
                        background: 'var(--clr-gray-50)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clinicStats.rooms.map(r => (
                    <tr key={r.clinic_room}
                      style={{ borderBottom: '1px solid var(--clr-gray-50)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--clr-gray-50)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--clr-gray-700)', fontSize: '.8rem' }}>{r.clinic_room}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>{r.total}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: '#92400e' }}>{r.pending}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: '#1d4ed8' }}>{r.bhyt}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center', color: '#7c3aed' }}>{r.service}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f0f9ff', borderTop: '2px solid var(--clr-gray-200)' }}>
                    <td style={{ padding: '9px 10px', fontWeight: 800, color: 'var(--clr-gray-800)', fontSize: '.8rem' }}>Tổng cộng</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 800, color: '#0284c7', fontSize: '.875rem' }}>{clinicStats.total_all}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: '#92400e' }}>{clinicStats.total_pending}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: '#1d4ed8' }}>{clinicStats.total_bhyt}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'center', fontWeight: 700, color: '#7c3aed' }}>{clinicStats.total_service}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Hướng dẫn nhanh ── */}
        <div style={{ ...cardStyle, background: 'linear-gradient(135deg, #f0f9ff, #e0f2fe)' }}>
          <div style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: '.8rem', fontWeight: 700, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
              💡 Quy trình đăng ký
            </div>
            {[
              { step: '1', text: 'Quét CCCD hoặc nhập số → Tra cứu' },
              { step: '2', text: 'Kiểm tra / nhập thông tin bệnh nhân' },
              { step: '3', text: 'Chọn phòng khám và đối tượng' },
              { step: '4', text: 'Nhấn Đăng ký → hệ thống tự cấp số thứ tự' },
            ].map(({ step, text }) => (
              <div key={step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  background: '#0284c7', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '.7rem', fontWeight: 800,
                }}>
                  {step}
                </div>
                <span style={{ fontSize: '.8125rem', color: '#0c4a6e', lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  border: '1px solid var(--clr-gray-100)',
  boxShadow: 'var(--shadow-sm)',
  overflow: 'hidden',
};

const cardHeaderStyle: React.CSSProperties = {
  padding: '10px 18px',
  borderBottom: '1px solid var(--clr-gray-100)',
  background: 'var(--clr-gray-50)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

// ── Micro components ──────────────────────────────────────────────────────────
function FLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label style={{ fontSize: '.8125rem', fontWeight: 600, color: 'var(--clr-gray-600)', display: 'block' }}>
      {children}{required && <span style={{ color: 'var(--clr-danger)', marginLeft: 2 }}>*</span>}
    </label>
  );
}

function Btn({ children, onClick, primary, loading, disabled, title }: {
  children: React.ReactNode;
  onClick?: () => void;
  primary?: boolean;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick} disabled={loading || disabled} title={title}
      style={{
        padding: '10px 20px', borderRadius: 8,
        border: primary ? 'none' : '1.5px solid var(--clr-gray-200)',
        background: primary
          ? 'linear-gradient(135deg, var(--clr-primary), var(--clr-primary-dark))'
          : '#fff',
        color: primary ? '#fff' : 'var(--clr-gray-700)',
        fontWeight: 700, fontSize: '.875rem', fontFamily: 'var(--font-sans)',
        cursor: (loading || disabled) ? 'not-allowed' : 'pointer',
        opacity: disabled ? .45 : 1,
        boxShadow: primary ? '0 2px 8px rgba(14,165,233,.3)' : 'none',
        transition: 'opacity .15s',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {loading ? '⏳ Đang xử lý...' : children}
    </button>
  );
}
  // ── Hành chính bệnh nhân ────────────────────────────────────────────────
  const [cccd,             setCccd]             = useState('');
  const [cccdIssuedBy,     setCccdIssuedBy]     = useState('');
  const [cccdIssuedDate,   setCccdIssuedDate]   = useState('');
  const [fullName,         setFullName]         = useState('');
  const [dateOfBirth,      setDateOfBirth]      = useState('');
  const [birthYear,        setBirthYear]        = useState('');
  const [gender,           setGender]           = useState('');
  const [occupation,       setOccupation]       = useState('');
  const [ethnicityCode,    setEthnicityCode]    = useState('');
  const [ethnicityName,    setEthnicityName]    = useState('');
  const [nationalityCode,  setNationalityCode]  = useState('VN');
  const [nationalityName,  setNationalityName]  = useState('VIET NAM');
  const [addressStreet,    setAddressStreet]    = useState('');
  const [addressVillage,   setAddressVillage]   = useState('');
  const [addressWardName,  setAddressWardName]  = useState('');
  const [addressDistrictName, setAddressDistrictName] = useState('');
  const [addressProvinceName, setAddressProvinceName] = useState('');
  const [workplace,        setWorkplace]        = useState('');
  const [phone,            setPhone]            = useState('');
  const [email,            setEmail]            = useState('');
  const [policyType,       setPolicyType]       = useState('');
  // Người thân
  const [contactName,    setContactName]    = useState('');
  const [contactAddress, setContactAddress] = useState('');
  const [contactPhone,   setContactPhone]   = useState('');
  const [contactCccd,    setContactCccd]    = useState('');

  // ── Thông tin đăng ký khám ───────────────────────────────────────────────
  const [clinicRoom,           setClinicRoom]           = useState('');
  const [subjectType,          setSubjectType]          = useState('1');
  const [insuranceNo,          setInsuranceNo]          = useState('');
  const [insuranceValidFrom,   setInsuranceValidFrom]   = useState('');
  const [insuranceValidTo,     setInsuranceValidTo]     = useState('');
  const [initialRegistration,  setInitialRegistration]  = useState('');
  const [referralNote,         setReferralNote]         = useState('');
  const [referralFacility,     setReferralFacility]     = useState('');
  const [patientCategory,      setPatientCategory]      = useState('Người lớn');
  const [priority,             setPriority]             = useState('0');
  const [reason,               setReason]               = useState('');
  const [isReferral,           setIsReferral]           = useState(false);

  const [foundPatient, setFoundPatient] = useState<PatientResponse | null>(null);

  const scanAsync   = useAsync<unknown>();
  const createAsync = useAsync<unknown>();
  const cccdRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setCccd(''); setCccdIssuedBy(''); setCccdIssuedDate('');
    setFullName(''); setDateOfBirth(''); setBirthYear(''); setGender('');
    setOccupation(''); setEthnicityCode(''); setEthnicityName('');
    setNationalityCode('VN'); setNationalityName('VIET NAM');
    setAddressStreet(''); setAddressVillage(''); setAddressWardName('');
    setAddressDistrictName(''); setAddressProvinceName('');
    setWorkplace(''); setPhone(''); setEmail(''); setPolicyType('');
    setContactName(''); setContactAddress(''); setContactPhone(''); setContactCccd('');
    setClinicRoom(''); setSubjectType('1'); setInsuranceNo('');
    setInsuranceValidFrom(''); setInsuranceValidTo('');
    setInitialRegistration(''); setReferralNote(''); setReferralFacility('');
    setPatientCategory('Người lớn'); setPriority('0'); setReason(''); setIsReferral(false);
    setFoundPatient(null);
    cccdRef.current?.focus();
  };

  const fillFromPatient = (p: PatientResponse) => {
    setFoundPatient(p);
    setFullName(p.full_name);
    setDateOfBirth(p.date_of_birth ?? '');
    setBirthYear(String(p.birth_year ?? ''));
    setGender(p.gender ?? '');
    setPhone(p.phone ?? '');
    setEmail(p.email ?? '');
    setOccupation(p.occupation ?? '');
    setEthnicityCode(p.ethnicity_code ?? '');
    setEthnicityName(p.ethnicity_name ?? '');
    setNationalityCode(p.nationality_code ?? 'VN');
    setNationalityName(p.nationality_name ?? 'VIET NAM');
    setCccdIssuedBy(p.cccd_issued_by ?? '');
    setCccdIssuedDate(p.cccd_issued_date ?? '');
    setAddressStreet(p.address_street ?? '');
    setAddressVillage(p.address_village ?? '');
    setAddressWardName(p.address_ward_name ?? '');
    setAddressDistrictName(p.address_district_name ?? '');
    setAddressProvinceName(p.address_province_name ?? '');
    setWorkplace(p.workplace ?? '');
    setPolicyType(p.policy_type ?? '');
    setContactName(p.contact_name ?? '');
    setContactAddress(p.contact_address ?? '');
    setContactPhone(p.contact_phone ?? '');
    setContactCccd(p.contact_cccd ?? '');
  };

  const handleScanCccd = async () => {
    if (!cccd || cccd.length < 9) return;
    const res = await scanAsync.run(
      receptionApi.scanCccd({ cccd }) as unknown as Promise<{ patient: PatientResponse; is_new_patient: boolean; message: string }>,
    );
    if (res) {
      const r = res as { patient: PatientResponse; is_new_patient: boolean; message: string };
      fillFromPatient(r.patient);
      if (r.is_new_patient) toast('👤 Bệnh nhân mới — đã thêm', { icon: '✨' });
      else toast.success(`Tìm thấy: ${r.patient.full_name}`);
    } else {
      toast('Chưa có trong hệ thống — vui lòng nhập thông tin', { icon: 'ℹ️' });
    }
  };

  const handleSearchByName = async () => {
    if (!fullName.trim() || fullName.length < 2) return;
    const res = await scanAsync.run(
      patientApi.list({ search: fullName, page: 1, page_size: 1 }) as unknown as Promise<{ items: PatientResponse[] }>,
    );
    if (res) {
      const list = (res as { items: PatientResponse[] }).items;
      if (list.length > 0 && list[0]) {
        fillFromPatient(list[0]);
        toast.success(`Tìm thấy: ${list[0].full_name}`);
      }
    }
  };

  // Khi chọn dân tộc → tự điền tên
  const handleEthnicityChange = (code: string) => {
    setEthnicityCode(code);
    const found = ETHNICITIES.find(e => e.code === code);
    if (found) setEthnicityName(found.name);
  };

  // Khi chọn quốc tịch → tự điền tên
  const handleNationalityChange = (code: string) => {
    setNationalityCode(code);
    const found = NATIONALITIES.find(n => n.code === code);
    if (found) setNationalityName(found.name);
  };

  // Tính tuổi từ năm sinh hoặc ngày sinh
  const calcAge = (): string => {
    const year = parseInt(birthYear);
    if (!isNaN(year)) return `${new Date().getFullYear() - year} tuổi`;
    if (dateOfBirth) {
      const d = new Date(dateOfBirth);
      if (!isNaN(d.getTime())) return `${new Date().getFullYear() - d.getFullYear()} tuổi`;
    }
    return '';
  };

  const handleRegister = async () => {
    if (!fullName.trim()) { toast.error('Vui lòng nhập họ tên'); return; }
    if (!clinicRoom)       { toast.error('Vui lòng chọn phòng khám'); return; }

    const patientData = foundPatient ? undefined : {
      full_name:             fullName,
      date_of_birth:         dateOfBirth || undefined,
      birth_year:            birthYear ? Number(birthYear) : undefined,
      gender:                (gender as 'male' | 'female') || undefined,
      phone:                 phone || undefined,
      email:                 email || undefined,
      cccd:                  cccd || undefined,
      cccd_issued_by:        cccdIssuedBy || undefined,
      cccd_issued_date:      cccdIssuedDate || undefined,
      occupation:            occupation || undefined,
      ethnicity_code:        ethnicityCode || undefined,
      ethnicity_name:        ethnicityName || undefined,
      nationality_code:      nationalityCode || undefined,
      nationality_name:      nationalityName || undefined,
      address_street:        addressStreet || undefined,
      address_village:       addressVillage || undefined,
      address_ward_name:     addressWardName || undefined,
      address_district_name: addressDistrictName || undefined,
      address_province_name: addressProvinceName || undefined,
      workplace:             workplace || undefined,
      policy_type:           policyType || undefined,
      contact_name:          contactName || undefined,
      contact_address:       contactAddress || undefined,
      contact_phone:         contactPhone || undefined,
      contact_cccd:          contactCccd || undefined,
    };

    const payload = {
      patient_id:           foundPatient?.id ?? undefined,
      patient_data:         patientData,
      clinic_room:          clinicRoom,
      subject_type:         subjectType || undefined,
      subject_name:         SUBJECT_TYPES.find(s => s.value === subjectType)?.label,
      insurance_number:     insuranceNo || undefined,
      insurance_valid_from: insuranceValidFrom || undefined,
      insurance_valid_to:   insuranceValidTo || undefined,
      initial_registration: initialRegistration || undefined,
      referral_note:        referralNote || undefined,
      referral_facility:    referralFacility || undefined,
      patient_category:     patientCategory || undefined,
      priority:             Number(priority),
      reason:               reason || undefined,
      is_referral:          isReferral,
    };

    const res = await createAsync.run(receptionApi.create(payload));
    if (res !== null) {
      toast.success('🎉 Đăng ký thành công!');
      resetForm();
      onSuccess();
    } else {
      toast.error(createAsync.error ?? 'Đăng ký thất bại');
    }
  };

  const isLocked = !!foundPatient;
  const ageLabel = calcAge();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Form card ─────────────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--clr-gray-100)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          padding: '14px 24px', borderBottom: '1px solid var(--clr-gray-100)',
          background: 'var(--clr-gray-50)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.05rem' }}>📝</span>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--clr-gray-800)', flex: 1 }}>
            Đăng ký lượt khám{visitDate ? ` — ${visitDate}` : ''}
          </span>
        </div>

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* ══ I. HÀNH CHÍNH ══════════════════════════════════════════════ */}
          <section>
            <SectionTitle>I. HÀNH CHÍNH</SectionTitle>

            {/* Tra cứu CCCD */}
            <div style={{ marginTop: 14 }}>
              <Label>Quét / nhập CCCD·CMND</Label>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <input
                  ref={cccdRef} className="form-input"
                  value={cccd} onChange={e => setCccd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScanCccd()}
                  placeholder="Quét thẻ hoặc nhập số CCCD/CMND..."
                  autoFocus style={{ flex: 1 }}
                />
                <Btn onClick={handleScanCccd} loading={scanAsync.loading} primary>🔍 Tra cứu</Btn>
              </div>
              {foundPatient && (
                <div style={{
                  marginTop: 8, padding: '9px 14px', borderRadius: 8,
                  background: '#d1fae5', border: '1px solid #6ee7b7',
                  fontSize: '.875rem', color: '#065f46',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span>✅</span>
                  <div style={{ flex: 1 }}>
                    <strong>{foundPatient.full_name}</strong>
                    {foundPatient.patient_code && <span style={{ marginLeft: 10, opacity: .7 }}>Mã: {foundPatient.patient_code}</span>}
                    {foundPatient.birth_year && <span style={{ marginLeft: 10, opacity: .7 }}>· {foundPatient.birth_year}</span>}
                    {foundPatient.phone && <span style={{ marginLeft: 10, opacity: .7 }}>· {foundPatient.phone}</span>}
                  </div>
                  <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065f46', fontSize: '1.1rem', lineHeight: 1 }}>✕</button>
                </div>
              )}
            </div>

            {/* Row 1: Họ tên + Giới tính + Ngày sinh + Năm sinh + Tuổi */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 12, marginTop: 14 }}>
              <div>
                <Label required>Họ và tên</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  onBlur={!foundPatient ? handleSearchByName : undefined}
                  placeholder="Nguyễn Văn A" readOnly={isLocked} />
              </div>
              <div>
                <Label>Giới tính</Label>
                <select className="form-input" style={{ marginTop: 5 }} value={gender}
                  onChange={e => setGender(e.target.value)} disabled={isLocked}>
                  <option value="">—</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </div>
              <div>
                <Label>Sinh ngày</Label>
                <input className="form-input" style={{ marginTop: 5 }} type="date"
                  value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
                  readOnly={isLocked} />
              </div>
              <div>
                <Label>Năm sinh</Label>
                <input className="form-input" style={{ marginTop: 5 }} type="number"
                  min={1900} max={2030} placeholder="1990"
                  value={birthYear} onChange={e => setBirthYear(e.target.value)}
                  readOnly={isLocked} />
              </div>
              <div>
                <Label>Tuổi</Label>
                <input className="form-input" style={{ marginTop: 5, background: 'var(--clr-gray-50)', color: 'var(--clr-gray-500)' }}
                  value={ageLabel} readOnly placeholder="Tự tính" />
              </div>
            </div>

            {/* Row 2: Nghề nghiệp + Dân tộc + Quốc tịch + Loại đối tượng */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <Label>Nghề nghiệp</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={occupation}
                  onChange={e => setOccupation(e.target.value)} placeholder="Nông dân, Công nhân..."
                  readOnly={isLocked} />
              </div>
              <div>
                <Label>Dân tộc</Label>
                <select className="form-input" style={{ marginTop: 5 }}
                  value={ethnicityCode} onChange={e => handleEthnicityChange(e.target.value)}
                  disabled={isLocked}>
                  <option value="">— Chọn —</option>
                  {ETHNICITIES.map(e => <option key={e.code} value={e.code}>{e.code} - {e.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Quốc tịch</Label>
                <select className="form-input" style={{ marginTop: 5 }}
                  value={nationalityCode} onChange={e => handleNationalityChange(e.target.value)}
                  disabled={isLocked}>
                  {NATIONALITIES.map(n => <option key={n.code} value={n.code}>{n.code} - {n.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Đối tượng chính sách</Label>
                <select className="form-input" style={{ marginTop: 5 }}
                  value={policyType} onChange={e => setPolicyType(e.target.value)}
                  disabled={isLocked}>
                  <option value="">—</option>
                  {POLICY_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            {/* Row 3: CCCD chi tiết */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <Label>Nơi cấp CCCD·CMND</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={cccdIssuedBy}
                  onChange={e => setCccdIssuedBy(e.target.value)}
                  placeholder="Cục Cảnh sát QLHC..." readOnly={isLocked} />
              </div>
              <div>
                <Label>Ngày cấp</Label>
                <input className="form-input" style={{ marginTop: 5 }} type="date"
                  value={cccdIssuedDate} onChange={e => setCccdIssuedDate(e.target.value)}
                  readOnly={isLocked} />
              </div>
              <div>
                <Label>Nơi làm việc</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={workplace}
                  onChange={e => setWorkplace(e.target.value)} placeholder="Tên cơ quan/công ty"
                  readOnly={isLocked} />
              </div>
            </div>

            {/* Row 4: Địa chỉ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <Label>Số nhà</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={addressStreet}
                  onChange={e => setAddressStreet(e.target.value)} placeholder="123 Đường ABC"
                  readOnly={isLocked} />
              </div>
              <div>
                <Label>Thôn·Phố</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={addressVillage}
                  onChange={e => setAddressVillage(e.target.value)} placeholder="Thôn 1..."
                  readOnly={isLocked} />
              </div>
              <div>
                <Label>Phường·Xã</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={addressWardName}
                  onChange={e => setAddressWardName(e.target.value)} placeholder="P. Nghĩa Lộ..."
                  readOnly={isLocked} />
              </div>
              <div>
                <Label>Quận·Huyện</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={addressDistrictName}
                  onChange={e => setAddressDistrictName(e.target.value)} placeholder="H. Tư Nghĩa..."
                  readOnly={isLocked} />
              </div>
              <div>
                <Label>Tỉnh·TP</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={addressProvinceName}
                  onChange={e => setAddressProvinceName(e.target.value)} placeholder="Tỉnh Quảng Ngãi"
                  readOnly={isLocked} />
              </div>
            </div>

            {/* Row 5: Liên hệ */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <Label>Di động</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={phone}
                  onChange={e => setPhone(e.target.value)} placeholder="0912 345 678"
                  readOnly={isLocked} />
              </div>
              <div>
                <Label>Email</Label>
                <input className="form-input" style={{ marginTop: 5 }} type="email" value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="example@email.com"
                  readOnly={isLocked} />
              </div>
            </div>
          </section>

          <Divider />

          {/* ══ NGƯỜI THÂN ══════════════════════════════════════════════════ */}
          <section>
            <SectionTitle>NGƯỜI THÂN / NGƯỜI ĐI CÙNG</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginTop: 14 }}>
              <div>
                <Label>Họ tên người thân</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={contactName}
                  onChange={e => setContactName(e.target.value)} placeholder="Nguyễn Thị B"
                  readOnly={isLocked} />
              </div>
              <div>
                <Label>Địa chỉ</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={contactAddress}
                  onChange={e => setContactAddress(e.target.value)} placeholder="Địa chỉ người thân"
                  readOnly={isLocked} />
              </div>
              <div>
                <Label>Điện thoại</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={contactPhone}
                  onChange={e => setContactPhone(e.target.value)} placeholder="0912 345 678"
                  readOnly={isLocked} />
              </div>
              <div>
                <Label>CMND·CCCD</Label>
                <input className="form-input" style={{ marginTop: 5 }} value={contactCccd}
                  onChange={e => setContactCccd(e.target.value)} placeholder="012345678"
                  readOnly={isLocked} />
              </div>
            </div>
          </section>

          <Divider />

          {/* ══ II. THÔNG TIN ĐĂNG KÝ KHÁM ═════════════════════════════════ */}
          <section>
            <SectionTitle>II. THÔNG TIN ĐĂNG KÝ KHÁM BỆNH</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12, marginTop: 14 }}>

              {/* Phòng khám */}
              <div>
                <Label required>Phòng khám</Label>
                <select className="form-input" style={{ marginTop: 5 }} value={clinicRoom}
                  onChange={e => setClinicRoom(e.target.value)}>
                  <option value="">— Chọn phòng —</option>
                  {CLINIC_ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {/* Đối tượng */}
              <div>
                <Label>Đối tượng</Label>
                <select className="form-input" style={{ marginTop: 5 }} value={subjectType}
                  onChange={e => setSubjectType(e.target.value)}>
                  {SUBJECT_TYPES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {/* Khám: đối tượng */}
              <div>
                <Label>Khám</Label>
                <select className="form-input" style={{ marginTop: 5 }} value={patientCategory}
                  onChange={e => setPatientCategory(e.target.value)}>
                  {PATIENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Ưu tiên */}
              <div>
                <Label>Ưu tiên</Label>
                <select className="form-input" style={{ marginTop: 5 }} value={priority}
                  onChange={e => setPriority(e.target.value)}>
                  <option value="0">Bình thường</option>
                  <option value="1">⚡ Ưu tiên</option>
                  <option value="2">🚨 Cấp cứu</option>
                </select>
              </div>

              {/* BHYT fields — chỉ khi chọn BHYT */}
              {subjectType === '1' && (<>
                <div>
                  <Label>Số thẻ BHYT</Label>
                  <input className="form-input" style={{ marginTop: 5 }} value={insuranceNo}
                    onChange={e => setInsuranceNo(e.target.value)} placeholder="DN4012345678" />
                </div>
                <div>
                  <Label>Từ ngày</Label>
                  <input className="form-input" style={{ marginTop: 5 }} type="date"
                    value={insuranceValidFrom} onChange={e => setInsuranceValidFrom(e.target.value)} />
                </div>
                <div>
                  <Label>Đến ngày</Label>
                  <input className="form-input" style={{ marginTop: 5 }} type="date"
                    value={insuranceValidTo} onChange={e => setInsuranceValidTo(e.target.value)} />
                </div>
                <div>
                  <Label>ĐKKCB ban đầu</Label>
                  <input className="form-input" style={{ marginTop: 5 }} value={initialRegistration}
                    onChange={e => setInitialRegistration(e.target.value)} placeholder="Bệnh viện đăng ký ban đầu..." />
                </div>
              </>)}

              {/* Giới thiệu */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: subjectType === '1' ? 0 : 22 }}>
                <input type="checkbox" id="isReferral" checked={isReferral}
                  onChange={e => setIsReferral(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <label htmlFor="isReferral" style={{ fontSize: '.875rem', fontWeight: 600, color: 'var(--clr-gray-600)', cursor: 'pointer' }}>
                  Chuyển tuyến/Giới thiệu
                </label>
              </div>

              {isReferral && (<>
                <div style={{ gridColumn: '1 / 3' }}>
                  <Label>Nội dung giới thiệu</Label>
                  <input className="form-input" style={{ marginTop: 5 }} value={referralNote}
                    onChange={e => setReferralNote(e.target.value)} placeholder="CĐ nơi giới thiệu..." />
                </div>
                <div style={{ gridColumn: '3 / 5' }}>
                  <Label>Cơ sở giới thiệu</Label>
                  <input className="form-input" style={{ marginTop: 5 }} value={referralFacility}
                    onChange={e => setReferralFacility(e.target.value)} placeholder="Tên cơ sở chuyển tuyến..." />
                </div>
              </>)}

              {/* Lý do khám — full width */}
              <div style={{ gridColumn: '1 / -1' }}>
                <Label>Lý do khám</Label>
                <textarea className="form-input" style={{ marginTop: 5 }} value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2} placeholder="Triệu chứng, lý do đến khám..." />
              </div>
            </div>
          </section>

          {/* ── Buttons ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--clr-gray-100)' }}>
            <Btn onClick={resetForm}>🔄 Nhập mới</Btn>
            <Btn onClick={() => window.print()} title="In STT bệnh nhân">🖨️ In STT BN</Btn>
            <Btn onClick={handleRegister} loading={createAsync.loading} primary
              disabled={!fullName.trim() || !clinicRoom}>
              ✅ Đăng ký lượt khám
            </Btn>
          </div>

        </div>
      </div>

      {/* ── Bảng thống kê phòng khám ──────────────────────────────────────── */}
      {clinicStats && clinicStats.rooms.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid var(--clr-gray-100)', boxShadow: 'var(--shadow-sm)', overflow: 'hidden' }}>
          <div style={{
            padding: '12px 20px', borderBottom: '1px solid var(--clr-gray-100)',
            background: 'var(--clr-gray-50)', display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>📊</span>
            <span style={{ fontWeight: 700, fontSize: '.9rem', color: 'var(--clr-gray-700)' }}>
              Thống kê phòng khám hôm nay
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.875rem' }}>
              <thead>
                <tr style={{ background: 'var(--clr-gray-50)' }}>
                  {['Phòng khám', 'Tổng số', 'Chưa KCB', 'BHYT', 'Dịch vụ'].map(h => (
                    <th key={h} style={{
                      padding: '9px 16px', textAlign: h === 'Phòng khám' ? 'left' : 'center',
                      fontSize: '.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em',
                      color: 'var(--clr-gray-500)', borderBottom: '2px solid var(--clr-gray-100)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clinicStats.rooms.map((r, i) => (
                  <tr key={r.clinic_room} style={{ borderBottom: '1px solid var(--clr-gray-50)', background: i % 2 === 0 ? '#fff' : 'var(--clr-gray-50)' }}>
                    <td style={{ padding: '9px 16px', fontWeight: 600, color: 'var(--clr-gray-800)' }}>{r.clinic_room}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'center', fontWeight: 700, color: '#0284c7' }}>{r.total}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'center', color: '#92400e' }}>{r.pending}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'center', color: '#1e40af' }}>{r.bhyt}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'center', color: '#6b21a8' }}>{r.service}</td>
                  </tr>
                ))}
                {/* Tổng cộng */}
                <tr style={{ background: 'var(--clr-gray-50)', borderTop: '2px solid var(--clr-gray-200)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 800, color: 'var(--clr-gray-900)' }}>Tổng cộng</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 800, color: '#0284c7' }}>{clinicStats.total_all}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#92400e' }}>{clinicStats.total_pending}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#1e40af' }}>{clinicStats.total_bhyt}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 700, color: '#6b21a8' }}>{clinicStats.total_service}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CheckInQuickModal — check-in với option thêm thông tin
// ─────────────────────────────────────────────────────────────────────────────
interface CheckInQuickModalProps {
  reception: ReceptionList;
  onClose:   () => void;
  onQuick:   () => void;
  onSuccess: () => void;
}

function CheckInQuickModal({ reception, onClose, onQuick, onSuccess }: CheckInQuickModalProps) {
  const [receptionistName, setReceptionistName] = useState('');
  const [note,             setNote]             = useState('');
  const checkInAsync = useAsync<unknown>();

  const handleFull = async () => {
    const res = await checkInAsync.run(
      receptionApi.checkIn(reception.id, {
        receptionist_name: receptionistName || null,
        internal_note:     note || null,
      }),
    );
    if (res !== null) {
      toast.success(`✅ Check-in: ${reception.patient?.full_name}`);
      onSuccess();
    } else toast.error(checkInAsync.error ?? 'Thất bại');
  };

  return (
    <Modal open onClose={onClose} title={`Check-in — ${reception.patient?.full_name ?? ''}`} size="sm"
      footer={
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <Button variant="ghost" onClick={onClose} style={{ flex: 1 }}>Huỷ</Button>
          <Button variant="secondary" onClick={onQuick} style={{ flex: 1 }}>⚡ Nhanh</Button>
          <Button loading={checkInAsync.loading} onClick={handleFull} style={{ flex: 1 }}>✅ Check-in</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: '10px 14px', background: 'var(--clr-gray-50)', borderRadius: 8, fontSize: '.875rem' }}>
          <div><strong>Phòng:</strong> {reception.clinic_room ?? '—'}</div>
          <div><strong>Số khám:</strong> {reception.visit_number ?? '—'}</div>
          <div><strong>Đối tượng:</strong> {reception.subject_name ?? '—'}</div>
        </div>
        <Field label="Nhân viên tiếp đón">
          <input className="form-input" value={receptionistName}
            onChange={e => setReceptionistName(e.target.value)} placeholder="Họ tên nhân viên" autoFocus />
        </Field>
        <Field label="Ghi chú nội bộ">
          <textarea className="form-input" rows={2} value={note}
            onChange={e => setNote(e.target.value)} placeholder="Ghi chú cho bác sĩ..." />
        </Field>
        <p style={{ fontSize: '.8125rem', color: 'var(--clr-gray-400)' }}>
          Hoặc nhấn <strong>⚡ Nhanh</strong> để check-in ngay không cần điền thêm.
        </p>
      </div>
    </Modal>
  );
}
