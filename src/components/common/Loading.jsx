export function Spinner({ size = 18, label }) {
  return (
    <span className="spinner" style={{ width: size, height: size }} role={label ? 'status' : undefined}>
      {label && <span className="sr-only">{label}</span>}
    </span>
  )
}

export default function PageLoader({ label = 'Loading…' }) {
  return (
    <div className="page-loader">
      <Spinner size={28} />
      <span>{label}</span>
    </div>
  )
}
