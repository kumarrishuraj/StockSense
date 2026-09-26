import { LogIn, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Alert from '../../components/common/Alert'
import Button from '../../components/common/Button'
import Field from '../../components/common/Field'
import PasswordInput from '../../components/common/PasswordInput'
import AuthLayout from '../../components/layout/AuthLayout'
import { useAuth } from '../../hooks/useAuth'

const DEMO = { email: 'admin@stocksense.io', password: 'Demo@1234' }

export default function Login() {
  const { login, notice, clearNotice } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const flash = location.state?.message

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    clearNotice()
    setBusy(true)
    try {
      await login(form.email.trim(), form.password)
      navigate(location.state?.from?.pathname || '/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to manage your inventory."
      footer={
        <>
          New to StockSense? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <form className="form-stack" onSubmit={submit} noValidate>
        {flash && <Alert tone="success">{flash}</Alert>}
        {notice && !flash && <Alert tone="info">{notice}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Email">
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={update('email')}
            placeholder="you@company.com"
            required
          />
        </Field>
        <Field label="Password">
          <PasswordInput autoComplete="current-password" value={form.password} onChange={update('password')} required />
        </Field>
        <div className="form-row-between">
          <span />
          <Link to="/forgot-password" className="text-link">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" icon={LogIn} loading={busy} disabled={!form.email || !form.password}>
          Log in
        </Button>

        <div className="demo-hint">
          <Sparkles size={16} aria-hidden="true" />
          <div>
            <strong>Demo account</strong>
            <span>
              {DEMO.email} / {DEMO.password}
            </span>
          </div>
          <Button size="sm" onClick={() => setForm(DEMO)}>
            Use demo
          </Button>
        </div>
      </form>
    </AuthLayout>
  )
}
