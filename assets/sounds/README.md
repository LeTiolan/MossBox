# Sounds

`js/audio/AudioManager.js` defines a `SOUND_MANIFEST` mapping short keys
(e.g. `block.break.moss`) to file paths under this folder. Until a file
exists at that path, playback silently no-ops — the game runs fine with
zero audio assets.

To add a sound:

1. Add or find the matching key in `SOUND_MANIFEST`.
2. Drop an .mp3 file at the path listed for that key.
3. Reload — it will play automatically wherever `audio.play('key')` or
   `audio.playMusic('key')` is already called.

Folders are pre-split by category: ui/, blocks/, player/, mobs/, music/.
