import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Find profiles with auto-delete enabled
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, auto_delete_days")
    .not("auto_delete_days", "is", null);

  if (!profiles || profiles.length === 0) {
    return new Response(JSON.stringify({ message: "No profiles with auto-delete" }), { status: 200 });
  }

  let totalDeleted = 0;

  for (const profile of profiles) {
    const cutoff = new Date(Date.now() - profile.auto_delete_days * 24 * 60 * 60 * 1000).toISOString();

    const [notifRes, activityRes] = await Promise.all([
      supabase.from("notifications").delete().eq("user_id", profile.id).lt("created_at", cutoff),
      supabase.from("activity_logs").delete().eq("user_id", profile.id).lt("created_at", cutoff),
    ]);

    totalDeleted += (notifRes.count || 0) + (activityRes.count || 0);
  }

  return new Response(JSON.stringify({ message: `Cleaned up ${totalDeleted} old records` }), { status: 200 });
});
