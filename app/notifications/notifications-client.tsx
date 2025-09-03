"use client"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { logAudit } from "@/lib/audit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { Clock, AlertTriangle, Plus, Search } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

interface Notification {
  id: string
  tax_id: string | null
  notification_type: "auto" | "manual"
  schedule_id: string | null
  notification_date: string
  notification_time: string
  message: string
  is_sent: boolean
  sent_at: string | null
  teams_channel_id: string | null
  created_at: string
  taxes?: {
    id: string
    tax_type: string
    tax_amount: number
    due_date: string
    charging_stations: {
      station_name: string
      location: string
    }
  }
  teams_channels?: {
    id: string
    channel_name: string
  }
  notification_schedules?: {
    schedule_name: string
    days_before: number
  }
}

interface TeamsChannel {
  id: string
  channel_name: string
  webhook_url: string
  is_active: boolean
}

interface Schedule {
  id: string
  schedule_name: string
  days_before: number
  notification_time: string
  is_active: boolean
}

interface Tax {
  id: string
  tax_type: string
  tax_amount: number
  due_date: string
  status: string
  charging_stations: {
    station_name: string
    location: string
  }
}

interface EmailRecipient {
  id: string
  email: string
  name: string | null
  is_active: boolean
}

type NotificationsClientProps = {}

const typeLabels = {
  auto: "자동",
  manual: "수동",
}

const taxTypeLabels = {
  acquisition: "취득세",
  property: "재산세",
  other: "기타세",
}

