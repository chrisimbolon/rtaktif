// store/index.ts
// auth state lives in NextAuth session — NOT in Zustand
// Zustand is for UI state only
export { useRTStore } from "./rt.store";
