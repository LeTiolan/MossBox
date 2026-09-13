/* =========================================================
   MossBox — Main
   Bootstraps every module and runs the game loop. This file
   should stay thin: it wires modules together and handles
   top-level screen transitions, but no game logic lives here.
   ========================================================= */

import { World } from './engine/World.js';
import { ChunkManager } from './engine/ChunkManager.js';
import { Renderer } from './engine/Renderer.js';
import { Controls } from './player/Controls.js';
import { Interaction } from './player/Interaction.js';
import { Inventory } from './player/Inventory.js';
import { HUD } from './ui/HUD.js';
import { InventoryUI } from './ui/InventoryUI.js';
import { WorkstationUI } from './ui/WorkstationUI.js';
import { MenuBackground } from './ui/MenuBackground.js';
import { SettingsMenu } from './ui/SettingsMenu.js';
import { KeybindsMenu } from './ui/KeybindsMenu.js';
import { ScreenManager } from './ui/ScreenManager.js';
import { initCustomCursor } from './ui/CustomCursor.js';
import { keybindManager } from './config/keybinds.js';
import { settings } from './config/settings.js';
import { audio } from './audio/AudioManager.js';
import { showToast } from './ui/Toast.js';
import { getItemName } from './config/itemColors.js';
import { PerfOverlay } from './ui/PerfOverlay.js';

// ---------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------

initCustomCursor();

const screens = new ScreenManager();
screens.show('main-menu');

const menuBackground = new MenuBackground(document.getElementById('menu-bg-canvas'));
menuBackground.start();

let settingsCameFrom = 'main-menu';

const settingsMenu = new SettingsMenu({
  onRenderDistanceChange: (v) => gameInstance?.chunkManager.setRenderDistance(v),
  onFovChange: (v) => gameInstance?.renderer.setFOV(v),
});
new KeybindsMenu();

audio.setVolumes({
  master: settings.get('volumeMaster') / 100,
  music: settings.get('volumeMusic') / 100,
  sfx: settings.get('volumeSfx') / 100,
});

// ---------------------------------------------------------------
// Menu navigation
// ---------------------------------------------------------------

document.getElementById('btn-play').addEventListener('click', () => {
  audio.play('ui.click');
  startGame();
});

document.getElementById('btn-settings').addEventListener('click', () => {
  audio.play('ui.click');
  settingsCameFrom = 'main-menu';
  screens.show('settings-menu');
});

document.getElementById('btn-settings-back').addEventListener('click', () => {
  audio.play('ui.click');
  screens.show(settingsCameFrom);
});

document.getElementById('btn-open-keybinds').addEventListener('click', () => {
  audio.play('ui.click');
  screens.show('keybinds-menu');
});

document.getElementById('btn-keybinds-back').addEventListener('click', () => {
  audio.play('ui.click');
  screens.show('settings-menu');
});

document.getElementById('btn-pause-settings').addEventListener('click', () => {
  audio.play('ui.click');
  settingsCameFrom = 'pause-menu';
  screens.show('settings-menu');
});

document.getElementById('btn-resume').addEventListener('click', () => {
  audio.play('ui.click');
  resumeGame();
});

document.getElementById('btn-quit').addEventListener('click', () => {
  audio.play('ui.click');
  quitToMainMenu();
});

// ---------------------------------------------------------------
// Game lifecycle
// ---------------------------------------------------------------

let gameInstance = null;

function startGame() {
  menuBackground.stop();
  screens.hideAll();
  document.getElementById('game-root').classList.remove('hidden');

  if (!gameInstance) {
    gameInstance = createGame();
    audio.playMusic('music.overworld');
  }

  gameInstance.controls.enabled = true;
  gameInstance.interaction.enabled = true;
  gameInstance.controls.lock();
}

function resumeGame() {
  screens.hideAll();
  gameInstance.controls.enabled = true;
  gameInstance.interaction.enabled = true;
  gameInstance.controls.lock();
}

function pauseGame() {
  gameInstance.controls.enabled = false;
  gameInstance.interaction.enabled = false;
  gameInstance.controls.unlock();
  screens.show('pause-menu');
}

function quitToMainMenu() {
  gameInstance.controls.enabled = false;
  gameInstance.interaction.enabled = false;
  gameInstance.controls.unlock();
  document.getElementById('game-root').classList.add('hidden');
  screens.show('main-menu');
  menuBackground.start();
  audio.playMusic('music.menu');
}

