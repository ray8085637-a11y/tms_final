import type React from "react"
export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  // Authentication is now handled by GlobalLayout component
  return <>{children}</>
}
