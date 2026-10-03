"use client";

import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthToken } from "@/lib/useAuthToken";
import { useClientValue } from "@/lib/browserStore";
import { todayKey } from "@/lib/dates";
import { predictCycle } from "@/lib/predictor";

export type Cycle = { id: string; startDate: string; endDate?: string | null };
export type Symptom = {
  id: string;
  date: string;
  mood?: string | null;
  cramps?: number | null;
  sleep?: number | null;
  energy?: number | null;
  notes?: string | null;
};

export function authHeader(token: string | null) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

/** Today's date on this device. Null while the page is being prepared on the server. */
export function useToday() {
  return useClientValue<string | null>(todayKey, null);
}

export function useCycles() {
  const token = useAuthToken();
  return useQuery({
    queryKey: ["cycles", token],
    queryFn: async () => {
      const response = await api.get("/cycles", authHeader(token));
      return (response.data.cycles || []) as Cycle[];
    },
    enabled: !!token,
  });
}

export function useSymptoms() {
  const token = useAuthToken();
  return useQuery({
    queryKey: ["symptoms", token],
    queryFn: async () => {
      const response = await api.get("/symptoms", authHeader(token));
      return (response.data.symptoms || []) as Symptom[];
    },
    enabled: !!token,
  });
}

/** Everything a screen needs: the user's logs, today's date, and the prediction built from them. */
export function useBloomData() {
  const token = useAuthToken();
  const today = useToday();
  const cyclesQuery = useCycles();
  const symptomsQuery = useSymptoms();

  const cycles = cyclesQuery.data ?? [];
  const symptoms = symptomsQuery.data ?? [];
  const loading = !token || !today || cyclesQuery.isLoading || symptomsQuery.isLoading;
  const prediction = today ? predictCycle(cycles, today) : null;

  return { token, today, cycles, symptoms, prediction, loading };
}
