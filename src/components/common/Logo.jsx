export default function Logo({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="logo-mark">
      <rect width="32" height="32" rx="8" fill="var(--primary)" />
      <path d="M16 6.5 25 11v10l-9 4.5L7 21V11z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <path d="M7 11l9 4.5 9-4.5M16 15.5v10" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
