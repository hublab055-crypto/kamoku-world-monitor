# Browser-consistent avatar assets — original v2 (2026-10-16)

Male / female originals are distributed as real, self-contained GLB files,
independent of per-browser IndexedDB. They are procedurally authored avatars,
not the missing Frontier World v5 models.

| Standard model | Triangles | Face / head triangles |
| --- | ---: | ---: |
| frontier_male_high.glb | 58,982 | 38,146 |
| frontier_female_high.glb | 61,954 | 41,118 |
| frontier_male_mobile.glb | 12,244 | 4,804 |
| frontier_female_mobile.glb | 13,524 | 6,084 |

All four assets are checked into `../original-assets/models/`.
Source model builder: `../original-assets/high-detail-avatar.mjs`.
The builder and GLBs are independent of imported third-party assets.

Version: `ue-original-humans-v2-20261016`.
- **Auto quality** resolves to mobile for deterministic shared visuals between
  iOS Safari and the ChatGPT in-app WebView; high can be explicitly selected.
- Both male/female versions include 21 semantic joint pivots and 7 clips:
  idle, walk, sword, axe, mine, talk, jump.
- Each sex/quality GLB uses 20 material-color-based joint mesh groups to
  reduce draw calls compared to creating a separate mesh per facial detail.
- Browser-local imports are opt-in and not automatically loaded.
- Load failures show a visible warning and retain the procedural fallback.
  High-file HTTP errors trigger a mobile-file retry.
- Old saves are preserved, and asset source/quality are persisted with the
  current save schema.
- Unit tests check actual on-disk GLBs and bundled URL selection.
- Desktop-generated assets were validated structurally. Real iPhone Safari
  and in-app WebView rendering remain to be verified physically.
