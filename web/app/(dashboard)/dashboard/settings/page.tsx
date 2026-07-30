"use client";

import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/contexts/auth";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="Settings"
        description="Manage your organization preferences."
      />

      <div className="grid gap-6 mt-2 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[--text-primary]">
              Organization Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Organization Name</Label>
              <Input value="Your Organization" disabled readOnly />
            </div>
            <div className="space-y-1.5">
              <Label>Organization ID</Label>
              <Input
                value={user?.org_id || ""}
                disabled
                readOnly
                className="font-mono text-xs"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-[--text-primary]">
              Your Account
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email Address</Label>
              <Input value={user?.email || ""} disabled readOnly />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Input
                value={user?.role || ""}
                disabled
                readOnly
                className="capitalize"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
