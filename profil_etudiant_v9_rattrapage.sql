-- v9 : résultats du rattrapage du 01.11.2026 (A1 Clausthal)
-- Les modules repassés gardent leur score initial et reçoivent « ratt » (barème du rattrapage).
-- Total recalculé au prorata du barème initial ; niveau validé à 60 % du total ; mention : Gut >= 75 %, Befriedigend >= 60 %.
update resultats r set note = v.note, mention = v.mention, statut = v.statut, modules = v.modules::jsonb
from (values
  ('M237-26-008', 51.75, 'Befriedigend', 'reussi', '[{"m": "Lesen", "pts": 9, "max": 15}, {"m": "Hören", "pts": 5, "max": 15, "ratt": {"pts": 7, "max": 12}}, {"m": "Schreiben", "pts": 17, "max": 20}, {"m": "Sprechen", "pts": 17, "max": 30}]'),
  ('M237-26-005', 53.0, 'Befriedigend', 'reussi', '[{"m": "Lesen", "pts": 5, "max": 15, "ratt": {"pts": 10, "max": 12}}, {"m": "Hören", "pts": 6, "max": 15, "ratt": {"pts": 6, "max": 12}}, {"m": "Schreiben", "pts": 15, "max": 20}, {"m": "Sprechen", "pts": 18, "max": 30}]'),
  ('M237-26-007', 59.25, 'Befriedigend', 'reussi', '[{"m": "Lesen", "pts": 6, "max": 15, "ratt": {"pts": 10, "max": 12}}, {"m": "Hören", "pts": 6, "max": 15, "ratt": {"pts": 11, "max": 12}}, {"m": "Schreiben", "pts": 15, "max": 20}, {"m": "Sprechen", "pts": 18, "max": 30}]'),
  ('M237-26-004', 54.25, 'Befriedigend', 'reussi', '[{"m": "Lesen", "pts": 6, "max": 15, "ratt": {"pts": 10, "max": 12}}, {"m": "Hören", "pts": 8, "max": 15, "ratt": {"pts": 11, "max": 12}}, {"m": "Schreiben", "pts": 13, "max": 20}, {"m": "Sprechen", "pts": 15, "max": 30}]'),
  ('M237-26-001', 58.25, 'Befriedigend', 'reussi', '[{"m": "Lesen", "pts": 7, "max": 15, "ratt": {"pts": 10, "max": 12}}, {"m": "Hören", "pts": 7, "max": 15, "ratt": {"pts": 9, "max": 12}}, {"m": "Schreiben", "pts": 14.5, "max": 20}, {"m": "Sprechen", "pts": 14, "max": 30, "ratt": {"pts": 10, "max": 15}}]'),
  ('M237-26-032', 49.0, 'Befriedigend', 'reussi', '[{"m": "Lesen", "pts": 8, "max": 15}, {"m": "Hören", "pts": 4, "max": 15, "ratt": {"pts": 8, "max": 12}}, {"m": "Schreiben", "pts": 14, "max": 20}, {"m": "Sprechen", "pts": 17, "max": 30}]')
) as v(matricule, note, mention, statut, modules)
where r.niveau = 'A1' and r.etudiant_id = (select id from etudiants where matricule = v.matricule);
