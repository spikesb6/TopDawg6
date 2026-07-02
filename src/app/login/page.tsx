import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/login-form";

export const metadata = {
  title: "Sign in — AgentMatch",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-[70vh] items-center bg-secondary/40 py-14">
      <div className="container max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl text-primary">Welcome back</CardTitle>
            <CardDescription>
              Sign in to your seller dashboard or agent lead pipeline.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
