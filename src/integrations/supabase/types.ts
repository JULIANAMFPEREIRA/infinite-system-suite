export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          acao: Database["public"]["Enums"]["acao_audit"]
          created_at: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          empresa_id: string | null
          id: string
          registro_id: string | null
          tabela: string
          usuario_id: string | null
        }
        Insert: {
          acao: Database["public"]["Enums"]["acao_audit"]
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          empresa_id?: string | null
          id?: string
          registro_id?: string | null
          tabela: string
          usuario_id?: string | null
        }
        Update: {
          acao?: Database["public"]["Enums"]["acao_audit"]
          created_at?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          empresa_id?: string | null
          id?: string
          registro_id?: string | null
          tabela?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      authorization_items: {
        Row: {
          authorization_id: string
          created_at: string
          description: string | null
          id: string
          label: string
          observation: string | null
          order_index: number
          response: string | null
          updated_at: string
        }
        Insert: {
          authorization_id: string
          created_at?: string
          description?: string | null
          id?: string
          label: string
          observation?: string | null
          order_index?: number
          response?: string | null
          updated_at?: string
        }
        Update: {
          authorization_id?: string
          created_at?: string
          description?: string | null
          id?: string
          label?: string
          observation?: string | null
          order_index?: number
          response?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorization_items_authorization_id_fkey"
            columns: ["authorization_id"]
            isOneToOne: false
            referencedRelation: "authorizations"
            referencedColumns: ["id"]
          },
        ]
      }
      authorizations: {
        Row: {
          client_name: string
          created_at: string
          created_by: string | null
          id: string
          recipient_name: string
          recipient_role: string
          responded_at: string | null
          slug: string
          status: string
          title: string
        }
        Insert: {
          client_name: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_name: string
          recipient_role: string
          responded_at?: string | null
          slug: string
          status?: string
          title: string
        }
        Update: {
          client_name?: string
          created_at?: string
          created_by?: string | null
          id?: string
          recipient_name?: string
          recipient_role?: string
          responded_at?: string | null
          slug?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          created_at: string
          deletado: boolean
          empresa_id: string
          id: string
          nome: string
          tipo: string | null
        }
        Insert: {
          created_at?: string
          deletado?: boolean
          empresa_id: string
          id?: string
          nome: string
          tipo?: string | null
        }
        Update: {
          created_at?: string
          deletado?: boolean
          empresa_id?: string
          id?: string
          nome?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          arquiteto_id: string | null
          cpf_cnpj: string | null
          created_at: string
          data_aniversario: string | null
          deletado: boolean
          email: string | null
          empresa_id: string
          endereco: string | null
          endereco_obra: string | null
          id: string
          nome: string
          notas: string | null
          origem: Database["public"]["Enums"]["origem_lead"] | null
          status_crm: Database["public"]["Enums"]["status_crm"] | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          arquiteto_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_aniversario?: string | null
          deletado?: boolean
          email?: string | null
          empresa_id: string
          endereco?: string | null
          endereco_obra?: string | null
          id?: string
          nome: string
          notas?: string | null
          origem?: Database["public"]["Enums"]["origem_lead"] | null
          status_crm?: Database["public"]["Enums"]["status_crm"] | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          arquiteto_id?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          data_aniversario?: string | null
          deletado?: boolean
          email?: string | null
          empresa_id?: string
          endereco?: string | null
          endereco_obra?: string | null
          id?: string
          nome?: string
          notas?: string | null
          origem?: Database["public"]["Enums"]["origem_lead"] | null
          status_crm?: Database["public"]["Enums"]["status_crm"] | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clientes_arquiteto_id_fkey"
            columns: ["arquiteto_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      comissoes: {
        Row: {
          created_at: string
          data_vencimento: string | null
          deletado: boolean
          empresa_id: string
          forma_pagamento: string | null
          fornecedor_id: string
          id: string
          num_parcelas: number | null
          observacao: string | null
          parcelado: boolean | null
          percentual: number | null
          projeto_id: string
          projeto_item_id: string | null
          status: Database["public"]["Enums"]["status_comissao"] | null
          valor: number | null
        }
        Insert: {
          created_at?: string
          data_vencimento?: string | null
          deletado?: boolean
          empresa_id: string
          forma_pagamento?: string | null
          fornecedor_id: string
          id?: string
          num_parcelas?: number | null
          observacao?: string | null
          parcelado?: boolean | null
          percentual?: number | null
          projeto_id: string
          projeto_item_id?: string | null
          status?: Database["public"]["Enums"]["status_comissao"] | null
          valor?: number | null
        }
        Update: {
          created_at?: string
          data_vencimento?: string | null
          deletado?: boolean
          empresa_id?: string
          forma_pagamento?: string | null
          fornecedor_id?: string
          id?: string
          num_parcelas?: number | null
          observacao?: string | null
          parcelado?: boolean | null
          percentual?: number | null
          projeto_id?: string
          projeto_item_id?: string | null
          status?: Database["public"]["Enums"]["status_comissao"] | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "comissoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comissoes_projeto_item_id_fkey"
            columns: ["projeto_item_id"]
            isOneToOne: false
            referencedRelation: "projeto_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      compras: {
        Row: {
          created_at: string
          data_compra: string | null
          deletado: boolean
          descricao: string | null
          empresa_id: string
          fornecedor_id: string | null
          id: string
          produto_id: string | null
          projeto_id: string | null
          projeto_item_id: string | null
          quantidade: number | null
          status: Database["public"]["Enums"]["status_compra"] | null
          valor_total: number | null
          valor_unitario: number | null
        }
        Insert: {
          created_at?: string
          data_compra?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id: string
          fornecedor_id?: string | null
          id?: string
          produto_id?: string | null
          projeto_id?: string | null
          projeto_item_id?: string | null
          quantidade?: number | null
          status?: Database["public"]["Enums"]["status_compra"] | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Update: {
          created_at?: string
          data_compra?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id?: string
          fornecedor_id?: string | null
          id?: string
          produto_id?: string | null
          projeto_id?: string | null
          projeto_item_id?: string | null
          quantidade?: number | null
          status?: Database["public"]["Enums"]["status_compra"] | null
          valor_total?: number | null
          valor_unitario?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "compras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compras_projeto_item_id_fkey"
            columns: ["projeto_item_id"]
            isOneToOne: false
            referencedRelation: "projeto_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_assinatura: string | null
          data_envio: string | null
          deletado: boolean
          descricao: string | null
          empresa_id: string
          id: string
          projeto_id: string | null
          status: string
          valor: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_assinatura?: string | null
          data_envio?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id: string
          id?: string
          projeto_id?: string | null
          status?: string
          valor?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_assinatura?: string | null
          data_envio?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id?: string
          id?: string
          projeto_id?: string | null
          status?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_arquivos: {
        Row: {
          cliente_id: string
          created_at: string
          empresa_id: string
          id: string
          nome_arquivo: string
          tamanho: number | null
          tipo: string
          url: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          empresa_id: string
          id?: string
          nome_arquivo: string
          tamanho?: number | null
          tipo?: string
          url: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          empresa_id?: string
          id?: string
          nome_arquivo?: string
          tamanho?: number | null
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_arquivos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_arquivos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_interacoes: {
        Row: {
          cliente_id: string
          created_at: string
          descricao: string | null
          id: string
          tipo: string | null
          usuario_id: string | null
        }
        Insert: {
          cliente_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string | null
          usuario_id?: string | null
        }
        Update: {
          cliente_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          tipo?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_interacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_itens: {
        Row: {
          cliente_id: string
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          orcamento_id: string | null
          preco_custo: number | null
          preco_venda: number | null
          produto_id: string | null
          quantidade: number | null
          rt_comissao: number | null
          rt_percentual: number
          rt_tipo: string
          rt_valor_pago: number
          status_compra: string
          tipo: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          descricao: string
          empresa_id: string
          id?: string
          orcamento_id?: string | null
          preco_custo?: number | null
          preco_venda?: number | null
          produto_id?: string | null
          quantidade?: number | null
          rt_comissao?: number | null
          rt_percentual?: number
          rt_tipo?: string
          rt_valor_pago?: number
          status_compra?: string
          tipo?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          orcamento_id?: string | null
          preco_custo?: number | null
          preco_venda?: number | null
          produto_id?: string | null
          quantidade?: number | null
          rt_comissao?: number | null
          rt_percentual?: number
          rt_tipo?: string
          rt_valor_pago?: number
          status_compra?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_itens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "crm_orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_orcamentos: {
        Row: {
          aprovado: boolean
          cliente_id: string | null
          cliente_nome_avulso: string | null
          cliente_telefone_avulso: string | null
          created_at: string
          data_envio_proposta: string | null
          data_pagamento_avista: string | null
          empresa_id: string
          frete: number | null
          frete_outro: string | null
          frete_tipo: string | null
          frete_vencimento: string | null
          id: string
          imposto: number | null
          imposto_vencimento: string | null
          is_avulso: boolean
          nome: string
          simulacao_pagamento: Json | null
          tecnico_id: string | null
          tecnico_rt_valor: number | null
          tecnico_rt_vencimento: string | null
        }
        Insert: {
          aprovado?: boolean
          cliente_id?: string | null
          cliente_nome_avulso?: string | null
          cliente_telefone_avulso?: string | null
          created_at?: string
          data_envio_proposta?: string | null
          data_pagamento_avista?: string | null
          empresa_id: string
          frete?: number | null
          frete_outro?: string | null
          frete_tipo?: string | null
          frete_vencimento?: string | null
          id?: string
          imposto?: number | null
          imposto_vencimento?: string | null
          is_avulso?: boolean
          nome?: string
          simulacao_pagamento?: Json | null
          tecnico_id?: string | null
          tecnico_rt_valor?: number | null
          tecnico_rt_vencimento?: string | null
        }
        Update: {
          aprovado?: boolean
          cliente_id?: string | null
          cliente_nome_avulso?: string | null
          cliente_telefone_avulso?: string | null
          created_at?: string
          data_envio_proposta?: string | null
          data_pagamento_avista?: string | null
          empresa_id?: string
          frete?: number | null
          frete_outro?: string | null
          frete_tipo?: string | null
          frete_vencimento?: string | null
          id?: string
          imposto?: number | null
          imposto_vencimento?: string | null
          is_avulso?: boolean
          nome?: string
          simulacao_pagamento?: Json | null
          tecnico_id?: string | null
          tecnico_rt_valor?: number | null
          tecnico_rt_vencimento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_orcamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          nome: string
          nome_fantasia: string | null
          segmento: string | null
          telefone: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          nome_fantasia?: string | null
          segmento?: string | null
          telefone?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          nome_fantasia?: string | null
          segmento?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      equipe: {
        Row: {
          contato: string | null
          created_at: string
          deletado: boolean
          empresa_id: string
          funcao: string | null
          id: string
          nome: string
        }
        Insert: {
          contato?: string | null
          created_at?: string
          deletado?: boolean
          empresa_id: string
          funcao?: string | null
          id?: string
          nome: string
        }
        Update: {
          contato?: string | null
          created_at?: string
          deletado?: boolean
          empresa_id?: string
          funcao?: string | null
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipe_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      estoque_itens: {
        Row: {
          compra_id: string | null
          created_at: string
          empresa_id: string
          id: string
          localizacao: string | null
          numero_serie: string | null
          produto_id: string
          projeto_id: string | null
          status: Database["public"]["Enums"]["status_estoque"] | null
        }
        Insert: {
          compra_id?: string | null
          created_at?: string
          empresa_id: string
          id?: string
          localizacao?: string | null
          numero_serie?: string | null
          produto_id: string
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_estoque"] | null
        }
        Update: {
          compra_id?: string | null
          created_at?: string
          empresa_id?: string
          id?: string
          localizacao?: string | null
          numero_serie?: string | null
          produto_id?: string
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_estoque"] | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_itens_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_itens_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      financas_pessoais: {
        Row: {
          categoria: string | null
          created_at: string
          data: string | null
          descricao: string | null
          empresa_id: string
          id: string
          tipo: Database["public"]["Enums"]["tipo_financa_pessoal"] | null
          usuario_id: string
          valor: number | null
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          data?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_financa_pessoal"] | null
          usuario_id: string
          valor?: number | null
        }
        Update: {
          categoria?: string | null
          created_at?: string
          data?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_financa_pessoal"] | null
          usuario_id?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financas_pessoais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_pagar: {
        Row: {
          arquivo_nome: string | null
          arquivo_url: string | null
          categoria_id: string | null
          comissao_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          deletado: boolean
          descricao: string | null
          empresa_id: string
          fornecedor_id: string | null
          id: string
          observacao: string | null
          origem: string | null
          projeto_id: string | null
          status: Database["public"]["Enums"]["status_financeiro"] | null
          tipo_manual: string | null
          valor: number | null
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          categoria_id?: string | null
          comissao_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id: string
          fornecedor_id?: string | null
          id?: string
          observacao?: string | null
          origem?: string | null
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          tipo_manual?: string | null
          valor?: number | null
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_url?: string | null
          categoria_id?: string | null
          comissao_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id?: string
          fornecedor_id?: string | null
          id?: string
          observacao?: string | null
          origem?: string | null
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          tipo_manual?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_pagar_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_pagar_comissao_id_fkey"
            columns: ["comissao_id"]
            isOneToOne: false
            referencedRelation: "comissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_pagar_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_pagar_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_pagar_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_receber: {
        Row: {
          cliente_id: string | null
          created_at: string
          data_recebimento: string | null
          data_vencimento: string | null
          deletado: boolean
          descricao: string | null
          empresa_id: string
          id: string
          parcela: number | null
          projeto_id: string | null
          status: Database["public"]["Enums"]["status_financeiro"] | null
          valor: number | null
          valor_recebido: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          data_vencimento?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id: string
          id?: string
          parcela?: number | null
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          valor?: number | null
          valor_recebido?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          data_vencimento?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id?: string
          id?: string
          parcela?: number | null
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          valor?: number | null
          valor_recebido?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_receber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_receber_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_receber_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      formas_pagamento: {
        Row: {
          ativo: boolean | null
          created_at: string
          empresa_id: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "formas_pagamento_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      formulario_tokens: {
        Row: {
          cliente_id: string | null
          created_at: string
          dados_preenchidos: Json | null
          empresa_id: string
          id: string
          orcamento_id: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          dados_preenchidos?: Json | null
          empresa_id: string
          id?: string
          orcamento_id?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          dados_preenchidos?: Json | null
          empresa_id?: string
          id?: string
          orcamento_id?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "formulario_tokens_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_tokens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formulario_tokens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "crm_orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      fornecedores: {
        Row: {
          ativo: boolean
          cidade: string | null
          cnpj_cpf: string | null
          created_at: string
          data_aniversario: string | null
          deletado: boolean
          email: string | null
          empresa_id: string
          id: string
          nome: string
          rt_percentual: number | null
          subtipo_parceiro: string | null
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_fornecedor"] | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          data_aniversario?: string | null
          deletado?: boolean
          email?: string | null
          empresa_id: string
          id?: string
          nome: string
          rt_percentual?: number | null
          subtipo_parceiro?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_fornecedor"] | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          cnpj_cpf?: string | null
          created_at?: string
          data_aniversario?: string | null
          deletado?: boolean
          email?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          rt_percentual?: number | null
          subtipo_parceiro?: string | null
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_fornecedor"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fornecedores_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      google_integrations: {
        Row: {
          access_token: string
          created_at: string
          expiry_date: string | null
          google_calendar_id: string | null
          id: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expiry_date?: string | null
          google_calendar_id?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expiry_date?: string | null
          google_calendar_id?: string | null
          id?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      historico_projeto: {
        Row: {
          created_at: string
          data: string
          id: string
          observacao: string | null
          projeto_id: string
          status: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          observacao?: string | null
          projeto_id: string
          status: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          observacao?: string | null
          projeto_id?: string
          status?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "historico_projeto_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      necessidades_compra: {
        Row: {
          compra_id: string | null
          created_at: string | null
          descricao: string | null
          empresa_id: string
          id: string
          produto_id: string | null
          projeto_id: string
          projeto_item_id: string | null
          quantidade: number | null
          status: string | null
        }
        Insert: {
          compra_id?: string | null
          created_at?: string | null
          descricao?: string | null
          empresa_id: string
          id?: string
          produto_id?: string | null
          projeto_id: string
          projeto_item_id?: string | null
          quantidade?: number | null
          status?: string | null
        }
        Update: {
          compra_id?: string | null
          created_at?: string | null
          descricao?: string | null
          empresa_id?: string
          id?: string
          produto_id?: string | null
          projeto_id?: string
          projeto_item_id?: string | null
          quantidade?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "necessidades_compra_compra_id_fkey"
            columns: ["compra_id"]
            isOneToOne: false
            referencedRelation: "compras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "necessidades_compra_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "necessidades_compra_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "necessidades_compra_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "necessidades_compra_projeto_item_id_fkey"
            columns: ["projeto_item_id"]
            isOneToOne: false
            referencedRelation: "projeto_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          data: string
          empresa_id: string
          id: string
          lida: boolean
          mensagem: string
          parceiro_id: string
          projeto_id: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          data?: string
          empresa_id: string
          id?: string
          lida?: boolean
          mensagem: string
          parceiro_id: string
          projeto_id?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          created_at?: string
          data?: string
          empresa_id?: string
          id?: string
          lida?: boolean
          mensagem?: string
          parceiro_id?: string
          projeto_id?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      pagamentos_rt: {
        Row: {
          created_at: string
          data: string
          empresa_id: string
          id: string
          observacao: string | null
          parceiro_id: string
          projeto_id: string
          projeto_parceiro_id: string
          usuario_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          empresa_id: string
          id?: string
          observacao?: string | null
          parceiro_id: string
          projeto_id: string
          projeto_parceiro_id: string
          usuario_id?: string | null
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          empresa_id?: string
          id?: string
          observacao?: string | null
          parceiro_id?: string
          projeto_id?: string
          projeto_parceiro_id?: string
          usuario_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_rt_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_rt_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_rt_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_rt_projeto_parceiro_id_fkey"
            columns: ["projeto_parceiro_id"]
            isOneToOne: false
            referencedRelation: "projeto_parceiros"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_tecnico: {
        Row: {
          cliente_id: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          projeto_id: string
          tecnico_id: string
          updated_at: string
          valor_combinado: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          projeto_id: string
          tecnico_id: string
          updated_at?: string
          valor_combinado?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          projeto_id?: string
          tecnico_id?: string
          updated_at?: string
          valor_combinado?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_tecnico_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_tecnico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_tecnico_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_tecnico_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      pagamentos_tecnico_lancamentos: {
        Row: {
          created_at: string
          data_pagamento: string
          data_prevista: string | null
          empresa_id: string
          id: string
          mes_referencia: string | null
          observacao: string | null
          projeto_id: string | null
          tecnico_id: string
          tipo: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          data_pagamento?: string
          data_prevista?: string | null
          empresa_id: string
          id?: string
          mes_referencia?: string | null
          observacao?: string | null
          projeto_id?: string | null
          tecnico_id: string
          tipo?: string | null
          valor?: number
        }
        Update: {
          created_at?: string
          data_pagamento?: string
          data_prevista?: string | null
          empresa_id?: string
          id?: string
          mes_referencia?: string | null
          observacao?: string | null
          projeto_id?: string | null
          tecnico_id?: string
          tipo?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_tecnico_lancamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_tecnico_lancamentos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pagamentos_tecnico_lancamentos_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      parcelas_parceiros: {
        Row: {
          created_at: string | null
          data_pagamento: string | null
          data_vencimento: string | null
          descricao: string | null
          empresa_id: string | null
          id: string
          orcamento_id: string | null
          parceiro_id: string | null
          parceiro_nome: string | null
          projeto_id: string | null
          status: string | null
          tipo_parceiro: string | null
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          orcamento_id?: string | null
          parceiro_id?: string | null
          parceiro_nome?: string | null
          projeto_id?: string | null
          status?: string | null
          tipo_parceiro?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          created_at?: string | null
          data_pagamento?: string | null
          data_vencimento?: string | null
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          orcamento_id?: string | null
          parceiro_id?: string | null
          parceiro_nome?: string | null
          projeto_id?: string | null
          status?: string | null
          tipo_parceiro?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parcelas_parceiros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_parceiros_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "crm_orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_parceiros_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcelas_parceiros_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          categoria: string | null
          codigo: string | null
          cor: string | null
          created_at: string
          deletado: boolean
          empresa_id: string
          estoque_minimo: number | null
          fornecedor_id: string | null
          id: string
          marca: string | null
          nome: string
          preco_custo: number | null
          preco_venda: number | null
          unidade: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          codigo?: string | null
          cor?: string | null
          created_at?: string
          deletado?: boolean
          empresa_id: string
          estoque_minimo?: number | null
          fornecedor_id?: string | null
          id?: string
          marca?: string | null
          nome: string
          preco_custo?: number | null
          preco_venda?: number | null
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          codigo?: string | null
          cor?: string | null
          created_at?: string
          deletado?: boolean
          empresa_id?: string
          estoque_minimo?: number | null
          fornecedor_id?: string | null
          id?: string
          marca?: string | null
          nome?: string
          preco_custo?: number | null
          preco_venda?: number | null
          unidade?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          empresa_id: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          empresa_id?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_itens: {
        Row: {
          created_at: string
          descricao: string | null
          id: string
          preco_custo: number | null
          preco_venda: number | null
          produto_id: string | null
          projeto_id: string
          quantidade: number | null
          rt_percentual: number | null
          tipo: Database["public"]["Enums"]["tipo_projeto_item"] | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: string
          preco_custo?: number | null
          preco_venda?: number | null
          produto_id?: string | null
          projeto_id: string
          quantidade?: number | null
          rt_percentual?: number | null
          tipo?: Database["public"]["Enums"]["tipo_projeto_item"] | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: string
          preco_custo?: number | null
          preco_venda?: number | null
          produto_id?: string | null
          projeto_id?: string
          quantidade?: number | null
          rt_percentual?: number | null
          tipo?: Database["public"]["Enums"]["tipo_projeto_item"] | null
        }
        Relationships: [
          {
            foreignKeyName: "projeto_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_itens_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projeto_parceiros: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          parceiro_id: string
          projeto_id: string
          rt_base: string
          rt_percentual: number
          rt_recebido: number
          rt_tipo: string
          rt_total: number
          rt_valor: number
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          parceiro_id: string
          projeto_id: string
          rt_base?: string
          rt_percentual?: number
          rt_recebido?: number
          rt_tipo?: string
          rt_total?: number
          rt_valor?: number
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          parceiro_id?: string
          projeto_id?: string
          rt_base?: string
          rt_percentual?: number
          rt_recebido?: number
          rt_tipo?: string
          rt_total?: number
          rt_valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "projeto_parceiros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_parceiros_parceiro_id_fkey"
            columns: ["parceiro_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projeto_parceiros_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      projetos: {
        Row: {
          arquiteto_id: string | null
          cliente_id: string | null
          created_at: string
          custo_previsto: number | null
          custo_real: number | null
          data_inicio: string | null
          data_previsao: string | null
          deletado: boolean
          descricao: string | null
          empresa_id: string
          endereco_obra: string | null
          entrada_recebida: boolean | null
          forma_pagamento: string | null
          id: string
          lucro_real: number | null
          margem_prevista: number | null
          nome: string
          numero_parcelas: number | null
          observacoes_pagamento: string | null
          orcamento_id: string | null
          status: Database["public"]["Enums"]["status_projeto"] | null
          updated_at: string
          venda_total: number | null
        }
        Insert: {
          arquiteto_id?: string | null
          cliente_id?: string | null
          created_at?: string
          custo_previsto?: number | null
          custo_real?: number | null
          data_inicio?: string | null
          data_previsao?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id: string
          endereco_obra?: string | null
          entrada_recebida?: boolean | null
          forma_pagamento?: string | null
          id?: string
          lucro_real?: number | null
          margem_prevista?: number | null
          nome: string
          numero_parcelas?: number | null
          observacoes_pagamento?: string | null
          orcamento_id?: string | null
          status?: Database["public"]["Enums"]["status_projeto"] | null
          updated_at?: string
          venda_total?: number | null
        }
        Update: {
          arquiteto_id?: string | null
          cliente_id?: string | null
          created_at?: string
          custo_previsto?: number | null
          custo_real?: number | null
          data_inicio?: string | null
          data_previsao?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id?: string
          endereco_obra?: string | null
          entrada_recebida?: boolean | null
          forma_pagamento?: string | null
          id?: string
          lucro_real?: number | null
          margem_prevista?: number | null
          nome?: string
          numero_parcelas?: number | null
          observacoes_pagamento?: string | null
          orcamento_id?: string | null
          status?: Database["public"]["Enums"]["status_projeto"] | null
          updated_at?: string
          venda_total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projetos_arquiteto_id_fkey"
            columns: ["arquiteto_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projetos_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "crm_orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos_parciais: {
        Row: {
          created_at: string
          data: string
          empresa_id: string
          financeiro_receber_id: string
          id: string
          observacao: string | null
          usuario_id: string | null
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          empresa_id: string
          financeiro_receber_id: string
          id?: string
          observacao?: string | null
          usuario_id?: string | null
          valor?: number
        }
        Update: {
          created_at?: string
          data?: string
          empresa_id?: string
          financeiro_receber_id?: string
          id?: string
          observacao?: string | null
          usuario_id?: string | null
          valor?: number
        }
        Relationships: []
      }
      transportadoras: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          nome: string
          tipo?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "transportadoras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_view: boolean
          created_at: string
          empresa_id: string
          id: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          empresa_id: string
          id?: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          empresa_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          empresa_id: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      visitas_tecnicas: {
        Row: {
          created_at: string
          data: string | null
          data_pagamento: string | null
          deletado: boolean
          descricao: string | null
          empresa_id: string
          google_event_id: string | null
          hora: string | null
          id: string
          produtos_levados: Json | null
          projeto_id: string
          servicos_executados: string | null
          status_pagamento: string | null
          status_visita: string
          tecnico_id: string | null
          valor_pago_tecnico: number | null
        }
        Insert: {
          created_at?: string
          data?: string | null
          data_pagamento?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id: string
          google_event_id?: string | null
          hora?: string | null
          id?: string
          produtos_levados?: Json | null
          projeto_id: string
          servicos_executados?: string | null
          status_pagamento?: string | null
          status_visita?: string
          tecnico_id?: string | null
          valor_pago_tecnico?: number | null
        }
        Update: {
          created_at?: string
          data?: string | null
          data_pagamento?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id?: string
          google_event_id?: string | null
          hora?: string | null
          id?: string
          produtos_levados?: Json | null
          projeto_id?: string
          servicos_executados?: string | null
          status_pagamento?: string | null
          status_visita?: string
          tecnico_id?: string | null
          valor_pago_tecnico?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "visitas_tecnicas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_tecnicas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitas_tecnicas_tecnico_id_fkey"
            columns: ["tecnico_id"]
            isOneToOne: false
            referencedRelation: "fornecedores"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_logs: {
        Row: {
          created_at: string
          data: string
          empresa_id: string
          erro: string | null
          id: string
          mensagem: string
          pagamento_rt_id: string | null
          parceiro_id: string
          provider: string | null
          status: string
          telefone: string | null
        }
        Insert: {
          created_at?: string
          data?: string
          empresa_id: string
          erro?: string | null
          id?: string
          mensagem: string
          pagamento_rt_id?: string | null
          parceiro_id: string
          provider?: string | null
          status?: string
          telefone?: string | null
        }
        Update: {
          created_at?: string
          data?: string
          empresa_id?: string
          erro?: string | null
          id?: string
          mensagem?: string
          pagamento_rt_id?: string | null
          parceiro_id?: string
          provider?: string | null
          status?: string
          telefone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calcular_rt_projeto_parceiro: {
        Args: { _pp_id: string }
        Returns: undefined
      }
      format_whatsapp_rt_message: {
        Args: {
          _data: string
          _parceiro_nome: string
          _projeto_nome: string
          _valor: number
        }
        Returns: string
      }
      get_empresa_id: { Args: { _user_id: string }; Returns: string }
      get_fornecedor_id_by_email: { Args: { _email: string }; Returns: string }
      get_parceiro_fornecedor_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      recalc_rt_recebido: { Args: { _pp_id: string }; Returns: undefined }
    }
    Enums: {
      acao_audit: "criacao" | "edicao" | "exclusao"
      app_role:
        | "admin"
        | "administrativo"
        | "financeiro"
        | "tecnico"
        | "arquiteto"
        | "cliente"
        | "operacional"
        | "comercial"
        | "funcionario"
        | "parceiro"
      origem_lead:
        | "whatsapp"
        | "instagram"
        | "indicacao"
        | "outro"
        | "arquiteto"
      status_comissao: "pendente" | "pago"
      status_compra:
        | "pendente"
        | "aprovada"
        | "entregue"
        | "cancelada"
        | "em_compra"
        | "comprado"
        | "instalado"
      status_crm: "lead" | "contato" | "proposta" | "projeto" | "concluido"
      status_estoque: "disponivel" | "reservado" | "instalado"
      status_financeiro:
        | "pendente"
        | "pago"
        | "vencido"
        | "cancelado"
        | "parcial"
      status_projeto:
        | "orcamento"
        | "aprovado"
        | "em_andamento"
        | "concluido"
        | "cancelado"
        | "lead"
        | "proposta"
        | "vendido"
        | "pos_venda"
        | "infraestrutura"
        | "instalacao"
        | "cabeamento"
        | "programacao"
        | "personalizacao"
        | "em_pausa"
      tipo_financa_pessoal: "retirada" | "devolucao" | "despesa" | "receita"
      tipo_fornecedor: "fornecedor" | "arquiteto" | "tecnico"
      tipo_projeto_item: "produto" | "servico" | "mao_de_obra" | "adicional"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acao_audit: ["criacao", "edicao", "exclusao"],
      app_role: [
        "admin",
        "administrativo",
        "financeiro",
        "tecnico",
        "arquiteto",
        "cliente",
        "operacional",
        "comercial",
        "funcionario",
        "parceiro",
      ],
      origem_lead: ["whatsapp", "instagram", "indicacao", "outro", "arquiteto"],
      status_comissao: ["pendente", "pago"],
      status_compra: [
        "pendente",
        "aprovada",
        "entregue",
        "cancelada",
        "em_compra",
        "comprado",
        "instalado",
      ],
      status_crm: ["lead", "contato", "proposta", "projeto", "concluido"],
      status_estoque: ["disponivel", "reservado", "instalado"],
      status_financeiro: [
        "pendente",
        "pago",
        "vencido",
        "cancelado",
        "parcial",
      ],
      status_projeto: [
        "orcamento",
        "aprovado",
        "em_andamento",
        "concluido",
        "cancelado",
        "lead",
        "proposta",
        "vendido",
        "pos_venda",
        "infraestrutura",
        "instalacao",
        "cabeamento",
        "programacao",
        "personalizacao",
        "em_pausa",
      ],
      tipo_financa_pessoal: ["retirada", "devolucao", "despesa", "receita"],
      tipo_fornecedor: ["fornecedor", "arquiteto", "tecnico"],
      tipo_projeto_item: ["produto", "servico", "mao_de_obra", "adicional"],
    },
  },
} as const
