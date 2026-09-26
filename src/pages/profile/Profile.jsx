import { KeyRound, Save } from 'lucide-react'
import { useState } from 'react'
import Alert from '../../components/common/Alert'
import Button from '../../components/common/Button'
import Field from '../../components/common/Field'
import PageHeader from '../../components/common/PageHeader'
import PasswordInput from '../../components/common/PasswordInput'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { authService } from '../../services/authService'
import { ROLE_LABELS } from '../../utils/constants'
import { formatDate, initials } from '../../utils/format'
import { passwordProblem } from '../../utils/validation'

function ProfileForm() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [name, setName] = useState(user.name)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters.')
      return
    }
    setBusy(true)
    setError('')
    try {
      setUser(await authService.updateProfile({ name: name.trim() }))
      toast.success('Profile updated.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Full name">
        <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
      </Field>
      <Field label="Email" hint="Email is your login and can't be changed here.">
        <input className="input" value={user.email} disabled />
      </Field>
      <Field label="Role">
        <input className="input" value={ROLE_LABELS[user.role] || user.role} disabled />
      </Field>
      <div>
        <Button type="submit" variant="primary" icon={Save} loading={busy} disabled={name.trim() === user.name}>
          Save profile
        </Button>
      </div>
    </form>
  )
}

function PasswordForm() {
  const { startSession } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }))
  const problem = form.next ? passwordProblem(form.next) : ''
  const mismatch = form.confirm && form.confirm !== form.next ? 'Passwords do not match.' : ''

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      // Other sessions are signed out; this one continues with a fresh token.
      startSession(await authService.changePassword(form.current, form.next))
      setForm({ current: '', next: '', confirm: '' })
      toast.success('Password changed. Other sessions have been signed out.')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={submit} noValidate>
      {error && <Alert tone="danger">{error}</Alert>}
      <Field label="Current password">
        <PasswordInput autoComplete="current-password" value={form.current} onChange={set('current')} />
      </Field>
      <Field label="New password" error={problem} hint="At least 8 characters with a letter and a number.">
        <PasswordInput autoComplete="new-password" value={form.next} onChange={set('next')} />
      </Field>
      <Field label="Confirm new password" error={mismatch}>
        <PasswordInput autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />
      </Field>
      <div>
        <Button
          type="submit"
          variant="primary"
          icon={KeyRound}
          loading={busy}
          disabled={!form.current || !form.next || Boolean(problem) || form.confirm !== form.next}
        >
          Change password
        </Button>
      </div>
    </form>
  )
}

export default function Profile() {
  const { user } = useAuth()
  return (
    <div className="page">
      <PageHeader title="Profile" description="Your account details and password." />
      <div className="profile-hero card">
        <span className="avatar avatar-lg">{initials(user.name)}</span>
        <div>
          <h2>{user.name}</h2>
          <p>
            {user.email} · {ROLE_LABELS[user.role] || user.role} · Member since {formatDate(user.created_at)}
          </p>
        </div>
      </div>
      <div className="two-column">
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Account details</h2>
            </div>
          </div>
          <div className="card-body">
            <ProfileForm />
          </div>
        </section>
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Change password</h2>
              <p>You stay logged in here; other sessions are signed out.</p>
            </div>
          </div>
          <div className="card-body">
            <PasswordForm />
          </div>
        </section>
      </div>
    </div>
  )
}
