-- Reisetür 237 — v7 : inscriptions publiques désactivées, suivi des rappels, journal des sauvegardes
-- À coller dans Supabase > SQL Editor > Run (une seule fois). Ne modifie aucune donnée existante.

-- 1) Inscriptions publiques désactivées : une fois l'administrateur créé, plus aucun compte ne peut être créé.
--    (Pour ajouter un second administrateur plus tard : supprimer temporairement ce déclencheur.)
create or replace function public.bloquer_inscriptions() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if exists (select 1 from public.admins) then
    raise exception 'Les inscriptions sont désactivées.';
  end if;
  return new;
end $$;
revoke all on function public.bloquer_inscriptions() from public, anon, authenticated;
drop trigger if exists bloquer_inscriptions on auth.users;
create trigger bloquer_inscriptions before insert on auth.users for each row execute function public.bloquer_inscriptions();

-- 2) Suivi des rappels envoyés (WhatsApp / note) pour la file « à relancer aujourd'hui »
create table if not exists public.rappels (
  id uuid primary key default gen_random_uuid(),
  etudiant_id uuid not null references public.etudiants(id) on delete cascade,
  canal text not null default 'whatsapp' check (canal in ('whatsapp', 'note')),
  created_at timestamptz not null default now()
);
create index if not exists rappels_etudiant_idx on public.rappels (etudiant_id, created_at desc);
alter table public.rappels enable row level security;
drop policy if exists rappels_admin on public.rappels;
create policy rappels_admin on public.rappels for all to authenticated using (is_admin()) with check (is_admin());

-- 3) Journal des sauvegardes (pour afficher « dernière sauvegarde » sur tous tes appareils)
create table if not exists public.sauvegardes (
  id uuid primary key default gen_random_uuid(),
  nb_lignes integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.sauvegardes enable row level security;
drop policy if exists sauvegardes_admin on public.sauvegardes;
create policy sauvegardes_admin on public.sauvegardes for all to authenticated using (is_admin()) with check (is_admin());
