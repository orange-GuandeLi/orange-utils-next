"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Button,
  Chip,
  Input,
  Separator,
  ToggleButton,
  ToggleButtonGroup,
  Toolbar,
  Tooltip,
  toast,
} from "@heroui/react"
import { Check, Copy, Plus, Regex } from "lucide-react"
import { useResource, type SavedItem } from "@/hooks/use-resource"
import { LoadModal } from "@/components/LoadModal"
import { SaveModal } from "@/components/SaveModal"
import { ToolHeader } from "@/components/ToolHeader"
import { ToolActionButtons } from "@/components/ToolActionButtons"
import { ModalShell } from "@/components/ModalShell"
import { kvGet, kvKeys } from "@/utils/db"
import { TOOL_NAME_LABELS, TOOL_REGISTRY } from "@/lib/tool-registry"

type RegexSaved = SavedItem & {
  pattern: string
  flags: string[]
  testString: string
}

type MatchResult = {
  text: string
  index: number
  length: number
  groups?: Record<string, string>
}

type WorkerOut = { matches: MatchResult[]; error: string | null }

const FLAG_OPTIONS = [
  { id: "g", name: "g", description: "全局匹配" },
  { id: "i", name: "i", description: "忽略大小写" },
  { id: "m", name: "m", description: "多行模式" },
  { id: "s", name: "s", description: "点号匹配换行" },
] as const

type FlagId = (typeof FLAG_OPTIONS)[number]["id"]

const STORAGE_PREFIX = TOOL_REGISTRY["regex-tester"].prefix!

