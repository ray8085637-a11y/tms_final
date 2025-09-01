import { generateText } from "ai"
import { xai } from "@ai-sdk/xai"
import type { NextRequest } from "next/server"
import { Buffer } from "buffer"

export async function POST(request: NextRequest) {
  try {
    console.log("[v0] Starting tax image analysis")

    let requestData
    let image: string
    let imageType: string

    try {
      const formData = await request.formData()
      const imageFile = formData.get("image") as File

      if (!imageFile) {
        console.log("[v0] No image file provided")
        return Response.json({ success: false, error: "이미지가 필요합니다." }, { status: 400 })
      }

      // Convert file to base64
      const arrayBuffer = await imageFile.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString("base64")
      image = `data:${imageFile.type};base64,${base64}`
      imageType = imageFile.type

      console.log("[v0] Image file processed, type:", imageType)
    } catch (requestError) {
      console.error("[v0] Failed to parse FormData:", requestError)
      return Response.json({ success: false, error: "잘못된 요청 형식입니다." }, { status: 400 })
    }

    console.log("[v0] Calling Grok AI for image analysis")

    let result
    try {
      result = await generateText({
        model: xai("grok-2-vision-1212"),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `이미지에서 인식되는 모든 텍스트를 정확히 읽어서 JSON 형태로 정리해주세요.

다음과 같이 정리해주세요:
- 이미지에서 읽을 수 있는 모든 한글, 영어, 숫자를 포함
- 텍스트의 위치나 순서대로 정리
- 표, 양식, 라벨, 값 등 모든 내용 포함
- 읽기 어려운 부분도 최대한 추측해서 포함

반드시 다음 JSON 형식으로만 응답하세요:
{
  "extracted_text": "인식된 모든 텍스트 내용을 여기에 정리",
  "text_sections": [
    {
      "section": "섹션명 또는 영역",
      "content": "해당 영역의 텍스트 내용"
    }
  ]
}

JSON 외에는 어떤 텍스트도 포함하지 마세요.`,
              },
              {
                type: "image",
                image: image,
              },
            ],
          },
        ],
        system:
          "You are an expert OCR text extraction system. You specialize in reading all text from images including Korean, English, and numbers. Extract every visible text accurately and organize it systematically. Return ONLY valid JSON format without any additional text, explanations, or markdown formatting.",
      })
      console.log("[v0] AI call completed successfully")
    } catch (aiError) {
      console.error("[v0] AI generation failed:", aiError)
      return Response.json({
        success: true,
        data: {
          extracted_text: "AI 서비스에 연결할 수 없습니다.",
          text_sections: [],
        },
      })
    }

    if (!result || !result.text) {
      console.log("[v0] AI returned empty response")
      return Response.json({
        success: true,
        data: {
          extracted_text: "AI가 응답을 생성하지 못했습니다.",
          text_sections: [],
        },
      })
    }

    console.log("[v0] AI response received:", result.text)

    let extractedData
    try {
      // Remove any potential markdown formatting or extra text
      let cleanText = result.text.trim()
      console.log("[v0] Cleaning AI response:", cleanText)

      // Remove markdown code blocks if present
      cleanText = cleanText.replace(/```json\s*/g, "").replace(/```\s*/g, "")

      // Find JSON object in the response
      const jsonStart = cleanText.indexOf("{")
      const jsonEnd = cleanText.lastIndexOf("}")

      if (jsonStart !== -1 && jsonEnd !== -1) {
        cleanText = cleanText.substring(jsonStart, jsonEnd + 1)
        console.log("[v0] Extracted JSON string:", cleanText)
      } else {
        console.log("[v0] No JSON object found in response")
        throw new Error("No JSON object found in AI response")
      }

      extractedData = JSON.parse(cleanText)
      console.log("[v0] Successfully parsed JSON:", extractedData)

      const validateText = (text: string): boolean => {
        if (!text || typeof text !== "string") return false

        // Check minimum length
        if (text.trim().length < 10) return false

        // Check if text contains meaningful characters (Korean, English, numbers)
        const meaningfulChars = /[가-힣a-zA-Z0-9]/g
        const matches = text.match(meaningfulChars)
        if (!matches || matches.length < 5) return false

        // Check if text is not just repeated characters or noise
        const uniqueChars = new Set(text.replace(/\s/g, ""))
        if (uniqueChars.size < 3) return false

        // Check for common OCR noise patterns
        const noisePatterns = /^[^\w가-힣]*$|^[.]{3,}$|^[-]{3,}$|^[_]{3,}$/
        if (noisePatterns.test(text.trim())) return false

        return true
      }

      const validateSection = (section: any): boolean => {
        return (
          section &&
          typeof section.section === "string" &&
          typeof section.content === "string" &&
          section.section.trim().length > 0 &&
          validateText(section.content)
        )
      }

      // Validate extracted text
      const isValidText = validateText(extractedData.extracted_text || "")
      const validSections = (extractedData.text_sections || []).filter(validateSection)

      console.log("[v0] Text validation results:", {
        isValidText,
        originalSectionsCount: (extractedData.text_sections || []).length,
        validSectionsCount: validSections.length,
      })

      // If no valid content found, return appropriate message
      if (!isValidText && validSections.length === 0) {
        console.log("[v0] No meaningful text found in image")
        return Response.json({
          success: true,
          data: {
            extracted_text: "이미지에서 의미있는 텍스트를 찾을 수 없습니다. 더 선명한 이미지를 업로드해주세요.",
            text_sections: [
              {
                section: "안내",
                content: "텍스트가 명확하게 보이는 고화질 이미지를 사용해주세요.",
              },
            ],
          },
        })
      }

      const validatedData = {
        extracted_text: isValidText ? extractedData.extracted_text : "추출된 텍스트의 품질이 낮습니다.",
        text_sections:
          validSections.length > 0
            ? validSections
            : [
                {
                  section: "추출 결과",
                  content: isValidText ? extractedData.extracted_text : "텍스트 인식이 불완전합니다.",
                },
              ],
      }

      console.log("[v0] Returning validated data:", validatedData)
      return Response.json({ success: true, data: validatedData })
    } catch (parseError) {
      console.error("[v0] JSON parsing error:", parseError)
      console.error("[v0] Raw AI response:", result.text)

      // Return default structure if parsing fails
      return Response.json({
        success: true,
        data: {
          extracted_text: "AI 분석 결과를 파싱할 수 없습니다.",
          text_sections: [],
        },
      })
    }
  } catch (error) {
    console.error("[v0] Error analyzing tax image:", error)
    return Response.json({ success: false, error: "이미지 분석 중 오류가 발생했습니다." }, { status: 500 })
  }
}
