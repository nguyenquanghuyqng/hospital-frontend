export default function StatCard({ icon, iconBg = 'bg-blue-50', value, label, valueColor = 'text-gray-900', trend }) {
  return (
    <div className="stat-card">
      <div className={`w-13 h-13 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-3xl font-bold leading-none tabular-nums ${valueColor}`}>
          {value ?? '—'}
        </div>
        <div className="text-sm text-gray-500 mt-0.5">{label}</div>
        {trend !== undefined && (
          <div className="text-xs text-gray-400 mt-1">{trend}</div>
        )}
      </div>
    </div>
  )
}
