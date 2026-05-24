// app/(auth)/login/page.tsx
// useSearchParams must be in a Suspense boundary in Next.js 16
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
