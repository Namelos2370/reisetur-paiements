-- v11 : relevés DÉFINITIFS après rattrapage (01.11.2026) - A1 Clausthal. Remplace v9 : ne pas lancer v9.
-- Les points du rattrapage sont déjà fusionnés dans les modules (barème initial /15 /15 /20 /30), exactement comme sur les relevés officiels.
update resultats r set note = v.note, mention = v.mention, statut = v.statut, modules = v.modules::jsonb,
  releve = coalesce(r.releve, '{}'::jsonb) || jsonb_build_object('rang', v.rang, 'rattrapage', '01.11.2026')
from (values
  ('M237-26-002', 1, 65.5, 'Sehr gut', 'reussi', '[{"m": "Lesen", "pts": 11, "max": 15}, {"m": "Hören", "pts": 11, "max": 15}, {"m": "Schreiben", "pts": 18, "max": 20}, {"m": "Sprechen", "pts": 25.5, "max": 30}]'),
  ('M237-26-007', 2, 54, 'Gut', 'reussi', '[{"m": "Lesen", "pts": 10, "max": 15}, {"m": "Hören", "pts": 11, "max": 15}, {"m": "Schreiben", "pts": 15, "max": 20}, {"m": "Sprechen", "pts": 18, "max": 30}]'),
  ('M237-26-005', 3, 54, 'Gut', 'reussi', '[{"m": "Lesen", "pts": 10, "max": 15}, {"m": "Hören", "pts": 11, "max": 15}, {"m": "Schreiben", "pts": 15, "max": 20}, {"m": "Sprechen", "pts": 18, "max": 30}]'),
  ('M237-26-001', 4, 53.5, 'Gut', 'reussi', '[{"m": "Lesen", "pts": 10, "max": 15}, {"m": "Hören", "pts": 9, "max": 15}, {"m": "Schreiben", "pts": 14.5, "max": 20}, {"m": "Sprechen", "pts": 20, "max": 30}]'),
  ('M237-26-008', 5, 51, 'Befriedigend', 'reussi', '[{"m": "Lesen", "pts": 9, "max": 15}, {"m": "Hören", "pts": 8, "max": 15}, {"m": "Schreiben", "pts": 17, "max": 20}, {"m": "Sprechen", "pts": 17, "max": 30}]'),
  ('M237-26-006', 6, 49, 'Befriedigend', 'reussi', '[{"m": "Lesen", "pts": 9, "max": 15}, {"m": "Hören", "pts": 4, "max": 15}, {"m": "Schreiben", "pts": 18, "max": 20}, {"m": "Sprechen", "pts": 18, "max": 30}]'),
  ('M237-26-004', 7, 49, 'Befriedigend', 'reussi', '[{"m": "Lesen", "pts": 10, "max": 15}, {"m": "Hören", "pts": 11, "max": 15}, {"m": "Schreiben", "pts": 13, "max": 20}, {"m": "Sprechen", "pts": 15, "max": 30}]'),
  ('M237-26-032', 8, 47, 'Ausreichend', 'reussi', '[{"m": "Lesen", "pts": 8, "max": 15}, {"m": "Hören", "pts": 8, "max": 15}, {"m": "Schreiben", "pts": 14, "max": 20}, {"m": "Sprechen", "pts": 17, "max": 30}]'),
  ('M237-26-003', 9, 39, 'Ungenügend', 'echec', '[{"m": "Lesen", "pts": 5, "max": 15}, {"m": "Hören", "pts": 6, "max": 15}, {"m": "Schreiben", "pts": 13, "max": 20}, {"m": "Sprechen", "pts": 15, "max": 30}]')
) as v(matricule, rang, note, mention, statut, modules)
where r.niveau = 'A1' and r.etudiant_id = (select id from etudiants where matricule = v.matricule);
