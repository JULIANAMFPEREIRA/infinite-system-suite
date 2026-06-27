import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
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

    // GET - Validate token and return form context
    if (req.method === "GET") {
      const url = new URL(req.url);
      const token = url.searchParams.get("token");

      if (!token) {
        return new Response(
          JSON.stringify({ error: "Token is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: tokenData, error: tokenError } = await supabase
        .from("formulario_tokens")
        .select("*, crm_orcamentos(nome)")
        .eq("token", token)
        .eq("status", "pendente")
        .single();

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ error: "Token inválido ou expirado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          token: tokenData.token,
          orcamento_nome: tokenData.crm_orcamentos?.nome,
          status: tokenData.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST - Generate new token for an orcamento
    if (req.method === "POST") {
      // SECURITY: require authenticated caller and verify tenant ownership
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
      if (!anonKey) {
        return new Response(
          JSON.stringify({ error: "Server misconfigured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token_jwt = authHeader.replace("Bearer ", "");
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token_jwt);
      if (claimsErr || !claimsData?.claims?.sub) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const userId = claimsData.claims.sub as string;

      const { orcamento_id } = await req.json();
      if (!orcamento_id) {
        return new Response(
          JSON.stringify({ error: "Orcamento ID is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Resolve caller's empresa_id from their profile (never trust client input)
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", userId)
        .single();
      if (profileErr || !profile?.empresa_id) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const empresa_id = profile.empresa_id;

      // Verify the orcamento belongs to the caller's empresa
      const { data: orc, error: orcErr } = await supabase
        .from("crm_orcamentos")
        .select("id, empresa_id")
        .eq("id", orcamento_id)
        .single();
      if (orcErr || !orc || orc.empresa_id !== empresa_id) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Generate unique token
      const token = crypto.randomUUID();

      const { data, error } = await supabase
        .from("formulario_tokens")
        .insert({
          token,
          orcamento_id,
          empresa_id,
          status: "pendente",
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating token:", error);
        return new Response(
          JSON.stringify({ error: "Failed to create token" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ token: data.token }),
        { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PUT - Submit form data
    if (req.method === "PUT") {
      const { token, nome, cpf_cnpj, email, telefone, endereco, notas, tipo_pessoa } = await req.json();

      if (!token || !nome) {
        return new Response(
          JSON.stringify({ error: "Token and nome are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Validate token
      const { data: tokenData, error: tokenError } = await supabase
        .from("formulario_tokens")
        .select("*, crm_orcamentos(cliente_id, cliente_nome_avulso, is_avulso)")
        .eq("token", token)
        .eq("status", "pendente")
        .single();

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ error: "Token inválido ou já utilizado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { orcamento_id, empresa_id } = tokenData;

      // Check if client already exists (for avulso orçamentos)
      let cliente_id = tokenData.crm_orcamentos?.cliente_id;

      if (!cliente_id) {
        // Create new cliente
        const { data: newClient, error: clientError } = await supabase
          .from("clientes")
          .insert({
            empresa_id,
            nome: nome.toUpperCase(),
            cpf_cnpj: cpf_cnpj || null,
            email: email ? email.toLowerCase() : null,
            telefone: telefone || null,
            endereco: endereco || null,
            notas: notas || null,
            status_crm: "proposta",
          })
          .select()
          .single();

        if (clientError) {
          console.error("Error creating client:", clientError);
          return new Response(
            JSON.stringify({ error: "Failed to create client" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        cliente_id = newClient.id;
      } else {
        // Update existing cliente
        const { error: updateError } = await supabase
          .from("clientes")
          .update({
            nome: nome.toUpperCase(),
            cpf_cnpj: cpf_cnpj || null,
            email: email ? email.toLowerCase() : null,
            telefone: telefone || null,
            endereco: endereco || null,
            notas: notas || null,
          })
          .eq("id", cliente_id);

        if (updateError) {
          console.error("Error updating client:", updateError);
          return new Response(
            JSON.stringify({ error: "Failed to update client" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Update orçamento to link to cliente and remove avulso flag
      const { error: orcError } = await supabase
        .from("crm_orcamentos")
        .update({
          cliente_id,
          is_avulso: false,
          cliente_nome_avulso: null,
          cliente_telefone_avulso: null,
        })
        .eq("id", orcamento_id);

      if (orcError) {
        console.error("Error updating orçamento:", orcError);
      }

      // Update crm_itens to link to the new cliente
      const { error: itensError } = await supabase
        .from("crm_itens")
        .update({ cliente_id })
        .eq("orcamento_id", orcamento_id);

      if (itensError) {
        console.error("Error updating itens:", itensError);
      }

      // Mark token as completed
      const { error: tokenUpdateError } = await supabase
        .from("formulario_tokens")
        .update({
          status: "preenchido",
          dados_preenchidos: { nome, cpf_cnpj, email, telefone, endereco, notas, tipo_pessoa },
        })
        .eq("token", token);

      if (tokenUpdateError) {
        console.error("Error updating token:", tokenUpdateError);
      }

      return new Response(
        JSON.stringify({ success: true, cliente_id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error processing request:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
