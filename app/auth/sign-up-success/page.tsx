import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function SignUpSuccessPage() {
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
              <CardTitle className="text-2xl text-center">회원가입 완료!</CardTitle>
              <CardDescription className="text-center">이메일 인증을 완료해주세요</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                회원가입이 성공적으로 완료되었습니다. 이메일을 확인하여 계정을 인증한 후 로그인해주세요.
              </p>
              <div className="bg-muted/50 p-4 rounded-md">
                <p className="text-sm font-medium text-foreground mb-2">다음 단계:</p>
                <ol className="text-sm text-muted-foreground space-y-1 text-left">
                  <li>1. 이메일 받은편지함을 확인하세요</li>
                  <li>2. 인증 링크를 클릭하세요</li>
                  <li>3. 로그인하여 TMS를 시작하세요</li>
                </ol>
              </div>
              <Button asChild className="w-full">
                <Link href="/auth/login">로그인 페이지로 이동</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
