/* eslint-disable react-hooks/immutability -- Radix UI 风格的 ref 合并：调用者是 React 内部 ref 回调 */
"use client"

import { useCallback, useRef } from "react"

// basically Exclude<React.ClassAttributes<T>["ref"], string>
type UserRef<T> = ((instance: T | null) => void) | React.RefObject<T | null> | null | undefined

const updateRef = <T>(ref: NonNullable<UserRef<T>>, value: T | null) => {
  if (typeof ref === "function") {
    ref(value)
  } else if (ref && typeof ref === "object" && "current" in ref) {
    // Safe assignment without MutableRefObject
    ;(ref as { current: T | null }).current = value
  }
}

export const useComposedRef = <T extends HTMLElement>(
  libRef: React.RefObject<T | null>,
  userRef: UserRef<T>,
) => {
  const prevUserRef = useRef<UserRef<T>>(null)

  // Radix UI 风格的 ref 合并：调用者是 React 内部 ref 回调，实例由 React 提供
  return useCallback(
    (instance: T | null) => {
      if (libRef && "current" in libRef) {
        ;(libRef as { current: T | null }).current = instance
      }

      if (prevUserRef.current) {
        updateRef(prevUserRef.current, null)
      }

      prevUserRef.current = userRef

      if (userRef) {
        updateRef(userRef, instance)
      }
    },
    [libRef, userRef],
  )
}

export default useComposedRef
