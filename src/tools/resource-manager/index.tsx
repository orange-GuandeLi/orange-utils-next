import { useState, useCallback, useEffect, useRef } from "react";
import { Button, Chip, Tooltip, Modal, Tabs } from "@heroui/react";
import {
  Database,
  Eye,
  Trash2,
  ExternalLink,
  Code2,
  Send,
  Clock,
  Download,
  Upload,
} from "lucide-react";
import { kvGet, kvSet, kvDelete, kvKeys } from "../../utils/db";
import { CodeEditor } from "../../components/CodeEditor";

// ---- 数据类型 ----
type HtmlSavedItem = { name: string; html: string; savedAt: number };
type ApiSavedItem = {
  name: string;
  method: string;
  url: string;
  headers: { key: string; value: string }[];
  body: string;
  savedAt: number;
};

type ToolGroup = {
  id: string;
  name: string;
  icon: typeof Code2;
  prefix: string;
  color: "accent" | "success" | "warning" | "danger";
};

const TOOL_GROUPS: ToolGroup[] = [
  {
    id: "html-selector",
    name: "HTML 选择器",
    icon: Code2,
    prefix: "html-selector:saved:",
    color: "accent",
  },
  {
    id: "api-request",
    name: "API 请求",
    icon: Send,
    prefix: "api-request:saved:",
    color: "success",
  },
];

