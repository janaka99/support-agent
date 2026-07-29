"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog } from "@/components/ui/dialog";
import { FormField } from "@/components/forms/form-field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { orgApi } from "@/lib/api/org";
import { Copy, CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

const schema = z.object({
  email: z.string().email("Valid email required"),
});

type FormValues = z.infer<typeof schema>;

function generatePassword() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let pass = "";
  for (let i = 0; i < 14; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function InviteMemberDialog({ isOpen, onClose, onSuccess }: Props) {
  const [result, setResult] = useState<{ email: string; pass: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormValues) => {
    try {
      setSubmitError(null);
      const pass = generatePassword();
      await orgApi.createMember(data.email, pass);
      setResult({ email: data.email, pass });
      onSuccess();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setSubmitError(err.message || "Failed to invite member");
      } else {
        setSubmitError("Failed to invite member");
      }
    }
  };

  const handleClose = () => {
    reset();
    setResult(null);
    setCopied(false);
    setSubmitError(null);
    onClose();
  };

  const copyCredentials = () => {
    if (!result) return;
    const text = `Dashboard URL: [your-url]\nEmail: ${result.email}\nPassword: ${result.pass}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog 
      isOpen={isOpen} 
      onClose={result ? () => {} : handleClose}
      title={result ? "Member Invited" : "Invite Team Member"}
      description={result ? "Copy these credentials now. They won't be shown again." : "Generate credentials for a new team member."}
    >
      {result ? (
        <div className="space-y-6">
          <div className="bg-surface/50 rounded-lg p-4 font-mono text-sm border border-[--border] space-y-2">
            <div><span className="text-[--text-muted]">Email:</span> <span className="text-[--text-primary]">{result.email}</span></div>
            <div><span className="text-[--text-muted]">Password:</span> <span className="text-[--text-primary]">{result.pass}</span></div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={handleClose}>Done</Button>
            <Button onClick={copyCredentials} className="gap-2">
              {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy Credentials"}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {submitError && (
            <div className="alert alert-error">
              <span>{submitError}</span>
            </div>
          )}
          <FormField label="Email Address" error={errors.email?.message}>
            <Input {...register("email")} type="email" placeholder="colleague@yourcompany.com" disabled={isSubmitting} />
          </FormField>
          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner /> : "Invite"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
