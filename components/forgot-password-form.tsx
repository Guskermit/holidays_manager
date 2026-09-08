"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { useState } from "react";
import { strings } from "@/lib/strings";
import { requestPasswordRecovery } from "@/app/auth/recovery/actions";

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await requestPasswordRecovery(email);
      if (result.error) {
        setError(result.error);
        return;
      }
      setSuccess(true);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Ocurrió un error inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{strings.auth.forgotPassword.successTitle}</CardTitle>
            <CardDescription>{strings.auth.forgotPassword.successDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {strings.auth.forgotPassword.successBody}
            </p>
            <Link
              href="/auth/recovery"
              className="underline underline-offset-4 text-sm"
            >
              {strings.auth.forgotPassword.recoveryLink}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{strings.auth.forgotPassword.title}</CardTitle>
            <CardDescription>
              {strings.auth.forgotPassword.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="email">{strings.auth.forgotPassword.emailLabel}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={strings.auth.forgotPassword.emailPlaceholder}
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? strings.auth.forgotPassword.submitLoading : strings.auth.forgotPassword.submitIdle}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                {strings.auth.forgotPassword.hasAccount}{" "}
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  {strings.auth.forgotPassword.loginLink}
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
