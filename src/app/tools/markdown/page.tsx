"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { Button, Input, Tooltip, Modal, Label, TextField, Chip, toast } from "@heroui/react";
import { Save, FolderOpen, Trash2, FileDown } from "lucide-react";
import { LoadModal } from "@/components/LoadModal";
import { SaveModal } from "@/components/SaveModal";
import { kvGet, kvSet, kvDelete, kvKeys } from "@/utils/db";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { useSearchParams } from "next/navigation";

type SavedNote = {
  name: string;
  content: string;
  savedAt: number;
};

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center text-muted text-sm">加载中...</div>}>
      <NotesEditor />
    </Suspense>
  );
}

function NotesEditor() {
  const searchParams = useSearchParams();
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  // 当前加载的Markdown名称（用于覆盖保存）
  const [currentName, setCurrentName] = useState<string | null>(null);

  // 保存/加载 Modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedItems, setSavedItems] = useState<SavedNote[]>([]);

  // URL 参数加载
  useEffect(() => {
    const loadName = searchParams.get("load");
    if (!loadName) return;
    (async () => {
      const item = await kvGet<SavedNote>(`notes:saved:${loadName}`);
      if (item) {
        setContent(item.content);
        setCurrentName(item.name);
        setDirty(false);
      }
    })();
  }, [searchParams]);

  // 加载已保存列表
  const loadSavedList = useCallback(async () => {
    const keys = await kvKeys();
    const items: SavedNote[] = [];
    for (const key of keys) {
      if (!key.startsWith("notes:saved:")) continue;
      const item = await kvGet<SavedNote>(key);
      if (item) items.push(item);
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

  // 保存（有 currentName 则覆盖，否则新建）
  const handleSave = async () => {
    // 如果已加载Markdown，直接覆盖，不弹 Modal
    if (currentName) {
      await kvSet(`notes:saved:${currentName}`, {
        name: currentName,
        content,
        savedAt: Date.now(),
      });
      setDirty(false);
      toast.success(`已保存「${currentName}」`);
      return;
    }
    // 否则弹 Modal 让用户输入名称
    setSaveName("");
    setSaveModalOpen(true);
  };

  const handleSaveConfirm = async () => {
    const name = saveName.trim();
    if (!name) return;
    await kvSet(`notes:saved:${name}`, {
      name,
      content,
      savedAt: Date.now(),
    });
    setCurrentName(name);
    setSaveModalOpen(false);
    setSaveName("");
    setDirty(false);
    toast.success(`已保存「${name}」`);
  };

  // 加载
  const handleLoad = (item: SavedNote) => {
    setContent(item.content);
    setCurrentName(item.name);
    setLoadModalOpen(false);
    setDirty(false);
  };

  // 删除
  const handleDelete = async (item: SavedNote) => {
    await kvDelete(`notes:saved:${item.name}`);
    if (currentName === item.name) setCurrentName(null);
    loadSavedList();
  };

  // 另存为
  const handleSaveAs = () => {
    setSaveName(currentName || "");
    setSaveModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b border-separator flex items-center px-5 gap-2 shrink-0">
        <h1 className="text-sm font-semibold">Markdown</h1>
        <span className="text-xs text-muted">
          富文本编辑 → 保存资源 → 统一管理
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
        <Tooltip delay={0}>
          <Tooltip.Trigger className="flex flex-col">
            <Button isIconOnly size="sm" variant="ghost" onPress={handleSave}>
              <Save size={14} />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>{currentName ? `覆盖保存「${currentName}」` : "保存"}</Tooltip.Content>
        </Tooltip>
        {currentName && (
          <Tooltip delay={0}>
            <Tooltip.Trigger className="flex flex-col">
              <Button isIconOnly size="sm" variant="ghost" onPress={handleSaveAs}>
                <FileDown size={14} />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content>另存为</Tooltip.Content>
          </Tooltip>
        )}
        <Tooltip delay={0}>
          <Tooltip.Trigger className="flex flex-col">
            <Button isIconOnly size="sm" variant="ghost" onPress={() => setLoadModalOpen(true)}>
              <FolderOpen size={14} />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content>加载</Tooltip.Content>
        </Tooltip>
      </header>

      {/* 编辑器 */}
      <div className="flex-1 overflow-hidden">
        <SimpleEditor
          initialContent={content}
          onUpdate={(html) => {
            setContent(html);
            setDirty(true);
          }}
        />
      </div>

      <SaveModal
        isOpen={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        title={currentName ? "另存为" : "保存Markdown"}
        name={saveName}
        onNameChange={setSaveName}
        onSave={handleSaveConfirm}
        placeholder="给这次保存起个名字"
      />

      <LoadModal
        isOpen={loadModalOpen}
        onOpenChange={setLoadModalOpen}
        title="加载已保存的Markdown"
        items={savedItems}
        onLoad={handleLoad}
        onDelete={handleDelete}
        emptyText="暂无保存的Markdown"
      />
    </div>
  );
}
