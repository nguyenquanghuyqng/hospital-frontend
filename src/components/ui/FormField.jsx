/**
 * FormField – wraps label + input/select/textarea + error message
 *
 * Props:
 *   label      – string
 *   required   – bool
 *   error      – string | undefined
 *   hint       – string | undefined
 *   children   – the actual <input>, <select>, <textarea>
 */
export default function FormField({ label, required, error, hint, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
