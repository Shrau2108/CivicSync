ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS urgency text NOT NULL DEFAULT 'medium';

ALTER TABLE public.reports
  ALTER COLUMN priority_score TYPE numeric(6, 2)
  USING priority_score::numeric(6, 2);

ALTER TABLE public.tasks
  ALTER COLUMN priority_score TYPE numeric(6, 2)
  USING priority_score::numeric(6, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'reports_urgency_check'
      AND conrelid = 'public.reports'::regclass
  ) THEN
    ALTER TABLE public.reports
      ADD CONSTRAINT reports_urgency_check
      CHECK (urgency IN ('critical', 'high', 'medium', 'low'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_report_id_unique
  ON public.tasks (report_id);
