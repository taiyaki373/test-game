// Procedural Pixel Art Renderers for Fallback Mode

export function drawPlayerFallback(ctx, x, y, w, h, bank = 0, frameCount = 0) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  
  // Apply bank rotation (bank is -1 to 1)
  ctx.rotate(bank * 0.15);

  // Engine flame pulsation
  const flameLength = 15 + Math.sin(frameCount * 0.3) * 6;
  const flameGrad = ctx.createLinearGradient(-w / 2, 0, -w / 2 - flameLength, 0);
  flameGrad.addColorStop(0, '#ffffff');
  flameGrad.addColorStop(0.3, '#33ccff');
  flameGrad.addColorStop(1, 'rgba(0, 0, 255, 0)');
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.25);
  ctx.lineTo(-w / 2 - flameLength, 0);
  ctx.lineTo(-w / 2, h * 0.25);
  ctx.closePath();
  ctx.fill();

  // Ship Body (Sleek futuristic jet - blue/silver)
  const bodyGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  bodyGrad.addColorStop(0, '#113366');
  bodyGrad.addColorStop(0.5, '#336699');
  bodyGrad.addColorStop(1, '#99ccff');
  ctx.fillStyle = bodyGrad;
  
  ctx.beginPath();
  ctx.moveTo(-w / 2, -h * 0.3); // Tail
  ctx.lineTo(w / 2, 0);         // Nose
  ctx.lineTo(-w / 2, h * 0.3);  // Tail
  ctx.lineTo(-w * 0.2, 0);
  ctx.closePath();
  ctx.fill();

  // Wings (Metallic wings)
  ctx.fillStyle = '#0055aa';
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, -h * 0.1);
  ctx.lineTo(-w * 0.4, -h * 0.5); // Top wingtip
  ctx.lineTo(0, -h * 0.1);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-w * 0.3, h * 0.1);
  ctx.lineTo(-w * 0.4, h * 0.5); // Bottom wingtip
  ctx.lineTo(0, h * 0.1);
  ctx.closePath();
  ctx.fill();

  // Cockpit canopy (Glowing orange-cyan glass)
  ctx.fillStyle = '#ff6600';
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.1);
  ctx.lineTo(w * 0.25, 0);
  ctx.lineTo(0, h * 0.1);
  ctx.lineTo(-w * 0.1, 0);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export function drawEnemyFallback(ctx, x, y, w, h, type = 0, frameCount = 0) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);

  // Pulsating engine exhaust (facing right, moves left, so flame points right, wait, enemies move left, so flame points right)
  const flameLength = 8 + Math.sin(frameCount * 0.4) * 4;
  const flameGrad = ctx.createLinearGradient(w / 2, 0, w / 2 + flameLength, 0);
  flameGrad.addColorStop(0, '#ffffff');
  flameGrad.addColorStop(0.3, '#00ccff');
  flameGrad.addColorStop(1, 'rgba(0, 204, 255, 0)');
  ctx.fillStyle = flameGrad;
  ctx.beginPath();
  ctx.moveTo(w / 2, -h * 0.15);
  ctx.lineTo(w / 2 + flameLength, 0);
  ctx.lineTo(w / 2, h * 0.15);
  ctx.closePath();
  ctx.fill();

  if (type === 0) {
    // Standard fighter: sharp, alien purple/dark red
    ctx.fillStyle = '#660066';
    ctx.beginPath();
    ctx.moveTo(w / 2, -h * 0.2);
    ctx.lineTo(-w / 2, 0); // Nose facing left
    ctx.lineTo(w / 2, h * 0.2);
    ctx.lineTo(w * 0.1, 0);
    ctx.closePath();
    ctx.fill();

    // Spikey wings
    ctx.fillStyle = '#aa0044';
    ctx.beginPath();
    ctx.moveTo(w * 0.1, 0);
    ctx.lineTo(w * 0.3, -h * 0.45);
    ctx.lineTo(-w * 0.1, 0);
    ctx.lineTo(w * 0.3, h * 0.45);
    ctx.closePath();
    ctx.fill();
    
    // Core glow
    ctx.fillStyle = '#00ccff';
    ctx.beginPath();
    ctx.arc(0, 0, w * 0.12, 0, Math.PI * 2);
    ctx.fill();

  } else if (type === 1) {
    // Fast scout: Yellow/cyan insectoid design
    ctx.fillStyle = '#008888';
    ctx.beginPath();
    ctx.moveTo(w * 0.4, -h * 0.1);
    ctx.lineTo(-w / 2, -h * 0.2); // Double prong nose
    ctx.lineTo(-w * 0.2, 0);
    ctx.lineTo(-w / 2, h * 0.2);
    ctx.lineTo(w * 0.4, h * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#00ffcc';
    ctx.beginPath();
    ctx.arc(w * 0.1, 0, w * 0.1, 0, Math.PI * 2);
    ctx.fill();
    
  } else {
    // Heavy bomber / Carrier: bulky grey armor with green glowing nodes
    ctx.fillStyle = '#444444';
    ctx.fillRect(-w / 2, -h * 0.35, w, h * 0.7);

    // Front armor plate
    ctx.fillStyle = '#222222';
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h * 0.35);
    ctx.lineTo(-w * 0.1, 0);
    ctx.lineTo(-w / 2, h * 0.35);
    ctx.closePath();
    ctx.fill();

    // Glowing shield nodes
    ctx.fillStyle = '#33ff33';
    ctx.fillRect(w * 0.1, -h * 0.25, w * 0.15, h * 0.1);
    ctx.fillRect(w * 0.1, h * 0.15, w * 0.15, h * 0.1);
  }

  ctx.restore();
}

