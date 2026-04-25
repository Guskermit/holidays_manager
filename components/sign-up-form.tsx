"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
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
import { OFFICE_LABELS, type Office } from "@/lib/holidays";
import { CATEGORIES, CATEGORY_LABELS, COMPANIES, type Category } from "@/lib/categories";
import { strings } from "@/lib/strings";

export function SignUpForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [office, setOffice] = useState<Office>("madrid");
  const [category, setCategory] = useState<Category>("Staff");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    const allowedDomains = ["es.ey.com", "studio.ey.com"];
    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (!allowedDomains.includes(emailDomain)) {
      setError(strings.auth.signUp.errorDomain);
      setIsLoading(false);
      return;
    }

    if (password !== repeatPassword) {
      setError(strings.auth.signUp.errorPasswordMatch);
      setIsLoading(false);
      return;
    }

    if (category === "Externo" && !company) {
      setError(strings.auth.signUp.errorCompany);
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/main`,
          data: {
            full_name: fullName,
            office,
            category,
            company: category === "Externo" ? company : null,
          },
        },
      });
      if (error) throw error;
      router.push("/auth/sign-up-success");
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : strings.auth.signUp.errorGeneric);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">{strings.auth.signUp.title}</CardTitle>
          <CardDescription>{strings.auth.signUp.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignUp}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="full-name">{strings.auth.signUp.fullNameLabel}</Label>
                <Input
                  id="full-name"
                  type="text"
                  placeholder={strings.auth.signUp.fullNamePlaceholder}
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">{strings.auth.signUp.emailLabel}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={strings.auth.signUp.emailPlaceholder}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>{strings.auth.signUp.officeLabel}</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(OFFICE_LABELS) as Office[]).map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => setOffice(o)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm border transition-colors",
                        office === o
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input hover:bg-accent"
                      )}
                    >
                      {OFFICE_LABELS[o]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label>{strings.auth.signUp.categoryLabel}</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setCategory(c); if (c !== "Externo") setCompany(""); }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm border transition-colors",
                        category === c
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-input hover:bg-accent"
                      )}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  ))}
                </div>
              </div>
              {category === "Externo" && (
                <div className="grid gap-2">
                  <Label>{strings.auth.signUp.companyLabel}</Label>
                  <div className="flex flex-wrap gap-2">
                    {COMPANIES.map((co) => (
                      <button
                        key={co}
                        type="button"
                        onClick={() => setCompany(co)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm border transition-colors",
                          company === co
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-input hover:bg-accent"
                        )}
                      >
                        {co}
                      </button>
                    ))}
                  </div>
                  {!company && (
                    <p className="text-xs text-red-500">{strings.auth.signUp.companyRequired}</p>
                  )}
                </div>
              )}
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">{strings.auth.signUp.passwordLabel}</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="repeat-password">{strings.auth.signUp.repeatPasswordLabel}</Label>
                </div>
                <Input
                  id="repeat-password"
                  type="password"
                  required
                  value={repeatPassword}
                  onChange={(e) => setRepeatPassword(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? strings.auth.signUp.submitLoading : strings.auth.signUp.submitIdle}
              </Button>
            </div>
            <div className="mt-4 text-center text-sm">
              {strings.auth.signUp.hasAccount}{" "}
              <Link href="/auth/login" className="underline underline-offset-4">
                {strings.auth.signUp.loginLink}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
