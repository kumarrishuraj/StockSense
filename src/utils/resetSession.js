// State shared by the forgot-password -> verify-otp -> reset-password pages.
// sessionStorage keeps it across a refresh but not beyond the browser tab.
const KEY = 'stocksense.passwordReset'

export function getResetSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null') || {}
  } catch {
    return {}
  }
}

export function updateResetSession(values) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...getResetSession(), ...values }))
  } catch {
    // ignore: the flow still works within the current page
  }
}

export function clearResetSession() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
