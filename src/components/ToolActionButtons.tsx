"use client"

import { Button, Tooltip, Chip } from "@heroui/react"
import { Save, FolderOpen, FileDown } from "lucide-react"

type ToolActionButtonsProps = {
  /** 当前加载的资源名称 */
  currentName: string | null
  /** 是否有未保存的修改 */
  dirty: boolean
  /** 保存（有 currentName 覆盖，没有则弹 Modal） */
  onSaveAction: () => void
  /** 另存为 */
  onSaveAsAction: () => void
  /** 加载 */
  onLoadAction: () => void
  /** 保存按钮提示文本 */
  saveTooltip?: string
}

export function ToolActionButtons({
  currentName,
  dirty,
  onSaveAction: onSave,
  onSaveAsAction: onSaveAs,
  onLoadAction: onLoad,
  saveTooltip,
}: ToolActionButtonsProps) {
  return (
    <>
      {currentName && (
        <Chip size="sm" variant="soft" color="default">
          {currentName}
        </Chip>
      )}
      {dirty && (
        <Chip size="sm" variant="soft" color="warning">
          未保存
        </Chip>
      )}
      <Tooltip delay={0}>
        <Tooltip.Trigger className="flex flex-col">
          <Button isIconOnly size="sm" variant="ghost" aria-label="保存" onPress={onSave}>
            <Save size={14} />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>
          {saveTooltip || (currentName ? `覆盖保存「${currentName}」` : "保存")}
        </Tooltip.Content>
      </Tooltip>
      {currentName && (
        <Tooltip delay={0}>
          <Tooltip.Trigger className="flex flex-col">
            <Button isIconOnly size="sm" variant="ghost" aria-label="另存为" onPress={onSaveAs}>
              <FileDown size={14} />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>另存为</Tooltip.Content>
        </Tooltip>
      )}
      <Tooltip delay={0}>
        <Tooltip.Trigger className="flex flex-col">
          <Button isIconOnly size="sm" variant="ghost" aria-label="加载" onPress={onLoad}>
            <FolderOpen size={14} />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>加载</Tooltip.Content>
      </Tooltip>
    </>
  )
}
