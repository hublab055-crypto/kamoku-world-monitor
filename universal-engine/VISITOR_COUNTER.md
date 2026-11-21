# Universal Engine visitor numbers

The counter is **not a human census**. It assigns a sequential number to an anonymous browser installation. A different browser, cleared local storage, or a new device may receive a different number. It starts when the feature is released; it cannot reconstruct historic visits.

## User-facing locations

- `universal-engine/index.html`: persistent welcome banner
- `universal-engine/planet-explorer/index.html`, `demo/`, `planet-demo/`, `model-lab/`: temporary 12-second welcome banner
- Shared module: `universal-engine/visitor-counter.mjs`

The banner fetches the counter directly from the deployed `ue-visitor` Supabase Edge Function. It never displays a made-up number if the network is unavailable.

## Architecture

1. Browser generates a random version-4 UUID and stores it as `localStorage["ue:visitor-id:v1"]`.
2. Browser calls `POST /functions/v1/ue-visitor` with UUID and a coarse device class (desktop/mobile/tablet/VR).
3. Public Edge Function validates input, optionally computes a daily HMAC rate-limit key from the gateway IP, and calls the database with the **server-side** service-role key.
4. The only exposed RPC is `public.ue_register_visit`. Its SQL `EXECUTE` permission is granted **only to service_role**. Anonymous users cannot directly read or modify the registry.
5. The `ue_internal` schema contains a sequence-backed visitor registry, timestamps, page-load counts, and short-lived hashed rate limit entries. These are isolated from Kamoku tables.

Never put the service-role key in browser code. The Edge Function is intentionally public (`verify_jwt=false`) to admit anonymous first-time visitors. Abusive clients can still artificially inflate visitor counts; limits are best-effort and anonymous IDs do not prove unique people. The rate-limit table should be periodically purged of rows older than a few days. IPs are **not stored as plaintext**, though Supabase infrastructure may keep separate request logs.

## Administrator metrics

Run the following SQL in the Supabase SQL Editor (not in public client code):

```sql
-- Total registered browsers, new in the last 24h, returning browsers, and loads
select count(*) as unique_browser_registrations,
       count(*) filter (where first_seen >= now() - interval '24 hours') as first_visits_last_24h,
       count(*) filter (where visit_count > 1) as returned_browsers,
       coalesce(sum(visit_count), 0) as loads
from ue_internal.visitors;

-- New visitors per day (UTC)
select (first_seen at time zone 'UTC')::date as visit_day,
       count(*) as new_browser_registrations
from ue_internal.visitors
group by 1 order by 1 desc limit 30;

-- Device-class breakdown
select device_class, count(*) as registrations
from ue_internal.visitors
group by 1 order by 2 desc;

-- Periodic privacy housekeeping (e.g., manually or by a scheduled job)
delete from ue_internal.visitor_rate_daily
where day < (now() at time zone 'UTC')::date - 3;
```

## Verification

- Existing identifier returns the **same number** with `first_visit=false`.
- New identifiers receive different numbers, with concurrent issuance governed by a PostgreSQL identity sequence.
- `anon` and `authenticated` must not have `EXECUTE` rights on `public.ue_register_visit`.
- Confirm Edge Function is active, and check the live page in a browser (including another browser or private window) after GitHub Pages publishes the updated `main` branch.
- This initial release does **not** embed a native WebXR 3D watch/dashboard. The counter banner appears in the HTML page before entering immersive VR. In-world UI integration is separate.
