export default function EmptyState({ icon = '📭', title = 'Không có dữ liệu', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center text-gray-500">
      <div className="text-5xl mb-4 opacity-50">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">{title}</h3>
      {description && <p className="text-sm max-w-xs leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
