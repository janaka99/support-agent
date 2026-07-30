"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth, ApiError } from "@/contexts/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// Signature element: a snapshot of the live queue, not decoration.
// Swap for a real fetch if you want it live rather than illustrative.
const QUEUE_PREVIEW = [
  {
    id: "TCK-2291",
    summary: "Checkout fails on Safari 17",
    status: "open",
    waiting: "2m",
  },
  {
    id: "TCK-2288",
    summary: "Refund requested — order #8841",
    status: "pending",
    waiting: "11m",
  },
  {
    id: "TCK-2276",
    summary: "Can't reset 2FA device",
    status: "open",
    waiting: "18m",
  },
] as const;

// open = needs an agent now (error/red), pending = waiting on the
// customer, lower urgency (warning/amber). Matches badge-* in globals.css.
const STATUS_BADGE: Record<string, string> = {
  open: "badge badge-error",
  pending: "badge badge-warning",
};

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
  } = form;

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setError(null);
      await login(data.email, data.password);
      router.push("/dashboard");
      // Prevent the form from finishing submission so the spinner stays active during redirect
      await new Promise(() => {});
    } catch (err) {
      if (err instanceof ApiError) {
        setError("That email and password don't match our records.");
      } else {
        setError("Something went wrong on our end. Try again in a moment.");
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-bg-base">
      {/* Left: brand panel — same glass signature as the app sidebar,
          with an ambient accent glow instead of a flat fill. */}
      <div className="hidden lg:flex lg:w-[55%] relative flex-col justify-between bg-bg-surface border-r border-border px-16 py-14 overflow-hidden">
        <div
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-accent-muted blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[13px] font-medium tracking-[0.14em] uppercase text-text-secondary">
            Support Agent
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-[42px] font-semibold leading-[1.1] tracking-tight text-text-primary mb-4">
            Pick up right where the queue left off.
          </h1>
          <p className="text-[15px] leading-relaxed text-text-secondary">
            Three tickets came in while you were away.
          </p>
        </div>

        <div className="relative flex flex-col gap-3">
          {QUEUE_PREVIEW.map((t) => (
            <div key={t.id} className="card flex items-center gap-4 px-4 py-3">
              <span className="mono w-[76px] shrink-0">{t.id}</span>
              <span className="text-[13px] text-text-primary flex-1 truncate">
                {t.summary}
              </span>
              <span className={STATUS_BADGE[t.status]}>{t.status}</span>
              <span className="mono w-[32px] text-right">{t.waiting}</span>
            </div>
          ))}
          <p className="mono mt-1">4 agents online · avg. first response 3m</p>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px] flex flex-col gap-8">
          <div className="lg:hidden flex items-center gap-2.5 justify-center mb-2">
            <span className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-[13px] font-medium tracking-[0.14em] uppercase text-text-secondary">
              Support Agent
            </span>
          </div>

          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-text-primary">
              Sign in
            </h2>
            <p className="text-sm text-text-secondary mt-1.5">
              Use your agent credentials to continue.
            </p>
          </div>

          <Form {...form}>
            <form
              onSubmit={handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              {error && (
                <div className="alert alert-error">
                  <span>{error}</span>
                </div>
              )}

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="label">Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="you@company.com"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="label">Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full mt-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? <Spinner /> : "Sign in"}
              </Button>
            </form>
          </Form>

          <p className="text-[13px] text-text-secondary text-center">
            Trouble signing in?{" "}
            <a
              href="/support"
              className="text-accent hover:text-accent-hover hover:underline"
            >
              Contact your admin
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
