/* =========================================================
   MossBox — Audio Manager
   Central place to play every sound in the game.

   SOUND FILE HOOK:
   Drop audio files into /assets/sounds/<category>/<name>.mp3
   matching the paths in SOUND_MANIFEST below. Until a file
   exists, playback silently no-ops (checked via a HEAD-less
   try/catch) so the game runs perfectly with zero audio
   assets today.

   Usage:
     import { audio } from '../audio/AudioManager.js';
     audio.play('block.break.moss');
     audio.playMusic('menu');
   ========================================================= */

// category.action.variant -> file path. Add new entries any time;
// nothing else in the codebase needs to change.
export const SOUND_MANIFEST = {
  // UI
  'ui.click':        'assets/sounds/ui/click.mp3',
  'ui.hover':        'assets/sounds/ui/hover.mp3',

  // Blocks (generic per-material break/place — extend per block as needed)
  'block.break.generic': 'assets/sounds/blocks/break_generic.mp3',
  'block.place.generic': 'assets/sounds/blocks/place_generic.mp3',
  'block.break.moss':    'assets/sounds/blocks/break_moss.mp3',
  'block.break.stone':   'assets/sounds/blocks/break_stone.mp3',
  'block.break.wood_log':'assets/sounds/blocks/break_wood.mp3',

  // Player
  'player.hurt':     'assets/sounds/player/hurt.mp3',
  'player.jump':     'assets/sounds/player/jump.mp3',
  'player.step':     'assets/sounds/player/step.mp3',
  'player.eat':      'assets/sounds/player/eat.mp3',

  // Mobs
  'mob.cow.idle':      'assets/sounds/mobs/cow_idle.mp3',
  'mob.zombie.groan':  'assets/sounds/mobs/zombie_groan.mp3',
  'mob.spider.hiss':   'assets/sounds/mobs/spider_hiss.mp3',

  // Ambience / Music
  'music.menu':      'assets/sounds/music/menu.mp3',
  'music.overworld': 'assets/sounds/music/overworld.mp3',
};

class AudioManager {
  constructor() {
    this.masterVolume = 1;
    this.musicVolume = 1;
    this.sfxVolume = 1;

    this._buffers = new Map();   // path -> HTMLAudioElement (preloaded)
    this._musicEl = null;
    this._missingWarned = new Set();
  }

  setVolumes({ master, music, sfx }) {
    if (master != null) this.masterVolume = master;
    if (music != null) this.musicVolume = music;
    if (sfx != null) this.sfxVolume = sfx;
    if (this._musicEl) {
      this._musicEl.volume = this.masterVolume * this.musicVolume;
    }
  }

  /** Fire-and-forget sound effect. Safe to call even if the file doesn't exist yet. */
  play(key, { volume = 1 } = {}) {
    const path = SOUND_MANIFEST[key];
    if (!path) return; // unknown key — silently ignore

    try {
      const el = new Audio(path);
      el.volume = Math.max(0, Math.min(1, this.masterVolume * this.sfxVolume * volume));
      el.play().catch(() => this._warnMissingOnce(path));
    } catch {
      this._warnMissingOnce(path);
    }
  }

  playMusic(key, { loop = true } = {}) {
    const path = SOUND_MANIFEST[key];
    if (!path) return;

    if (this._musicEl) {
      this._musicEl.pause();
      this._musicEl = null;
    }

    try {
      const el = new Audio(path);
      el.loop = loop;
      el.volume = this.masterVolume * this.musicVolume;
      el.play().catch(() => this._warnMissingOnce(path));
      this._musicEl = el;
    } catch {
      this._warnMissingOnce(path);
    }
  }

  stopMusic() {
    if (this._musicEl) {
      this._musicEl.pause();
      this._musicEl = null;
    }
  }

  _warnMissingOnce(path) {
    if (this._missingWarned.has(path)) return;
    this._missingWarned.add(path);
    console.info(`[AudioManager] No sound file at "${path}" yet — skipping playback silently.`);
  }
}

export const audio = new AudioManager();
