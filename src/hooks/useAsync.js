import { useCallback, useEffect, useState } from 'react'

// Runs `load` whenever `deps` change and keeps the last data while reloading,
// so tables don't flash empty on every filter change.
export function useAsync(load, deps = []) {
  const [reloads, setReloads] = useState(0)
  const key = JSON.stringify([deps, reloads])
  const [result, setResult] = useState({ key: null, data: undefined, error: null })

  useEffect(() => {
    let active = true
    Promise.resolve()
      .then(load)
      .then(
        (data) => active && setResult({ key, data, error: null }),
        (error) => active && setResult((previous) => ({ key, data: previous.data, error })),
      )
    return () => {
      active = false
    }
    // `load` is recreated every render; `key` captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const reload = useCallback(() => setReloads((count) => count + 1), [])
  const setData = useCallback(
    (update) => setResult((previous) => ({ ...previous, data: typeof update === 'function' ? update(previous.data) : update })),
    [],
  )

  return {
    data: result.data,
    error: result.key === key ? result.error : null,
    loading: result.key !== key,
    reload,
    setData,
  }
}
