import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import JSZip from "jszip";
import { MapGenerator } from "./utils/MapGenerator";
import type { MapOptions } from "./utils/MapGenerator";
import { TilingProcessor } from "./utils/TilingProcessor";
import ThreeViewer from "./components/ThreeViewer";

export default function App() {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [isSeamless, setIsSeamless] = useState(false);
  const [showTiled, setShowTiled] = useState(false);
  const [prefix, setPrefix] = useState("texture");
  const [isDownloading, setIsDownloading] = useState(false);
  const [options, setOptions] = useState<MapOptions>({
    intensity: 1,
    contrast: 0,
    invert: false,
    blur: 0,
    tilingBlend: 0.15,
    tilingAlgorithm: "crossBlend",
    tilingCurve: "smooth",
    brightness: 0,
    saturation: 0,
    hue: 0,
    isMetallic: false,
    metalnessBase: 1.0,
    delightAmount: 0,
  });

  const baseRef = useRef<HTMLCanvasElement>(null);
  const normalRef = useRef<HTMLCanvasElement>(null);
  const heightRef = useRef<HTMLCanvasElement>(null);
  const roughnessRef = useRef<HTMLCanvasElement>(null);
  const aoRef = useRef<HTMLCanvasElement>(null);
  const metalnessRef = useRef<HTMLCanvasElement>(null);
  const curvatureRef = useRef<HTMLCanvasElement>(null);

  const canvasRefs = useMemo(
    () => ({
      base: baseRef,
      normal: normalRef,
      height: heightRef,
      roughness: roughnessRef,
      ao: aoRef,
      metalness: metalnessRef,
      curvature: curvatureRef,
    }),
    [],
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setSourceImage(img);
        processMaps(img, options, isSeamless);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const processMaps = useCallback(
    (img: HTMLImageElement, opts: MapOptions, seamless: boolean) => {
      if (!img) return;

      const offscreen = document.createElement("canvas");
      offscreen.width = img.width;
      offscreen.height = img.height;
      const oCtx = offscreen.getContext("2d");
      if (!oCtx) return;
      oCtx.drawImage(img, 0, 0);

      const baseRef = canvasRefs.base.current;
      if (!baseRef) return;
      baseRef.width = img.width;
      baseRef.height = img.height;
      const bCtx = baseRef.getContext("2d");
      if (!bCtx) return;

      if (seamless) {
        const seamlessCanvas = TilingProcessor.process(
          offscreen,
          opts.tilingAlgorithm,
          opts.tilingBlend,
          opts.tilingCurve,
        );
        oCtx.drawImage(seamlessCanvas, 0, 0);
      }

      const fullImgData = oCtx.getImageData(0, 0, img.width, img.height);
      const correctedData = MapGenerator.applyColorCorrection(
        fullImgData,
        opts,
      );
      bCtx.putImageData(correctedData, 0, 0);

      const currentImageData = correctedData;

      const heightData = MapGenerator.generateHeightMap(
        currentImageData,
        opts.contrast,
      );
      if (canvasRefs.height.current)
        MapGenerator.putImageData(canvasRefs.height.current, heightData);

      const normalData = MapGenerator.generateNormalMap(
        currentImageData,
        opts.intensity,
      );
      if (canvasRefs.normal.current)
        MapGenerator.putImageData(canvasRefs.normal.current, normalData);

      const roughnessData = MapGenerator.generateRoughnessMap(
        currentImageData,
        opts.invert,
      );
      if (canvasRefs.roughness.current)
        MapGenerator.putImageData(canvasRefs.roughness.current, roughnessData);

      const aoData = MapGenerator.generateAOMap(
        currentImageData,
        opts.intensity,
      );
      if (canvasRefs.ao.current)
        MapGenerator.putImageData(canvasRefs.ao.current, aoData);

      const metalData = MapGenerator.generateMetalnessMap(
        currentImageData,
        opts.isMetallic,
        opts.metalnessBase,
      );
      if (canvasRefs.metalness.current)
        MapGenerator.putImageData(canvasRefs.metalness.current, metalData);

      const curvatureData = MapGenerator.generateCurvatureMap(normalData);
      if (canvasRefs.curvature.current)
        MapGenerator.putImageData(canvasRefs.curvature.current, curvatureData);
    },
    [canvasRefs],
  );

  useEffect(() => {
    if (sourceImage) {
      processMaps(sourceImage, options, isSeamless);
    }
  }, [options, isSeamless, sourceImage, processMaps]);

  const downloadMap = (type: keyof typeof canvasRefs) => {
    const canvas = canvasRefs[type].current;
    if (!canvas) return;
    const link = document.createElement("a");
    const fileName = prefix
      ? `${prefix}_${String(type)}.png`
      : `${String(type)}.png`;
    link.download = fileName;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const downloadAll = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    try {
      const zip = new JSZip();
      const folder = zip.folder(prefix || "textures");
      const types = Object.keys(canvasRefs) as Array<keyof typeof canvasRefs>;

      for (const type of types) {
        const canvas = canvasRefs[type].current;
        if (canvas) {
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b: Blob | null) => resolve(b), "image/png"),
          );
          if (blob) {
            folder?.file(`${prefix}_${String(type)}.png`, blob);
          }
        }
      }

      const content = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(content);
      link.download = `${prefix || "textures"}_pack.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error("Error generating ZIP:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const applyPreset = (name: string) => {
    const presets: Record<string, Partial<MapOptions>> = {
      Gold: {
        isMetallic: true,
        metalnessBase: 1.0,
        intensity: 0.3,
        contrast: 0.1,
        invert: false,
        brightness: 5,
        saturation: 10,
      },
      Steel: {
        isMetallic: true,
        metalnessBase: 0.8,
        intensity: 1.2,
        contrast: 0.2,
        invert: false,
        brightness: 0,
        saturation: -50,
      },
      Concrete: {
        isMetallic: false,
        metalnessBase: 0,
        intensity: 2.0,
        contrast: 0.4,
        invert: false,
        brightness: -5,
        saturation: -20,
      },
      Plastic: {
        isMetallic: false,
        metalnessBase: 0,
        intensity: 0.8,
        contrast: 0.1,
        invert: false,
        brightness: 0,
        saturation: 0,
      },
      Wood: {
        isMetallic: false,
        metalnessBase: 0,
        intensity: 1.5,
        contrast: 0.3,
        invert: false,
        brightness: 0,
        saturation: 10,
      },
      Fabric: {
        isMetallic: false,
        metalnessBase: 0,
        intensity: 0.6,
        contrast: 0.0,
        invert: false,
        brightness: 5,
        saturation: 0,
      },
    };
    if (presets[name]) {
      setOptions({ ...options, ...presets[name] });
    }
  };

  return (
    <div className="app-container">
      <header>
        <h1>Texture Map Generator</h1>
        <p className="subtitle">Create professional PBR materials instantly</p>
      </header>

      <main className="main-layout">
        <aside>
          <div className="panel">
            <div className="panel-title">Source Image</div>
            {!sourceImage ? (
              <label className="upload-area">
                <span>📁</span>
                <span>Drop Image or Click</span>
                <p style={{ fontSize: "0.8rem", opacity: 0.5, margin: 0 }}>
                  PNG, JPG or WebP
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  hidden
                />
              </label>
            ) : (
              <button
                className="secondary"
                onClick={() => setSourceImage(null)}
                style={{ width: "100%", justifyContent: "center" }}
              >
                🔄 Replace Texture
              </button>
            )}
          </div>

          <div className="panel">
            <div className="panel-title">Material Presets</div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.5rem",
              }}
            >
              {["Gold", "Steel", "Concrete", "Plastic", "Wood", "Fabric"].map(
                (preset) => (
                  <button
                    key={preset}
                    className="secondary preset-btn"
                    onClick={() => applyPreset(preset)}
                    style={{ fontSize: "0.75rem", padding: "0.5rem" }}
                    disabled={!sourceImage}
                  >
                    {preset}
                  </button>
                ),
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Map Controls</div>
            <div className="control-group">
              <label>
                Normal Intensity <span>{options.intensity.toFixed(1)}</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={options.intensity}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    intensity: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div className="control-group">
              <label>
                Height Contrast{" "}
                <span>{(options.contrast * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={options.contrast}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    contrast: parseFloat(e.target.value),
                  })
                }
              />
            </div>

            <div className="control-group">
              <label style={{ flexDirection: "row", alignItems: "center" }}>
                Metallic Surface
                <input
                  type="checkbox"
                  checked={options.isMetallic}
                  onChange={(e) =>
                    setOptions({ ...options, isMetallic: e.target.checked })
                  }
                />
              </label>
            </div>

            {options.isMetallic && (
              <div className="control-group" style={{ transition: "all 0.3s" }}>
                <label>
                  Metalness Base <span>{options.metalnessBase.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={options.metalnessBase}
                  onChange={(e) =>
                    setOptions({
                      ...options,
                      metalnessBase: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
            )}

            <div className="control-group">
              <label style={{ flexDirection: "row", alignItems: "center" }}>
                Invert Roughness
                <input
                  type="checkbox"
                  checked={options.invert}
                  onChange={(e) =>
                    setOptions({ ...options, invert: e.target.checked })
                  }
                />
              </label>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Color Adjustment</div>
            <div className="control-group">
              <label>
                Delighting <span>{options.delightAmount.toFixed(0)}</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={options.delightAmount}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    delightAmount: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="control-group">
              <label>
                Brightness <span>{options.brightness.toFixed(0)}</span>
              </label>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={options.brightness}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    brightness: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="control-group">
              <label>
                Saturation <span>{options.saturation.toFixed(0)}</span>
              </label>
              <input
                type="range"
                min="-100"
                max="100"
                step="1"
                value={options.saturation}
                onChange={(e) =>
                  setOptions({
                    ...options,
                    saturation: parseFloat(e.target.value),
                  })
                }
              />
            </div>
            <div className="control-group">
              <label>
                Hue <span>{options.hue.toFixed(0)}°</span>
              </label>
              <input
                type="range"
                min="-180"
                max="180"
                step="1"
                value={options.hue}
                onChange={(e) =>
                  setOptions({ ...options, hue: parseFloat(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">Seamless Tools</div>
            <div className="control-group">
              <label style={{ flexDirection: "row", alignItems: "center" }}>
                Make Seamless
                <input
                  type="checkbox"
                  checked={isSeamless}
                  onChange={(e) => setIsSeamless(e.target.checked)}
                />
              </label>
            </div>

            {isSeamless && (
              <>
                <div className="control-group">
                  <label>Algorithm</label>
                  <select
                    value={options.tilingAlgorithm}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        tilingAlgorithm: e.target
                          .value as MapOptions["tilingAlgorithm"],
                      })
                    }
                  >
                    <option value="crossBlend">Cross Blend</option>
                    <option value="mirror">Mirror Tile</option>
                    <option value="patchMatch">Patch Match</option>
                    <option value="offset">Offset Only</option>
                  </select>
                </div>
                {options.tilingAlgorithm !== "offset" && (
                  <>
                    <div className="control-group">
                      <label>Blend Curve</label>
                      <select
                        value={options.tilingCurve}
                        onChange={(e) =>
                          setOptions({
                            ...options,
                            tilingCurve: e.target
                              .value as MapOptions["tilingCurve"],
                          })
                        }
                      >
                        <option value="linear">Linear</option>
                        <option value="smooth">Smooth</option>
                        <option value="cubic">Cubic</option>
                      </select>
                    </div>
                    <div className="control-group">
                      <label>
                        Blend Amount{" "}
                        <span>{options.tilingBlend.toFixed(2)}</span>
                      </label>
                      <input
                        type="range"
                        min="0.01"
                        max="0.5"
                        step="0.01"
                        value={options.tilingBlend}
                        onChange={(e) =>
                          setOptions({
                            ...options,
                            tilingBlend: parseFloat(e.target.value),
                          })
                        }
                      />
                    </div>
                  </>
                )}
                <div className="control-group">
                  <label style={{ flexDirection: "row", alignItems: "center" }}>
                    Preview Tiled (2x2)
                    <input
                      type="checkbox"
                      checked={showTiled}
                      onChange={(e) => setShowTiled(e.target.checked)}
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          <div className="panel">
            <div className="panel-title">Export Settings</div>
            <div className="control-group">
              <label>File Name Prefix</label>
              <input
                type="text"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                placeholder="e.g. wood_planks"
                style={{
                  background: "rgba(0,0,0,0.2)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "0.6rem",
                  color: "white",
                  fontSize: "0.9rem",
                }}
              />
            </div>
            <button
              onClick={downloadAll}
              disabled={!sourceImage || isDownloading}
              style={{
                marginTop: "1rem",
                background: isDownloading
                  ? "rgba(255,255,255,0.1)"
                  : "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                cursor: isDownloading ? "wait" : "pointer",
              }}
            >
              {isDownloading
                ? "📦 Generating ZIP..."
                : "🚀 Download All Maps (.zip)"}
            </button>
          </div>
        </aside>

        <div
          className="content-area"
          style={{ display: "flex", flexDirection: "column", gap: "2rem" }}
        >
          <ThreeViewer canvasRefs={canvasRefs} prefix={prefix} />

          <section className="preview-grid">
            {[
              { name: "Albedo / Base", key: "base" },
              { name: "Normal Map", key: "normal" },
              { name: "Height Map", key: "height" },
              { name: "Roughness", key: "roughness" },
              { name: "Metalness", key: "metalness" },
              { name: "Ambient Occlusion", key: "ao" },
              { name: "Curvature / Edges", key: "curvature" },
            ].map((map) => (
              <div key={map.key} className="map-card">
                <div className="map-preview" style={{ overflow: "hidden" }}>
                  <canvas
                    ref={(el) => {
                      const key = map.key as keyof typeof canvasRefs;
                      (
                        canvasRefs[
                          key
                        ] as React.MutableRefObject<HTMLCanvasElement | null>
                      ).current = el;
                    }}
                    style={{
                      width: showTiled ? "200%" : "100%",
                      height: showTiled ? "200%" : "100%",
                      objectFit: "cover",
                    }}
                  />
                  {!sourceImage && (
                    <div style={{ color: "var(--text-dim)" }}>
                      Waiting for image...
                    </div>
                  )}
                </div>
                <div className="map-info">
                  <span className="map-name">{map.name}</span>
                  <button
                    className="secondary"
                    style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                    onClick={() =>
                      downloadMap(map.key as keyof typeof canvasRefs)
                    }
                    disabled={!sourceImage}
                  >
                    Save
                  </button>
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>

      <footer className="footer">
        Created for Textures & Tools Workspace • Optimized for Blender & Godot
      </footer>
    </div>
  );
}
