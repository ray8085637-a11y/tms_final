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
      supabase.from("teams_channels").select("webhook_url").eq("is_active", true),
    ])

    const emails = (recipients || []).map((r: any) => r.email)
    const webhooks = (channels || []).map((c: any) => c.webhook_url)

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

      // Send emails directly via SendGrid to avoid internal routing issues
      if (emails.length > 0) {
        const apiKey = process.env.SENDGRID_API_KEY
        const fromEmail = process.env.SENDGRID_FROM_EMAIL
        if (apiKey && fromEmail) {
          await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              personalizations: [
                { to: emails.map((email: string) => ({ email })), subject: "세금 일정 알림" },
              ],
              from: { email: fromEmail, name: "TMS 세금 관리 시스템" },
              content: [
                { type: "text/plain", value: msg },
                { type: "text/html", value: msg.replace(/\n/g, "<br>") },
              ],
            }),
          })
        }
      }

      // Send teams
      if (webhooks.length > 0) {
        await Promise.all(
          webhooks.map((url: string) =>
            fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: msg }) }),
          ),
        )
      }

      dispatched += taxes.length
    }

    return NextResponse.json({ success: true, dispatched, now: nowStr })
  } catch (e) {
    return NextResponse.json({ success: false, error: (e as Error).message || "Unknown" }, { status: 500 })
  }
}

