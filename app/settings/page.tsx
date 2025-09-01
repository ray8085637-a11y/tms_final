"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"

interface User {
  id: string
  email?: string
  name?: string
  role?: string
}

export default function SettingsPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (authUser) {
        let { data: profile } = await supabase.from("users").select("*").eq("id", authUser.id).single()

        // If profile doesn't exist, create it
        if (!profile) {
          console.log("[v0] Creating user profile for:", authUser.email)
          const { data: newProfile, error } = await supabase
            .from("users")
            .insert({
              id: authUser.id,
              email: authUser.email,
              name: authUser.user_metadata?.name || authUser.email?.split("@")[0] || "사용자",
              role: "viewer",
            })
            .select()
            .single()

          if (error) {
            console.error("[v0] Error creating user profile:", error)
          } else {
            profile = newProfile
            console.log("[v0] User profile created:", profile)
          }
        }

        setUser({
          id: authUser.id,
          email: authUser.email,
          name: profile?.name,
          role: profile?.role || "viewer",
        })
      }
      setLoading(false)
    }

    getUser()
  }, [supabase])

  const handleRoleChange = async () => {
    if (!user) return

    setUpdating(true)
    try {
      const newRole = user.role === "viewer" ? "admin" : "viewer"

      const { error } = await supabase.from("users").upsert({
        id: user.id,
        email: user.email,
        name: user.name || "사용자",
        role: newRole,
      })

      if (error) {
        console.error("[v0] Role update error:", error)
        alert("권한 변경 중 오류가 발생했습니다.")
      } else {
        console.log("[v0] Role changed successfully to:", newRole)
        setUser({ ...user, role: newRole })
        alert(`권한이 ${newRole === "admin" ? "관리자" : "뷰어"}로 변경되었습니다.`)
        // Refresh the page to update navigation and permissions
        router.refresh()
      }
    } catch (error) {
      console.error("[v0] Role change error:", error)
      alert("권한 변경 중 오류가 발생했습니다.")
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">설정</h2>
          </div>
          <div className="bg-card p-8 rounded-lg border text-center">
            <p className="text-muted-foreground">로딩 중...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="font-bold tracking-tight text-2xl">설정</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>사용자 프로필</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{user?.name || "사용자"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <Badge variant={user?.role === "admin" ? "default" : "secondary"}>
                {user?.role === "admin" ? "관리자" : "뷰어"}
              </Badge>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">권한 변경</p>
                  <p className="text-sm text-muted-foreground">
                    현재 권한: {user?.role === "admin" ? "관리자" : "뷰어"}
                  </p>
                </div>
                <Button onClick={handleRoleChange} disabled={updating} variant="outline">
                  {updating ? "변경 중..." : user?.role === "admin" ? "뷰어로 변경" : "관리자로 변경"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>시스템 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm">
                <span className="font-medium">버전:</span> 1.0.0
              </p>
              <p className="text-sm">
                <span className="font-medium">도메인 제한:</span> watercharging.com
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