function createGame() {
  const canvas = document.getElementById('game-canvas');
  const renderer = new Renderer(canvas, {
    fov: settings.get('fov'),
    renderDistanceChunks: settings.get('renderDistance'),
  });

  const world = new World();
  const chunkManager = new ChunkManager(world, renderer.scene, settings.get('renderDistance'), renderer.camera);
  const perfOverlay = new PerfOverlay(chunkManager, world);

  const controls = new Controls(renderer.camera, canvas, world);
  const inventory = new Inventory();
  const hud = new HUD(inventory);
  const inventoryUI = new InventoryUI(inventory);
  const workstationUI = new WorkstationUI(inventory, {
    onClose: () => {
      controls.enabled = true;
      interaction.enabled = true;
      controls.lock();
    },
  });

  controls.onFallDamage = (damage) => {
    hud.setHealth(hud.health - damage);
    audio.play('player.hurt');
    showToast(`-${damage} (fall damage)`);
  };

  const openWorkstation = (type) => {
    controls.enabled = false;
    interaction.enabled = false;
    controls.unlock();
    workstationUI.open(type);
  };

  const interaction = new Interaction({
    camera: renderer.camera,
    world,
    chunkManager,
    inventory,
    onOpenWorkstation: (type) => openWorkstation(type),
  });

  // Number keys 1-9 select hotbar slots.
  document.addEventListener('keydown', (e) => {
    // Escape closes whichever overlay is open, regardless of whether
    // controls are currently enabled (they're disabled while either
    // overlay is up, which would otherwise block the 'pause' action).
    if (e.code === 'Escape') {
      if (workstationUI.isOpen()) { workstationUI.close(); return; }
      if (inventoryUI.isOpen()) {
        inventoryUI.close();
        controls.enabled = true;
        interaction.enabled = true;
        controls.lock();
        return;
      }
    }

    const action = keybindManager.getAction(e.code);

    // The inventory toggle must work whether it's opening (controls
    // currently enabled) or closing (controls currently disabled), so it's
    // handled before the enabled-gate below rather than being blocked by it.
    // Ignored while the workstation screen is open to avoid both overlays
    // fighting over pointer-lock state at once.
    if (action === 'inventory' && !workstationUI.isOpen()) {
      inventoryUI.toggle();
      const isOpen = inventoryUI.isOpen();
      controls.enabled = !isOpen;
      interaction.enabled = !isOpen;
      isOpen ? controls.unlock() : controls.lock();
      return;
    }

    if (!controls.enabled) return;

    if (action?.startsWith('hotbar')) {
      const idx = Number(action.replace('hotbar', '')) - 1;
      inventory.selectHotbarSlot(idx);
      const stack = inventory.hotbar[idx];
      if (stack) showToast(getItemName(stack.item));
    }
    if (action === 'dropItem') inventory.dropSelected();
    if (action === 'pause') pauseGame();
  });

  document.addEventListener('wheel', (e) => {
    if (!controls.enabled) return;
    const dir = Math.sign(e.deltaY);
    const next = (inventory.selectedHotbarIndex + dir + 9) % 9;
    inventory.selectHotbarSlot(next);
    const stack = inventory.hotbar[next];
    if (stack) showToast(getItemName(stack.item));
  });

  // If the browser exits pointer lock unexpectedly (e.g. user hits Esc
  // at the OS level) treat it the same as opening the pause menu.
  document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && controls.enabled && !inventoryUI.isOpen() && !workstationUI.isOpen()) {
      pauseGame();
    }
  });

  return { renderer, world, chunkManager, controls, interaction, inventory, hud, inventoryUI, workstationUI, perfOverlay };
}

// ---------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------

let lastTime = performance.now();
function loop() {
  requestAnimationFrame(loop);

  // FO-style "Dynamic FPS": skip all work entirely while the tab isn't
  // visible (switched away, minimized) — no point generating chunks,
  // running physics, or rendering when nothing is on screen to see it.
  if (document.hidden) {
    lastTime = performance.now(); // avoid a huge dt jump when it comes back
    return;
  }

  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  if (gameInstance) {
    const { controls, interaction, chunkManager, renderer, perfOverlay } = gameInstance;
    controls.update(dt);
    interaction.update();
    chunkManager.update(controls.position.x, controls.position.z);
    renderer.render();
    perfOverlay.update();
  }
}
loop();
