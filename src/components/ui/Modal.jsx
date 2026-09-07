import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

/**
 * Modal
 * Props:
 *   open      – boolean
 *   onClose   – () => void
 *   title     – string | ReactNode
 *   size      – 'sm' | 'md' | 'lg' | 'xl'  (default 'md')
 *   footer    – ReactNode  (optional)
 *   children
 */
const SIZE = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({ open, onClose, title, size = 'md', footer, children }) {
  const overlayRef = useRef(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[200] flex items-center justify-center p-4
                 bg-black/40 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => { if (e.target === overlayRef.current) onClose?.() }}
    >
      <div
        className={`bg-white rounded-2xl shadow-modal w-full ${SIZE[size] ?? SIZE.md}
                    max-h-[90vh] flex flex-col animate-slide-up`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg
                       text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title = 'Xác nhận', message, danger = false, loading = false }) {
  return (
    <Modal open={open} onClose={onClose} title={`⚠️ ${title}`} size="sm">
      <p className="text-gray-700 leading-relaxed">{message}</p>
      <div className="flex justify-end gap-3 mt-6">
        <button className="btn btn-ghost" onClick={onClose} disabled={loading}>Huỷ</button>
        <button
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? 'Đang xử lý…' : 'Xác nhận'}
        </button>
      </div>
    </Modal>
  )
}
