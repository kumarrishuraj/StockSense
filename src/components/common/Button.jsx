import { Spinner } from './Loading'

// variant: primary | secondary | ghost | danger | success
export default function Button({
  variant = 'secondary',
  size,
  loading = false,
  icon: Icon,
  type = 'button',
  className = '',
  disabled,
  children,
  ...props
}) {
  const classes = ['btn', `btn-${variant}`, size && `btn-${size}`, !children && 'btn-icon', className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={classes} {...props} disabled={disabled || loading} aria-busy={loading}>
      {loading ? <Spinner size={16} /> : Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  )
}
