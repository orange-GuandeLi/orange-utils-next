"use client";

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

type ToolHeaderProps = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** 右侧内容（chips、按钮等） */
  extra?: ReactNode;
  children?: ReactNode;
};

export function ToolHeader({ icon: Icon, title, subtitle, extra, children }: ToolHeaderProps) {
  return (
    <header className="h-14 border-b border-separator flex items-center px-5 gap-2 shrink-0">
      <Icon size={16} className="text-accent" />
      <h1 className="text-sm font-semibold">{title}</h1>
      {subtitle && (
        <span className="text-xs text-muted hidden sm:inline">{subtitle}</span>
      )}
      <div className="flex-1" />
      {extra}
      {children}
    </header>
  );
}
