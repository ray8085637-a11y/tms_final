import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

export async function POST(req: NextRequest) {
  try {
    // Optional protection for external schedulers (AWS/EventBridge, etc.)
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const url = new URL(req.url)
      const provided = req.headers.get("x-cron-key") || url.searchParams.get("key")
      if (provided !== cronSecret) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
      }
    }

    const supabase = createAdminClient()

    // Load active schedules
    const { data: schedules, error: schedErr } = await supabase
      .from("notification_schedules")
      .select("id, days_before, notification_time, is_active")
      .eq("is_active", true)
    if (schedErr) throw schedErr

    if (!schedules || schedules.length === 0) {
      return NextResponse.json({ success: true, dispatched: 0 })
    }

    // Determine current time window
    const now = new Date()
    const nowStr = now.toISOString()

    let dispatched = 0

    // Fetch recipients and teams channels
    const [{ data: recipients }, { data: channels }] = await Promise.all([
      supabase.from("email_recipients").select("email").eq("is_active", true),
      supabase.from("teams_channels").select("id, webhook_url").eq("is_active", true),
    ])

    const emails = (recipients || []).map((r: any) => r.email)
    const webhooksAll = (channels || []).map((c: any) => c.webhook_url)

    for (const sched of schedules as any[]) {
      // Find taxes due at target day
      const targetDate = new Date(now)
      // Using days_before
      targetDate.setDate(now.getDate() + sched.days_before)
      const y = targetDate.getFullYear()
      const m = String(targetDate.getMonth() + 1).padStart(2, "0")
      const d = String(targetDate.getDate()).padStart(2, "0")
      const dateStr = `${y}-${m}-${d}`

      const { data: taxes, error: taxErr } = await supabase
        .from("taxes")
        .select("id, tax_type, tax_amount, due_date, charging_stations(station_name)")
        .eq("due_date", dateStr)
      if (taxErr) throw taxErr

      if (!taxes || taxes.length === 0) continue

      // Build message
      const msg = `세금 일정 알림\n대상 건수: ${taxes.length}건\n기한: ${dateStr}`

      // Email 전송 제거(Teams만 발송)

      // Send teams
      if (webhooksAll.length > 0) {
        await Promise.all(
          webhooksAll.map((url: string) =>
            fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg }) }),
          ),
        )
      }

      dispatched += taxes.length
    }

    // Manual notifications: send at configured date/time when due
    const kst = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date())
      .reduce((acc: any, p) => ((acc[p.type] = p.value), acc), {})

    const yyyy = kst.year
    const mm = kst.month
    const dd = kst.day
    const hh = kst.hour
    const min = kst.minute
    const todayKst = `${yyyy}-${mm}-${dd}`
    const nowHm = `${hh}:${min}`

    const { data: pendingManuals } = await supabase
      .from("notifications")
      .select("id, message, notification_date, notification_time, teams_channel_id")
      .eq("notification_type", "manual")
      .eq("is_sent", false)
      .eq("notification_date", todayKst)

    let dispatchedManual = 0
    if (pendingManuals && pendingManuals.length > 0) {
      // Optional mapping for channel-specific sends
      const idToWebhook = new Map<string, string>()
      ;(channels || []).forEach((c: any) => idToWebhook.set(c.id, c.webhook_url))

      for (const n of pendingManuals as any[]) {
        if ((n.notification_time as string) > nowHm) continue

        const msg = n.message as string

        // Email 전송 제거(Teams만 발송)

        // Send teams to selected channel or all
        const targetWebhook = n.teams_channel_id ? idToWebhook.get(n.teams_channel_id) : null
        const targets = targetWebhook ? [targetWebhook] : webhooksAll
        if (targets.length > 0) {
          await Promise.all(
            targets.map((url: string) =>
              fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg }) }),
            ),
          )
        }

        // Mark as sent
        await supabase
          .from("notifications")
          .update({ is_sent: true, sent_at: new Date().toISOString() })
          .eq("id", n.id)

        dispatchedManual++
      }
    }

    return NextResponse.json({ success: true, dispatched, dispatchedManual, now: nowStr })
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message || "Unknown" }, { status: 500 })
  }
}

