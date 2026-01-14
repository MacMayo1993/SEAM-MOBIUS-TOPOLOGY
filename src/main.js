import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './style.css';

// --- MATH ENGINE (Ported from Python) ---
const getPos = {
    mobius: (u, v) => {
        const x = (1 + 0.5 * v * Math.cos(u / 2)) * Math.cos(u);
        const y = (1 + 0.5 * v * Math.cos(u / 2)) * Math.sin(u);
        const z = 0.5 * v * Math.sin(u / 2);
        return new THREE.Vector3(x, y, z);
    },
    cylinder: (u, v) => {
        const x = Math.cos(u);
        const y = Math.sin(u);
        const z = v;
        return new THREE.Vector3(x, y, z);
    },
    torus: (u, v) => {
        const majorR = 1.0;
        const minorR = 0.4;
        const theta = v * Math.PI;
        const x = (majorR + minorR * Math.cos(theta)) * Math.cos(u);
        const y = (majorR + minorR * Math.cos(theta)) * Math.sin(u);
        const z = minorR * Math.sin(theta);
        return new THREE.Vector3(x, y, z);
    },
    trefoil: (u, v) => {
        const r = 1.0 + v * Math.cos(1.5 * u);
        const x = r * Math.sin(u + 2 * Math.sin(u));
        const y = r * Math.sin(2 * u);
        const z = r * Math.sin(3 * u);
        return new THREE.Vector3(x, y, z);
    }
};

const MAPPINGS = {
    mobius: (u, v) => {
        const p = getPos.mobius(u, v);
        const d = 0.01;
        const pU = getPos.mobius(u + d, v);
        const pV = getPos.mobius(u, v + d);
        const n = new THREE.Vector3().crossVectors(pU.sub(p), pV.sub(p)).normalize(); // approx
        return [p.x, p.y, p.z, n.x, n.y, n.z, Math.cos(u / 2) < 0 ? 1 : 0];
    },
    cylinder: (u, v) => {
        const p = getPos.cylinder(u, v);
        const n = new THREE.Vector3(Math.cos(u), Math.sin(u), 0);
        return [p.x, p.y, p.z, n.x, n.y, n.z, 0];
    },
    torus: (u, v) => {
        const p = getPos.torus(u, v);
        const d = 0.01;
        const pU = getPos.torus(u + d, v);
        const pV = getPos.torus(u, v + d);
        const n = new THREE.Vector3().crossVectors(pV.sub(p), pU.sub(p)).normalize();
        return [p.x, p.y, p.z, n.x, n.y, n.z, 0];
    },
    trefoil: (u, v) => {
        const p = getPos.trefoil(u, v);
        const d = 0.01;
        const pU = getPos.trefoil(u + d, v);
        const pV = getPos.trefoil(u, v + d);
        const n = new THREE.Vector3().crossVectors(pU.sub(p), pV.sub(p)).normalize();
        return [p.x, p.y, p.z, n.x, n.y, n.z, 0];
    }
};

const FLOWS = {
    constant: (u, v, amp) => [1.0, 0],
    sinusoidal: (u, v, amp) => [1.0, amp * Math.sin(u)],
    chaotic: (u, v, amp) => [1.0, amp * Math.sin(u) * Math.cos(v * 10)]
};

const MATERIALS = {
    default: { name: "Standard Grid", speedMod: 1.0, roughness: 0.0, bounce: 0.0, color: 0x00ffcc, opacity: 0.1, wireframe: true },
    glass: { name: "Slippery Glass", speedMod: 2.5, roughness: 0.0, bounce: 0.0, color: 0xaaccff, opacity: 0.8, wireframe: false, texture: './web_assets/textures/ice.png' },
    sand: { name: "Heavy Sand", speedMod: 0.3, roughness: 0.02, bounce: 0.0, color: 0xe6c288, opacity: 1.0, wireframe: false, texture: './web_assets/textures/sand.png' },
    rocks: { name: "Jagged Rocks", speedMod: 0.6, roughness: 0.05, bounce: 0.0, color: 0x888888, opacity: 1.0, wireframe: false, texture: './web_assets/textures/rocks.png' },
    trampoline: { name: "Bouncy Tarp", speedMod: 1.2, roughness: 0.0, bounce: 0.2, color: 0x3333ff, opacity: 0.9, wireframe: false, texture: './web_assets/textures/trampoline.png' }
};