export function drawBossFallback(ctx, x, y, w, h, stage = 1, frameCount = 0, hitFlash = false) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);

  // Hit flash overlay
  if (hitFlash) {
    ctx.fillStyle = frameCount % 2 === 0 ? '#ffffff' : '#00ccff';
  } else {
    const mainGrad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    if (stage === 1) {
      mainGrad.addColorStop(0, '#333344');
      mainGrad.addColorStop(0.5, '#555566');
      mainGrad.addColorStop(1, '#111122');
    } else if (stage === 2) {
      mainGrad.addColorStop(0, '#553311');
      mainGrad.addColorStop(0.5, '#775533');
      mainGrad.addColorStop(1, '#332211');
    } else {
      mainGrad.addColorStop(0, '#112211');
      mainGrad.addColorStop(0.5, '#224422');
      mainGrad.addColorStop(1, '#051105');
    }
    ctx.fillStyle = mainGrad;
  }

  // Giant orbital structure
  ctx.beginPath();
  ctx.moveTo(w / 2, -h * 0.15);
  ctx.lineTo(w * 0.2, -h * 0.45);
  ctx.lineTo(-w * 0.4, -h * 0.45);
  ctx.lineTo(-w / 2, -h * 0.1);
  ctx.lineTo(-w / 2, h * 0.1);
  ctx.lineTo(-w * 0.4, h * 0.45);
  ctx.lineTo(w * 0.2, h * 0.45);
  ctx.lineTo(w / 2, h * 0.15);
  ctx.closePath();
  ctx.fill();

  // Draw panel lines and details
  if (!hitFlash) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Specific Stage designs
    if (stage === 1) {
      // Stage 1 Boss: Multiple gun turrets on the back
      ctx.fillStyle = '#00ccff';
      ctx.beginPath();
      ctx.arc(-w * 0.1, 0, w * 0.12, 0, Math.PI * 2); // Weak Point Core
      ctx.fill();
      
      // Core ring glow
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 + Math.sin(frameCount * 0.2) * 2;
      ctx.beginPath();
      ctx.arc(-w * 0.1, 0, w * 0.12, 0, Math.PI * 2);
      ctx.stroke();
    } else if (stage === 2) {
      // Stage 2 Boss: Rotating shield plates / heavy thruster engines
      ctx.fillStyle = '#ccff00';
      ctx.beginPath();
      ctx.arc(-w * 0.15, -h * 0.15, w * 0.08, 0, Math.PI * 2); // Core 1
      ctx.arc(-w * 0.15, h * 0.15, w * 0.08, 0, Math.PI * 2);  // Core 2
      ctx.fill();
    } else {
      // Stage 3 Final Boss: Bio-mechanical ion core
      ctx.fillStyle = '#cc00ff';
      ctx.beginPath();
      ctx.moveTo(-w * 0.2, 0);
      ctx.lineTo(0, -h * 0.2);
      ctx.lineTo(w * 0.2, 0);
      ctx.lineTo(0, h * 0.2);
      ctx.closePath();
      ctx.fill();
      
      // Plasma electricity arcs around core
      if (frameCount % 3 === 0) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-w * 0.2, 0);
        ctx.lineTo(Math.random() * w * 0.4 - w * 0.2, Math.random() * h * 0.4 - h * 0.2);
        ctx.lineTo(w * 0.2, 0);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

export function drawCapsuleFallback(ctx, x, y, w, h, isFake = false, frameCount = 0) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);

  // Outer glow
  const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, w / 2);
  if (isFake) {
    grad.addColorStop(0, '#00ccff');
    grad.addColorStop(0.6, '#330000');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  } else {
    // Normal capsules cycle through orange/cyan
    const cycle = (frameCount % 60) / 60;
    const color1 = `hsl(${cycle * 360}, 100%, 70%)`;
    const color2 = `hsl(${cycle * 360}, 100%, 30%)`;
    grad.addColorStop(0, color1);
    grad.addColorStop(0.6, color2);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, w / 2, 0, Math.PI * 2);
  ctx.fill();

  // Inner capsule pill
  ctx.fillStyle = isFake ? '#000000' : '#ffffff';
  ctx.strokeStyle = isFake ? '#8844aa' : '#00ffff';
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.roundRect(-w * 0.35, -h * 0.18, w * 0.7, h * 0.36, w * 0.18);
  ctx.fill();
  ctx.stroke();

  // Text identifier
  ctx.fillStyle = isFake ? '#8844aa' : '#000000';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isFake ? 'X' : 'P', 0, 0);

  ctx.restore();
}

export function drawShieldFallback(ctx, x, y, w, h, hp) {
  ctx.save();
  ctx.strokeStyle = hp > 1 ? '#00ffff' : '#8844aa';
  ctx.lineWidth = 3 + Math.sin(Date.now() * 0.01) * 1.5;
  ctx.fillStyle = hp > 1 ? 'rgba(0, 255, 255, 0.08)' : 'rgba(255, 0, 50, 0.08)';

  // Draw semi-circle shell in front of player
  ctx.beginPath();
  ctx.arc(x + w * 0.7, y + h / 2, w * 0.8, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.fill();
  ctx.restore();
}
