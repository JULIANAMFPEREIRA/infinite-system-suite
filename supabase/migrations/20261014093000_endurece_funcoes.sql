-- C1 / etapa 1D: endurecimento das funções (avisos do verificador do Supabase)
-- search_path fixo evita que alguém troque o "caminho" de busca para enganar a função
alter function public.update_updated_at_column() set search_path = public;
alter function public.get_empresa_id(uuid) set search_path = public;
alter function public.has_role(uuid, public.app_role) set search_path = public;

-- ninguém sem login executa funções internas (o app não chama nenhuma delas diretamente)
revoke execute on function public.get_empresa_id(uuid) from public, anon;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.pci_aplica_recebimento() from public, anon;
revoke execute on function public.pci_valida_quantidade() from public, anon;
grant execute on function public.get_empresa_id(uuid), public.has_role(uuid, public.app_role),
  public.pci_aplica_recebimento(), public.pci_valida_quantidade() to authenticated;
