import { generateText } from "ai"
import { xai } from "@ai-sdk/xai"
import type { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] AI Analysis: Starting tax insights generation")

    const { taxData } = await request.json()

    if (!taxData) {
      console.log("[v0] AI Analysis: No tax data provided")
      return new Response("Tax data is required", { status: 400 })
    }

    if (!process.env.XAI_API_KEY) {
      console.error("[v0] AI Analysis: XAI_API_KEY not found")
      return new Response("AI service not configured", { status: 500 })
    }

    console.log("[v0] AI Analysis: Calling Grok AI")

    const result = await generateText({
      model: xai("grok-4"),
      prompt: `세금 데이터: 총 ${taxData.totalTaxes}개, 미납 ${taxData.unpaidTaxes}개, 연체 ${taxData.overdueTaxes}개, 이번달 ${taxData.monthlyDue}개, 이번주 ${taxData.weeklyDue}개

현재 세금 현황 요약
위 데이터를 바탕으로 현재 세금 상황을 3-4문단으로 간결하게 분석해주세요. 미납 비율, 연체 상태, 납부 일정 압박도, 위험도 평가, 한 줄 요약을 포함하세요.

중요: 마크다운 형식(#, ##, ###)을 사용하지 말고 일반 텍스트로만 작성하세요.`,
      system: "한국 세무 전문가로서 마크다운 형식 없이 일반 텍스트로만 간결한 분석을 제공하세요.",
      maxTokens: 500,
    })

    console.log("[v0] AI Analysis: Response generated")

    return new Response(JSON.stringify({ analysis: result.text }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("[v0] AI Analysis: Error analyzing tax insights:", error)
    return new Response(
      JSON.stringify({
        error: "Failed to analyze tax data",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    )
  }
}
