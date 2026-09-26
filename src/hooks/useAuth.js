import { useContext } from 'react'
import { AuthContext } from '../context/contexts'

export function useAuth() {
  return useContext(AuthContext)
}
