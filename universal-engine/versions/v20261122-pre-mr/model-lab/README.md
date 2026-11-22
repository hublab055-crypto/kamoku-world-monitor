# Original Model Lab

A dependency-free WebGL2 model viewer, animations tester and binary 3D file exporter for Universal Engine original assets.

- URL: `/universal-engine/model-lab/`
- Source models: `../original-assets/original-models.mjs`
- Binary exporter: `../original-assets/export.mjs`
- Published GLB files: `../original-assets/models/*.glb`
- 3D viewer: `viewer.mjs`
- Rig input: existing `../planet-explorer/rig.mjs`
- 12 models, including three animated avatar variants and nine original environment/equipment pieces.
- Interactive rotation, zoom, animation selection, and `.glb` / `.obj` download buttons.

The page does not fetch reference models from KayKit/Quaternius/Kenney and does not need remote third-party dependencies. The 3D rendering depends on WebGL2. GLB/OBJ generation itself does not require a GPU. Node tests are in `../tests/original-models.test.mjs`.

This studio and the related binary assets are entirely separate from Kamoku Monitor's reality projection and Frontier World.
