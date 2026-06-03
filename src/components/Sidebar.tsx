"use client";

import { useState } from "react";
import { Button, Tooltip } from "@heroui/react";
import {
  Code2,
  PanelLeftClose,
  PanelLeft,
  Send,
  Database,
  GitCompareArrows,
  Regex,
  FileCode,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TOOLS = [
  {
    id: "html-selector",
    name: "HTML 选择器",
    description: "可视化选择 HTML 元素",
    icon: Code2,
    href: "/tools/html-selector",
  },
  {
    id: "api-request",
    name: "API 请求",
    description: "发送 HTTP 请求，支持模板变量",
    icon: Send,
    href: "/tools/api-request",
  },
  {
    id: "code-compare",
    name: "代码对比",
    description: "对比两份代码，高亮差异",
    icon: GitCompareArrows,
    href: "/tools/code-compare",
  },
  {
    id: "regex-tester",
    name: "正则测试",
    description: "实时测试正则表达式",
    icon: Regex,
    href: "/tools/regex-tester",
  },
  {
    id: "notes",
    name: "Markdown",
    description: "富文本 Markdown 编辑器",
    icon: FileCode,
    href: "/tools/markdown",
  },
];

const SYSTEM = [
  {
    id: "resource-manager",
    name: "资源管理",
    description: "统一管理所有工具保存的数据",
    icon: Database,
    href: "/tools/resource-manager",
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`border-r border-separator bg-surface flex flex-col shrink-0 transition-all duration-200 ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      {/* 顶部 */}
      <div className="h-14 border-b border-separator flex items-center px-3">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1">
            <Image src="/logo-processed.png" alt="orange-utils" width={28} height={28} />
            <span className="text-sm font-semibold">orange-utils</span>
          </div>
        )}
        <Tooltip delay={0}>
          <Tooltip.Trigger className="flex flex-col">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <PanelLeft size={16} />
              ) : (
                <PanelLeftClose size={16} />
              )}
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content placement="right">
            {collapsed ? "展开侧边栏" : "收起侧边栏"}
          </Tooltip.Content>
        </Tooltip>
      </div>

      {/* 工具列表 */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = pathname === tool.href;
          return (
            <Tooltip key={tool.id} delay={0}>
              <Tooltip.Trigger className="flex flex-col">
                <Link
                  href={tool.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "hover:bg-surface-secondary text-muted"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <Icon size={16} className={isActive ? "text-accent" : ""} />
                  {!collapsed && (
                    <span className="truncate text-xs">{tool.name}</span>
                  )}
                </Link>
              </Tooltip.Trigger>
              <Tooltip.Content placement="right">
                {collapsed ? tool.name : tool.description}
              </Tooltip.Content>
            </Tooltip>
          );
        })}
      </nav>

      {/* 底部系统功能 */}
      <div className="p-2 border-t border-separator space-y-1">
        {SYSTEM.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Tooltip key={item.id} delay={0}>
              <Tooltip.Trigger className="flex flex-col">
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "hover:bg-surface-secondary text-muted"
                  } ${collapsed ? "justify-center" : ""}`}
                >
                  <Icon size={16} className={isActive ? "text-accent" : ""} />
                  {!collapsed && (
                    <span className="truncate text-xs">{item.name}</span>
                  )}
                </Link>
              </Tooltip.Trigger>
              <Tooltip.Content placement="right">
                {collapsed ? item.name : item.description}
              </Tooltip.Content>
            </Tooltip>
          );
        })}
      </div>
    </aside>
  );
}
