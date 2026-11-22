# Universal Engine v0.9j — VR indoor spaces & MR real-depth occlusion

## Scope

Adds optional immersive rendering to existing town, station, passenger train, ferry and detention interiors without changing the world, inventory, travel systems, or save schema. The previous VR, tabletop RTS and holographic planet remain available.

### VR interior cameras

`ExplorerRenderer.xrInteriorVP` uses the XR left/right per-eye projections and the same position as the train/town/ferry passenger's actual local in-game pose. The existing train/room meshes, other passengers, and view out the train window are reused. The local first-person body model is hidden to avoid blocking the headset. The existing walking controls (including thumbsticks routed through the standard input pipeline) continue to update the same character as in desktop mode.

Special interiors: station concourse, cabin/city interior, carriage, passenger ferry and railway detention. Small constructed houses retain their ground-world interior meshes.

### MR: optional depth-based occlusion

A WebXR `immersive-ar` session requests **optional** `depth-sensing` with CPU-optimized usage. The active frame supplies per-eye `XRCPUDepthInformation`, whose normalized view coordinates are top-left. A bounded 40x30 grid of depth measurements is uploaded to the existing WebGL2 renderer as `R32F` and compared per pixel with the fragment's camera-space Z distance. Pixels farther behind the observed physical surface are discarded. A configurable 8 cm threshold is used to limit visible edge noise.

- Controlled by the new “MR実物の奥行き遮蔽” checkbox.
- No camera imagery or depth buffer is saved or transmitted.
- When the feature is unavailable, the sensor returns no depth data, or the XR device chooses GPU-optimized depth, fallback is normal unoccluded passthrough MR.
- Only the engine's original WebGL2 material shader participates in this proof-of-concept depth masking. Avatar assets rendered with alternate shaders may still overlap physical objects.
- This is an **approximate** grid, not a full geometry mesh reconstruction. Occlusion at edges may be coarse; the quality depends on sensor resolution, pose registration and timing.

WebXR Depth Sensing specs: https://www.w3.org/TR/webxr-depth-sensing-1/

### Limitations and safety

These changes are integrated and unit-tested but have **not been verified on a physical XR headset**. Performance/occlusion and room boundaries need testing on target devices. There is no real-space collision avoidance and users must keep the real play area clear. VR train scenery is a prototype; ride sway is visual rather than a physical vestibular effect. Frontiers of the room, grip interactions with furniture, persistent AR anchors, hand tracking and dynamically updating person occlusion remain future work.

### Regression checklist

1. Ordinary TPV / RTS and save/load work with no headset.
2. No immersive XR: buttons remain disabled and no depth API is called.
3. VR land and cabin cameras both follow headset rotation in both eyes.
4. VR train station and carriage scene renders seat geometry and NPCs.
5. MR depth ON: nearby physical objects can cover compatible shaded virtual terrain; depth OFF: no occlusion.
6. MR without depth sensor falls back silently; exiting MR returns to 2D WebGL2.
7. XR frames never persist or upload camera/depth content.
