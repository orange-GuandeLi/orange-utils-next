"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ApiRequest } from "@/tools/api-request";

function ApiRequestPageInner() {
  const searchParams = useSearchParams();
  const loadName = searchParams.get("load") || undefined;
  return <ApiRequest initialLoadName={loadName} />;
}

export default function ApiRequestPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center text-muted text-sm">加载中...</div>}>
      <ApiRequestPageInner />
    </Suspense>
  );
}
