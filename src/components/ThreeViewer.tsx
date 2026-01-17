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
    scene.background = new THREE.Color(0x0d0d12);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      1.1,
      100
    );
    camera.position.z = 3;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(
      containerRef.current.clientWidth,
      containerRef.current.clientHeight,
    );
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 5, 5);
    scene.add(mainLight);

    const rimLight = new THREE.PointLight(0x6366f1, 1);
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

    // Handle Resize
    const handleResize = () => {
      if (!containerRef.current) return;
      camera.aspect =
        containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        containerRef.current.clientWidth,
        containerRef.current.clientHeight,
      );
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      controls.dispose();
      if (containerRef.current) {
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
      geometry = new THREE.SphereGeometry(1, 64, 64);
    } else if (geometryType === "cube") {
      geometry = new THREE.BoxGeometry(1.2, 1.2, 1.2);
    } else {
      geometry = new THREE.PlaneGeometry(1.5, 1.5);
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
          texture.colorSpace = THREE.SRGBColorSpace;
          if (property === "normalMap") {
            // Normal maps need Linear space
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
    <div
      className="panel"
      style={{
        flex: 1,
        minHeight: "250px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="panel-title"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span>3D Preview</span>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className={`secondary ${geometryType === "sphere" ? "active" : ""}`}
            onClick={() => setGeometryType("sphere")}
            style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}
          >
            Sphere
          </button>
          <button
            className={`secondary ${geometryType === "cube" ? "active" : ""}`}
            onClick={() => setGeometryType("cube")}
            style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}
          >
            Cube
          </button>
          <button
            className={`secondary ${geometryType === "plane" ? "active" : ""}`}
            onClick={() => setGeometryType("plane")}
            style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}
          >
            Plane
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: "relative",
          borderRadius: "12px",
          overflow: "hidden",
          background: "#000000ff",
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
          <button
            onClick={exportGLB}
            style={{
              fontSize: "0.8rem",
              background: "rgba(99, 102, 241, 0.8)",
            }}
          >
            📦 Export GLB (Blender/Godot)
          </button>
        </div>
      </div>

      <div
        style={{
          fontSize: "0.7rem",
          color: "var(--text-dim)",
          marginTop: "0.5rem",
        }}
      >
        Drag to rotate • Scroll to zoom • Right click to pan
      </div>
    </div>
  );
}
