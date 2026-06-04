"use client"

import { ReactNode } from "react"
import { Modal } from "@heroui/react"
import { LucideIcon } from "lucide-react"

type ModalSize = "xs" | "sm" | "md" | "lg" | "cover" | "full"

type ModalShellProps = {
  isOpen: boolean
  onOpenChangeAction: (open: boolean) => void
  title: string
  icon: LucideIcon
  children: ReactNode
  /**
   * HeroUI v3 Modal 尺寸 token。默认值与之前 `sm:max-w-[480px]` 接近。
   *  - xs: 384px（旧 `sm:max-w-[380px]`）
   *  - sm: 448px（默认）
   *  - md: 512px（旧 `sm:max-w-lg`）
   *  - lg: 576px（旧 `sm:max-w-2xl`）
   */
  size?: ModalSize
}

export function ModalShell({
  isOpen,
  onOpenChangeAction: onOpenChange,
  title,
  icon: Icon,
  children,
  size = "sm",
}: ModalShellProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container size={size}>
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <Icon className="size-5" />
            </Modal.Icon>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>{children}</Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  )
}
