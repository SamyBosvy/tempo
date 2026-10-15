import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type Settings = Tables<"user_settings">;

export const DEFAULT_SETTINGS: Omit<Settings, "user_id" | "updated_at"> = {
  work_start: "08:00:00",
  work_end: "18:00:00",
  min_focus_min: 25,
  prime_lead_min: 10,
  daily_focus_target_min: 120,
  meeting_buffer_min: 5,
  breath_pattern: "sigh",
  breath_minutes: 2,
  keywords: ["review", "interview", "1:1", "performance"],
  calendar_ids: ["primary"],
  notifications: false,
  vibration: true,
  theme: "dark",
  safety_ack_at: null,
  google_email: null,
  google_connected_at: null,
};

export async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

export const settingsQuery = queryOptions({
  queryKey: ["settings"],
  queryFn: async () => {
    const uid = await currentUserId();
    const { data, error } = await supabase.from("user_settings").select("*").eq("user_id", uid).maybeSingle();
    if (error) throw error;
    return { ...DEFAULT_SETTINGS, user_id: uid, updated_at: "", ...(data ?? {}) } as Settings & { exists?: boolean };
  },
  staleTime: 60_000,
});

export function useSettings() {
  return useQuery(settingsQuery);
}

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: TablesUpdate<"user_settings">) => {
      const uid = await currentUserId();
      const { error } = await supabase
        .from("user_settings")
        .upsert({ ...patch, user_id: uid, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: ["settings"] });
      const prev = qc.getQueryData(settingsQuery.queryKey);
      if (prev) qc.setQueryData(settingsQuery.queryKey, { ...prev, ...patch } as Settings);
      return { prev };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(settingsQuery.queryKey, ctx.prev);
      toast.error("Couldn't save that setting. Try again.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}
