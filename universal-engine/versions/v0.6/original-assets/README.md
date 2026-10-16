# Universal Engine — Original 3D Asset Pack v1

**12 original low-poly game models**, created procedurally for Universal Engine. All geometry, colors and meshes are generated from our own source code, without importing KayKit, Quaternius, Kenney or any other third-party 3D asset.

Browse and export at: [Original Model Lab](../model-lab/) (GitHub Pages path: `/universal-engine/model-lab/`).

## Model inventory

| ID | 3D model | Group | GLB animations |
| --- | --- | --- | --- |
| pioneer | 開拓者・翠の外套 | avatar | walk, jump, sword, axe, build |
| scout | 斥候・藍の装束 | avatar | walk, jump, sword, axe, build |
| artisan | 職人・錆朱の作業着 | avatar | walk, jump, sword, axe, build |
| broadleaf | 星葉樹 | vegetation | static |
| pine | 段笠針葉樹 | vegetation | static |
| flowering | 霞桜 | vegetation | static |
| boulder | 風化した岩 | landscape | static |
| hut | 開拓者の小屋 | building | static |
| sword | 旅人の剣 | equipment | static |
| axe | 森番の斧 | equipment | static |
| pickaxe | 採掘つるはし | equipment | static |
| hammer | 建築用金槌 | equipment | static |

All 12 self-contained `.glb` binary files are in [models/](models/). No texture files or external binary buffers are needed. The showroom also exports `.obj` on demand (static geometry; OBJ does not retain vertex colors and animation).

## Avatar structure

The three characters use 21 named semantic pivots (pelvis, waist, torso, neck, head, bilateral shoulder/elbow/wrist/hand/hip/knee/ankle/foot) and 16 segmented low-poly body meshes. The GLBs embed five **rigid-parent rotation-animation** clips. They are **not skinned GLBs** with deforming vertices or normalized skin weights. Every segment is attached to a joint node so it can rotate correctly with parent joints, and is editable in glTF-compatible model editors.

- The game runtime uses `../planet-explorer/rig.mjs` for hierarchical joint animation, while `original-models.mjs` supplies the original visible geometry.
- The `export.mjs` module maps the same pivot labels into glTF 2.0 node hierarchies and embeds animation channels.
- A complete realistic joint model, IK solving, facial blend shapes, retargeting imported motion capture, and physics ragdoll are future work.

## Design

Original fantasy-frontier appearance: cedar-teal cape/jacket, brass fasteners, leather utility bag, ochre scarf and angular low-poly silhouette; a blue scout variant and an ochre-russet artisan; wide teal deciduous trees, stepped pine, pink flowering tree, mossy faceted rocks and plank hut with green roof.

**Reference inspiration is limited to general low-poly game production patterns**. No third-party proprietary shapes, artwork, textures, characters, source archives or rig data have been copied into these files. All models share a single simple vertex-color approach for efficient browser rendering.

## Commercial use / license

**Model outputs: CC0-1.0** — offered without attribution requirement, for modification and commercial use. The generating JavaScript source is offered under MIT (see [LICENSE.md](LICENSE.md)). Model provenance can be tracked back to the original generation code.

No warranties are provided. Additional assets imported in future may have different licensing and must be recorded separately. Do not represent other authors' independently created packs as part of this collection.

## File formats and usage

- Open any `models/<id>.glb` in Blender (File → Import → glTF 2.0) or another glTF 2.0 tool.
- In the Model Lab, select any model and choose **GLBを保存** or **OBJを保存**.
- To regenerate files, call `exportOriginalGLB("pioneer")` / `exportOriginalOBJ("pioneer")` from `export.mjs` in a JS module runtime.
- These models are currently integrated into `planet-explorer/render.mjs` **procedurally**, with no GLB runtime importer required. Exported GLBs are independent reusable model assets.

## Limitations and testing

The GLB JSON/chunk structure, buffer alignment, vertex color fields, animation sampler metadata and number of source meshes are regression tested. Blender import, third-party Khronos glTF Validator, actual GPU visual appearance and iPhone performance have **not yet been independently verified**; exported GLBs should be validated in your target engine before public release.

This pack is isolated under `universal-engine/`. No Kamoku Monitor / Frontier World code or data is touched.
