-- Frais de rattrapage de Takam Andy (M237-26-008) : 10 000 FCFA, un seul versement.
-- À lancer APRÈS profil_etudiant_v10_blocage.sql (qui autorise le type « rattrapage »).
with e as (select id from etudiants where matricule = 'M237-26-008'),
f as (
  insert into frais (etudiant_id, type, montant_total)
  select id, 'rattrapage', 10000 from e
  where not exists (select 1 from frais x where x.etudiant_id = e.id and x.type = 'rattrapage')
  returning id
)
insert into tranches (frais_id, numero, montant_du, date_limite)
select id, 1, 10000, date '2026-11-08' from f;
