import { CalendarClient } from "./calendar-client"

export default function CalendarPage() {
  return (
    <div className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="font-bold tracking-tight text-2xl">캘린더</h2>
        </div>

        <CalendarClient />
      </div>
    </div>
  )
}
