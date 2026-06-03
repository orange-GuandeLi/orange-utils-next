import { useEffect, useRef, useCallback } from "react";

// 生成元素的 CSS 选择器路径
export function getElementSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  const parts: string[] = [];
  let current: HTMLElement | null = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let part = current.tagName.toLowerCase();
    if (current.parentElement) {
      const sameTag = Array.prototype.slice.call(current.parentElement.children).filter(
        (s) => s.tagName === current!.tagName,
      );
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(current) + 1})`;
      }
    }
    parts.unshift(part);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

// 获取元素的 DOM 路径 (简短版)
export function getDomPath(el: HTMLElement): HTMLElement[] {
  const path: HTMLElement[] = [];
  let current: HTMLElement | null = el;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    path.unshift(current);
    current = current.parentElement;
  }
  return path;
}

// 元素简短标签
export function getElTag(el: HTMLElement): string {
  let tag = el.tagName.toLowerCase();
  if (el.id) tag += `#${el.id}`;
  else if (el.className && typeof el.className === "string") {
    const cls = el.className.split(/\s+/).filter(Boolean)[0];
    if (cls) tag += `.${cls}`;
  }
  return tag;
}

export type SelectionInfo = {
  selector: string;
  tagName: string;
  id: string;
  className: string;
  outerHTML: string;
  textContent: string;
  rect: { width: number; height: number; top: number; left: number };
  editableType: string | null;
  editableValue: string | null;
  domPath: HTMLElement[];
};

export function getSelectionInfo(
  el: HTMLElement,
  iframe: HTMLIFrameElement,
): SelectionInfo {
  const rect = el.getBoundingClientRect();
  const editableType = el.getAttribute("data-editable");
  let editableValue: string | null = null;
  if (editableType === "image") {
    editableValue = (el as HTMLImageElement).src || null;
  } else if (editableType === "link") {
    editableValue =
      (el as HTMLAnchorElement).href || el.getAttribute("href") || null;
  } else if (editableType === "video") {
    editableValue = (el as HTMLVideoElement).src || null;
  } else if (editableType) {
    editableValue = el.innerText || null;
  }

  return {
    selector: getElementSelector(el),
    tagName: el.tagName.toLowerCase(),
    id: el.id,
    className: el.className,
    outerHTML: el.outerHTML,
    textContent: el.innerText?.slice(0, 200) || "",
    rect: {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      top: Math.round(
        rect.top + (iframe.contentDocument?.documentElement.scrollTop || 0),
      ),
      left: Math.round(
        rect.left + (iframe.contentDocument?.documentElement.scrollLeft || 0),
      ),
    },
    editableType,
    editableValue,
    domPath: getDomPath(el),
  };
}

// 获取某个点上所有可选元素（从最内层到最外层）
function getElementsAtPoint(
  doc: Document,
  x: number,
  y: number,
): HTMLElement[] {
  const SKIP_IDS = new Set(["__hs_overlay", "__hs_label", "__hs_breadcrumb"]);
  const el = doc.elementFromPoint(x, y) as HTMLElement | null;
  if (!el || el === doc.body || el === doc.documentElement || SKIP_IDS.has(el.id)) return [];

  const elements: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  let current: HTMLElement | null = el;
  let safety = 0;

  while (current && current !== doc.body && current !== doc.documentElement && safety < 20) {
    safety++;
    if (seen.has(current)) break;
    seen.add(current);
    elements.push(current);
    const prevVis = current.style.visibility;
    current.style.visibility = "hidden";
    const next = doc.elementFromPoint(x, y) as HTMLElement | null;
    current.style.visibility = prevVis;
    if (!next || next === doc.body || next === doc.documentElement || SKIP_IDS.has(next.id)) break;
    current = next;
  }
  return elements;
}

type OverlayEls = {
  overlay: HTMLDivElement;
  label: HTMLSpanElement;
  breadcrumb: HTMLDivElement;
};

