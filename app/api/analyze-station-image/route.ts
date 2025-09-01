import { type NextRequest, NextResponse } from "next/server"
import { xai } from "@ai-sdk/xai"
import { generateObject } from "ai"
import { z } from "zod"

const StationSchema = z.object({
  station_name: z.string().describe("충전소 이름 또는 브랜드명"),
  location: z.string().describe("충전소 위치 (도시, 구역, 지역명)"),
  address: z.string().optional().describe("상세 주소 정보"),
  status: z
    .enum(["operating", "maintenance", "planned"])
    .describe("충전소 운영 상태 - operating: 운영중, maintenance: 점검중, planned: 운영예정"),
})

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const image = formData.get("image") as File

    if (!image) {
      return NextResponse.json({ success: false, error: "이미지가 제공되지 않았습니다." }, { status: 400 })
    }

    // Convert image to base64
    const bytes = await image.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    const mimeType = image.type

    const { object } = await generateObject({
      model: xai("grok-2-vision-1212"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `이 이미지는 전기차 충전소 관련 사진입니다. 다음 정보를 추출해주세요:

1. 충전소명 (브랜드명, 회사명 등)
2. 위치 (도시, 구역, 지역명)
3. 상세 주소 (있다면)
4. 운영 상태 (운영중, 점검중, 운영예정 중 하나)

이미지에서 텍스트나 표지판을 읽어서 정확한 정보를 추출해주세요. 한국어로 응답해주세요.`,
            },
            {
              type: "image",
              image: `data:${mimeType};base64,${base64}`,
            },
          ],
        },
      ],
      schema: StationSchema,
      temperature: 0.1,
    })

    return NextResponse.json({
      success: true,
      data: object,
    })
  } catch (error) {
    console.error("Station image analysis error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "이미지 분석 중 오류가 발생했습니다.",
      },
      { status: 500 },
    )
  }
}
