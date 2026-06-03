import { useState, useCallback, useEffect } from "react";
import { Button, Chip, Tooltip, Input, Label, TextField, Select, ListBox, Tabs, toast } from "@heroui/react";
import { Send, Save, FolderOpen, Trash2, Plus, X, Copy, Check, FileDown } from "lucide-react";
import { ToolHeader } from "../../components/ToolHeader";
import { ToolActionButtons } from "../../components/ToolActionButtons";
import { LoadModal } from "../../components/LoadModal";
import { SaveModal } from "../../components/SaveModal";
import { kvGet, kvSet, kvDelete, kvKeys } from "../../utils/db";
import { ModalShell } from "../../components/ModalShell";
import { CodeEditor } from "../../components/CodeEditor";

type Header = { key: string; value: string };
type RequestConfig = { name: string; method: string; url: string; headers: Header[]; body: string; savedAt: number };
type ResponseData = { status: number; statusText: string; headers: Record<string, string>; body: string; time: number };

const STORAGE_PREFIX = "api-request:saved:";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function ApiRequest({ initialLoadName }: { initialLoadName?: string }) {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<Header[]>([{ key: "Content-Type", value: "application/json" }]);
  const [body, setBody] = useState("");
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [loadModalOpen, setLoadModalOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [savedItems, setSavedItems] = useState<RequestConfig[]>([]);
  const [currentName, setCurrentName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [varModalOpen, setVarModalOpen] = useState(false);
  const [availableVars, setAvailableVars] = useState<{ id: string; name: string; toolName: string; varKey: string; savedAt: number }[]>([]);

  const loadSavedList = useCallback(async () => {
    const keys = await kvKeys();
    const items: RequestConfig[] = [];
    for (const key of keys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        const item = await kvGet<RequestConfig>(key);
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

  const TOOL_NAMES: Record<string, string> = {
    "html-selector": "HTML 选择器",
    "api-request": "API 请求",
    "regex": "正则测试",
    "notes": "Markdown",
    "manual": "手动创建",
  };

  const loadAvailableVars = useCallback(async () => {
    const keys = await kvKeys();
    const vars: { id: string; name: string; toolName: string; varKey: string; savedAt: number }[] = [];
    for (const key of keys) {
      if (!key.includes(":saved:")) continue;
      const item = await kvGet<Record<string, unknown>>(key);
      if (!item) continue;
      const name = (item.name as string) || key.replace(/^.*?:saved:/, "");
      const savedAt = (item.savedAt as number) || 0;
      const toolPrefix = key.split(":")[0];
      const toolName = TOOL_NAMES[toolPrefix] || toolPrefix;
      // 为每个字段生成变量 key
      const fields = ["html", "content", "body", "testString"];
      for (const field of fields) {
        if (item[field]) {
          vars.push({ id: `${key}.${field}`, name, toolName, varKey: `{{${key}.${field}}}`, savedAt });
          break; // 只取第一个有值的字段
        }
      }
    }
    vars.sort((a, b) => b.savedAt - a.savedAt);
    setAvailableVars(vars);
  }, []);

  useEffect(() => {
    if (varModalOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadAvailableVars();
    }
  }, [varModalOpen, loadAvailableVars]);

  const resolveVars = useCallback(async (text: string): Promise<string> => {
    const pattern = /\{\{([^}]+)\}\}/g;
    let result = text;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = await kvGet<string>(match[1]);
      if (value !== undefined) result = result.replace(match[0], typeof value === "string" ? value : JSON.stringify(value));
    }
    return result;
  }, []);

  const handleSend = async () => {
    if (!url.trim()) { setError("请输入 URL"); return; }
    setLoading(true); setError(""); setResponse(null);
    try {
      const resolvedUrl = await resolveVars(url);
      const resolvedBody = await resolveVars(body);
      const fetchHeaders: Record<string, string> = {};
      for (const h of headers) { if (h.key.trim()) fetchHeaders[h.key.trim()] = await resolveVars(h.value); }
      const start = Date.now();
      const res = await fetch(resolvedUrl, { method, headers: fetchHeaders, body: method !== "GET" ? resolvedBody : undefined });
      const time = Date.now() - start;
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { resHeaders[k] = v; });
      let resBody = await res.text();
      try { resBody = JSON.stringify(JSON.parse(resBody), null, 2); } catch { /* not JSON */ }
      setResponse({ status: res.status, statusText: res.statusText, headers: resHeaders, body: resBody, time });
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally { setLoading(false); }
  };

  const addHeader = () => { setHeaders([...headers, { key: "", value: "" }]); setDirty(true); };
  const removeHeader = (i: number) => { setHeaders(headers.filter((_, idx) => idx !== i)); setDirty(true); };
  const updateHeader = (i: number, field: "key" | "value", val: string) => {
    const next = [...headers]; next[i] = { ...next[i], [field]: val }; setHeaders(next); setDirty(true);
  };

  const handleSave = async () => {
    if (currentName) {
      await kvSet(STORAGE_PREFIX + currentName, { name: currentName, method, url, headers, body, savedAt: Date.now() });
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
    await kvSet(STORAGE_PREFIX + name, { name, method, url, headers, body, savedAt: Date.now() });
    setCurrentName(name);
    setSaveModalOpen(false); setSaveName("");
    setDirty(false);
    toast.success(`已保存「${name}」`);
  };

  const handleLoad = (item: RequestConfig) => {
    setMethod(item.method); setUrl(item.url);
    setHeaders(item.headers.length ? item.headers : [{ key: "", value: "" }]);
    setBody(item.body);
    setCurrentName(item.name);
    setDirty(false);
    setLoadModalOpen(false);
  };

  const handleDelete = async (item: RequestConfig) => { await kvDelete(STORAGE_PREFIX + item.name); if (currentName === item.name) setCurrentName(null); loadSavedList(); };

  const handleSaveAs = () => { setSaveName(currentName || ""); setSaveModalOpen(true); };

  const [copied, setCopied] = useState(false);
  const handleCopyResponse = () => {
    if (!response) return;
    navigator.clipboard.writeText(response.body);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    if (!initialLoadName) return;
    (async () => {
      const item = await kvGet<RequestConfig>(STORAGE_PREFIX + initialLoadName);
      if (item) {
        setMethod(item.method);
        setUrl(item.url);
        setHeaders(item.headers.length ? item.headers : [{ key: "", value: "" }]);
        setBody(item.body);
        setCurrentName(item.name);
        setDirty(false);
      }
    })();
  }, [initialLoadName]);

  const insertVar = (varKey: string) => { setBody((prev) => prev + varKey); setVarModalOpen(false); };

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <ToolHeader
        icon={Send}
        title="API 请求"
        subtitle="发送 HTTP 请求，支持模板变量引用其他工具的数据"
        extra={
          <ToolActionButtons
            currentName={currentName}
            dirty={dirty}
            onSave={handleSave}
            onSaveAs={handleSaveAs}
            onLoad={() => setLoadModalOpen(true)}
            saveTooltip={currentName ? `保存到 ${currentName}` : "保存请求"}
          />
        }
      />

      {/* Main */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左: 请求配置 */}
        <div className="w-1/2 border-r border-separator flex flex-col overflow-hidden">
          {/* URL 行 */}
          <div className="flex items-center gap-2 p-3 border-b border-separator shrink-0">
            <Select className="w-28" placeholder="GET" selectedKey={method} onSelectionChange={(key) => { if (key) { setMethod(key as string); setDirty(true); } }}>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {METHODS.map((m) => (<ListBox.Item key={m} id={m} textValue={m}>{m}<ListBox.ItemIndicator /></ListBox.Item>))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Input className="flex-1" placeholder="https://api.example.com/endpoint" value={url} onChange={(e) => { setUrl((e.target as HTMLInputElement).value); setDirty(true); }} />
            <Button size="sm" className="text-xs" variant="primary" onPress={handleSend} isDisabled={loading}>
              <Send size={14} />{loading ? "发送中..." : "发送"}
            </Button>
          </div>

          {/* Tabs */}
          <Tabs className="flex-1 min-h-0" defaultSelectedKey="body">
            <Tabs.ListContainer>
              <Tabs.List aria-label="请求配置">
                <Tabs.Tab id="body" className="text-xs">请求体<Tabs.Indicator /></Tabs.Tab>
                <Tabs.Tab id="headers" className="text-xs">
                  请求头
                  {headers.filter((h) => h.key.trim()).length > 0 && (
                    <Chip size="sm" variant="soft" color="default" className="ml-1">
                      <Chip.Label>{headers.filter((h) => h.key.trim()).length}</Chip.Label>
                    </Chip>
                  )}
                  <Tabs.Indicator />
                </Tabs.Tab>
              </Tabs.List>
            </Tabs.ListContainer>

            <Tabs.Panel id="body" className="flex flex-col h-full mt-0">
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-separator bg-surface-secondary shrink-0">
                <span className="text-xs text-muted">JSON 请求体</span>
                <Tooltip delay={0}>
                  <Button size="sm" variant="ghost" onPress={() => setVarModalOpen(true)}>
                    <Plus size={12} /><span className="text-xs">插入变量</span>
                  </Button>
                  <Tooltip.Content>从其他工具插入数据</Tooltip.Content>
                </Tooltip>
              </div>
              <div className="flex-1 min-h-0">
                <CodeEditor value={body} onChange={(v) => { setBody(v); setDirty(true); }} language="json" />
              </div>
            </Tabs.Panel>

            <Tabs.Panel id="headers" className="p-3 space-y-2 overflow-y-auto mt-0">
              {headers.map((h, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input className="flex-1" placeholder="键" value={h.key} onChange={(e) => updateHeader(i, "key", (e.target as HTMLInputElement).value)} />
                  <Input className="flex-1" placeholder="值" value={h.value} onChange={(e) => updateHeader(i, "value", (e.target as HTMLInputElement).value)} />
                  <Tooltip delay={0}>
                    <Button isIconOnly size="sm" variant="ghost" onPress={() => removeHeader(i)}><X size={12} /></Button>
                    <Tooltip.Content>删除</Tooltip.Content>
                  </Tooltip>
                </div>
              ))}
              <Button size="sm" variant="ghost" onPress={addHeader}><Plus size={12} /><span className="text-xs">添加请求头</span></Button>
            </Tabs.Panel>
          </Tabs>

          {error && <div className="px-3 py-2 bg-danger-soft text-danger text-xs border-t border-separator shrink-0">{error}</div>}
        </div>

        {/* 右: 响应 */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-separator shrink-0">
            <span className="text-xs font-medium">响应</span>
            {response && (
              <div className="flex items-center gap-2">
                <Chip size="sm" variant="soft" color={response.status < 400 ? "success" : "danger"}>
                  <Chip.Label>{response.status} {response.statusText}</Chip.Label>
                </Chip>
                <Chip size="sm" variant="soft" color="default"><Chip.Label>{response.time}ms</Chip.Label></Chip>
                <Tooltip delay={0}>
                  <Button isIconOnly size="sm" variant="ghost" onPress={handleCopyResponse}>
                    {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                  </Button>
                  <Tooltip.Content>{copied ? "已复制" : "复制响应"}</Tooltip.Content>
                </Tooltip>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0">
            {response ? (
              <CodeEditor value={response.body} language="json" readOnly />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted">
                {loading ? "请求中..." : "发送请求后查看响应"}
              </div>
            )}
          </div>
        </div>
      </div>

      <SaveModal
        isOpen={saveModalOpen}
        onOpenChange={setSaveModalOpen}
        title={currentName ? "另存为" : "保存请求"}
        name={saveName}
        onNameChange={setSaveName}
        onSave={handleSaveConfirm}
        placeholder="给这个请求起个名字"
      />

      <LoadModal
        isOpen={loadModalOpen}
        onOpenChange={setLoadModalOpen}
        title="加载已保存的请求"
        items={savedItems}
        onLoad={handleLoad}
        onDelete={handleDelete}
        emptyText="暂无保存的请求"
        renderMeta={(item) => (
          <span className="text-xs font-mono text-muted">{item.method} {item.url}</span>
        )}
      />

      {/* 插入变量 Modal */}
      <ModalShell
        isOpen={varModalOpen}
        onOpenChange={setVarModalOpen}
        title="插入变量"
        icon={Plus}
      >
        <p className="text-xs text-muted mb-3">从其他工具的数据中选择变量，插入到请求 Body 中。</p>
        {availableVars.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">暂无可用变量，请先在其他工具中保存数据</p>
        ) : (
          <div className="flex flex-col gap-2">
            {availableVars.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors"
                onClick={() => insertVar(v.varKey)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Chip size="sm" variant="soft" color="default">
                      <Chip.Label className="text-xs">{v.toolName}</Chip.Label>
                    </Chip>
                    <span className="text-sm font-medium truncate">{v.name}</span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {new Date(v.savedAt).toLocaleString("zh-CN")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ModalShell>
    </div>
  );
}
