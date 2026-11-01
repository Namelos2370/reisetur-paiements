-- v10 : blocage des résultats tant qu'il reste des frais dus + frais de rattrapage
alter table etudiants add column if not exists resultats_bloques boolean not null default false;

-- Nouveau type de frais : rattrapage (un seul versement)
alter table frais drop constraint if exists frais_type_check;
alter table frais add constraint frais_type_check check (type in ('inscription', 'scolarite', 'rattrapage'));

-- Takam Andy : résultats et notes bloqués tant que sa scolarité (20 000) et son rattrapage ne sont pas réglés
update etudiants set resultats_bloques = true where matricule = 'M237-26-008';

-- Espace étudiant : si les résultats sont bloqués ET qu'il reste quelque chose à payer, ni notes, ni modules, ni mention
-- ne sont envoyés au navigateur. Dès que tout est réglé (ou en attente de validation), les résultats se débloquent seuls.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.ma_situation(text,text)'::regprocedure);
  if position('resultats_bloques' in d) = 0 then
    d := replace(d, '''resultats'', res,',
      '''resultats'', case when (coalesce(e.resultats_bloques, false) and reste + att > 0) then coalesce((select jsonb_agg(jsonb_build_object(''niveau'', x->>''niveau'', ''date_examen'', x->''date_examen'', ''statut'', ''bloque'')) from jsonb_array_elements(res) x), ''[]''::jsonb) else res end, ''resultats_bloques'', (coalesce(e.resultats_bloques, false) and reste + att > 0),');
    execute d;
  end if;
end $$;
