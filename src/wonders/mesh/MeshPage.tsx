import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { WonderShell, Slider, Stat, Segmented } from '../../lib/ui';
import { wonderBySlug } from '../../registry';
import { compile, polygonise, smoothMesh, toStl, toObj, Mesh } from './sdf';
import { download } from '../../lib/math';

const W = wonderBySlug('mesh')!;

const EXAMPLES = [
  'a crystal', 'twisted hollow vase', '5-setback tower', 'gear', 'mushroom',
  'heart', 'many spheres', 'a tiny star', 'spiral', 'planet', 'blob',
  'a giant tower', 'cut crystal', 'rounded cube',
];

const MATERIALS = [
  { id: 'clay', name: 'Clay', color: '#c9a227', rough: 0.72, metal: 0.0 },
  { id: 'chrome', name: 'Chrome', color: '#dfe6ee', rough: 0.12, metal: 1.0 },
  { id: 'jade', name: 'Jade', color: '#2f8f6a', rough: 0.28, metal: 0.15 },
  { id: 'coral', name: 'Coral', color: '#ff6b5e', rough: 0.55, metal: 0.0 },
  { id: 'iridescent', name: 'Iridescent', color: '#8b6cff', rough: 0.2, metal: 0.7 },
];

export default function MeshPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState('a crystal');
  const [input, setInput] = useState('a crystal');
  const [quality, setQuality] = useState(48);
  const [smooth, setSmooth] = useState(1);
  const [mesh, setMesh] = useState<Mesh | null>(null);
  const [buildMs, setBuildMs] = useState(0);
  const [material, setMaterial] = useState(MATERIALS[0]);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [ops, setOps] = useState<string[]>([]);
  const [showEnv, setShowEnv] = useState(true);

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);

  /* ---------------- three.js scene ---------------- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    if ('outputColorSpace' in renderer) (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 1.1, 5.2);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;

    // studio lighting: key, fill, rim
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9fb4ff, 1.1);
    fill.position.set(-4, 1, 2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffd7a8, 1.6);
    rim.position.set(-2, 3, -5);
    scene.add(rim);
    scene.add(new THREE.AmbientLight(0x404a66, 1.2));

    // a gradient env map so metals have something to reflect
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const gradGeo = new THREE.SphereGeometry(50, 32, 16);
    const gradMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP;
        void main(){
          float h = normalize(vP).y * 0.5 + 0.5;
          vec3 top = vec3(0.62,0.72,0.95);
          vec3 mid = vec3(0.16,0.18,0.26);
          vec3 bot = vec3(0.05,0.05,0.08);
          vec3 c = h > 0.5 ? mix(mid, top, (h-0.5)*2.0) : mix(bot, mid, h*2.0);
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    envScene.add(new THREE.Mesh(gradGeo, gradMat));
    const envTex = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envTex;

    // ground: soft shadow catcher
    const groundGeo = new THREE.CircleGeometry(6, 64);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.9, metalness: 0.1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.65;
    scene.add(ground);

    let raf = 0;
    let dragging = false;
    let lastX = 0, lastY = 0;
    const onPointerDown = (e: PointerEvent) => { dragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onPointerUp = () => { dragging = false; };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging || !groupRef.current) return;
      groupRef.current.rotation.y += (e.clientX - lastX) * 0.01;
      groupRef.current.rotation.x = Math.max(-1.2, Math.min(1.2, groupRef.current.rotation.x + (e.clientY - lastY) * 0.008));
      lastX = e.clientX; lastY = e.clientY;
    };
    let zoom = 5.2;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoom = Math.max(2.4, Math.min(11, zoom * (e.deltaY > 0 ? 1.1 : 0.9)));
      camera.position.z = zoom;
    };
    const el = renderer.domElement;
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointermove', onPointerMove);
    el.addEventListener('wheel', onWheel, { passive: false });

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const g = groupRef.current;
      if (g) {
        if (autoRotateRef.current && !dragging) g.rotation.y += 0.006;
        g.rotation.z = Math.sin(performance.now() * 0.0003) * 0.02;
      }
      renderer.render(scene, camera);
    };
    animate();

    const ro = new ResizeObserver(() => {
      if (!mount) return;
      const w = mount.clientWidth, h = mount.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (renderer.domElement.parentElement) renderer.domElement.parentElement.removeChild(renderer.domElement);
    };
  }, []);

  const autoRotateRef = useRef(autoRotate);
  autoRotateRef.current = autoRotate;

  /* ---------------- build geometry ---------------- */
  const build = useCallback((t: string, q = quality, sm = smooth) => {
    const t0 = performance.now();
    const program = compile(t);
    const raw = polygonise(program.sdf, q, 1.8);
    const final = sm > 0 ? smoothMesh(raw, sm, 0.32) : raw;
    setBuildMs(performance.now() - t0);
    setMesh(final);
    setOps(program.ops);
    setText(t);
    setInput(t);

    // swap into the scene
    const group = groupRef.current;
    if (!group) return;
    if (meshRef.current) {
      group.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      (meshRef.current.material as THREE.Material).dispose();
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(final.positions, 3));
    geom.setAttribute('normal', new THREE.BufferAttribute(final.normals, 3));
    geom.setIndex(new THREE.BufferAttribute(final.indices, 1));
    geom.computeBoundingBox();
    const bb = geom.boundingBox!;
    const center = new THREE.Vector3();
    bb.getCenter(center);
    geom.translate(-center.x, -center.y, -center.z);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(material.color),
      roughness: material.rough,
      metalness: material.metal,
      wireframe,
      flatShading: false,
      envMapIntensity: 1.1,
    });
    const m = new THREE.Mesh(geom, mat);
    group.add(m);
    meshRef.current = m;
  }, [quality, smooth, material, wireframe]);

  useEffect(() => { build('a crystal'); /* eslint-disable-next-line */ }, []);

  // update material live
  useEffect(() => {
    const m = meshRef.current;
    if (!m) return;
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.color.set(material.color);
    mat.roughness = material.rough;
    mat.metalness = material.metal;
    mat.wireframe = wireframe;
    mat.needsUpdate = true;
  }, [material, wireframe]);

  const download3d = (fmt: 'stl' | 'obj') => {
    if (!mesh) return;
    if (fmt === 'stl') download(`${slug(text)}.stl`, new Blob([toStl(mesh, 25)], { type: 'model/stl' }));
    else download(`${slug(text)}.obj`, toObj(mesh, 25), 'text/plain');
  };

  return (
    <WonderShell w={W}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16 }} className="mesh-layout">
        <div className="stack" style={{ gap: 12 }}>
          <div className="panel" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
            <div ref={mountRef} style={{ width: '100%', height: 460, cursor: 'grab' }} />
            <div style={{ position: 'absolute', top: 14, left: 14 }} className="row">
              <span className="chip chip-live"><span className="dot" /> REAL MESH · ${mesh?.triangles.toLocaleString() ?? 0} TRIANGLES</span>
              <span className="chip">{buildMs ? `${buildMs.toFixed(0)} ms` : ''}</span>
            </div>
            <div style={{ position: 'absolute', bottom: 12, left: 14, fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--mono)' }}>
              drag to orbit · scroll to zoom
            </div>
            <div style={{ position: 'absolute', bottom: 12, right: 14 }} className="row">
              <button className="btn btn-sm btn-ghost" onClick={() => setAutoRotate((a) => !a)}>{autoRotate ? '❚❚ Stop spin' : '▶ Spin'}</button>
              <button className="btn btn-sm btn-ghost" onClick={() => setWireframe((w) => !w)}>{wireframe ? '● Solid' : '◌ Wireframe'}</button>
            </div>
          </div>

          <div className="row" style={{ gap: 6 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && build(input)}
              placeholder="describe an object…"
              style={{ flex: 1, fontSize: 14 }}
            />
            <button className="btn btn-primary" onClick={() => build(input)}>⬢ Generate</button>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <Stat label="Triangles" value={mesh?.triangles.toLocaleString() ?? '—'} />
            <Stat label="Vertices" value={mesh?.vertices.toLocaleString() ?? '—'} />
            <Stat label="Build" value={buildMs ? `${buildMs.toFixed(0)}ms` : '—'} />
            <Stat label="Voxel res" value={`${quality}³`} />
            <div className="row" style={{ gap: 6, marginLeft: 'auto' }}>
              <button className="btn btn-sm" onClick={() => download3d('stl')} disabled={!mesh}>↓ STL (print)</button>
              <button className="btn btn-sm btn-ghost" onClick={() => download3d('obj')} disabled={!mesh}>↓ OBJ</button>
            </div>
          </div>

          <div className="panel panel-pad">
            <div className="section-title">What the compiler did</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11.5, color: 'var(--txt-2)', lineHeight: 1.85 }}>
              <span style={{ color: 'var(--accent)' }}>“{text}”</span>
              <span style={{ color: 'var(--txt-3)' }}> → </span>
              {ops.length ? ops.map((o, i) => (
                <span key={i}>
                  <span style={{ color: '#cbb8ff' }}>{o}</span>
                  {i < ops.length - 1 && <span style={{ color: 'var(--txt-3)' }}> → </span>}
                </span>
              )) : <span style={{ color: 'var(--txt-3)' }}>base primitive, no modifiers</span>}
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 14 }}>
          <div className="panel panel-pad stack" style={{ gap: 13 }}>
            <div className="section-title" style={{ margin: 0 }}>Mesh</div>
            <Slider label="Voxel resolution" value={quality} min={20} max={88} step={4} onChange={(v) => setQuality(Math.round(v))} suffix="³" />
            <Slider label="Smoothing passes" value={smooth} min={0} max={4} step={1} onChange={(v) => setSmooth(Math.round(v))} />
            <button className="btn btn-sm" onClick={() => build(input, quality, smooth)}>↻ Rebuild at this resolution</button>
            <div style={{ fontSize: 11, color: 'var(--txt-3)', lineHeight: 1.5 }}>
              Higher resolution = more triangles and finer detail. 88³ evaluates 700k samples of the distance field.
            </div>
          </div>

          <div className="panel panel-pad stack" style={{ gap: 10 }}>
            <div className="section-title" style={{ margin: 0 }}>Material</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {MATERIALS.map((m) => (
                <button
                  key={m.id}
                  title={m.name}
                  onClick={() => setMaterial(m)}
                  style={{
                    aspectRatio: '1', borderRadius: 9, cursor: 'pointer',
                    background: `radial-gradient(circle at 34% 30%, ${m.color}, ${shade(m.color, -0.55)})`,
                    border: material.id === m.id ? '2px solid var(--accent)' : '1px solid var(--line)',
                    boxShadow: material.id === m.id ? '0 0 14px rgba(163,255,18,0.4)' : 'none',
                  }}
                />
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>{material.name} · roughness {material.rough} · metalness {material.metal}</div>
          </div>

          <div className="panel panel-pad">
            <div className="section-title">Try these</div>
            <div className="row" style={{ gap: 5 }}>
              {EXAMPLES.map((e) => (
                <button key={e} className="chip" style={{ cursor: 'pointer', textTransform: 'none', letterSpacing: 0, fontSize: 10.5 }}
                  onClick={() => build(e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="panel panel-pad">
            <div className="note">
              Real geometry, not a picture: signed-distance fields are evaluated on a voxel grid, converted with
              marching cubes, then Laplacian-smoothed. The STL is watertight and dimensioned in millimetres (25×
              scale), so it goes straight into Cura or PrusaSlicer.
            </div>
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 980px) { .mesh-layout { grid-template-columns: 1fr !important; } }`}</style>
    </WonderShell>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'object';
}
function shade(hex: string, amt: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  const f = (v: number) => Math.max(0, Math.min(255, v + v * amt));
  return `rgb(${f((n >> 16) & 255) | 0},${f((n >> 8) & 255) | 0},${f(n & 255) | 0})`;
}
