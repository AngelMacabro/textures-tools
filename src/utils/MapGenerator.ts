export interface MapOptions {
  intensity: number;
  contrast: number;
  invert: boolean;
  blur: number;
  tilingBlend: number;
  tilingAlgorithm: "crossBlend" | "mirror" | "patchMatch" | "offset";
  tilingCurve: "linear" | "smooth" | "cubic";
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

  static generateHeightMap(
    imageData: ImageData,
    contrast: number = 1,
  ): ImageData {
    const gray = this.toGrayscale(imageData);
    const data = gray.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < data.length; i += 4) {
      data[i] = factor * (data[i] - 128) + 128;
      data[i + 1] = factor * (data[i + 1] - 128) + 128;
      data[i + 2] = factor * (data[i + 2] - 128) + 128;
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

        // Sobel filter
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

        // Normalize
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const nx = dx / len;
        const ny = dy / len;
        const nz = dz / len;

        outData[idx] = (nx * 0.5 + 0.5) * 255;
        outData[idx + 1] = (ny * 0.5 + 0.5) * 255;
        outData[idx + 2] = nz * 255;
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
        data[i] = 255 - data[i];
        data[i + 1] = 255 - data[i + 1];
        data[i + 2] = 255 - data[i + 2];
      }
    }
    return gray;
  }

  static generateAOMap(imageData: ImageData, strength: number = 1): ImageData {
    // Basic AO implementation based on local height variance
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

        // Simple kernel for AO approximation
        for (let ky = -2; ky <= 2; ky++) {
          for (let kx = -2; kx <= 2; kx++) {
            const ny = Math.min(height - 1, Math.max(0, y + ky));
            const nx = Math.min(width - 1, Math.max(0, x + kx));
            sum += gray[(ny * width + nx) * 4];
            count++;
          }
        }

        const avg = sum / count;
        const diff = Math.max(0, avg - center) * strength;
        const val = Math.max(0, 255 - diff);

        outData[idx] = val;
        outData[idx + 1] = val;
        outData[idx + 2] = val;
        outData[idx + 3] = 255;
      }
    }
    return output;
  }
}
