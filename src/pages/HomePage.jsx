import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Monitor, Ticket, ClipboardList, Activity, Users, Clock, CheckCircle, AlertCircle } from 'lucide-react'
import { queueApi, receptionApi } from '@/services/api'
import { today } from '@/utils/format'
import StatCard from '@/components/ui/StatCard'

const NAV_CARDS = [
  {
    to: '/display',
    icon: Monitor,
    iconBg: 'bg-blue-100 text-blue-600',
    cardBorder: 'hover:border-blue-400',
    title: 'Màn hình hiển thị',
    desc: 'Bảng LED hiển thị số thứ tự đang được gọi và danh sách chờ theo thời gian thực.',
    badge: 'DISPLAY',
    badgeCls: 'bg-blue-50 text-blue-600',
  },
  {
    to: '/kiosk',
    icon: Ticket,
    iconBg: 'bg-emerald-100 text-emerald-600',
    cardBorder: 'hover:border-emerald-400',
    title: 'Kiosk lấy số',
    desc: 'Bệnh nhân tự lấy số thứ tự, xem lượt đang chờ và nhận thông báo khi đến lượt.',
    badge: 'KIOSK',
    badgeCls: 'bg-emerald-50 text-emerald-600',
  },
  {
    to: '/reception',
    icon: ClipboardList,
    iconBg: 'bg-violet-100 text-violet-600',
    cardBorder: 'hover:border-violet-400',
    title: 'Bàn tiếp nhận',
    desc: 'Quản lý danh sách bệnh nhân, gọi số, tiếp nhận lượt khám và xử lý hàng đợi.',
    badge: 'RECEPTION',
    badgeCls: 'bg-violet-50 text-violet-600',
  },
]

export default function HomePage() {
  const { data: summary } = useQuery({
    queryKey: ['queue-summary', today()],
    queryFn: () => queueApi.summary({ issue_date: today() }),
    refetchInterval: 30_000,
  })

  const { data: stats } = useQuery({
    queryKey: ['reception-stats'],
    queryFn: () => receptionApi.stats(),
    refetchInterval: 30_000,
  })

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white">
        {/* decorative grid */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <div className="relative max-w-[1400px] mx-auto px-6 py-20">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
              <Activity size={32} />
            </div>
            <div>
              <div className="text-white/70 text-sm font-medium uppercase tracking-widest mb-1">
                Hospital Management
              </div>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight">
                Hệ thống Quản lý
                <br />
                Hàng đợi Bệnh viện
              </h1>
            </div>
          </div>
          <p className="text-white/80 text-lg max-w-xl leading-relaxed ml-20">
            Số hoá quy trình tiếp nhận bệnh nhân — từ lấy số thứ tự, gọi khám đến hoàn thành
            lượt khám, tất cả theo thời gian thực.
          </p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Clock size={22} className="text-amber-500" />}
            iconBg="bg-amber-50"
            value={summary?.waiting ?? '—'}
            label="Đang chờ"
            valueColor="text-amber-600"
          />
          <StatCard
            icon={<AlertCircle size={22} className="text-red-500" />}
            iconBg="bg-red-50"
            value={summary?.calling ?? '—'}
            label="Đang gọi"
            valueColor="text-red-600"
          />
          <StatCard
            icon={<Users size={22} className="text-emerald-500" />}
            iconBg="bg-emerald-50"
            value={summary?.serving ?? '—'}
            label="Đang phục vụ"
            valueColor="text-emerald-600"
          />
          <StatCard
            icon={<CheckCircle size={22} className="text-gray-400" />}
            iconBg="bg-gray-50"
            value={summary?.done ?? '—'}
            label="Hoàn thành hôm nay"
            valueColor="text-gray-700"
          />
        </div>
      </section>

      {/* Navigation cards */}
      <section className="max-w-[1400px] mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Chọn chức năng</h2>
        <p className="text-gray-500 mb-8">Điều hướng đến giao diện phù hợp với vai trò của bạn.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {NAV_CARDS.map(({ to, icon: Icon, iconBg, cardBorder, title, desc, badge, badgeCls }) => (
            <Link
              key={to}
              to={to}
              className={`group bg-white rounded-2xl p-8 shadow-card border-2 border-transparent
                          ${cardBorder} transition-all duration-300
                          hover:-translate-y-1 hover:shadow-xl flex flex-col gap-5`}
            >
              <div className="flex items-start justify-between">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${iconBg}`}>
                  <Icon size={28} />
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full tracking-wider ${badgeCls}`}>
                  {badge}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                  {title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </div>
              <div className="mt-auto flex items-center text-primary-600 text-sm font-semibold gap-1
                              opacity-0 group-hover:opacity-100 transition-opacity">
                Mở giao diện →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Today reception stats */}
      {stats && (
        <section className="max-w-[1400px] mx-auto px-6 pb-12">
          <div className="bg-white rounded-2xl shadow-card p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-4 flex items-center gap-2">
              <ClipboardList size={20} className="text-violet-500" />
              Thống kê tiếp nhận hôm nay
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Tổng tiếp nhận', value: stats.total ?? 0, color: 'text-gray-800' },
                { label: 'Chờ tiếp nhận',  value: stats.pending ?? 0,    color: 'text-amber-600' },
                { label: 'Đã tiếp nhận',   value: stats.checked_in ?? 0, color: 'text-emerald-600' },
                { label: 'Hoàn thành',     value: stats.completed ?? 0,  color: 'text-gray-500' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center py-4 px-2 rounded-xl bg-gray-50">
                  <div className={`text-3xl font-black tabular-nums ${color}`}>{value}</div>
                  <div className="text-xs text-gray-500 mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
