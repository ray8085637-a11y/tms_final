import { type NextRequest, NextResponse } from "next"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Starting email send request")

    const body = await request.json()
    console.log("[v0] Email request data:", JSON.stringify(body))

    const { to, subject, content } = body

    if (!to || !Array.isArray(to) || to.length === 0) {
      console.log("[v0] Invalid recipients")
      return NextResponse.json({ success: false, error: "Invalid recipients" }, { status: 400 })
    }

    if (!subject) {
      console.log("[v0] Missing subject")
      return NextResponse.json({ success: false, error: "Subject is required" }, { status: 400 })
    }

    // Check environment variables
    const apiKey = process.env.SENDGRID_API_KEY
    const fromEmail = process.env.SENDGRID_FROM_EMAIL

    if (!apiKey) {
      console.log("[v0] SendGrid API key not configured")
      return NextResponse.json({ success: false, error: "SendGrid API key not configured" }, { status: 500 })
    }

    if (!fromEmail) {
      console.log("[v0] SendGrid from email not configured")
      return NextResponse.json({ success: false, error: "SendGrid from email not configured" }, { status: 500 })
    }

    console.log("[v0] Sending email via SendGrid")

    // SendGrid API call
    const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: to.map((email: string) => ({ email })),
            subject: subject,
          },
        ],
        from: {
          email: fromEmail,
          name: "TMS 세금 관리 시스템",
        },
        content: [
          {
            type: "text/plain",
            value:
              content ||
              `TMS 시스템에서 보내는 테스트 이메일입니다.\n\n발송 시간: ${new Date().toLocaleString("ko-KR")}\n\n이 이메일을 받으셨다면 이메일 알림 시스템이 정상적으로 작동하고 있습니다.`,
          },
          {
            type: "text/html",
            value: content
              ? `<p>${content.replace(/\n/g, "<br>")}</p>`
              : `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">TMS 테스트 이메일</h2>
                <p>TMS 시스템에서 보내는 테스트 이메일입니다.</p>
                <p><strong>발송 시간:</strong> ${new Date().toLocaleString("ko-KR")}</p>
                <p>이 이메일을 받으셨다면 이메일 알림 시스템이 정상적으로 작동하고 있습니다.</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p style="color: #666; font-size: 12px;">TMS 세금 관리 시스템</p>
              </div>
            `,
          },
        ],
      }),
    })

    console.log("[v0] SendGrid response status:", sgResponse.status)

    if (!sgResponse.ok) {
      const errorText = await sgResponse.text()
      console.log("[v0] SendGrid error response:", errorText)
      return NextResponse.json(
        {
          success: false,
          error: `SendGrid API error: ${sgResponse.status} - ${errorText}`,
        },
        { status: 500 },
      )
    }

    console.log("[v0] Email sent successfully")
    return NextResponse.json({ success: true, message: "Email sent successfully" })
  } catch (error) {
    console.error("[v0] Email sending error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
