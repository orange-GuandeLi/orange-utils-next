"use client";

import { useState, useEffect, useCallback } from "react";
import { Button, Input, Tooltip, Modal, Label, TextField, Chip } from "@heroui/react";
import { Save, FolderOpen, Trash2 } from "lucide-react";
import { kvGet, kvSet, kvDelete, kvKeys } from "@/utils/db";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";

type SavedNote = {
  name: string;
  content: string;
  savedAt: number;
};

export default function NotesPage() {
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);

  // 保存/加载 Modal
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedItems, setSavedItems] = useState<SavedNote[]>([]);

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

  // 保存
  const handleSave = async () => {
    const name = saveName.trim();
    if (!name) return;
    await kvSet(`notes:saved:${name}`, {
      name,
      content,
      savedAt: Date.now(),
    });
    setSaveModalOpen(false);
    setSaveName("");
    setDirty(false);
  };

  // 加载
  const handleLoad = (item: SavedNote) => {
    setContent(item.content);
    setLoadModalOpen(false);
    setDirty(false);
  };

  // 删除
  const handleDelete = async (item: SavedNote) => {
    await kvDelete(`notes:saved:${item.name}`);
    loadSavedList();
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
        {dirty && (
          <Chip size="sm" variant="soft" color="warning">
            <Chip.Label>未保存</Chip.Label>
          </Chip>
        )}
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => setSaveModalOpen(true)}>
            <Save size={14} />
          </Button>
          <Tooltip.Content>保存</Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => setLoadModalOpen(true)}>
            <FolderOpen size={14} />
          </Button>
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

      {/* 保存 Modal */}
      <Modal.Backdrop isOpen={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-sm">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent"><Save className="size-5" /></Modal.Icon>
              <Modal.Heading>保存笔记</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <TextField value={saveName} onChange={setSaveName}>
                <Label>名称</Label>
                <Input placeholder="给这次保存起个名字" onKeyDown={(e) => e.key === "Enter" && handleSave()} />
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">取消</Button>
              <Button slot="close" onPress={handleSave} isDisabled={!saveName.trim()}>保存</Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* 打开 Modal */}
      <Modal.Backdrop isOpen={loadModalOpen} onOpenChange={setLoadModalOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent"><FolderOpen className="size-5" /></Modal.Icon>
              <Modal.Heading>加载已保存的笔记</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {savedItems.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">暂无保存的笔记</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {savedItems.map((item) => (
                    <div key={item.name} className="flex items-center gap-2 p-2 rounded hover:bg-surface-secondary">
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => handleLoad(item)}
                      >
                        <div className="text-sm font-medium truncate">{item.name}</div>
                        <div className="text-xs text-muted">
                          {new Date(item.savedAt).toLocaleString("zh-CN")}
                        </div>
                      </div>
                      <Tooltip delay={0}>
                        <Button isIconOnly size="sm" variant="ghost" className="text-muted" onPress={() => handleDelete(item)}>
                          <Trash2 size={14} />
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
