import { useEffect, useRef, useState, useCallback } from "react"
import {
  EditorView,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { html } from "@codemirror/lang-html"
import { json } from "@codemirror/lang-json"
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
} from "@codemirror/language"
import { MergeView, getChunks } from "@codemirror/merge"
import { keymap } from "@codemirror/view"
import { CodeEditor } from "@/components/CodeEditor"

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
  // diff 高亮 — 整行（淡底色，不喧宾夺主）
  ".cm-mergeView-chunkA": { backgroundColor: "rgba(239, 68, 68, 0.08)" },
  ".cm-mergeView-chunkB": { backgroundColor: "rgba(34, 197, 94, 0.08)" },
  ".cm-mergeView-chunk": { backgroundColor: "rgba(234, 179, 8, 0.08)" },
  ".cm-mergeView-gap": {
    backgroundColor: "#f8fafc",
    borderLeft: "1px solid #e2e8f0",
    borderRight: "1px solid #e2e8f0",
  },
  // diff 高亮 — 字符级（醒目！）
  "& .cm-changedText": { backgroundColor: "#fbbf24", borderRadius: "2px", padding: "1px 0", outline: "1px solid #f59e0b" },
  "& .cm-deletedText": { backgroundColor: "#f87171", borderRadius: "2px", padding: "1px 0", outline: "1px solid #ef4444" },
  "& .cm-inlineChangedText": { backgroundColor: "#fbbf24", borderRadius: "2px", padding: "1px 0", outline: "1px solid #f59e0b" },
  "&.cm-merge-a .cm-changedText": { backgroundColor: "#fca5a5", borderRadius: "2px", padding: "1px 0", outline: "1px solid #f87171" },
  "&.cm-merge-b .cm-changedText": { backgroundColor: "#86efac", borderRadius: "2px", padding: "1px 0", outline: "1px solid #4ade80" },
  "& .cm-deletedChunk .cm-deletedText": { backgroundColor: "#f87171", borderRadius: "2px", padding: "1px 0", outline: "1px solid #ef4444" },
})

type ChunkInfo = { fromLine: number; toLine: number; totalLines: number }

type Props = {
  leftValue: string
  rightValue: string
  onLeftChange?: (value: string) => void
  onRightChange?: (value: string) => void
  language?: string
}

