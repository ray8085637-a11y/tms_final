"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { TaxReminderSystem } from "@/components/tax-reminder-system"
import { Toaster } from "@/components/ui/toaster"

interface GlobalLayoutProps {
  children: React.ReactNode
}

interface AppUser {
  id: string
  email?: string
  name?: string
  role?: string
}

const textNavigation = [
  { name: "대시보드", href: "/dashboard" },
  { name: "충전소", href: "/stations" },
  { name: "세금", href: "/taxes" },
  { name: "알림", href: "/notifications" },
  { name: "통계", href: "/statistics" },
  { name: "캘린더", href: "/calendar" },
  { name: "설정", href: "/settings" },
  { name: "메뉴얼", href: "/manual" },
]

export function GlobalLayout({ children }: GlobalLayoutProps) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  const isAuthPage = pathname.startsWith("/auth") || pathname === "/"

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log("[v0] GlobalLayout: Initializing Supabase client")
        const supabase = createClient()

        if (!supabase) {
          throw new Error("Failed to create Supabase client")
        }

        setInitError(null)

        console.log("[v0] GlobalLayout: Getting user authentication status")

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession()

        if (sessionError) {
          console.error("[v0] GlobalLayout: Session error:", sessionError.message)
          if (!sessionError.message.includes("session_not_found")) {
            throw sessionError
          }
        }

        if (session?.user) {
          const userData = {
            id: session.user.id,
            email: session.user.email,
            name: session.user.user_metadata?.name || session.user.email?.split("@")[0],
            role: session.user.user_metadata?.role || "user",
          }
          console.log("[v0] GlobalLayout: Setting user data from session:", userData)
          setUser(userData)
        } else {
          console.log("[v0] GlobalLayout: No active session found")
          setUser(null)
        }

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
          try {
            console.log("[v0] GlobalLayout: Auth state change event:", event)
            if (session?.user) {
              const userData = {
                id: session.user.id,
                email: session.user.email,
                name: session.user.user_metadata?.name || session.user.email?.split("@")[0],
                role: session.user.user_metadata?.role || "user",
              }
              console.log("[v0] GlobalLayout: Auth state change - setting user:", userData)
              setUser(userData)
            } else {
              console.log("[v0] GlobalLayout: Auth state change - clearing user")
              setUser(null)
            }
          } catch (error) {
            console.error("[v0] GlobalLayout: Error in auth state change:", error)
          }
        })

        return () => {
          subscription?.unsubscribe()
        }
      } catch (error) {
        console.error("[v0] GlobalLayout: Failed to initialize authentication:", error)
        const errorMessage = error instanceof Error ? error.message : "Failed to initialize authentication"
        setInitError(errorMessage)
        setUser(null)
      } finally {
        console.log("[v0] GlobalLayout: Setting loading to false")
        setLoading(false)
      }
    }

    let cleanup: (() => void) | undefined

    initializeAuth().then((cleanupFn) => {
      cleanup = cleanupFn
    })

    return () => {
      cleanup?.()
    }
  }, [])

  console.log(
    "[v0] GlobalLayout: Current state - loading:",
    loading,
    "user:",
    user ? "present" : "null",
    "pathname:",
    pathname,
  )

  if (initError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-destructive">인증 시스템 오류</h1>
          <p className="text-muted-foreground mb-4">{initError}</p>
          <Button onClick={() => window.location.reload()}>다시 시도</Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-background border-b border-border sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link href="/" className="flex items-center space-x-3">
                <div className="text-3xl font-black text-primary">TMS</div>
                <div className="hidden sm:block text-sm font-medium text-muted-foreground">세금 일정 관리 시스템</div>
              </Link>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    )
  }

  if (!user || isAuthPage) {
    return (
      <div className="min-h-screen bg-background">
        <main>{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex">
      <TaxReminderSystem />

      <div className="w-64 bg-black border-r border-border flex flex-col">
        <div className="p-6 bg-neutral-900">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="text-3xl font-black italic text-slate-400">TMS</div>
            <div className="font-medium text-muted-foreground text-sm">세금 일정 관리 시스템</div>
          </Link>
        </div>

        <nav className="flex-1 px-4 space-y-1 bg-neutral-900">
          {textNavigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "block px-4 py-3 font-medium transition-colors text-base leading-8 tracking-normal h-auto rounded-xl",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-800 bg-neutral-900">
          <Button variant="ghost" size="sm" onClick={() => handleSignOut(router)} className="w-full justify-start">
            로그아웃
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">{children}</div>

      <Toaster />
    </div>
  )
}

const handleSignOut = async (router: any) => {
  try {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/")
  } catch (error) {
    console.error("Error signing out:", error)
  }
}
