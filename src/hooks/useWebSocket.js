import { useCallback, useEffect, useRef, useState } from 'react'

const WS_BASE =
  `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/api/v1/queue/ws`

const RECONNECT_BASE_DELAY = 3_000
const MAX_RECONNECTS = 10
const PING_INTERVAL = 25_000

/**
 * useWebSocket('display' | 'kiosk' | 'reception')
 *
 * Returns:
 *   status  – 'connecting' | 'connected' | 'disconnected'
 *   lastMsg – latest parsed message object { type, data }
 *   send    – fn(data) to send raw data
 */
export function useWebSocket(room) {
  const [status, setStatus] = useState('disconnected')
  const [lastMsg, setLastMsg] = useState(null)

  const wsRef = useRef(null)
  const reconnectsRef = useRef(0)
  const reconnectTimerRef = useRef(null)
  const pingTimerRef = useRef(null)
  const intentionalRef = useRef(false)
  // Stable handlers map: event type → Set of callbacks
  const handlersRef = useRef({})

  const stopPing = () => {
    clearInterval(pingTimerRef.current)
    pingTimerRef.current = null
  }

  const startPing = (ws) => {
    pingTimerRef.current = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('ping')
    }, PING_INTERVAL)
  }

  const connect = useCallback(() => {
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    )
      return

    intentionalRef.current = false
    setStatus('connecting')

    const ws = new WebSocket(`${WS_BASE}/${room}`)
    wsRef.current = ws

    ws.onopen = () => {
      reconnectsRef.current = 0
      setStatus('connected')
      startPing(ws)
    }

    ws.onmessage = ({ data }) => {
      let msg
      try {
        msg = JSON.parse(data)
      } catch {
        msg = { type: data, data: null }
      }
      if (msg === 'pong' || msg?.type === 'pong') return

      setLastMsg(msg)

      // Dispatch to registered handlers
      const type = msg?.type
      if (type) {
        ;(handlersRef.current[type] || []).forEach((fn) => {
          try { fn(msg.data) } catch (e) { console.error(e) }
        })
      }
      ;(handlersRef.current['*'] || []).forEach((fn) => {
        try { fn(msg) } catch (e) { console.error(e) }
      })
    }

    ws.onerror = () => { /* onclose will fire */ }

    ws.onclose = () => {
      stopPing()
      setStatus('disconnected')
      if (
        !intentionalRef.current &&
        reconnectsRef.current < MAX_RECONNECTS
      ) {
        const delay =
          RECONNECT_BASE_DELAY * Math.min(reconnectsRef.current + 1, 4)
        reconnectTimerRef.current = setTimeout(() => {
          reconnectsRef.current++
          connect()
        }, delay)
      }
    }
  }, [room])

  // Subscribe to a specific WS event type
  const on = useCallback((type, fn) => {
    if (!handlersRef.current[type]) handlersRef.current[type] = []
    handlersRef.current[type].push(fn)
    return () => {
      handlersRef.current[type] = (handlersRef.current[type] || []).filter(
        (f) => f !== fn,
      )
    }
  }, [])

  const send = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data))
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      intentionalRef.current = true
      clearTimeout(reconnectTimerRef.current)
      stopPing()
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  return { status, lastMsg, send, on }
}
