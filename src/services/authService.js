import { api, request } from './api'

const publicPost = (path, body) => request(path, { method: 'POST', body, auth: false })

export const authService = {
  login: (email, password) => publicPost('/auth/login', { email, password }),
  signup: (data) => publicPost('/auth/signup', data),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
  changePassword: (currentPassword, newPassword) =>
    api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
  forgotPassword: (email) => publicPost('/auth/forgot-password', { email }),
  verifyOtp: (email, otp) => publicPost('/auth/verify-otp', { email, otp }),
  resetPassword: (resetToken, newPassword) =>
    publicPost('/auth/reset-password', { reset_token: resetToken, new_password: newPassword }),
}
