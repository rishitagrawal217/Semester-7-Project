import { useEffect, useRef, useState } from 'react'

/** Counts up (or down) to `value` with an ease-out curve whenever it changes. */
export default function AnimatedNumber({ value, decimals = 0, suffix = '', duration = 900 }) {
  const [display, setDisplay] = useState(0)
  const current = useRef(0)

  useEffect(() => {
    const target = Number(value) || 0
    const begin = current.current
    const start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      current.current = begin + (target - begin) * eased
      setDisplay(current.current)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])

  return (
    <>
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </>
  )
}