// 智能定位 label，保持在可视区内
function positionLabel(
  label: HTMLElement,
  targetRect: DOMRect,
  labelW: number,
  labelH: number,
  viewportW: number,
  viewportH: number,
): { left: number; top: number } {
  const GAP = 4;

  // 优先放在上方
  let top = targetRect.top - labelH - GAP;
  if (top >= 0) {
    const left = Math.max(0, Math.min(targetRect.left, viewportW - labelW));
    return { left, top };
  }

  // 上方不够，放下方
  top = targetRect.bottom + GAP;
  if (top + labelH <= viewportH) {
    const left = Math.max(0, Math.min(targetRect.left, viewportW - labelW));
    return { left, top };
  }

  // 下方也不够，放右侧
  let left = targetRect.right + GAP;
  if (left + labelW <= viewportW) {
    top = Math.max(0, Math.min(targetRect.top, viewportH - labelH));
    return { left, top };
  }

  // 右侧不够，放左侧
  left = targetRect.left - labelW - GAP;
  top = Math.max(0, Math.min(targetRect.top, viewportH - labelH));
  return { left: Math.max(0, left), top };
}

type UseIframeSelectorOptions = {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  selectMode: boolean;
  onSelected: (info: SelectionInfo) => void;
  onExit: () => void;
};

