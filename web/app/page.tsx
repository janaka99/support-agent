import { redirect } from "next/navigation";

export default function RootPage() {
  // The root path simply redirects to the dashboard.
  // Middleware will catch this and redirect unauthenticated users to /login.
  redirect("/dashboard");
}
