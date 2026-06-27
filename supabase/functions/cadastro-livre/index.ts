import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { nome, cpf_cnpj, email, telefone, endereco, notas, tipo_pessoa, origem } = body;

    if (!nome || !nome.trim()) {
      return new Response(
        JSON.stringify({ error: "Nome é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: Pin empresa_id server-side. Never trust caller-supplied values.
    // Configured via DEFAULT_EMPRESA_ID secret to prevent cross-tenant injection.
    const targetEmpresaId = Deno.env.get("DEFAULT_EMPRESA_ID");
    if (!targetEmpresaId) {
      console.error("DEFAULT_EMPRESA_ID secret is not configured");
      return new Response(
        JSON.stringify({ error: "Formulário indisponível no momento" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const notasCompletas = [
      notas || "",
      origem ? `ORIGEM: ${origem}` : "",
      tipo_pessoa ? `TIPO: ${tipo_pessoa === "pf" ? "PESSOA FÍSICA" : "PESSOA JURÍDICA"}` : "",
    ].filter(Boolean).join("\n");

    const { data: newClient, error: clientError } = await supabase
      .from("clientes")
      .insert({
        empresa_id: targetEmpresaId,
        nome: nome.toUpperCase(),
        cpf_cnpj: cpf_cnpj || null,
        email: email ? email.toLowerCase() : null,
        telefone: telefone || null,
        endereco: endereco || null,
        notas: notasCompletas || null,
        status_crm: "lead",
        origem: origem === "whatsapp" ? "whatsapp" : origem === "instagram" ? "instagram" : origem === "indicacao" ? "indicacao" : "outro",
      })
      .select()
      .single();

    if (clientError) {
      console.error("Error creating client:", clientError);
      return new Response(
        JSON.stringify({ error: "Falha ao criar cliente" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, cliente_id: newClient.id }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
