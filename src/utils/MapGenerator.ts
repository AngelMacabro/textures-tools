export interface MapOptions {
  intensity: number;
  contrast: number;
  invert: boolean;
  blur: number;
  tilingBlend: number;
  tilingAlgorithm: "crossBlend" | "mirror" | "patchMatch" | "offset";
  tilingCurve: "linear" | "smooth" | "cubic";
  // Advanced Features
  brightness: number;
  saturation: number;
  hue: number;
  isMetallic: boolean;
  metalnessBase: number;
  delightAmount: number;
  tintColor: string;
  enableTint: boolean;
}

export class MapGenerator {
  static getImageData(canvas: HTMLCanvasElement): ImageData {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context");
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  static putImageData(canvas: HTMLCanvasElement, imageData: ImageData) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context");
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
  }

  static toGrayscale(imageData: ImageData): ImageData {
    const data = imageData.data;
    const output = new ImageData(imageData.width, imageData.height);
    const outData = output.data;

    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      outData[i] = avg;
      outData[i + 1] = avg;
      outData[i + 2] = avg;
      outData[i + 3] = data[i + 3];
    }
    return output;
  }

  static applyColorCorrection(
    imageData: ImageData,
    opts: Partial<MapOptions>,
  ): ImageData {
    const output = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height,
    );
    const data = output.data;

    const brightness = (opts.brightness || 0) / 100;
    const contrast = (opts.contrast || 0) / 100;
    const saturation = (opts.saturation || 0) / 100;
    const hue = opts.hue || 0;
    const delight = (opts.delightAmount || 0) / 100;

    const contrastFactor =
      (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // 1. Basic Delighting (Simulated by normalizing highlights)
      if (delight > 0) {
        const avg = (r + g + b) / 3;
        r = r + (avg - r) * delight * 0.5;
        g = g + (avg - g) * delight * 0.5;
        b = b + (avg - b) * delight * 0.5;
      }

      // 2. Brightness
      r += brightness * 255;
      g += brightness * 255;
      b += brightness * 255;

      // 3. Contrast
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;

      // 4. Saturation & Hue (Simplified conversion)
      const gray = 0.2989 * r + 0.587 * g + 0.114 * b;
      r = gray + (r - gray) * (1 + saturation);
      g = gray + (g - gray) * (1 + saturation);
      b = gray + (b - gray) * (1 + saturation);

      // Simple Hue rotation (approximation)
      if (Math.abs(hue) > 0) {
        const angle = (hue * Math.PI) / 180;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const nr =
          (0.213 + cosA * 0.787 - sinA * 0.213) * r +
          (0.715 - cosA * 0.715 - sinA * 0.715) * g +
          (0.072 - cosA * 0.072 + sinA * 0.928) * b;
        const ng =
          (0.213 - cosA * 0.213 + sinA * 0.143) * r +
          (0.715 + cosA * 0.285 + sinA * 0.14) * g +
          (0.072 - cosA * 0.072 - sinA * 0.283) * b;
        const nb =
          (0.213 - cosA * 0.213 - sinA * 0.787) * r +
          (0.715 - cosA * 0.715 + sinA * 0.715) * g +
          (0.072 + cosA * 0.928 + sinA * 0.072) * b;
        r = nr;
        g = ng;
        b = nb;
      }

      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
    }
    return output;
  }

  static generateHeightMap(
    imageData: ImageData,
    contrast: number = 0,
  ): ImageData {
    const gray = this.toGrayscale(imageData);
    const data = gray.data;
    // Map contrast range -1 to 1 to Sobel-friendly range
    const c = contrast * 128;
    const factor = (259 * (c + 255)) / (255 * (259 - c));

    for (let i = 0; i < data.length; i += 4) {
      const val = factor * (data[i] - 128) + 128;
      data[i] = data[i + 1] = data[i + 2] = Math.min(255, Math.max(0, val));
    }
    return gray;
  }

  static generateNormalMap(
    imageData: ImageData,
    strength: number = 1,
  ): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const gray = this.toGrayscale(imageData).data;
    const output = new ImageData(width, height);
    const outData = output.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        const xLeft = x > 0 ? x - 1 : x;
        const xRight = x < width - 1 ? x + 1 : x;
        const yUp = y > 0 ? y - 1 : y;
        const yDown = y < height - 1 ? y + 1 : y;

        const val00 = gray[(yUp * width + xLeft) * 4];
        const val10 = gray[(yUp * width + x) * 4];
        const val20 = gray[(yUp * width + xRight) * 4];
        const val01 = gray[(y * width + xLeft) * 4];
        const val21 = gray[(y * width + xRight) * 4];
        const val02 = gray[(yDown * width + xLeft) * 4];
        const val12 = gray[(yDown * width + x) * 4];
        const val22 = gray[(yDown * width + xRight) * 4];

        const dx = val20 + 2 * val21 + val22 - (val00 + 2 * val01 + val02);
        const dy = val02 + 2 * val12 + val22 - (val00 + 2 * val10 + val20);
        const dz = 255 / strength;

        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        outData[idx] = ((dx / len) * 0.5 + 0.5) * 255;
        outData[idx + 1] = ((dy / len) * 0.5 + 0.5) * 255;
        outData[idx + 2] = (dz / len) * 255;
        outData[idx + 3] = 255;
      }
    }
    return output;
  }

  static generateRoughnessMap(
    imageData: ImageData,
    invert: boolean = false,
  ): ImageData {
    const gray = this.toGrayscale(imageData);
    const data = gray.data;

    if (invert) {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = data[i + 1] = data[i + 2] = 255 - data[i];
      }
    }
    return gray;
  }

  static generateAOMap(imageData: ImageData, strength: number = 1): ImageData {
    const width = imageData.width;
    const height = imageData.height;
    const gray = this.toGrayscale(imageData).data;
    const output = new ImageData(width, height);
    const outData = output.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const center = gray[idx];
        let sum = 0;
        let count = 0;

        for (let ky = -2; ky <= 2; ky++) {
          for (let kx = -2; kx <= 2; kx++) {
            const ny = Math.min(height - 1, Math.max(0, y + ky));
            const nx = Math.min(width - 1, Math.max(0, x + kx));
            sum += gray[(ny * width + nx) * 4];
            count++;
          }
        }

        const avg = sum / count;
        const diff = Math.max(0, avg - center) * (strength * 2);
        const val = Math.max(0, 255 - diff);

        outData[idx] = outData[idx + 1] = outData[idx + 2] = val;
        outData[idx + 3] = 255;
      }
    }
    return output;
  }

  static generateMetalnessMap(
    imageData: ImageData,
    isMetallic: boolean,
    baseVal: number,
  ): ImageData {
    const output = new ImageData(imageData.width, imageData.height);
    const outData = output.data;
    const gray = this.toGrayscale(imageData).data;

    for (let i = 0; i < outData.length; i += 4) {
      // If it's a metallic surface, dark areas are likely non-metal (dirt/rust), bright are metal
      const val = isMetallic ? (gray[i] * baseVal) / 255 : 0;
      outData[i] = outData[i + 1] = outData[i + 2] = val;
      outData[i + 3] = 255;
    }
    return output;
  }

  static generateCurvatureMap(normalData: ImageData): ImageData {
    const width = normalData.width;
    const height = normalData.height;
    const data = normalData.data;
    const output = new ImageData(width, height);
    const outData = output.data;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        const xLeft = x > 0 ? x - 1 : x;
        const xRight = x < width - 1 ? x + 1 : x;
        const yUp = y > 0 ? y - 1 : y;
        const yDown = y < height - 1 ? y + 1 : y;

        const nxL = (data[(y * width + xLeft) * 4] / 255) * 2 - 1;
        const nxR = (data[(y * width + xRight) * 4] / 255) * 2 - 1;
        const nyU = (data[(yUp * width + x) * 4 + 1] / 255) * 2 - 1;
        const nyD = (data[(yDown * width + x) * 4 + 1] / 255) * 2 - 1;

        // Curvature is the divergence of the normal field
        const curv = (nxR - nxL + (nyD - nyU)) * 0.5;
        const val = (curv * 0.5 + 0.5) * 255;

        outData[idx] = outData[idx + 1] = outData[idx + 2] = val;
        outData[idx + 3] = 255;
      }
    }
    return output;
  }
}
