// Mirrors the backend rules so users see problems before submitting.
export function passwordProblem(password) {
  if (password.length < 8) return 'Use at least 8 characters.'
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'Include at least one letter and one number.'
  if (new TextEncoder().encode(password).length > 72) return 'Password is too long.'
  return ''
}