const ENV_MAPS = {
    mountains: './web_assets/environments/mountains.png',
    forest: './web_assets/environments/forest.png',
    sunset: './web_assets/environments/sunset.png'
};

function loadEnvironment(key) {
    if (key === 'default') {
        scene.background = new THREE.Color(0x050505);
        scene.environment = null;
        // Don't clear displacement if it was manually uploaded, but for now let's assume switching envs overrides manual image
        // To be safe: if user wants manual image back, they upload it again.
        // Actually, let's just clear it to "reset" to void state
        dispCtx = null;
        dispTexture = null;
        document.getElementById('image-preview').style.backgroundImage = 'none';
        document.getElementById('image-preview').textContent = "No texture loaded";
        createManifoldShell();
        return;
    }

    const path = ENV_MAPS[key];
    new THREE.TextureLoader().load(path, (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        scene.background = texture;
        scene.environment = texture;

        // ALSO LOAD AS DISPLACEMENT MAP
        const img = new Image();
        img.crossOrigin = "Anonymous"; // Prevent canvas tainting
        img.onload = function () {
            displacementMap = document.createElement('canvas');
            displacementMap.width = img.width;
            displacementMap.height = img.height;
            dispCtx = displacementMap.getContext('2d');
            dispCtx.drawImage(img, 0, 0);

            // Create texture for visual material
            dispTexture = new THREE.CanvasTexture(displacementMap);

            document.getElementById('image-preview').style.backgroundImage = `url(${path})`;
            document.getElementById('image-preview').textContent = "";

            createManifoldShell(); // Rebuild with new terrain
        };
        img.src = path;
    });
}

function rk4(u, v, dt, flowFunc, amp) {
    const f = flowFunc;
    const k1 = f(u, v, amp);
    const k2 = f(u + dt / 2 * k1[0], v + dt / 2 * k1[1], amp);
    const k3 = f(u + dt / 2 * k2[0], v + dt / 2 * k2[1], amp);
    const k4 = f(u + dt * k3[0], v + dt * k3[1], amp);
    return [
        u + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
        v + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])
    ];
}

// --- AUDIO ENGINE ---
let audioCtx;
function playFlipSound() {
    if (!document.getElementById('checkSound').checked) return;
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(440, audioCtx.currentTime + 0.1);
    osc.frequency.exponentialRampToValueAtTime(55, audioCtx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    osc.start(); osc.stop(audioCtx.currentTime + 0.4);
}

// --- THREE.JS ENGINE ---
let scene, camera, renderer, controls;
let particle, runnerBody, runnerArms = [], runnerLegs = [], runnerSkates = [], runnerBoosters = [], probe, ribbonFront, ribbonBack, shell, seam, moe;
let trailPoints = [], trailColors = [];
let footstepsMesh; // Changed to InstancedMesh
let footprintCount = 0;
const MAX_FOOTSTEPS = 500;
const dummy = new THREE.Object3D();
let displacementMap = null;
let dispCtx = null;
let dispTexture = null;
let matFront, matBack; // Materials for the manifold
let seamMarker; // Visual Marker

let state = { u: 0, v: 0.2, t: 0, w1: 0 };
let isPlaying = false;
let lastW1 = 0;
let isZooming = false; // Camera Zoom State
let isBallCam = false; // Ball Camera State

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(4, 3, 4);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(5, 5, 5);
    scene.add(sun);

    createManifoldShell();
    setupParticle();
    setupRibbon();

    animate();
}

