import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'sonner'

interface UseOptimizedDataOptions<T> {
  url: string
  defaultData?: T
  pollInterval?: number
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  enabled?: boolean
}

export function useOptimizedData<T>({
  url,
  defaultData,
  pollInterval,
  onSuccess,
  onError,
  enabled = true
}: UseOptimizedDataOptions<T>) {
  const [data, setData] = useState<T | undefined>(defaultData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    if (!enabled) return
    
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      setData(result)
      onSuccess?.(result)
    } catch (err) {
      const error = err as Error
      setError(error)
      onError?.(error)
      toast.error(`Failed to fetch data: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [url, enabled, onSuccess, onError])

  const refresh = useCallback(() => {
    return fetchData()
  }, [fetchData])

  useEffect(() => {
    fetchData()

    if (pollInterval && enabled) {
      const interval = setInterval(fetchData, pollInterval)
      return () => clearInterval(interval)
    }
  }, [fetchData, pollInterval, enabled])

  return useMemo(() => ({
    data,
    loading,
    error,
    refresh,
    setData
  }), [data, loading, error, refresh])
}

// Debounce hook for search inputs
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Local storage hook with SSR support
export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue
    }
    
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error(`Error loading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore))
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }, [key, storedValue])

  return [storedValue, setValue] as const
}