export function ResourceManager() {
  const [activeTab, setActiveTab] = useState(TOOL_GROUPS[0].id);
  const [allItems, setAllItems] = useState<Record<string, unknown[]>>({});
  const [detailItem, setDetailItem] = useState<{
    tool: string;
    key: string;
    data: unknown;
  } | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    count: number;
    keys: string[];
    raw: Record<string, unknown>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载所有保存的资源
  const loadAll = useCallback(async () => {
    const keys = await kvKeys();
    const grouped: Record<string, unknown[]> = {};
    for (const group of TOOL_GROUPS) {
      grouped[group.id] = [];
    }
    for (const key of keys) {
      for (const group of TOOL_GROUPS) {
        if (key.startsWith(group.prefix)) {
          const item = await kvGet(key);
          if (item)
            grouped[group.id].push({ _key: key, ...((item as object) || {}) });
        }
      }
    }
    // 按 savedAt 降序
    for (const group of TOOL_GROUPS) {
      grouped[group.id].sort(
        (a, b) =>
          ((b as { savedAt?: number }).savedAt || 0) -
          ((a as { savedAt?: number }).savedAt || 0),
      );
    }
    setAllItems(grouped);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleDelete = async (key: string) => {
    await kvDelete(key);
    loadAll();
    if (detailItem?.key === key) {
      setDetailOpen(false);
      setDetailItem(null);
    }
  };

  const handleViewDetail = (tool: string, key: string, data: unknown) => {
    setDetailItem({ tool, key, data });
    setDetailOpen(true);
  };

  const getDetailContent = (): string => {
    if (!detailItem) return "";
    const d = detailItem.data as Record<string, unknown>;
    if (detailItem.tool === "html-selector") {
      return (d as HtmlSavedItem).html || "";
    }
    if (detailItem.tool === "api-request") {
      const api = d as ApiSavedItem;
      return JSON.stringify(
        {
          method: api.method,
          url: api.url,
          headers: api.headers,
          body: api.body,
        },
        null,
        2,
      );
    }
    return JSON.stringify(d, null, 2);
  };

  const getDetailLanguage = (): "html" | "json" => {
    if (detailItem?.tool === "html-selector") return "html";
    return "json";
  };

  // ---- 导出 ----
  const handleExport = async () => {
    const keys = await kvKeys();
    const data: Record<string, unknown> = {};
    for (const key of keys) {
      // 只导出工具保存的数据（带 :saved: 前缀的）
      if (TOOL_GROUPS.some((g) => key.startsWith(g.prefix))) {
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

  // ---- 导入 ----
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
        // 只保留合法的工具数据 key
        const validKeys = Object.keys(raw).filter((k) =>
          TOOL_GROUPS.some((g) => k.startsWith(g.prefix)),
        );
        setImportPreview({
          count: validKeys.length,
          keys: validKeys,
          raw,
        });
        setImportModalOpen(true);
      } catch {
        alert("文件格式错误，请选择有效的 JSON 文件");
      }
    };
    reader.readAsText(file);
    // 清空 input 以便重复选择同一文件
    e.target.value = "";
  };

  const handleImportConfirm = async (mode: "merge" | "overwrite") => {
    if (!importPreview) return;
    const { raw } = importPreview;

    if (mode === "overwrite") {
      // 先删除现有数据
      const keys = await kvKeys();
      for (const key of keys) {
        if (TOOL_GROUPS.some((g) => key.startsWith(g.prefix))) {
          await kvDelete(key);
        }
      }
    }

    // 写入导入数据
    for (const [key, value] of Object.entries(raw)) {
      if (TOOL_GROUPS.some((g) => key.startsWith(g.prefix))) {
        if (mode === "merge") {
          // 合并模式：只写入不存在的 key
          const existing = await kvGet(key);
          if (existing === undefined) {
            await kvSet(key, value);
          }
        } else {
          await kvSet(key, value);
        }
      }
    }

    setImportModalOpen(false);
    setImportPreview(null);
    loadAll();
  };

  const currentItems = allItems[activeTab] || [];

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b border-separator flex items-center px-5 gap-2 shrink-0">
        <Database size={16} className="text-accent" />
        <h1 className="text-sm font-semibold">资源管理</h1>
        <span className="text-xs text-muted">统一管理所有工具保存的数据</span>
        <div className="flex-1" />
        <Chip size="sm" variant="soft" color="default">
          <Chip.Label>
            共 {Object.values(allItems).flat().length} 条资源
          </Chip.Label>
        </Chip>
        <Tooltip delay={0}>
          <Button
            size="sm"
            variant="ghost"
            onPress={handleExport}
          >
            <Download size={14} />
            <span className="text-xs">导出</span>
          </Button>
          <Tooltip.Content>导出所有资源为 JSON 文件</Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button
            size="sm"
            variant="ghost"
            onPress={() => fileInputRef.current?.click()}
          >
            <Upload size={14} />
            <span className="text-xs">导入</span>
          </Button>
          <Tooltip.Content>从 JSON 文件导入资源</Tooltip.Content>
        </Tooltip>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelect}
        />
      </header>

      {/* Main */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Tabs
          className="flex-1 min-h-0 flex flex-col mt-2"
          defaultSelectedKey={activeTab}
          onSelectionChange={(key) => {
            if (key) setActiveTab(key as string);
          }}
        >
          <Tabs.ListContainer>
            <Tabs.List aria-label="工具分组">
              {TOOL_GROUPS.map((group) => {
                const Icon = group.icon;
                const count = (allItems[group.id] || []).length;
                return (
                  <Tabs.Tab key={group.id} id={group.id} className="text-xs">
                    <Icon size={14} className="mr-1.5" />
                    {group.name}
                    {count > 0 && (
                      <Chip
                        size="sm"
                        variant="soft"
                        color={group.color}
                        className="ml-1.5"
                      >
                        <Chip.Label>{count}</Chip.Label>
                      </Chip>
                    )}
                    <Tabs.Indicator />
                  </Tabs.Tab>
                );
              })}
            </Tabs.List>
          </Tabs.ListContainer>

          {TOOL_GROUPS.map((group) => (
            <Tabs.Panel
              key={group.id}
              id={group.id}
              className="flex-1 overflow-y-auto mt-0 p-4"
            >
              {currentItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted gap-3">
                  <group.icon size={32} className="opacity-30" />
                  <p className="text-sm">{group.name} 暂无保存的资源</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {(
                    currentItems as (Record<string, unknown> & {
                      _key: string;
                    })[]
                  ).map((item) => {
                    const savedAt = item.savedAt as number | undefined;
                    const name = (item.name as string) || item._key;
                    const isApi = group.id === "api-request";
                    const method = isApi ? (item.method as string) : null;
                    const url = isApi ? (item.url as string) : null;

                    return (
                      <div
                        key={item._key}
                        className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-separator hover:border-accent/30 transition-colors group"
                      >
                        {/* 左侧信息 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {method && (
                              <Chip size="sm" variant="soft" color="accent">
                                <Chip.Label className="font-mono text-xs">
                                  {method}
                                </Chip.Label>
                              </Chip>
                            )}
                            <span className="text-sm font-medium truncate">
                              {name}
                            </span>
                          </div>
                          {url && (
                            <p className="text-xs text-muted truncate mt-1 font-mono">
                              {url}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted">
                            <Clock size={11} />
                            {savedAt
                              ? new Date(savedAt).toLocaleString()
                              : "未知时间"}
                          </div>
                        </div>

                        {/* 右侧操作 */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip delay={0}>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              onPress={() =>
                                handleViewDetail(group.id, item._key, item)
                              }
                            >
                              <Eye size={14} />
                            </Button>
                            <Tooltip.Content>查看详情</Tooltip.Content>
                          </Tooltip>
                          <Tooltip delay={0}>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
                              onPress={() => {
                                window.dispatchEvent(
                                  new CustomEvent("orange-utils:navigate", {
                                    detail: group.id,
                                  }),
                                );
                              }}
                            >
                              <ExternalLink size={14} />
                            </Button>
                            <Tooltip.Content>打开工具</Tooltip.Content>
                          </Tooltip>
                          <Tooltip delay={0}>
                            <Button
                              isIconOnly
                              size="sm"
                              variant="ghost"
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
            </Tabs.Panel>
          ))}
        </Tabs>
      </div>

      {/* 详情 Modal */}
      <Modal.Backdrop isOpen={detailOpen} onOpenChange={setDetailOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-2xl">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent">
                <Eye className="size-5" />
              </Modal.Icon>
              <Modal.Heading>
                {detailItem
                  ? ((detailItem.data as Record<string, unknown>)
                      .name as string) || "资源详情"
                  : "资源详情"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <div className="h-80 min-h-0">
                <CodeEditor
                  value={getDetailContent()}
                  language={getDetailLanguage()}
                  readOnly
                />
              </div>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                关闭
              </Button>
              {detailItem && (
                <Button
                  slot="close"
                  variant="danger"
                  onPress={() => handleDelete(detailItem.key)}
                >
                  删除
                </Button>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* 导入确认 Modal */}
      <Modal.Backdrop isOpen={importModalOpen} onOpenChange={setImportModalOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-success-soft text-success">
                <Upload className="size-5" />
              </Modal.Icon>
              <Modal.Heading>导入资源</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {importPreview && (
                <div className="space-y-4">
                  <p className="text-sm text-muted">
                    检测到{" "}
                    <span className="text-foreground font-medium">
                      {importPreview.count}
                    </span>{" "}
                    条资源数据：
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
                  <p className="text-xs text-muted">
                    请选择导入模式：
                  </p>
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button
                slot="close"
                variant="secondary"
              >
                取消
              </Button>
              <Button
                slot="close"
                variant="ghost"
                onPress={() => handleImportConfirm("merge")}
              >
                合并导入
              </Button>
              <Button
                slot="close"
                variant="primary"
                onPress={() => handleImportConfirm("overwrite")}
              >
                覆盖导入
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