// --- IMAGE PROCESSING ---
document.getElementById('imageInput').addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (event) {
        const img = new Image();
        img.onload = function () {
            displacementMap = document.createElement('canvas');
            displacementMap.width = img.width;
            displacementMap.height = img.height;
            dispCtx = displacementMap.getContext('2d');
            dispCtx.drawImage(img, 0, 0);

            // Create texture for visual material
            dispTexture = new THREE.CanvasTexture(displacementMap);

            document.getElementById('image-preview').style.backgroundImage = `url(${event.target.result})`;
            document.getElementById('image-preview').textContent = "";

            createManifoldShell(); // Rebuild with high res
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

// Helper: Get Surface Point + Normal with Displacement
function getSurfacePoint(u, v, manifold) {
    let p = getPos[manifold](u, v);
    // Default normal from position logic (approximate radial) for displacement ref
    let n = new THREE.Vector3(p.x, p.y, p.z).normalize();

    if (dispCtx) {
        let uNorm = (u % (2 * Math.PI)) / (2 * Math.PI);
        let vNorm = v + 0.5;
        const mapW = displacementMap.width;
        const mapH = displacementMap.height;
        const px = Math.floor(Math.max(0, Math.min(1, uNorm)) * (mapW - 1));
        const py = Math.floor(Math.max(0, Math.min(1, vNorm)) * (mapH - 1));
        const pixel = dispCtx.getImageData(px, py, 1, 1).data;
        const h = pixel[0] / 255.0;
        const s = parseFloat(document.getElementById('dispSlider').value);
        p.add(n.clone().multiplyScalar(h * s));
    }
    return { p: p, n: n };
}

function createManifoldShell() {
    if (shell) scene.remove(shell);
    if (seam) scene.remove(seam);
    if (seamMarker) scene.remove(seamMarker);

    const type = document.getElementById('manifoldSelect').value;
    const hasTexture = !!dispCtx;
    const segmentsU = hasTexture ? 300 : 120; // High res for displacement
    const segmentsV = hasTexture ? 60 : 20;
    const w = 0.5;
    const scale = parseFloat(document.getElementById('dispSlider').value);

    const geometry = new THREE.BufferGeometry();
    const verts = [], uvs = [], indices = [], seamVerts = [];

    // Get Pixel Data for Displacement
    let pixelData = null;
    if (dispCtx) {
        try {
            pixelData = dispCtx.getImageData(0, 0, displacementMap.width, displacementMap.height).data;
        } catch (e) {
            console.warn("Unable to read displacement map data:", e);
        }
    }

    // Vertex Generation
    for (let i = 0; i <= segmentsU; i++) {
        const u = (i / segmentsU) * Math.PI * 4;
        for (let j = 0; j <= segmentsV; j++) {
            const v = -w + (j / segmentsV) * (2 * w);

            let p = getPos[type](u, v);
            let n = new THREE.Vector3(p.x, p.y, p.z).normalize(); // Basic normal

            if (pixelData) {
                // Map U [0..4PI] to [0..1] wrapping twice
                let uNorm = (u / (2 * Math.PI)) % 1.0;
                if (uNorm < 0) uNorm += 1.0;
                let vNorm = j / segmentsV;

                const imgW = displacementMap.width;
                const imgH = displacementMap.height;
                const px = Math.floor(uNorm * (imgW - 1));
                const py = Math.floor(vNorm * (imgH - 1));
                const idx = (py * imgW + px) * 4;

                const h = (pixelData[idx] / 255.0) || 0;
                p.add(n.multiplyScalar(h * scale));
            }

            verts.push(p.x, p.y, p.z);
            uvs.push((i / segmentsU) * 2, j / segmentsV); // Tile x2

            if (j === Math.floor(segmentsV / 2)) seamVerts.push(p.x, p.y, p.z);
        }
    }

    // Index Generation
    for (let i = 0; i < segmentsU; i++) {
        for (let j = 0; j < segmentsV; j++) {
            const a = i * (segmentsV + 1) + j;
            const b = (i + 1) * (segmentsV + 1) + j;
            const c = (i + 1) * (segmentsV + 1) + (j + 1);
            const d = i * (segmentsV + 1) + (j + 1);
            indices.push(a, b, d, b, c, d);
        }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    shell = new THREE.Group();

    // Material Configuration
    const matType = document.getElementById('materialSelect').value;
    const matConfig = MATERIALS[matType];

    const baseProps = {
        side: THREE.FrontSide,
        transparent: matConfig.opacity < 1.0,
        opacity: matConfig.opacity,
        roughness: matConfig.name === "Heavy Sand" ? 1.0 : (matConfig.roughness > 0 ? 0.8 : 0.0),
        metalness: matConfig.name === "Slippery Glass" ? 0.4 : 0.0,
        color: matConfig.color
    };

    matFront = new THREE.MeshStandardMaterial(baseProps);
    matBack = new THREE.MeshStandardMaterial({ ...baseProps, side: THREE.BackSide, color: new THREE.Color(baseProps.color).multiplyScalar(0.8) });

    if (matConfig.texture) {
        new THREE.TextureLoader().load(matConfig.texture, (tex) => {
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(4, 1);
            matFront.map = tex;
            matFront.color.set(0xffffff);
            matFront.needsUpdate = true;
            matBack.map = tex;
            matBack.color.set(0xcccccc);
            matBack.needsUpdate = true;
        });
    }

    // Environment reflections
    if (scene.environment && (matConfig.name === "Slippery Glass" || matConfig.name === "Bouncy Tarp")) {
        matFront.envMap = scene.environment;
        matFront.envMapIntensity = 1.0;
        matBack.envMap = scene.environment;
        matBack.envMapIntensity = 0.8;
    }

    // Wireframe for Grid
    if (matConfig.name === "Standard Grid") {
        const wireMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc, wireframe: true, transparent: true, opacity: 0.3 });
        shell.add(new THREE.Mesh(geometry, wireMat));
        matFront.opacity = 0.1;
        matBack.opacity = 0.1;
    }

    shell.add(new THREE.Mesh(geometry, matFront));
    shell.add(new THREE.Mesh(geometry, matBack));
    scene.add(shell);

    // Seam Line
    const seamGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seamVerts, 3));
    seam = new THREE.Line(seamGeo, new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2, transparent: true, opacity: 0.8 }));
    scene.add(seam);

    markSeamLocation();
}

