"use client"

import { Button, Input, Label, TextField } from "@heroui/react"
import { Save } from "lucide-react"
import { ModalShell } from "./ModalShell"

type SaveModalProps = {
  isOpen: boolean
  onOpenChangeAction: (open: boolean) => void
  title: string
  name: string
  onNameChangeAction: (name: string) => void
  onSaveAction: () => void
  placeholder?: string
}

export function SaveModal({
  isOpen,
  onOpenChangeAction: onOpenChange,
  title,
  name,
  onNameChangeAction: onNameChange,
  onSaveAction: onSave,
  placeholder = "输入名称",
}: SaveModalProps) {
  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChangeAction={onOpenChange}
      title={title}
      icon={Save}
      width="sm:max-w-[380px]"
    >
      <div className="space-y-4">
        <TextField value={name} onChange={onNameChange}>
          <Label>名称</Label>
          <Input placeholder={placeholder} onKeyDown={(e) => e.key === "Enter" && onSave()} />
        </TextField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onPress={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onPress={onSave} isDisabled={!name.trim()}>
            保存
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
