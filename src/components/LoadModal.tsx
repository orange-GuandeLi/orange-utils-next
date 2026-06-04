"use client";

import { ReactNode, useState, useMemo, useRef, useEffect } from "react";
import { Button, Tooltip, TextField, InputGroup, Label } from "@heroui/react";
import { FolderOpen, Trash2, Search, X } from "lucide-react";
import { ModalShell } from "./ModalShell";

type LoadModalItem = {
  id?: string;
  name: string;
  savedAt: number;
};

type LoadModalProps<T extends LoadModalItem> = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: T[];
  onLoad: (item: T) => void;
  onDelete?: (item: T) => void;
  emptyText?: string;
  renderMeta?: (item: T) => ReactNode;
};

export function LoadModal<T extends LoadModalItem>({
  isOpen,
  onOpenChange,
  title,
  items,
  onLoad,
  onDelete,
  emptyText = "暂无保存的内容",
  renderMeta,
}: LoadModalProps<T>) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // 打开时清空搜索并聚焦
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter((item) => item.name.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <ModalShell
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={title}
      icon={FolderOpen}
    >
      {/* 搜索框 */}
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
              className="group flex items-center gap-3 p-3 rounded-lg bg-surface-secondary hover:bg-surface-tertiary transition-colors cursor-pointer"
              onClick={() => onLoad(item)}
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
                        onPress={() => onDelete(item)}
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
    </ModalShell>
  );
}
