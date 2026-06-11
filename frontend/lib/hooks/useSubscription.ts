// lib/hooks/useSubscription.ts
// Hook for subscription state — used by banner + payment modal

import {
  getMyPayments,
  getMySubscriptionStatus,
  submitPayment,
  type PaymentRecord,
  type SubmitPaymentPayload,
  type SubscriptionStatus,
} from "@/lib/api/subscription";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const SUBSCRIPTION_KEY = ["subscription-status"] as const;
export const PAYMENTS_KEY     = ["subscription-payments"] as const;

export function useSubscription() {
  const queryClient = useQueryClient();

  const {
    data:      status,
    isLoading: statusLoading,
    error:     statusError,
  } = useQuery<SubscriptionStatus>({
    queryKey:  SUBSCRIPTION_KEY,
    queryFn:   getMySubscriptionStatus,
    staleTime: 60_000,       // re-check every 60s
    retry:     1,
  });

  const {
    data:      payments = [],
    isLoading: paymentsLoading,
  } = useQuery<PaymentRecord[]>({
    queryKey: PAYMENTS_KEY,
    queryFn:  getMyPayments,
    staleTime: 30_000,
    enabled:  !!status,   // only fetch after status loaded
  });

  const submitMutation = useMutation({
    mutationFn: (payload: SubmitPaymentPayload) => submitPayment(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUBSCRIPTION_KEY });
      queryClient.invalidateQueries({ queryKey: PAYMENTS_KEY });
    },
  });

  return {
    status,
    statusLoading,
    statusError,
    payments,
    paymentsLoading,
    submitPayment:   submitMutation.mutateAsync,
    isSubmitting:    submitMutation.isPending,
    submitError:     submitMutation.error,
    accessLevel:     status?.access_level ?? "full",
    isGrace:         status?.access_level === "grace",
    isLocked:        status?.access_level === "locked",
    isTrial:         status?.status === "trial",
    hasPending:      status?.pending_payment ?? false,
    daysLeft:        status?.days_until_expiry ?? null,
    daysUntilLocked: status?.days_until_locked ?? null,
  };
}
