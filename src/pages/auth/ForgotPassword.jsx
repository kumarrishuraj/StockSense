import { Mail } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Alert from '../../components/common/Alert'
import Button from '../../components/common/Button'
import Field from '../../components/common/Field'
import AuthLayout from '../../components/layout/AuthLayout'
import { authService } from '../../services/authService'
import { clearResetSession, updateResetSession } from '../../utils/resetSession'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await authService.forgotPassword(email.trim())
      clearResetSession()
      updateResetSession({
        email: email.trim(),
        message: result.message,
        devOtp: result.dev_otp,
        devMode: result.dev_mode,
        expiresInMinutes: result.expires_in_minutes,
      })
      navigate('/verify-otp')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your account email and we'll issue a 6-digit verification code."
      footer={<Link to="/login">Back to login</Link>}
    >
      <form className="form-stack" onSubmit={submit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="Email">
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" icon={Mail} loading={busy} disabled={!email.trim()}>
          Send verification code
        </Button>
      </form>
    </AuthLayout>
  )
}
