import { createClient } from "@/lib/supabase/client"

export type AuditAction = "create" | "update" | "delete"

type LogParams = {
  menu: string
  action: AuditAction
  actorId: string
  actorName: string
  description: string
  targetTable?: string
  targetId?: string
  changes?: unknown
}

export async function logAudit(params: LogParams): Promise<void> {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("audit_logs").insert([
      {
        menu: params.menu,
        action: params.action,
        actor_id: params.actorId,
        actor_name: params.actorName || "사용자",
        description: params.description,
        target_table: params.targetTable || null,
        target_id: params.targetId || null,
        changes: params.changes ? JSON.stringify(params.changes) : null,
      },
    ])

    if (error) {
      // Do not block UX on audit failures
      console.error("[audit] insert error:", error.message)
    }
  } catch (e) {
    console.error("[audit] unexpected error:", e)
  }
}

