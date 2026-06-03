// 正则执行 Worker —— 在独立线程跑正则，防止灾难性回溯卡死主线程
// 收到 { pattern, flags, testString } → 返回 { matches, error }

self.onmessage = (e: MessageEvent) => {
  const { pattern, flags, testString } = e.data as {
    pattern: string;
    flags: string;
    testString: string;
  };

  try {
    const regex = new RegExp(pattern, flags);
    const results: { text: string; index: number; length: number; groups?: Record<string, string> }[] = [];
    let match: RegExpExecArray | null;

    const MAX_MATCHES = 1000;
    const MAX_MS = 200;
    const startTime = Date.now();

    if (flags.includes("g")) {
      while ((match = regex.exec(testString)) !== null) {
        if (results.length >= MAX_MATCHES || Date.now() - startTime > MAX_MS) {
          self.postMessage({
            matches: results,
            error: `已中断：超过 ${results.length >= MAX_MATCHES ? "匹配数量(1000)" : "执行时间(200ms)"  } 限制`,
          });
          return;
        }
        results.push({
          text: match[0],
          index: match.index,
          length: match[0].length,
          groups: match.groups ? { ...match.groups } : undefined,
        });
        if (match[0].length === 0) regex.lastIndex++;
      }
    } else {
      match = regex.exec(testString);
      if (match) {
        results.push({
          text: match[0],
          index: match.index,
          length: match[0].length,
          groups: match.groups ? { ...match.groups } : undefined,
        });
      }
    }

    self.postMessage({ matches: results, error: null });
  } catch (err) {
    self.postMessage({ matches: [], error: (err as Error).message });
  }
};
