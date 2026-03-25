import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getUser();
    if (claimsErr || !claimsData.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const callerId = claimsData.user.id;
    const { data: callerRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").single();
    if (!callerRole) return new Response(JSON.stringify({ error: "Only admins can create users" }), { status: 403, headers: corsHeaders });

    // Get caller's empresa
    const { data: callerProfile } = await supabaseAdmin.from("profiles").select("empresa_id").eq("id", callerId).single();
    if (!callerProfile?.empresa_id) return new Response(JSON.stringify({ error: "Admin has no empresa" }), { status: 400, headers: corsHeaders });

    const { email, password, full_name, role } = await req.json();
    if (!email || !password || !full_name || !role) {
      return new Response(JSON.stringify({ error: "Missing fields: email, password, full_name, role" }), { status: 400, headers: corsHeaders });
    }

    // Create user
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr) return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: corsHeaders });

    const userId = newUser.user.id;

    // Update profile with empresa_id and full_name
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name,
      empresa_id: callerProfile.empresa_id,
    });

    // Assign role
    await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role,
      empresa_id: callerProfile.empresa_id,
    });

    return new Response(JSON.stringify({ success: true, user_id: userId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
