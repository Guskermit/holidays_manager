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
import { useRouter } from "next/navigation";
import { useState } from "react";
import { strings } from "@/lib/strings";
import { verifyRecoveryCode } from "@/app/auth/recovery/actions";

export function RecoveryForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const result = await verifyRecoveryCode({
        code: code.trim().toUpperCase(),
        newPassword,
        confirmPassword,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      // Redirect to login after a short delay
      setTimeout(() => router.push("/auth/login"), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {success ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{strings.auth.recovery.successTitle}</CardTitle>
            <CardDescription>{strings.auth.recovery.successDescription}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {strings.auth.recovery.successBody}
            </p>
            <Link
              href="/auth/login"
              className="underline underline-offset-4 text-sm"
            >
              {strings.auth.recovery.loginLink}
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{strings.auth.recovery.title}</CardTitle>
            <CardDescription>
              {strings.auth.recovery.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify}>
              <div className="flex flex-col gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="code">{strings.auth.recovery.codeLabel}</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder={strings.auth.recovery.codePlaceholder}
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={8}
                    className="font-mono text-center tracking-widest uppercase"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">{strings.auth.recovery.newPasswordLabel}</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder={strings.auth.recovery.newPasswordPlaceholder}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">{strings.auth.recovery.confirmPasswordLabel}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={strings.auth.recovery.confirmPasswordPlaceholder}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? strings.auth.recovery.submitLoading : strings.auth.recovery.submitIdle}
                </Button>
              </div>
              <div className="mt-4 text-center text-sm">
                <Link
                  href="/auth/login"
                  className="underline underline-offset-4"
                >
                  {strings.auth.recovery.loginLink}
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
