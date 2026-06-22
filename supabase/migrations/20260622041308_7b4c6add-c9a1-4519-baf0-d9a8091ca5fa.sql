DROP POLICY IF EXISTS aud_insert ON public.auditoria;
CREATE POLICY aud_insert ON public.auditoria
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (establecimiento_id IS NULL OR public.is_member(establecimiento_id, auth.uid()))
  );