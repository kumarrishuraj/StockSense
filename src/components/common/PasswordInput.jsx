import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'

export default function PasswordInput({ id, ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="input-with-action">
      <input id={id} type={visible ? 'text' : 'password'} className="input" {...props} />
      <button
        type="button"
        className="icon-btn"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
}
