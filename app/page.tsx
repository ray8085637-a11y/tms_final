"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Simply redirect to login page on client side
    router.push("/auth/login")
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">TMS</h1>
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    </div>
  )
}
