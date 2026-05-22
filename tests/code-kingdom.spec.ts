import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { GAME_URL, waitForGame } from './helpers';

const KINGDOM_FIXTURE = {
  available: true,
  source: 'playwright-fixture',
  scanned_sessions: 3,
  active_sessions: 2,
  total_events: 184,
  total_tool_calls: 47,
  total_output_tokens: 8120,
  sessions: [
    { id: 'alpha123', title: 'Build Kingdom', repository: 'kingdom-of-agents', branch: 'main', updated_at: '', is_active: true, status: 'working', event_count: 82, tool_count: 23, write_count: 8, read_count: 9, command_count: 4, web_count: 1, task_count: 1, error_count: 0, output_tokens: 4200, last_tool: 'apply_patch', last_event_kind: 'tool.execution_start', last_event_category: 'forge', stale_seconds: 12 },
    { id: 'beta4567', title: 'Review Tests', repository: 'kingdom-of-agents', branch: 'main', updated_at: '', is_active: true, status: 'needs-attention', event_count: 64, tool_count: 17, write_count: 2, read_count: 7, command_count: 6, web_count: 0, task_count: 2, error_count: 1, output_tokens: 2920, last_tool: 'bash', last_event_kind: 'tool.execution_complete', last_event_category: 'alert', stale_seconds: 25 },
    { id: 'gamma890', title: 'Research UI', repository: 'docs', branch: 'main', updated_at: '', is_active: false, status: 'idle', event_count: 38, tool_count: 7, write_count: 0, read_count: 3, command_count: 0, web_count: 4, task_count: 0, error_count: 0, output_tokens: 1000, last_tool: 'web_fetch', last_event_kind: 'tool.execution_start', last_event_category: 'signal', stale_seconds: 900 },
  ],
  tools: [
    { name: 'view', category: 'library', count: 14 },
    { name: 'apply_patch', category: 'forge', count: 8 },
    { name: 'bash', category: 'terminal', count: 7 },
    { name: 'rg', category: 'library', count: 5 },
    { name: 'task', category: 'delegates', count: 3 },
    { name: 'web_fetch', category: 'signal', count: 4 },
  ],
  recent_events: [
    { session_id: 'alpha123', timestamp: '2026-05-21T07:15:00Z', kind: 'tool.execution_start', tool: 'apply_patch', category: 'forge', success: true },
    { session_id: 'beta4567', timestamp: '2026-05-21T07:14:00Z', kind: 'tool.execution_complete', tool: 'tool complete', category: 'alert', success: false },
    { session_id: 'alpha123', timestamp: '2026-05-21T07:13:00Z', kind: 'tool.execution_start', tool: 'view', category: 'library', success: true },
    { session_id: 'gamma890', timestamp: '2026-05-21T07:12:00Z', kind: 'tool.execution_start', tool: 'web_fetch', category: 'signal', success: true },
  ],
  alerts: ['1 recent tool failure needs review.'],
  generated_at_ms: Date.now(),
};

async function installFixture(page: Page, fixture = KINGDOM_FIXTURE) {
  await page.addInitScript((fixtureArg) => {
    (window as any).__kingdomFixture = fixtureArg;
  }, fixture);
}

/** Returns the canvas bounding box so tests can map scene-space rects
 * to viewport coordinates. The 32 px top bar offsets the canvas down,
 * so plain `page.mouse.click(rect.x, rect.y)` would miss the target. */
async function canvasOffset(page: Page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
    if (!canvas) return { x: 0, y: 0 };
    const r = canvas.getBoundingClientRect();
    return { x: r.left, y: r.top };
  });
}

