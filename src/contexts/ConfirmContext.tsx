"use client"

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react"
import { AlertDialog, Button } from "@heroui/react"
import { Trash2, AlertTriangle, Info } from "lucide-react"

type ConfirmVariant = "danger" | "warning" | "info"

type ConfirmOptions = {
  title?: string
  message: string | ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: ConfirmVariant
}

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

const VARIANT_CONFIG: Record<ConfirmVariant, { icon: typeof Trash2; heading: string }> = {
  danger: { icon: Trash2, heading: "确认删除" },
  warning: { icon: AlertTriangle, heading: "确认操作" },
  info: { icon: Info, heading: "确认" },
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({ message: "" })
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setOptions(opts)
      setIsOpen(true)
    })
  }, [])

  const handleClose = useCallback((open: boolean) => {
    if (!open) {
      setIsOpen(false)
      // backdrop click or ESC — treat as cancel
      resolverRef.current?.(false)
      resolverRef.current = null
    }
  }, [])

  const variant = options.variant ?? "danger"
  const cfg = VARIANT_CONFIG[variant]
  const Icon = cfg.icon

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AlertDialog isOpen={isOpen} onOpenChange={handleClose}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container size="xs">
            <AlertDialog.Dialog>
              {({ close }) => (
                <>
                  <AlertDialog.CloseTrigger />
                  <AlertDialog.Header>
                    <AlertDialog.Icon className="bg-accent-soft text-accent-soft-foreground">
                      <Icon className="size-5" />
                    </AlertDialog.Icon>
                    <AlertDialog.Heading>
                      {options.title ?? cfg.heading}
                    </AlertDialog.Heading>
                  </AlertDialog.Header>
                  <AlertDialog.Body>
                    {typeof options.message === "string" ? (
                      <p className="text-sm text-muted">{options.message}</p>
                    ) : (
                      options.message
                    )}
                  </AlertDialog.Body>
                  <AlertDialog.Footer>
                    <Button variant="secondary" onPress={() => { resolverRef.current?.(false); resolverRef.current = null; close() }}>
                      {options.cancelLabel ?? "取消"}
                    </Button>
                    <Button variant={variant === "danger" ? "danger" : variant === "warning" ? "danger-soft" : "primary"} onPress={() => { resolverRef.current?.(true); resolverRef.current = null; close() }}>
                      {options.confirmLabel ?? "确认"}
                    </Button>
                  </AlertDialog.Footer>
                </>
              )}
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm must be used within <ConfirmProvider>")
  return ctx
}
