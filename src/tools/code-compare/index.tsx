"use client"

import { useCallback, useState } from "react"
import { Button, Chip, ListBox, Select, Separator, Toolbar, Tooltip } from "@heroui/react"
import { ArrowLeftRight, FolderOpen, GitCompareArrows } from "lucide-react"
import { DiffView } from "./DiffView"
import { kvGetAll } from "@/utils/db"
import { LoadModal } from "@/components/LoadModal"
import { ToolHeader } from "@/components/ToolHeader"
import { TOOL_NAME_LABELS, TOOL_REGISTRY } from "@/lib/tool-registry"

type LoadTarget = "left" | "right"

type SavedItem = {
  id: string
  name: string
  toolName: string
  savedAt: number
  content: string
}

const LANGUAGES = [
  { id: "html", name: "HTML" },
  { id: "json", name: "JSON" },
  { id: "text", name: "纯文本" },
] as const

const CATEGORY_BY_KEY = (key: string) => {
  for (const tool of Object.values(TOOL_REGISTRY)) {
    if (tool.prefix && key.startsWith(tool.prefix)) return tool
  }
  return null
}

export function CodeCompare() {
  const [leftCode, setLeftCode] = useState("")
  const [rightCode, setRightCode] = useState("")
  const [language, setLanguage] = useState<(typeof LANGUAGES)[number]["id"]>("html")

  const [loadTarget, setLoadTarget] = useState<LoadTarget | null>(null)
  const [savedItems, setSavedItems] = useState<SavedItem[]>([])

  const loadSavedList = useCallback(async () => {
    const all = await kvGetAll<Record<string, unknown>>()
    const items: SavedItem[] = []
    for (const [key, item] of all) {
      if (!key.includes(":saved:") || !item) continue
      const tool = CATEGORY_BY_KEY(key)
      const content =
        (item.html as string) ||
        (item.content as string) ||
        (item.body as string) ||
        (item.testString as string) ||
        JSON.stringify(item, null, 2)
      items.push({
        id: key,
        name: (item.name as string) || key.replace(/^.*?:saved:/, ""),
        toolName: tool ? TOOL_NAME_LABELS[tool.id] || tool.name : "其他",
        savedAt: (item.savedAt as number) || 0,
        content,
      })
    }
    items.sort((a, b) => b.savedAt - a.savedAt)
    setSavedItems(items)
  }, [])

  // 用户点击"加载"按钮时直接拉取 + 打开面板
  const openLoad = (target: LoadTarget) => {
    void loadSavedList().then(() => setLoadTarget(target))
  }

  const handleLoadItem = (item: SavedItem) => {
    if (loadTarget === "left") setLeftCode(item.content)
    else setRightCode(item.content)
    setLoadTarget(null)
  }

  const leftLines = leftCode.split("\n").length
  const rightLines = rightCode.split("\n").length

  const handleSwap = () => {
    setLeftCode(rightCode)
    setRightCode(leftCode)
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <ToolHeader
        icon={GitCompareArrows}
        title="代码对比"
        subtitle="粘贴两份代码，高亮差异"
        extra={
          <Toolbar aria-label="对比选项" className="gap-1 bg-transparent p-0">
            <Select
              className="w-24"
              value={language}
              onChange={(key) => {
                if (key) setLanguage(key as (typeof LANGUAGES)[number]["id"])
              }}
            >
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {LANGUAGES.map((l) => (
                    <ListBox.Item key={l.id} id={l.id} textValue={l.name}>
                      {l.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>

            <Separator orientation="vertical" className="mx-1 h-5" />

            <Tooltip delay={0}>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="加载 A"
                onPress={() => openLoad("left")}
              >
                <FolderOpen size={14} />
              </Button>
              <Tooltip.Content>加载到左侧 (A)</Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0}>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="加载 B"
                onPress={() => openLoad("right")}
              >
                <FolderOpen size={14} />
              </Button>
              <Tooltip.Content>加载到右侧 (B)</Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0}>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label="交换 A/B"
                isDisabled={!leftCode && !rightCode}
                onPress={handleSwap}
              >
                <ArrowLeftRight size={14} />
              </Button>
              <Tooltip.Content>交换 A/B</Tooltip.Content>
            </Tooltip>

            <Separator orientation="vertical" className="mx-1 h-5" />

            <Chip size="sm" variant="soft" color="default">
              {leftLines} 行 vs {rightLines} 行
            </Chip>
          </Toolbar>
        }
      />

      <div className="flex-1 min-h-0">
        <DiffView
          leftValue={leftCode}
          rightValue={rightCode}
          onLeftChange={setLeftCode}
          onRightChange={setRightCode}
          language={language}
        />
      </div>

      <LoadModal
        isOpen={!!loadTarget}
        onOpenChangeAction={(open) => {
          if (!open) setLoadTarget(null)
        }}
        title={`加载到${loadTarget === "left" ? "左侧 (A)" : "右侧 (B)"}`}
        items={savedItems}
        onLoadAction={handleLoadItem}
        emptyText="暂无保存的资源"
        renderMetaAction={(item) => (
          <Chip size="sm" variant="soft" color="default">
            {item.toolName}
          </Chip>
        )}
      />
    </div>
  )
}
