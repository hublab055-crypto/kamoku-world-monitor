# v0.7k Avatar browser parity (2026-10-16)

## Standard files
The source repository already provides self-contained, original GLB characters:
- Male: `../original-assets/models/pioneer.glb`
- Female: `../original-assets/models/scout.glb`
Pack version: `ue-original-avatars-20261016`.

These are **original lightweight low-poly characters**. The previously created
50k-triangle Frontier World v5 GLB files are not present in the repository.
Do not claim that the bundled assets reproduce the lost high-resolution asset.

## Rules
- Standard GLB loading fetches version-stamped, same-site published URLs.
- Old per-browser IndexedDB never changes default standard-model appearance.
- An explicit file import opts the user into *imported* mode, which remains
  intentionally browser-local. Saved snapshots track model source and quality.
- Asset status shows source, version, quality, triangles, animation support and errors.
- The refresh button forces an HTTP re-fetch of the bundled model.
- On missing/invalid files, the procedural avatar is displayed without
  preventing the rest of the scene from rendering.
- Rigid original GLB scale is calculated from complete world-space bind-pose
  vertex bounds so joint-local meshes are normalized correctly.
- High and mobile quality currently point to the same lightweight GLB mesh
  until physically different LOD models have been authored.
- The source repository and unit tests are verifiable, but no physical
  iPhone / Safari / ChatGPT WebView rendering check has been performed.
