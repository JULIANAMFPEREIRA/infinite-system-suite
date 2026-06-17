import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

const VALID_ROLES = ["admin","administrativo","financeiro","tecnico","arquiteto","cliente","operacional","comercial","funcionario","parceiro"];

function respond(ok: boolean, payload: Record<string, unknown>, _status = 200) {
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
    if (!authHeader) return respond(false, { error: "Sessão expirada. Faça login novamente." });

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getUser();
    if (claimsErr || !claimsData.user) return respond(false, { error: "Sessão expirada. Faça login novamente." });

    const callerId = claimsData.user.id;
    const { data: callerRole } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").single();
    if (!callerRole) return respond(false, { error: "Apenas administradores podem cadastrar usuários." });

    const { data: callerProfile } = await supabaseAdmin.from("profiles").select("empresa_id").eq("id", callerId).single();
    if (!callerProfile?.empresa_id) return respond(false, { error: "Administrador sem empresa vinculada." });

    let body: any;
    try { body = await req.json(); } catch { return respond(false, { error: "Dados inválidos." }); }
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const full_name = String(body?.full_name ?? "").trim();
    let role = String(body?.role ?? "").trim().toLowerCase();

    // Validations
    if (!full_name) return respond(false, { error: "Nome é obrigatório." });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(false, { error: "Email inválido." });
    if (!password || password.length < 6) return respond(false, { error: "Senha deve ter no mínimo 6 caracteres." });
    if (!role) return respond(false, { error: "Tipo de usuário é obrigatório." });
    if (!VALID_ROLES.includes(role)) role = "funcionario"; // fallback to standard user

    // Check duplicate email by listing users (admin API)
    try {
      const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (existing?.users?.some((u: any) => (u.email ?? "").toLowerCase() === email)) {
        return respond(false, { error: "Email já cadastrado." });
      }
    } catch (_) { /* continue, createUser also reports duplicates */ }

    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr) {
      const msg = (createErr.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists") || msg.includes("duplicate")) {
        return respond(false, { error: "Email já cadastrado." });
      }
      return respond(false, { error: "Erro ao cadastrar usuário. Verifique os dados e tente novamente.", detail: createErr.message });
    }

    const userId = newUser.user.id;

    const { error: profErr } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name,
      empresa_id: callerProfile.empresa_id,
    });
    if (profErr) console.error("profile upsert", profErr);

    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      role,
      empresa_id: callerProfile.empresa_id,
    });
    if (roleErr) console.error("role insert", roleErr);

    // If the user is a client, link auth user to clientes table
    if (role === "cliente") {
      const clientEmail = email;
      const { error: clientErr } = await supabaseAdmin
        .from("clientes")
        .update({ user_id: userId })
        .eq("email", clientEmail)
        .eq("empresa_id", callerProfile.empresa_id);
      if (clientErr) console.error("clientes user_id update", clientErr);
    }

    // If the user is an architect, also ensure a fornecedor entry exists
    // so they appear in the CRM "Arquiteto" selection field.
    if (role === "arquiteto") {
      const { data: existingForn } = await supabaseAdmin
        .from("fornecedores")
        .select("id")
        .eq("empresa_id", callerProfile.empresa_id)
        .eq("email", email)
        .maybeSingle();
      if (!existingForn) {
        const { error: fornErr } = await supabaseAdmin.from("fornecedores").insert({
          empresa_id: callerProfile.empresa_id,
          nome: full_name.toUpperCase(),
          email,
          tipo: "arquiteto",
        });
        if (fornErr) console.error("fornecedor insert", fornErr);
      }
    }

    // If the user is a partner, ensure a fornecedor entry with subtipo
    if (role === "parceiro") {
      const subtipo = String(body?.subtipo_parceiro ?? "arquiteto").trim().toLowerCase();
      const { data: existingForn } = await supabaseAdmin
        .from("fornecedores")
        .select("id")
        .eq("empresa_id", callerProfile.empresa_id)
        .eq("email", email)
        .maybeSingle();
      if (!existingForn) {
        const { error: fornErr } = await supabaseAdmin.from("fornecedores").insert({
          empresa_id: callerProfile.empresa_id,
          nome: full_name.toUpperCase(),
          email,
          tipo: "arquiteto",
          subtipo_parceiro: subtipo,
          ativo: true,
        });
        if (fornErr) console.error("parceiro fornecedor insert", fornErr);
      } else {
        await supabaseAdmin.from("fornecedores")
          .update({ subtipo_parceiro: subtipo, ativo: true })
          .eq("id", existingForn.id);
      }
    }

    return respond(true, { success: true, user_id: userId });
  } catch (err: any) {
    console.error("create-user error", err);
    return respond(false, { error: "Erro ao cadastrar usuário. Verifique os dados e tente novamente." });
  }
});
