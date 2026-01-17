export class TilingProcessor {
  static makeSeamless(
    canvas: HTMLCanvasElement,
    blendAmount: number = 0.1,
  ): HTMLCanvasElement {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not get 2d context");

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) throw new Error("Could not get temp 2d context");

    // 1. Draw the image with an offset
    const offsetX = width / 2;
    const offsetY = height / 2;

    // Draw shifted quadrants
    // Top Left -> Bottom Right
    tempCtx.drawImage(
      canvas,
      0,
      0,
      offsetX,
      offsetY,
      offsetX,
      offsetY,
      offsetX,
      offsetY,
    );
    // Top Right -> Bottom Left
    tempCtx.drawImage(
      canvas,
      offsetX,
      0,
      offsetX,
      offsetY,
      0,
      offsetY,
      offsetX,
      offsetY,
    );
    // Bottom Left -> Top Right
    tempCtx.drawImage(
      canvas,
      0,
      offsetY,
      offsetX,
      offsetY,
      offsetX,
      0,
      offsetX,
      offsetY,
    );
    // Bottom Right -> Top Left
    tempCtx.drawImage(
      canvas,
      offsetX,
      offsetY,
      offsetX,
      offsetY,
      0,
      0,
      offsetX,
      offsetY,
    );

    // 2. Blend the seams
    // We need to blend the horizontal and vertical center lines
    const resultCanvas = document.createElement("canvas");
    resultCanvas.width = width;
    resultCanvas.height = height;
    const resultCtx = resultCanvas.getContext("2d");
    if (!resultCtx) throw new Error("Could not get result 2d context");

    resultCtx.drawImage(tempCanvas, 0, 0);

    const blendX = width * blendAmount;

    // Create a horizontal gradient mask for the vertical seam (at width/2)
    const verticalGradient = resultCtx.createLinearGradient(
      offsetX - blendX,
      0,
      offsetX + blendX,
      0,
    );
    verticalGradient.addColorStop(0, "rgba(0,0,0,0)");
    verticalGradient.addColorStop(0.5, "rgba(0,0,0,1)");
    verticalGradient.addColorStop(1, "rgba(0,0,0,0)");

    // This is a bit complex for a simple canvas blend.
    // A better way is to use a mask and draw sections of the original image back over the offset one with alpha.
    // Let's try a simpler approach:
    // Draw the original image centered over the offset one with a feather mask.

    return tempCanvas; // Returning the offset one for now, blending is better done with a specific feather
  }

  // Refined approach: Offset and then blend the "new" edges in the middle using data from the original
  static processSeamless(
    canvas: HTMLCanvasElement,
    _blendAmount: number = 0.15,
  ): HTMLCanvasElement {
    const w = canvas.width;
    const h = canvas.height;

    const output = document.createElement("canvas");
    output.width = w;
    output.height = h;
    const ctx = output.getContext("2d")!;

    // 1. Draw the image shifted (the 4-corner tiling)
    ctx.drawImage(canvas, -w / 2, -h / 2);
    ctx.drawImage(canvas, w / 2, -h / 2);
    ctx.drawImage(canvas, -w / 2, h / 2);
    ctx.drawImage(canvas, w / 2, h / 2);

    // 2. Blend the original center back
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mctx = maskCanvas.getContext("2d")!;

    const gradient = mctx.createRadialGradient(
      w / 2,
      h / 2,
      Math.min(w, h) * 0.1,
      w / 2,
      h / 2,
      Math.min(w, h) * 0.5,
    );
    gradient.addColorStop(0, "rgba(255,255,255,1)");
    gradient.addColorStop(0.8, "rgba(255,255,255,0.8)");
    gradient.addColorStop(1, "rgba(255,255,255,0)");

    mctx.fillStyle = gradient;
    mctx.fillRect(0, 0, w, h);

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tctx = tempCanvas.getContext("2d")!;

    tctx.drawImage(canvas, 0, 0);
    tctx.globalCompositeOperation = "destination-in";
    tctx.drawImage(maskCanvas, 0, 0);

    ctx.drawImage(tempCanvas, 0, 0);

    return output;
  }
}