async function getKingdomState(page: Page) {
  return page.evaluate(() => {
    const game = (window as any).__phaserGame;
    if (!game) return null;
    const scene = game.scene.getScene('code-kingdom') as any;
    if (!scene) return null;

    return {
      sceneName: scene.scene?.key,
      available: scene.activity?.available,
      source: scene.activity?.source,
      activeSessions: scene.activity?.active_sessions,
      toolCalls: scene.activity?.total_tool_calls,
      sessionCount: scene.activity?.sessions?.length ?? 0,
      districtCount: scene.districts?.length ?? 0,
      selectedDistrict: scene.selectedDistrict,
      selectedSessionId: scene.selectedSession?.id,
      sessionPickerRows: scene.sessionPickerRows ?? [],
      activeEventPulseCount: scene.activeEventPulseCount ?? 0,
      districtEventBadges: scene.districtEventBadges ?? {},
      replayState: scene.replayState ?? { paused: false, cursor: 0, total: 0, atLive: true },
      replayPlayButton: scene.replayPlayButtonRect ?? null,
      replayLiveButton: scene.replayLiveButtonRect ?? null,
      replayTrack: scene.replayTrackRect ?? null,
      opsMode: scene.opsSummary?.mode,
      opsAttention: scene.opsSummary?.attention,
      opsRecommendation: scene.opsSummary?.recommendation,
      insightLabels: (scene.insightCards ?? []).map((card: any) => card.label),
      scannedSessions: scene.activity?.scanned_sessions,
      screenW: window.innerWidth,
      screenH: window.innerHeight,
      layout: scene.layout ? {
        leftX: scene.layout.leftX,
        panelW: scene.layout.panelW,
        rightX: scene.layout.rightX,
        rightW: scene.layout.rightW,
        opsY: scene.layout.opsY,
        opsH: scene.layout.opsH,
        bottomY: scene.layout.bottomY,
        bottomH: scene.layout.bottomH,
        inspectorX: scene.layout.inspectorX,
        inspectorW: scene.layout.inspectorW,
        districtR: scene.layout.districtR,
        compact: scene.layout.compact,
      } : null,
      districtRects: (scene.districts ?? []).map((d: any) => ({
        key: d.key, x: d.x, y: d.y,
      })),
    };
  });
}

test.describe('Kingdom of Agents — Startup', () => {
  test.beforeEach(async ({ page }) => {
    await installFixture(page);
    await page.goto(GAME_URL);
    await waitForGame(page);
  });

  test('renders Copilot CLI activity as kingdom insights', async ({ page }) => {
    const state = await getKingdomState(page);
    expect(state).not.toBeNull();
    expect(state!.sceneName).toBe('code-kingdom');
    expect(state!.available).toBe(true);
    expect(state!.source).toBe('playwright-fixture');
    expect(state!.activeSessions).toBe(2);
    expect(state!.toolCalls).toBe(47);
    expect(state!.sessionCount).toBe(3);
    expect(state!.districtCount).toBe(7);
    expect(state!.scannedSessions).toBe(3);
    expect(state!.insightLabels).toContain('Tokens');
    expect(state!.opsAttention).toBe('review');
    expect(state!.opsRecommendation).toMatch(/failed.*in /);
    expect(state!.selectedSessionId).toBe('beta4567');
  });

  test('top bar HUD elements are present', async ({ page }) => {
    await expect(page.locator('#topbar .brand')).toBeVisible();
    await expect(page.locator('#theme-btn')).toBeVisible();
  });
});

test.describe('Kingdom of Agents — Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await installFixture(page);
    await page.goto(GAME_URL);
    await waitForGame(page);
  });

  test('dashboard renders fixture activity without manual refresh', async ({ page }) => {
    const state = await getKingdomState(page);
    expect(state!.toolCalls).toBe(47);
    expect(state!.sessionCount).toBe(3);
  });

  test('recent events animate as pulses from the castle', async ({ page }) => {
    await page.waitForTimeout(800);
    const state = await getKingdomState(page);
    expect(state!.activeEventPulseCount).toBeGreaterThanOrEqual(0);
    expect(state!.sessionCount).toBe(3);
  });

  test('replay timeline ingests events into the log and stays live by default', async ({ page }) => {
    const state = await getKingdomState(page);
    expect(state!.replayState.total).toBe(4);
    expect(state!.replayState.cursor).toBe(4);
    expect(state!.replayState.atLive).toBe(true);
    expect(state!.replayState.paused).toBe(false);
    expect(state!.replayPlayButton).toBeTruthy();
    expect(state!.replayTrack).toBeTruthy();
  });

  test('clicking pause freezes replay; clicking live resumes', async ({ page }) => {
    const before = await getKingdomState(page);
    const playBtn = before!.replayPlayButton;
    expect(playBtn).toBeTruthy();
    const off = await canvasOffset(page);
    await page.mouse.click(off.x + playBtn.x + playBtn.w / 2, off.y + playBtn.y + playBtn.h / 2);
    await page.waitForTimeout(120);
    let state = await getKingdomState(page);
    expect(state!.replayState.paused).toBe(true);

    const liveBtn = state!.replayLiveButton;
    expect(liveBtn).toBeTruthy();
    await page.mouse.click(off.x + liveBtn.x + liveBtn.w / 2, off.y + liveBtn.y + liveBtn.h / 2);
    await page.waitForTimeout(120);
    state = await getKingdomState(page);
    expect(state!.replayState.paused).toBe(false);
    expect(state!.replayState.atLive).toBe(true);
  });

  test('clicking the timeline scrubs the cursor backward', async ({ page }) => {
    const before = await getKingdomState(page);
    expect(before!.replayState.total).toBe(4);
    const track = before!.replayTrack;
    expect(track).toBeTruthy();
    const off = await canvasOffset(page);
    await page.mouse.click(off.x + track.x + track.w * 0.25, off.y + track.y + track.h / 2);
    await page.waitForTimeout(120);
    const after = await getKingdomState(page);
    expect(after!.replayState.cursor).toBeLessThan(before!.replayState.cursor);
    expect(after!.replayState.atLive).toBe(false);
  });

  test('clicking a running session selects it for inspection', async ({ page }) => {
    const before = await getKingdomState(page);
    expect(before!.selectedSessionId).toBe('beta4567');
    const alphaRow = before!.sessionPickerRows.find((row: any) => row.id === 'alpha123');
    expect(alphaRow).toBeTruthy();

    const off = await canvasOffset(page);
    await page.mouse.click(off.x + alphaRow.x + alphaRow.w / 2, off.y + alphaRow.y + alphaRow.h / 2);
    await page.waitForTimeout(150);

    const after = await getKingdomState(page);
    expect(after!.selectedSessionId).toBe('alpha123');
  });
});

