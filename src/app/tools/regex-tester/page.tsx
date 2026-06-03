"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RegexTester } from "@/tools/regex-tester";

function RegexTesterPageInner() {
  const searchParams = useSearchParams();
  const loadName = searchParams.get("load") || undefined;
  return <RegexTester initialLoadName={loadName} />;
}

export default function RegexTesterPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center text-muted text-sm">加载中...</div>}>
      <RegexTesterPageInner />
    </Suspense>
  );
}
