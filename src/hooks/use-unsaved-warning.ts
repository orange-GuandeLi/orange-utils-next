"use client"

import { useEffect, useId } from "react"
import { useNavigationBlocker } from "@/contexts/NavigationBlockerContext"

/**
 * 标记当前组件有未保存的更改，阻止离开页面。
 *
 * 用法：`useUnsavedWarning(resource.dirty)`
 */
export function useUnsavedWarning(dirty: boolean) {
  const id = useId()
  const { setDirty } = useNavigationBlocker()

  useEffect(() => {
    setDirty(id, dirty)
    return () => setDirty(id, false)
  }, [dirty, id, setDirty])
}
