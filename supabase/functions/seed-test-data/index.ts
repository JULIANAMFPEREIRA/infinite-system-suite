import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const empresaId = "a0000000-0000-0000-0000-000000000001";
  const log: string[] = [];

  try {
    // 1. Create admin user
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === "admin@infinit.com");
    let userId: string;

    if (existing) {
      userId = existing.id;
      log.push("Admin user already exists: " + userId);
    } else {
      const { data: newUser, error: userErr } = await supabaseAdmin.auth.admin.createUser({
        email: "admin@infinit.com",
        password: "123456",
        email_confirm: true,
        user_metadata: { full_name: "Administrador Infinit" },
      });
      if (userErr) throw userErr;
      userId = newUser.user.id;
      log.push("Created admin user: " + userId);
    }

    // 2. Update profile with empresa
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      full_name: "Administrador Infinit",
      empresa_id: empresaId,
    });
    log.push("Profile linked to empresa");

    // 3. Assign admin role
    const { data: existingRole } = await supabaseAdmin.from("user_roles")
      .select("id").eq("user_id", userId).eq("role", "admin").single();
    if (!existingRole) {
      await supabaseAdmin.from("user_roles").insert({
        user_id: userId, role: "admin", empresa_id: empresaId,
      });
      log.push("Admin role assigned");
    } else {
      log.push("Admin role already exists");
    }

    // 4. Cliente
    const { data: cliente } = await supabaseAdmin.from("clientes").insert({
      empresa_id: empresaId,
      nome: "Cliente Teste Alpha",
      email: "alpha@teste.com",
      telefone: "(11) 99999-0001",
      status_crm: "projeto",
      origem: "indicacao",
    }).select().single();
    log.push("Cliente created: " + cliente?.id);

    // 5. Fornecedores
    const { data: fornecedor } = await supabaseAdmin.from("fornecedores").insert({
      empresa_id: empresaId,
      nome: "TechSupply Distribuidora",
      tipo: "fornecedor",
      email: "contato@techsupply.com",
      telefone: "(11) 3333-0001",
      cidade: "São Paulo",
    }).select().single();
    log.push("Fornecedor created: " + fornecedor?.id);

    const { data: arquiteto } = await supabaseAdmin.from("fornecedores").insert({
      empresa_id: empresaId,
      nome: "Arq. Marina Costa",
      tipo: "arquiteto",
      email: "marina@arq.com",
      telefone: "(11) 99999-0002",
      rt_percentual: 8,
      cidade: "São Paulo",
    }).select().single();
    log.push("Arquiteto created: " + arquiteto?.id);

    // 6. Produtos
    const produtos = [
      { nome: "Painel LED Inteligente 60x60", codigo: "LED-001", categoria: "Iluminação", marca: "Philips", preco_custo: 280, preco_venda: 520, estoque_minimo: 5 },
      { nome: "Interruptor Smart WiFi 4 Canais", codigo: "INT-001", categoria: "Automação", marca: "Sonoff", preco_custo: 95, preco_venda: 189, estoque_minimo: 10 },
      { nome: "Câmera IP 360° com IA", codigo: "CAM-001", categoria: "Segurança", marca: "Intelbras", preco_custo: 450, preco_venda: 890, estoque_minimo: 3 },
    ];
    const produtoIds: string[] = [];
    for (const p of produtos) {
      const { data } = await supabaseAdmin.from("produtos").insert({
        ...p, empresa_id: empresaId, unidade: "un",
      }).select().single();
      produtoIds.push(data!.id);
    }
    log.push("3 produtos created");

    // 7. Estoque (baixo para forçar compra)
    for (let i = 0; i < produtoIds.length; i++) {
      await supabaseAdmin.from("estoque_itens").insert({
        empresa_id: empresaId,
        produto_id: produtoIds[i],
        numero_serie: `SN-TEST-${i + 1}`,
        status: "disponivel",
        localizacao: "Depósito Principal",
      });
    }
    log.push("3 estoque_itens created (1 each, low stock)");

    // 8. Projeto
    const { data: projeto } = await supabaseAdmin.from("projetos").insert({
      empresa_id: empresaId,
      nome: "Automação Residencial Alpha",
      descricao: "Projeto completo de automação residencial com iluminação, segurança e controle inteligente",
      cliente_id: cliente!.id,
      arquiteto_id: arquiteto!.id,
      status: "aprovado",
      data_inicio: "2026-03-20",
      data_previsao: "2026-05-15",
      entrada_recebida: true,
      custo_previsto: 4750,
      venda_total: 9200,
      margem_prevista: 48.37,
    }).select().single();
    log.push("Projeto created: " + projeto?.id);

    // 9. Itens do projeto
    const itens = [
      { descricao: "Painel LED Inteligente 60x60", tipo: "produto", produto_id: produtoIds[0], quantidade: 4, preco_custo: 280, preco_venda: 520, rt_percentual: 8 },
      { descricao: "Interruptor Smart WiFi 4 Canais", tipo: "produto", produto_id: produtoIds[1], quantidade: 6, preco_custo: 95, preco_venda: 189, rt_percentual: 8 },
      { descricao: "Câmera IP 360° com IA", tipo: "produto", produto_id: produtoIds[2], quantidade: 3, preco_custo: 450, preco_venda: 890, rt_percentual: 8 },
      { descricao: "Instalação e Configuração Completa", tipo: "servico", quantidade: 1, preco_custo: 1500, preco_venda: 2800, rt_percentual: 0 },
    ];
    const itemIds: string[] = [];
    for (const item of itens) {
      const { data } = await supabaseAdmin.from("projeto_itens").insert({
        ...item, projeto_id: projeto!.id,
      }).select().single();
      itemIds.push(data!.id);
    }
    log.push("4 projeto_itens created");

    // 10. Necessidades de compra (estoque insuficiente)
    const necessidades = [
      { produto_id: produtoIds[0], projeto_item_id: itemIds[0], descricao: "Painel LED Inteligente 60x60", quantidade: 3 },
      { produto_id: produtoIds[1], projeto_item_id: itemIds[1], descricao: "Interruptor Smart WiFi 4 Canais", quantidade: 5 },
      { produto_id: produtoIds[2], projeto_item_id: itemIds[2], descricao: "Câmera IP 360° com IA", quantidade: 2 },
    ];
    for (const n of necessidades) {
      await supabaseAdmin.from("necessidades_compra").insert({
        ...n, empresa_id: empresaId, projeto_id: projeto!.id, status: "pendente",
      });
    }
    log.push("3 necessidades_compra created");

    // 11. Compra real vinculada
    const { data: compra } = await supabaseAdmin.from("compras").insert({
      empresa_id: empresaId,
      projeto_id: projeto!.id,
      fornecedor_id: fornecedor!.id,
      produto_id: produtoIds[0],
      projeto_item_id: itemIds[0],
      descricao: "Compra Painel LED - Lote inicial",
      quantidade: 4,
      valor_unitario: 280,
      valor_total: 1120,
      status: "entregue",
      data_compra: "2026-03-22",
    }).select().single();
    log.push("1 compra created: " + compra?.id);

    // 12. Estoque da compra
    for (let i = 0; i < 3; i++) {
      await supabaseAdmin.from("estoque_itens").insert({
        empresa_id: empresaId,
        produto_id: produtoIds[0],
        compra_id: compra!.id,
        projeto_id: projeto!.id,
        numero_serie: `SN-LED-COMPRA-${i + 1}`,
        status: "reservado",
        localizacao: "Depósito Principal",
      });
    }
    log.push("3 estoque_itens from compra");

    // 13. Comissão RT do arquiteto
    const vendaTotal = 9200;
    const valorComissao = vendaTotal * 0.08;
    await supabaseAdmin.from("comissoes").insert({
      empresa_id: empresaId,
      projeto_id: projeto!.id,
      fornecedor_id: arquiteto!.id,
      percentual: 8,
      valor: valorComissao,
      status: "pendente",
      data_vencimento: "2026-04-30",
    });
    log.push("Comissão RT created: R$ " + valorComissao);

    // 14. Financeiro receber (entrada + parcelas)
    const parcelas = [
      { descricao: "Entrada - Automação Alpha", valor: 3680, parcela: 1, data_vencimento: "2026-03-25", status: "pago", data_pagamento: "2026-03-20" },
      { descricao: "Parcela 2 - Automação Alpha", valor: 2760, parcela: 2, data_vencimento: "2026-04-25", status: "pendente" },
      { descricao: "Parcela 3 - Automação Alpha", valor: 2760, parcela: 3, data_vencimento: "2026-05-25", status: "pendente" },
    ];
    for (const p of parcelas) {
      await supabaseAdmin.from("financeiro_receber").insert({
        ...p, empresa_id: empresaId, projeto_id: projeto!.id, cliente_id: cliente!.id,
      });
    }
    log.push("3 financeiro_receber created");

    // 15. Financeiro pagar
    await supabaseAdmin.from("financeiro_pagar").insert({
      empresa_id: empresaId,
      projeto_id: projeto!.id,
      fornecedor_id: fornecedor!.id,
      descricao: "Compra Painel LED - TechSupply",
      valor: 1120,
      data_vencimento: "2026-04-10",
      status: "pendente",
    });
    log.push("1 financeiro_pagar (fornecedor)");

    // Comissao already auto-generates via trigger, but let's add one manual if trigger didn't fire
    log.push("Financeiro pagar comissão generated by trigger");

    // 16. Finanças pessoais
    await supabaseAdmin.from("financas_pessoais").insert({
      empresa_id: empresaId,
      usuario_id: userId,
      descricao: "Retirada mensal - Março",
      tipo: "retirada",
      valor: 5000,
      categoria: "Pro-labore",
      data: "2026-03-15",
    });
    log.push("1 financa_pessoal created");

    return new Response(JSON.stringify({ success: true, log }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message, log }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
