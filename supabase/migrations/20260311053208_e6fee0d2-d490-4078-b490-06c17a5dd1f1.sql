
-- Verify: re-add realtime safely (already added, just skip)
-- This migration is a no-op safety check since the previous migration applied all changes
-- but failed at the very last line (realtime already enabled)
SELECT 1;
