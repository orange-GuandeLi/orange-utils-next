"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
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

type NoteSaved = SavedItem & {
  content: string
}

const STORAGE_PREFIX = TOOL_REGISTRY.notes.prefix!

export default function NotesPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center text-muted text-sm">加载中...</div>
      }
    >
      <NotesEditor />
    </Suspense>
  )
}

function NotesEditor() {
  const searchParams = useSearchParams()
  const [content, setContent] = useState("")
  const resource = useResource<NoteSaved>(STORAGE_PREFIX)

  // URL 参数加载
  useEffect(() => {
    const name = searchParams.get("load")
    if (!name) return
    void (async () => {
      const item = await kvGet<NoteSaved>(STORAGE_PREFIX + name)
      if (!item) return
      setContent(item.content)
      resource.load(item)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const handleSave = async () => {
    if (resource.currentName) {
      const ok = await resource.overwrite({ content } as NoteSaved)
      if (ok) toast.success(`已保存「${resource.currentName}」`)
    } else {
      resource.openSave()
    }
  }

  const handleSaveConfirm = async () => {
    const name = await resource.save({ content } as NoteSaved)
    if (name) toast.success(`已保存「${name}」`)
  }

  const handleLoad = (item: NoteSaved) => {
    const loaded = resource.load(item)
    setContent(loaded.content)
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
