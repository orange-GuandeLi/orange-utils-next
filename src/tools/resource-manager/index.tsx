"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button, Chip, Tooltip, Modal, Input, Label, TextField } from "@heroui/react";
import {
  Database,
  Eye,
  Trash2,
  ExternalLink,
  Clock,
  Download,
  Upload,
  Plus,
} from "lucide-react";
import { kvGet, kvSet, kvDelete, kvKeys } from "../../utils/db";
import { CodeEditor } from "../../components/CodeEditor";

type ResourceItem = {
  _key: string;
  name: string;
  content: string;
  source: "tool" | "manual";
  toolName?: string;
  savedAt: number;
  method?: string;
  url?: string;
};

export function ResourceManager() {
  const [allItems, setAllItems] = useState<ResourceItem[]>([]);
  const [showSource, setShowSource] = useState<"all" | "manual" | "tool">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [detailItem, setDetailItem] = useState<ResourceItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newContent, setNewContent] = useState("");

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    count: number;
    keys: string[];
    raw: Record<string, unknown>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载所有资源
  const loadAll = useCallback(async () => {
    const keys = await kvKeys();
    const items: ResourceItem[] = [];

    for (const key of keys) {
      if (!key.includes(":saved:")) continue;
      const item = await kvGet<Record<string, unknown>>(key);
      if (!item) continue;

      const isManual = key.startsWith("manual:");
      const isHtml = key.startsWith("html-selector:");
      const isApi = key.startsWith("api-request:");

      items.push({
        _key: key,
        name: (item.name as string) || key.replace(/^.*?:saved:/, ""),
        content: isHtml
          ? ((item as { html?: string }).html || "")
          : JSON.stringify(item, null, 2),
        source: isManual ? "manual" : "tool",
        toolName: isHtml ? "HTML 选择器" : isApi ? "API 请求" : undefined,
        savedAt: (item.savedAt as number) || 0,
        method: isApi ? (item.method as string) : undefined,
        url: isApi ? (item.url as string) : undefined,
      });
    }

    items.sort((a, b) => b.savedAt - a.savedAt);
    setAllItems(items);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // 筛选
  const filteredItems = allItems.filter((item) => {
    if (showSource !== "all" && item.source !== showSource) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !item.content.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleDelete = async (key: string) => {
    await kvDelete(key);
    loadAll();
    if (detailItem?._key === key) {
      setDetailOpen(false);
      setDetailItem(null);
    }
  };

  // 新建资源
  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) return;
    await kvSet(`manual:saved:${newName}`, {
      name: newName,
      content: newContent,
      savedAt: Date.now(),
    });
    setCreateModalOpen(false);
    setNewName("");
    setNewContent("");
    loadAll();
  };

  // 导出
  const handleExport = async () => {
    const keys = await kvKeys();
    const data: Record<string, unknown> = {};
    for (const key of keys) {
      if (key.includes(":saved:")) {
        const value = await kvGet(key);
        if (value !== undefined) data[key] = value;
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orange-utils-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string) as Record<string, unknown>;
        const validKeys = Object.keys(raw).filter((k) => k.includes(":saved:"));
        setImportPreview({ count: validKeys.length, keys: validKeys, raw });
        setImportModalOpen(true);
      } catch {
        alert("文件格式错误");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleImportConfirm = async (mode: "merge" | "overwrite") => {
    if (!importPreview) return;
    if (mode === "overwrite") {
      const keys = await kvKeys();
      for (const key of keys) {
        if (key.includes(":saved:")) await kvDelete(key);
      }
    }
    for (const [key, value] of Object.entries(importPreview.raw)) {
      if (key.includes(":saved:")) {
        if (mode === "merge") {
          const existing = await kvGet(key);
          if (existing === undefined) await kvSet(key, value);
        } else {
          await kvSet(key, value);
        }
      }
    }
    setImportModalOpen(false);
    setImportPreview(null);
    loadAll();
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b border-separator flex items-center px-5 gap-2 shrink-0">
        <Database size={16} className="text-accent" />
        <h1 className="text-sm font-semibold">资源管理</h1>
        <div className="flex-1" />
        <Chip size="sm" variant="soft" color="default">
          <Chip.Label>{filteredItems.length} 条</Chip.Label>
        </Chip>
        <Button size="sm" variant="ghost" onPress={() => setCreateModalOpen(true)}>
          <Plus size={14} /><span className="text-xs">新建</span>
        </Button>
        <Button size="sm" variant="ghost" onPress={handleExport}>
          <Download size={14} /><span className="text-xs">导出</span>
        </Button>
        <Button size="sm" variant="ghost" onPress={() => fileInputRef.current?.click()}>
          <Upload size={14} /><span className="text-xs">导入</span>
        </Button>
        <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelect} />
      </header>

      {/* 筛选栏 */}
      <div className="px-4 py-3 bg-surface border-b border-separator">
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 bg-background rounded-lg border border-separator">
            {(["all", "manual", "tool"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={showSource === s ? "primary" : "ghost"}
                className="text-xs px-4"
                onPress={() => setShowSource(s)}
              >
                {s === "all" ? "全部" : s === "manual" ? "手动创建" : "工具保存"}
              </Button>
            ))}
          </div>
          <div className="flex-1" />
          <Input
            className="w-56"
            placeholder="搜索资源..."
            value={searchQuery}
            onChange={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted gap-4">
            <Database size={40} className="opacity-20" />
            <div className="text-center">
              <p className="text-sm font-medium">{allItems.length === 0 ? "暂无资源" : "没有匹配的资源"}</p>
              <p className="text-xs mt-1">
                {allItems.length === 0
                  ? "点击上方「新建」按钮创建第一个资源"
                  : "尝试切换筛选条件或修改搜索关键词"}
              </p>
            </div>
            {allItems.length === 0 && (
              <Button size="sm" variant="ghost" onPress={() => setCreateModalOpen(true)}>
                <Plus size={14} /><span className="text-xs">新建资源</span>
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-2">
            {filteredItems.map((item) => (
              <div
                key={item._key}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-separator hover:border-accent/30 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Chip size="sm" variant="soft" color={item.source === "manual" ? "success" : "accent"}>
                      <Chip.Label className="text-xs">{item.source === "manual" ? "手动" : item.toolName || "工具"}</Chip.Label>
                    </Chip>
                    {item.method && (
                      <Chip size="sm" variant="soft" color="accent">
                        <Chip.Label className="font-mono text-xs">{item.method}</Chip.Label>
                      </Chip>
                    )}
                    <span className="text-sm font-medium truncate">{item.name}</span>
                  </div>
                  {item.url && <p className="text-xs text-muted truncate mt-0.5 font-mono">{item.url}</p>}
                  <div className="text-xs text-muted mt-1 flex items-center gap-1">
                    <Clock size={10} />{item.savedAt ? new Date(item.savedAt).toLocaleString() : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Tooltip delay={0}>
                    <Button isIconOnly size="sm" variant="ghost" onPress={() => { setDetailItem(item); setDetailOpen(true); }}>
                      <Eye size={14} />
                    </Button>
                    <Tooltip.Content>查看</Tooltip.Content>
                  </Tooltip>
                  {item.source === "tool" && (
                    <Tooltip delay={0}>
                      <Button isIconOnly size="sm" variant="ghost" onPress={() => {
                        const toolId = item._key.startsWith("html-selector:") ? "html-selector" : "api-request";
                        window.location.href = `/tools/${toolId}`;
                      }}>
                        <ExternalLink size={14} />
                      </Button>
                      <Tooltip.Content>打开工具</Tooltip.Content>
                    </Tooltip>
                  )}
                  <Tooltip delay={0}>
                    <Button isIconOnly size="sm" variant="ghost" onPress={() => handleDelete(item._key)}>
                      <Trash2 size={14} className="text-danger" />
                    </Button>
                    <Tooltip.Content>删除</Tooltip.Content>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 详情 Modal */}
      <Modal.Backdrop isOpen={detailOpen} onOpenChange={setDetailOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{detailItem?.name || "资源详情"}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="h-80 min-h-0">
                <CodeEditor value={detailItem?.content || ""} language="html" readOnly />
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">关闭</Button>
              {detailItem && (
                <Button slot="close" variant="danger" onPress={() => handleDelete(detailItem._key)}>删除</Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* 新建 Modal */}
      <Modal.Backdrop isOpen={createModalOpen} onOpenChange={setCreateModalOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>新建资源</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="space-y-4">
                <TextField value={newName} onChange={setNewName}>
                  <Label>名称</Label>
                  <Input placeholder="资源名称" />
                </TextField>
                <div>
                  <Label className="text-xs text-muted mb-2 block">内容</Label>
                  <div className="h-64 border border-separator rounded-lg overflow-hidden">
                    <CodeEditor value={newContent} onChange={setNewContent} language="html" />
                  </div>
                </div>
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">取消</Button>
              <Button slot="close" onPress={handleCreate} isDisabled={!newName.trim() || !newContent.trim()}>创建</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* 导入 Modal */}
      <Modal.Backdrop isOpen={importModalOpen} onOpenChange={setImportModalOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header><Modal.Heading>导入资源</Modal.Heading></Modal.Header>
            <Modal.Body>
              {importPreview && (
                <div className="space-y-3">
                  <p className="text-sm text-muted">检测到 <span className="text-foreground font-medium">{importPreview.count}</span> 条资源</p>
                  <div className="max-h-40 overflow-y-auto rounded-lg bg-surface-secondary divide-y divide-separator">
                    {importPreview.keys.map((key) => (
                      <div key={key} className="px-3 py-2 text-xs font-mono text-muted">{key}</div>
                    ))}
                  </div>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">取消</Button>
              <Button slot="close" variant="ghost" onPress={() => handleImportConfirm("merge")}>合并</Button>
              <Button slot="close" onPress={() => handleImportConfirm("overwrite")}>覆盖</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}