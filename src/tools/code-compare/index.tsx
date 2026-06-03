import { useState, useCallback, useEffect } from "react";
import { Button, Chip, Tooltip, Select, ListBox } from "@heroui/react";
import { GitCompareArrows, FolderOpen } from "lucide-react";
import { DiffView } from "./DiffView";
import { kvGet, kvKeys } from "../../utils/db";

type LoadTarget = "left" | "right";

const LANGUAGES = [
  { id: "html", name: "HTML" },
  { id: "json", name: "JSON" },
  { id: "text", name: "纯文本" },
];

export function CodeCompare() {
  const [leftCode, setLeftCode] = useState("");
  const [rightCode, setRightCode] = useState("");
  const [language, setLanguage] = useState("html");

  // 加载面板
  const [loadTarget, setLoadTarget] = useState<LoadTarget | null>(null);
  const [savedKeys, setSavedKeys] = useState<string[]>([]);

  const loadSavedKeys = useCallback(async () => {
    const keys = await kvKeys();
    const filtered = keys.filter((k) => k.includes(":saved:"));
    setSavedKeys(filtered);
  }, []);

  useEffect(() => {
    if (loadTarget) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadSavedKeys();
    }
  }, [loadTarget, loadSavedKeys]);

  const handleLoadFromDB = async (key: string) => {
    const item = await kvGet<Record<string, unknown>>(key);
    if (!item) return;
    const content =
      (item as { html?: string }).html ||
      (item as { body?: string }).body ||
      JSON.stringify(item, null, 2);
    if (loadTarget === "left") setLeftCode(content);
    else setRightCode(content);
    setLoadTarget(null);
  };

  const leftLines = leftCode.split("\n").length;
  const rightLines = rightCode.split("\n").length;

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b border-separator flex items-center px-5 gap-2 shrink-0">
        <GitCompareArrows size={16} className="text-accent" />
        <h1 className="text-sm font-semibold">代码对比</h1>
        <span className="text-xs text-muted">粘贴两份代码，高亮差异</span>
        <div className="flex-1" />

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
          <Button size="sm" variant="ghost" onPress={() => setLoadTarget("left")}>
            <FolderOpen size={14} />
            <span className="text-xs">加载 A</span>
          </Button>
          <Tooltip.Content>加载到左侧 (A)</Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button size="sm" variant="ghost" onPress={() => setLoadTarget("right")}>
            <FolderOpen size={14} />
            <span className="text-xs">加载 B</span>
          </Button>
          <Tooltip.Content>加载到右侧 (B)</Tooltip.Content>
        </Tooltip>

        <Chip size="sm" variant="soft" color="default">
          <Chip.Label>
            {leftLines} 行 vs {rightLines} 行
          </Chip.Label>
        </Chip>
      </header>

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
      {loadTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl border border-separator shadow-xl w-[480px] max-h-[70vh] flex flex-col">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-separator">
              <FolderOpen size={18} className="text-accent" />
              <h2 className="text-sm font-semibold">
                加载到{loadTarget === "left" ? "左侧 (A)" : "右侧 (B)"}
              </h2>
              <div className="flex-1" />
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onPress={() => setLoadTarget(null)}
              >
                ✕
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {savedKeys.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">
                  暂无保存的资源
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {savedKeys.map((key) => {
                    const display = key.replace(/^.*?:saved:/, "");
                    const tool = key.includes("html-selector")
                      ? "HTML 选择器"
                      : "API 请求";
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary hover:bg-surface-tertiary transition-colors cursor-pointer"
                        onClick={() => handleLoadFromDB(key)}
                      >
                        <Chip size="sm" variant="soft" color="default">
                          <Chip.Label className="text-xs">{tool}</Chip.Label>
                        </Chip>
                        <span className="text-sm truncate flex-1">
                          {display}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