// --- VISUALIZATION MARKERS ---
function markSeamLocation() {
    const type = document.getElementById('manifoldSelect').value;
    if (type !== 'mobius') return;

    // Seam at u = PI (geometric twist center)
    const res = MAPPINGS['mobius'](Math.PI, 0);
    const p = new THREE.Vector3(res[0], res[1], res[2]);

    const geo = new THREE.SphereGeometry(0.12, 16, 16);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true });
    seamMarker = new THREE.Mesh(geo, mat);
    seamMarker.position.copy(p);

    scene.add(seamMarker);
}

function setupParticle() {
    if (particle) scene.remove(particle);

    particle = new THREE.Group();

    // --- SKATER CREATION ---
    function createSkater() {
        const group = new THREE.Group();
        const mat = new THREE.MeshStandardMaterial({ color: 0x3399ff, roughness: 0.5 }); // Blue runner

        // Torso
        const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.1, 4, 8), mat);
        torso.position.y = 0.16; // Lifted so skates are on ground
        group.add(torso);

        // Head
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), mat);
        head.position.y = 0.26;
        group.add(head);

        // Arms (Fixed "Skater" pose - balanced)
        const armGeo = new THREE.CapsuleGeometry(0.015, 0.08, 4, 8);
        const armL = new THREE.Mesh(armGeo, mat);
        armL.position.set(0.06, 0.18, 0);
        armL.rotation.z = Math.PI / 3;
        const armR = new THREE.Mesh(armGeo, mat);
        armR.position.set(-0.06, 0.18, 0);
        armR.rotation.z = -Math.PI / 3;
        group.add(armL, armR);
        runnerArms = [armL, armR];

        // Legs (Slightly spread)
        const legGeo = new THREE.CapsuleGeometry(0.02, 0.12, 4, 8);
        const legL = new THREE.Mesh(legGeo, mat);
        legL.position.set(0.04, 0.1, 0);
        const legR = new THREE.Mesh(legGeo, mat);
        legR.position.set(-0.04, 0.1, 0);
        group.add(legL, legR);
        runnerLegs = [legL, legR];

        // --- PERFECT ROLLER SKATES ---
        const skateGeo = new THREE.SphereGeometry(0.025, 16, 16);
        const skateMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.1 });
        const thrustMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.8 });

        [legL, legR].forEach((leg, i) => {
            const skate = new THREE.Mesh(skateGeo, skateMat);
            skate.position.y = -0.06; // Exactly at the bottom of the leg
            leg.add(skate);
            runnerSkates.push(skate);

            // Rocket Booster
            const booster = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.005, 0.05), new THREE.MeshStandardMaterial({ color: 0x444444 }));
            booster.position.set(0, -0.04, -0.04);
            booster.rotation.x = Math.PI / 3;
            leg.add(booster);

            // Thrust Glow
            const glow = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.1, 8), thrustMat);
            glow.position.set(0, -0.05, -0.1);
            glow.rotation.x = -Math.PI / 2;
            leg.add(glow);
            runnerBoosters.push(glow);
        });

        runnerBody = group;
        return group;
    }

    const skater = createSkater();
    particle.add(skater);

    // Orientation Beam (Inside)
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 }));
    stem.position.y = 0.15;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.05), new THREE.MeshStandardMaterial({ color: 0xff4444, transparent: true, opacity: 0.2 }));
    head.position.y = 0.22;
    probe = new THREE.Group();
    probe.add(stem, head);
    particle.add(probe);

    // Moe B. Usch - Backpack
    function createMoeBUsch() {
        const moeGroup = new THREE.Group();
        const moeMat = new THREE.MeshStandardMaterial({ color: 0xff9900, roughness: 0.7 });

        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.05, 4, 8), moeMat);
        body.position.y = 0.08;
        moeGroup.add(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), moeMat);
        head.position.y = 0.14;
        moeGroup.add(head);

        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), eyeMat);
        eyeL.position.set(0.015, 0.15, 0.025);
        const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 8), eyeMat); // Reusing eyeGeo if possible, or build inline
        eyeR.position.set(-0.015, 0.15, 0.025);
        moeGroup.add(eyeL, eyeR);

        const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.08, 4, 8), moeMat);
        arm.position.set(0.04, 0.08, -0.02);
        arm.rotation.z = -Math.PI / 3;
        const armR = arm.clone();
        armR.position.set(-0.04, 0.08, -0.02);
        armR.rotation.z = Math.PI / 3;
        moeGroup.add(arm, armR);

        return moeGroup;
    }

    moe = createMoeBUsch();
    moe.position.set(0, 0.1, -0.06); // Higher on back
    runnerBody.add(moe);

    scene.add(particle);
}

