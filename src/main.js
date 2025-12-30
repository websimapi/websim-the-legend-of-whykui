import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { Terrain } from './Terrain.js';
import { Vegetation } from './Vegetation.js';
import { Controls } from './Controls.js';

// --- State ---
const state = {
    rtx: true,
    wind: true,
    fps: 0,
    frames: 0,
    lastTime: 0
};

// --- Initialization ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x88ccff);
scene.fog = new THREE.FogExp2(0x88ccff, 0.02);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 10, 10);

const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limit pixel ratio for performance
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// --- Lights ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffdfba, 1.5);
sunLight.position.set(50, 80, 20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.bias = -0.0005; 
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 200;
const d = 80;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
scene.add(sunLight);

const rimLight = new THREE.DirectionalLight(0x88ccff, 0.5);
rimLight.position.set(-50, 20, -50);
scene.add(rimLight);

// --- World ---
const terrain = new Terrain(scene);
let vegetation;

// Defer vegetation creation until terrain is ready (synchronous here but good practice)
// Reduced count slightly for better mobile performance while maintaining density feel
vegetation = new Vegetation(scene, terrain.mesh, 15000);

// --- Post Processing ---
const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = 0.7;
bloomPass.strength = 0.3;
bloomPass.radius = 0.5;
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// --- Controls ---
const controls = new Controls(camera, renderer.domElement);

// --- Audio ---
const listener = new THREE.AudioListener();
camera.add(listener);
const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load('./bgm_whykui.mp3', (buffer) => {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.5);
    // Play on interaction if not playing
});

// --- UI Logic ---
const loader = document.getElementById('loader');
setTimeout(() => {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 500);
}, 1500); // Fake load time for "Generating Terrain" feel

const btnRtx = document.getElementById('btn-rtx');
const btnWind = document.getElementById('btn-wind');
const fpsEl = document.getElementById('fps');

btnRtx.addEventListener('click', () => {
    state.rtx = !state.rtx;
    btnRtx.classList.toggle('active', state.rtx);
    btnRtx.innerText = state.rtx ? "RTX ON" : "RTX OFF";
    updateQuality();
});

btnWind.addEventListener('click', () => {
    state.wind = !state.wind;
    btnWind.classList.toggle('active', state.wind);
    btnWind.innerText = state.wind ? "WIND ON" : "WIND OFF";
    
    if (state.wind) {
        if (sound.buffer && !sound.isPlaying) sound.play();
        sound.setVolume(0.5);
    } else {
        sound.setVolume(0);
    }
});

function updateQuality() {
    if (state.rtx) {
        sunLight.intensity = 1.5;
        scene.fog.density = 0.02;
        renderer.shadowMap.enabled = true;
    } else {
        sunLight.intensity = 1.0;
        scene.fog.density = 0.035; // Thicker fog to hide lack of distant detail
        renderer.shadowMap.enabled = false;
    }
    // Note: Composer vs Renderer is handled in loop
}

// Handle Interactions to unlock Audio
const unlockAudio = () => {
    if (state.wind && sound.buffer && !sound.isPlaying) {
        sound.play();
    }
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
};
window.addEventListener('click', unlockAudio);
window.addEventListener('touchstart', unlockAudio);

// --- Loop ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const dt = clock.getDelta();
    const time = clock.getElapsedTime();

    // FPS Counter
    state.frames++;
    if (time > state.lastTime + 1) {
        fpsEl.innerText = state.frames + " FPS";
        state.frames = 0;
        state.lastTime = time;
    }

    // Update
    controls.update(dt);
    if (vegetation) vegetation.update(time, state.rtx, state.wind);

    // Keep shadows centered on player
    sunLight.position.x = camera.position.x + 50;
    sunLight.position.z = camera.position.z + 20;
    sunLight.target.position.set(camera.position.x, 0, camera.position.z);
    sunLight.target.updateMatrixWorld();

    // Render
    if (state.rtx) {
        composer.render();
    } else {
        renderer.render(scene, camera);
    }
}

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

animate();