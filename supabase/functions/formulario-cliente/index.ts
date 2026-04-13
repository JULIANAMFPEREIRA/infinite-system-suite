import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const url = new URL(req.url);

  // GET: validate token and return form info
  if (req.method === "GET") {
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response(JSON.stringify({ error: "Token obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("formulario_tokens")
      .select("id, token, status, orcamento_id, crm_orcamentos(nome, cliente_nome_avulso), empresas(nome, nome_fantasia)")
      .eq("token", token)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ error: "Link inválido ou expirado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (data.status === "preenchido") {
      return new Response(JSON.stringify({ error: "Este formulário já foi preenchido", already_filled: true }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      token_id: data.id,
      empresa: (data as any).empresas?.nome_fantasia || (data as any).empresas?.nome || "",
      orcamento: (data as any).crm_orcamentos?.nome || "",
      cliente_nome: (data as any).crm_orcamentos?.cliente_nome_avulso || "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // POST: submit form data
  if (req.method === "POST") {
    const body = await req.json();
    const { token, nome, cpf_cnpj, email, telefone, endereco } = body;

    if (!token || !nome?.trim()) {
      return new Response(JSON.stringify({ error: "Token e nome são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token
    const { data: tokenData, error: tokenErr } = await supabase
      .from("formulario_tokens")
      .select("*, crm_orcamentos(cliente_id, empresa_id)")
      .eq("token", token)
      .single();

    if (tokenErr || !tokenData) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tokenData.status === "preenchido") {
      return new Response(JSON.stringify({ error: "Formulário já preenchido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const empresaId = tokenData.empresa_id;
    const orcamento = (tokenData as any).crm_orcamentos;
    const clienteId = orcamento?.cliente_id || tokenData.cliente_id;

    const dadosCliente = {
      nome: nome.trim().toUpperCase(),
      cpf_cnpj: cpf_cnpj?.trim() || null,
      email: email?.trim()?.toLowerCase() || null,
      telefone: telefone?.trim() || null,
      endereco: endereco?.trim()?.toUpperCase() || null,
    };

    if (clienteId) {
      // Update existing client
      const { error: updateErr } = await supabase
        .from("clientes")
        .update(dadosCliente)
        .eq("id", clienteId);
      if (updateErr) {
        return new Response(JSON.stringify({ error: "Erro ao atualizar cliente" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Create new client and link to orcamento
      const { data: newClient, error: createErr } = await supabase
        .from("clientes")
        .insert({
          ...dadosCliente,
          empresa_id: empresaId,
          status_crm: "proposta",
        })
        .select()
        .single();

      if (createErr) {
        return new Response(JSON.stringify({ error: "Erro ao criar cliente" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Link orcamento to new client
      if (tokenData.orcamento_id) {
        await supabase
          .from("crm_orcamentos")
          .update({ cliente_id: newClient.id, is_avulso: false })
          .eq("id", tokenData.orcamento_id);

        await supabase
          .from("crm_itens")
          .update({ cliente_id: newClient.id })
          .eq("orcamento_id", tokenData.orcamento_id);
      }

      // Update token with client id
      await supabase
        .from("formulario_tokens")
        .update({ cliente_id: newClient.id })
        .eq("id", tokenData.id);
    }

    // Mark token as filled
    await supabase
      .from("formulario_tokens")
      .update({
        status: "preenchido",
        dados_preenchidos: dadosCliente,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tokenData.id);

    return new Response(JSON.stringify({ success: true, message: "Dados enviados com sucesso!" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Método não permitido" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
