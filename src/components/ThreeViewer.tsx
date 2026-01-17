import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";

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

export default function ThreeViewer({ canvasRefs, prefix }: ThreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const [geometryType, setGeometryType] = useState<"sphere" | "cube" | "plane">(
    "sphere",
  );

  useEffect(() => {
    if (!containerRef.current) return;

    // Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.style.display = "block";
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    camera.position.z = 3;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
    mainLight.position.set(5, 5, 5);
    scene.add(mainLight);

    const rimLight = new THREE.PointLight(0x6366f1, 0.8);
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

      // Use Math.floor to avoid sub-pixel loops
      const width = Math.floor(entries[0].contentRect.width);
      const height = Math.floor(entries[0].contentRect.height);

      if (width <= 0 || height <= 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false); // false to not set style width/height
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
    if (geometryType === "sphere") {
      geometry = new THREE.SphereGeometry(1, 128, 128);
    } else if (geometryType === "cube") {
      geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2, 64, 64, 64);
    } else {
      geometry = new THREE.PlaneGeometry(1.5, 1.5, 128, 128);
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
        if (canvas) {
          const texture = new THREE.CanvasTexture(canvas);
          if (property === "map") {
            texture.colorSpace = THREE.SRGBColorSpace;
          } else {
            texture.colorSpace = THREE.NoColorSpace;
          }
          (materialRef.current as any)[property] = texture;
          materialRef.current!.needsUpdate = true;
        }
      };

      setTexture("base", "map");
      setTexture("normal", "normalMap");
      setTexture("height", "displacementMap");
      setTexture("roughness", "roughnessMap");
      setTexture("ao", "aoMap");

      // Adjustment for displacement
      materialRef.current.displacementScale = 0.05;
    };

    // We can't easily listen to canvas pixel changes, so we rely on parent signaling or a short timeout/interval
    // For now, let's trigger it every 500ms if there's an image
    const interval = setInterval(updateTextures, 1000);
    return () => clearInterval(interval);
  }, [canvasRefs]);

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
          className={`secondary ${geometryType === "cube" ? "active" : ""}`}
          onClick={() => setGeometryType("cube")}
          title="Cube"
        >
          📦
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
          background: "#000",
        }}
      >
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
          padding: "0 2rem 1.5rem",
          textAlign: "center",
          opacity: 0.6,
        }}
      >
        LMB: Rotate • RMB: Pan • Scroll: Zoom
      </div>
    </div>
  );
}
