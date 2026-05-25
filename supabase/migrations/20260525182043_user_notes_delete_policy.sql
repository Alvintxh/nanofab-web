-- Ensure authenticated users can delete their own notes (fixes notes
-- reappearing after refresh because DELETE was silently blocked by RLS).
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_delete" ON user_notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON user_notes;

CREATE POLICY "notes_delete" ON user_notes
FOR DELETE TO authenticated USING (auth.uid() = user_id);
