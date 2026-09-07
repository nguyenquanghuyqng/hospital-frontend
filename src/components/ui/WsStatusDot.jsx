const CONFIG = {
  connected:    { dot: 'bg-emerald-400 ws-dot-connected', label: 'Đã kết nối' },
  connecting:   { dot: 'bg-amber-400 animate-pulse',      label: 'Đang kết nối…' },
  disconnected: { dot: 'bg-red-400',                      label: 'Mất kết nối' },
}

export default function WsStatusDot({ status }) {
  const cfg = CONFIG[status] ?? CONFIG.disconnected
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
      <span className="text-white/70">{cfg.label}</span>
    </div>
  )
}
