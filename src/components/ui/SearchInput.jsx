import { Search, X } from 'lucide-react'

export default function SearchInput({ value, onChange, placeholder = 'Tìm kiếm…', className = '' }) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search size={16} className="absolute left-3 text-gray-400 pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="form-control pl-9 pr-8"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2.5 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Xoá"
        >
          <X size={14} />
        </button>
      )}
    </div>
  )
}
