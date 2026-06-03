import { useState, useCallback, useEffect } from "react";
import { Button, Chip, Tooltip, Modal, Input, Label, TextField, Select, ListBox, Tabs } from "@heroui/react";
import { Send, Save, FolderOpen, Trash2, Plus, X, Copy, Check } from "lucide-react";
import { kvGet, kvSet, kvDelete, kvKeys } from "../../utils/db";
import { CodeEditor } from "../../components/CodeEditor";

type Header = { key: string; value: string };
type RequestConfig = { name: string; method: string; url: string; headers: Header[]; body: string; savedAt: number };
type ResponseData = { status: number; statusText: string; headers: Record<string, string>; body: string; time: number };

const STORAGE_PREFIX = "api-request:saved:";
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export function ApiRequest() {
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

  const [varModalOpen, setVarModalOpen] = useState(false);
  const [availableVars, setAvailableVars] = useState<{ key: string; value: string }[]>([]);

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

  const loadAvailableVars = useCallback(async () => {
    const keys = await kvKeys();
    const vars: { key: string; value: string }[] = [];
    for (const key of keys) {
      if (key.startsWith("html-selector:saved:")) {
        const item = await kvGet<{ name: string; html: string }>(key);
        if (item) vars.push({ key: `{{${key}.html}}`, value: item.html.slice(0, 100) + "..." });
      }
    }
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

  const addHeader = () => setHeaders([...headers, { key: "", value: "" }]);
  const removeHeader = (i: number) => setHeaders(headers.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: "key" | "value", val: string) => {
    const next = [...headers]; next[i] = { ...next[i], [field]: val }; setHeaders(next);
  };

  const handleSave = async () => {
    const name = saveName.trim();
    if (!name) return;
    await kvSet(STORAGE_PREFIX + name, { name, method, url, headers, body, savedAt: Date.now() });
    setSaveModalOpen(false); setSaveName("");
  };

  const handleLoad = (item: RequestConfig) => {
    setMethod(item.method); setUrl(item.url);
    setHeaders(item.headers.length ? item.headers : [{ key: "", value: "" }]);
    setBody(item.body); setLoadModalOpen(false);
  };

  const handleDelete = async (item: RequestConfig) => { await kvDelete(STORAGE_PREFIX + item.name); loadSavedList(); };

  const [copied, setCopied] = useState(false);
  const handleCopyResponse = () => {
    if (!response) return;
    navigator.clipboard.writeText(response.body);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };

  const insertVar = (varKey: string) => { setBody((prev) => prev + varKey); setVarModalOpen(false); };

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b border-separator flex items-center px-5 gap-2 shrink-0">
        <h1 className="text-sm font-semibold">API 请求</h1>
        <span className="text-xs text-muted">发送 HTTP 请求，支持模板变量引用其他工具的数据</span>
        <div className="flex-1" />
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => setSaveModalOpen(true)}><Save size={14} /></Button>
          <Tooltip.Content>保存请求</Tooltip.Content>
        </Tooltip>
        <Tooltip delay={0}>
          <Button isIconOnly size="sm" variant="ghost" onPress={() => setLoadModalOpen(true)}><FolderOpen size={14} /></Button>
          <Tooltip.Content>加载请求</Tooltip.Content>
        </Tooltip>
      </header>

      {/* Main */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* 左: 请求配置 */}
        <div className="w-1/2 border-r border-separator flex flex-col overflow-hidden">
          {/* URL 行 */}
          <div className="flex items-center gap-2 p-3 border-b border-separator shrink-0">
            <Select className="w-28" placeholder="GET" selectedKey={method} onSelectionChange={(key) => { if (key) setMethod(key as string); }}>
              <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {METHODS.map((m) => (<ListBox.Item key={m} id={m} textValue={m}>{m}<ListBox.ItemIndicator /></ListBox.Item>))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Input className="flex-1" placeholder="https://api.example.com/endpoint" value={url} onChange={(e) => setUrl((e.target as HTMLInputElement).value)} />
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
                <CodeEditor value={body} onChange={setBody} language="json" />
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

      {/* 保存 Modal */}
      <Modal.Backdrop isOpen={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-sm">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Icon className="bg-accent-soft text-accent"><Save className="size-5" /></Modal.Icon>
              <Modal.Heading>保存请求</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <TextField value={saveName} onChange={setSaveName}>
                <Label>名称</Label>
                <Input placeholder="给这个请求起个名字" onKeyDown={(e) => e.key === "Enter" && handleSave()} />
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
              <Modal.Heading>加载已保存的请求</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {savedItems.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">暂无保存的请求</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {savedItems.map((item) => (
                    <div key={item.name} className="flex items-center gap-3 p-3 rounded-lg bg-surface-secondary hover:bg-surface-tertiary transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Chip size="sm" variant="soft" color="accent"><Chip.Label className="font-mono">{item.method}</Chip.Label></Chip>
                          <span className="text-sm font-medium truncate">{item.name}</span>
                        </div>
                        <div className="text-xs text-muted truncate mt-1">{item.url}</div>
                      </div>
                      <Button size="sm" variant="secondary" onPress={() => handleLoad(item)}><span className="text-xs">加载</span></Button>
                      <Tooltip delay={0}>
                        <Button isIconOnly size="sm" variant="ghost" onPress={() => handleDelete(item)}><Trash2 size={14} className="text-danger" /></Button>
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

      {/* 插入变量 Modal */}
      <Modal.Backdrop isOpen={varModalOpen} onOpenChange={setVarModalOpen}>
        <Modal.Container>
          <Modal.Dialog className="sm:max-w-md">
            <Modal.CloseTrigger />
            <Modal.Header><Modal.Heading>插入变量</Modal.Heading></Modal.Header>
            <Modal.Body>
              <p className="text-xs text-muted mb-3">从其他工具的 IndexedDB 数据中选择变量，插入到请求 Body 中。</p>
              {availableVars.length === 0 ? (
                <p className="text-sm text-muted text-center py-4">暂无可用变量，请先在其他工具中保存数据</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {availableVars.map((v) => (
                    <div key={v.key} className="flex items-center gap-3 p-2 rounded bg-surface-secondary cursor-pointer hover:bg-surface-tertiary transition-colors" onClick={() => insertVar(v.key)}>
                      <code className="text-xs font-mono text-accent shrink-0">{v.key}</code>
                      <span className="text-xs text-muted truncate">{v.value}</span>
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
