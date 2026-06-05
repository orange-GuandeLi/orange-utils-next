"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { FileCode } from "lucide-react"
import { LoadModal } from "@/components/LoadModal"
import { SaveModal } from "@/components/SaveModal"
import { ToolHeader } from "@/components/ToolHeader"
import { ToolActionButtons } from "@/components/ToolActionButtons"
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor"
import { useResource, type SavedItem } from "@/hooks/use-resource"
import { kvGet } from "@/utils/db"
import { TOOL_REGISTRY } from "@/lib/tool-registry"
import { toast } from "@heroui/react"

type MarkdownSaved = SavedItem & {
  content: string
}

const STORAGE_PREFIX = TOOL_REGISTRY.markdown.prefix!

export default function MarkdownPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center text-muted text-sm">加载中...</div>
      }
    >
      <MarkdownEditor />
    </Suspense>
  )
}

function MarkdownEditor() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [content, setContent] = useState("")
  const resource = useResource<MarkdownSaved>(STORAGE_PREFIX)

  // URL 参数加载
  useEffect(() => {
    const name = searchParams.get("load")
    if (!name) return
    void (async () => {
      const item = await kvGet<MarkdownSaved>(STORAGE_PREFIX + name)
      if (!item) return
      setContent(item.content)
      resource.load(item)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleSave = async () => {
    if (resource.currentName) {
      const ok = await resource.overwrite({ content } as MarkdownSaved)
      if (ok) toast.success(`已保存「${resource.currentName}」`)
    } else {
      resource.openSave()
    }
  }

  const handleSaveConfirm = async () => {
    const name = await resource.save({ content } as MarkdownSaved)
    if (name) toast.success(`已保存「${name}」`)
  }

  const handleLoad = (item: MarkdownSaved) => {
    const loaded = resource.load(item)
    setContent(loaded.content)
    router.push(`/tools/markdown?load=${encodeURIComponent(loaded.name)}`, { scroll: false })
  }

  const handleNew = () => {
    setContent("")
    resource.reset()
    router.push("/tools/markdown", { scroll: false })
  }

  const handleSaveAs = () => resource.openSave(resource.currentName ?? "")

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <ToolHeader
        icon={FileCode}
        title="Markdown"
        subtitle="富文本编辑 → 保存资源 → 统一管理"
        extra={
          <ToolActionButtons
            currentName={resource.currentName}
            dirty={resource.dirty}
            onSaveAction={handleSave}
            onSaveAsAction={handleSaveAs}
            onLoadAction={resource.openLoad}
            onNewAction={handleNew}
          />
        }
      />

      <div className="flex-1 overflow-hidden">
        <SimpleEditor
          initialContent={content}
          onUpdateAction={(html) => {
            setContent(html)
            resource.setDirty(true)
          }}
        />
      </div>

      <SaveModal
        isOpen={resource.saveOpen}
        onOpenChangeAction={(o) => (o ? null : resource.closeSave())}
        title={resource.currentName ? "另存为" : "保存Markdown"}
        name={resource.saveName}
        onNameChangeAction={resource.setSaveName}
        onSaveAction={handleSaveConfirm}
        placeholder="给这次保存起个名字"
      />

      <LoadModal
        isOpen={resource.loadOpen}
        onOpenChangeAction={(o) => (o ? null : resource.closeLoad())}
        title="加载已保存的Markdown"
        items={resource.items}
        onLoadAction={handleLoad}
        onDeleteAction={resource.remove}
        emptyText="暂无保存的Markdown"
        toolName="Markdown"
      />
    </div>
  )
}
