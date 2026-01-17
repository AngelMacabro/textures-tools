import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

interface ThreeViewerProps {
  canvasRefs: {
    base: React.RefObject<HTMLCanvasElement | null>;
    normal: React.RefObject<HTMLCanvasElement | null>;
    height: React.RefObject<HTMLCanvasElement | null>;
    roughness: React.RefObject<HTMLCanvasElement | null>;
    ao: React.RefObject<HTMLCanvasElement | null>;
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

export default function ThreeViewer({ canvasRefs, prefix }: ThreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const [geometryType, setGeometryType] = useState<GeometryType>("sphere");
  const [displacementScale, setDisplacementScale] = useState(0.05);

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.domElement.style.display = "block";
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.set(2, 2, 3);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 5, 5);
    scene.add(mainLight);

    const secondaryLight = new THREE.DirectionalLight(0x6366f1, 0.6);
    secondaryLight.position.set(-5, 0, 2);
    scene.add(secondaryLight);

    const rimLight = new THREE.PointLight(0xffffff, 0.8);
    rimLight.position.set(-5, -5, -5);
    scene.add(rimLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Material
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1.0,
      metalness: 0.0,
    });
    materialRef.current = material;

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize Handling with ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0] || !containerRef.current) return;

      const width = Math.floor(entries[0].contentRect.width);
      const height = Math.floor(entries[0].contentRect.height);

      if (width <= 0 || height <= 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      controls.dispose();
      if (
        containerRef.current &&
        renderer.domElement.parentNode === containerRef.current
      ) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Geometry
  useEffect(() => {
    if (!sceneRef.current || !materialRef.current) return;

    const scene = sceneRef.current;

    // Remove all existing meshes
    scene.children
      .filter((child) => child instanceof THREE.Mesh)
      .forEach((mesh) => {
        scene.remove(mesh);
        if ((mesh as THREE.Mesh).geometry)
          (mesh as THREE.Mesh).geometry.dispose();
      });

    let geometry: THREE.BufferGeometry;
    switch (geometryType) {
      case "sphere":
        geometry = new THREE.SphereGeometry(1, 256, 256);
        break;
      case "roundedBox":
        geometry = new RoundedBoxGeometry(1.2, 1.2, 1.2, 12, 0.1);
        // Box needs more segments for displacement
        break;
      case "cube":
        geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2, 128, 128, 128);
        break;
      case "plane":
        geometry = new THREE.PlaneGeometry(2, 2, 256, 256);
        geometry.rotateX(-Math.PI / 2);
        break;
      case "torus":
        geometry = new THREE.TorusKnotGeometry(0.7, 0.25, 300, 64);
        break;
      case "cylinder":
        geometry = new THREE.CylinderGeometry(0.6, 0.6, 1.5, 64, 128);
        break;
      default:
        geometry = new THREE.SphereGeometry(1, 128, 128);
    }

    const mesh = new THREE.Mesh(geometry, materialRef.current);
    scene.add(mesh);
  }, [geometryType]);

  // Update textures from canvases
  useEffect(() => {
    const updateTextures = () => {
      if (!materialRef.current) return;

      const setTexture = (
        type: keyof typeof canvasRefs,
        property: keyof THREE.MeshStandardMaterial,
      ) => {
        const canvas = canvasRefs[type].current;
        if (canvas && canvas.width > 0 && canvas.height > 0) {
          const texture = new THREE.CanvasTexture(canvas);
          if (property === "map") {
            texture.colorSpace = THREE.SRGBColorSpace;
          } else {
            texture.colorSpace = THREE.NoColorSpace;
          }
          texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
          (materialRef.current as any)[property] = texture;
          materialRef.current!.needsUpdate = true;
        }
      };

      setTexture("base", "map");
      setTexture("normal", "normalMap");
      setTexture("height", "displacementMap");
      setTexture("roughness", "roughnessMap");
      setTexture("ao", "aoMap");

      materialRef.current.displacementScale = displacementScale;
    };

    const interval = setInterval(updateTextures, 1000);
    return () => clearInterval(interval);
  }, [canvasRefs, displacementScale]);

  const exportGLB = () => {
    if (!sceneRef.current) return;

    const exporter = new GLTFExporter();
    const scene = sceneRef.current;

    exporter.parse(
      scene,
      (result) => {
        const blob = new Blob([result as ArrayBuffer], {
          type: "application/octet-stream",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${prefix || "material"}.glb`;
        link.click();
      },
      (error) => {
        console.error("An error happened during GLTF export", error);
      },
      { binary: true },
    );
  };

  return (
    <div className="panel three-viewer-container">
      <div className="panel-title">
        <span>3D Material Preview</span>
      </div>

      <div className="viewer-toolbar">
        <button
          className={`secondary ${geometryType === "sphere" ? "active" : ""}`}
          onClick={() => setGeometryType("sphere")}
          title="Sphere"
        >
          ⚪
        </button>
        <button
          className={`secondary ${geometryType === "roundedBox" ? "active" : ""}`}
          onClick={() => setGeometryType("roundedBox")}
          title="Rounded Box"
        >
          🧊
        </button>
        <button
          className={`secondary ${geometryType === "cube" ? "active" : ""}`}
          onClick={() => setGeometryType("cube")}
          title="Cube"
        >
          📦
        </button>
        <button
          className={`secondary ${geometryType === "torus" ? "active" : ""}`}
          onClick={() => setGeometryType("torus")}
          title="Torus Knot"
        >
          🥨
        </button>
        <button
          className={`secondary ${geometryType === "cylinder" ? "active" : ""}`}
          onClick={() => setGeometryType("cylinder")}
          title="Cylinder"
        >
          🧪
        </button>
        <button
          className={`secondary ${geometryType === "plane" ? "active" : ""}`}
          onClick={() => setGeometryType("plane")}
          title="Plane"
        >
          ⬜
        </button>
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
