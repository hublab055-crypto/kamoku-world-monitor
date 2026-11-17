# Universal Engine family module / OASIS-style social sandbox

## Scope and release boundary

- Base game offers adult relationships, marriage, optional one-night encounters,
  separately opted-in family planning, pregnancy, gestation, birth, infant care,
  growth and succession.
- The **base game never generates or displays explicit sexual content**.
  Its default `private` interaction uses a fade-to-black overlay.
- Single-player can opt into a camera-retaining **event-only bridge** for
  third-party extensions. The bridge publishes no explicit animation, poses,
  rendered scenes, textures, assets, or scripts.
- The code and protocol are public. The word "unofficial" does not make
  changes to this public repository secret.
- `9876` is a local session setting and is **not real age verification**.
  Do not use it as a multiplayer age gate.

## Consent and eligibility

A scene event is authorized only when all of the following hold:

1. Both avatars are in the designated adult roster and are at least 18.
2. The user explicitly confirms adulthood, enters 9876 in the current
   session and confirms consent.
3. The partner is present and interaction-distance checks pass.
4. Either there is an established qualifying relationship or the player
   explicitly selects a one-night encounter.
5. A one-night encounter also requires an independent NPC acceptance via
   the proposal action and at least 75 points of crew affinity.
6. The NPC acceptance expires after three minutes, is consumed by the
   encounter and does not survive save/reload.

The proposal is a simulated NPC response in a **single-player game**.
For future OASIS-style multiplayer, identity/age checks, opt-in consent
verification, moderation, abuse reports and a third-party-mod sandbox must
be implemented server-side before enabling any multiplayer extension bridge.

## Event contract (single player only)

The game dispatches a browser `CustomEvent` named:

`universal-engine:adult-private-scene`

This occurs only when the user has opted into **MOD connection (no fade)**.
The detail contains:

```json
{
  "name": "universal-engine:adult-private-scene",
  "version": 1,
  "partner": "navigator",
  "adults": true,
  "consent": true,
  "renderContent": "external-only"
}
```

The signal does not itself render or authorize an explicit scene.
The engine keeps the camera visible for that non-graphic event, but
the core game is otherwise unchanged.

**Privacy:** Scene notifications are ephemeral and not written into
the family history or save. For progression, the save may retain a count
of prior encounters and separately authorized family planning outcomes.
No private-event motion/frame data is saved.

## Minors and high-dimensional protection

Children and fetuses are never valid participants in adult or combat
actions. The core family system refuses any private event involving
unregistered or underage participants. Children cannot be damaged,
killed, or assigned a fatal illness in the family life-cycle model.
Threats route them to the Overlord sanctuary. When parents are absent,
protected foster care continues their nutrition, safety and upbringing.
External extensions must not bypass the child-protection contract.

## Test coverage

`planet-explorer/tests/family-oasis-one-night.test.mjs` verifies:

- NPC refusal, affirmative proposal, expiration, consumption, save/reload.
- Local unlock, confirmed consent, adult eligibility and one-night opt-in.
- Default fade versus camera-retaining event without a rendered scene.
- Private-event details absent from persisted family history.
- Family planning requires independent consent; gestation and newborn
  combat immunity remain effective.
