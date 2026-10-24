# Media and cultural artifacts (v0.9k prototype)

The cultural-media implementation is an independent feature under
universal-engine/planet-explorer/. It does not modify the simulation core,
Kamoku Monitor or Frontier World.

## How to use

Open Planet Explorer and select 🎞️ メディア作品 in the toolbar or
🎞️ メディア・放送 in the compact menu.

1. Choose 手紙, 絵画・写真・壁紙, レコード, or フィルム.
2. Enter title, author, and text, media file or HTTPS YouTube URL.
3. Create the item. It appears in the local media inventory.
4. Preview, duplicate, record a new local owner as a gift, or place a picture
   or film board in front of the landed avatar.
5. Use 番組表 to assign films or recordings to a channel and game-time start.
   現在の番組を見る／聴く resolves the current program.

Images: JPEG, PNG, WebP, GIF. Audio: MP3, M4A, WAV, OGG, WebM.
Video: MP4, WebM, OGG where the browser supports playback. AVI must be
converted beforehand. Upload limit: 75 MiB per file.
YouTube URLs must be from official HTTPS hosts and use the official
youtube-nocookie.com embed; browser and publisher restrictions apply.

## Data, saves and privacy

- media-library.mjs validates records, gifts, placements and schedules.
- media-storage.mjs stores file blobs in browser IndexedDB, not localStorage.
- media-ui.mjs plus media-ui.css render item creation, playback and boards.
- Media metadata is stored in the separate v1 local media journal, and the
  optional v0_9k.media explorer save field.
- User media is not uploaded to GitHub or an external server.
- Gifts are local owner-label changes, not multiplayer transfer.
- Binary files stay in this browser. Copying a saved game to a different
  browser does not transfer the underlying files.

## Rendering limitations

Version 1 uses projected HTML image/video surfaces over the custom WebGL2
canvas, positioned by geographic coordinates. These are not yet true wall
UV textures or tiled wallpaper, building-attached canvases, correct
perspective quads, scene occlusion or XR compositor layers.
Local video panels use muted playback where the browser permits it.
YouTube plays in the media viewer, not in unrestricted WebGL textures.

The broadcast schedule works in the media panel with in-game time.
Physical television tuning, automatic schedule switching on world screens,
network-synchronized shared broadcast and server-backed permissions remain
future integration work.

## Tests

From universal-engine/ run npm test. The new media-library.test.mjs checks
YouTube validation, items, gifts, snapshots, placements, scheduling and
invalid inputs.
