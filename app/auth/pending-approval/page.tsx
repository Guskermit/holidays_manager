import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogoutButton } from "@/components/logout-button";
import { strings } from "@/lib/strings";

export default function PendingApprovalPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                {strings.auth.pendingApproval.title}
              </CardTitle>
              <CardDescription>
                {strings.auth.pendingApproval.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {strings.auth.pendingApproval.body}
              </p>
              <LogoutButton />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
