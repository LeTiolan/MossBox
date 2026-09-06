# MossBox

A browser-based, Minecraft-inspired voxel sandbox built on Three.js. Pure
HTML/CSS/JS (ES modules) — no build step, no bundler, fully GitHub-Pages
compatible.

## Running it

Because this uses ES modules, open it through a local server rather than
double-clicking `index.html` (browsers block module imports over `file://`).

```bash
# any static server works, e.g.:
npx serve .
# or
python3 -m http.server 8000
```

Then visit `http://localhost:8000` (or whatever port your server prints).

To deploy on **GitHub Pages**: push this folder to a repo and enable Pages
on the `main` branch / root — no build step required.

## Project structure

```
index.html                 Single HTML shell; loads Three.js from a CDN
css/
  variables.css             Design tokens (colors, sizing, motion)
  base.css                  Reset + custom cursor + screen scaffolding
  menus.css                 Main menu / settings / keybinds / pause
  hud.css                   Hotbar, hearts, hunger, crosshair
  inventory.css             Inventory, crafting grid, workstation UIs
js/
  config/                   Pure data — no logic. Edit these to add content.
    blocks.js                Block registry (colors, flags, drop tables)
    mobs.js                  Mob stats & behavior tags
    recipes.js                Crafting + smelting recipes
    keybinds.js               Default keybinds + persistence/conflict logic
    settings.js                Render distance / FOV / volume persistence
  engine/                   World simulation & rendering
    Noise.js                  Seeded simplex noise (deterministic world)
    Biomes.js                  Biome selection + per-column block stacks
    World.js                   Chunk data, generation, ore/cave carving, save system
    ChunkMesher.js              Converts chunk data into GPU geometry
    ChunkManager.js             Loads/unloads chunks around the player
    Renderer.js                 Three.js scene/camera/lighting/fog
    TextureManager.js           Flat-color materials, upgrades to PNGs automatically
  player/
    Controls.js                 WASD movement, jump, sprint, sneak, mouse look
    Interaction.js               Raycasting, block break/place, workstation open
    Inventory.js                 Hotbar/backpack/armor/crafting data model
  ui/
    HUD.js                       Hotbar + hearts + hunger rendering
    InventoryUI.js                Full inventory screen + 2x2 crafting
    MainMenu / SettingsMenu / KeybindsMenu / ScreenManager
    MenuBackground.js             Decorative panning-camera menu background
    CustomCursor.js               Glowing circle cursor replacement
  audio/
    AudioManager.js               Sound playback with graceful no-op fallback
assets/
  textures/blocks/              Drop 16x16 PNGs here (see README inside)
  sounds/                        Drop .mp3s here, sorted by category (see README inside)
```

## Adding content later

- **New block**: add one entry to `js/config/blocks.js`. It automatically
  gets a flat-color render; drop a matching PNG into
  `assets/textures/blocks/` whenever you want a real texture.
- **New sound**: add a key to `SOUND_MANIFEST` in `js/audio/AudioManager.js`
  and drop the file at the listed path.
- **New recipe**: add a shape to `js/config/recipes.js`.
- **New mob**: add an entry to `js/config/mobs.js`, then wire its behavior
  into a future `js/engine/Mobs.js` (not yet implemented — see Known Gaps).

## Known gaps / next modules to build

Following the project's own "one feature at a time" development cycle,
these are intentionally stubbed or left as clean extension points rather
than half-built:

- **Mob AI & spawning** (`js/config/mobs.js` data exists; no AI loop yet).
- **Workstation UIs** (Furnace/Crafting Table/Chest) — `main.js` has an
  `openWorkstation()` hook ready; only the Furnace has CSS already
  (`.furnace-layout` etc. in `inventory.css`).
- **Full greedy meshing** — chunks currently merge faces per block type
  per chunk (already collapses most draw calls); the TODO in
  `ChunkMesher.js` marks exactly where to add true greedy quad merging.
- **LZ-String save compression** — `World.js` saves only modified blocks
  (not full chunks) via `localStorage`/JSON already; swapping in
  LZ-String compression is a one-line change noted in that file.
- **Agriculture growth ticks, farmland hydration checks, fluid flow
  simulation** — block flags for these already exist in `blocks.js`.