test.describe('Kingdom of Agents — Ops Rules', () => {
  test('reports idle when no sessions are active', async ({ page }) => {
    const fixture = {
      ...KINGDOM_FIXTURE,
      active_sessions: 0,
      sessions: KINGDOM_FIXTURE.sessions.map(session => ({ ...session, is_active: false, error_count: 0, status: 'idle' })),
      alerts: [],
    };
    await installFixture(page, fixture);
    await page.goto(GAME_URL);
    await waitForGame(page);

    const state = await getKingdomState(page);
    expect(state!.opsMode).toBe('Idle');
    expect(state!.opsAttention).toBe('ok');
    expect(state!.opsRecommendation).toContain('Safe to context-switch');
  });

  test('reports editing when active work is edit-heavy', async ({ page }) => {
    const fixture = {
      ...KINGDOM_FIXTURE,
      active_sessions: 1,
      sessions: [
        { ...KINGDOM_FIXTURE.sessions[0], is_active: true, error_count: 0, read_count: 1, write_count: 12, command_count: 1, web_count: 0, task_count: 0, status: 'working' },
      ],
      alerts: [],
    };
    await installFixture(page, fixture);
    await page.goto(GAME_URL);
    await waitForGame(page);

    const state = await getKingdomState(page);
    expect(state!.opsMode).toBe('Editing');
    expect(state!.opsAttention).toBe('watch');
    expect(state!.opsRecommendation).toContain('review diffs');
  });
});

const VIEWPORTS = [
  { name: '4k', width: 3840, height: 2160 },
  { name: '1080p', width: 1920, height: 1080 },
  { name: 'mbp14', width: 1512, height: 982 },
  { name: 'mbp13', width: 1440, height: 900 },
  { name: '720p', width: 1280, height: 720 },
  { name: 'small', width: 1024, height: 768 },
];

for (const vp of VIEWPORTS) {
  test(`Kingdom of Agents renders at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
    await installFixture(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto(GAME_URL);
    await waitForGame(page);

    const state = await getKingdomState(page);
    expect(state).not.toBeNull();
    expect(state!.screenW).toBe(vp.width);
    expect(state!.screenH).toBe(vp.height);
    expect(state!.sessionCount).toBe(3);
    expect(state!.districtCount).toBe(7);

    // Layout regression: districts must fit between side panels with at
    // least a small gutter, and inside the central well between the ops
    // strip and the bottom inspector. This catches the laptop overlap
    // bug where districts crashed into Selected Session / Activity Feed.
    const layout = state!.layout!;
    expect(layout).not.toBeNull();
    const leftPanelRight = layout.leftX + layout.panelW;
    const rightPanelLeft = layout.rightX;
    const wellTop = layout.opsY + layout.opsH;
    const wellBottom = layout.bottomY;
    for (const d of state!.districtRects) {
      const r = layout.districtR;
      expect(d.x - r, `district ${d.key} left edge crosses left panel`).toBeGreaterThanOrEqual(leftPanelRight);
      expect(d.x + r, `district ${d.key} right edge crosses right panel`).toBeLessThanOrEqual(rightPanelLeft);
      expect(d.y - r, `district ${d.key} top edge crosses ops strip`).toBeGreaterThanOrEqual(wellTop);
      expect(d.y + r, `district ${d.key} bottom edge crosses bottom inspector`).toBeLessThanOrEqual(wellBottom);
    }
  });
}
