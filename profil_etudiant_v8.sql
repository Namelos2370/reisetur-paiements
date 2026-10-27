-- v8 : détail des modules d'examen + résultats corrects de l'Abschluss A1 Clausthal (25.10.2026)
alter table resultats add column if not exists modules jsonb;

-- Résultats (seuils : module validé dès 50 %, niveau validé dès 60 % du total sur 80)
update resultats r set date_examen = date '2026-10-25', note = v.note, mention = v.mention, statut = v.statut, modules = v.modules::jsonb
from (values
 ('M237-26-002', 61.5, 'Gut',          'reussi', '[{"m":"Lesen","pts":11,"max":15},{"m":"Hören","pts":7,"max":15},{"m":"Schreiben","pts":18,"max":20},{"m":"Sprechen","pts":25.5,"max":30}]'),
 ('M237-26-006', 49,   'Befriedigend', 'reussi', '[{"m":"Lesen","pts":9,"max":15},{"m":"Hören","pts":4,"max":15},{"m":"Schreiben","pts":18,"max":20},{"m":"Sprechen","pts":18,"max":30}]'),
 ('M237-26-008', 48,   'Befriedigend', 'reussi', '[{"m":"Lesen","pts":9,"max":15},{"m":"Hören","pts":5,"max":15},{"m":"Schreiben","pts":17,"max":20},{"m":"Sprechen","pts":17,"max":30}]'),
 ('M237-26-007', 45,   'Ungenügend',   'echec',  '[{"m":"Lesen","pts":6,"max":15},{"m":"Hören","pts":6,"max":15},{"m":"Schreiben","pts":15,"max":20},{"m":"Sprechen","pts":18,"max":30}]'),
 ('M237-26-005', 42.5, 'Ungenügend',   'echec',  '[{"m":"Lesen","pts":5,"max":15},{"m":"Hören","pts":6,"max":15},{"m":"Schreiben","pts":15,"max":20},{"m":"Sprechen","pts":18,"max":30}]'),
 ('M237-26-001', 42.5, 'Ungenügend',   'echec',  '[{"m":"Lesen","pts":7,"max":15},{"m":"Hören","pts":7,"max":15},{"m":"Schreiben","pts":14.5,"max":20},{"m":"Sprechen","pts":14,"max":30}]'),
 ('M237-26-004', 41,   'Ungenügend',   'echec',  '[{"m":"Lesen","pts":6,"max":15},{"m":"Hören","pts":8,"max":15},{"m":"Schreiben","pts":13,"max":20},{"m":"Sprechen","pts":15,"max":30}]'),
 ('M237-26-003', 39,   'Ungenügend',   'echec',  '[{"m":"Lesen","pts":5,"max":15},{"m":"Hören","pts":6,"max":15},{"m":"Schreiben","pts":13,"max":20},{"m":"Sprechen","pts":15,"max":30}]')
) as v(matricule, note, mention, statut, modules)
where r.niveau = 'A1' and r.etudiant_id = (select id from etudiants where matricule = v.matricule);

-- L'espace étudiant reçoit aussi le détail des modules
create or replace function public.ma_situation(p_matricule text, p_code text)
 returns jsonb language plpgsql security definer set search_path to 'public'
