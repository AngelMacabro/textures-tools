export type TilingAlgorithm = "crossBlend" | "mirror" | "patchMatch" | "offset";
export type TilingCurve = "linear" | "smooth" | "cubic";

export class TilingProcessor {
  /**
   * Main entry point for seamless processing
   */
  static process(
    canvas: HTMLCanvasElement,
    algorithm: TilingAlgorithm,
    blendAmount: number = 0.2,
    curve: TilingCurve = "smooth",
  ): HTMLCanvasElement {
    switch (algorithm) {
      case "mirror":
        return this.processMirrorTile(canvas, blendAmount, curve);
      case "patchMatch":
        return this.processPatchMatch(canvas, blendAmount, curve);
      case "offset":
        return this.processOffsetOnly(canvas);
      case "crossBlend":
      default:
        return this.processCrossBlend(canvas, blendAmount, curve);
    }
  }

  /**
   * Curve interpolation functions for smoother blending
   */
  private static applyCurve(t: number, curve: TilingCurve): number {
    switch (curve) {
      case "linear":
        return t;
      case "smooth":
        // Smoothstep: 3t² - 2t³
        return t * t * (3 - 2 * t);
      case "cubic":
        // Smoother step: 6t⁵ - 15t⁴ + 10t³
        return t * t * t * (t * (t * 6 - 15) + 10);
      default:
        return t;
    }
  }

  /**
   * Cross Blend Algorithm (Enhanced)
   * Best for organic textures, noise-based materials
   */
  static processCrossBlend(
    canvas: HTMLCanvasElement,
    blendAmount: number = 0.2,
    curve: TilingCurve = "smooth",
  ): HTMLCanvasElement {
    const w = canvas.width;
    const h = canvas.height;

    // Create offset image
    const offsetCanvas = document.createElement("canvas");
    offsetCanvas.width = w;
    offsetCanvas.height = h;
    const octx = offsetCanvas.getContext("2d")!;

    octx.drawImage(canvas, -w / 2, -h / 2);
    octx.drawImage(canvas, w / 2, -h / 2);
    octx.drawImage(canvas, -w / 2, h / 2);
    octx.drawImage(canvas, w / 2, h / 2);

    // Output canvas
    const output = document.createElement("canvas");
    output.width = w;
    output.height = h;
    const ctx = output.getContext("2d")!;
    ctx.drawImage(offsetCanvas, 0, 0);

    // Get image data for pixel-level blending with curve
    const offsetData = octx.getImageData(0, 0, w, h);
    const originalCtx = canvas.getContext("2d")!;
    const originalData = originalCtx.getImageData(0, 0, w, h);
    const outputData = ctx.getImageData(0, 0, w, h);

    const blendW = w * blendAmount;
    const blendH = h * blendAmount;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;

        // Calculate blend factor for horizontal seam (at y = h/2)
        const distY = Math.abs(y - h / 2);
        let alphaH = 0;
        if (distY < blendH) {
          alphaH = this.applyCurve(1 - distY / blendH, curve);
        }

        // Calculate blend factor for vertical seam (at x = w/2)
        const distX = Math.abs(x - w / 2);
        let alphaV = 0;
        if (distX < blendW) {
          alphaV = this.applyCurve(1 - distX / blendW, curve);
        }

        // Combine: use max for cross-blend
        const alpha = Math.max(alphaH, alphaV);

        // Blend original over offset
        for (let c = 0; c < 3; c++) {
          outputData.data[idx + c] =
            offsetData.data[idx + c] * (1 - alpha) +
            originalData.data[idx + c] * alpha;
        }
        outputData.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(outputData, 0, 0);
    return output;
  }

