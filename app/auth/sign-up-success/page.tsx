import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { strings } from "@/lib/strings";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {strings.auth.signUpSuccess.title}
              </CardTitle>
              <CardDescription>{strings.auth.signUpSuccess.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {strings.auth.signUpSuccess.body}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
