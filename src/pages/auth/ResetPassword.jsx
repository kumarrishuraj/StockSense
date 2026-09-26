import { Check } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Alert from '../../components/common/Alert'
import Button from '../../components/common/Button'
import Field from '../../components/common/Field'
import PasswordInput from '../../components/common/PasswordInput'
import AuthLayout from '../../components/layout/AuthLayout'
import { authService } from '../../services/authService'
import { clearResetSession, getResetSession } from '../../utils/resetSession'
import { passwordProblem } from '../../utils/validation'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [session] = useState(getResetSession)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!session.resetToken) return <Navigate to="/forgot-password" replace />

  const problem = password ? passwordProblem(password) : ''
  const mismatch = confirm && confirm !== password ? 'Passwords do not match.' : ''

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const result = await authService.resetPassword(session.resetToken, password)
      clearResetSession()
      navigate('/login', { replace: true, state: { message: result.message } })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={`Code verified for ${session.email}. Set a new password to finish.`}
      footer={<Link to="/login">Back to login</Link>}
    >
      <form className="form-stack" onSubmit={submit} noValidate>
        {error && <Alert tone="danger">{error}</Alert>}
        <Field label="New password" error={problem} hint="At least 8 characters with a letter and a number.">
          <PasswordInput autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </Field>
        <Field label="Confirm new password" error={mismatch}>
          <PasswordInput autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
        </Field>
        <Button
          type="submit"
          variant="primary"
          size="lg"
          icon={Check}
          loading={busy}
          disabled={!password || Boolean(problem) || confirm !== password}
        >
          Update password
        </Button>
      </form>
    </AuthLayout>
  )
}
