import { cloneElement, isValidElement, useId } from 'react'

// Label + control + hint/error. The control (the single child) gets a generated id.
export default function Field({ label, hint, error, required, className = '', children }) {
  const generatedId = useId()
  const id = (isValidElement(children) && children.props.id) || generatedId
  const control = isValidElement(children) ? cloneElement(children, { id }) : children
  return (
    <div className={`field ${className}`}>
      {label && (
        <label htmlFor={id}>
          {label}
          {required && (
            <span className="required" aria-hidden="true">
              {' '}
              *
            </span>
          )}
        </label>
      )}
      {control}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </div>
  )
}
