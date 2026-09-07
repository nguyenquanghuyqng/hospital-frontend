import { Link, NavLink, useLocation } from 'react-router-dom'
import { Activity, Home, Monitor, Ticket, ClipboardList } from 'lucide-react'
import { Toaster } from 'react-hot-toast'

const NAV_LINKS = [
  { to: '/',           label: 'Trang chủ',   icon: Home },
  { to: '/display',    label: 'Màn hình',     icon: Monitor },
  { to: '/kiosk',      label: 'Kiosk',        icon: Ticket },
  { to: '/reception',  label: 'Tiếp nhận',    icon: ClipboardList },
]

export default function Layout({ children }) {
  const location = useLocation()

  // Display page uses its own full-screen layout (no navbar)
  const isDisplay = location.pathname === '/display'
  if (isDisplay) return <>{children}</>

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar */}
      <header className="bg-primary-600 text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center justify-between h-16 gap-4">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3 font-bold text-xl whitespace-nowrap">
            <span className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <Activity size={20} />
            </span>
            <span className="hidden sm:block">Hospital Queue</span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {NAV_LINKS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-100
                   ${isActive
                     ? 'bg-white/20 text-white'
                     : 'text-white/75 hover:bg-white/10 hover:text-white'
                   }`
                }
              >
                <Icon size={16} />
                <span className="hidden md:block">{label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Hospital name */}
          <span className="hidden lg:block text-white/60 text-sm">
            Hệ thống Quản lý Hàng đợi
          </span>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">{children}</main>

      {/* Toast container */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: { fontSize: '0.875rem', maxWidth: '380px' },
          success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
          error:   { iconTheme: { primary: '#EF4444', secondary: '#fff' }, duration: 6000 },
        }}
      />
    </div>
  )
}
