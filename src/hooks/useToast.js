import { useContext } from 'react'
import { ToastContext } from '../context/contexts'

export function useToast() {
  return useContext(ToastContext)
}
