import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";

interface ThreeViewerProps {
  canvasRefs: {
    base: React.RefObject<HTMLCanvasElement | null>;
    normal: React.RefObject<HTMLCanvasElement | null>;
    height: React.RefObject<HTMLCanvasElement | null>;
    roughness: React.RefObject<HTMLCanvasElement | null>;
    ao: React.RefObject<HTMLCanvasElement | null>;
    metalness: React.RefObject<HTMLCanvasElement | null>;
    curvature: React.RefObject<HTMLCanvasElement | null>;
  };
  prefix: string;
}

type GeometryType =
  | "sphere"
  | "cube"
  | "roundedBox"
  | "plane"
  | "torus"
  | "cylinder";
type ViewMode =
  | "material"
  | "base"
  | "normal"
  | "height"
  | "roughness"
  | "metalness"
  | "ao"
  | "curvature";
type EnvMode = "studio" | "outdoor" | "neutral";

export default function ThreeViewer({ canvasRefs, prefix }: ThreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const [geometryType, setGeometryType] = useState<GeometryType>("sphere");
  const [displacementScale, setDisplacementScale] = useState(0.05);
  const [tiling, setTiling] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>("material");
  const [envMode, setEnvMode] = useState<EnvMode>("studio");

  // Initialize Scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(2, 2, 3);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1.0,
      metalness: 0.0,
    });
    materialRef.current = material;

    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0] || !containerRef.current) return;
      const { width, height } = entries[0].contentRect;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      controls.dispose();
      if (containerRef.current)
        containerRef.current.removeChild(renderer.domElement);
    };
  }, []);

  // Handle HDRI Environment
  useEffect(() => {
    if (!sceneRef.current || !rendererRef.current) return;
    const scene = sceneRef.current;
    const renderer = rendererRef.current;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Clear existing environment
    scene.environment = null;
    scene.background = null;

    // Remove old lights if any (manual lights are only used in neutral mode)
    scene.children.forEach((child) => {
      if (child instanceof THREE.Light) scene.remove(child);
    });

    if (envMode === "neutral") {
      const ambient = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambient);
      const sun = new THREE.DirectionalLight(0xffffff, 1.5);
      sun.position.set(5, 5, 5);
      scene.add(sun);
      return;
    }

    const loader = new RGBELoader();
    const hdriUrl =
      envMode === "studio"
        ? "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/royal_esplanade_1k.hdr"
        : "https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/equirectangular/venice_sunset_1k.hdr";

    loader.load(hdriUrl, (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      scene.environment = envMap;
      // scene.background = envMap; // Optional: show HDRI in background
      texture.dispose();
      pmremGenerator.dispose();
    });
  }, [envMode]);

  // Update Geometry
  useEffect(() => {
    if (!sceneRef.current || !materialRef.current) return;
    const scene = sceneRef.current;
    scene.children
      .filter((child) => child instanceof THREE.Mesh)
      .forEach((m) => {
        scene.remove(m);
        (m as THREE.Mesh).geometry.dispose();
      });

    let geo;
    switch (geometryType) {
      case "sphere":
        geo = new THREE.SphereGeometry(1, 256, 256);
        break;
      case "roundedBox":
        geo = new RoundedBoxGeometry(1.2, 1.2, 1.2, 12, 0.1);
        break;
      case "cube":
        geo = new THREE.BoxGeometry(1.2, 1.2, 1.2, 128, 128, 128);
        break;
      case "plane":
        geo = new THREE.PlaneGeometry(2, 2, 256, 256);
        geo.rotateX(-Math.PI / 2);
        break;
      case "torus":
        geo = new THREE.TorusKnotGeometry(0.7, 0.25, 300, 64);
        break;
      case "cylinder":
        geo = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 64, 128);
        break;
      default:
        geo = new THREE.SphereGeometry(1, 128, 128);
    }
    scene.add(new THREE.Mesh(geo, materialRef.current));
  }, [geometryType]);

  // Update Textures
  useEffect(() => {
    const update = () => {
      if (!materialRef.current) return;
      const mat = materialRef.current;

      const setTex = (
        key: keyof typeof canvasRefs,
        prop: string,
        isColor = false,
      ) => {
        const can = canvasRefs[key].current;
        if (can && can.width > 0) {
          const tex = new THREE.CanvasTexture(can);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(tiling, tiling);
          if (isColor) tex.colorSpace = THREE.SRGBColorSpace;
          (mat as any)[prop] = tex;
        } else {
          (mat as any)[prop] = null;
        }
      };

      // Reset material properties
      mat.map = null;
      mat.normalMap = null;
      mat.displacementMap = null;
      mat.roughnessMap = null;
      mat.metalnessMap = null;
      mat.aoMap = null;
      mat.emissiveMap = null;
      mat.color.set(0xffffff);

      if (viewMode === "material") {
        setTex("base", "map", true);
        setTex("normal", "normalMap");
        setTex("height", "displacementMap");
        setTex("roughness", "roughnessMap");
        setTex("metalness", "metalnessMap");
        setTex("ao", "aoMap");
        mat.displacementScale = displacementScale;
      } else {
        // Channel Isolation mode
        const mapKey =
          viewMode === "curvature"
            ? "curvature"
            : (viewMode as keyof typeof canvasRefs);
        setTex(mapKey, "map", viewMode === "base");
        mat.displacementScale = 0;
      }
      mat.needsUpdate = true;
    };

    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [canvasRefs, displacementScale, tiling, viewMode]);

  const exportGLB = () => {
    if (!sceneRef.current) return;
    const exporter = new GLTFExporter();
    exporter.parse(
      sceneRef.current,
      (res) => {
        const blob = new Blob([res as ArrayBuffer], {
          type: "application/octet-stream",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${prefix || "material"}.glb`;
        a.click();
      },
      (err) => console.error(err),
      { binary: true },
    );
  };

  return (
    <div className="panel three-viewer-container">
      <div
        className="panel-title"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>3D Material Preview</span>
        <select
          value={viewMode}
          onChange={(e) => setViewMode(e.target.value as ViewMode)}
          style={{
            fontSize: "0.7rem",
            padding: "0.2rem",
            background: "rgba(0,0,0,0.3)",
            color: "white",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "4px",
          }}
        >
          <option value="material">Full Material</option>
          <option value="base">Base Color</option>
          <option value="normal">Normal Map</option>
          <option value="height">Height Map</option>
          <option value="roughness">Roughness</option>
          <option value="metalness">Metalness</option>
          <option value="ao">AO</option>
          <option value="curvature">Curvature</option>
        </select>
      </div>

      <div className="viewer-toolbar">
        {["sphere", "roundedBox", "cube", "torus", "cylinder", "plane"].map(
          (type) => (
            <button
              key={type}
              className={`secondary ${geometryType === type ? "active" : ""}`}
              onClick={() => setGeometryType(type as GeometryType)}
              title={type}
            >
              {type === "sphere"
                ? "⚪"
                : type === "cube"
                  ? "📦"
                  : type === "roundedBox"
                    ? "🧊"
                    : type === "torus"
                      ? "🥨"
                      : type === "cylinder"
                        ? "🧪"
                        : "⬜"}
            </button>
          ),
        )}
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: "relative",
          borderRadius: "16px",
          overflow: "hidden",
          background: "#050510",
        }}
      >
        {/* Environment Control */}
        <div
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            zIndex: 10,
            display: "flex",
            gap: "0.5rem",
          }}
        >
          {["studio", "outdoor", "neutral"].map((env) => (
            <button
              key={env}
              className={`secondary ${envMode === env ? "active" : ""}`}
              onClick={() => setEnvMode(env as EnvMode)}
              style={{ fontSize: "0.6rem", padding: "0.3rem 0.6rem" }}
            >
              {env.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Tiling Control */}
        <div
          style={{
            position: "absolute",
            top: "1rem",
            left: "1rem",
            background: "rgba(0,0,0,0.6)",
            padding: "0.4rem 0.8rem",
            borderRadius: "10px",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <span style={{ fontSize: "0.6rem", color: "#aaa" }}>Tiling:</span>
          <input
            type="range"
            min="1"
            max="5"
            step="1"
            value={tiling}
            onChange={(e) => setTiling(parseInt(e.target.value))}
            style={{ width: "60px", height: "4px" }}
          />
          <span style={{ fontSize: "0.6rem", color: "white" }}>{tiling}x</span>
        </div>

        {(!canvasRefs.base.current || canvasRefs.base.current.width === 0) && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.3)",
              fontSize: "0.9rem",
              pointerEvents: "none",
              zIndex: 5,
            }}
          >
            Waiting for texture upload...
          </div>
        )}

        {/* Displacement Scale Slider */}
        <div
          style={{
            position: "absolute",
            bottom: "1rem",
            left: "1rem",
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(10px)",
            padding: "0.5rem 1rem",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.1)",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            width: "200px",
          }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              color: "var(--text-dim)",
              whiteSpace: "nowrap",
            }}
          >
            Bumpy:
          </span>
          <input
            type="range"
            min="0"
            max="0.5"
            step="0.01"
            value={displacementScale}
            onChange={(e) => setDisplacementScale(parseFloat(e.target.value))}
            style={{ height: "4px" }}
          />
        </div>

        <div
          style={{
            position: "absolute",
            bottom: "1rem",
            right: "1rem",
            zIndex: 10,
          }}
        >
          <button onClick={exportGLB} style={{ fontSize: "0.8rem" }}>
            📦 Export GLB
          </button>
        </div>
      </div>

      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--text-dim)",
          padding: "0.5rem 2rem 1rem",
          textAlign: "center",
          opacity: 0.6,
        }}
      >
        LMB: Rotate • RMB: Pan • Scroll: Zoom
      </div>
    </div>
  );
}
