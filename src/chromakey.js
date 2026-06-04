export function applyChromaKey(image, callback) {
  // Ensure image is loaded
  if (!image.complete) {
    image.onload = () => process(image);
    return;
  }
  process(image);

  function process(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Green detection function (tuned for generated #00FF00 background)
    const isGreen = (r, g, b) => {
      // High green intensity, lower red/blue
      return g > 120 && g > r * 1.4 && g > b * 1.4;
    };

    // First pass: Mark green pixels and pre-existing transparent pixels
    const mask = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      const idx = i / 4;

      if (a === 0 || isGreen(r, g, b)) {
        mask[idx] = 1; // Mark as transparent candidate
      }
    }

    // Second pass: 1px inner clip (boundary erosion)
    // Identify non-green pixels adjacent to green/transparent pixels and mark them for transparency
    const clipMask = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (mask[idx] === 0) {
          // Check 8-neighborhood
          let isBoundary = false;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nidx = ny * width + nx;
                if (mask[nidx] === 1) {
                  isBoundary = true;
                  break;
                }
              } else {
                // Border pixels are also boundaries
                isBoundary = true;
                break;
              }
            }
            if (isBoundary) break;
          }
          if (isBoundary) {
            clipMask[idx] = 1; // Mark for clearing
          }
        }
      }
    }

    // Third pass: Apply transparency
    for (let i = 0; i < data.length; i += 4) {
      const idx = i / 4;
      if (mask[idx] === 1 || clipMask[idx] === 1) {
        data[i + 3] = 0; // Alpha = 0 (Transparent)
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Create a new image source from canvas
    const processedImg = new Image();
    processedImg.src = canvas.toDataURL('image/png');
    processedImg.onload = () => {
      callback(processedImg);
    };
    processedImg.onerror = () => {
      // Fallback: use canvas itself or trigger error
      callback(canvas);
    };
  }
}
