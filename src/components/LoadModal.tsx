"use client"

import { ReactNode, useEffect, useMemo, useRef, useState } from "react"
import { Button, Tooltip, TextField, InputGroup, Label } from "@heroui/react"
import { FolderOpen, Trash2, Search, X } from "lucide-react"
import { ModalShell } from "./ModalShell"

type LoadModalItem = {
  id?: string
  name: string
  savedAt: number
}

type LoadModalProps<T extends LoadModalItem> = {
  isOpen: boolean
  onOpenChangeAction: (open: boolean) => void
  title: string
  items: T[]
  onLoadAction: (item: T) => void
  onDeleteAction?: (item: T) => void
  emptyText?: string
  renderMetaAction?: (item: T) => ReactNode
}

export function LoadModal<T extends LoadModalItem>({
  isOpen,
  onOpenChangeAction: onOpenChange,
  title,
  items,
  onLoadAction: onLoad,
  onDeleteAction: onDelete,
  emptyText = "暂无保存的内容",
  renderMetaAction: renderMeta,
}: LoadModalProps<T>) {
  const [query, setQuery] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 打开时清空搜索并聚焦
  // isOpen 是父组件控制的弹窗状态，此处根据 isOpen 转移重置 query 是合理的副作用
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 关闭时重置是合理的副作用
      setDeleteTarget(null)
      return
    }
    setQuery("")
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [isOpen])

  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.trim().toLowerCase()
    return items.filter((item) => item.name.toLowerCase().includes(q))
  }, [items, query])

  return (
    <ModalShell isOpen={isOpen} onOpenChangeAction={onOpenChange} title={title} icon={FolderOpen}>
      {items.length > 0 && (
        <div className="mb-3">
          <TextField value={query} onChange={setQuery}>
            <Label className="sr-only">搜索</Label>
            <InputGroup>
              <InputGroup.Prefix>
                <Search size={14} className="text-muted" />
              </InputGroup.Prefix>
              <InputGroup.Input ref={inputRef} placeholder="搜索名称…" />
              {query && (
                <InputGroup.Suffix>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label="清除"
                    onPress={() => setQuery("")}
                  >
                    <X size={14} />
                  </Button>
                </InputGroup.Suffix>
              )}
            </InputGroup>
          </TextField>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted text-center py-8">
          {query.trim() ? "没有匹配的资源" : emptyText}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((item) => (
            <div
              key={item.id || item.name}
              role="button"
              tabIndex={0}
              className="group flex items-center gap-3 p-3 rounded-lg bg-surface-secondary hover:bg-surface-tertiary transition-colors cursor-pointer"
              onClick={() => onLoad(item)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !e.nativeEvent.isComposing) onLoad(item)
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.name}</div>
                <div className="text-xs text-muted mt-0.5">
                  {new Date(item.savedAt).toLocaleString("zh-CN")}
                </div>
                {renderMeta && <div className="mt-1">{renderMeta(item)}</div>}
              </div>
              {onDelete && (
                <div
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Tooltip delay={0}>
                    <Tooltip.Trigger className="flex flex-col">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label="删除"
                        onPress={() => setDeleteTarget(item)}
                      >
                        <Trash2 size={14} className="text-danger" />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>删除</Tooltip.Content>
                  </Tooltip>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg p-4 max-w-xs w-full mx-4 border border-separator">
            <p className="text-sm text-muted mb-4">
              确定要删除「<span className="text-foreground font-medium">{deleteTarget.name}</span>
              」吗？
            </p>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="secondary" onPress={() => setDeleteTarget(null)}>
                取消
              </Button>
              <Button
                size="sm"
                variant="danger"
                onPress={() => {
                  onDelete?.(deleteTarget)
                  setDeleteTarget(null)
                }}
              >
                删除
              </Button>
            </div>
          </div>
        </div>
      )}
    </ModalShell>
  )
}