function setupRibbon() {
    if (ribbonFront) scene.remove(ribbonFront);
    if (ribbonBack) scene.remove(ribbonBack);
    if (footstepsMesh) scene.remove(footstepsMesh);

    const matF = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.FrontSide });
    const matB = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.BackSide });
    ribbonFront = new THREE.Mesh(new THREE.BufferGeometry(), matF);
    ribbonBack = new THREE.Mesh(new THREE.BufferGeometry(), matB);
    scene.add(ribbonFront, ribbonBack);

    // Instanced Footprints
    const geometry = new THREE.CylinderGeometry(0.03, 0.03, 0.01, 16); // Discs
    geometry.rotateX(Math.PI / 2); // Flat
    const material = new THREE.MeshBasicMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    footstepsMesh = new THREE.InstancedMesh(geometry, material, MAX_FOOTSTEPS);
    footstepsMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(footstepsMesh);
    footprintCount = 0;
}

function reset() {
    state = { u: 0, v: parseFloat(document.getElementById('v0Slider').value), t: 0, w1: 0 };
    lastW1 = 0;
    trailPoints = []; trailColors = [];

    ribbonFront.geometry.dispose(); ribbonFront.geometry = new THREE.BufferGeometry();
    ribbonBack.geometry.dispose(); ribbonBack.geometry = new THREE.BufferGeometry();

    footprintCount = 0;
    footstepsMesh.count = 0;

    isPlaying = false;
    document.getElementById('playBtn').textContent = "▶ Run Simulation";
    createManifoldShell();
    updateUI();

    const res = MAPPINGS[document.getElementById('manifoldSelect').value](0, state.v);
    particle.position.set(res[0], res[1], res[2]);
}

function updateUI() {
    document.getElementById('v0Val').textContent = state.v.toFixed(2);
    document.getElementById('driftVal').textContent = document.getElementById('driftSlider').value;
    document.getElementById('speedVal').textContent = document.getElementById('speedSlider').value;
    document.getElementById('dispVal').textContent = document.getElementById('dispSlider').value;

    document.getElementById('stat-t').textContent = state.t.toFixed(2) + "s";
    document.getElementById('stat-u').textContent = (state.u / Math.PI).toFixed(2) + "π";
    document.getElementById('stat-v').textContent = state.v.toFixed(3);
    const w1El = document.getElementById('stat-w1');
    w1El.textContent = state.w1 === 1 ? "⚠️ FLIPPED" : "✓ ORIGINAL";
    w1El.className = "stat-val " + (state.w1 === 1 ? "flipped" : "");
}

