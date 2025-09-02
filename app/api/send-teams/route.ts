import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const webhookUrls: string[] = Array.isArray(body?.webhookUrls) ? body.webhookUrls : []
    const channelIds: string[] = Array.isArray(body?.channelIds) ? body.channelIds : []
    const text: string = typeof body?.text === "string" && body.text.trim().length > 0 ? body.text : `TMS 테스트 메시지 (${new Date().toLocaleString("ko-KR")})`

    let urls = webhookUrls
    if (channelIds.length > 0) {
      const { data: channels, error } = await supabase
        .from("teams_channels")
        .select("webhook_url")
        .in("id", channelIds)
        .eq("is_active", true)
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }
      urls = [...urls, ...((channels || []).map((c: any) => c.webhook_url) as string[])]
    }

    // dedupe
    urls = Array.from(new Set(urls.filter((u) => typeof u === "string" && u.startsWith("http"))))
    if (urls.length === 0) {
      return NextResponse.json({ success: false, error: "No webhook URLs provided" }, { status: 400 })
    }

    let ok = 0
    let fail = 0
    for (const url of urls) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        })
        if (resp.ok) ok++
        else fail++
      } catch {
        fail++
      }
    }

    return NextResponse.json({ success: true, sent: ok, failed: fail })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}

