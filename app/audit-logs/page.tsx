"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

type AuditLog = {
  id: number
  menu: string
  action: string
  actor_id: string
  actor_name: string
  description: string
  target_table: string | null
  target_id: string | null
  created_at: string
}

export default function AuditLogsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [menuFilter, setMenuFilter] = useState<string>("all")
  const [actorFilter, setActorFilter] = useState<string>("")
  const pageSize = 30

  useEffect(() => {
    const fetchInitial = async () => {
      // ensure admin access; RLS will block otherwise
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }
      loadMore(true)
    }
    fetchInitial()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadMore = async (reset = false) => {
    let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(pageSize)

    if (cursor) {
      query = query.lt("created_at", cursor)
    }

    if (menuFilter !== "all") {
      query = query.eq("menu", menuFilter)
    }

    if (actorFilter.trim()) {
      query = query.ilike("actor_name", `%${actorFilter}%`)
    }

    const { data, error } = await query
    if (error) {
      console.error("[audit] fetch error:", error.message)
      return
    }

    const newLogs = data as AuditLog[]
    if (reset) {
      setLogs(newLogs)
    } else {
      setLogs((prev) => [...prev, ...newLogs])
    }
    setHasMore(newLogs.length === pageSize)
    setCursor(newLogs.length > 0 ? newLogs[newLogs.length - 1].created_at : cursor)
  }

  const menus = useMemo(() => ["all", "taxes", "stations", "notifications", "schedules", "emails", "channels", "settings", "users"], [])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="font-bold tracking-tight text-2xl">이력 관리</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>감사 로그</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="w-48">
              <Select value={menuFilter} onValueChange={(v) => { setMenuFilter(v); setCursor(null); loadMore(true) }}>
                <SelectTrigger>
                  <SelectValue placeholder="메뉴" />
                </SelectTrigger>
                <SelectContent>
                  {menus.map((m) => (
                    <SelectItem key={m} value={m}>{m === "all" ? "전체" : m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Input
                placeholder="작업자 이름 검색"
                value={actorFilter}
                onChange={(e) => setActorFilter(e.target.value)}
                onBlur={() => { setCursor(null); loadMore(true) }}
              />
            </div>
            <Button variant="outline" onClick={() => { setCursor(null); loadMore(true) }}>필터 적용</Button>
          </div>

          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start justify-between border rounded-md p-3">
                <div className="space-y-1">
                  <div className="text-sm"><span className="font-medium">메뉴:</span> {log.menu} <span className="ml-2 font-medium">작업:</span> {log.action}</div>
                  <div className="text-sm"><span className="font-medium">작업자:</span> {log.actor_name}</div>
                  <div className="text-sm"><span className="font-medium">내용:</span> {log.description}</div>
                  {log.target_table && (
                    <div className="text-xs text-muted-foreground">{log.target_table} • {log.target_id}</div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                  {new Date(log.created_at).toLocaleString("ko-KR")}
                </div>
              </div>
            ))}
            {hasMore && (
              <div className="pt-2">
                <Button variant="ghost" onClick={() => loadMore()}>더 보기</Button>
              </div>
            )}
            {!hasMore && logs.length === 0 && (
              <div className="text-center text-muted-foreground py-6">표시할 로그가 없습니다.</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