export function useIframeSelector({
  iframeRef,
  selectMode,
  onSelected,
  onExit,
}: UseIframeSelectorOptions) {
  const isLockedRef = useRef(false);
  const trackedElRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<OverlayEls | null>(null);
  const overlappingRef = useRef<HTMLElement[]>([]);
  const overlappingIdxRef = useRef(0);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const removeOverlay = useCallback(() => {
    if (!overlayRef.current) return;
    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      try {
        overlayRef.current.overlay.remove();
        overlayRef.current.label.remove();
        overlayRef.current.breadcrumb.remove();
      } catch { /* overlay already removed */ }
    }
    overlayRef.current = null;
  }, [iframeRef]);

  // refs 打破 selectElement <-> renderBreadcrumb 循环依赖
  const selectElementRef = useRef<(el: HTMLElement, iframe: HTMLIFrameElement) => void>(() => {});
  const updateHighlightRef = useRef<(el: HTMLElement, iframe: HTMLIFrameElement) => void>(() => {});
  const renderBreadcrumbRef = useRef<(breadcrumb: HTMLDivElement, domPath: HTMLElement[], iframe: HTMLIFrameElement) => void>(() => {});

  // 选中某个元素并锁定
  const selectElement = useCallback(
    (el: HTMLElement, iframe: HTMLIFrameElement) => {
      const els = overlayRef.current;
      if (!els) return;

      isLockedRef.current = true;
      trackedElRef.current = el;

      els.overlay.style.border = "2px dashed #22c55e";
      els.overlay.style.boxShadow = "0 0 0 3px rgba(34,197,94,0.25)";
      els.label.style.background = "rgba(34,197,94,0.95)";

      const info = getSelectionInfo(el, iframe);
      onSelected(info);

      // 更新面包屑
      renderBreadcrumbRef.current(els.breadcrumb, info.domPath, iframe);
    },
    [onSelected],
  );

  selectElementRef.current = selectElement;

  // 渲染面包屑
  const renderBreadcrumb = useCallback(
    (
      breadcrumb: HTMLDivElement,
      domPath: HTMLElement[],
      iframe: HTMLIFrameElement,
    ) => {
      breadcrumb.innerHTML = "";
      domPath.forEach((el, i) => {
        if (i > 0) {
          const sep = document.createElement("span");
          sep.textContent = " › ";
          sep.style.cssText = "color:rgba(255,255,255,0.4);margin:0 2px";
          breadcrumb.appendChild(sep);
        }
        const chip = document.createElement("span");
        chip.textContent = getElTag(el);
        const isLast = i === domPath.length - 1;
        chip.style.cssText = `cursor:pointer;padding:1px 6px;border-radius:3px;font-size:11px;font-family:monospace;transition:background 80ms;${isLast ? "background:rgba(255,255,255,0.25);color:white" : "background:transparent;color:rgba(255,255,255,0.7)"}`;
        chip.addEventListener("mouseenter", () => {
          if (!isLast) chip.style.background = "rgba(255,255,255,0.15)";
        });
        chip.addEventListener("mouseleave", () => {
          if (!isLast) chip.style.background = "transparent";
        });
        chip.addEventListener("click", (e) => {
          e.stopPropagation();
          selectElementRef.current(el, iframe);
          updateHighlightRef.current(el, iframe);
        });
        breadcrumb.appendChild(chip);
      });
    },
    [],
  );

  renderBreadcrumbRef.current = renderBreadcrumb;

  // 更新高亮位置
  const updateHighlight = useCallback(
    (el: HTMLElement, iframe: HTMLIFrameElement) => {
      const els = overlayRef.current;
      if (!els) return;

      const doc = iframe.contentDocument;
      if (!doc) return;

      const rect = el.getBoundingClientRect();
      els.overlay.style.width = `${rect.width}px`;
      els.overlay.style.height = `${rect.height}px`;
      els.overlay.style.left = `${rect.left}px`;
      els.overlay.style.top = `${rect.top}px`;
      els.overlay.style.display = "block";
      els.overlay.style.opacity = "1";

      // label 内容
      els.label.innerText = getElTag(el);
      els.label.style.display = "block";

      // 智能定位
      const viewportW = doc.documentElement.clientWidth;
      const viewportH = doc.documentElement.clientHeight;
      const labelRect = els.label.getBoundingClientRect();
      const pos = positionLabel(
        els.label,
        rect,
        labelRect.width || 100,
        labelRect.height || 20,
        viewportW,
        viewportH,
      );
      els.label.style.left = `${pos.left}px`;
      els.label.style.top = `${pos.top}px`;

      // 面包屑定位（跟随 overlay 底部）
      const bcRect = els.breadcrumb.getBoundingClientRect();
      let bcTop = rect.bottom + 4;
      if (bcTop + bcRect.height > viewportH) {
        bcTop = rect.top - bcRect.height - 4;
        if (bcTop < 0) bcTop = rect.bottom + 4;
      }
      let bcLeft = rect.left;
      if (bcLeft + bcRect.width > viewportW) {
        bcLeft = viewportW - bcRect.width - 4;
      }
      els.breadcrumb.style.left = `${Math.max(0, bcLeft)}px`;
      els.breadcrumb.style.top = `${bcTop}px`;
    },
    [],
  );

  updateHighlightRef.current = updateHighlight;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !selectMode) {
      removeOverlay();
      isLockedRef.current = false;
      trackedElRef.current = null;
      return;
    }

    const doc = iframe.contentDocument;
    if (!doc || !doc.body) return;

    isLockedRef.current = false;
    trackedElRef.current = null;
    overlappingRef.current = [];
    overlappingIdxRef.current = 0;

    // 创建 overlay
    const overlay = doc.createElement("div");
    overlay.id = "__hs_overlay";
    overlay.style.cssText =
      "position:fixed;pointer-events:none;z-index:9999;border:2px dashed #f43f5e;border-radius:4px;transition:all 80ms ease;box-shadow:0 0 0 3px rgba(244,63,94,0.25);opacity:0;display:none";
    doc.body.appendChild(overlay);

    // 创建 label
    const label = doc.createElement("span");
    label.id = "__hs_label";
    label.style.cssText =
      "position:fixed;z-index:10000;background:rgba(244,63,94,0.95);color:white;padding:2px 8px;font-size:11px;border-radius:4px;font-family:monospace;white-space:nowrap;pointer-events:none;display:none";
    doc.body.appendChild(label);

    // 创建面包屑 (pointer-events:none，不拦截鼠标)
    const breadcrumb = doc.createElement("div");
    breadcrumb.id = "__hs_breadcrumb";
    breadcrumb.style.cssText =
      "position:fixed;z-index:10000;display:none;pointer-events:none;background:rgba(30,30,30,0.95);padding:4px 8px;border-radius:6px;font-family:system-ui;backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,0.3)";
    doc.body.appendChild(breadcrumb);

    overlayRef.current = { overlay, label, breadcrumb };

    // RAF 节流的 reposition
    let rafId: number | null = null;
    const handleReposition = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const tracked = trackedElRef.current;
        if (!tracked || !overlayRef.current) return;
        updateHighlightRef.current(tracked, iframe);
      });
    };

    doc.addEventListener("scroll", handleReposition, true);
    iframe.contentWindow?.addEventListener("resize", handleReposition);

    const updateForEl = (el: HTMLElement) => {
      trackedElRef.current = el;
      updateHighlightRef.current(el, iframe);

      // 更新面包屑
      const path = getDomPath(el);
      renderBreadcrumbRef.current(breadcrumb, path, iframe);
    };

    const handleMove = (e: MouseEvent) => {
      if (isLockedRef.current) return;
      lastMouseRef.current = { x: e.clientX, y: e.clientY };

      const el = doc.elementFromPoint(
        e.clientX,
        e.clientY,
      ) as HTMLElement | null;
      if (!el || el === doc.body || el === doc.documentElement) {
        overlay.style.display = "none";
        label.style.display = "none";
        breadcrumb.style.display = "none";
        trackedElRef.current = null;
        overlappingRef.current = [];
        return;
      }

      overlappingRef.current = [el];
      overlappingIdxRef.current = 0;
      updateForEl(el);
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isLockedRef.current) return;
      const el = trackedElRef.current;
      if (!el) return;
      selectElementRef.current(el, iframe);
    };

    const handleKey = (e: KeyboardEvent) => {
      // ESC: 退出
      if (e.key === "Escape") {
        onExit();
        return;
      }

      const tracked = trackedElRef.current;
      const iframe = iframeRef.current;
      if (!tracked || !iframe) return;

      // Shift: 切换到父级
      if (e.key === "Shift" && tracked.parentElement) {
        e.preventDefault();
        const parent = tracked.parentElement;
        if (parent !== doc.body) {
          updateForEl(parent);
          if (isLockedRef.current) {
            selectElement(parent, iframe);
          }
        }
        return;
      }

      // Tab: 切换重叠元素
      if (e.key === "Tab") {
        e.preventDefault();

        // 首次按 Tab 时才收集重叠元素
        if (overlappingRef.current.length <= 1) {
          const { x, y } = lastMouseRef.current;
          if (x && y) {
            overlappingRef.current = getElementsAtPoint(doc, x, y);
            overlappingIdxRef.current = 0;
          }
        }

        const overlapping = overlappingRef.current;
        if (overlapping.length > 1) {
          overlappingIdxRef.current =
            (overlappingIdxRef.current + (e.shiftKey ? -1 : 1) +
              overlapping.length) %
            overlapping.length;
          const nextEl = overlapping[overlappingIdxRef.current];
          updateForEl(nextEl);
          if (isLockedRef.current) {
            selectElement(nextEl, iframe);
          }
        }
        return;
      }
    };

    doc.addEventListener("mousemove", handleMove);
    doc.addEventListener("click", handleClick, true);
    window.addEventListener("keydown", handleKey);
    iframe.contentWindow?.addEventListener("keydown", handleKey);

    return () => {
      doc.removeEventListener("mousemove", handleMove);
      doc.removeEventListener("click", handleClick, true);
      doc.removeEventListener("scroll", handleReposition, true);
      iframe.contentWindow?.removeEventListener("resize", handleReposition);
      window.removeEventListener("keydown", handleKey);
      iframe.contentWindow?.removeEventListener("keydown", handleKey);
      if (rafId) cancelAnimationFrame(rafId);
      trackedElRef.current = null;
      removeOverlay();
    };
  }, [
    selectMode,
    removeOverlay,
    onSelected,
    onExit,
    selectElement,
    updateHighlight,
    renderBreadcrumb,
    iframeRef,
  ]);
}