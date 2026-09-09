/**
 * AdminHomePage — Trang chủ quản trị: menu điều hướng các chức năng admin.
 */
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';

const CARDS = [
  { icon: '👥', title: 'Quản lý nhân viên',  desc: 'Tạo, chỉnh sửa, phân quyền tài khoản', to: ROUTES.ADMIN_USERS },
  { icon: '💊', title: 'Danh mục thuốc & CLS', desc: 'Thuốc, dịch vụ cận lâm sàng, giá cả', to: ROUTES.ADMIN_CATALOG },
  { icon: '⚙️', title: 'Cấu hình cơ sở',     desc: 'Tên phòng khám, BHYT, hoá đơn...', to: ROUTES.ADMIN_CONFIG },
];

export default function AdminHomePage() {
  const navigate = useNavigate();
  return (
    <div className="page-container">
      <h1 style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: 24 }}>⚙️ Quản trị hệ thống</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
        {CARDS.map(c => (
          <button key={c.to} onClick={() => navigate(c.to)}
            style={{
              background: '#fff', border: '1px solid var(--clr-gray-100)',
              borderRadius: 14, padding: '22px 20px', textAlign: 'left',
              cursor: 'pointer', boxShadow: 'var(--shadow-sm)',
              transition: 'box-shadow .15s, transform .15s',
              fontFamily: 'var(--font-sans)',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-lg)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-sm)'; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}
          >
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>{c.icon}</div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--clr-gray-900)', marginBottom: 6 }}>{c.title}</div>
            <div style={{ fontSize: '.875rem', color: 'var(--clr-gray-500)' }}>{c.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
