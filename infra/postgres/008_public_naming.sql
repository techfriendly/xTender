BEGIN;

UPDATE audit_events
SET action = 'preparation.' || substring(action FROM length('category1.') + 1)
WHERE action LIKE 'category1.%';

UPDATE validation_issues
SET issue_type = 'preparation_' || substring(issue_type FROM length('category1_') + 1),
    code = CASE
      WHEN code LIKE 'category1_%' THEN 'preparation_' || substring(code FROM length('category1_') + 1)
      ELSE code
    END,
    updated_at = now()
WHERE issue_type LIKE 'category1_%' OR code LIKE 'category1_%';

UPDATE annual_procurement_plan_items
SET notes = replace(notes, concat('Procure', 'AI'), 'xTender'),
    updated_at = now()
WHERE notes LIKE '%' || concat('Procure', 'AI') || '%';

COMMIT;
