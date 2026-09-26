import { useContext } from 'react'
import { ReferenceDataContext } from '../context/contexts'

export function useReferenceData() {
  return useContext(ReferenceDataContext)
}
