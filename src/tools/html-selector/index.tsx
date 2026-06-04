"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button, Chip, Tooltip, toast } from "@heroui/react"
import { Check, Code2, Copy, Eye, GripVertical, SquareDashedMousePointer } from "lucide-react"
import { ToolHeader } from "@/components/ToolHeader"
import { ToolActionButtons } from "@/components/ToolActionButtons"
import { LoadModal } from "@/components/LoadModal"
import { SaveModal } from "@/components/SaveModal"
import { ModalShell } from "@/components/ModalShell"
import { CodeEditor } from "./CodeEditor"
import { useIframeSelector, type SelectionInfo } from "./hooks/useIframeSelector"
import { useResource, type SavedItem } from "@/hooks/use-resource"
import { kvGet } from "@/utils/db"
import { TOOL_REGISTRY } from "@/lib/tool-registry"

type HtmlSelectorSaved = SavedItem & {
  html: string
}

const STORAGE_PREFIX = TOOL_REGISTRY["html-selector"].prefix!

// 复制信息项
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-xs text-muted w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-foreground font-mono flex-1 break-all min-w-0">
        {value || "-"}
      </span>
      <Tooltip delay={0}>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="shrink-0"
          aria-label="复制"
          onPress={handleCopy}
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
        </Button>
        <Tooltip.Content>{copied ? "已复制" : "复制"}</Tooltip.Content>
      </Tooltip>
    </div>
  )
}