export function NotificationsClient() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [teamsChannels, setTeamsChannels] = useState<TeamsChannel[]>([])
  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[]>([])
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [taxes, setTaxes] = useState<Tax[]>([])
  const [userRole, setUserRole] = useState<string>("viewer")
  const [userId, setUserId] = useState<string>("")
  const [actorName, setActorName] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [sortBy, setSortBy] = useState<string>("date-desc")
  const [isCreateNotificationOpen, setIsCreateNotificationOpen] = useState(false)
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false)
  const [isCreateEmailOpen, setIsCreateEmailOpen] = useState(false)
  const [isCreateEmailRecipientOpen, setIsCreateEmailRecipientOpen] = useState(false)
  const [newEmailRecipient, setNewEmailRecipient] = useState({ name: "", email: "" })
  const [editingNotification, setEditingNotification] = useState<Notification | null>(null)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) {
          router.push("/auth/login")
          return
        }

        const { data: profile } = await supabase.from("users").select("role, name, email").eq("id", user.id).single()

        if (profile) {
          setUserRole(profile.role)
          setUserId(user.id)
          setActorName(profile.name || profile.email || "")
        }

        const { data: notificationsData } = await supabase
          .from("notifications")
          .select(`
            *,
            taxes (
              id,
              tax_type,
              tax_amount,
              due_date,
              charging_stations (
                station_name,
                location
              )
            ),
            teams_channels (
              id,
              channel_name
            ),
            notification_schedules (
              schedule_name,
              days_before
            )
          `)
          .order("created_at", { ascending: false })

        if (notificationsData) {
          setNotifications(notificationsData)
        }

        const { data: channelsData } = await supabase
          .from("teams_channels")
          .select("*")
          .eq("is_active", true)
          .order("channel_name")

        if (channelsData) {
          setTeamsChannels(channelsData)
        }

        const { data: schedulesData } = await supabase
          .from("notification_schedules")
          .select("*")
          .eq("is_active", true)
          .order("schedule_name")

        if (schedulesData) {
          setSchedules(schedulesData)
        }

        const { data: taxesData } = await supabase
          .from("taxes")
          .select(`
            *,
            charging_stations (
              station_name,
              location
            )
          `)
          .order("due_date")

        if (taxesData) {
          setTaxes(taxesData)
        }

        const { data: emailData } = await supabase
          .from("email_recipients")
          .select("*")
          .eq("is_active", true)
          .order("email")

        if (emailData) {
          setEmailRecipients(emailData)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [router, supabase])

  const isAdmin = userRole === "admin"

  const filteredAndSortedNotifications = useMemo(() => {
    let filtered = notifications

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (n) =>
          n.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.taxes?.charging_stations?.station_name?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    // Status filter
    if (filterStatus !== "all") {
      if (filterStatus === "sent") {
        filtered = filtered.filter((n) => n.is_sent)
      } else if (filterStatus === "pending") {
        filtered = filtered.filter((n) => !n.is_sent)
      }
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter((n) => n.notification_type === filterType)
    }

    // Sort notifications
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-desc":
          return new Date(b.notification_date).getTime() - new Date(a.notification_date).getTime()
        case "date-asc":
          return new Date(a.notification_date).getTime() - new Date(b.notification_date).getTime()
        case "priority":
          // Tax reminders get higher priority
          const aPriority = a.message.includes("세금") || a.message.includes("납부") ? 1 : 0
          const bPriority = b.message.includes("세금") || b.message.includes("납부") ? 1 : 0
          return bPriority - aPriority
        case "status":
          return Number(a.is_sent) - Number(b.is_sent)
        default:
          return 0
      }
    })

    return filtered
  }, [notifications, searchTerm, filterStatus, filterType, sortBy])

  const groupedNotifications = useMemo(() => {
    const groups: { [key: string]: Notification[] } = {}

    filteredAndSortedNotifications.forEach((notification) => {
      const date = new Date(notification.notification_date).toLocaleDateString("ko-KR")
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(notification)
    })

    return groups
  }, [filteredAndSortedNotifications])

  const NotificationCard = ({
    notification,
    variant = "default",
  }: { notification: Notification; variant?: "default" | "tax" | "unread" | "sent" }) => {
    const getVariantStyles = () => {
      switch (variant) {
        case "tax":
          return "border-yellow-200 bg-yellow-50/50"
        case "unread":
          return "border-blue-200 bg-blue-50/50"
        case "sent":
          return "border-green-200 bg-green-50/50"
        default:
          return ""
      }
    }

    const getMessageStyles = () => {
      switch (variant) {
        case "tax":
          return "bg-yellow-100/50 border-yellow-200 text-yellow-800"
        case "unread":
          return "bg-blue-100/50 border-blue-200 text-blue-800"
        case "sent":
          return "bg-green-100/50 border-green-200 text-green-800"
        default:
          return "bg-muted/50"
      }
    }

    const getTitleColor = () => {
      switch (variant) {
        case "tax":
          return "text-yellow-800"
        case "unread":
          return "text-blue-800"
        case "sent":
          return "text-green-800"
        default:
          return ""
      }
    }

    return (
      <Card className={`relative ${getVariantStyles()}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className={`text-base ${getTitleColor()}`}>{notification.message}</CardTitle>
                {notification.notification_type === "auto" && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                    자동
                  </Badge>
                )}
                {notification.notification_schedules && (
                  <Badge variant="outline" className="text-xs">
                    {notification.notification_schedules.schedule_name}
                  </Badge>
                )}
                {variant === "tax" && <Badge className="bg-yellow-100 text-yellow-800 text-xs">세금 리마인더</Badge>}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  📅 {new Date(notification.notification_date).toLocaleDateString("ko-KR")}
                </span>
                <span className="flex items-center gap-1">🕘 {notification.notification_time}</span>
                {notification.taxes?.charging_stations?.station_name && (
                  <span className="flex items-center gap-1">
                    🏢 {notification.taxes.charging_stations.station_name}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-2">
              {notification.is_sent ? (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 text-xs">
                  발송 완료
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  발송 대기
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className={`p-3 rounded-md text-sm ${getMessageStyles()}`}>{notification.message}</div>

          {notification.sent_at && (
            <div
              className={`mt-2 text-xs font-medium ${variant === "sent" ? "text-green-700" : "text-muted-foreground"}`}
            >
              발송일: {new Date(notification.sent_at).toLocaleString("ko-KR")}
            </div>
          )}

          {/* Delete action for admins */}
          {isAdmin && (
            <div className="mt-3 flex justify-end">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteNotification(notification.id)}
                disabled={isActionLoading}
              >
                삭제
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const handleCreateNotification = async (formData: FormData) => {
    setIsActionLoading(true)

    const rawTaxId = (formData.get("tax_id") as string) || ""
    const rawChannelId = (formData.get("teams_channel_id") as string) || ""

    const notificationData = {
      tax_id: rawTaxId && rawTaxId !== "none" ? rawTaxId : null,
      notification_type: "manual" as const,
      notification_date: formData.get("notification_date") as string,
      notification_time: formData.get("notification_time") as string,
      message: formData.get("message") as string,
      teams_channel_id: rawChannelId && rawChannelId !== "none" ? rawChannelId : null,
      created_by: userId,
    }

    const { data, error } = await supabase
      .from("notifications")
      .insert([notificationData])
      .select(`
        *,
        taxes (
          id,
          tax_type,
          tax_amount,
          due_date,
          charging_stations (
            station_name,
            location
          )
        ),
        teams_channels (
          id,
          channel_name
        )
      `)
      .single()

    if (error) {
      toast({
        title: "오류",
        description: "알림 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } else {
      setNotifications([data, ...notifications])
      // audit log: create notification
      logAudit({
        menu: "notifications",
        action: "create",
        actorId: userId,
        actorName: actorName || "사용자",
        description: `알림 생성: ${data.message?.slice(0, 50)}`,
        targetTable: "notifications",
        targetId: data.id,
      })
      setIsCreateNotificationOpen(false)
      toast({
        title: "성공",
        description: "알림이 성공적으로 생성되었습니다.",
      })
    }

    setIsActionLoading(false)
  }

  const handleCreateTeamsChannel = async (formData: FormData) => {
    if (!isAdmin) return

    setIsActionLoading(true)

    const channelData = {
      channel_name: formData.get("channel_name") as string,
      webhook_url: formData.get("webhook_url") as string,
      created_by: userId,
    }

    const { data, error } = await supabase.from("teams_channels").insert([channelData]).select().single()

    if (error) {
      toast({
        title: "오류",
        description: "Teams 채널 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } else {
      setTeamsChannels([...teamsChannels, data])
      // audit log
      logAudit({
        menu: "channels",
        action: "create",
        actorId: userId,
        actorName: actorName || "사용자",
        description: `Teams 채널 등록: ${data.channel_name}`,
        targetTable: "teams_channels",
        targetId: data.id,
      })
      setIsCreateChannelOpen(false)
      toast({
        title: "성공",
        description: "Teams 채널이 성공적으로 등록되었습니다.",
      })
    }

    setIsActionLoading(false)
  }

  const handleDeleteTeamsChannel = async (channelId: string) => {
    if (!isAdmin) return

    if (!window.confirm("해당 Teams 채널을 삭제하시겠습니까?")) return

    setIsActionLoading(true)
    try {
      const { error } = await supabase.from("teams_channels").update({ is_active: false }).eq("id", channelId)
      if (error) throw error
      setTeamsChannels(teamsChannels.filter((c) => c.id !== channelId))
      // audit log
      logAudit({
        menu: "channels",
        action: "delete",
        actorId: userId,
        actorName: actorName || "사용자",
        description: `Teams 채널 삭제: ID ${channelId}`,
        targetTable: "teams_channels",
        targetId: channelId,
      })
      toast({ title: "삭제 완료", description: "Teams 채널이 삭제되었습니다." })
    } catch (e) {
      toast({ title: "오류", description: "Teams 채널 삭제에 실패했습니다.", variant: "destructive" })
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleCreateEmailRecipient = async () => {
    if (!isAdmin) return

    setIsActionLoading(true)
    try {
      const { error } = await supabase.from("email_recipients").insert([
        {
          name: newEmailRecipient.name || null,
          email: newEmailRecipient.email,
          is_active: true,
        },
      ])

      if (error) throw error

      // Refresh email recipients
      await fetchEmailRecipients()

      setIsCreateEmailRecipientOpen(false)
      setNewEmailRecipient({ name: "", email: "" })

      toast({
        title: "성공",
        description: "이메일 수신자가 생성되었습니다.",
      })
    } catch (error) {
      console.error("Error creating email recipient:", error)
      toast({
        title: "오류",
        description: "이메일 수신자 생성에 실패했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleDeleteEmailRecipient = async (recipientId: string) => {
    if (!isAdmin) return

    const confirmed = window.confirm("해당 이메일 수신자를 삭제하시겠습니까?")
    if (!confirmed) return

    setIsActionLoading(true)
    try {
      const { error } = await supabase.from("email_recipients").update({ is_active: false }).eq("id", recipientId)

      if (error) throw error

      await fetchEmailRecipients()

      toast({ title: "삭제 완료", description: "이메일 수신자가 삭제되었습니다." })
    } catch (error) {
      console.error("Error deleting email recipient:", error)
      toast({ title: "오류", description: "이메일 수신자 삭제에 실패했습니다.", variant: "destructive" })
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleSendNotification = async (notificationId: string) => {
    if (!isAdmin) return

    setIsActionLoading(true)

    const notification = notifications.find((n) => n.id === notificationId)
    if (!notification) return

    try {
      // Send email notifications
      if (emailRecipients.length > 0) {
        const emailAddresses = emailRecipients.map((r) => r.email)
        const emailResponse = await fetch("/api/send-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: emailAddresses,
            subject: "TMS 세금 알림",
            html: `
              <h2>TMS 세금 알림</h2>
              <p>${notification.message}</p>
              ${
                notification.taxes
                  ? `
                <hr>
                <h3>관련 세금 정보</h3>
                <p><strong>충전소:</strong> ${notification.taxes.charging_stations.station_name}</p>
                <p><strong>세금 유형:</strong> ${taxTypeLabels[notification.taxes.tax_type as keyof typeof taxTypeLabels]}</p>
                <p><strong>세금 금액:</strong> ${notification.taxes.tax_amount.toLocaleString()}원</p>
                <p><strong>납부 기한:</strong> ${new Date(notification.taxes.due_date).toLocaleDateString("ko-KR")}</p>
              `
                  : ""
              }
              <hr>
              <p><small>이 메시지는 TMS 시스템에서 자동으로 발송되었습니다.</small></p>
            `,
            text: notification.message,
          }),
        })

        if (!emailResponse.ok) {
          console.error("Email send failed:", await emailResponse.text())
        }
      }

      // Send Teams notification (existing code)
      if (notification.teams_channel_id) {
        const channel = teamsChannels.find((c) => c.id === notification.teams_channel_id)
        if (channel) {
          const response = await fetch(channel.webhook_url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              text: notification.message,
              title: "TMS 세금 알림",
            }),
          })

          if (!response.ok) {
            throw new Error("Teams 알림 발송 실패")
          }
        }
      }

      const { data, error } = await supabase
        .from("notifications")
        .update({
          is_sent: true,
          sent_at: new Date().toISOString(),
        })
        .eq("id", notificationId)
        .select(`
          *,
          taxes (
            id,
            tax_type,
            tax_amount,
            due_date,
            charging_stations (
              station_name,
              location
            )
          ),
          teams_channels (
            id,
            channel_name
          )
        `)
        .single()

      if (error) throw error

      await supabase.from("notification_logs").insert([
        {
          notification_id: notificationId,
          send_status: "success",
          sent_at: new Date().toISOString(),
        },
      ])

      setNotifications(notifications.map((n) => (n.id === notificationId ? data : n)))

      toast({
        title: "성공",
        description: "알림이 성공적으로 발송되었습니다.",
      })
    } catch (error) {
      await supabase.from("notification_logs").insert([
        {
          notification_id: notificationId,
          send_status: "failed",
          error_message: error instanceof Error ? error.message : "Unknown error",
          sent_at: new Date().toISOString(),
        },
      ])

      toast({
        title: "오류",
        description: "알림 발송 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }

    setIsActionLoading(false)
  }

  const handleDeleteNotification = async (notificationId: string) => {
    if (!isAdmin) return

    setIsActionLoading(true)

    const { error } = await supabase.from("notifications").delete().eq("id", notificationId)

    if (error) {
      toast({
        title: "오류",
        description: "알림 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } else {
      setNotifications(notifications.filter((n) => n.id !== notificationId))
      // audit log: delete notification
      logAudit({
        menu: "notifications",
        action: "delete",
        actorId: userId,
        actorName: actorName || "사용자",
        description: `알림 삭제: ID ${notificationId}`,
        targetTable: "notifications",
        targetId: notificationId,
      })
      toast({
        title: "성공",
        description: "알림이 성공적으로 삭제되었습니다.",
      })
    }

    setIsActionLoading(false)
  }

  const handleSendTestEmail = async () => {
    if (!isAdmin) return

    if (emailRecipients.length === 0) {
      toast({
        title: "오류",
        description: "등록된 이메일 수신자가 없습니다.",
        variant: "destructive",
      })
      return
    }

    setIsActionLoading(true)

    try {
      const emailAddresses = emailRecipients.map((r) => r.email)
      const response = await fetch("/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: emailAddresses,
          subject: "TMS 테스트 이메일",
          html: `
            <h2>TMS 테스트 이메일</h2>
            <p>이것은 TMS 시스템에서 발송하는 테스트 이메일입니다.</p>
            <p>이메일 알림 시스템이 정상적으로 작동하고 있습니다.</p>
            <hr>
            <p><strong>발송 시간:</strong> ${new Date().toLocaleString("ko-KR")}</p>
            <p><strong>수신자:</strong> ${emailAddresses.join(", ")}</p>
            <hr>
            <p><small>이 메시지는 TMS 시스템에서 자동으로 발송되었습니다.</small></p>
          `,
          text: "TMS 테스트 이메일 - 이메일 알림 시스템이 정상적으로 작동하고 있습니다.",
        }),
      })

      if (!response.ok) {
        throw new Error("테스트 이메일 발송 실패")
      }

      toast({
        title: "성공",
        description: `테스트 이메일이 ${emailAddresses.length}명에게 성공적으로 발송되었습니다.`,
      })
    } catch (error) {
      toast({
        title: "오류",
        description: "테스트 이메일 발송 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    }

    setIsActionLoading(false)
  }

  const generateTaxReminders = async () => {
    if (!isAdmin) {
      toast({
        title: "권한 없음",
        description: "관리자만 자동 리마인더를 생성할 수 있습니다.",
        variant: "destructive",
      })
      return
    }

    setIsActionLoading(true)

    try {
      const res = await fetch("/api/generate-tax-reminders", { method: "POST" })
      const json = await res.json()
      if (!res.ok || !json?.success) {
        console.error("Error generating reminders:", json?.error || res.statusText)
        toast({
          title: "오류",
          description: "자동 리마인더 생성 중 오류가 발생했습니다.",
          variant: "destructive",
        })
      } else {
        await fetchData()
        toast({
          title: "성공",
          description: `세금 리마인더 생성 완료 (신규 ${json.created}건, 건너뜀 ${json.skipped}건)`,
        })
      }
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "오류",
        description: "예상치 못한 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  const updateOverdueStatus = async () => {
    if (!isAdmin) {
      toast({
        title: "권한 없음",
        description: "관리자만 연체 상태를 업데이트할 수 있습니다.",
        variant: "destructive",
      })
      return
    }

    setIsActionLoading(true)

    try {
      const { error } = await supabase.rpc("update_overdue_tax_status")

      if (error) {
        console.error("Error updating overdue status:", error)
        toast({
          title: "오류",
          description: "연체 상태 업데이트 중 오류가 발생했습니다.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "성공",
          description: "연체된 세금 상태가 업데이트되었습니다.",
        })
      }
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "오류",
        description: "예상치 못한 오류가 발생했습니다.",
        variant: "destructive",
      })
    } finally {
      setIsActionLoading(false)
    }
  }

  const fetchData = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

      if (profile) {
        setUserRole(profile.role)
        setUserId(user.id)
      }

      const { data: notificationsData } = await supabase
        .from("notifications")
        .select(`
          *,
          taxes (
            id,
            tax_type,
            tax_amount,
            due_date,
            charging_stations (
              station_name,
              location
            )
          ),
          teams_channels (
            id,
            channel_name
          ),
          notification_schedules (
            schedule_name,
            days_before
          )
        `)
        .order("created_at", { ascending: false })

      if (notificationsData) {
        setNotifications(notificationsData)
      }

      const { data: channelsData } = await supabase
        .from("teams_channels")
        .select("*")
        .eq("is_active", true)
        .order("channel_name")

      if (channelsData) {
        setTeamsChannels(channelsData)
      }

      const { data: schedulesData } = await supabase
        .from("notification_schedules")
        .select("*")
        .eq("is_active", true)
        .order("schedule_name")

      if (schedulesData) {
        setSchedules(schedulesData)
      }

      const { data: taxesData } = await supabase
        .from("taxes")
        .select(`
          *,
          charging_stations (
            station_name,
            location
          )
        `)
        .order("due_date")

      if (taxesData) {
        setTaxes(taxesData)
      }

      const { data: emailData } = await supabase
        .from("email_recipients")
        .select("*")
        .eq("is_active", true)
        .order("email")

      if (emailData) {
        setEmailRecipients(emailData)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchEmailRecipients = async () => {
    const { data: emailData } = await supabase.from("email_recipients").select("*").eq("is_active", true).order("email")

    if (emailData) {
      setEmailRecipients(emailData)
    }
  }

  const NotificationForm = ({ onSubmit }: { onSubmit: (formData: FormData) => void }) => (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tax_id">관련 세금 (선택사항)</Label>
        <Select name="tax_id">
          <SelectTrigger>
            <SelectValue placeholder="세금을 선택하세요 (선택사항)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">선택 안함</SelectItem>
            {taxes.map((tax) => (
              <SelectItem key={tax.id} value={tax.id}>
                {tax.charging_stations.station_name} - {taxTypeLabels[tax.tax_type as keyof typeof taxTypeLabels]} (
                {new Date(tax.due_date).toLocaleDateString("ko-KR")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="notification_date">알림 날짜 *</Label>
          <Input id="notification_date" name="notification_date" type="date" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notification_time">알림 시간 *</Label>
          <Input id="notification_time" name="notification_time" type="time" defaultValue="09:00" required />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="teams_channel_id">Teams 채널 (선택사항)</Label>
        <Select name="teams_channel_id">
          <SelectTrigger>
            <SelectValue placeholder="Teams 채널을 선택하세요 (선택사항)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">선택 안함</SelectItem>
            {teamsChannels.map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                {channel.channel_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">알림 메시지 *</Label>
        <Textarea id="message" name="message" placeholder="알림 메시지를 입력하세요" rows={4} required />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => setIsCreateNotificationOpen(false)}>
          취소
        </Button>
        <Button type="submit" disabled={isActionLoading}>
          {isActionLoading ? "생성 중..." : "생성"}
        </Button>
      </div>
    </form>
  )

  const TeamsChannelForm = ({ onSubmit }: { onSubmit: (formData: FormData) => void }) => (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="channel_name">채널 이름 *</Label>
        <Input id="channel_name" name="channel_name" placeholder="예: 세금알림채널" required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="webhook_url">Webhook URL *</Label>
        <Input
          id="webhook_url"
          name="webhook_url"
          type="url"
          placeholder="https://outlook.office.com/webhook/..."
          required
        />
        <p className="text-xs text-muted-foreground">Teams 채널에서 Incoming Webhook을 설정하고 URL을 입력하세요</p>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={() => setIsCreateChannelOpen(false)}>
          취소
        </Button>
        <Button type="submit" disabled={isActionLoading}>
          {isActionLoading ? "등록 중..." : "등록"}
        </Button>
      </div>
    </form>
  )

  // Teams 채널 등록 다이얼로그
  
  const EmailRecipientForm = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="recipient-name">이름</Label>
        <Input
          id="recipient-name"
          value={newEmailRecipient.name}
          onChange={(e) => setNewEmailRecipient((prev) => ({ ...prev, name: e.target.value }))}
          placeholder="수신자 이름을 입력하세요"
        />
      </div>
      <div>
        <Label htmlFor="recipient-email">이메일</Label>
        <Input
          id="recipient-email"
          type="email"
          value={newEmailRecipient.email}
          onChange={(e) => setNewEmailRecipient((prev) => ({ ...prev, email: e.target.value }))}
          placeholder="이메일 주소를 입력하세요"
          required
        />
      </div>
    </div>
  )

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="font-bold tracking-tight text-2xl">알림 관리</h2>
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">알림 관리</h1>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Button
                onClick={generateTaxReminders}
                disabled={isActionLoading}
                variant="outline"
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
              >
                <Clock className="h-4 w-4 mr-2" />
                자동 리마인더 생성
              </Button>
              <Button
                onClick={updateOverdueStatus}
                disabled={isActionLoading}
                variant="outline"
                className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                연체 상태 업데이트
              </Button>
            </>
          )}
          <Button onClick={() => setIsCreateNotificationOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />새 알림 생성
          </Button>
        </div>
      </div>

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notifications">알림 목록</TabsTrigger>
          <TabsTrigger value="channels">Teams 채널</TabsTrigger>
          <TabsTrigger value="emails">이메일 수신자</TabsTrigger>
          <TabsTrigger value="schedules">알림 스케줄</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="알림 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="정렬" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date-desc">최신순</SelectItem>
                  <SelectItem value="date-asc">오래된순</SelectItem>
                  <SelectItem value="priority">중요도순</SelectItem>
                  <SelectItem value="status">상태순</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="hidden">
              <TabsTrigger value="all">모든 알림 ({filteredAndSortedNotifications.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              {Object.keys(groupedNotifications).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {searchTerm ? "검색 결과가 없습니다." : "알림이 없습니다."}
                </div>
              ) : (
                Object.entries(groupedNotifications).map(([date, dateNotifications]) => (
                  <div key={date} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-medium text-muted-foreground">{date}</h3>
                      <div className="flex-1 h-px bg-border"></div>
                      <span className="text-xs text-muted-foreground">{dateNotifications.length}개</span>
                    </div>
                    <div className="grid gap-3">
                      {dateNotifications.map((notification) => (
                        <NotificationCard key={notification.id} notification={notification} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          {isAdmin && (
            <div className="flex items-center justify-between">
              <Button onClick={() => setIsCreateChannelOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Teams 채널 등록
              </Button>
              {teamsChannels.length > 0 && (
                <Button
                  onClick={async () => {
                    try {
                      setIsActionLoading(true)
                      const res = await fetch("/api/send-teams", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ channelIds: teamsChannels.map((c) => c.id), text: "TMS 테스트 메시지" }),
                      })
                      const json = await res.json()
                      if (!res.ok || !json.success) throw new Error(json.error || "failed")
                      toast({ title: "성공", description: `테스트 메시지 발송: ${json.sent}건, 실패: ${json.failed}` })
                    } catch (e) {
                      toast({ title: "오류", description: "테스트 메시지 발송 실패", variant: "destructive" })
                    } finally {
                      setIsActionLoading(false)
                    }
                  }}
                  disabled={isActionLoading}
                  variant="outline"
                  className="gap-2 bg-transparent"
                >
                  {isActionLoading ? "발송 중..." : "테스트 메시지 발송"}
                </Button>
              )}
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {teamsChannels.map((channel) => (
              <Card key={channel.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between gap-2">
                    <span>{channel.channel_name}</span>
                    {isAdmin && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteTeamsChannel(channel.id)}
                        disabled={isActionLoading}
                      >
                        삭제
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">상태: </span>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        활성화
                      </Badge>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Webhook URL: </span>
                      <span className="font-medium">{channel.webhook_url.substring(0, 50)}...</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {teamsChannels.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <h3 className="text-lg font-semibold mb-2">등록된 Teams 채널이 없습니다</h3>
                <p className="text-muted-foreground text-center">
                  {isAdmin ? "Teams 채널을 등록해보세요" : "관리자가 Teams 채널을 설정할 때까지 기다려주세요"}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Teams 채널 등록</DialogTitle>
              <DialogDescription>Incoming Webhook URL을 포함해 채널 정보를 입력하세요.</DialogDescription>
            </DialogHeader>
            <TeamsChannelForm onSubmit={handleCreateTeamsChannel} />
          </DialogContent>
        </Dialog>

        <TabsContent value="emails" className="space-y-4">
          {isAdmin && (
            <div className="flex justify-between items-center">
              <Button onClick={() => setIsCreateEmailRecipientOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                이메일 수신자 생성
              </Button>
              {emailRecipients.length > 0 && (
                <Button
                  onClick={handleSendTestEmail}
                  disabled={isActionLoading}
                  variant="outline"
                  className="gap-2 bg-transparent"
                >
                  {isActionLoading ? "발송 중..." : "테스트 이메일 발송"}
                </Button>
              )}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {emailRecipients.map((recipient) => (
              <Card key={recipient.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between gap-2">
                    <span>{recipient.name || recipient.email}</span>
                    {isAdmin && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeleteEmailRecipient(recipient.id)}
                        disabled={isActionLoading}
                      >
                        삭제
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">이메일: </span>
                      <span className="font-medium">{recipient.email}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">상태: </span>
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
                        활성화
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {emailRecipients.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <h3 className="text-lg font-semibold mb-2">등록된 이메일 수신자가 없습니다</h3>
                <p className="text-muted-foreground text-center">
                  {isAdmin ? "이메일 수신자를 등록해보세요" : "관리자가 이메일 수신자를 설정할 때까지 기다려주세요"}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          {isAdmin && (
            <div className="flex items-center justify-between">
              <Button
                className="gap-2"
                onClick={async () => {
                  const name = prompt("스케줄 이름", "세금 마감 리마인더")
                  if (!name) return
                  const daysStr = prompt("며칠 전 알림(정수)", "3") || "3"
                  const days = Number(daysStr)
                  const time = prompt("알림 시간(HH:MM)", "09:00") || "09:00"
                  setIsActionLoading(true)
                  try {
                    const { data, error } = await supabase
                      .from("notification_schedules")
                      .insert([{ schedule_name: name, days_before: days, notification_time: time, is_active: true }])
                      .select()
                    if (error) throw error
                    if (data) setSchedules([...(schedules as any), ...(data as any)])
                    toast({ title: "등록 완료", description: "스케줄이 등록되었습니다." })
                  } catch (e) {
                    toast({ title: "오류", description: "스케줄 등록 실패", variant: "destructive" })
                  } finally {
                    setIsActionLoading(false)
                  }
                }}
                disabled={isActionLoading}
              >
                {isActionLoading ? "등록 중..." : "스케줄 등록"}
              </Button>

              <Button
                variant="outline"
                className="gap-2 bg-transparent"
                onClick={async () => {
                  try {
                    setIsActionLoading(true)
                    const res = await fetch("/api/dispatch-notifications", { method: "POST" })
                    const json = await res.json()
                    if (!res.ok || !json.success) throw new Error(json.error || "failed")
                    toast({ title: "성공", description: `스케줄 기반 알림 발송 처리: ${json.dispatched}건` })
                  } catch (e) {
                    toast({ title: "오류", description: "스케줄 발송 처리 실패", variant: "destructive" })
                  } finally {
                    setIsActionLoading(false)
                  }
                }}
                disabled={isActionLoading}
              >
                {isActionLoading ? "처리 중..." : "스케줄 즉시 실행"}
              </Button>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {schedules.map((schedule) => (
              <Card key={schedule.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between gap-2">
                    <span>{schedule.schedule_name}</span>
                    {isAdmin && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const name = prompt("스케줄 이름", schedule.schedule_name) || schedule.schedule_name
                            const days = Number(prompt("며칠 전 알림(정수)", String(schedule.days_before)) || schedule.days_before)
                            const time = prompt("알림 시간(HH:MM)", schedule.notification_time) || schedule.notification_time
                            setIsActionLoading(true)
                            try {
                              const { error } = await supabase
                                .from("notification_schedules")
                                .update({ schedule_name: name, days_before: days, notification_time: time })
                                .eq("id", schedule.id)
                              if (error) throw error
                              // refresh
                              const { data } = await supabase
                                .from("notification_schedules")
                                .select("*")
                                .eq("is_active", true)
                                .order("schedule_name")
                              if (data) setSchedules(data as any)
                              toast({ title: "수정 완료", description: "스케줄이 수정되었습니다." })
                            } catch (e) {
                              toast({ title: "오류", description: "스케줄 수정 실패", variant: "destructive" })
                            } finally {
                              setIsActionLoading(false)
                            }
                          }}
                        >
                          수정
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            if (!confirm("해당 스케줄을 삭제하시겠습니까?")) return
                            setIsActionLoading(true)
                            try {
                              const { error } = await supabase
                                .from("notification_schedules")
                                .update({ is_active: false })
                                .eq("id", schedule.id)
                              if (error) throw error
                              setSchedules(schedules.filter((s) => s.id !== schedule.id))
                              toast({ title: "삭제 완료", description: "스케줄이 삭제되었습니다." })
                            } catch (e) {
                              toast({ title: "오류", description: "스케줄 삭제 실패", variant: "destructive" })
                            } finally {
                              setIsActionLoading(false)
                            }
                          }}
                        >
                          삭제
                        </Button>
                      </div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="text-muted-foreground">알림 시점: </span>
                      <span className="font-medium">{schedule.days_before}일 전</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">알림 시간: </span>
                      <span className="font-medium">{schedule.notification_time}</span>
                    </div>
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">활성화</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <div className="text-sm text-muted-foreground">
        총 {notifications.length}개의 알림 ({notifications.filter((n) => !n.is_sent).length}개 발송 대기,{" "}
        {notifications.filter((n) => n.is_sent).length}개 발송 완료)
        {searchTerm && <span className="ml-2">• 검색 결과: {filteredAndSortedNotifications.length}개</span>}
      </div>

      <Dialog open={isCreateNotificationOpen} onOpenChange={setIsCreateNotificationOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>새 알림 생성</DialogTitle>
            <DialogDescription>수동으로 새 알림을 생성합니다. 필수 항목을 입력해주세요.</DialogDescription>
          </DialogHeader>
          <NotificationForm onSubmit={handleCreateNotification} />
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateEmailRecipientOpen} onOpenChange={setIsCreateEmailRecipientOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 이메일 수신자 추가</DialogTitle>
            <DialogDescription>새로운 이메일 수신자를 추가합니다.</DialogDescription>
          </DialogHeader>
          <form action={handleCreateEmailRecipient} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipient_name">이름 *</Label>
              <Input
                id="recipient_name"
                name="name"
                value={newEmailRecipient.name}
                onChange={(e) => setNewEmailRecipient({ ...newEmailRecipient, name: e.target.value })}
                placeholder="수신자 이름을 입력하세요"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipient_email">이메일 *</Label>
              <Input
                id="recipient_email"
                name="email"
                type="email"
                value={newEmailRecipient.email}
                onChange={(e) => setNewEmailRecipient({ ...newEmailRecipient, email: e.target.value })}
                placeholder="이메일 주소를 입력하세요"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateEmailRecipientOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={isActionLoading}>
                {isActionLoading ? "추가 중..." : "추가"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
