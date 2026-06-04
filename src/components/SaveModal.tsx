"use client"

import { useState } from "react"
import { Button, Description, FieldError, Input, Label, TextField } from "@heroui/react"
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
  // 用户是否“动过手”：避免首次打开就显示红色错误
  const [touched, setTouched] = useState(false)
  const trimmed = name.trim()
  const showError = touched && trimmed.length === 0
  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChangeAction={onOpenChange}
      title={title}
      icon={Save}
      size="xs"
    >
      <div className="space-y-4">
        <TextField
          isRequired
          isInvalid={showError}
          value={name}
          onChange={(v) => {
            if (!touched) setTouched(true)
            onNameChange(v)
          }}
        >
          <Label>名称</Label>
          <Input
            placeholder={placeholder}
            onKeyDown={(e) => e.key === "Enter" && !showError && onSave()}
            onBlur={() => setTouched(true)}
          />
          {showError ? (
            <FieldError>名称不能为空</FieldError>
          ) : (
            <Description>唯一标识，重复将覆盖同名资源。</Description>
          )}
        </TextField>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onPress={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onPress={onSave} isDisabled={!trimmed}>
            保存
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
