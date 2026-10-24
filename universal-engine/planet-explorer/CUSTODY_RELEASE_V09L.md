# Universal Engine v0.9l — Custody release and guard patrol stability

## Reported symptoms
- Bail / sentence did not reduce the wanted crosses after a railway pursuit.
- Floating combat damage numbers and the red hit-flash remained on screen after arrest.
- Guards were stationary after the player had been released.
- Impounded horse sometimes did not reappear at a nearby, visible location.

## Fixes
1. **Railway case settlement.** Territorial law now records `railCasePoints` for crimes specifically reported by railway security. The railway fine or sentence discharges **all** the railway-case penalties (trespass + flight), but leaves independent charges such as assaulting a civilian, guard or other crimes intact. Ledger state persists in saves; pre-ledger save history is replayed to infer outstanding railway charges. Settling a second time is idempotent. A local law fine / sentence now also clears stale hostile, pursuit, confrontation and warning state.
2. **Damage lifetime.** `WorldFeedback.frame(dt)` and hit-flash decay run even when the game simulation is deliberately paused during incarceration. Capture and release clear only transient feedback; the separate console history remains available.
3. **Patrol recovery.** Successful bail / sentence resumes the world clock and running state so finite guards continue walking. Guard movement uses a slightly more tolerant terrain-mesh slope check and tries navigable sideways steps rather than freezing on one blocked cell. Water remains impassable.
4. **Horse restoration.** After impounding a mounted player's horse, release searches an expanded station-yard ring for a safe location. The same horse ID, gear, tame state and stamina are retained; no automatic remount occurs. Captured avatar fall and three circling stars from v0.9k are preserved.
5. **Safari cache refresh.** Updated the published game entrypoint and modified JS module version parameters. Existing game saves retain the same versioned keys.

## Tests
`node --test tests/custody-release-regression-v09l.test.mjs` checks wanted charge accounting, idempotent settlement, old-save reconstruction, recovery of living guards, alternative walking path, expiration of paused feedback, original horse identity and gear, and the capture animation hooks.

At the last verified GitHub Actions run, **541/555 tests passed** with **14 existing unrelated failures** (unchanged count from the baseline). The JS syntax-check step passed. The complete suite is not green.

## Open work
On-device Safari rendering and interactions (especially uneven terrain at arbitrary jail entrances) should be play-tested. The finite guards' obstacle avoidance is still local detour logic, not A*. This patch avoids changing the renderer's original three-star capture geometry, political systems, world-building tools or other non-law modules.
