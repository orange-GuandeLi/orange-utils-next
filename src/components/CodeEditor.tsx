import { useEffect, useRef } from "react"
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
} from "@codemirror/view"
import { EditorState } from "@codemirror/state"
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands"
import { html } from "@codemirror/lang-html"
import { json } from "@codemirror/lang-json"
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  foldGutter,
} from "@codemirror/language"
import { linter, lintGutter } from "@codemirror/lint"
import { jsonParseLinter } from "@codemirror/lang-json"

const lightTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "#ffffff" },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    overflow: "auto",
  },
  ".cm-content": { padding: "8px 0", caretColor: "#3b82f6" },
  ".cm-gutters": { backgroundColor: "#f8fafc", borderRight: "1px solid #e2e8f0", color: "#94a3b8" },
  ".cm-activeLineGutter": { backgroundColor: "#f1f5f9", color: "#475569" },
  ".cm-activeLine": { backgroundColor: "#f8fafc" },
  ".cm-foldGutter": { color: "#cbd5e1" },
  "&.cm-focused .cm-cursor": { borderLeftColor: "#3b82f6" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": { backgroundColor: "#bfdbfe" },
  ".cm-matchingBracket": { backgroundColor: "#dbeafe", outline: "1px solid #93c5fd" },
})

type Props = {
  value: string
  onChange?: (value: string) => void
  language?: "html" | "json"
  readOnly?: boolean
}

export function CodeEditor({ value, onChange, language = "html", readOnly = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  // eslint-disable-next-line react-hooks/refs -- ref 镜像保持闭包最新
  onChangeRef.current = onChange

  useEffect(() => {
    if (!containerRef.current) return

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      history(),
      bracketMatching(),
      foldGutter(),
      syntaxHighlighting(defaultHighlightStyle),
      language === "html" ? html() : json(),
      lightTheme,
      keymap.of([...defaultKeymap, ...historyKeymap]),
    ]

    // JSON 模式：实时语法错误检测
    if (language === "json") {
      extensions.push(linter(jsonParseLinter(), { delay: 300 }))
      extensions.push(lintGutter())
    }

    if (!readOnly) {
      extensions.push(
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current?.(update.state.doc.toString())
        }),
      )
    } else {
      extensions.push(EditorState.readOnly.of(true))
      extensions.push(EditorView.editable.of(false))
    }

    const state = EditorState.create({ doc: value, extensions })
    const view = new EditorView({ state, parent: containerRef.current })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, readOnly])

  // 同步外部 value 变化到编辑器
  // CodeMirror 内部 onChange 后 current 必等于 value，自然跳过 → 无需 lastDispatchedRef
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }, [value])

  return <div ref={containerRef} className="h-full overflow-hidden" />
}
