-- Add foreign key constraint from member_divisions to users so PostgREST can embed users directly
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'member_divisions_user_id_fkey'
    ) THEN
        ALTER TABLE member_divisions 
        ADD CONSTRAINT member_divisions_user_id_fkey 
        FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add activity_type generated column to attendance_sessions for backward/PRD compatibility
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'attendance_sessions' AND column_name = 'activity_type'
    ) THEN
        ALTER TABLE attendance_sessions 
        ADD COLUMN activity_type text GENERATED ALWAYS AS (session_type) STORED;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
