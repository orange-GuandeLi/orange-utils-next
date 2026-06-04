"use client"

import { useCallback, useState } from "react"
import { kvDelete, kvGet, kvKeys, kvSet } from "@/utils/db"

export type SavedItem = {
  name: string
  savedAt: number
}

/**
 * 通用「保存 / 加载 / 删除」资源 hook。
 *
 * 替代各工具页面里重复的 modal 状态、列表加载、save/load/delete 模板代码，
 * 顺带消掉一堆 `react-hooks/set-state-in-effect` 的 disable 注释。
 */
export function useResource<T extends SavedItem>(prefix: string) {
  const [items, setItems] = useState<T[]>([])
  const [currentName, setCurrentName] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [loadOpen, setLoadOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState("")

  const refresh = useCallback(async () => {
    const keys = (await kvKeys()).filter((k) => k.startsWith(prefix))
    const entries: T[] = []
    for (const key of keys) {
      const v = await kvGet<T>(key)
      if (v) entries.push(v as T)
    }
    entries.sort((a, b) => b.savedAt - a.savedAt)
    setItems(entries)
  }, [prefix])

  // 打开加载面板：先刷新列表，再打开
  const openLoad = useCallback(async () => {
    await refresh()
    setLoadOpen(true)
  }, [refresh])

  const closeLoad = useCallback(() => setLoadOpen(false), [])

  // 打开保存面板：可预填名称（用于"另存为"）
  const openSave = useCallback((initialName: string = "") => {
    setSaveName(initialName)
    setSaveOpen(true)
  }, [])

  const closeSave = useCallback(() => {
    setSaveOpen(false)
    setSaveName("")
  }, [])

  // 新建保存：必须通过 saveName 设置过名称
  const save = useCallback(
    async (data: T): Promise<string | null> => {
      const name = saveName.trim()
      if (!name) return null
      const item = { ...data, name, savedAt: Date.now() } as T
      await kvSet(prefix + name, item)
      setCurrentName(name)
      setDirty(false)
      setSaveOpen(false)
      setSaveName("")
      return name
    },
    [prefix, saveName],
  )

  // 覆盖当前 currentName
  const overwrite = useCallback(
    async (data: T): Promise<boolean> => {
      if (!currentName) return false
      const item = { ...data, name: currentName, savedAt: Date.now() } as T
      await kvSet(prefix + currentName, item)
      setDirty(false)
      return true
    },
    [prefix, currentName],
  )

  // 加载某条：返回原 item 供调用方更新自己的状态
  const load = useCallback((item: T): T => {
    setCurrentName(item.name)
    setLoadOpen(false)
    setDirty(false)
    return item
  }, [])

  const remove = useCallback(
    async (item: T) => {
      await kvDelete(prefix + item.name)
      if (currentName === item.name) setCurrentName(null)
      await refresh()
    },
    [prefix, currentName, refresh],
  )

  return {
    items,
    currentName,
    dirty,
    setDirty,
    loadOpen,
    saveOpen,
    saveName,
    setSaveName,
    openLoad,
    closeLoad,
    openSave,
    closeSave,
    save,
    overwrite,
    load,
    remove,
    refresh,
  }
}
