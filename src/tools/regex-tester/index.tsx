"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Button, Chip, Tooltip, Input, Modal, Label, TextField } from "@heroui/react";
import { Regex, Copy, Check, Save, FolderOpen, Trash2 } from "lucide-react";
import { kvGet, kvSet, kvDelete, kvKeys } from "../../utils/db";

type MatchResult = {
  text: string;
  index: number;
  length: number;
  groups?: Record<string, string>;
};

const FLAG_OPTIONS = [
  { id: "g", name: "g", description: "全局匹配" },
  { id: "i", name: "i", description: "忽略大小写" },
  { id: "m", name: "m", description: "多行模式" },
  { id: "s", name: "s", description: "点号匹配换行" },
];

export function RegexTester() {
  const [pattern, setPattern] = useState("");
  const [flags, setFlags] = useState<Set<string>>(new Set(["g"]));
  const [testString, setTestString] = useState("");
  const [copied, setCopied] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedItems, setSavedItems] = useState<{ name: string; pattern: string; flags: string[]; testString: string; savedAt: number }[]>([]);

  // 加载已保存列表
  const loadSavedList = useCallback(async () => {
    const keys = await kvKeys();
    const items: { name: string; pattern: string; flags: string[]; testString: string; savedAt: number }[] = [];
    for (const key of keys) {
      if (key.startsWith("regex:saved:")) {
        const item = await kvGet<{ name: string; pattern: string; flags: string[]; testString: string; savedAt: number }>(key);
        if (item) items.push(item);
      }
    }
    items.sort((a, b) => b.savedAt - a.savedAt);
    setSavedItems(items);
  }, []);

  useEffect(() => {
    if (loadModalOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadSavedList();
    }
  }, [loadModalOpen, loadSavedList]);

  // 保存
  const handleSave = async () => {
    if (!saveName.trim()) return;
    await kvSet(`regex:saved:${saveName}`, {
      name: saveName,
      pattern,
      flags: Array.from(flags),
      testString,
      savedAt: Date.now(),
    });
    setSaveModalOpen(false);
    setSaveName("");
  };

  // 加载
  const handleLoad = (item: { pattern: string; flags: string[]; testString: string }) => {
    setPattern(item.pattern);
    setFlags(new Set(item.flags));
    setTestString(item.testString);
    setLoadModalOpen(false);
  };

  // 删除
  const handleDelete = async (name: string) => {
    await kvDelete(`regex:saved:${name}`);
    loadSavedList();
  };

  // 计算匹配结果
  // 正则匹配结果（Web Worker 防止灾难性回溯卡死主线程）
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pattern || !testString) {
      setMatches([]);
      setError(null);
      return;
    }

    // 终止上一次 worker
    if (workerRef.current) { workerRef.current.terminate(); workerRef.current = null; }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }

    const worker = new Worker(
      new URL("./regex.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    worker.onmessage = (e) => {
      const { matches: m, error: err } = e.data as { matches: MatchResult[]; error: string | null };
      setMatches(m);
      setError(err);
      worker.terminate();
      workerRef.current = null;
    };

    worker.onerror = () => {
      setMatches([]);
      setError("Worker 执行出错");
      worker.terminate();
      workerRef.current = null;
    };

    worker.postMessage({ pattern, flags: Array.from(flags).join(""), testString });

    // 500ms 超时保护（Worker 内部 200ms 已有，这里是兜底）
    timerRef.current = setTimeout(() => {
      if (workerRef.current === worker) {
        worker.terminate();
        workerRef.current = null;
        setMatches([]);
        setError("正则执行超时（500ms），可能存在灾难性回溯");
      }
    }, 500);

    return () => {
      worker.terminate();
      workerRef.current = null;
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [pattern, flags, testString]);

  // 高亮匹配文本
  const highlightedText = useMemo(() => {
    if (!matches.length || !testString) return null;
    const parts: { text: string; isMatch: boolean; matchIndex?: number }[] = [];
    let lastIndex = 0;

    matches.forEach((match, i) => {
      if (match.index > lastIndex) {
        parts.push({ text: testString.slice(lastIndex, match.index), isMatch: false });
      }
      parts.push({ text: match.text, isMatch: true, matchIndex: i });
      lastIndex = match.index + match.length;
    });

    if (lastIndex < testString.length) {
      parts.push({ text: testString.slice(lastIndex), isMatch: false });
    }

    return parts;
  }, [matches, testString]);

  const toggleFlag = (flag: string) => {
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(flag)) next.delete(flag);
      else next.add(flag);
      return next;
    });
  };

  const copyPattern = () => {
    const flagStr = Array.from(flags).join("");
    navigator.clipboard.writeText(`/${pattern}/${flagStr}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b border-separator flex items-center px-5 gap-2 shrink-0">
        <Regex size={16} className="text-accent" />
        <h1 className="text-sm font-semibold">正则测试</h1>
        <span className="text-xs text-muted">实时匹配，高亮显示</span>
        <div className="flex-1" />
        <Chip size="sm" variant="soft" color={error ? "danger" : "success"}>
          <Chip.Label className="text-xs">
            {error ? "语法错误" : pattern ? `${matches.length} 个匹配` : "输入正则"}
          </Chip.Label>
        </Chip>
      </header>

      {/* 正则输入 */}
      <div className="px-5 py-3 border-b border-separator bg-surface">
        <div className="flex items-center gap-2">
          <span className="text-muted text-sm">/</span>
          <Input
            className="flex-1 font-mono"
            placeholder="输入正则表达式..."
            value={pattern}
            onChange={(e) => setPattern((e.target as HTMLInputElement).value)}
          />
          <span className="text-muted text-sm">/</span>
          <div className="flex gap-1">
            {FLAG_OPTIONS.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={flags.has(f.id) ? "primary" : "ghost"}
                className="w-8 h-8 min-w-0 p-0 font-mono text-xs"
                onPress={() => toggleFlag(f.id)}
              >
                {f.name}
              </Button>
            ))}
          </div>
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" onPress={copyPattern}>
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </Button>
            <Tooltip.Content>{copied ? "已复制" : "复制正则"}</Tooltip.Content>
          </Tooltip>
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" onPress={() => setSaveModalOpen(true)}>
              <Save size={14} />
            </Button>
            <Tooltip.Content>保存正则</Tooltip.Content>
          </Tooltip>
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" onPress={() => setLoadModalOpen(true)}>
              <FolderOpen size={14} />
            </Button>
            <Tooltip.Content>加载正则</Tooltip.Content>
          </Tooltip>
        </div>
        {error && (
          <p className="text-xs text-danger mt-2 font-mono">{error}</p>
        )}
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左：测试文本 */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-separator">
          <div className="h-9 px-4 flex items-center border-b border-separator bg-surface shrink-0">
            <span className="text-xs text-muted font-medium">测试文本</span>
          </div>
          <div className="flex-1 relative">
            {/* 高亮层 */}
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
            {/* 输入框 */}
            <textarea
              className="w-full h-full p-4 font-mono text-sm leading-relaxed bg-transparent resize-none outline-none"
              style={{ color: highlightedText ? "transparent" : undefined, caretColor: "var(--foreground)" }}
              placeholder="输入要测试的文本..."
              value={testString}
              onChange={(e) => setTestString(e.target.value)}
            />
          </div>
        </div>

        {/* 右：匹配结果 */}
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
                        <Chip.Label className="text-xs">#{i + 1}</Chip.Label>
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
      {/* 保存 Modal */}
      <Modal.Backdrop isOpen={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-sm">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent"><Save className="size-5" /></Modal.Icon>
              <Modal.Heading>保存正则</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <TextField value={saveName} onChange={setSaveName}>
                <Label>名称</Label>
                <Input placeholder="给这个正则起个名字" onKeyDown={(e) => e.key === "Enter" && handleSave()} />
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">取消</Button>
              <Button slot="close" onPress={handleSave} isDisabled={!saveName.trim()}>保存</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* 加载 Modal */}
      <Modal.Backdrop isOpen={loadModalOpen} onOpenChange={setLoadModalOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent"><FolderOpen className="size-5" /></Modal.Icon>
              <Modal.Heading>加载已保存的正则</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {savedItems.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">暂无保存的正则</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {savedItems.map((item) => (
                    <div key={item.name} className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary hover:bg-surface-tertiary transition-colors">
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{item.name}</span>
                        <p className="text-xs text-muted font-mono truncate mt-0.5">/{item.pattern}/{item.flags.join("")}</p>
                      </div>
                      <Button size="sm" variant="secondary" onPress={() => handleLoad(item)}>加载</Button>
                      <Tooltip delay={0}>
                        <Button isIconOnly size="sm" variant="ghost" onPress={() => handleDelete(item.name)}>
                          <Trash2 size={14} className="text-danger" />
                        </Button>
                        <Tooltip.Content>删除</Tooltip.Content>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}