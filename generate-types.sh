#!/bin/bash
#PROJECT_REF="YOUR_PROJECT_REF"
DESTINATION="src/types"
mkdir -p $DESTINATION
npx supabase gen types typescript --project-id "$PROJECT_REF" --schema public > $DESTINATION/database.public.types.ts
npx supabase gen types typescript --project-id "$PROJECT_REF" --schema private > $DESTINATION/database.private.types.ts
