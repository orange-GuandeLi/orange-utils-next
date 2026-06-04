"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Button,
  Chip,
  Input,
  Label,
  SearchField,
  Spinner,
  TextField,
  Toolbar,
  Tooltip,
  toast,
} from "@heroui/react"
import {
  Clock,
  Code2,
  Database,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FolderOpen,
  PenTool,
  Plus,
  Regex,
  Send,
  Trash2,
  Upload,
} from "lucide-react"
import { kvDelete, kvGet, kvKeys, kvSet } from "@/utils/db"
import { CodeEditor } from "@/components/CodeEditor"
import { ModalShell } from "@/components/ModalShell"
import { RESOURCE_CATEGORIES, type ToolDef } from "@/lib/tool-registry"

type ResourceItem = {
  _key: string
  _categoryId: string
  name: string
  content: string
  savedAt: number
  method?: string
  url?: string
}

const ICON_MAP = {
  "html-selector": Code2,
  "api-request": Send,
  "regex-tester": Regex,
  notes: FileCode,
  manual: PenTool,
} as const

function iconFor(id: string) {
  return (ICON_MAP as Record<string, typeof Database>)[id] ?? Database
}

export function ResourceManager() {
  const [allItems, setAllItems] = useState<ResourceItem[]>([])
  const [activeCategory, setActiveCategory] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const [detailItem, setDetailItem] = useState<ResourceItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [newName, setNewName] = useState("")
  const [newContent, setNewContent] = useState("")

  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importPreview, setImportPreview] = useState<{
    count: number
    keys: string[]
    raw: Record<string, unknown>
  } | null>(null)
  const [busy, setBusy] = useState<null | "export" | "import" | "create">(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const categories: ToolDef[] = RESOURCE_CATEGORIES

  const loadAll = useCallback(async () => {
    const keys = await kvKeys()
    const items: ResourceItem[] = []

    for (const key of keys) {
      if (!key.includes(":saved:")) continue
      const value = await kvGet<Record<string, unknown>>(key)
      if (!value) continue

      const category = categories.find((c) => key.startsWith(c.prefix!))
      if (!category) continue

      items.push({
        _key: key,
        _categoryId: category.id,
        name: (value.name as string) || key.replace(category.prefix!, ""),
        content: category.extractContent?.(value) ?? "",
        savedAt: (value.savedAt as number) || 0,
        ...category.extractMeta?.(value),
      })
    }

    items.sort((a, b) => b.savedAt - a.savedAt)
    setAllItems(items)
  }, [categories])

  // 初始加载：从 IndexedDB 拉取数据是外部子系统同步
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAll()
  }, [loadAll])

  const categoryCounts = categories.map((c) => ({
    ...c,
    count: allItems.filter((item) => item._categoryId === c.id).length,
  }))

  const filteredItems = allItems.filter((item) => {
    if (activeCategory !== "all" && item._categoryId !== activeCategory) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (!item.name.toLowerCase().includes(q) && !item.content.toLowerCase().includes(q)) {
        return false
      }
    }
    return true
  })

  const handleDelete = async (key: string) => {
    await kvDelete(key)
    void loadAll()
    if (detailItem?._key === key) {
      setDetailOpen(false)
      setDetailItem(null)
    }
  }

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) return
    const name = newName.trim()
    setBusy("create")
    try {
      await kvSet(`manual:saved:${name}`, {
        name,
        content: newContent,
        savedAt: Date.now(),
      })
      setCreateModalOpen(false)
      setNewName("")
      setNewContent("")
      void loadAll()
      toast.success(`已创建「${name}」`)
    } finally {
      setBusy(null)
    }
  }

  const handleExport = async () => {
    setBusy("export")
    try {
      const keys = await kvKeys()
      const data: Record<string, unknown> = {}
      for (const key of keys) {
        if (key.includes(":saved:")) {
          const value = await kvGet(key)
          if (value !== undefined) data[key] = value
        }
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `orange-utils-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success("已导出备份文件")
    } finally {
      setBusy(null)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const raw = JSON.parse(reader.result as string) as Record<string, unknown>
        const validKeys = Object.keys(raw).filter((k) => k.includes(":saved:"))
        setImportPreview({ count: validKeys.length, keys: validKeys, raw })
        setImportModalOpen(true)
      } catch {
        toast("文件格式错误：不是有效的 JSON", { variant: "danger" })
      }
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  const handleImportConfirm = async (mode: "merge" | "overwrite") => {
    if (!importPreview) return
    setBusy("import")
    try {
      if (mode === "overwrite") {
        const keys = await kvKeys()
        for (const key of keys) {
          if (key.includes(":saved:")) await kvDelete(key)
        }
      }
      for (const [key, value] of Object.entries(importPreview.raw)) {
        if (key.includes(":saved:")) {
          if (mode === "merge") {
            const existing = await kvGet(key)
            if (existing === undefined) await kvSet(key, value)
          } else {
            await kvSet(key, value)
          }
        }
      }
      setImportModalOpen(false)
      setImportPreview(null)
      void loadAll()
      toast.success(mode === "overwrite" ? "已覆盖导入" : "已合并导入")
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <header className="h-14 border-b border-separator flex items-center px-5 gap-2 shrink-0">
        <Database size={16} className="text-accent" />
        <h1 className="text-sm font-semibold">资源管理</h1>
        <span className="text-[11px] text-muted hidden sm:inline">数据存储在浏览器本地</span>
        <div className="flex-1" />
        <Chip size="sm" variant="soft" color="default">
          {allItems.length} 条
        </Chip>
        <Toolbar aria-label="资源操作" className="gap-1 bg-transparent p-0">
          <Button size="sm" variant="ghost" onPress={() => setCreateModalOpen(true)}>
            <Plus size={14} />
            <span className="text-xs">新建</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            isPending={busy === "export"}
            onPress={() => void handleExport()}
          >
            {({ isPending }) => (
              <>
                {isPending ? <Spinner color="current" size="sm" /> : <Download size={14} />}
                <span className="text-xs">导出</span>
              </>
            )}
          </Button>
          <Button size="sm" variant="ghost" onPress={() => fileInputRef.current?.click()}>
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
        </Toolbar>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="w-48 border-r border-separator bg-surface flex flex-col shrink-0">
          <div className="p-3 space-y-0.5 flex-1 overflow-y-auto">
            <Button
              fullWidth
              size="sm"
              variant="tertiary"
              className={`justify-start gap-2.5 px-3 py-2 h-auto text-xs ${
                activeCategory === "all"
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted hover:bg-surface-secondary"
              }`}
              onPress={() => setActiveCategory("all")}
            >
              <FolderOpen size={14} className={activeCategory === "all" ? "text-accent" : ""} />
              <span className="flex-1 text-left">全部资源</span>
              <span className="text-[10px] text-muted tabular-nums">{allItems.length}</span>
            </Button>

            <div className="h-px bg-separator my-2" />

            {categoryCounts.map((cat) => {
              const Icon = iconFor(cat.id)
              return (
                <Button
                  key={cat.id}
                  fullWidth
                  size="sm"
                  variant="tertiary"
                  className={`justify-start gap-2.5 px-3 py-2 h-auto text-xs ${
                    activeCategory === cat.id
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted hover:bg-surface-secondary"
                  }`}
                  onPress={() => setActiveCategory(cat.id)}
                >
                  <Icon size={14} className={activeCategory === cat.id ? "text-accent" : ""} />
                  <span className="flex-1 text-left truncate">{cat.name}</span>
                  {cat.count > 0 && (
                    <span className="text-[10px] text-muted tabular-nums">{cat.count}</span>
                  )}
                </Button>
              )
            })}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-4 py-3 border-b border-separator flex items-center gap-3">
            <SearchField
              className="w-64"
              value={searchQuery}
              onChange={setSearchQuery}
              variant="secondary"
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="搜索资源..." />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <div className="flex-1" />
            {activeCategory !== "all" && (
              <Chip size="sm" variant="soft" color="default">
                {categories.find((c) => c.id === activeCategory)?.name}
              </Chip>
            )}
          </div>

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
                  <Button size="sm" variant="ghost" onPress={() => setCreateModalOpen(true)}>
                    <Plus size={14} />
                    <span className="text-xs">新建资源</span>
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-2">
                {filteredItems.map((item) => {
                  const category = categories.find((c) => c.id === item._categoryId)
                  const Icon = iconFor(item._categoryId)
                  return (
                    <div
                      key={item._key}
                      className="flex items-center gap-3 p-3 rounded-lg bg-surface border border-separator hover:border-accent/30 transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className="text-muted shrink-0" />
                          <span className="text-sm font-medium truncate">{item.name}</span>
                          {item.method && (
                            <Chip size="sm" variant="soft" color="accent">
                              <span className="font-mono text-xs">{item.method}</span>
                            </Chip>
                          )}
                        </div>
                        {item.url && (
                          <p className="text-xs text-muted truncate mt-0.5 font-mono ml-5.5">
                            {item.url}
                          </p>
                        )}
                        <div className="text-xs text-muted mt-1 flex items-center gap-1 ml-5.5">
                          <Clock size={10} />
                          {item.savedAt ? new Date(item.savedAt).toLocaleString() : ""}
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
                              setDetailItem(item)
                              setDetailOpen(true)
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
                                if (!category?.href) return
                                const url = item.name
                                  ? `${category.href}?load=${encodeURIComponent(item.name)}`
                                  : category.href
                                window.location.href = url
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
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <ModalShell
        isOpen={detailOpen}
        onOpenChangeAction={setDetailOpen}
        title={detailItem?.name || "资源详情"}
        icon={Eye}
        size="lg"
      >
        <div className="h-80 min-h-0">
          <CodeEditor value={detailItem?.content || ""} language="html" readOnly />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onPress={() => setDetailOpen(false)}>
            关闭
          </Button>
          {detailItem && (
            <Button
              variant="danger"
              onPress={() => {
                void handleDelete(detailItem._key)
                setDetailOpen(false)
              }}
            >
              删除
            </Button>
          )}
        </div>
      </ModalShell>

      <ModalShell
        isOpen={createModalOpen}
        onOpenChangeAction={setCreateModalOpen}
        title="新建资源"
        icon={Plus}
        size="lg"
      >
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
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onPress={() => setCreateModalOpen(false)}>
            取消
          </Button>
          <Button
            isPending={busy === "create"}
            isDisabled={!newName.trim() || !newContent.trim()}
            onPress={() => void handleCreate()}
          >
            {({ isPending }) => <>{isPending ? "创建中…" : "创建"}</>}
          </Button>
        </div>
      </ModalShell>

      <ModalShell
        isOpen={importModalOpen}
        onOpenChangeAction={setImportModalOpen}
        title="导入资源"
        icon={Upload}
        size="md"
      >
        {importPreview && (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              检测到 <span className="text-foreground font-medium">{importPreview.count}</span>{" "}
              条资源
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg bg-surface-secondary divide-y divide-separator">
              {importPreview.keys.map((key) => (
                <div key={key} className="px-3 py-2 text-xs font-mono text-muted">
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
            isPending={busy === "import"}
            onPress={() => void handleImportConfirm("merge")}
          >
            {({ isPending }) => <>{isPending ? "合并中…" : "合并"}</>}
          </Button>
          <Button
            isPending={busy === "import"}
            onPress={() => void handleImportConfirm("overwrite")}
          >
            {({ isPending }) => <>{isPending ? "覆盖中…" : "覆盖"}</>}
          </Button>
        </div>
      </ModalShell>
    </div>
  )
}
