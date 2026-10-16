# Universal Engine — commercially usable 3D asset candidates

Research checked 2026-10-16. All links below point to original creators' pack pages. Assets in this table are **candidates only, not downloaded, imported, bundled, or rendered by the current game**. Verify the downloaded version's LICENSE and contents again before integration. Preserve source URL, version, retrieval date, license, and notes in an asset manifest when assets are imported.

| Priority | Original source | Type / motivation | License on creator's page |
| --- | --- | --- | --- |
| 1 | [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) | 5 free low-poly rigged characters, 25+ weapons/accessories, glTF / FBX, good mobile first choice. Paid EXTRA and SOURCE tiers are optional. | CC0, commercial, no credit required |
| 1 | [KayKit Character Animations](https://kaylousberg.com/game-assets/character-animations) | 133 humanoid clips, walk, run, jump, melee, emotes. Separate rigs for medium/large bodies. | CC0; verify download |
| 2 | [Quaternius Universal Base Characters](https://quaternius.com/packs/universalbasecharacters.html) | 6 base bodies, 20 hairstyles, compatible humanoid skeleton, ~13k triangles average; ideal for future avatar editor. Free subset, paid SOURCE option. | CC0, commercial use permitted |
| 2 | [Quaternius Universal Animation Library 2](https://quaternius.com/packs/universalanimationlibrary2.html) | 130+ animations across tiers, combat, parkour, farming, fishing; free tier is a subset. | CC0, commercial use permitted |
| 3 | [Quaternius RPG Character Pack](https://quaternius.com/packs/rpgcharacters.html) | Six rigged and animated fantasy characters. | CC0 |
| 1 | [Quaternius Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html) | Trees, plants, flowers, rocks; coherent vegetation style. More than 110 designs across tiers. | CC0, free tier, commercial permitted |
| 2 | [Quaternius Fantasy Props MegaKit](https://quaternius.com/packs/fantasypropsmegakit.html) | 200+ props across tiers: weapons, tools, furniture, books and food with shared textures. | CC0, free tier, commercial permitted |
| 2 | [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | 330 nature models for prototypes. | CC0 |
| 2 | [Kenney Building Kit](https://kenney.nl/assets/building-kit) | Approx. 80 modular building/structure models. | CC0 |
| 3 | [Kenney Animated Characters 3](https://kenney-assets.itch.io/animated-characters-3) | Lightweight rigged humans/zombies with idle, running and jump pose. | CC0 |

## Recommended first import

Start with **one KayKit Adventurers free-tier character** and KayKit Character Animations, then a few trees/rocks from Quaternius Stylized Nature MegaKit. Performance-test on an actual iPhone before increasing model count. A later editable avatar creator could use Quaternius Universal Base Characters and Universal Animation Library 2 as a second rig profile.

## Loader and rig requirements

The current `planet-explorer/render.mjs` is a **custom, dependency-free WebGL2 renderer**, with geometry built from code and a custom joint hierarchy in `rig.mjs`. It has **no glTF or FBX importer and no skinned-mesh vertex-shader support**. External 3D models require additional integration work:

1. Download only selected authorized free-tier files and inspect embedded LICENSE and rig details. Use original releases rather than unverified rehosted copies.
2. Prefer glTF 2.0 / GLB; convert FBX to GLB if necessary. Retain the original licensing and version information.
3. Add a reviewed glTF loader or a separately scoped rendering adapter (e.g. pinned three.js) for skinning, joint weights, textures and animation clips.
4. Map imported skeleton bones onto `rig.mjs` semantic pivots; retarget where bone names or bind pose differ.
5. Connect walking/running/jumping/tool/attack animation clips to `Actions` and `ExplorerController`. Keep procedural avatar as fallback.
6. Add caching/LOD/instancing for many trees and animals to protect mobile performance.

## License hygiene

CC0 generally permits commercial usage, modification and redistribution without mandatory credit, but review the specific archive and any third-party dependencies. KayKit asks not to resell unmodified packs or claim them as your creation. Source projects/premium tiers may require payment even where the free-tier assets are CC0. Commercially free use does **not** mean all files and source versions are free to download.

Changes and future integrations stay inside `universal-engine/`. Kamoku Monitor (real-world projection) and Frontier World remain untouched.
