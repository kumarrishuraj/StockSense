import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Alert from '../../components/common/Alert'
import Button from '../../components/common/Button'
import Field from '../../components/common/Field'
import PasswordInput from '../../components/common/PasswordInput'
import AuthLayout from '../../components/layout/AuthLayout'
import { useAuth } from '../../hooks/useAuth'
import { ROLE_LABELS } from '../../utils/constants'
import { passwordProblem } from '../../utils/validation'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', role: 'manager', password: '', confirm: '' })
  const [touched, setTouched] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const problems = {
    name: form.name.trim().length < 2 ? 'Enter your full name.' : '',
    email: /^\S+@\S+\.\S+$/.test(form.email.trim()) ? '' : 'Enter a valid email address.',
    password: passwordProblem(form.password),
    confirm: form.confirm !== form.password ? 'Passwords do not match.' : '',
  }
  const invalid = Object.values(problems).some(Boolean)

  const submit = async (event) => {
    event.preventDefault()
    setTouched(true)
    if (invalid) return
    setError('')
    setBusy(true)
    try {
      await signup({ name: form.name.trim(), email: form.email.trim(), role: form.role, password: form.password })
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const show = (field) => (touched || form[field] ? problems[field] : '')

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start tracking stock across every warehouse."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form className="form-stack" onSubmit={submit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Full name" error={touched ? problems.name : ''} required>
          <input className="input" autoComplete="name" value={form.name} onChange={update('name')} />
        </Field>
        <Field label="Work email" error={touched ? problems.email : ''} required>
          <input className="input" type="email" autoComplete="email" value={form.email} onChange={update('email')} />
        </Field>
        <Field label="Role">
          <select className="input" value={form.role} onChange={update('role')}>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Password" error={show('password')} hint="At least 8 characters with a letter and a number." required>
          <PasswordInput autoComplete="new-password" value={form.password} onChange={update('password')} />
        </Field>
        <Field label="Confirm password" error={form.confirm || touched ? problems.confirm : ''} required>
          <PasswordInput autoComplete="new-password" value={form.confirm} onChange={update('confirm')} />
        </Field>
        <Button type="submit" variant="primary" size="lg" icon={UserPlus} loading={busy}>
          Create account
        </Button>
      </form>
    </AuthLayout>
  )
}
