"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface TaxReminder {
  id: string
  tax_id: string
  tax_type: string
  amount: number
  due_date: string
  days_until_due: number
  reminder_type: string
}

export function TaxReminderSystem() {
  const { toast } = useToast()
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initializeSystem = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 1000))
        setIsInitialized(true)
      } catch (error) {
        console.error("[v0] TaxReminderSystem: Initialization error:", error)
      }
    }

    initializeSystem()
  }, [])

  useEffect(() => {
    if (!isInitialized) return

    const checkTaxReminders = async () => {
      try {
        const supabase = createClient()

        if (!supabase) {
          console.warn("[v0] TaxReminderSystem: Supabase client not available")
          return
        }

        const now = new Date()

        if (lastCheck && now.getTime() - lastCheck.getTime() < 5 * 60 * 1000) {
          return
        }

        console.log("[v0] TaxReminderSystem: Checking for tax reminders")

        const { data: taxes, error } = await supabase
          .from("taxes")
          .select(`
            id,
            tax_type,
            tax_amount,
            due_date,
            status,
            station_id
          `)
          .neq("status", "payment_completed")

        if (error) {
          console.error("[v0] TaxReminderSystem: Error fetching taxes:", error)
          return
        }

        const reminders: TaxReminder[] = []
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        taxes?.forEach((tax) => {
          const dueDate = new Date(tax.due_date)
          dueDate.setHours(0, 0, 0, 0)
          const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

          let reminderType = ""
          if (daysDiff < 0) {
            reminderType = "overdue"
          } else if (daysDiff === 0) {
            reminderType = "due_today"
          } else if (daysDiff <= 7) {
            reminderType = "7_days"
          } else if (daysDiff <= 14) {
            reminderType = "14_days"
          } else if (daysDiff <= 30) {
            reminderType = "30_days"
          }

          if (reminderType) {
            reminders.push({
              id: tax.id,
              tax_id: tax.id,
              tax_type: tax.tax_type,
              amount: tax.tax_amount,
              due_date: tax.due_date,
              days_until_due: daysDiff,
              reminder_type: reminderType,
            })
          }
        })

        reminders.forEach((reminder) => {
          const taxTypeLabels: Record<string, string> = {
            acquisition: "취득세",
            property: "재산세",
            income: "소득세",
            corporate: "법인세",
            vat: "부가가치세",
            local: "지방세",
          }

          const taxTypeName = taxTypeLabels[reminder.tax_type] || reminder.tax_type
          const amount = new Intl.NumberFormat("ko-KR").format(reminder.amount)

          let title = ""
          let description = ""
          let variant: "default" | "destructive" = "default"

          switch (reminder.reminder_type) {
            case "overdue":
              title = "⚠️ 연체된 세금"
              description = `${taxTypeName} ${amount}원이 ${Math.abs(reminder.days_until_due)}일 연체되었습니다`
              variant = "destructive"
              break
            case "due_today":
              title = "🚨 오늘 납부 기한"
              description = `${taxTypeName} ${amount}원의 납부 기한이 오늘입니다`
              variant = "destructive"
              break
            case "7_days":
              title = "📅 7일 후 납부 기한"
              description = `${taxTypeName} ${amount}원의 납부 기한이 ${reminder.days_until_due}일 남았습니다`
              break
            case "14_days":
              title = "📋 14일 후 납부 기한"
              description = `${taxTypeName} ${amount}원의 납부 기한이 ${reminder.days_until_due}일 남았습니다`
              break
            case "30_days":
              title = "📝 30일 후 납부 기한"
              description = `${taxTypeName} ${amount}원의 납부 기한이 ${reminder.days_until_due}일 남았습니다`
              break
          }

          if (title && description) {
            toast({
              title,
              description,
              variant,
              duration: reminder.reminder_type === "overdue" || reminder.reminder_type === "due_today" ? 10000 : 5000,
            })
          }
        })

        setLastCheck(now)
        console.log(`[v0] TaxReminderSystem: Found ${reminders.length} reminders`)
      } catch (error) {
        console.error("[v0] TaxReminderSystem: Error checking reminders:", error)
      }
    }

    checkTaxReminders()

    const interval = setInterval(checkTaxReminders, 30 * 60 * 1000)

    return () => clearInterval(interval)
  }, [toast, lastCheck, isInitialized])

  return null
}
