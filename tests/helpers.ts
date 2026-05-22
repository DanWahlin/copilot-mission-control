/**
 * Playwright test helpers for Kingdom of Agents.
 *
 * The app is a single-scene Phaser canvas (`code-kingdom`) inside a
 * Tauri window; in tests we serve `dist/` over plain HTTP at port 4173
 * (see `playwright.config.ts`) so the renderer runs without Tauri.
 */

type Page = import('@playwright/test').Page;

const GAME_URL = 'http://localhost:4173/game/index.html';
export { GAME_URL };

/**
 * Wait for the Phaser game to boot and for the Code Kingdom scene to
 * become active. Returns after the canvas is mounted and the scene
 * registry reports the `code-kingdom` scene running.
 */
export async function waitForGame(page: Page) {
  await page.waitForSelector('canvas', { timeout: 10_000 });
  await page.waitForFunction(
    () => {
      const game = (window as any).__phaserGame;
      if (!game) return false;
      const scene = game.scene?.getScene?.('code-kingdom');
      return !!scene && game.scene.isActive('code-kingdom');
    },
    { timeout: 10_000, polling: 100 },
  );
  // Small settle pause so the first renderActivity has a chance to draw.
  await page.waitForTimeout(500);
}

/** Read the Code Kingdom scene's reported status. */
export async function getKingdomStatus(page: Page) {
  return page.evaluate(() => (window as any).__codeKingdom?.getStatus?.() ?? null);
}
