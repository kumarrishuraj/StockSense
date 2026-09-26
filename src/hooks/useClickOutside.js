import { useEffect, useRef } from 'react'

// Calls onOutside when a pointer-down or Escape happens outside `ref` while `active`.
export function useClickOutside(ref, onOutside, active = true) {
  const handlerRef = useRef(onOutside)
  useEffect(() => {
    handlerRef.current = onOutside
  })

  useEffect(() => {
    if (!active) return undefined
    const onPointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) handlerRef.current()
    }
    const onKeyDown = (event) => {
      if (event.key === 'Escape') handlerRef.current()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ref, active])
}
