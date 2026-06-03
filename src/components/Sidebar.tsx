"use client";

import { useState } from "react";
import { Button, Tooltip } from "@heroui/react";
import {
  Code2,
  Wrench,
  PanelLeftClose,
  PanelLeft,
  Send,
  Database,
  GitCompareArrows,
} from "lucide-react";
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
    id: "resource-manager",
    name: "资源管理",
    description: "统一管理所有工具保存的数据",
    icon: Database,
    href: "/tools/resource-manager",
  },
  {
    id: "code-compare",
    name: "代码对比",
    description: "对比两份代码，高亮差异",
    icon: GitCompareArrows,
    href: "/tools/code-compare",
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
            <Wrench size={18} className="text-accent" />
            <span className="text-sm font-semibold">orange-utils</span>
          </div>
        )}
        <Tooltip delay={0}>
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
              <Tooltip.Content placement="right">
                {collapsed ? tool.name : tool.description}
              </Tooltip.Content>
            </Tooltip>
          );
        })}
      </nav>
    </aside>
  );
}
