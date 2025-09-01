import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "메뉴얼 - TMS",
  description: "TMS 시스템 사용 메뉴얼",
}

export default function ManualPage() {
  const manualSections = [
    {
      title: "대시보드",
      description: "시스템 전체 현황 확인",
      content: [
        "시스템 전체 현황을 한눈에 확인할 수 있습니다",
        "충전소 현황, 세금 현황, 알림 상태 등의 통계를 제공합니다",
        "각 카드를 클릭하여 상세 페이지로 이동할 수 있습니다",
      ],
    },
    {
      title: "충전소 관리",
      description: "충전소 등록 및 관리",
      content: [
        "충전소 등록: 우상단 '충전소 등록' 버튼을 클릭하여 새 충전소를 등록합니다",
        "충전소 수정: 각 충전소 카드의 '수정' 버튼을 클릭하여 정보를 수정합니다",
        "충전소 삭제: 각 충전소 카드의 '삭제' 버튼을 클릭하여 삭제합니다",
        "운영중인 충전소와 점검중/운영예정 충전소가 구분되어 표시됩니다",
      ],
    },
    {
      title: "세금 관리",
      description: "AI 기반 세금 정보 관리",
      content: [
        "세금 등록: 우상단 '세금 등록' 버튼을 클릭하여 새 세금을 등록합니다",
        "AI 이미지 인식: 세금 고지서 이미지를 업로드하면 자동으로 정보를 추출합니다",
        "세금 수정/삭제: 각 세금 항목의 메뉴(⋮)를 클릭하여 수정하거나 삭제합니다",
        "진행중인 세금과 납부 완료된 세금이 구분되어 표시됩니다",
      ],
    },
    {
      title: "알림 관리",
      description: "Teams 연동 알림 시스템",
      content: [
        "알림 생성: 우상단 '알림 생성' 버튼을 클릭하여 새 알림을 생성합니다",
        "Teams 연동: Teams 채널을 등록하면 알림이 자동으로 전송됩니다",
        "알림 발송: 생성된 알림을 선택하여 즉시 발송할 수 있습니다",
        "알림 삭제: 각 알림의 메뉴(⋮)를 클릭하여 삭제할 수 있습니다",
      ],
    },
    {
      title: "통계",
      description: "세금 현황 분석 및 차트",
      content: [
        "세금 현황과 통계를 차트로 확인할 수 있습니다",
        "월별, 분기별 세금 납부 현황을 분석합니다",
        "충전소별 세금 현황을 비교할 수 있습니다",
      ],
    },
    {
      title: "캘린더",
      description: "세금 납부 일정 관리",
      content: [
        "세금 납부 일정을 캘린더 형태로 확인할 수 있습니다",
        "한국 법정 공휴일과 주말이 빨간색으로 표시됩니다",
        "월별/주별 보기를 전환할 수 있습니다",
        "이전달/다음달 버튼으로 날짜를 이동할 수 있습니다",
      ],
    },
    {
      title: "설정",
      description: "사용자 권한 및 시스템 설정",
      content: [
        "사용자 권한을 확인하고 변경할 수 있습니다",
        "뷰어에서 관리자로 권한을 변경할 수 있습니다",
        "시스템 설정을 관리할 수 있습니다",
      ],
    },
    {
      title: "사용자 권한",
      description: "권한별 기능 안내",
      content: [
        "뷰어: 데이터 조회만 가능합니다",
        "관리자: 모든 데이터의 생성, 수정, 삭제가 가능합니다",
        "권한 변경은 설정 페이지에서 가능합니다",
      ],
    },
  ]

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-8">
        <div>
          <h1 className="font-bold mb-2 text-2xl">TMS 시스템 메뉴얼</h1>
          <p className="text-muted-foreground">{""}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {manualSections.map((section, index) => (
            <Card key={index} className="h-full">
              <CardHeader>
                <CardTitle className="text-xl">
                  {index + 1}. {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {section.content.map((item, itemIndex) => (
                    <li key={itemIndex} className="text-sm leading-relaxed flex items-start">
                      <span className="text-primary mr-2 mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">문의사항</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              시스템 사용 중 문의사항이 있으시면 관리자에게 연락해 주세요.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
