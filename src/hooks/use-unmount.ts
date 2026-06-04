import { useEffect, useEffectEvent } from "react"

/**
 * Hook that executes a callback when the component unmounts.
 *
 * @param callback Function to be called on component unmount
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useUnmount = (callback: (...args: Array<any>) => any) => {
  const onUnmount = useEffectEvent(callback)

  useEffect(() => () => onUnmount(), [])
}

export default useUnmount