/* ───────── 两侧都有内容时：MergeView 对比模式 ───────── */
function CompareMode({
  leftValue,
  rightValue,
  onLeftChange,
  onRightChange,
  language,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mergeViewRef = useRef<MergeView | null>(null)
  const onLeftChangeRef = useRef(onLeftChange)
  const onRightChangeRef = useRef(onRightChange)
  // eslint-disable-next-line react-hooks/refs
  onLeftChangeRef.current = onLeftChange
  // eslint-disable-next-line react-hooks/refs
  onRightChangeRef.current = onRightChange

  const [chunks, setChunks] = useState<ChunkInfo[]>([])

  // 从 MergeView 中提取 chunks（带防抖）
  const updateChunksTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateChunks = useCallback(() => {
    if (updateChunksTimerRef.current) clearTimeout(updateChunksTimerRef.current)
    updateChunksTimerRef.current = setTimeout(() => {
      const mv = mergeViewRef.current
      if (!mv) return
      const infoA = getChunks(mv.a.state)
      const infoB = getChunks(mv.b.state)
      const info = infoA?.chunks.length ? infoA : infoB
      if (!info || !info.chunks.length) {
        setChunks([])
        return
      }
      const useA = mv.a.state.doc.lines >= mv.b.state.doc.lines
      const doc = useA ? mv.a.state : mv.b.state
      const totalDoc = doc.doc.lines
      const chunkInfos: ChunkInfo[] = info.chunks.map((c) => {
        const from = useA ? c.fromA : c.fromB
        const to = useA ? c.toA : c.toB
        const fromLine = doc.doc.lineAt(Math.min(from, doc.doc.length)).number
        const toLine = doc.doc.lineAt(Math.min(to, doc.doc.length)).number
        return { fromLine, toLine, totalLines: totalDoc }
      })
      setChunks(chunkInfos)
    }, 80)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const langExt = language === "html" ? html() : language === "json" ? json() : []

    const makeExtensions = (
      onChangeRef: React.MutableRefObject<((value: string) => void) | undefined>,
    ) => [
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
          onChangeRef.current?.(update.state.doc.toString())
          updateChunks()
        }
      }),
    ]

    const mergeView = new MergeView({
      a: { doc: leftValue, extensions: makeExtensions(onLeftChangeRef) },
      b: { doc: rightValue, extensions: makeExtensions(onRightChangeRef) },
      parent: containerRef.current,
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 4 },
      diffConfig: { scanLimit: 5000 },
    })

    mergeViewRef.current = mergeView

    // 滚动联动
    const cleanups: (() => void)[] = []
    const setupScrollSync = () => {
      const scrollers = containerRef.current?.querySelectorAll(".cm-mergeViewEditor .cm-scroller")
      if (scrollers && scrollers.length >= 2) {
        const left = scrollers[0] as HTMLElement
        const right = scrollers[1] as HTMLElement
        let syncing = false

        const syncScroll = (source: HTMLElement, target: HTMLElement) => {
          if (syncing) return
          syncing = true
          target.scrollTop = source.scrollTop
          requestAnimationFrame(() => { syncing = false })
        }

        const onLeftScroll = () => syncScroll(left, right)
        const onRightScroll = () => syncScroll(right, left)
        left.addEventListener("scroll", onLeftScroll, { passive: true })
        right.addEventListener("scroll", onRightScroll, { passive: true })
        cleanups.push(() => {
          left.removeEventListener("scroll", onLeftScroll)
          right.removeEventListener("scroll", onRightScroll)
        })
      }
    }

    const observer = new MutationObserver(() => {
      const hasEditors = containerRef.current?.querySelectorAll(".cm-mergeViewEditor .cm-editor")
      if (hasEditors && hasEditors.length > 0) {
        setupScrollSync()
        updateChunks()
        observer.disconnect()
      }
    })
    if (containerRef.current) {
      observer.observe(containerRef.current, { childList: true, subtree: true })
    }
    setTimeout(updateChunks, 100)

    return () => {
      observer.disconnect()
      cleanups.forEach((fn) => fn())
      if (updateChunksTimerRef.current) clearTimeout(updateChunksTimerRef.current)
      mergeView.destroy()
      mergeViewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language])

  // 同步左侧内容
  useEffect(() => {
    const mv = mergeViewRef.current
    if (!mv) return
    const current = mv.a.state.doc.toString()
    if (current !== leftValue) {
      mv.a.dispatch({
        changes: { from: 0, to: current.length, insert: leftValue },
      })
      setTimeout(updateChunks, 50)
    }
  }, [leftValue, updateChunks])

  // 同步右侧内容
  useEffect(() => {
    const mv = mergeViewRef.current
    if (!mv) return
    const current = mv.b.state.doc.toString()
    if (current !== rightValue) {
      mv.b.dispatch({
        changes: { from: 0, to: current.length, insert: rightValue },
      })
      setTimeout(updateChunks, 50)
    }
  }, [rightValue, updateChunks])

  // 点击导航条跳转
  const jumpToChunk = useCallback((chunk: ChunkInfo) => {
    const mv = mergeViewRef.current
    if (!mv) return
    const editor = mv.a.state.doc.lines >= mv.b.state.doc.lines ? mv.a : mv.b
    const line = Math.min(chunk.fromLine, editor.state.doc.length)
    const pos = editor.state.doc.line(line).from
    editor.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 50 }),
    })
  }, [])

  return (
    <div className="flex h-full relative">
      <style>{`
        .cm-mergeView .cm-mergeViewEditor .cm-editor,
        .cm-mergeView .cm-mergeViewEditor .cm-editor .cm-scroller {
          height: 100% !important;
        }
        .cm-mergeView .cm-mergeViewEditor .cm-editor {
          min-height: 200px;
        }
        .cm-mergeView .cm-mergeViewEditor .cm-editor .cm-scroller {
          overflow-y: auto !important;
        }
      `}</style>
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden [&_.cm-mergeView]:h-full [&_.cm-mergeView]:flex [&_.cm-mergeViewEditors]:flex-1 [&_.cm-mergeViewEditors]:min-w-0 [&_.cm-mergeViewEditor]:flex-1 [&_.cm-mergeViewEditor]:min-w-0"
      />
      {chunks.length > 0 && (
        <div className="w-3 bg-surface-secondary border-l border-separator relative shrink-0 cursor-pointer">
          {chunks.map((c, i) => {
            const top = ((c.fromLine - 1) / c.totalLines) * 100
            const height = Math.max(((c.toLine - c.fromLine + 1) / c.totalLines) * 100, 1.5)
            return (
              <div
                key={i}
                className="absolute left-0.5 right-0.5 rounded-sm opacity-70 hover:opacity-100 transition-opacity"
                style={{
                  top: `${top}%`,
                  height: `${height}%`,
                  backgroundColor: "#fbbf24",
                }}
                onClick={() => jumpToChunk(c)}
                title={`第 ${c.fromLine}-${c.toLine} 行有变化，点击跳转`}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ───────── 至少一侧为空时：独立编辑器模式 ───────── */
function EditMode({
  leftValue,
  rightValue,
  onLeftChange,
  onRightChange,
  language,
}: Props) {
  const cmLang = language === "json" ? "json" : "html"
  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 border-r border-separator">
        <CodeEditor value={leftValue} onChange={onLeftChange} language={cmLang} />
      </div>
      <div className="flex-1 min-w-0">
        <CodeEditor value={rightValue} onChange={onRightChange} language={cmLang} />
      </div>
    </div>
  )
}

/* ───────── 入口：根据两侧内容自动切换模式 ───────── */
export function DiffView(props: Props) {
  const hasBoth = props.leftValue.trim().length > 0 && props.rightValue.trim().length > 0
  return hasBoth ? <CompareMode {...props} /> : <EditMode {...props} />
}
