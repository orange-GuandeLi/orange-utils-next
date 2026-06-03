import { useState, useRef, useCallback, useEffect } from "react";
import { Button, Chip, Tooltip, Modal, Input, Label, TextField, toast } from "@heroui/react";
import {
  SquareDashedMousePointer,
  Copy,
  Code2,
  Eye,
  GripVertical,
  Check,
  Save,
  FolderOpen,
  FileDown,
} from "lucide-react";
import { CodeEditor } from "./CodeEditor";
import {
  useIframeSelector,
  type SelectionInfo,
} from "./hooks/useIframeSelector";
import { kvGet, kvSet, kvDelete, kvKeys } from "../../utils/db";
import { LoadModal } from "../../components/LoadModal";
import { SaveModal } from "../../components/SaveModal";

// 保存的数据结构
type SavedItem = {
  name: string;
  html: string;
  savedAt: number;
};

const STORAGE_PREFIX = "html-selector:saved:";

// 可复制的信息项
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="text-xs text-muted w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-xs text-foreground font-mono flex-1 break-all min-w-0">
        {value || "-"}
      </span>
      <Tooltip delay={0}>
        <Button isIconOnly size="sm" variant="ghost" className="shrink-0" onPress={handleCopy}>
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
        </Button>
        <Tooltip.Content>{copied ? "已复制" : "复制"}</Tooltip.Content>
      </Tooltip>
    </div>
  );
}

