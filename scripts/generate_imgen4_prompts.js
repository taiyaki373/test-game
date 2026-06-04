#!/usr/bin/env node
// generate_imgen4_prompts.js
// Emit imgen4 prompts for major sprite/background assets based on project spec.

const fs = require('fs');
const path = require('path');

const prompts = {
  playerShip: `[Subject: Player ship], hard-surface mechanical sci-fi, sleek futuristic jet, 8k, detailed greeble, green background #00FF00 --no humans --style photorealistic --aspect 2:1`,
  enemyShip: `[Subject: Enemy fighter], hostile alien interceptor, insectoid/mechanical hybrid, 8k, high detail, green background #00FF00 --no humans --style cinematic --aspect 2:1`,
  bossShip: `[Subject: Boss structure], massive orbital fortress, mechanical plates, glowing cores, 8k, detailed greeble, green background #00FF00 --no humans --style epic --aspect 3:2`,
  bgSpace: `[Subject: Deep space background], nebula layers, starfield, volumetric lighting, no characters, wide parallax-friendly, 8k, green background #00FF00 --no humans --style mattepainting --aspect 16:9`,
  bgFortress: `[Subject: Fortress interior exterior], industrial sci-fi stronghold, girders and catwalks, layered depth, 8k, green background #00FF00 --no humans --style conceptart --aspect 16:9`,
  bgNebula: `[Subject: Ionized nebula], colorful plasma clouds, high depth, stars and dust lanes, 8k, green background #00FF00 --no humans --style painterly --aspect 16:9`
};

const outDir = path.join(process.cwd(), 'imgen4-prompts');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

Object.entries(prompts).forEach(([name, prompt]) => {
  const file = path.join(outDir, `${name}.txt`);
  fs.writeFileSync(file, prompt);
  console.log(`Wrote ${file}`);
});

console.log('Prompt generation complete. Use these prompts with imgen4 to generate assets with green (#00FF00) background for chroma-key processing.');
