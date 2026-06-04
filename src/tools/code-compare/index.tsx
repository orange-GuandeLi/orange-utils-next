import { useState, useCallback, useEffect } from "react";
import { Button, Chip, Tooltip, Select, ListBox } from "@heroui/react";
import { GitCompareArrows, FolderOpen } from "lucide-react";
import { DiffView } from "./DiffView";
import { kvGet, kvKeys } from "../../utils/db";
import { LoadModal } from "../../components/LoadModal";
import { ToolHeader } from "../../components/ToolHeader";

type LoadTarget = "left" | "right";

type SavedItem = {
  id: string;
  name: string;
  toolName: string;
  savedAt: number;
  content: string;
};

const LANGUAGES = [
  { id: "html", name: "HTML" },
  { id: "json", name: "JSON" },
  { id: "text", name: "纯文本" },
];

const TOOL_LABELS: Record<string, string> = {
  "html-selector": "HTML 选择器",
  "api-request": "API 请求",
  "regex-tester": "正则测试",
  "markdown": "Markdown",
};

export function CodeCompare() {
  const [leftCode, setLeftCode] = useState("");
  const [rightCode, setRightCode] = useState("");
  const [language, setLanguage] = useState("html");

  // 加载面板
  const [loadTarget, setLoadTarget] = useState<LoadTarget | null>(null);
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);

  const loadSavedList = useCallback(async () => {
    const keys = await kvKeys();
    const items: SavedItem[] = [];
    for (const key of keys) {
      if (!key.includes(":saved:")) continue;
      const item = await kvGet<Record<string, unknown>>(key);
      if (!item) continue;
      const raw = item as { name?: string; savedAt?: number };
      const content =
        (item as { html?: string }).html ||
        (item as { body?: string }).body ||
        JSON.stringify(item, null, 2);
      const toolId = key.split(":saved:")[0] || "";
      items.push({
        id: key,
        name: raw.name || key.replace(/^.*?:saved:/, ""),
        toolName: TOOL_LABELS[toolId] || toolId,
        savedAt: raw.savedAt || 0,
        content,
      });
    }
    items.sort((a, b) => b.savedAt - a.savedAt);
    setSavedItems(items);
  }, []);

  useEffect(() => {
    if (loadTarget) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadSavedList();
    }
  }, [loadTarget, loadSavedList]);

  const handleLoadItem = (item: SavedItem) => {
    if (loadTarget === "left") setLeftCode(item.content);
    else setRightCode(item.content);
    setLoadTarget(null);
  };

  const leftLines = leftCode.split("\n").length;
  const rightLines = rightCode.split("\n").length;

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <ToolHeader
        icon={GitCompareArrows}
        title="代码对比"
        subtitle="粘贴两份代码，高亮差异"
        extra={
          <>
            <Select
              className="w-24"
              selectedKey={language}
              onSelectionChange={(key) => {
                if (key) setLanguage(key as string);
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

            <Tooltip delay={0}>
              <Tooltip.Trigger className="flex flex-col">
                <Button isIconOnly size="sm" variant="ghost" aria-label="加载 A" onPress={() => setLoadTarget("left")}>
                  <FolderOpen size={14} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>加载到左侧 (A)</Tooltip.Content>
            </Tooltip>
            <Tooltip delay={0}>
              <Tooltip.Trigger className="flex flex-col">
                <Button isIconOnly size="sm" variant="ghost" aria-label="加载 B" onPress={() => setLoadTarget("right")}>
                  <FolderOpen size={14} />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content>加载到右侧 (B)</Tooltip.Content>
            </Tooltip>

            <Chip size="sm" variant="soft" color="default">
              <Chip.Label>
                {leftLines} 行 vs {rightLines} 行
              </Chip.Label>
            </Chip>
          </>
        }
      />

      {/* Main: MergeView */}
      <div className="flex-1 min-h-0">
        <DiffView
          leftValue={leftCode}
          rightValue={rightCode}
          onLeftChange={setLeftCode}
          onRightChange={setRightCode}
          language={language}
        />
      </div>

      {/* 从资源加载 Modal */}
      <LoadModal
        isOpen={!!loadTarget}
        onOpenChange={(open) => { if (!open) setLoadTarget(null); }}
        title={`加载到${loadTarget === "left" ? "左侧 (A)" : "右侧 (B)"}`}
        items={savedItems}
        onLoad={handleLoadItem}
        emptyText="暂无保存的资源"
        renderMeta={(item) => (
          <Chip size="sm" variant="soft" color="default">
            <Chip.Label className="text-xs">{item.toolName}</Chip.Label>
          </Chip>
        )}
      />
    </div>
  );
}