function triggerFlip() {
    document.getElementById('flash-overlay').style.opacity = 1;
    document.getElementById('banner').classList.add('active');
    playFlipSound();
    setTimeout(() => {
        document.getElementById('flash-overlay').style.opacity = 0;
        document.getElementById('banner').classList.remove('active');
    }, 1200);
}

// Check for Camera Zoom to Seam
function checkSeamCrossing() {
    if (!document.getElementById('checkSeamZoom').checked) return;
    const manifold = document.getElementById('manifoldSelect').value;
    if (manifold !== 'mobius') return;

    // Check if near PI (modulo 2PI)
    const uMod = state.u % (2 * Math.PI);

    // Define "Near" as within 0.5 rad (~28 deg)
    if (Math.abs(uMod - Math.PI) < 0.5) {
        isZooming = true;
    } else {
        isZooming = false;
    }
}

function animate() {
    requestAnimationFrame(animate);

    if (isPlaying) {
        // Get Material Props
        const matType = document.getElementById('materialSelect').value;
        const mat = MATERIALS[matType];

        let dt = 0.02 * parseFloat(document.getElementById('speedSlider').value);
        dt *= mat.speedMod; // Apply Material Speed Modifier

        const manifold = document.getElementById('manifoldSelect').value;
        const flow = document.getElementById('flowSelect').value;
        const amp = parseFloat(document.getElementById('driftSlider').value);

        const next = rk4(state.u, state.v, dt, FLOWS[flow], amp);
        state.u = next[0];
        state.v = next[1];
        state.t += dt;

        const res = MAPPINGS[manifold](state.u, state.v);
        state.w1 = res[6];

        if (state.w1 !== lastW1) {
            triggerFlip();
            lastW1 = state.w1;
        }

        // Particle Visuals & Displacement 

        // Apply Material Noise (Roughness)
        if (mat.roughness > 0) {
            // Jitter 'v' or 'u' slightly for visual effect
            state.v += (Math.random() - 0.5) * mat.roughness * 0.1;
        }

        const surfaceCurr = getSurfacePoint(state.u, state.v, manifold);
        let p = surfaceCurr.p;
        let nReal = new THREE.Vector3(res[3], res[4], res[5]);

        // Direction / Tangent calculation using look-ahead
        const dtLook = 0.02;
        const nextFlow = FLOWS[flow](state.u, state.v, amp);
        const surfPred = getSurfacePoint(state.u + dtLook * nextFlow[0], state.v + dtLook * nextFlow[1], manifold);
        const forward = surfPred.p.clone().sub(p).normalize();

        // Place particle EXACTLY on surface (skates will be at ground level)
        particle.position.copy(p);

        // Orientation: Face forward, align with normal
        // A simple way to build a stable orthonormal basis:
        const lookTarget = p.clone().add(forward);
        particle.lookAt(lookTarget); // This sets Z-axis to forward

        // Now rotate to align with surface normal (upward)
        // We need the character's local UP (Y) to be the surface normal
        const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(particle.quaternion);
        const qNormal = new THREE.Quaternion().setFromUnitVectors(localUp, nReal);
        particle.applyQuaternion(qNormal);

        // Moe Animation (Breathing/Sway)
        if (moe) {
            const sway = Math.sin(state.t * 4) * 0.05;
            moe.rotation.z = sway;
            const breath = 1 + Math.sin(state.t * 2) * 0.02;
            moe.scale.set(breath, breath, breath);
        }

        // --- SKATER ANIMATION ---
        if (runnerBody) {
            const glideTime = state.t * 6;

            // Side-to-side drift lean
            runnerBody.rotation.z = Math.sin(glideTime) * 0.15;
            runnerBody.rotation.x = -0.1; // Forward lean

            // Minimal arm balancing
            runnerArms[0].rotation.x = Math.sin(glideTime) * 0.2;
            runnerArms[1].rotation.x = -Math.sin(glideTime) * 0.2;

            // Rocket Thrust Flicker
            runnerBoosters.forEach((b, i) => {
                const s = 1.0 + Math.sin(state.t * 20 + i) * 0.5;
                b.scale.set(s, s, s * 4);
                b.material.opacity = 0.5 + Math.random() * 0.5;
            });

            // --- TOPOLOGICAL FLIP ---
            const targetRot = state.w1 === 1 ? Math.PI : 0;
            // Smoothly interpolate the 180-turn
            runnerBody.rotation.y = THREE.MathUtils.lerp(runnerBody.rotation.y, targetRot, 0.1);
        }

        // Ribbon - Displaced Points
        const width = 0.05;
        const sTop = getSurfacePoint(state.u, state.v + width, manifold);
        const sBot = getSurfacePoint(state.u, state.v - width, manifold);
        const pTop = sTop.p;
        const pBot = sBot.p;

        // Slight offset for ribbon
        const ribOffset = nReal.clone().multiplyScalar(0.02);
        pTop.add(ribOffset);
        pBot.add(ribOffset);

        trailPoints.push(pTop.x, pTop.y, pTop.z, pBot.x, pBot.y, pBot.z);
        trailColors.push(color.r, color.g, color.b, color.r, color.g, color.b);

        if (trailPoints.length > 6) {
            const geo = ribbonFront.geometry;
            geo.setAttribute('position', new THREE.Float32BufferAttribute(trailPoints, 3));
            geo.setAttribute('color', new THREE.Float32BufferAttribute(trailColors, 3));
            const indices = [];
            for (let i = 0; i < (trailPoints.length / 3) - 2; i += 2) indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
            geo.setIndex(indices);
            geo.computeVertexNormals();
            geo.attributes.position.needsUpdate = true;
            geo.attributes.color.needsUpdate = true;
        }

        // Footsteps
        if (footprintCount < MAX_FOOTSTEPS && Math.random() < 0.1) {
            const matrix = new THREE.Matrix4();
            const pos = p.clone().sub(nReal.clone().multiplyScalar(0.01));
            matrix.compose(pos, q, new THREE.Vector3(1, 1, 1));
            footstepsMesh.setMatrixAt(footprintCount, matrix);
            footstepsMesh.instanceMatrix.needsUpdate = true;
            footstepsMesh.count = footprintCount + 1;
            footprintCount++;
        }

        checkSeamCrossing();
        updateUI();
    }

    // Ball Camera (Follow particle)
    if (isBallCam && particle) {
        const offset = new THREE.Vector3(0, 1, 2);
        offset.applyQuaternion(particle.quaternion);
        camera.position.lerp(particle.position.clone().add(offset), 0.1);
        camera.lookAt(particle.position);
    }

    // Update controls and render
    controls.update();
    renderer.render(scene, camera);
}

