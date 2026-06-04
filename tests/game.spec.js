import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test('Aegis Vanguard E2E Visual and Collision Probe Test', async ({ page }) => {
  test.setTimeout(60000);
  const consoleErrors = [];
  
  // Track console errors and redirect to terminal
  page.on('console', msg => {
    console.log(`[Browser Console - ${msg.type()}]: ${msg.text()}`);
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
  });

  // 1. Load the game (通常モード)
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Verify Title Screen is active
  const titleScreen = page.locator('#title-screen');
  await expect(titleScreen).toHaveClass(/active/);
  
  const screenshotsDir = path.join(process.cwd(), 'test-results', 'screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
  
  await page.screenshot({ path: path.join(screenshotsDir, '01_title_screen.png') });

  // 2. Start Mission
  const startBtn = page.locator('#btn-start');
  await startBtn.click();
  await expect(titleScreen).not.toHaveClass(/active/);

  // Wait for game start state
  await page.waitForFunction(() => window.gameInstance && window.gameInstance.state === 'PLAYING');
  await page.screenshot({ path: path.join(screenshotsDir, '02_stage1_start.png') });

  // Wait for Stage 1 Boss to spawn and be in FIGHTING state
  await page.waitForFunction(() => 
    window.gameInstance && 
    window.gameInstance.boss !== null && 
    window.gameInstance.boss.state === 'FIGHTING',
    { timeout: 20000 }
  );
  
  await page.screenshot({ path: path.join(screenshotsDir, '04_stage1_boss_spawned.png') });

  // 3. Collision Probe Verification Test
  const probeResult = await page.evaluate(() => {
    const g = window.gameInstance;
    const b = g.boss;
    const initialHp = b.hp;
    
    // Position a bullet directly moving towards boss core center
    const coreX = b.x + b.weakCore.relX;
    const coreY = b.y + b.weakCore.relY;
    
    g.bullets.push({
      x: coreX - 15,
      y: coreY,
      w: 20,
      h: 6,
      velX: 5,
      velY: 0,
      isEnemy: false
    });
    
    // Force a collision check frame
    g.checkCollisions();
    
    return {
      initialHp,
      postHp: b.hp,
      hitFlash: b.hitFlash
    };
  });

  console.log(`Collision Probe: Initial Boss HP = ${probeResult.initialHp}, Post HP = ${probeResult.postHp}, Flash = ${probeResult.hitFlash}`);
  expect(probeResult.postHp).toBeLessThan(probeResult.initialHp);
  expect(probeResult.hitFlash).toBeGreaterThan(0);

  // Defeat Stage 1 Boss
  await page.evaluate(() => {
    window.gameInstance.boss.hp = 0;
  });
  
  // Wait for Stage 2 start
  await page.waitForFunction(() => window.gameInstance && window.gameInstance.stage === 2 && !window.gameInstance.boss, { timeout: 10000 });
  await page.screenshot({ path: path.join(screenshotsDir, '05_stage2_start.png') });

  // Wait for Stage 2 Boss
  await page.waitForFunction(() => 
    window.gameInstance && 
    window.gameInstance.boss !== null && 
    window.gameInstance.boss.state === 'FIGHTING',
    { timeout: 20000 }
  );
  await page.screenshot({ path: path.join(screenshotsDir, '06_stage2_boss.png') });

  // Defeat Stage 2 Boss
  await page.evaluate(() => {
    window.gameInstance.boss.hp = 0;
  });

  // Wait for Stage 3 start
  await page.waitForFunction(() => window.gameInstance && window.gameInstance.stage === 3 && !window.gameInstance.boss, { timeout: 10000 });
  await page.screenshot({ path: path.join(screenshotsDir, '07_stage3_start.png') });

  // Wait for Stage 3 Boss
  await page.waitForFunction(() => 
    window.gameInstance && 
    window.gameInstance.boss !== null && 
    window.gameInstance.boss.state === 'FIGHTING',
    { timeout: 20000 }
  );
  await page.screenshot({ path: path.join(screenshotsDir, '08_stage3_boss.png') });

  // Defeat Stage 3 Boss
  await page.evaluate(() => {
    window.gameInstance.boss.hp = 0;
  });

  // Wait for Game Clear screen
  await page.waitForFunction(() => window.gameInstance && window.gameInstance.state === 'CLEAR', { timeout: 10000 });
  await page.screenshot({ path: path.join(screenshotsDir, '09_game_clear.png') });

  // Verify Clear Overlay is active
  const clearOverlay = page.locator('#clear-screen');
  await expect(clearOverlay).toHaveClass(/active/);

  // 4. Assert no browser console errors occurred
  expect(consoleErrors.length).toBe(0);
});
