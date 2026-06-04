import {
  Code2,
  Database,
  FileCode,
  GitCompareArrows,
  PenTool,
  Regex,
  Send,
  type LucideIcon,
} from "lucide-react"

export type ToolId =
  | "html-selector"
  | "api-request"
  | "code-compare"
  | "regex-tester"
  | "notes"
  | "resource-manager"
  | "manual"

export type ToolDef = {
  id: ToolId
  name: string
  description: string
  icon: LucideIcon
  /** 存储键前缀；不需要保存的工具为 null */
  prefix: string | null
  /** 路由地址；不可导航的资源类型为 null */
  href: string | null
  /** 从存储值中提取可读内容 */
  extractContent?: (value: Record<string, unknown>) => string
  /** 从存储值中提取额外显示字段 */
  extractMeta?: (value: Record<string, unknown>) => { method?: string; url?: string }
}

export const TOOL_REGISTRY: Record<ToolId, ToolDef> = {
  "html-selector": {
    id: "html-selector",
    name: "HTML 选择器",
    description: "可视化选择 HTML 元素",
    icon: Code2,
    prefix: "html-selector:saved:",
    href: "/tools/html-selector",
    extractContent: (v) => (v.html as string) || "",
  },
  "api-request": {
    id: "api-request",
    name: "API 请求",
    description: "发送 HTTP 请求，支持模板变量",
    icon: Send,
    prefix: "api-request:saved:",
    href: "/tools/api-request",
    extractContent: () => "",
    extractMeta: (v) => ({ method: v.method as string, url: v.url as string }),
  },
  "code-compare": {
    id: "code-compare",
    name: "代码对比",
    description: "对比两份代码，高亮差异",
    icon: GitCompareArrows,
    prefix: null,
    href: "/tools/code-compare",
  },
  "regex-tester": {
    id: "regex-tester",
    name: "正则测试",
    description: "实时测试正则表达式",
    icon: Regex,
    prefix: "regex:saved:",
    href: "/tools/regex-tester",
    extractContent: (v) => (v.pattern as string) || "",
  },
  notes: {
    id: "notes",
    name: "Markdown",
    description: "富文本 Markdown 编辑器",
    icon: FileCode,
    prefix: "notes:saved:",
    href: "/tools/markdown",
    extractContent: (v) => (v.content as string) || "",
  },
  "resource-manager": {
    id: "resource-manager",
    name: "资源管理",
    description: "统一管理所有工具保存的数据",
    icon: Database,
    prefix: null,
    href: "/tools/resource-manager",
  },
  manual: {
    id: "manual",
    name: "手动创建",
    description: "手动创建的资源",
    icon: PenTool,
    prefix: "manual:saved:",
    href: null,
    extractContent: (v) => (v.content as string) || JSON.stringify(v, null, 2),
  },
}

/** 侧边栏展示用的工具项（不含 resource-manager，因为它是底部"系统"项） */
export const SIDEBAR_TOOLS: ToolDef[] = [
  TOOL_REGISTRY["html-selector"],
  TOOL_REGISTRY["api-request"],
  TOOL_REGISTRY["code-compare"],
  TOOL_REGISTRY["regex-tester"],
  TOOL_REGISTRY.notes,
]

export const SYSTEM_TOOLS: ToolDef[] = [TOOL_REGISTRY["resource-manager"]]

/** 资源管理里要展示的分类（含手动） */
export const RESOURCE_CATEGORIES: ToolDef[] = [
  TOOL_REGISTRY["html-selector"],
  TOOL_REGISTRY["api-request"],
  TOOL_REGISTRY["regex-tester"],
  TOOL_REGISTRY.notes,
  TOOL_REGISTRY.manual,
]

/** 通用工具名映射（用于在变量插入器里展示来源） */
export const TOOL_NAME_LABELS: Record<string, string> = Object.values(TOOL_REGISTRY).reduce(
  (acc, t) => {
    acc[t.id] = t.name
    return acc
  },
  {} as Record<string, string>,
)
