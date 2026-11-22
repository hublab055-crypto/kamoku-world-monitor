# Universal Engine — Multiplayer Society & Authority Plan

Status: **Design specification** (2026-10-24). The current `planet-explorer` faction, title, and taxation features are an **offline NPC simulation**, not a live multiplayer server. This document separates the implemented demo from future server-authoritative systems.

## World design

Economics, military, and diplomacy are interdependent but **no single victory condition** is enforced. Players may live as merchants, builders, households, explorers, mercenaries, or rulers without mandatory warfare. Territory conquest is not title transfer.

| Concept | Subject / invariant |
| --- | --- |
| Land title | Registered `asset.owner_id`; tradable, leasable, inheritable. It survives occupation. |
| Building title | Independent `building.owner_id`; may differ from the land title. |
| Occupancy | `tenant_id` or `resident_id`, independent of title or ruler. |
| Governance | A separately recorded `territory.ruler_id`, controlling laws, levy settings, and public spending only within jurisdiction. |
| Tax receipts | Enter the territory treasury, **not** the ruler's personal inventory. |
| Armed control | Military state may cause a governance transition, never direct deletion or seizure of private homes. |

## Client vs. server authority

Current browser-only prototype: `territory-economy.mjs` and `faction-strategy.mjs` keep local state, player choices and NPC turn logic. `localStorage` and five named save slots are personal saves and cannot authenticate other users. The local owner's ability to edit terrain or buildings **is not online owner privilege**.

The shared multiplayer server will authorize each command against logged-in identity, versioned world state, territory jurisdiction, role permissions, treaty status, resource availability, and rate limits. Browser calculations may predict visuals, but may **never** finalize shared assets, tax balances, item transfers or combat hits. Mod scripts may read the public simulation API; they may not bypass server ledger, authentication, property law or core compatibility rules.

Suggested server commands:
- `claim_land(world_id, parcel_id, request_id)`
- `transfer_title(asset_id, recipient_account_id, expected_version, request_id)`
- `grant_tenancy(asset_id, actor_id, scope, expiry, request_id)`
- `set_tax(territory_id, rate, expected_version, request_id)`
- `close_tax_period(territory_id, month_index)` — server scheduled, never client requested
- `allocate_budget(territory_id, purpose, amount, request_id)`
- `offer_treaty(target_faction_id, kind, request_id)`
- `accept_treaty(offer_id, expected_version, request_id)`
- `recruit(territory_id, unit_type, count, request_id)`
- `declare_war(target_faction_id, request_id)`
- `submit_unit_orders(battle_id, commands, input_sequence)`

Every accepted mutation should be an authenticated, idempotent transaction with an append-only journal, server timestamp, previous state version, audit actor, and a clear rejection reason. Treasury transfers and market settlement should use balanced ledger entries rather than client-reported income.

## Multiplayer balance and protection

- PvE, social, and opt-in PvP zones. Personal housing protections must not depend on constant online presence.
- No instant razing or automatic confiscation after military occupation; occupation changes tax/law jurisdiction, not title.
- Defender warning periods, scheduled contested territory windows, cooldowns, supply lines and upkeep prevent overnight total wipes and endless harassment.
- A peaceful player's work can compete on income, quality, reputation, technological progress, cultural influence, and service demand.
- Trade routes, neutral markets, treaty negotiations, arbitration and ceasefire are meaningful alternatives to war.
- The game should disclose tax formula, historical tax records, available public services, and the difference between public treasury and personal wallet.
- Matchmaking or regional server capacity should avoid forcing casual individuals to compete with 24/7 coordinated groups.

## Phased delivery

1. **Implemented demo**: NPC faction diplomacy and trading, tax-funded abstract garrisons, recruitment, abstract campaign resolution, ceasefires, realm changes, protected private title records, local saves. No human multiplayer and no 3D campaigns.
2. **Authoritative online identity & ledger**: accounts, persistent world IDs, strict parcel validation, treasury transactions, shared world snapshots, permissions and replication.
3. **Trade & co-op**: public market, shipping, inventory escrow, merchant contracts, player-governed cities, rents, verified taxes.
4. **Conflict & diplomacy**: war declarations, alliances, territorial control, troop movement, synchronized RTS battles, anti-cheat/anti-grief and offline protection.
5. **Creator economy**: safe assets, building permissions, licensing/royalties and interoperable modding without modification of the trusted common core.

## Prototype limitations

Local faction countries currently mirror settlement IDs and NPC income is a deterministic estimate, not actual NPC wages or a real player market. Abstract armies are not synchronized with the separate visible guard patrols or player avatar battalions. Results should be treated as balancing experiments, **not** a finished online or anti-cheat implementation.

Test entry point: `node --test universal-engine/planet-explorer/faction-strategy.test.mjs`.
