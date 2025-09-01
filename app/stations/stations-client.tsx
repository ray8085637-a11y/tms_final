"use client"

import type React from "react"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"

interface Station {
  id: string
  station_name: string
  location: string
  address: string | null
  status: "operating" | "planned" | "terminated"
  created_at: string
  updated_at: string
}

const statusLabels = {
  operating: "운영중",
  planned: "운영예정",
  terminated: "운영종료",
}

const statusColors = {
  operating: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  planned: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  terminated: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
}

export function StationsClient() {
  const [stations, setStations] = useState<Station[]>([])
  const [userRole, setUserRole] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingStation, setEditingStation] = useState<Station | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(24)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        setUserId(user.id)

        const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()

        if (profile) {
          setUserRole(profile.role)
        }

        const { data: stationsData } = await supabase
          .from("charging_stations")
          .select("*")
          .order("created_at", { ascending: false })

        if (stationsData) {
          console.log("[v0] Stations: Total stations loaded:", stationsData.length)
          console.log(
            "[v0] Stations: Station statuses:",
            stationsData.map((s) => s.status),
          )

          const operatingCount = stationsData.filter((s) => s.status === "operating").length
          const plannedCount = stationsData.filter((s) => s.status === "planned").length
          const terminatedCount = stationsData.filter((s) => s.status === "terminated").length

          console.log(
            "[v0] Stations: Operating:",
            operatingCount,
            "Planned:",
            plannedCount,
            "Terminated:",
            terminatedCount,
          )
          console.log("[v0] Stations: Sample station data:", stationsData.slice(0, 3))

          setStations(stationsData)
        } else {
          console.log("[v0] Stations: No station data received")
        }
      } catch (error) {
        console.error("[v0] Stations: Error fetching data:", error)
      } finally {
        setIsInitialLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  const isAdmin = userRole === "admin"

  const filteredStations = useMemo(() => {
    if (!searchTerm) return stations

    return stations.filter(
      (station) =>
        station.station_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        station.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (station.address && station.address.toLowerCase().includes(searchTerm.toLowerCase())),
    )
  }, [stations, searchTerm])

  const operatingStations = useMemo(() => {
    return filteredStations.filter((station) => station.status === "operating")
  }, [filteredStations])

  const nonOperatingStations = useMemo(() => {
    return filteredStations.filter((station) => station.status !== "operating")
  }, [filteredStations])

  const paginatedOperatingStations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return operatingStations.slice(startIndex, endIndex)
  }, [operatingStations, currentPage, itemsPerPage])

  const paginatedNonOperatingStations = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return nonOperatingStations.slice(startIndex, endIndex)
  }, [nonOperatingStations, currentPage, itemsPerPage])

  const totalPages = useMemo(() => {
    const totalItems = Math.max(operatingStations.length, nonOperatingStations.length)
    return Math.ceil(totalItems / itemsPerPage)
  }, [operatingStations.length, nonOperatingStations.length, itemsPerPage])

  const handleCreateStation = async (formData: FormData) => {
    if (!isAdmin) {
      toast({
        title: "권한 없음",
        description: "관리자만 충전소를 등록할 수 있습니다.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    const stationData = {
      station_name: formData.get("station_name") as string,
      location: formData.get("location") as string,
      address: (formData.get("address") as string) || null,
      status: formData.get("status") as "operating" | "planned" | "terminated",
      created_by: userId,
    }

    const { data, error } = await supabase.from("charging_stations").insert([stationData]).select().single()

    if (error) {
      toast({
        title: "오류",
        description: "충전소 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } else {
      setStations([data, ...stations])
      setIsCreateDialogOpen(false)
      toast({
        title: "성공",
        description: "충전소가 성공적으로 등록되었습니다.",
      })
    }

    setIsLoading(false)
  }

  const handleUpdateStation = async (formData: FormData) => {
    if (!isAdmin || !editingStation) return

    setIsLoading(true)

    const stationData = {
      station_name: formData.get("station_name") as string,
      location: formData.get("location") as string,
      address: (formData.get("address") as string) || null,
      status: formData.get("status") as "operating" | "planned" | "terminated",
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from("charging_stations")
      .update(stationData)
      .eq("id", editingStation.id)
      .select()
      .single()

    if (error) {
      toast({
        title: "오류",
        description: "충전소 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } else {
      setStations(stations.map((s) => (s.id === editingStation.id ? data : s)))
      setEditingStation(null)
      toast({
        title: "성공",
        description: "충전소가 성공적으로 수정되었습니다.",
      })
    }

    setIsLoading(false)
  }

  const handleDeleteStation = async (stationId: string) => {
    if (!isAdmin) return

    setIsLoading(true)

    const { data: taxes, error: taxError } = await supabase
      .from("taxes")
      .select("id")
      .eq("station_id", stationId)
      .limit(1)

    if (taxError) {
      toast({
        title: "오류",
        description: "충전소 삭제 확인 중 오류가 발생했습니다.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    if (taxes && taxes.length > 0) {
      toast({
        title: "삭제 불가",
        description: "이 충전소에 등록된 세금이 있어 삭제할 수 없습니다. 먼저 관련 세금을 삭제해주세요.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }

    const { error } = await supabase.from("charging_stations").delete().eq("id", stationId)

    if (error) {
      toast({
        title: "오류",
        description: "충전소 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      })
    } else {
      setStations(stations.filter((s) => s.id !== stationId))
      toast({
        title: "성공",
        description: "충전소가 성공적으로 삭제되었습니다.",
      })
    }

    setIsLoading(false)
  }

  const StationForm = ({ station, onSubmit }: { station?: Station; onSubmit: (formData: FormData) => void }) => {
    const [formData, setFormData] = useState({
      station_name: station?.station_name || "",
      location: station?.location || "",
      address: station?.address || "",
      status: station?.status || "operating",
    })

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault()
      const form = new FormData()
      form.append("station_name", formData.station_name)
      form.append("location", formData.location)
      form.append("address", formData.address)
      form.append("status", formData.status)
      onSubmit(form)
    }

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="station_name">충전소명 *</Label>
          <Input
            id="station_name"
            name="station_name"
            value={formData.station_name}
            onChange={(e) => setFormData((prev) => ({ ...prev, station_name: e.target.value }))}
            placeholder="충전소 이름을 입력하세요"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">주소 *</Label>
          <Textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="주소를 입력하세요"
            rows={3}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">상태 *</Label>
          <Select
            name="status"
            value={formData.status}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, status: value as "operating" | "planned" | "terminated" }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="상태를 선택하세요" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operating">운영중</SelectItem>
              <SelectItem value="planned">운영예정</SelectItem>
              <SelectItem value="terminated">운영종료</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setIsCreateDialogOpen(false)
              setEditingStation(null)
            }}
          >
            취소
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "처리 중..." : station ? "수정" : "등록"}
          </Button>
        </div>
      </form>
    )
  }

  if (isInitialLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="h-8 w-32 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-10 w-24 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-10 w-64 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-bold tracking-tight text-2xl">충전소 관리</h2>
        </div>

        {isAdmin && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">충전소 등록</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>새 충전소 등록</DialogTitle>
                <DialogDescription>새로운 충전소 정보를 입력해주세요.</DialogDescription>
              </DialogHeader>
              <StationForm onSubmit={handleCreateStation} />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex items-center gap-2 max-w-md">
        <div className="relative flex-1">
          <Input
            placeholder="충전소명, 주소로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-4 border-zinc-600"
          />
        </div>
      </div>

      {filteredStations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h3 className="text-lg font-semibold mb-2">
              {searchTerm ? "검색 결과가 없습니다" : "등록된 충전소가 없습니다"}
            </h3>
            <p className="text-muted-foreground text-center">
              {searchTerm
                ? "다른 검색어로 시도해보세요"
                : isAdmin
                  ? "새 충전소를 등록해보세요"
                  : "관리자가 충전소를 등록할 때까지 기다려주세요"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {paginatedOperatingStations.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold">운영중인 충전소</h3>
                <Badge className={statusColors["operating"]}>{operatingStations.length}개</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {paginatedOperatingStations.map((station) => (
                  <Card key={station.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{station.station_name}</CardTitle>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            {station.address || station.location}
                          </div>
                        </div>
                        <Badge className={statusColors[station.status]}>{statusLabels[station.status]}</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {isAdmin && (
                        <div className="flex gap-2">
                          <Dialog
                            open={editingStation?.id === station.id}
                            onOpenChange={(open) => {
                              if (!open) setEditingStation(null)
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100 bg-transparent"
                                onClick={() => setEditingStation(station)}
                              >
                                수정
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                              <DialogHeader>
                                <DialogTitle>충전소 수정</DialogTitle>
                                <DialogDescription>충전소 정보를 수정해주세요.</DialogDescription>
                              </DialogHeader>
                              <StationForm station={editingStation || undefined} onSubmit={handleUpdateStation} />
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-destructive hover:bg-destructive hover:text-white bg-transparent"
                              >
                                삭제
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>충전소 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{station.station_name}" 충전소를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                  {"\n\n"}
                                  참고: 이 충전소에 등록된 세금이 있는 경우 삭제할 수 없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteStation(station.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {paginatedNonOperatingStations.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold opacity-75">운영예정/운영종료</h3>
                <Badge className={statusColors["planned"]}>{nonOperatingStations.length}개</Badge>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 opacity-75">
                {paginatedNonOperatingStations.map((station) => (
                  <Card key={station.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{station.station_name}</CardTitle>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            {station.address || station.location}
                          </div>
                        </div>
                        <Badge className={statusColors[station.status]}>{statusLabels[station.status]}</Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {isAdmin && (
                        <div className="flex gap-2">
                          <Dialog
                            open={editingStation?.id === station.id}
                            onOpenChange={(open) => {
                              if (!open) setEditingStation(null)
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100 bg-transparent"
                                onClick={() => setEditingStation(station)}
                              >
                                수정
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                              <DialogHeader>
                                <DialogTitle>충전소 수정</DialogTitle>
                                <DialogDescription>충전소 정보를 수정해주세요.</DialogDescription>
                              </DialogHeader>
                              <StationForm station={editingStation || undefined} onSubmit={handleUpdateStation} />
                            </DialogContent>
                          </Dialog>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 border-destructive hover:bg-destructive hover:text-white bg-transparent"
                              >
                                삭제
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>충전소 삭제</AlertDialogTitle>
                                <AlertDialogDescription>
                                  "{station.station_name}" 충전소를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                                  {"\n\n"}
                                  참고: 이 충전소에 등록된 세금이 있는 경우 삭제할 수 없습니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteStation(station.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  삭제
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                이전
              </Button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className="w-8 h-8 p-0"
                  >
                    {page}
                  </Button>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                다음
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        총 {stations.length}개의 충전소
        {searchTerm && ` (${filteredStations.length}개 검색됨)`}
        {totalPages > 1 && ` - ${currentPage}/${totalPages} 페이지`}
      </div>
    </div>
  )
}
