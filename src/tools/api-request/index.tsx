"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Chip, Input, ListBox, Select, Spinner, Tabs, Tooltip, toast } from "@heroui/react"
import { AlignLeft, Check, Copy, Plus, Send, X } from "lucide-react"
import { ToolHeader } from "@/components/ToolHeader"
import { ToolActionButtons } from "@/components/ToolActionButtons"
import { LoadModal } from "@/components/LoadModal"
import { SaveModal } from "@/components/SaveModal"
import { ModalShell } from "@/components/ModalShell"
import { CodeEditor } from "@/components/CodeEditor"
import { useResource, type SavedItem } from "@/hooks/use-resource"
import { useUnsavedWarning } from "@/hooks/use-unsaved-warning"
import { kvGet, kvGetAll } from "@/utils/db"
import { TOOL_NAME_LABELS, TOOL_REGISTRY } from "@/lib/tool-registry"

type Header = { key: string; value: string }

type RequestConfig = SavedItem & {
  method: string
  url: string
  headers: Header[]
  body: string
}

type ResponseData = {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
}

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const
type Method = (typeof METHODS)[number]

const STORAGE_PREFIX = TOOL_REGISTRY["api-request"].prefix!

export function ApiRequest({ initialLoadName }: { initialLoadName?: string }) {
  const router = useRouter()
  const [method, setMethod] = useState<Method>("GET")
  const [url, setUrl] = useState("")
  const [headers, setHeaders] = useState<Header[]>([
    { key: "Content-Type", value: "application/json" },
  ])
  const [body, setBody] = useState("")
  const [response, setResponse] = useState<ResponseData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [loadingConfig, setLoadingConfig] = useState(false)

  const resource = useResource<RequestConfig>(STORAGE_PREFIX)
  useUnsavedWarning(resource.dirty)

  const [varModalOpen, setVarModalOpen] = useState(false)
  const [availableVars, setAvailableVars] = useState<
    { id: string; name: string; toolName: string; varKey: string; savedAt: number }[]
  >([])

  const buildConfig = useCallback(
    (): Omit<RequestConfig, "name" | "savedAt"> => ({
      method,
      url,
      headers,
      body,
    }),
    [method, url, headers, body],
  )

  const loadAvailableVars = useCallback(async () => {
    const all = await kvGetAll<Record<string, unknown>>()
    const rows: {
      id: string
      name: string
      toolName: string
      varKey: string
      savedAt: number
    }[] = []
    for (const [key, item] of all) {
      if (!key.includes(":saved:") || !item) continue
      const name = (item.name as string) || key.replace(/^.*?:saved:/, "")
      const savedAt = (item.savedAt as number) || 0
      const toolPrefix = key.split(":")[0]
      const toolName = TOOL_NAME_LABELS[toolPrefix] || toolPrefix
      const fields = ["html", "content", "body", "testString"] as const
      for (const field of fields) {
        if (item[field]) {
          rows.push({
            id: `${key}.${field}`,
            name,
            toolName,
            varKey: `{{${key}.${field}}}`,
            savedAt,
          })
          break
        }
      }
    }
    rows.sort((a, b) => b.savedAt - a.savedAt)
    setAvailableVars(rows)
  }, [])

  // URL 参数加载（仅执行一次）
  useEffect(() => {
    if (!initialLoadName) return
    void (async () => {
      const item = await kvGet<RequestConfig>(STORAGE_PREFIX + initialLoadName)
      if (!item) return
      setLoadingConfig(true)
      setMethod(item.method as Method)
      setUrl(item.url)
      setHeaders(item.headers.length ? item.headers : [{ key: "", value: "" }])
      setBody(item.body)
      resource.load(item)
      setTimeout(() => setLoadingConfig(false), 0)
    })()
    // resource 是稳定对象，但此处只想依赖 initialLoadName
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoadName])

  const resolveVars = useCallback(async (text: string): Promise<string> => {
    const pattern = /\{\{([^}]+)\}\}/g
    let result = text
    let match: RegExpExecArray | null
    pattern.lastIndex = 0
    while ((match = pattern.exec(text)) !== null) {
      const rawKey = match[1]
      // 支持 {{key.field}} 语法：key 是 IndexedDB 的存储键，field 是对象字段
      const dotIdx = rawKey.lastIndexOf(".")
      const dbKey = dotIdx > 0 ? rawKey.slice(0, dotIdx) : rawKey
      const field = dotIdx > 0 ? rawKey.slice(dotIdx + 1) : null
      const stored = await kvGet<Record<string, unknown>>(dbKey)
      if (stored !== undefined) {
        let value: unknown
        if (field && typeof stored === "object" && stored !== null) {
          value = (stored as Record<string, unknown>)[field]
        } else {
          value = stored
        }
        if (value !== undefined) {
          const str = typeof value === "string" ? value : JSON.stringify(value)
          // JSON.stringify 处理所有特殊字符转义，slice 去掉外层引号
          const escaped = JSON.stringify(str).slice(1, -1)
          // 用函数替换避免 $1/$&/$' 等 String.replace 特殊模式
          result = result.replace(match[0], () => escaped)
        }
      }
    }
    return result
  }, [])

  const handleSend = async () => {
    if (!url.trim()) {
      setError("请输入 URL")
      return
    }
    // 基本 URL 格式校验
    try {
      new URL(url.trim())
    } catch {
      setError("URL 格式不正确，请包含协议（如 https://）")
      return
    }
    setLoading(true)
    setError("")
    setResponse(null)
    try {
      const resolvedUrl = await resolveVars(url)
      const resolvedBody = await resolveVars(body)
      const fetchHeaders: Record<string, string> = {}
      for (const h of headers) {
        if (h.key.trim()) {
          fetchHeaders[h.key.trim()] = await resolveVars(h.value)
        }
      }
      const start = Date.now()
      const res = await fetch(resolvedUrl, {
        method,
        headers: fetchHeaders,
        body: method !== "GET" ? resolvedBody : undefined,
      })
      const time = Date.now() - start
      const resHeaders: Record<string, string> = {}
      res.headers.forEach((v, k) => {
        resHeaders[k] = v
      })
      let resBody = await res.text()
      try {
        resBody = JSON.stringify(JSON.parse(resBody), null, 2)
      } catch {
        /* not JSON */
      }
      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: resBody,
        time,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败")
    } finally {
      setLoading(false)
    }
  }

  const addHeader = () => {
    setHeaders([...headers, { key: "", value: "" }])
    resource.setDirty(true)
  }
  const removeHeader = (i: number) => {
    setHeaders(headers.filter((_, idx) => idx !== i))
    resource.setDirty(true)
  }
  const updateHeader = (i: number, field: "key" | "value", val: string) => {
    const next = [...headers]
    next[i] = { ...next[i], [field]: val }
    setHeaders(next)
    if (!loadingConfig) resource.setDirty(true)
  }

  const handleSave = async () => {
    if (resource.currentName) {
      const ok = await resource.overwrite(buildConfig() as RequestConfig)
      if (ok) toast.success(`已保存「${resource.currentName}」`)
    } else {
      resource.openSave()
    }
  }

  const handleSaveConfirm = async () => {
    const name = await resource.save(buildConfig() as RequestConfig)
    if (name) toast.success(`已保存「${name}」`)
  }

  const handleLoad = (item: RequestConfig) => {
    setLoadingConfig(true)
    const loaded = resource.load(item)
    setMethod(loaded.method as Method)
    setUrl(loaded.url)
    setHeaders(loaded.headers.length ? loaded.headers : [{ key: "", value: "" }])
    setBody(loaded.body)
    // URL 同步，刷新后可恢复
    router.push(`/tools/api-request?load=${encodeURIComponent(loaded.name)}`, { scroll: false })
    // 下一个事件循环关闭 loadingConfig，让 onChange 可以正常工作
    setTimeout(() => setLoadingConfig(false), 0)
  }

  const handleSaveAs = () => resource.openSave(resource.currentName ?? "")

  const handleNew = () => {
    setMethod("GET")
    setUrl("")
    setHeaders([{ key: "Content-Type", value: "application/json" }])
    setBody("")
    setResponse(null)
    setError("")
    resource.reset()
    router.push("/tools/api-request", { scroll: false })
  }

  const [copied, setCopied] = useState(false)
  const handleCopyResponse = () => {
    if (!response) return
    navigator.clipboard.writeText(response.body)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const insertVar = (varKey: string) => {
    setBody((prev) => prev + varKey)
    setVarModalOpen(false)
  }

  const openVarModal = () => {
    void loadAvailableVars()
    setVarModalOpen(true)
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <ToolHeader
        icon={Send}
        title="API 请求"
        subtitle="发送 HTTP 请求，支持模板变量引用其他工具的数据"
        extra={
          <ToolActionButtons
            currentName={resource.currentName}
            dirty={resource.dirty}
            onSaveAction={handleSave}
            onSaveAsAction={handleSaveAs}
            onLoadAction={resource.openLoad}
            onNewAction={handleNew}
            saveTooltip={resource.currentName ? `保存到 ${resource.currentName}` : "保存请求"}
          />
        }
      />

      {/* Main */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左: 请求配置 */}
        <div className="w-1/2 border-r border-separator flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b border-separator shrink-0">
            <Select
              className="w-28"
              placeholder="GET"
              value={method}
              onChange={(key) => {
                if (key) {
                  setMethod(key as Method)
                  if (!loadingConfig) resource.setDirty(true)
                }
              }}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {METHODS.map((m) => (
                    <ListBox.Item key={m} id={m} textValue={m}>
                      {m}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Input
              className="flex-1"
              placeholder="https://api.example.com/endpoint"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                if (!loadingConfig) resource.setDirty(true)
              }}
            />
            <Button
              size="sm"
              className="text-xs"
              variant="primary"
              isPending={loading}
              onPress={handleSend}
            >
              {({ isPending }) => (
                <>
                  {isPending ? <Spinner color="current" size="sm" /> : <Send size={14} />}
                  {isPending ? "发送中..." : "发送"}
                </>
              )}
            </Button>
          </div>

          <Tabs className="flex-1 min-h-0" defaultSelectedKey="body">
            <Tabs.ListContainer>
              <Tabs.List aria-label="请求配置">
                <Tabs.Tab id="body" className="text-xs">
                  请求体
                  <Tabs.Indicator />
                </Tabs.Tab>
                <Tabs.Tab id="headers" className="text-xs">
                  请求头
                  {headers.filter((h) => h.key.trim()).length > 0 && (
                    <Chip size="sm" variant="soft" color="default" className="ml-1">
                      {headers.filter((h) => h.key.trim()).length}
                    </Chip>
                  )}
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id="body" className="flex flex-col h-full mt-0">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-separator bg-surface-secondary shrink-0">
                <span className="text-xs text-muted">JSON 请求体</span>
              <div className="flex items-center gap-1">
                <Tooltip delay={0}>
                  <Button size="sm" variant="ghost" onPress={() => {
                    try {
                      setBody(JSON.stringify(JSON.parse(body), null, 2))
                      resource.setDirty(true)
                    } catch {
                      toast("JSON 格式错误，无法格式化", { variant: "danger" })
                    }
                  }}>
                    <AlignLeft size={12} />
                    <span className="text-xs">格式化</span>
                  </Button>
                  <Tooltip.Content>美化 JSON 格式</Tooltip.Content>
                </Tooltip>
                <Tooltip delay={0}>
                  <Button size="sm" variant="ghost" onPress={openVarModal}>
                    <Plus size={12} />
                    <span className="text-xs">插入变量</span>
                  </Button>
                  <Tooltip.Content>从其他工具插入数据</Tooltip.Content>
                </Tooltip>
              </div>
              </div>
              <div className="flex-1 min-h-0">
                <CodeEditor
                  value={body}
                  onChange={(v) => {
                    setBody(v)
                    if (!loadingConfig) resource.setDirty(true)
                  }}
                  language="json"
                />
              </div>
            </Tabs.Panel>

            <Tabs.Panel id="headers" className="p-3 space-y-2 overflow-y-auto mt-0">
              {headers.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="flex-1"
                    placeholder="键"
                    value={h.key}
                    onChange={(e) => updateHeader(i, "key", e.target.value)}
                  />
                  <Input
                    className="flex-1"
                    placeholder="值"
                    value={h.value}
                    onChange={(e) => updateHeader(i, "value", e.target.value)}
                  />
                  <Tooltip delay={0}>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      aria-label="删除请求头"
                      onPress={() => removeHeader(i)}
                    >
                      <X size={12} />
                    </Button>
                    <Tooltip.Content>删除</Tooltip.Content>
                  </Tooltip>
                </div>
              ))}
              <Button size="sm" variant="ghost" onPress={addHeader}>
                <Plus size={12} />
                <span className="text-xs">添加请求头</span>
              </Button>
            </Tabs.Panel>
          </Tabs>

          {error && (
            <div className="px-3 py-2 bg-danger-soft text-danger text-xs border-t border-separator shrink-0">
              {error}
            </div>
          )}
        </div>

        {/* 右: 响应 */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-separator shrink-0">
            <span className="text-xs font-medium">响应</span>
            {response && (
              <div className="flex items-center gap-2">
                <Chip size="sm" variant="soft" color={response.status < 400 ? "success" : "danger"}>
                  {response.status} {response.statusText}
                </Chip>
                <Chip size="sm" variant="soft" color="default">
                  {response.time}ms
                </Chip>
                <Tooltip delay={0}>
                  <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label="复制响应"
                    onPress={handleCopyResponse}
                  >
                    {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                  </Button>
                  <Tooltip.Content>{copied ? "已复制" : "复制响应"}</Tooltip.Content>
                </Tooltip>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {response ? (
              <CodeEditor value={response.body} language="json" readOnly />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted">
                {loading ? "请求中..." : "发送请求后查看响应"}
              </div>
            )}
          </div>
        </div>
      </div>

      <SaveModal
        isOpen={resource.saveOpen}
        onOpenChangeAction={(o) => (o ? null : resource.closeSave())}
        title={resource.currentName ? "另存为" : "保存请求"}
        name={resource.saveName}
        onNameChangeAction={resource.setSaveName}
        onSaveAction={handleSaveConfirm}
        placeholder="给这个请求起个名字"
      />

      <LoadModal
        isOpen={resource.loadOpen}
        onOpenChangeAction={(o) => (o ? null : resource.closeLoad())}
        title="加载已保存的请求"
        items={resource.items}
        onLoadAction={handleLoad}
        onDeleteAction={resource.remove}
        emptyText="暂无保存的请求"
        toolName="API 请求"
      />

      <ModalShell
        isOpen={varModalOpen}
        onOpenChangeAction={setVarModalOpen}
        title="插入变量"
        icon={Plus}
      >
        <p className="text-xs text-muted mb-3">从其他工具的数据中选择变量，插入到请求 Body 中。</p>
        {availableVars.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">
            暂无可用变量，请先在其他工具中保存数据
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {availableVars.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors"
                onClick={() => insertVar(v.varKey)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Chip size="sm" variant="soft" color="default">
                      {v.toolName}
                    </Chip>
                    <span className="text-sm font-medium truncate">{v.name}</span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {new Date(v.savedAt).toLocaleString("zh-CN")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ModalShell>
    </div>
  )
}
