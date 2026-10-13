import { supabase } from "@/integrations/supabase/client";
import { parseStorageUrl } from "@/lib/storageUrl";

/**
 * Exclui um arquivo do CRM por completo: o registro (crm_arquivos) e o arquivo na pasta.
 * Antes, as telas apagavam só o registro e o arquivo ficava guardado sem dono (13/10/2026).
 * Se a pasta recusar (ex.: arquivo enviado por outra pessoa), o registro já saiu da lista.
 */
export async function excluirArquivoCrm(id: string): Promise<void> {
  const { data: arq } = await supabase.from("crm_arquivos").select("url").eq("id", id).maybeSingle();
  const { error } = await supabase.from("crm_arquivos").delete().eq("id", id);
  if (error) throw error;
  const alvo = parseStorageUrl((arq as { url?: string | null } | null)?.url);
  if (alvo) await supabase.storage.from(alvo.bucket).remove([alvo.path]);
}