export function HtmlSelector({ initialLoadName }: { initialLoadName?: string }) {
  const [html, setHtml] = useState(SAMPLE_HTML)
  const [previewHtml, setPreviewHtml] = useState(SAMPLE_HTML)
  const rafRef = useRef<number>(0)

  // 组件卸载时取消未执行的 RAF
  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  const [selectMode, setSelectMode] = useState(false)
  const [selectedInfo, setSelectedInfo] = useState<SelectionInfo | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // 分隔条
  const [editorWidth, setEditorWidth] = useState(50)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [previewPx, setPreviewPx] = useState(0)

  const resource = useResource<HtmlSelectorSaved>(STORAGE_PREFIX)

  const updatePreviewWidth = useCallback(() => {
    if (!containerRef.current) return
    const containerW = containerRef.current.getBoundingClientRect().width
    const dividerW = 6
    setPreviewPx(Math.round(containerW * (1 - editorWidth / 100) - dividerW))
  }, [editorWidth])

  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (resizeObserverRef.current) resizeObserverRef.current.disconnect()
      if (node) {
        containerRef.current = node
        const ro = new ResizeObserver(() => updatePreviewWidth())
        ro.observe(node)
        resizeObserverRef.current = ro
        updatePreviewWidth()
      }
    },
    [updatePreviewWidth],
  )

  const handleSelected = useCallback((info: SelectionInfo) => {
    setSelectedInfo(info)
    setModalOpen(true)
  }, [])

  const handleExit = useCallback(() => {
    setSelectMode(false)
    setSelectedInfo(null)
    setModalOpen(false)
  }, [])

  useIframeSelector({
    iframeRef,
    selectMode,
    onSelected: handleSelected,
    onExit: handleExit,
  })

  // URL 参数加载（仅执行一次）
  useEffect(() => {
    if (!initialLoadName) return
    void (async () => {
      const item = await kvGet<HtmlSelectorSaved>(STORAGE_PREFIX + initialLoadName)
      if (!item) return
      setHtml(item.html)
      setPreviewHtml(item.html)
      setSelectMode(false)
      setSelectedInfo(null)
      setModalOpen(false)
      resource.load(item)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoadName])

  const handleSave = async () => {
    if (resource.currentName) {
      const ok = await resource.overwrite({ html } as HtmlSelectorSaved)
      if (ok) toast.success(`已保存「${resource.currentName}」`)
    } else {
      resource.openSave()
    }
  }

  const handleSaveConfirm = async () => {
    const name = await resource.save({ html } as HtmlSelectorSaved)
    if (name) toast.success(`已保存「${name}」`)
  }

  const handleLoad = (item: HtmlSelectorSaved) => {
    const loaded = resource.load(item)
    setHtml(loaded.html)
    setPreviewHtml(loaded.html)
    setSelectMode(false)
    setSelectedInfo(null)
    setModalOpen(false)
  }

  const handleSaveAs = () => resource.openSave(resource.currentName ?? "")

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
    document.body.style.pointerEvents = "none"

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const percent = ((e.clientX - rect.left) / rect.width) * 100
      setEditorWidth(Math.min(80, Math.max(20, percent)))
      const dividerW = 6
      setPreviewPx(Math.round(rect.width * (1 - percent / 100) - dividerW))
    }

    const onMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
      document.body.style.pointerEvents = ""
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }, [])

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <ToolHeader
        icon={Code2}
        title="HTML 选择器"
        subtitle="粘贴 HTML → 实时预览 → 选择元素 → 查看信息"
        extra={
          <>
            <ToolActionButtons
              currentName={resource.currentName}
              dirty={resource.dirty}
              onSaveAction={handleSave}
              onSaveAsAction={handleSaveAs}
              onLoadAction={resource.openLoad}
            />
            <Chip size="sm" variant="soft" color="default" className="font-mono">
              <Chip.Label>{previewPx}px</Chip.Label>
            </Chip>
          </>
        }
      />

      <div className="flex items-center gap-2 px-5 py-2 border-b border-separator shrink-0 justify-end">
        <Button
          size="sm"
          className="text-xs"
          variant={selectMode ? "danger" : "primary"}
          onPress={(e) => {
            ;(e.target as HTMLElement)?.blur?.()
            if (selectMode) {
              setSelectMode(false)
              setSelectedInfo(null)
              setModalOpen(false)
            } else {
              setSelectMode(true)
              setSelectedInfo(null)
            }
          }}
        >
          <SquareDashedMousePointer size={14} />
          {selectMode ? "退出选择 (ESC)" : "选择元素"}
        </Button>
        {selectMode && (
          <Chip size="sm" variant="soft" color="default">
            <Chip.Label>Shift 切父级 / Tab 切重叠</Chip.Label>
          </Chip>
        )}
        {selectedInfo && selectMode && (
          <Tooltip delay={0}>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label="查看选中信息"
              onPress={() => setModalOpen(true)}
            >
              <Eye size={14} />
            </Button>
            <Tooltip.Content>查看选中信息</Tooltip.Content>
          </Tooltip>
        )}
      </div>

      <div ref={setContainerRef} className="flex-1 flex min-h-0 relative select-none">
        <div
          className="border-r border-separator flex flex-col shrink-0 overflow-hidden"
          style={{ width: `${editorWidth}%` }}
        >
          <div className="px-4 py-2.5 border-b border-separator flex items-center gap-2">
            <Code2 size={14} className="text-muted" />
            <span className="text-xs text-muted font-medium">HTML 输入</span>
          </div>
          <div className="flex-1 min-h-0">
            <CodeEditor
              value={html}
              onChange={(v) => {
                setHtml(v)
                resource.setDirty(true)
                setSelectMode(false)
                setSelectedInfo(null)
                setModalOpen(false)
                // RAF 节流：预览跟随浏览器刷新率更新
                cancelAnimationFrame(rafRef.current)
                rafRef.current = requestAnimationFrame(() => {
                  setPreviewHtml(v)
                })
              }}
            />
          </div>
        </div>

        <div
          className={`w-1.5 shrink-0 flex items-center justify-center cursor-col-resize hover:bg-accent/20 transition-colors ${
            isDragging ? "bg-accent/30" : "bg-surface"
          }`}
          onMouseDown={handleMouseDown}
        >
          <GripVertical size={12} className="text-muted" />
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0 bg-surface relative">
            <iframe
              ref={iframeRef}
              sandbox="allow-scripts allow-same-origin"
              srcDoc={previewHtml}
              className="w-full h-full border-none"
            />
            {selectMode && !selectedInfo && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
                <Chip size="lg" variant="primary" color="danger" className="animate-pulse">
                  <Chip.Label>点击页面中的元素进行选择</Chip.Label>
                </Chip>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedInfo && (
        <ModalShell
          isOpen={modalOpen}
          onOpenChangeAction={setModalOpen}
          title="选中元素信息"
          icon={Eye}
          width="sm:max-w-lg"
        >
          <div className="divide-y divide-separator">
            <CopyField label="选择器" value={selectedInfo.selector} />
            <CopyField label="标签" value={selectedInfo.tagName} />
            <CopyField label="ID" value={selectedInfo.id} />
            <CopyField label="类名" value={selectedInfo.className} />
            <CopyField
              label="尺寸"
              value={`${selectedInfo.rect.width} × ${selectedInfo.rect.height}`}
            />
            <CopyField
              label="位置"
              value={`top=${selectedInfo.rect.top}, left=${selectedInfo.rect.left}`}
            />
            {selectedInfo.editableType && (
              <>
                <CopyField label="可编辑" value={selectedInfo.editableType} />
                <CopyField label="值" value={selectedInfo.editableValue || ""} />
              </>
            )}
            <CopyField label="文本" value={selectedInfo.textContent} />
            <CopyField label="outerHTML" value={selectedInfo.outerHTML} />
          </div>
        </ModalShell>
      )}

      <SaveModal
        isOpen={resource.saveOpen}
        onOpenChangeAction={(o) => (o ? null : resource.closeSave())}
        title={resource.currentName ? "另存为" : "保存代码"}
        name={resource.saveName}
        onNameChangeAction={resource.setSaveName}
        onSaveAction={handleSaveConfirm}
        placeholder="给这次保存起个名字"
      />

      <LoadModal
        isOpen={resource.loadOpen}
        onOpenChangeAction={(o) => (o ? null : resource.closeLoad())}
        title="加载已保存的代码"
        items={resource.items}
        onLoadAction={handleLoad}
        onDeleteAction={resource.remove}
        emptyText="暂无保存的代码"
      />
    </div>
  )
}

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: #f8fafc; color: #1e293b; }
    .hero { padding: 60px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .hero h1 { font-size: 2.5rem; margin-bottom: 12px; }
    .hero p { font-size: 1.1rem; opacity: 0.9; }
    .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; padding: 40px; max-width: 900px; margin: 0 auto; }
    .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .card h3 { font-size: 1.1rem; margin-bottom: 8px; }
    .card p { font-size: 0.9rem; color: #64748b; line-height: 1.5; }
    .footer { text-align: center; padding: 30px; color: #94a3b8; font-size: 0.85rem; }
  </style>
</head>
<body>
  <div class="hero">
    <h1>示例页面</h1>
    <p>这是一个用于测试 HTML 选择器的示例页面</p>
  </div>
  <div class="cards">
    <div class="card">
      <h3>🚀 快速</h3>
      <p>高效的开发体验，快速构建你的项目。</p>
    </div>
    <div class="card">
      <h3>🎨 美观</h3>
      <p>精心设计的界面，让你的项目脱颖而出。</p>
    </div>
    <div class="card">
      <h3>🔧 灵活</h3>
      <p>高度可定制，满足各种需求。</p>
    </div>
  </div>
  <div class="footer">
    <p>© 2026 示例页面</p>
  </div>
</body>
</html>`
