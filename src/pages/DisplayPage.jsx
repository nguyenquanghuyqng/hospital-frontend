import { useEffect, useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queueApi } from '@/services/api'
import { useWebSocket } from '@/hooks/useWebSocket'
import { today } from '@/utils/format'
import WsStatusDot from '@/components/ui/WsStatusDot'

// ── Live clock ────────────────────────────────────────────────
function useClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return time
}

// ── Calling flash animation ───────────────────────────────────
function useFlash(trigger) {
  const [flash, setFlash] = useState(false)
  useEffect(() => {
    if (!trigger) return
    setFlash(true)
    const t = setTimeout(() => setFlash(false), 2000)
    return () => clearTimeout(t)
  }, [trigger])
  return flash
}

export default function DisplayPage() {
  const clock = useClock()
  const { status: wsStatus, on } = useWebSocket('display')

  const [calling, setCalling] = useState(null)   // { ticket_number, counter_number, patient_name }
  const [summary, setSummary] = useState(null)
  const flashKey = useRef(0)
  const flash = useFlash(calling?.ticket_number)

  // Initial load
  const { data: initialSummary } = useQuery({
    queryKey: ['display-summary', today()],
    queryFn: () => queueApi.summary({ issue_date: today() }),
    refetchInterval: 60_000,
  })
  const { data: waitingTickets } = useQuery({
    queryKey: ['display-waiting', today()],
    queryFn: () => queueApi.waiting({ issue_date: today() }),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (initialSummary) setSummary(initialSummary)
  }, [initialSummary])

  // WebSocket events
  useEffect(() => {
    const offCalling = on('calling', (data) => {
      flashKey.current++
      setCalling(data)
    })
    const offUpdate = on('queue_update', (data) => {
      setSummary(data)
    })
    return () => { offCalling(); offUpdate() }
  }, [on])

  const sum = summary ?? initialSummary
  const waiting = waitingTickets ?? []

  const dateStr = clock.toLocaleDateString('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  })
  const timeStr = clock.toLocaleTimeString('vi-VN', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return (
    <div className="bg-[#0A0F1E] text-white min-h-screen flex flex-col select-none">
      {/* ── Header ── */}
      <header className="bg-gradient-to-r from-[#0D1B3E] to-[#1A237E] border-b-2 border-blue-900
                         px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl">
            🏥
          </div>
          <div>
            <div className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-0.5">
              Hệ thống Hàng đợi
            </div>
            <div className="text-blue-100 text-2xl font-extrabold uppercase tracking-wide">
              Bệnh viện — Phòng khám
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-blue-300 text-2xl font-bold font-mono tabular-nums">{timeStr}</div>
          <div className="text-blue-400 text-sm">{dateStr}</div>
          <WsStatusDot status={wsStatus} />
        </div>
      </header>

      {/* ── Main body ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px]">
        {/* Calling panel */}
        <section
          className={`flex flex-col items-center justify-center px-8 py-12 transition-colors duration-500
                       ${flash ? 'bg-red-950/30' : ''}`}
        >
          <p className="text-blue-300 text-sm font-bold uppercase tracking-[0.25em] mb-6">
            🔔 Số đang được gọi
          </p>

          {calling ? (
            <>
              <div
                key={flashKey.current}
                className="calling-number-glow text-[10rem] md:text-[13rem] font-black leading-none
                           tabular-nums animate-number-glow"
              >
                {calling.ticket_number}
              </div>
              <div className="mt-4 text-yellow-300 text-3xl font-bold">
                Quầy số {calling.counter_number}
              </div>
              {calling.patient_name && (
                <div className="mt-2 text-blue-300 text-xl">
                  {calling.patient_name}
                </div>
              )}
            </>
          ) : (
            <div className="text-blue-800 text-6xl font-black tracking-widest">- - -</div>
          )}

          {/* Serving */}
          {sum?.serving > 0 && (
            <div className="mt-10 text-blue-400 text-base">
              Đang phục vụ: <span className="text-emerald-400 font-bold">{sum.serving}</span> lượt
            </div>
          )}
        </section>

        {/* Waiting list */}
        <aside className="bg-[#0D1422] border-l border-blue-900/40 p-6 flex flex-col gap-4 overflow-y-auto">
          <div className="text-blue-300 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Đang chờ ({waiting.length})
          </div>
          {waiting.length === 0 ? (
            <p className="text-blue-800 text-sm text-center py-8">Không có lượt chờ</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {waiting.slice(0, 30).map((t) => (
                <div
                  key={t.id}
                  className={`rounded-lg py-2 px-1 text-center text-base font-bold tabular-nums
                               border transition-all
                               ${calling?.ticket_number === t.ticket_number
                                 ? 'bg-blue-900/60 border-blue-500 text-blue-300'
                                 : 'bg-[#1E2A4A] border-blue-900/50 text-gray-300'
                               }`}
                >
                  {t.ticket_number}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* ── Stats bar ── */}
      <footer className="bg-[#0D1B3E] border-t-2 border-blue-900
                          px-8 py-4 grid grid-cols-4 gap-4">
        {[
          { label: 'Chờ',          value: sum?.waiting ?? 0,  color: 'text-yellow-400' },
          { label: 'Đang gọi',     value: sum?.calling ?? 0,  color: 'text-red-400' },
          { label: 'Đang phục vụ', value: sum?.serving ?? 0,  color: 'text-emerald-400' },
          { label: 'Hoàn thành',   value: sum?.done ?? 0,     color: 'text-gray-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center">
            <div className={`text-4xl font-black tabular-nums ${color}`}>{value}</div>
            <div className="text-blue-400/70 text-xs uppercase tracking-wider mt-1">{label}</div>
          </div>
        ))}
      </footer>

      {/* ── Marquee ── */}
      <div className="bg-blue-900/60 py-2 overflow-hidden">
        <div className="flex whitespace-nowrap marquee-track">
          {[1, 2].map((k) => (
            <span key={k} className="text-blue-200 text-sm px-16">
              🏥 Chào mừng quý bệnh nhân đến khám tại cơ sở y tế của chúng tôi &nbsp;•&nbsp;
              Vui lòng chú ý lắng nghe gọi số &nbsp;•&nbsp;
              Giữ trật tự và khoảng cách khi chờ khám &nbsp;•&nbsp;
              Liên hệ quầy lễ tân để được hỗ trợ &nbsp;•&nbsp;
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
