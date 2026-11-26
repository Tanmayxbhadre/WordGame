# Dictionary Licensing & Provenance

The WordShift dictionary (`src/data/dictionary.json` and `supabase/seed.sql`) is derived from the public-domain English word list (`/usr/share/dict/words`, based on Webster's Second International Dictionary, 1934, which is in the Public Domain).

## Filtering Applied
- Lowercase ASCII letters only (`^[a-z]{4,5}$`)
- Proper nouns, hyphenated words, and abbreviations removed
- Offensive and unsuitable terms removed
- Annotated with word-graph connectivity degree and difficulty tier (`easy`, `medium`, `hard`)
