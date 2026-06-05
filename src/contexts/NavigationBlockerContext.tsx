"use client"

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertDialog, Button } from "@heroui/react"
import { AlertTriangle } from "lucide-react"

type Ctx = { setDirty: (id: string, dirty: boolean) => void }

const NavigationBlockerContext = createContext<Ctx>({ setDirty: () => {} })

export function NavigationBlockerProvider({ children }: { children: React.ReactNode }) {
  const dirtySet = useRef(new Set<string>())
  const router = useRouter()
  const currentPath = useRef(typeof window !== "undefined" ? window.location.pathname : "")

  const [isOpen, setIsOpen] = useState(false)
  const navigateTo = useRef<string | null>(null)

  const showConfirm = useCallback((target: string) => {
    navigateTo.current = target
    setIsOpen(true)
  }, [])

  const handleConfirm = useCallback(() => {
    setIsOpen(false)
    const target = navigateTo.current
    navigateTo.current = null
    if (target) router.push(target)
  }, [router])

  const handleCancel = useCallback(() => {
    setIsOpen(false)
    navigateTo.current = null
  }, [])

  // 每次渲染后同步当前路径
  useEffect(() => {
    currentPath.current = window.location.pathname
  })

  // 浏览器关闭/刷新 — 原生提示，无法自定义
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirtySet.current.size === 0) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [])

  // 拦截 <a> 点击（Next.js <Link> 渲染为 <a>）
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dirtySet.current.size === 0) return
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

      const anchor = (e.target as HTMLElement).closest("a")
      if (!anchor) return
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) return
      if (href === currentPath.current || href.startsWith("#")) return

      e.preventDefault()
      e.stopPropagation()
      showConfirm(href)
    }
    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [showConfirm])

  // 拦截浏览器前进/后退
  useEffect(() => {
    const handlePopState = () => {
      if (dirtySet.current.size === 0) {
        currentPath.current = window.location.pathname
        return
      }
      const newPath = window.location.pathname
      history.replaceState(null, "", currentPath.current)
      showConfirm(newPath)
    }
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [showConfirm])

  const setDirty = useCallback((id: string, dirty: boolean) => {
    if (dirty) dirtySet.current.add(id)
    else dirtySet.current.delete(id)
  }, [])

  return (
    <NavigationBlockerContext.Provider value={{ setDirty }}>
      {children}

      <AlertDialog isOpen={isOpen} onOpenChange={(open) => { if (!open) handleCancel() }}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container size="xs">
            <AlertDialog.Dialog>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon className="bg-warning-soft text-warning-soft-foreground">
                  <AlertTriangle className="size-5" />
                </AlertDialog.Icon>
                <AlertDialog.Heading>未保存的更改</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p className="text-sm text-muted">
                  当前内容尚未保存，离开后将丢失更改。
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button variant="secondary" onPress={handleCancel}>
                  取消
                </Button>
                <Button variant="danger" onPress={handleConfirm}>
                  离开
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </NavigationBlockerContext.Provider>
  )
}

export function useNavigationBlocker() {
  return useContext(NavigationBlockerContext)
}
