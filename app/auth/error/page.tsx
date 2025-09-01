import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>
}) {
  const params = await searchParams

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 bg-background">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">TMS</h1>
            <p className="text-muted-foreground">세금 일정 관리 시스템</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-center text-destructive">인증 오류</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              {params?.error ? (
                <div className="bg-destructive/10 p-4 rounded-md">
                  <p className="text-sm text-destructive font-medium mb-2">오류 코드: {params.error}</p>
                  <p className="text-sm text-muted-foreground">인증 과정에서 문제가 발생했습니다.</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">알 수 없는 오류가 발생했습니다.</p>
              )}
              <div className="space-y-2">
                <Button asChild className="w-full">
                  <Link href="/auth/login">로그인 페이지로 이동</Link>
                </Button>
                <Button asChild variant="outline" className="w-full bg-transparent">
                  <Link href="/auth/sign-up">회원가입 페이지로 이동</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
