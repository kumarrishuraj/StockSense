import { KeyRound, RotateCw } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Alert from '../../components/common/Alert'
import Button from '../../components/common/Button'
import Field from '../../components/common/Field'
import AuthLayout from '../../components/layout/AuthLayout'
import { authService } from '../../services/authService'
import { getResetSession, updateResetSession } from '../../utils/resetSession'

export default function VerifyOtp() {
  const navigate = useNavigate()
  const [session, setSession] = useState(getResetSession)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [resending, setResending] = useState(false)

  if (!session.email) return <Navigate to="/forgot-password" replace />

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await authService.verifyOtp(session.email, otp)
      updateResetSession({ resetToken: result.reset_token })
      navigate('/reset-password')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const resend = async () => {
    setError('')
    setResending(true)
    try {
      const result = await authService.forgotPassword(session.email)
      updateResetSession({ devOtp: result.dev_otp, message: result.message })
      setSession(getResetSession())
      setOtp('')
      setInfo('A new code has been issued. Previous codes no longer work.')
    } catch (err) {
      setError(err.message)
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout
      title="Enter verification code"
      subtitle={`We issued a 6-digit code for ${session.email}. It expires in ${session.expiresInMinutes || 10} minutes.`}
      footer={<Link to="/forgot-password">Use a different email</Link>}
    >
      <form className="form-stack" onSubmit={submit} noValidate>
        {session.devMode && session.devOtp && (
          <Alert
            tone="warning"
            title="Development mode"
            action={
              <Button size="sm" onClick={() => setOtp(session.devOtp)}>
                Use code
              </Button>
            }
          >
            No email/SMS service is configured, so the code is shown here (and in the server log): <strong className="otp-inline">{session.devOtp}</strong>
          </Alert>
        )}
        {session.devMode && !session.devOtp && (
          <Alert tone="info">{session.message} If you don't receive a code, check the email address.</Alert>
        )}
        {info && <Alert tone="success">{info}</Alert>}
        {error && <Alert tone="danger">{error}</Alert>}

        <Field label="Verification code">
          <input
            className="input otp-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" icon={KeyRound} loading={busy} disabled={otp.length !== 6}>
          Verify code
        </Button>
        <Button variant="ghost" icon={RotateCw} onClick={resend} loading={resending}>
          Resend code
        </Button>
      </form>
    </AuthLayout>
  )
}
