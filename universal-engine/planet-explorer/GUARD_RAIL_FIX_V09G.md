# Universal Engine v0.9g — Defensive guards and railway law encounters

## Reported problems
1. Spawning an enemy unit did not trigger any guard response.
2. Trespassing on railway tracks inevitably ended in detention and the sole resolution was a bail payment.

## Changes
- Town law now accepts the live `BattleTest.enemies` list, including spawned hostile squads.
- A garrison lookout raises a visible 📯 defense alarm when hostiles come within 180 meters of a station. A finite number of actual town soldiers are deployed, scaled to the hostile squad size and capped by the post's total roster. No infinite spawning.
- Patrol guards prioritize nearby hostile units, move into weapon range, face the enemy, and strike at 1.0–1.35-second intervals. Damage goes to the existing enemy HP and death animations; the enemy squad AI now treats defenders as valid attack targets at real swing-impact frames. Enemy damage to guards is **not** attributed to the player as a crime.
- Guard defense mode and cooldown/target survive normal v0.9d law snapshots. Battle feedback floats above the actual guard model; raised-weapon poses are used during defense.
- Railway trespass still checks the restricted fenced tracks but explicitly excludes the public crossing. Warnings remain 3 in 30 seconds. A safe exit command uses a real walking target beyond the fence.
- After three warnings, the station officer pursues, then issues a confrontation with 4.8 seconds to decide. The available responses are surrender, flee, or resist. Refusal is not the same as immediately accepting arrest.
- Fleeing can break the pursuit by increasing separation; resistance triggers nonlethal stamina/HP suppression. The station guard has real HP and can be hit by an animated sword/spear/axe impact or a physical arrow. Defeating an officer escalates criminal heat in the territorial law system, after which town guards may respond.
- Detention offers a monetary fine **or** a measured prison sentence; both release the character to a safe point by the station. The corresponding railway trespass penalty is settled without erasing unrelated crimes. Legal controls are accessible from the railway security HUD.
- Updated module and stylesheet cache versions to refresh iPhone Safari without resetting the player's save data.

## Validation
`node --test tests/guard-defense-rail-security-v09g.test.mjs` contains integrated guard-vs-enemy-battalion combat and railway encounter regression tests. Existing railway-security tests are also run in GitHub Actions.

**Baseline note:** At development time, the pre-existing branch had 14 failing tests unrelated to these changes; compare the new CI logs against that baseline. A red CI run is not a passing full test suite.

## Known limitations
Full witness reporting by individual residents, escort/handover animations, a proper jail interior with days of activities, physical rail security sword animations, terrain-aware A* pathfinding and line-of-sight occlusion, and server-authoritative multiplayer remain future work. The railway officer's HP and attack effects are functional; the police AI is an initial gameplay simulation rather than a production-grade state machine.
