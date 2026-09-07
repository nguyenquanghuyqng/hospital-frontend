import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null

  const pages = []
  const range = new Set([1, totalPages])
  for (let i = Math.max(1, page - 2); i <= Math.min(totalPages, page + 2); i++) range.add(i)
  const sorted = [...range].sort((a, b) => a - b)

  let prev = 0
  for (const p of sorted) {
    if (p - prev > 1) pages.push('...')
    pages.push(p)
    prev = p
  }

  return (
    <div className="flex items-center gap-1">
      <PageBtn disabled={page === 1} onClick={() => onChange(page - 1)} aria-label="Trang trước">
        <ChevronLeft size={16} />
      </PageBtn>

      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="w-9 h-9 flex items-center justify-center text-gray-400 text-sm">
            …
          </span>
        ) : (
          <PageBtn key={p} active={p === page} onClick={() => onChange(p)}>
            {p}
          </PageBtn>
        ),
      )}

      <PageBtn disabled={page === totalPages} onClick={() => onChange(page + 1)} aria-label="Trang tiếp">
        <ChevronRight size={16} />
      </PageBtn>
    </div>
  )
}

function PageBtn({ children, active, disabled, onClick, ...rest }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium
                  border transition-all duration-100
                  ${active
                    ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-700 hover:border-primary-400 hover:text-primary-600'
                  }
                  disabled:opacity-40 disabled:pointer-events-none`}
      {...rest}
    >
      {children}
    </button>
  )
}