  /**
   * Mirror Tile Algorithm
   * Best for symmetric patterns, abstract designs
   */
  static processMirrorTile(
    canvas: HTMLCanvasElement,
    blendAmount: number = 0.1,
    curve: TilingCurve = "smooth",
  ): HTMLCanvasElement {
    const w = canvas.width;
    const h = canvas.height;

    const output = document.createElement("canvas");
    output.width = w;
    output.height = h;
    const ctx = output.getContext("2d")!;

    // Create 4 mirrored quadrants
    const halfW = w / 2;
    const halfH = h / 2;

    // Top-left: normal
    ctx.save();
    ctx.drawImage(canvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
    ctx.restore();

    // Top-right: horizontal flip
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
    ctx.restore();

    // Bottom-left: vertical flip
    ctx.save();
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.drawImage(canvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
    ctx.restore();

    // Bottom-right: both flips
    ctx.save();
    ctx.translate(w, h);
    ctx.scale(-1, -1);
    ctx.drawImage(canvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
    ctx.restore();

    // Optional: blend center to reduce mirror artifacts
    if (blendAmount > 0) {
      const blendW = w * blendAmount;
      const blendH = h * blendAmount;

      const outputData = ctx.getImageData(0, 0, w, h);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;

          // Softly blend near center lines
          const distX = Math.abs(x - halfW);
          const distY = Math.abs(y - halfH);

          if (distX < blendW && distY < blendH) {
            const fx = this.applyCurve(distX / blendW, curve);
            const fy = this.applyCurve(distY / blendH, curve);
            const factor = Math.min(fx, fy);

            // Slight desaturation at center to hide artifacts
            const avg =
              (outputData.data[idx] +
                outputData.data[idx + 1] +
                outputData.data[idx + 2]) /
              3;
            for (let c = 0; c < 3; c++) {
              outputData.data[idx + c] =
                outputData.data[idx + c] * factor + avg * (1 - factor);
            }
          }
        }
      }

      ctx.putImageData(outputData, 0, 0);
    }

    return output;
  }

  /**
   * Patch Match Algorithm (Simplified)
   * Best for structured textures with low-energy seam finding
   */
  static processPatchMatch(
    canvas: HTMLCanvasElement,
    blendAmount: number = 0.15,
    curve: TilingCurve = "smooth",
  ): HTMLCanvasElement {
    const w = canvas.width;
    const h = canvas.height;

    // Start with offset
    const offsetCanvas = document.createElement("canvas");
    offsetCanvas.width = w;
    offsetCanvas.height = h;
    const octx = offsetCanvas.getContext("2d")!;

    octx.drawImage(canvas, -w / 2, -h / 2);
    octx.drawImage(canvas, w / 2, -h / 2);
    octx.drawImage(canvas, -w / 2, h / 2);
    octx.drawImage(canvas, w / 2, h / 2);

    const offsetData = octx.getImageData(0, 0, w, h);
    const originalCtx = canvas.getContext("2d")!;
    const originalData = originalCtx.getImageData(0, 0, w, h);

    const output = document.createElement("canvas");
    output.width = w;
    output.height = h;
    const ctx = output.getContext("2d")!;
    const outputData = ctx.createImageData(w, h);

    // Calculate gradient magnitude for energy map
    const getEnergy = (data: ImageData, x: number, y: number): number => {
      if (x <= 0 || x >= w - 1 || y <= 0 || y >= h - 1) return 255;
      const idxL = (y * w + (x - 1)) * 4;
      const idxR = (y * w + (x + 1)) * 4;
      const idxU = ((y - 1) * w + x) * 4;
      const idxD = ((y + 1) * w + x) * 4;

      let energy = 0;
      for (let c = 0; c < 3; c++) {
        const dx = Math.abs(data.data[idxR + c] - data.data[idxL + c]);
        const dy = Math.abs(data.data[idxD + c] - data.data[idxU + c]);
        energy += dx + dy;
      }
      return energy / 3;
    };

    const blendW = Math.floor(w * blendAmount);
    const blendH = Math.floor(h * blendAmount);
    const centerX = Math.floor(w / 2);
    const centerY = Math.floor(h / 2);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;

        const distX = Math.abs(x - centerX);
        const distY = Math.abs(y - centerY);

        let alpha = 0;

        // Within blend zone, use energy-weighted blending
        if (distX < blendW || distY < blendH) {
          const energyOffset = getEnergy(offsetData, x, y);
          const energyOriginal = getEnergy(originalData, x, y);

          // Lower energy = smoother area = better for blending
          const energyFactor =
            energyOriginal / (energyOriginal + energyOffset + 1);

          const distFactor = Math.max(
            distX < blendW ? 1 - distX / blendW : 0,
            distY < blendH ? 1 - distY / blendH : 0,
          );

          alpha =
            this.applyCurve(distFactor, curve) * (0.5 + 0.5 * energyFactor);
        }

        for (let c = 0; c < 3; c++) {
          outputData.data[idx + c] =
            offsetData.data[idx + c] * (1 - alpha) +
            originalData.data[idx + c] * alpha;
        }
        outputData.data[idx + 3] = 255;
      }
    }

    ctx.putImageData(outputData, 0, 0);
    return output;
  }

  /**
   * Offset Only (No Blend)
   * Simple 50% offset for manual cleanup
   */
  static processOffsetOnly(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const w = canvas.width;
    const h = canvas.height;

    const output = document.createElement("canvas");
    output.width = w;
    output.height = h;
    const ctx = output.getContext("2d")!;

    ctx.drawImage(canvas, -w / 2, -h / 2);
    ctx.drawImage(canvas, w / 2, -h / 2);
    ctx.drawImage(canvas, -w / 2, h / 2);
    ctx.drawImage(canvas, w / 2, h / 2);

    return output;
  }

  /**
   * Legacy method for backwards compatibility
   */
  static processSeamless(
    canvas: HTMLCanvasElement,
    blendAmount: number = 0.2,
  ): HTMLCanvasElement {
    return this.processCrossBlend(canvas, blendAmount, "smooth");
  }
}
