"use client";

import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/contexts/auth";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-6xl mx-auto animate-in fade-in duration-500">
      <PageHeader 
        title="Settings" 
        description="Manage your organization preferences."
      />
      
      <div className="grid gap-8 mt-6">
        <Card className="p-6 max-w-2xl">
          <h3 className="text-lg font-medium text-[--text-primary] mb-4">Organization Profile</h3>
          
          <div className="space-y-6">
            <FormField label="Organization Name">
              <Input value="Your Organization" disabled readOnly />
            </FormField>
            
            <FormField label="Organization ID">
              <Input value={user?.org_id || ""} disabled readOnly className="font-mono text-sm" />
            </FormField>
          </div>
        </Card>
        
        <Card className="p-6 max-w-2xl">
          <h3 className="text-lg font-medium text-[--text-primary] mb-4">Your Account</h3>
          
          <div className="space-y-6">
            <FormField label="Email Address">
              <Input value={user?.email || ""} disabled readOnly />
            </FormField>
            
            <FormField label="Role">
              <Input value={user?.role || ""} disabled readOnly className="capitalize" />
            </FormField>
          </div>
        </Card>
      </div>
    </div>
  );
}
