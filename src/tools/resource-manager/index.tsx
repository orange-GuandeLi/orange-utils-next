"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Button,
  Chip,
  Tooltip,
  Modal,
  Input,
  Label,
  TextField,
} from "@heroui/react";
import {
  Database,
  Eye,
  Trash2,
  ExternalLink,
  Clock,
  Download,
  Upload,
  Plus,
  Code2,
  Send,
  Regex,
  FileCode,
  PenTool,
  FolderOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { kvGet, kvSet, kvDelete, kvKeys } from "../../utils/db";
import { CodeEditor } from "../../components/CodeEditor";
import { ModalShell } from "../../components/ModalShell";

// ─── 工具分类注册表 ───

type ToolCategory = {
  id: string;
  name: string;
  prefix: string;
  icon: LucideIcon;
  href: string;
  /** 从存储值中提取可读内容 */
  extractContent: (value: Record<string, unknown>) => string;
  /** 从存储值中提取额外显示字段 */
  extractMeta?: (value: Record<string, unknown>) => { method?: string; url?: string };
};

const TOOL_CATEGORIES: ToolCategory[] = [
  {
    id: "html-selector",
    name: "HTML 选择器",
    prefix: "html-selector:saved:",
    icon: Code2,
    href: "/tools/html-selector",
    extractContent: (v) => (v.html as string) || "",
  },
  {
    id: "api-request",
    name: "API 请求",
    prefix: "api-request:saved:",
    icon: Send,
    href: "/tools/api-request",
    extractContent: () => "", // API 请求不需要显示内容
    extractMeta: (v) => ({ method: v.method as string, url: v.url as string }),
  },
  {
    id: "regex-tester",
    name: "正则测试",
    prefix: "regex:saved:",
    icon: Regex,
    href: "/tools/regex-tester",
    extractContent: (v) => (v.pattern as string) || "",
  },
  {
    id: "notes",
    name: "Markdown",
    prefix: "notes:saved:",
    icon: FileCode,
    href: "/tools/markdown",
    extractContent: (v) => (v.content as string) || "",
  },
];

const MANUAL_CATEGORY: ToolCategory = {
  id: "manual",
  name: "手动创建",
  prefix: "manual:saved:",
  icon: PenTool,
  href: "",
  extractContent: (v) => (v.content as string) || JSON.stringify(v, null, 2),
};

// ─── 类型 ───

type ResourceItem = {
  _key: string;
  _categoryId: string;
  name: string;
  content: string;
  savedAt: number;
  method?: string;
  url?: string;
};

// ─── 组件 ───

export function ResourceManager() {
  const [allItems, setAllItems] = useState<ResourceItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("all");
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

  // 所有分类（含手动）
  const allCategories = [...TOOL_CATEGORIES, MANUAL_CATEGORY];

  // 加载所有资源
  const loadAll = useCallback(async () => {
    const keys = await kvKeys();
    const items: ResourceItem[] = [];

    for (const key of keys) {
      if (!key.includes(":saved:")) continue;
      const value = await kvGet<Record<string, unknown>>(key);
      if (!value) continue;

      // 匹配分类
      const category = allCategories.find((c) => key.startsWith(c.prefix));
      if (!category) continue;

      items.push({
        _key: key,
        _categoryId: category.id,
        name: (value.name as string) || key.replace(category.prefix, ""),
        content: category.extractContent(value),
        savedAt: (value.savedAt as number) || 0,
        ...category.extractMeta?.(value),
      });
    }

    items.sort((a, b) => b.savedAt - a.savedAt);
    setAllItems(items);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  // 分类计数
  const categoryCounts = allCategories.map((c) => ({
    ...c,
    count: allItems.filter((item) => item._categoryId === c.id).length,
  }));

  // 筛选
  const filteredItems = allItems.filter((item) => {
    if (activeCategory !== "all" && item._categoryId !== activeCategory)
      return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !item.name.toLowerCase().includes(q) &&
        !item.content.toLowerCase().includes(q)
      )
        return false;
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

  // 新建资源（手动分类）
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
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
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
        const raw = JSON.parse(reader.result as string) as Record<
          string,
          unknown
        >;
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
        <span className="text-[11px] text-muted hidden sm:inline">数据存储在浏览器本地</span>
        <div className="flex-1" />
        <Chip size="sm" variant="soft" color="default">
          <Chip.Label>{allItems.length} 条</Chip.Label>
        </Chip>
        <Button
          size="sm"
          variant="ghost"
          onPress={() => setCreateModalOpen(true)}
        >
          <Plus size={14} />
          <span className="text-xs">新建</span>
        </Button>
        <Button size="sm" variant="ghost" onPress={handleExport}>
          <Download size={14} />
          <span className="text-xs">导出</span>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onPress={() => fileInputRef.current?.click()}
        >
          <Upload size={14} />
          <span className="text-xs">导入</span>
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelect}
        />
      </header>

      {/* 主体：左侧分类 + 右侧列表 */}
      <div className="flex-1 flex min-h-0">
        {/* 左侧分类导航 */}
        <aside className="w-48 border-r border-separator bg-surface flex flex-col shrink-0">
          <div className="p-3 space-y-0.5 flex-1 overflow-y-auto">
            {/* 全部 */}
            <button
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                activeCategory === "all"
                  ? "bg-secondary text-secondary-foreground"
                  : "hover:bg-surface-secondary text-muted"
              }`}
              onClick={() => setActiveCategory("all")}
            >
              <FolderOpen
                size={14}
                className={activeCategory === "all" ? "text-accent" : ""}
              />
              <span className="flex-1 text-left">全部资源</span>
              <span className="text-[10px] text-muted tabular-nums">
                {allItems.length}
              </span>
            </button>

            <div className="h-px bg-separator my-2" />

            {/* 各工具分类 */}
            {categoryCounts.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${
                    activeCategory === cat.id
                      ? "bg-secondary text-secondary-foreground"
                      : "hover:bg-surface-secondary text-muted"
                  }`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  <Icon
                    size={14}
                    className={activeCategory === cat.id ? "text-accent" : ""}
                  />
                  <span className="flex-1 text-left truncate">{cat.name}</span>
                  {cat.count > 0 && (
                    <span className="text-[10px] text-muted tabular-nums">
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* 右侧内容区 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 搜索栏 */}
          <div className="px-4 py-3 border-b border-separator flex items-center gap-3">
            <Input
              className="w-64"
              placeholder="搜索资源..."
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery((e.target as HTMLInputElement).value)
              }
            />
            <div className="flex-1" />
            {activeCategory !== "all" && (
              <Chip size="sm" variant="soft" color="default">
                <Chip.Label>
                  {allCategories.find((c) => c.id === activeCategory)?.name}
                </Chip.Label>
              </Chip>
            )}
          </div>

          {/* 列表 */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted gap-4">
                <Database size={40} className="opacity-20" />
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {allItems.length === 0 ? "暂无资源" : "没有匹配的资源"}
                  </p>
                  <p className="text-xs mt-1">
                    {allItems.length === 0
                      ? "在各工具中保存的内容会出现在这里"
                      : "尝试切换分类或修改搜索关键词"}
                  </p>
                </div>
                {activeCategory === "all" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => setCreateModalOpen(true)}
                  >
                    <Plus size={14} />
                    <span className="text-xs">新建资源</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-2">
                {filteredItems.map((item) => {
                  const category = allCategories.find(
                    (c) => c.id === item._categoryId,
                  );
                  const Icon = category?.icon || Database;
                  return (
                    <div
                      key={item._key}
                      className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-separator hover:border-accent/30 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className="text-muted shrink-0" />
                          <span className="text-sm font-medium truncate">
                            {item.name}
                          </span>
                          {item.method && (
                            <Chip size="sm" variant="soft" color="accent">
                              <Chip.Label className="font-mono text-xs">
                                {item.method}
                              </Chip.Label>
                            </Chip>
                          )}
                        </div>
                        {item.url && (
                          <p className="text-xs text-muted truncate mt-0.5 font-mono ml-[22px]">
                            {item.url}
                          </p>
                        )}
                        <div className="text-xs text-muted mt-1 flex items-center gap-1 ml-[22px]">
                          <Clock size={10} />
                          {item.savedAt
                            ? new Date(item.savedAt).toLocaleString()
                            : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Tooltip delay={0}>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            aria-label="查看"
                            onPress={() => {
                              setDetailItem(item);
                              setDetailOpen(true);
                            }}
                          >
                            <Eye size={14} />
                          </Button>
                          <Tooltip.Content>查看</Tooltip.Content>
                        </Tooltip>
                        {category?.href && (
                          <Tooltip delay={0}>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              aria-label="打开工具"
                              onPress={() => {
                                const url = item.name
                                  ? `${category.href}?load=${encodeURIComponent(item.name)}`
                                  : category.href;
                                window.location.href = url;
                              }}
                            >
                              <ExternalLink size={14} />
                            </Button>
                            <Tooltip.Content>打开工具</Tooltip.Content>
                          </Tooltip>
                        )}
                        <Tooltip delay={0}>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            aria-label="删除"
                            onPress={() => handleDelete(item._key)}
                          >
                            <Trash2 size={14} className="text-danger" />
                          </Button>
                          <Tooltip.Content>删除</Tooltip.Content>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 详情 Modal */}
      <ModalShell
        isOpen={detailOpen}
        onOpenChange={setDetailOpen}
        title={detailItem?.name || "资源详情"}
        icon={Eye}
        width="sm:max-w-2xl"
      >
        <div className="h-80 min-h-0">
          <CodeEditor
            value={detailItem?.content || ""}
            language="html"
            readOnly
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onPress={() => setDetailOpen(false)}>
            关闭
          </Button>
          {detailItem && (
            <Button
              variant="danger"
              onPress={() => { handleDelete(detailItem._key); setDetailOpen(false); }}
            >
              删除
            </Button>
          )}
        </div>
      </ModalShell>

      {/* 新建 Modal */}
      <ModalShell
        isOpen={createModalOpen}
        onOpenChange={setCreateModalOpen}
        title="新建资源"
        icon={Plus}
        width="sm:max-w-2xl"
      >
        <div className="space-y-4">
          <TextField value={newName} onChange={setNewName}>
            <Label>名称</Label>
            <Input placeholder="资源名称" />
          </TextField>
          <div>
            <Label className="text-xs text-muted mb-2 block">内容</Label>
            <div className="h-64 border border-separator rounded-lg overflow-hidden">
              <CodeEditor
                value={newContent}
                onChange={setNewContent}
                language="html"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onPress={() => setCreateModalOpen(false)}>
            取消
          </Button>
          <Button
            onPress={handleCreate}
            isDisabled={!newName.trim() || !newContent.trim()}
          >
            创建
          </Button>
        </div>
      </ModalShell>

      {/* 导入 Modal */}
      <ModalShell
        isOpen={importModalOpen}
        onOpenChange={setImportModalOpen}
        title="导入资源"
        icon={Upload}
        width="sm:max-w-md"
      >
        {importPreview && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              检测到{" "}
              <span className="text-foreground font-medium">
                {importPreview.count}
              </span>{" "}
              条资源
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg bg-surface-secondary divide-y divide-separator">
              {importPreview.keys.map((key) => (
                <div
                  key={key}
                  className="px-3 py-2 text-xs font-mono text-muted"
                >
                  {key}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onPress={() => setImportModalOpen(false)}>
            取消
          </Button>
          <Button
            variant="ghost"
            onPress={() => handleImportConfirm("merge")}
          >
            合并
          </Button>
          <Button
            onPress={() => handleImportConfirm("overwrite")}
          >
            覆盖
          </Button>
        </div>
      </ModalShell>
    </div>
  );
}
