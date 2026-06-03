"use client";

import { Button, Tooltip, Chip } from "@heroui/react";
import { Save, FolderOpen, FileDown } from "lucide-react";

type ToolActionButtonsProps = {
  /** 当前加载的资源名称 */
  currentName: string | null;
  /** 是否有未保存的修改 */
  dirty: boolean;
  /** 保存（有 currentName 覆盖，没有则弹 Modal） */
  onSave: () => void;
  /** 另存为 */
  onSaveAs: () => void;
  /** 加载 */
  onLoad: () => void;
  /** 保存按钮提示文本 */
  saveTooltip?: string;
};

export function ToolActionButtons({
  currentName,
  dirty,
  onSave,
  onSaveAs,
  onLoad,
  saveTooltip,
}: ToolActionButtonsProps) {
  return (
    <>
      {currentName && (
        <Chip size="sm" variant="soft" color="default">
          <Chip.Label>{currentName}</Chip.Label>
        </Chip>
      )}
      {dirty && (
        <Chip size="sm" variant="soft" color="warning">
          <Chip.Label>未保存</Chip.Label>
        </Chip>
      )}
      <Tooltip delay={0}>
        <Tooltip.Trigger className="flex flex-col">
          <Button isIconOnly size="sm" variant="ghost" aria-label="保存" onPress={onSave}>
            <Save size={14} />
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>{saveTooltip || (currentName ? `覆盖保存「${currentName}」` : "保存")}</Tooltip.Content>
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
  );
}
