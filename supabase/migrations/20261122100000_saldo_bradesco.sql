alter table public.empresas
  add column if not exists saldo_bradesco_pf numeric default 0,
  add column if not exists saldo_bradesco_pj numeric default 0;

notify pgrst, 'reload schema';
