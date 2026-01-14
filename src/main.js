import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
let particle, probe, ribbonFront, ribbonBack, shell, seam;
let trailPoints = [], trailColors = [];
let footstepsMesh; // Changed to InstancedMesh
let footprintCount = 0;
const MAX_FOOTSTEPS = 500;
const dummy = new THREE.Object3D();
let displacementMap = null;
let dispCtx = null;
let dispTexture = null;
let seamMarker; // Visual Marker

let state = { u: 0, v: 0.2, t: 0, w1: 0 };
let isPlaying = false;
let lastW1 = 0;
let isZooming = false; // Camera Zoom State

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
    const segmentsU = hasTexture ? 300 : 120; // Increase resolution if texture active
    const segmentsV = hasTexture ? 60 : 20;
    const w = 0.5;
    const scale = parseFloat(document.getElementById('dispSlider').value);

    const geometry = new THREE.BufferGeometry();
    const verts = [], uvs = [], indices = [], seamVerts = [];


    // Warning: getImageData is slow inside loops if not optimized. 
    // Better to get all data once.
    let pixelData = null;
    if (dispCtx) pixelData = dispCtx.getImageData(0, 0, displacementMap.width, displacementMap.height).data;

    for (let i = 0; i <= segmentsU; i++) {
        const u = (i / segmentsU) * Math.PI * 4; // 2 Full cycles
        for (let j = 0; j <= segmentsV; j++) {
            const v = -w + (j / segmentsV) * (2 * w);

            // Base Position
            let p = getPos[type](u, v);
            let n = new THREE.Vector3(p.x, p.y, p.z).normalize(); // Rough normal for displacement direction

            // Displacement
            if (pixelData) {
                let uNorm = (u % (2 * Math.PI)) / (2 * Math.PI);
                let vNorm = (j / segmentsV); // 0 to 1

                const imgW = displacementMap.width;
                const imgH = displacementMap.height;
                const px = Math.floor(uNorm * (imgW - 1));
                const py = Math.floor(vNorm * (imgH - 1));
                const idx = (py * imgW + px) * 4;

                const height = (pixelData[idx] / 255.0);
                p.add(n.multiplyScalar(height * scale));
            }

            verts.push(p.x, p.y, p.z);
            uvs.push((i / segmentsU) * 2, j / segmentsV); // UVs for texture

            if (j === Math.floor(segmentsV / 2)) seamVerts.push(p.x, p.y, p.z);
        }
    }

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

    // Material: If texture exists, apply it. Else default colors.
    let matFront, matBack;

    if (dispTexture) {
        matFront = new THREE.MeshStandardMaterial({
            map: dispTexture,
            side: THREE.FrontSide,
            displacementMap: dispTexture, // Use built-in displacement too? Maybe overkill if we did geometry.
            displacementScale: 0 // We did manual geometry displacement
        });
        matBack = new THREE.MeshStandardMaterial({
            map: dispTexture,
            side: THREE.BackSide,
            color: 0x8888ff
        });
    } else {
        matFront = new THREE.MeshStandardMaterial({ color: 0x00ffcc, transparent: true, opacity: 0.1, side: THREE.FrontSide });
        matBack = new THREE.MeshStandardMaterial({ color: 0xCCCCFF, transparent: true, opacity: 0.1, side: THREE.BackSide });
    }

    const meshF = new THREE.Mesh(geometry, matFront);
    const meshB = new THREE.Mesh(geometry, matBack);
    const wire = new THREE.MeshBasicMaterial({ color: 0x333333, wireframe: true, transparent: true, opacity: 0.05 });

    shell.add(meshF);
    shell.add(meshB);
    shell.add(new THREE.Mesh(geometry, wire));
    scene.add(shell);

    // Seam
    const seamGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(seamVerts, 3));
    seam = new THREE.Line(seamGeo, new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8, linewidth: 2 }));
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
    const pGeo = new THREE.SphereGeometry(0.05, 32, 32);
    const pMat = new THREE.MeshPhysicalMaterial({ roughness: 0.2, metalness: 0.8 });
    particle = new THREE.Mesh(pGeo, pMat);

    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.15), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    stem.position.y = 0.075;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08), new THREE.MeshStandardMaterial({ color: 0xff4444 }));
    head.position.y = 0.19;
    probe = new THREE.Group();
    probe.add(stem, head);
    particle.add(probe);
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
        const dt = 0.02 * parseFloat(document.getElementById('speedSlider').value);
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

        // Particle Visuals & Displacement (Apply Displacement to Particle Position too!)
        const surfaceCurr = getSurfacePoint(state.u, state.v, manifold);
        let p = surfaceCurr.p;
        let nReal = new THREE.Vector3(res[3], res[4], res[5]); // True normal for orientation

        const offset = nReal.clone().multiplyScalar(0.06);
        particle.position.copy(p.clone().add(offset));

        const up = new THREE.Vector3(0, 1, 0);
        const q = new THREE.Quaternion().setFromUnitVectors(up, nReal);
        probe.quaternion.copy(q);

        const color = new THREE.Color().setHSL(0.3 + (state.t * 0.05) % 0.5, 0.8, 0.5);
        particle.material.color.copy(color);

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
            ribbonBack.geometry = geo;
        }

        // FOOTPRINTS (InstancedMesh)
        if (Math.floor(state.t * 10) % 5 === 0 && footprintCount < MAX_FOOTSTEPS) {
            // Position at surface + epsilon
            dummy.position.copy(p.clone().add(nReal.clone().multiplyScalar(0.01)));
            dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nReal);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            footstepsMesh.setMatrixAt(footprintCount, dummy.matrix);
            footstepsMesh.setColorAt(footprintCount, color);
            footstepsMesh.instanceMatrix.needsUpdate = true;
            if (footstepsMesh.instanceColor) footstepsMesh.instanceColor.needsUpdate = true;
            footstepsMesh.count = footprintCount + 1;
            footprintCount++;
        }

        updateUI();
        checkSeamCrossing();
        if (state.u > Math.PI * 8) isPlaying = false;
    }

    // Camera Zoom
    if (isZooming && seamMarker) {
        const targetPos = seamMarker.position.clone().add(new THREE.Vector3(0, 0, 1.5));
        camera.position.lerp(targetPos, 0.05);
        controls.target.lerp(seamMarker.position, 0.05);
    }

    shell.visible = document.getElementById('checkShell').checked;
    seam.visible = document.getElementById('checkSeam').checked;
    if (seamMarker) seamMarker.visible = document.getElementById('manifoldSelect').value === 'mobius';

    controls.update();
    renderer.render(scene, camera);
}

document.getElementById('playBtn').onclick = () => {
    if (!isPlaying && state.t === 0) playFlipSound();
    isPlaying = !isPlaying;
    document.getElementById('playBtn').textContent = isPlaying ? "⏸ Pause Simulation" : "▶ Run Simulation";
};
document.getElementById('resetBtn').onclick = reset;
document.getElementById('manifoldSelect').onchange = reset;
document.getElementById('v0Slider').oninput = updateUI;
document.getElementById('driftSlider').oninput = updateUI;
document.getElementById('speedSlider').oninput = updateUI;
document.getElementById('dispSlider').addEventListener('input', () => {
    updateUI();
    createManifoldShell(); // Rebuild on slider change
});

window.onresize = () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};

init();
