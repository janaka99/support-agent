"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth, ApiError } from "@/contexts/auth";
import { cn } from "@/lib/utils";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      setError(null);
      await login(data.email, data.password);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError("Invalid email or password");
      } else {
        setError("An unexpected error occurred");
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-[--text-primary]">
            Support Agent
          </h1>
          <p className="text-sm text-[--text-muted] mt-2">
            Sign in to your dashboard
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                {...register("email")}
                id="email"
                type="email"
                placeholder="you@example.com"
                className={cn("input", errors.email && "border-[--error]")}
                disabled={isSubmitting}
              />
              {errors.email && (
                <p className="text-xs text-[--error] mt-1.5">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label className="label" htmlFor="password">
                Password
              </label>
              <input
                {...register("password")}
                id="password"
                type="password"
                className={cn("input", errors.password && "border-[--error]")}
                disabled={isSubmitting}
              />
              {errors.password && (
                <p className="text-xs text-[--error] mt-1.5">
                  {errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="spinner" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
