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

  /**
   * Refined approach: Offset-and-blend using a cross-mask.
   * This provides much better results for structured textures than the radial approach.
   */
  static processSeamless(
    canvas: HTMLCanvasElement,
    blendAmount: number = 0.2,
  ): HTMLCanvasElement {
    const w = canvas.width;
    const h = canvas.height;

    // 1. Create the offset (shifted) image
    const offsetCanvas = document.createElement("canvas");
    offsetCanvas.width = w;
    offsetCanvas.height = h;
    const octx = offsetCanvas.getContext("2d")!;

    // Draw shifted quadrants
    octx.drawImage(canvas, -w / 2, -h / 2);
    octx.drawImage(canvas, w / 2, -h / 2);
    octx.drawImage(canvas, -w / 2, h / 2);
    octx.drawImage(canvas, w / 2, h / 2);

    // 2. Prepare output
    const output = document.createElement("canvas");
    output.width = w;
    output.height = h;
    const ctx = output.getContext("2d")!;

    // Start with the offset image
    ctx.drawImage(offsetCanvas, 0, 0);

    // 3. Create a mask for blending
    // We want to draw the ORIGINAL image over the seams of the OFFSET image.
    // The seams of the offset image are in the center.
    // Wait, better yet: The original image HAS NO SEAMS.
    // The offset image HAS SEAMS in the middle.
    // So we draw the original image over the center of the offset image,
    // but the original image itself becomes the "filling" for the seams.

    const blendWidth = w * blendAmount;
    const blendHeight = h * blendAmount;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tctx = tempCanvas.getContext("2d")!;

    // Create a smooth cross-mask
    // Horizontal part of the cross
    const hGrad = tctx.createLinearGradient(
      0,
      h / 2 - blendHeight,
      0,
      h / 2 + blendHeight,
    );
    hGrad.addColorStop(0, "rgba(255,255,255,0)");
    hGrad.addColorStop(0.5, "rgba(255,255,255,1)");
    hGrad.addColorStop(1, "rgba(255,255,255,0)");

    // Vertical part of the cross
    const vGrad = tctx.createLinearGradient(
      w / 2 - blendWidth,
      0,
      w / 2 + blendWidth,
      0,
    );
    vGrad.addColorStop(0, "rgba(255,255,255,0)");
    vGrad.addColorStop(0.5, "rgba(255,255,255,1)");
    vGrad.addColorStop(1, "rgba(255,255,255,0)");

    // Draw the original image onto output using these gradients as masks
    // This is best done by blending strips

    // Draw horizontal seam bridge
    ctx.globalAlpha = 1.0;
    const hMask = document.createElement("canvas");
    hMask.width = w;
    hMask.height = h;
    const hMctx = hMask.getContext("2d")!;
    hMctx.fillStyle = hGrad;
    hMctx.fillRect(0, 0, w, h);

    const hStrip = document.createElement("canvas");
    hStrip.width = w;
    hStrip.height = h;
    const hSctx = hStrip.getContext("2d")!;
    hSctx.drawImage(canvas, 0, 0);
    hSctx.globalCompositeOperation = "destination-in";
    hSctx.drawImage(hMask, 0, 0);

    ctx.drawImage(hStrip, 0, 0);

    // Draw vertical seam bridge
    const vMask = document.createElement("canvas");
    vMask.width = w;
    vMask.height = h;
    const vMctx = vMask.getContext("2d")!;
    vMctx.fillStyle = vGrad;
    vMctx.fillRect(0, 0, w, h);

    const vStrip = document.createElement("canvas");
    vStrip.width = w;
    vStrip.height = h;
    const vSctx = vStrip.getContext("2d")!;
    vSctx.drawImage(canvas, 0, 0);
    vSctx.globalCompositeOperation = "destination-in";
    vSctx.drawImage(vMask, 0, 0);

    ctx.drawImage(vStrip, 0, 0);

    return output;
  }
}