as $function$
declare m text := upper(trim(coalesce(p_matricule, ''))); c text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  t record; e record; fr jsonb; rc jsonb; an jsonb; cal jsonb; par jsonb; res jsonb; docs jsonb; reste int; att int;
begin
  if m !~ '^M237-[0-9]{2}-[0-9]{3}$' then return jsonb_build_object('ok', false, 'raison', 'invalide'); end if;
  select * into t from tentatives_acces where matricule = m;
  if t.bloque_jusqua is not null and t.bloque_jusqua > now() then
    return jsonb_build_object('ok', false, 'raison', 'bloque', 'minutes', ceil(extract(epoch from (t.bloque_jusqua - now())) / 60));
  end if;
  select * into e from etudiants where matricule = m;
  if e.id is null or e.code_acces <> c then
    insert into tentatives_acces(matricule, echecs) values (m, 1) on conflict (matricule) do update set echecs = tentatives_acces.echecs + 1;
    update tentatives_acces set bloque_jusqua = now() + interval '15 minutes', echecs = 0 where matricule = m and echecs >= 5;
    return jsonb_build_object('ok', false, 'raison', 'invalide');
  end if;
  delete from tentatives_acces where matricule = m;

  select coalesce(jsonb_agg(jsonb_build_object('type', v.type, 'numero', v.numero, 'niveau', v.niveau, 'montant_du', v.montant_du,
           'paye', v.paye, 'a_valider', v.a_valider, 'date_limite', v.date_limite) order by v.frais_id, v.numero), '[]'::jsonb),
         coalesce(sum(v.solde - v.a_valider) filter (where v.solde - v.a_valider > 0), 0),
         coalesce(sum(v.a_valider), 0)
    into fr, reste, att from v_tranches v where v.etudiant_id = e.id;

  select coalesce(jsonb_agg(jsonb_build_object('numero_recu', c2.numero_recu, 'date', c2.date_paiement, 'montant', c2.montant,
           'type', f.type, 'tranche', t2.numero, 'reference_banque', c2.reference_banque, 'mode_paiement', c2.mode_paiement,
           'niveau', coalesce(f.niveau, e.niveau), 'classe', coalesce(f.classe, e.classe),
           'reste', (select vf.solde from v_frais vf where vf.id = f.id)) order by c2.date_paiement desc, c2.created_at desc), '[]'::jsonb)
    into rc from encaissements c2 join tranches t2 on t2.id = c2.tranche_id join frais f on f.id = t2.frais_id
    where f.etudiant_id = e.id and c2.statut = 'valide';

  select to_jsonb(k) into cal from (select debut, fin, examen, horaires, salle, formateur from classes_infos where classe = e.classe) k;

  select coalesce(jsonb_agg(jsonb_build_object('niveau', p.niveau, 'classe', p.classe, 'debut', p.date_debut, 'fin', p.date_fin) order by p.date_debut nulls first), '[]'::jsonb)
    into par from parcours p where p.etudiant_id = e.id;

  select coalesce(jsonb_agg(jsonb_build_object('niveau', r.niveau, 'date_examen', r.date_examen, 'note', r.note, 'mention', r.mention, 'statut', r.statut, 'modules', r.modules)
           order by r.date_examen nulls last, r.created_at), '[]'::jsonb)
    into res from resultats r where r.etudiant_id = e.id;

  select coalesce(jsonb_agg(jsonb_build_object('titre', d.titre, 'url', d.url, 'classe', d.classe) order by d.created_at desc), '[]'::jsonb)
    into docs from documents d where d.actif and (d.classe is null or d.classe = e.classe);

  select coalesce(jsonb_agg(jsonb_build_object('titre', a.titre, 'message', a.message, 'date', a.created_at::date, 'date_evenement', a.date_evenement, 'classe', a.classe)
           order by a.date_evenement asc nulls last, a.created_at desc), '[]'::jsonb)
    into an from (select * from annonces where actif and (expire_le is null and date_evenement is null or coalesce(expire_le, date_evenement) >= current_date)
                  and (classe is null or classe = e.classe) order by date_evenement asc nulls last, created_at desc limit 10) a;

  return jsonb_build_object('ok', true, 'ecole', ecole_nom(), 'nom', e.nom, 'matricule', e.matricule, 'classe', e.classe, 'niveau', e.niveau,
    'tranches', fr, 'recus', rc, 'reste', reste, 'en_verification', att, 'calendrier', cal, 'annonces', an,
    'parcours', par, 'resultats', res, 'documents', docs, 'telephone', e.telephone, 'email', e.email, 'ville', e.ville);
end $function$;
