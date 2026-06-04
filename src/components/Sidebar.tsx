"use client"

import { useState } from "react"
import { Button, Tooltip } from "@heroui/react"
import { PanelLeft, PanelLeftClose } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SIDEBAR_TOOLS, SYSTEM_TOOLS, type ToolDef } from "@/lib/tool-registry"

function NavItem({
  tool,
  pathname,
  collapsed,
}: {
  tool: ToolDef
  pathname: string
  collapsed: boolean
}) {
  const Icon = tool.icon
  const isActive = pathname === tool.href
  return (
    <Tooltip delay={0}>
      <Tooltip.Trigger>
        <Link
          href={tool.href!}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            isActive
              ? "bg-secondary text-secondary-foreground"
              : "hover:bg-surface-secondary text-muted"
          } ${collapsed ? "justify-center" : ""}`}
          aria-current={isActive ? "page" : undefined}
        >
          <Icon size={16} className={isActive ? "text-accent" : ""} />
          {!collapsed && <span className="truncate text-xs">{tool.name}</span>}
        </Link>
      </Tooltip.Trigger>
      <Tooltip.Content placement="right">
        {collapsed ? tool.name : tool.description}
      </Tooltip.Content>
    </Tooltip>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={`border-r border-separator bg-surface flex flex-col shrink-0 transition-all duration-200 ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <div className="h-14 border-b border-separator flex items-center px-3">
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1">
            <Image src="/logo-processed.png" alt="orange-utils" width={28} height={28} />
            <span className="text-sm font-semibold">orange-utils</span>
          </div>
        )}
        <Tooltip delay={0}>
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={collapsed ? "展开侧边栏" : "收起侧边栏"}
            onPress={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
          </Button>
          <Tooltip.Content placement="right">
            {collapsed ? "展开侧边栏" : "收起侧边栏"}
          </Tooltip.Content>
        </Tooltip>
      </div>

      <nav className="flex-1 p-2 space-y-1 overflow-y-auto flex flex-col">
        {SIDEBAR_TOOLS.map((tool) => (
          <NavItem key={tool.id} tool={tool} pathname={pathname} collapsed={collapsed} />
        ))}
      </nav>

      <div className="p-2 border-t border-separator space-y-1">
        {SYSTEM_TOOLS.map((tool) => (
          <NavItem key={tool.id} tool={tool} pathname={pathname} collapsed={collapsed} />
        ))}
      </div>
    </aside>
  )
}
