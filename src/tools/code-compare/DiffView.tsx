import { useEffect, useRef } from "react";
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import { json } from "@codemirror/lang-json";
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter } from "@codemirror/language";
import { MergeView } from "@codemirror/merge";
import { keymap } from "@codemirror/view";

const lightTheme = EditorView.theme({
  "&": { fontSize: "13px", backgroundColor: "#ffffff" },
  ".cm-scroller": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  ".cm-content": { padding: "8px 0", caretColor: "#3b82f6" },
  ".cm-gutters": { backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0", color: "#94a3b8" },
  ".cm-activeLineGutter": { backgroundColor: "#f1f5f9", color: "#475569" },
  ".cm-activeLine": { backgroundColor: "#f8fafc" },
  ".cm-foldGutter": { color: "#cbd5e1" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "#3b82f6" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "#bfdbfe" },
  ".cm-matchingBracket": { backgroundColor: "#dbeafe", outline: "1px solid #93c5fd" },
  // diff 高亮
  ".cm-mergeView-chunkA": { backgroundColor: "#fee2e2" },
  ".cm-mergeView-chunkB": { backgroundColor: "#dcfce7" },
  ".cm-mergeView-chunk": { backgroundColor: "#fef9c3" },
  ".cm-mergeView-gap": {
    backgroundColor: "#f8fafc",
    borderLeft: "1px solid #e2e8f0",
    borderRight: "1px solid #e2e8f0",
  },
});

type Props = {
  leftValue: string;
  rightValue: string;
  onLeftChange?: (value: string) => void;
  onRightChange?: (value: string) => void;
  language?: string;
};

export function DiffView({
  leftValue,
  rightValue,
  onLeftChange,
  onRightChange,
  language = "html",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const onLeftChangeRef = useRef(onLeftChange);
  const onRightChangeRef = useRef(onRightChange);
  onLeftChangeRef.current = onLeftChange;
  onRightChangeRef.current = onRightChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const langExt =
      language === "html" ? html() : language === "json" ? json() : [];

    const makeExtensions = (onChangeRef: React.MutableRefObject<((value: string) => void) | undefined>) => [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      bracketMatching(),
      foldGutter(),
      syntaxHighlighting(defaultHighlightStyle),
      langExt,
      lightTheme,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current?.(update.state.doc.toString());
        }
      }),
    ];

    const mergeView = new MergeView({
      a: {
        doc: leftValue,
        extensions: makeExtensions(onLeftChangeRef),
      },
      b: {
        doc: rightValue,
        extensions: makeExtensions(onRightChangeRef),
      },
      parent: containerRef.current,
      highlightChanges: true,
      gutter: true,
    });

    mergeViewRef.current = mergeView;

    // 强制设置编辑器和滚动区高度填满
    // MergeView 内部 CSS: .cm-mergeView .ͼ1, .cm-mergeView .ͼ1 .cm-scroller { height: auto !important; }
    // 必须用 inline !important 覆盖
    const setEditorHeight = () => {
      const editors = containerRef.current?.querySelectorAll('.cm-mergeViewEditor .cm-editor');
      editors?.forEach(el => {
        (el as HTMLElement).style.setProperty('height', '100%', 'important');
      });
      const scrollers = containerRef.current?.querySelectorAll('.cm-mergeViewEditor .cm-scroller');
      scrollers?.forEach(el => {
        (el as HTMLElement).style.setProperty('height', '100%', 'important');
        (el as HTMLElement).style.setProperty('overflow-y', 'auto', 'important');
      });
    };
    setTimeout(setEditorHeight, 0);
    setTimeout(setEditorHeight, 100);

    return () => {
      mergeView.destroy();
      mergeViewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // 同步左侧内容
  useEffect(() => {
    const mv = mergeViewRef.current;
    if (!mv) return;
    const current = mv.a.state.doc.toString();
    if (current !== leftValue) {
      mv.a.dispatch({
        changes: { from: 0, to: current.length, insert: leftValue },
      });
    }
  }, [leftValue]);

  // 同步右侧内容
  useEffect(() => {
    const mv = mergeViewRef.current;
    if (!mv) return;
    const current = mv.b.state.doc.toString();
    if (current !== rightValue) {
      mv.b.dispatch({
        changes: { from: 0, to: current.length, insert: rightValue },
      });
    }
  }, [rightValue]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-auto [&_.cm-mergeView]:h-full [&_.cm-mergeView]:flex [&_.cm-mergeViewEditors]:flex-1 [&_.cm-mergeViewEditors]:min-w-0 [&_.cm-mergeViewEditor]:flex-1 [&_.cm-mergeViewEditor]:min-w-0 [&_.cm-mergeViewEditor_.cm-editor]:h-full"
    />
  );
}