// app/api/auth/[...nextauth]/route.ts
// Create this file at: app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth/config";
export const { GET, POST } = handlers;
