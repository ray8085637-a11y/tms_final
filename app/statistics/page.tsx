import { StatisticsClient } from "./statistics-client"

export default function StatisticsPage() {
  return (
    <div className="p-6">
      <div className="space-y-6">
        <div>
          <h2 className="font-bold tracking-tight text-2xl">통계</h2>
        </div>

        <StatisticsClient />
      </div>
    </div>
  )
}
