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
          observacao: string | null
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
          observacao?: string | null
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
          observacao?: string | null
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
          cliente_id: string
          created_at: string
          data_envio_proposta: string | null
          data_pagamento_avista: string | null
          empresa_id: string
          id: string
          nome: string
          simulacao_pagamento: Json | null
        }
        Insert: {
          aprovado?: boolean
          cliente_id: string
          created_at?: string
          data_envio_proposta?: string | null
          data_pagamento_avista?: string | null
          empresa_id: string
          id?: string
          nome?: string
          simulacao_pagamento?: Json | null
        }
        Update: {
          aprovado?: boolean
          cliente_id?: string
          created_at?: string
          data_envio_proposta?: string | null
          data_pagamento_avista?: string | null
          empresa_id?: string
          id?: string
          nome?: string
          simulacao_pagamento?: Json | null
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
          id: string
          nome: string
          nome_fantasia: string | null
          segmento: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          nome_fantasia?: string | null
          segmento?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          nome_fantasia?: string | null
          segmento?: string | null
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
          comissao_id: string | null
          created_at: string
          data_pagamento: string | null
          data_vencimento: string | null
          deletado: boolean
          descricao: string | null
          empresa_id: string
          fornecedor_id: string | null
          id: string
          projeto_id: string | null
          status: Database["public"]["Enums"]["status_financeiro"] | null
          valor: number | null
        }
        Insert: {
          comissao_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id: string
          fornecedor_id?: string | null
          id?: string
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          valor?: number | null
        }
        Update: {
          comissao_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id?: string
          fornecedor_id?: string | null
          id?: string
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          valor?: number | null
        }
        Relationships: [
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
          data_pagamento: string | null
          data_vencimento: string | null
          deletado: boolean
          descricao: string | null
          empresa_id: string
          id: string
          parcela: number | null
          projeto_id: string | null
          status: Database["public"]["Enums"]["status_financeiro"] | null
          valor: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id: string
          id?: string
          parcela?: number | null
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          valor?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string | null
          deletado?: boolean
          descricao?: string | null
          empresa_id?: string
          id?: string
          parcela?: number | null
          projeto_id?: string | null
          status?: Database["public"]["Enums"]["status_financeiro"] | null
          valor?: number | null
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
      fornecedores: {
        Row: {
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
          telefone: string | null
          tipo: Database["public"]["Enums"]["tipo_fornecedor"] | null
          updated_at: string
        }
        Insert: {
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
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["tipo_fornecedor"] | null
          updated_at?: string
        }
        Update: {
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
      produtos: {
        Row: {
          categoria: string | null
          codigo: string | null
          created_at: string
          deletado: boolean
          empresa_id: string
          estoque_minimo: number | null
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
          created_at?: string
          deletado?: boolean
          empresa_id: string
          estoque_minimo?: number | null
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
          created_at?: string
          deletado?: boolean
          empresa_id?: string
          estoque_minimo?: number | null
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
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          empresa_id: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          empresa_id?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          empresa_id?: string | null
          full_name?: string | null
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_empresa_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
      origem_lead:
        | "whatsapp"
        | "instagram"
        | "indicacao"
        | "outro"
        | "arquiteto"
      status_comissao: "pendente" | "pago"
      status_compra: "pendente" | "aprovada" | "entregue" | "cancelada"
      status_crm: "lead" | "contato" | "proposta" | "projeto"
      status_estoque: "disponivel" | "reservado" | "instalado"
      status_financeiro: "pendente" | "pago" | "vencido" | "cancelado"
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
      tipo_fornecedor: "fornecedor" | "arquiteto"
      tipo_projeto_item: "produto" | "servico" | "mao_de_obra"
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
      ],
      origem_lead: ["whatsapp", "instagram", "indicacao", "outro", "arquiteto"],
      status_comissao: ["pendente", "pago"],
      status_compra: ["pendente", "aprovada", "entregue", "cancelada"],
      status_crm: ["lead", "contato", "proposta", "projeto"],
      status_estoque: ["disponivel", "reservado", "instalado"],
      status_financeiro: ["pendente", "pago", "vencido", "cancelado"],
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
      tipo_fornecedor: ["fornecedor", "arquiteto"],
      tipo_projeto_item: ["produto", "servico", "mao_de_obra"],
    },
  },
} as const