export function HtmlSelector({ initialLoadName }: { initialLoadName?: string }) {
  const [html, setHtml] = useState(SAMPLE_HTML);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedInfo, setSelectedInfo] = useState<SelectionInfo | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 分隔条
  const [editorWidth, setEditorWidth] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [previewPx, setPreviewPx] = useState(0);

  // 保存/加载
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);

  const updatePreviewWidth = useCallback(() => {
    if (!containerRef.current) return;
    const containerW = containerRef.current.getBoundingClientRect().width;
    const dividerW = 6;
    setPreviewPx(Math.round(containerW * (1 - editorWidth / 100) - dividerW));
  }, [editorWidth]);

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (resizeObserverRef.current) resizeObserverRef.current.disconnect();
    if (node) {
      (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      const ro = new ResizeObserver(() => updatePreviewWidth());
      ro.observe(node);
      resizeObserverRef.current = ro;
      updatePreviewWidth();
    }
  }, [updatePreviewWidth]);

  const handleSelected = useCallback((info: SelectionInfo) => {
    setSelectedInfo(info);
    setModalOpen(true);
  }, []);

  const handleExit = useCallback(() => {
    setSelectMode(false);
    setSelectedInfo(null);
    setModalOpen(false);
  }, []);

  useEffect(() => {
    if (!initialLoadName) return;
    (async () => {
      const item = await kvGet<SavedItem>(STORAGE_PREFIX + initialLoadName);
      if (item) {
        setHtml(item.html);
        setCurrentName(item.name);
        setDirty(false);
        setSelectMode(false);
        setSelectedInfo(null);
        setModalOpen(false);
      }
    })();
  }, [initialLoadName]);

  useIframeSelector({
    iframeRef,
    selectMode,
    onSelected: handleSelected,
    onExit: handleExit,
  });

  // 加载已保存列表
  const loadSavedList = useCallback(async () => {
    const keys = await kvKeys();
    const items: SavedItem[] = [];
    for (const key of keys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        const item = await kvGet<SavedItem>(key);
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
    if (currentName) {
      const item: SavedItem = { name: currentName, html, savedAt: Date.now() };
      await kvSet(STORAGE_PREFIX + currentName, item);
      setDirty(false);
      toast.success(`已保存「${currentName}」`);
      return;
    }
    setSaveName("");
    setSaveModalOpen(true);
  };

  const handleSaveConfirm = async () => {
    const name = saveName.trim();
    if (!name) return;
    const item: SavedItem = { name, html, savedAt: Date.now() };
    await kvSet(STORAGE_PREFIX + name, item);
    setCurrentName(name);
    setSaveModalOpen(false);
    setSaveName("");
    setDirty(false);
    toast.success(`已保存「${name}」`);
  };

  const handleSaveAs = () => {
    setSaveName(currentName || "");
    setSaveModalOpen(true);
  };

  // 加载
  const handleLoad = (item: SavedItem) => {
    setHtml(item.html);
    setCurrentName(item.name);
    setDirty(false);
    setSelectMode(false);
    setSelectedInfo(null);
    setModalOpen(false);
    setLoadModalOpen(false);
  };

  // 删除
  const handleDelete = async (item: SavedItem) => {
    await kvDelete(STORAGE_PREFIX + item.name);
    if (currentName === item.name) setCurrentName(null);
    loadSavedList();
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.body.style.pointerEvents = "none";

    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      setEditorWidth(Math.min(80, Math.max(20, percent)));
      const dividerW = 6;
      setPreviewPx(Math.round(rect.width * (1 - percent / 100) - dividerW));
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.style.pointerEvents = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, []);

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b border-separator flex items-center px-5 gap-2 shrink-0">
        <h1 className="text-sm font-semibold">HTML 选择器</h1>
        <span className="text-xs text-muted">
          粘贴 HTML → 实时预览 → 选择元素 → 查看信息
        </span>
        <div className="flex-1" />
        {currentName && (
          <Chip size="sm" variant="soft" color="default">
            <Chip.Label>{currentName}</Chip.Label>
          </Chip>
        )}
        {dirty && (
          <Chip size="sm" variant="soft" color="warning">
            <Chip.Label>未保存</Chip.Label>
          </Chip>
        )}
        <Chip size="sm" variant="soft" color="default" className="font-mono">
          <Chip.Label>{previewPx}px</Chip.Label>
        </Chip>
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={handleSave}>
            <Save size={14} />
          </Button>
          <Tooltip.Content>{currentName ? `覆盖保存「${currentName}」` : "保存"}</Tooltip.Content>
        </Tooltip>
        {currentName && (
          <Tooltip delay={0}>
            <Button isIconOnly size="sm" variant="ghost" onPress={handleSaveAs}>
              <FileDown size={14} />
            </Button>
            <Tooltip.Content>另存为</Tooltip.Content>
          </Tooltip>
        )}
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => setLoadModalOpen(true)}>
            <FolderOpen size={14} />
          </Button>
          <Tooltip.Content>加载</Tooltip.Content>
        </Tooltip>
        <Button
          size="sm"
          className="text-xs"
          variant={selectMode ? "danger" : "primary"}
          onPress={(e) => {
            (e.target as HTMLElement)?.blur?.();
            if (selectMode) {
              setSelectMode(false);
              setSelectedInfo(null);
              setModalOpen(false);
            } else {
              setSelectMode(true);
              setSelectedInfo(null);
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
            <Button isIconOnly size="sm" variant="ghost" onPress={() => setModalOpen(true)}>
              <Eye size={14} />
            </Button>
            <Tooltip.Content>查看选中信息</Tooltip.Content>
          </Tooltip>
        )}
      </header>

      {/* Main */}
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
                setHtml(v);
                setDirty(true);
                setSelectMode(false);
                setSelectedInfo(null);
                setModalOpen(false);
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
              srcDoc={html}
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

      {/* 选中信息 Modal */}
      {selectedInfo && (
        <Modal.Backdrop isOpen={modalOpen} onOpenChange={setModalOpen}>
          <Modal.Container>
            <Modal.Dialog className="sm:max-w-lg">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Icon className="bg-success-soft text-success">
                  <Eye className="size-5" />
                </Modal.Icon>
                <Modal.Heading>选中元素信息</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <div className="divide-y divide-separator">
                  <CopyField label="选择器" value={selectedInfo.selector} />
                  <CopyField label="标签" value={selectedInfo.tagName} />
                  <CopyField label="ID" value={selectedInfo.id} />
                  <CopyField label="类名" value={selectedInfo.className} />
                  <CopyField label="尺寸" value={`${selectedInfo.rect.width} × ${selectedInfo.rect.height}`} />
                  <CopyField label="位置" value={`top=${selectedInfo.rect.top}, left=${selectedInfo.rect.left}`} />
                  {selectedInfo.editableType && (
                    <>
                      <CopyField label="可编辑" value={selectedInfo.editableType} />
                      <CopyField label="值" value={selectedInfo.editableValue || ""} />
                    </>
                  )}
                  <CopyField label="文本" value={selectedInfo.textContent} />
                  <CopyField label="outerHTML" value={selectedInfo.outerHTML} />
                </div>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}

      <SaveModal
        isOpen={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        title={currentName ? "另存为" : "保存代码"}
        name={saveName}
        onNameChange={setSaveName}
        onSave={handleSaveConfirm}
        placeholder="给这次保存起个名字"
      />

      <LoadModal
        isOpen={loadModalOpen}
        onOpenChange={setLoadModalOpen}
        title="加载已保存的代码"
        items={savedItems}
        onLoad={handleLoad}
        onDelete={handleDelete}
        emptyText="暂无保存的代码"
      />
    </div>
  );
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
</html>`;
