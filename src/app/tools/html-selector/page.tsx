"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { HtmlSelector } from "@/tools/html-selector";

function HtmlSelectorPageInner() {
  const searchParams = useSearchParams();
  const loadName = searchParams.get("load") || undefined;
  return <HtmlSelector initialLoadName={loadName} />;
}

export default function HtmlSelectorPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center text-muted text-sm">加载中...</div>}>
      <HtmlSelectorPageInner />
    </Suspense>
  );
}