// BIND EVENTS
document.getElementById('playBtn').addEventListener('click', () => {
    isPlaying = !isPlaying;
    document.getElementById('playBtn').textContent = isPlaying ? "⏸ Pause" : "▶ Run Simulation";
});

document.getElementById('resetBtn').addEventListener('click', reset);

document.getElementById('manifoldSelect').addEventListener('change', () => {
    reset();
    markSeamLocation();
});

document.getElementById('materialSelect').addEventListener('change', () => {
    // Re-create shell to apply new material visuals
    createManifoldShell();
});

document.getElementById('envSelect').addEventListener('change', (e) => {
    loadEnvironment(e.target.value);
});

// Update shell when displacement height changes (debounced/throttled ideally, but direct for now)
document.getElementById('dispSlider').addEventListener('change', () => {
    if (dispCtx) createManifoldShell();
});

// UI Event Listeners for Sliders (Update UpdateUI)
['driftSlider', 'speedSlider', 'v0Slider', 'dispSlider'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateUI);
});

document.getElementById('checkBallCam').addEventListener('change', (e) => {
    isBallCam = e.target.checked;
    if (!isBallCam) {
        // Reset camera/controls when exiting
        controls.enabled = true;
        controls.target.set(0, 0, 0);
    }
});


// INIT
init();
updateUI();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