export function RegexTester({ initialLoadName }: { initialLoadName?: string }) {
  const [pattern, setPattern] = useState("")
  const [flags, setFlags] = useState<Set<FlagId>>(new Set<FlagId>(["g"]))
  const [testString, setTestString] = useState("")
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [error, setError] = useState<string | null>(null)

  const resource = useResource<RegexSaved>(STORAGE_PREFIX)

  const [varModalOpen, setVarModalOpen] = useState(false)
  const [availableVars, setAvailableVars] = useState<
    { id: string; name: string; toolName: string; content: string; savedAt: number }[]
  >([])
  const [copied, setCopied] = useState(false)

  const buildConfig = useCallback(
    (): Omit<RegexSaved, "name" | "savedAt"> => ({
      pattern,
      flags: Array.from(flags),
      testString,
    }),
    [pattern, flags, testString],
  )

  // URL 参数加载（仅执行一次）
  useEffect(() => {
    if (!initialLoadName) return
    void (async () => {
      const item = await kvGet<RegexSaved>(STORAGE_PREFIX + initialLoadName)
      if (!item) return
      setPattern(item.pattern)
      setFlags(new Set(item.flags as FlagId[]))
      setTestString(item.testString)
      resource.load(item)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoadName])

  // 正则执行：Web Worker 防灾难性回溯
  const workerRef = useRef<Worker | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!pattern || !testString) {
      /* eslint-disable react-hooks/set-state-in-effect -- 清空结果：依赖清空时重置是合理副作用 */
      setMatches([])
      setError(null)
      /* eslint-enable react-hooks/set-state-in-effect */
      return
    }

    // 终止上一次 worker
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const worker = new Worker(new URL("./regex.worker.ts", import.meta.url), { type: "module" })
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const { matches: m, error: err } = e.data
      setMatches(m)
      setError(err)
      worker.terminate()
      workerRef.current = null
    }

    worker.onerror = () => {
      setMatches([])
      setError("Worker 执行出错")
      worker.terminate()
      workerRef.current = null
    }

    worker.postMessage({ pattern, flags: Array.from(flags).join(""), testString })

    // 500ms 兜底超时
    timerRef.current = setTimeout(() => {
      if (workerRef.current === worker) {
        worker.terminate()
        workerRef.current = null
        setMatches([])
        setError("正则执行超时（500ms），可能存在灾难性回溯")
      }
    }, 500)

    return () => {
      worker.terminate()
      workerRef.current = null
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [pattern, flags, testString])

  // 高亮匹配文本
  const highlightedText = useMemo(() => {
    if (!matches.length || !testString) return null
    const parts: { text: string; isMatch: boolean; matchIndex?: number }[] = []
    let lastIndex = 0

    matches.forEach((match, i) => {
      if (match.index > lastIndex) {
        parts.push({ text: testString.slice(lastIndex, match.index), isMatch: false })
      }
      parts.push({ text: match.text, isMatch: true, matchIndex: i })
      lastIndex = match.index + match.length
    })

    if (lastIndex < testString.length) {
      parts.push({ text: testString.slice(lastIndex), isMatch: false })
    }

    return parts
  }, [matches, testString])

  const handleFlagsChange = (keys: Set<unknown>) => {
    // 过滤为合法 FlagId；至少保留一个全局匹配
    const filtered = new Set<FlagId>(
      [...keys].filter((k): k is FlagId => FLAG_OPTIONS.some((f) => f.id === (k as FlagId))),
    )
    const next = filtered.size === 0 ? new Set<FlagId>(["g"]) : filtered
    setFlags(next)
    resource.setDirty(true)
  }

  const copyPattern = () => {
    navigator.clipboard.writeText(`/${pattern}/${Array.from(flags).join("")}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const loadAvailableVars = useCallback(async () => {
    const keys = await kvKeys()
    const rows: {
      id: string
      name: string
      toolName: string
      content: string
      savedAt: number
    }[] = []
    for (const key of keys) {
      if (!key.includes(":saved:")) continue
      const item = await kvGet<Record<string, unknown>>(key)
      if (!item) continue
      const name = (item.name as string) || key.replace(/^.*?:saved:/, "")
      const content =
        (item.html as string) ||
        (item.content as string) ||
        (item.body as string) ||
        (item.testString as string) ||
        ""
      const savedAt = (item.savedAt as number) || 0
      const toolPrefix = key.split(":")[0]
      const toolName = TOOL_NAME_LABELS[toolPrefix] || toolPrefix
      if (content) {
        rows.push({ id: key, name, toolName, content, savedAt })
      }
    }
    rows.sort((a, b) => b.savedAt - a.savedAt)
    setAvailableVars(rows)
  }, [])

  const openVarModal = () => {
    void loadAvailableVars()
    setVarModalOpen(true)
  }

  const handleSave = async () => {
    if (resource.currentName) {
      const ok = await resource.overwrite(buildConfig() as RegexSaved)
      if (ok) toast.success(`已保存「${resource.currentName}」`)
    } else {
      resource.openSave()
    }
  }

  const handleSaveConfirm = async () => {
    const name = await resource.save(buildConfig() as RegexSaved)
    if (name) toast.success(`已保存「${name}」`)
  }

  const handleLoad = (item: RegexSaved) => {
    const loaded = resource.load(item)
    setPattern(loaded.pattern)
    setFlags(new Set(loaded.flags as FlagId[]))
    setTestString(loaded.testString)
  }

  const handleSaveAs = () => resource.openSave(resource.currentName ?? "")

  const insertVar = (content: string) => {
    setTestString((prev) => prev + content)
    resource.setDirty(true)
    setVarModalOpen(false)
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <ToolHeader
        icon={Regex}
        title="正则测试"
        subtitle="实时匹配，高亮显示"
        extra={
          <>
            <Chip size="sm" variant="soft" color={error ? "danger" : "success"}>
              {error ? "语法错误" : pattern ? `${matches.length} 个匹配` : "输入正则"}
            </Chip>
            <ToolActionButtons
              currentName={resource.currentName}
              dirty={resource.dirty}
              onSaveAction={handleSave}
              onSaveAsAction={handleSaveAs}
              onLoadAction={resource.openLoad}
            />
          </>
        }
      />

      <div className="px-5 py-3 border-b border-separator bg-surface">
        <div className="flex items-center gap-2">
          <span className="text-muted text-sm">/</span>
          <Input
            className="flex-1 font-mono"
            placeholder="输入正则表达式..."
            value={pattern}
            onChange={(e) => {
              setPattern(e.target.value)
              resource.setDirty(true)
            }}
          />
          <span className="text-muted text-sm">/</span>
          <Toolbar aria-label="正则选项" className="gap-0 bg-transparent p-0">
            <ToggleButtonGroup
              aria-label="正则标志"
              selectedKeys={flags}
              selectionMode="multiple"
              onSelectionChange={handleFlagsChange}
            >
              {FLAG_OPTIONS.map((f, i) => (
                <ToggleButton
                  key={f.id}
                  id={f.id}
                  aria-label={f.description}
                  className="w-8 h-8 min-w-0 p-0 font-mono text-xs"
                >
                  {i > 0 && <ToggleButtonGroup.Separator />}
                  {f.name}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Separator orientation="vertical" className="mx-1 h-5" />
            <Tooltip delay={0}>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="复制正则"
                onPress={copyPattern}
              >
                {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
              </Button>
              <Tooltip.Content>{copied ? "已复制" : "复制正则"}</Tooltip.Content>
            </Tooltip>
          </Toolbar>
        </div>
        {error && <p className="text-xs text-danger mt-2 font-mono">{error}</p>}
      </div>

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 border-r border-separator">
          <div className="h-9 px-4 flex items-center gap-2 border-b border-separator bg-surface shrink-0">
            <span className="text-xs text-muted font-medium">测试文本</span>
            <div className="flex-1" />
            <Tooltip delay={0}>
              <Button size="sm" variant="ghost" onPress={openVarModal}>
                <Plus size={12} />
                <span className="text-xs">插入变量</span>
              </Button>
              <Tooltip.Content>从其他工具保存的数据中插入</Tooltip.Content>
            </Tooltip>
          </div>
          <div className="flex-1 relative">
            {highlightedText && (
              <div className="absolute inset-0 p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all pointer-events-none overflow-auto">
                {highlightedText.map((part, i) => (
                  <span
                    key={i}
                    className={part.isMatch ? "bg-accent/20 text-accent rounded px-0.5" : ""}
                  >
                    {part.text}
                  </span>
                ))}
              </div>
            )}
            <textarea
              className="w-full h-full p-4 font-mono text-sm leading-relaxed bg-transparent resize-none outline-none"
              style={{
                color: highlightedText ? "transparent" : undefined,
                caretColor: "var(--foreground)",
              }}
              placeholder="输入要测试的文本..."
              value={testString}
              onChange={(e) => {
                setTestString(e.target.value)
                resource.setDirty(true)
              }}
            />
          </div>
        </div>

        <div className="w-80 flex flex-col min-w-0 bg-surface">
          <div className="h-9 px-4 flex items-center border-b border-separator shrink-0">
            <span className="text-xs text-muted font-medium">匹配结果</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {matches.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted text-sm">
                {pattern && testString ? "无匹配" : "输入正则和文本"}
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {matches.map((match, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-background border border-separator hover:border-accent/30 transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Chip size="sm" variant="soft" color="accent">
                        #{i + 1}
                      </Chip>
                      <span className="text-xs text-muted">
                        位置 {match.index}-{match.index + match.length}
                      </span>
                    </div>
                    <p className="font-mono text-xs bg-surface-secondary rounded px-2 py-1.5 break-all">
                      {match.text || <span className="text-muted italic">空字符串</span>}
                    </p>
                    {match.groups && Object.keys(match.groups).length > 0 && (
                      <div className="mt-2 pt-2 border-t border-separator">
                        <p className="text-xs text-muted mb-1">捕获组：</p>
                        {Object.entries(match.groups).map(([name, value]) => (
                          <div key={name} className="flex items-center gap-2 text-xs">
                            <span className="text-accent font-mono">{name}</span>
                            <span className="text-muted">→</span>
                            <span className="font-mono">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <SaveModal
        isOpen={resource.saveOpen}
        onOpenChangeAction={(o) => (o ? null : resource.closeSave())}
        title={resource.currentName ? "另存为" : "保存正则"}
        name={resource.saveName}
        onNameChangeAction={resource.setSaveName}
        onSaveAction={handleSaveConfirm}
        placeholder="给这个正则起个名字"
      />

      <LoadModal
        isOpen={resource.loadOpen}
        onOpenChangeAction={(o) => (o ? null : resource.closeLoad())}
        title="加载已保存的正则"
        items={resource.items}
        onLoadAction={handleLoad}
        onDeleteAction={resource.remove}
        emptyText="暂无保存的正则"
      />

      <ModalShell
        isOpen={varModalOpen}
        onOpenChangeAction={setVarModalOpen}
        title="插入变量"
        icon={Plus}
      >
        <p className="text-xs text-muted mb-3">
          从其他工具保存的数据中选择内容，插入到测试文本中。
        </p>
        {availableVars.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">
            暂无可用数据，请先在其他工具中保存内容
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {availableVars.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors"
                onClick={() => insertVar(v.content)}
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
