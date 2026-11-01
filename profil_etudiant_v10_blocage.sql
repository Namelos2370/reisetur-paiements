-- v10 : blocage des résultats d'un étudiant (frais dus non payés)
alter table etudiants add column if not exists resultats_bloques boolean not null default false;

-- Takam Andy : résultats et notes bloqués (rattrapage non payé)
update etudiants set resultats_bloques = true where matricule = 'M237-26-008';

-- Espace étudiant : quand les résultats sont bloqués, ni notes, ni modules, ni mention ne sont envoyés au navigateur
do $$
declare d text;
begin
  d := pg_get_functiondef('public.ma_situation(text,text)'::regprocedure);
  if position('resultats_bloques' in d) = 0 then
    d := replace(d, '''resultats'', res,',
      '''resultats'', case when coalesce(e.resultats_bloques, false) then coalesce((select jsonb_agg(jsonb_build_object(''niveau'', x->>''niveau'', ''date_examen'', x->''date_examen'', ''statut'', ''bloque'')) from jsonb_array_elements(res) x), ''[]''::jsonb) else res end, ''resultats_bloques'', coalesce(e.resultats_bloques, false),');
    execute d;
  end if;
end $$;
