# Textures

Every block currently renders as a flat color defined in `js/config/blocks.js`.

To add a real 16x16 pixel-art texture for a block:

1. Name your PNG after that block's `texture` key (e.g. `moss.png` for the Moss Block).
2. Drop it in `assets/textures/blocks/`.
3. Reload — `js/engine/TextureManager.js` automatically detects the file and
   swaps the flat color for the texture. No code changes needed.

Recommended: 16x16px, nearest-neighbor friendly (crisp pixel art, no blur).
