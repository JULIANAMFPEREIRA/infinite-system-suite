import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function respond(ok: boolean, payload: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok, ...payload }), { status: 200, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return respond(false, { error: "Sessão expirada." });

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getUser();
    if (claimsErr || !claimsData.user) return respond(false, { error: "Sessão expirada." });

    const callerId = claimsData.user.id;
    const { data: callerRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").single();
    if (!callerRole) return respond(false, { error: "Apenas administradores podem gerenciar usuários." });

    const { data: callerProfile } = await supabaseAdmin.from("profiles").select("empresa_id").eq("id", callerId).single();
    if (!callerProfile?.empresa_id) return respond(false, { error: "Administrador sem empresa vinculada." });

    let body: any;
    try { body = await req.json(); } catch { return respond(false, { error: "Dados inválidos." }); }

    const action = String(body?.action ?? "").trim();
    const user_id = String(body?.user_id ?? "").trim();
    if (!user_id) return respond(false, { error: "user_id é obrigatório." });
    if (user_id === callerId && action === "delete") return respond(false, { error: "Você não pode excluir sua própria conta." });

    // Verify target user belongs to same empresa
    const { data: targetProfile } = await supabaseAdmin.from("profiles").select("empresa_id").eq("id", user_id).single();
    if (!targetProfile || targetProfile.empresa_id !== callerProfile.empresa_id) {
      return respond(false, { error: "Usuário não pertence à sua empresa." });
    }

    if (action === "update") {
      const full_name = body?.full_name != null ? String(body.full_name).trim() : null;
      const email = body?.email != null ? String(body.email).trim() : null;
      const password = body?.password ? String(body.password) : null;

      if (full_name) {
        const { error: pErr } = await supabaseAdmin.from("profiles").update({ full_name }).eq("id", user_id);
        if (pErr) return respond(false, { error: "Erro ao atualizar nome.", detail: pErr.message });
        await supabaseAdmin.auth.admin.updateUserById(user_id, { user_metadata: { full_name } });
      }

      if (email) {
        const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, { email });
        if (aErr) return respond(false, { error: "Erro ao atualizar email.", detail: aErr.message });
      }

      if (password) {
        if (password.length < 6) return respond(false, { error: "Senha deve ter no mínimo 6 caracteres." });
        const { error: aErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
        if (aErr) return respond(false, { error: "Erro ao atualizar senha.", detail: aErr.message });
      }

      return respond(true, { success: true });
    }

    if (action === "delete") {
      // Remove dependent rows first
      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id);
      await supabaseAdmin.from("user_permissions").delete().eq("user_id", user_id);
      await supabaseAdmin.from("profiles").delete().eq("id", user_id);
      const { error: dErr } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (dErr) return respond(false, { error: "Erro ao excluir usuário.", detail: dErr.message });
      return respond(true, { success: true });
    }

    return respond(false, { error: "Ação inválida." });
  } catch (err: any) {
    console.error("manage-user error", err);
    return respond(false, { error: "Erro inesperado.", detail: err?.message });
  }
});