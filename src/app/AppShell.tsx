/**
 * AppShell — Layout shell: Sidebar + Topbar + content area.
 *
 * Thiết kế:
 * - Sidebar 220px dark, compact — icon+label, active indicator bên trái
 * - Topbar 52px white, sticky — breadcrumb + user actions
 * - Mobile: sidebar ẩn, toggle button hiện
 */
import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@features/auth/AuthContext';
import { ROUTES } from './routes';

interface NavItem {
  label:      string;
  icon:       string;
  to:         string;
  permission: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tiếp đón',   icon: '🏥', to: ROUTES.RECEPTION,    permission: 'reception' },
  { label: 'Hàng chờ',   icon: '🎫', to: ROUTES.QUEUE,        permission: 'queue'     },
  { label: 'Phòng khám', icon: '🩺', to: ROUTES.DOCTOR,       permission: 'doctor'    },
  { label: 'Thu ngân',   icon: '💰', to: ROUTES.CASHIER,      permission: 'cashier'   },
  { label: 'Lịch hẹn',  icon: '📅', to: ROUTES.APPOINTMENTS, permission: 'reception' },
  { label: 'Quản trị',   icon: '⚙️',  to: ROUTES.ADMIN,        permission: 'admin'     },
];

export default function AppShell() {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    toast.success('Đã đăng xuất');
    navigate(ROUTES.LOGIN, { replace: true });
  };

  const visibleItems = NAV_ITEMS.filter(item => can(item.permission));
  const initials = (user?.full_name ?? user?.username ?? '?')[0]?.toUpperCase() ?? '?';

  return (
    <div className="app-shell">

      {/* ── Mobile overlay ─────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,.45)',
            backdropFilter: 'blur(2px)',
            zIndex: 'calc(var(--z-sidebar) - 1)' as never,
          }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────── */}
      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} role="navigation" aria-label="Main navigation">

        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon" aria-hidden="true">✚</div>
          <div style={{ overflow: 'hidden' }}>
            <div className="sidebar-brand-name">Thiện Nhân</div>
            <div className="sidebar-brand-sub">Phòng Khám Đa Khoa</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          <NavLink
            to={ROUTES.HOME}
            end
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            onClick={() => setSidebarOpen(false)}
          >
            <span className="sidebar-item-icon" aria-hidden="true">🏠</span>
            Trang chủ
          </NavLink>

          {visibleItems.length > 0 && (
            <>
              <div className="sidebar-section-title">Nghiệp vụ</div>
              {visibleItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="sidebar-item-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </>
          )}

          <div className="sidebar-section-title" style={{ marginTop: 12 }}>Công cụ</div>
          <a
            href={ROUTES.KIOSK}
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-item"
          >
            <span className="sidebar-item-icon" aria-hidden="true">📟</span>
            Kiosk lấy số
          </a>
          <a
            href={ROUTES.DISPLAY}
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-item"
          >
            <span className="sidebar-item-icon" aria-hidden="true">📺</span>
            Màn hình LED
          </a>
        </nav>

        {/* Footer: user + logout */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar" aria-hidden="true">{initials}</div>
            <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <div className="sidebar-user-name truncate">
                {user?.full_name ?? user?.username}
              </div>
              <div className="sidebar-user-role truncate">
                {user?.role}{user?.clinic_room ? ` · ${user.clinic_room}` : ''}
              </div>
            </div>
          </div>
          <button
            className="sidebar-item"
            onClick={handleLogout}
            style={{ color: 'rgba(248,113,113,.8)' }}
          >
            <span className="sidebar-item-icon" aria-hidden="true">🚪</span>
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── Topbar ─────────────────────────────────────────────────── */}
      <header className="topbar">
        {/* Mobile toggle */}
        <button
          className="btn btn-ghost btn-icon btn-sm"
          style={{ display: 'none' }}
          id="sidebar-toggle"
          onClick={() => setSidebarOpen(v => !v)}
          aria-label="Mở menu"
          aria-expanded={sidebarOpen}
        >
          ☰
        </button>

        {/* Breadcrumb / page title portal */}
        <div className="topbar-title" id="page-title" />
        <div className="topbar-actions" id="topbar-actions" />
      </header>

      {/* ── Main content ───────────────────────────────────────────── */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
