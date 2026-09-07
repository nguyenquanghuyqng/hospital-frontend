import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Ticket, RefreshCw, Clock, Users, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { queueApi } from '@/services/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { today, fmtTime } from '@/utils/format'
import WsStatusDot from '@/components/ui/WsStatusDot'
import Spinner from '@/components/ui/Spinner'

// ── Ticket result screen ──────────────────────────────────────
function TicketResult({ ticket, onReset }) {
  const [seconds, setSeconds] = useState(15)

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s - 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (seconds <= 0) onReset()
  }, [seconds, onReset])

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center text-4xl">
        ✅
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Lấy số thành công!</h2>
        <p className="text-gray-500 text-sm mt-1">Vui lòng chú ý màn hình gọi số</p>
      </div>

      {/* Big ticket */}
      <div className="relative w-full max-w-xs bg-gradient-to-br from-primary-600 to-primary-800
                       rounded-2xl p-8 text-white shadow-xl overflow-hidden">
        {/* punch holes */}
        <div className="absolute w-8 h-8 bg-gray-50 rounded-full -left-4 top-1/2 -translate-y-1/2" />
        <div className="absolute w-8 h-8 bg-gray-50 rounded-full -right-4 top-1/2 -translate-y-1/2" />

        <p className="text-white/70 text-xs uppercase tracking-widest mb-3">Số thứ tự của bạn</p>
        <p className="text-8xl font-black tabular-nums leading-none">{ticket.ticket_number}</p>
        <div className="mt-4 pt-4 border-t border-white/20 flex justify-between text-sm text-white/80">
          <span>Ngày: {today()}</span>
          <span>Giờ: {fmtTime(ticket.created_at ?? new Date().toISOString())}</span>
        </div>
      </div>

      <p className="text-gray-400 text-sm">
        Màn hình tự động về trang chủ sau <span className="font-bold text-gray-700">{seconds}s</span>
      </p>

      <button className="btn btn-outline w-full" onClick={onReset}>
        Lấy số mới
      </button>
    </div>
  )
}

// ── Queue summary mini-board ──────────────────────────────────
function QueueBoard({ summary, waitingList }) {
  if (!summary) return null
  return (
    <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
      <h3 className="font-bold text-gray-700 text-sm uppercase tracking-wide">
        Tình trạng hàng đợi hôm nay
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Chờ',     value: summary.waiting ?? 0, color: 'text-amber-600',  bg: 'bg-amber-50'   },
          { label: 'Đang gọi',value: summary.calling ?? 0, color: 'text-red-600',    bg: 'bg-red-50'     },
          { label: 'Hoàn thành',value: summary.done ?? 0,  color: 'text-gray-500',   bg: 'bg-gray-100'   },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
            <div className={`text-2xl font-black tabular-nums ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {summary.current_calling && (
        <div className="flex items-center justify-between bg-red-50 rounded-xl px-4 py-3">
          <span className="text-sm text-red-700 font-medium">Đang gọi:</span>
          <span className="text-2xl font-black text-red-600 tabular-nums">
            {summary.current_calling.ticket_number}
          </span>
        </div>
      )}

      {waitingList && waitingList.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Số đang chờ trước bạn</p>
          <div className="flex flex-wrap gap-1.5">
            {waitingList.slice(0, 20).map((t) => (
              <span
                key={t.id}
                className="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-sm font-semibold text-gray-700"
              >
                {t.ticket_number}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function KioskPage() {
  const [ticket, setTicket] = useState(null)
  const qc = useQueryClient()
  const { status: wsStatus, on } = useWebSocket('kiosk')

  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['kiosk-summary', today()],
    queryFn: () => queueApi.summary({ issue_date: today() }),
    refetchInterval: 30_000,
  })

  const { data: waitingList, refetch: refetchWaiting } = useQuery({
    queryKey: ['kiosk-waiting', today()],
    queryFn: () => queueApi.waiting({ issue_date: today() }),
    refetchInterval: 30_000,
  })

  // Live updates via WS
  useEffect(() => {
    const offNew = on('new_ticket', () => {
      refetchSummary()
      refetchWaiting()
    })
    const offCalling = on('calling', (data) => {
      if (data?.ticket_number) {
        toast(`🔔 Mời số ${data.ticket_number} — Quầy ${data.counter_number}`, {
          duration: 6000,
          icon: '📢',
        })
      }
      refetchSummary()
    })
    return () => { offNew(); offCalling() }
  }, [on, refetchSummary, refetchWaiting])

  const takeMutation = useMutation({
    mutationFn: () => queueApi.takeTicket({}),
    onSuccess: (data) => {
      setTicket(data)
      qc.invalidateQueries({ queryKey: ['kiosk-summary'] })
      qc.invalidateQueries({ queryKey: ['kiosk-waiting'] })
    },
    onError: (err) => toast.error(err.message),
  })

  const handleReset = () => setTicket(null)

  return (
    <div className="kiosk-page min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50
                     flex flex-col">
      {/* Header */}
      <header className="bg-primary-600 text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🏥</span>
          <span className="font-bold text-lg">Kiosk Lấy Số Thứ Tự</span>
        </div>
        <WsStatusDot status={wsStatus} />
      </header>

      {/* Body */}
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6">
          {ticket ? (
            <div className="bg-white rounded-3xl shadow-xl p-8">
              <TicketResult ticket={ticket} onReset={handleReset} />
            </div>
          ) : (
            <>
              {/* Take ticket card */}
              <div className="bg-white rounded-3xl shadow-xl p-8 text-center space-y-6">
                <div className="w-24 h-24 rounded-full bg-primary-50 flex items-center justify-center
                                 mx-auto text-5xl">
                  <Ticket size={48} className="text-primary-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold text-gray-900">Lấy số thứ tự</h1>
                  <p className="text-gray-500 mt-2">
                    Nhấn nút bên dưới để nhận số thứ tự và vào hàng chờ
                  </p>
                </div>

                {/* Stats row */}
                <div className="flex justify-center gap-6 text-sm">
                  <div className="flex items-center gap-1.5 text-amber-600">
                    <Clock size={16} />
                    <span className="font-semibold">{summary?.waiting ?? '—'}</span>
                    <span className="text-gray-400">đang chờ</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle size={16} />
                    <span className="font-semibold">{summary?.done ?? '—'}</span>
                    <span className="text-gray-400">hoàn thành</span>
                  </div>
                </div>

                <button
                  className="btn btn-primary btn-xl w-full text-xl py-5"
                  onClick={() => takeMutation.mutate()}
                  disabled={takeMutation.isPending}
                >
                  {takeMutation.isPending ? (
                    <><Spinner size="sm" /> Đang xử lý…</>
                  ) : (
                    <><Ticket size={24} /> Lấy số ngay</>
                  )}
                </button>

                <button
                  className="btn btn-ghost w-full text-sm gap-1.5"
                  onClick={() => { refetchSummary(); refetchWaiting() }}
                >
                  <RefreshCw size={14} /> Làm mới
                </button>
              </div>

              {/* Queue board */}
              <QueueBoard summary={summary} waitingList={waitingList} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
