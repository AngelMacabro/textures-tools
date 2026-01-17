import { useState, useRef, useEffect, useCallback } from "react";
import { MapGenerator } from "./utils/MapGenerator";
import type { MapOptions } from "./utils/MapGenerator";
import { TilingProcessor } from "./utils/TilingProcessor";

export default function App() {
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [isSeamless, setIsSeamless] = useState(false);
  const [showTiled, setShowTiled] = useState(false);
  const [prefix, setPrefix] = useState("texture");
  const [options, setOptions] = useState<MapOptions>({
    intensity: 1,
    contrast: 0,
    invert: false,
    blur: 0,
  });

  const canvasRefs = {
    base: useRef<HTMLCanvasElement>(null),
    normal: useRef<HTMLCanvasElement>(null),
    height: useRef<HTMLCanvasElement>(null),
    roughness: useRef<HTMLCanvasElement>(null),
    ao: useRef<HTMLCanvasElement>(null),
  };

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

      // Initialize base canvas
      const baseCanvas = canvasRefs.base.current;
      if (!baseCanvas) return;

      baseCanvas.width = img.width;
      baseCanvas.height = img.height;
      const ctx = baseCanvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      let currentImageData = ctx.getImageData(0, 0, img.width, img.height);

      // Apply seamless if active
      if (seamless) {
        const seamlessCanvas = TilingProcessor.processSeamless(baseCanvas);
        ctx.drawImage(seamlessCanvas, 0, 0);
        currentImageData = ctx.getImageData(0, 0, img.width, img.height);
      }

      // Generate Height Map
      const heightData = MapGenerator.generateHeightMap(
        currentImageData,
        opts.contrast,
      );
      if (canvasRefs.height.current) {
        MapGenerator.putImageData(canvasRefs.height.current, heightData);
      }

      // Generate Normal Map
      const normalData = MapGenerator.generateNormalMap(
        currentImageData,
        opts.intensity,
      );
      if (canvasRefs.normal.current) {
        MapGenerator.putImageData(canvasRefs.normal.current, normalData);
      }

      // Generate Roughness Map
      const roughnessData = MapGenerator.generateRoughnessMap(
        currentImageData,
        opts.invert,
      );
      if (canvasRefs.roughness.current) {
        MapGenerator.putImageData(canvasRefs.roughness.current, roughnessData);
      }

      // Generate AO Map
      const aoData = MapGenerator.generateAOMap(
        currentImageData,
        opts.intensity,
      );
      if (canvasRefs.ao.current) {
        MapGenerator.putImageData(canvasRefs.ao.current, aoData);
      }
    },
    [],
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
    const fileName = prefix ? `${prefix}_${type}.png` : `${type}.png`;
    link.download = fileName;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const downloadAll = () => {
    (Object.keys(canvasRefs) as Array<keyof typeof canvasRefs>).forEach(
      (type) => {
        downloadMap(type);
      },
    );
  };

  return (
    <div className="app-container">
      <header>
        <h1>Texture Map Generator</h1>
        <p className="subtitle">
          Create PBR materials for Blender & Godot instantly
        </p>
      </header>

      <main className="main-layout">
        <aside>
          <div className="panel">
            <div className="panel-title">Source Image</div>
            {!sourceImage ? (
              <label className="upload-area">
                <input
                  type="file"
                  hidden
                  onChange={handleFileUpload}
                  accept="image/*"
                />
                <span>Click to Upload</span>
              </label>
            ) : (
              <button
                className="secondary"
                onClick={() => setSourceImage(null)}
              >
                Change Image
              </button>
            )}
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
                Height Contrast <span>{options.contrast}</span>
              </label>
              <input
                type="range"
                min="-100"
                max="100"
                value={options.contrast}
                onChange={(e) =>
                  setOptions({ ...options, contrast: parseInt(e.target.value) })
                }
              />
            </div>

            <div
              className="control-group"
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label>Invert Roughness</label>
              <input
                type="checkbox"
                checked={options.invert}
                onChange={(e) =>
                  setOptions({ ...options, invert: e.target.checked })
                }
              />
            </div>

            <div
              className="control-group"
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <label>Make Seamless</label>
              <input
                type="checkbox"
                checked={isSeamless}
                onChange={(e) => setIsSeamless(e.target.checked)}
              />
            </div>

            <div
              className="control-group"
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                opacity: isSeamless ? 1 : 0.5,
              }}
            >
              <label>Preview Tiled (2x2)</label>
              <input
                type="checkbox"
                disabled={!isSeamless}
                checked={showTiled}
                onChange={(e) => setShowTiled(e.target.checked)}
              />
            </div>
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
              disabled={!sourceImage}
              style={{
                marginTop: "1rem",
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
              }}
            >
              🚀 Download All Maps
            </button>
          </div>
        </aside>

        <section className="preview-grid">
          {[
            { name: "Albedo / Base", key: "base" },
            { name: "Normal Map", key: "normal" },
            { name: "Height Map", key: "height" },
            { name: "Roughness", key: "roughness" },
            { name: "Ambient Occlusion", key: "ao" },
          ].map((map) => (
            <div key={map.key} className="map-card">
              <div className="map-preview" style={{ overflow: "hidden" }}>
                <canvas
                  ref={canvasRefs[map.key as keyof typeof canvasRefs]}
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
      </main>

      <footer className="footer">
        Created for Textures & Tools Workspace • Optimized for Blender & Godot
      </footer>
    </div>
  );
}
