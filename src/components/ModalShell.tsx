"use client";

import { ReactNode } from "react";
import { Button, Modal } from "@heroui/react";
import { LucideIcon } from "lucide-react";

type ModalShellProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  width?: string;
};

export function ModalShell({
  isOpen,
  onOpenChange,
  title,
  icon: Icon,
  children,
  width = "sm:max-w-[480px]",
}: ModalShellProps) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container>
        <Modal.Dialog className={width}>
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent">
              <Icon className="size-5" />
            </Modal.Icon>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            {children}
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
