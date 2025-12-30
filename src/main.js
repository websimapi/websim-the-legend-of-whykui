import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { Vegetation } from './Vegetation.js';

// Setup basic scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x050510, 0.015);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows
document.body.appendChild(renderer.domElement);

// --- DAY/NIGHT SYSTEM ---

// Lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
scene.add(hemiLight);

const sunLight = new THREE.DirectionalLight(0xffdfba, 1.5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 300;
sunLight.shadow.camera.left = -120;
sunLight.shadow.camera.right = 120;
sunLight.shadow.camera.top = 120;
sunLight.shadow.camera.bottom = -120;
scene.add(sunLight);

// Visual Sun
const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(5, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffaa00 })
);
scene.add(sunMesh);

const moonLight = new THREE.DirectionalLight(0x6688ff, 0.4);
moonLight.castShadow = true;
moonLight.shadow.mapSize.width = 1024;
moonLight.shadow.mapSize.height = 1024;
moonLight.shadow.camera.near = 0.5;
moonLight.shadow.camera.far = 300;
moonLight.shadow.camera.left = -120;
moonLight.shadow.camera.right = 120;
moonLight.shadow.camera.top = 120;
moonLight.shadow.camera.bottom = -120;
scene.add(moonLight);

// Visual Moon
const moonMesh = new THREE.Mesh(
    new THREE.SphereGeometry(4, 16, 16),
    new THREE.MeshStandardMaterial({ 
        color: 0xdddddd, 
        emissive: 0x222222,
        roughness: 0.8 
    })
);
scene.add(moonMesh);


// Colors
const skyColorDay = new THREE.Color(0x87CEEB);
const skyColorNight = new THREE.Color(0x0a0a20);
const skyColorSunset = new THREE.Color(0xfd5e53);

const groundColorDay = new THREE.Color(0x3a4b52); // Earthy
const groundColorNight = new THREE.Color(0x050505);

 // Configuration
const DAY_DURATION = 24 * 60; // 24 minutes in seconds (1 real second = 1 in-game minute)
const now = new Date();
// Map local time-of-day to game time: 1 real hour -> 1 in‑game minute (which is 1 real second)
// 00:00 Real Time -> 00:00 Game Time (Start of cycle)
const START_TIME = ((now.getHours() * 60) + now.getMinutes()) % DAY_DURATION;

// Content
const terrain = new Terrain(scene);
const vegetation = new Vegetation(scene, 60000); // Increased grass count significantly

// Audio
const listener = new THREE.AudioListener();
camera.add(listener);
const sound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();

let audioStarted = false;
const uiContainer = document.getElementById('ui-container');

function startExperience() {
    if (audioStarted) return;
    audioStarted = true;
    
    // Hide "Touch to Start" logic visually if you had a button, 
    // but here we just start audio on interaction
    
    audioLoader.load('bgm_whykui.mp3', function(buffer) {
        sound.setBuffer(buffer);
        sound.setLoop(true);
        sound.setVolume(0.5);
        sound.play();
    });
}

window.addEventListener('click', startExperience);
window.addEventListener('touchstart', startExperience);

// Animation Loop
const clock = new THREE.Clock();
const globalLightColor = new THREE.Color();

function updateDayNight(elapsed) {
    // Current time in cycle (0 to DAY_DURATION)
    const cycleTime = (elapsed + START_TIME) % DAY_DURATION;
    const progress = cycleTime / DAY_DURATION; // 0 to 1
    
    // Angle adjustment: 
    // progress 0.0 (00:00) -> Midnight (Sun Down -Y)
    // progress 0.25 (06:00) -> Sunrise (Sun Y=0)
    // progress 0.5 (12:00) -> Noon (Sun Up +Y)
    // progress 0.75 (18:00) -> Sunset (Sun Y=0)
    const theta = (progress - 0.25) * Math.PI * 2;
    
    // Sun Position (rises in East(x+), sets in West(x-))
    const sunRadius = 150;
    const sunElevation = Math.sin(theta); // -1 to 1
    const sunX = Math.cos(theta);
    
    sunMesh.position.set(sunX * sunRadius, sunElevation * sunRadius, 0);
    sunLight.position.copy(sunMesh.position);
    
    // Moon Position (opposite to sun)
    moonMesh.position.set(-sunX * sunRadius, -sunElevation * sunRadius, 0);
    moonLight.position.copy(moonMesh.position);

    // Light Intensity & Shadows
    const sunIntensity = Math.max(0, sunElevation);
    sunLight.intensity = sunIntensity * 2.0;
    
    const moonIntensity = Math.max(0, -sunElevation);
    moonLight.intensity = moonIntensity * 0.5; // Blue moonlight

    // Shadows
    sunLight.castShadow = sunIntensity > 0.05;
    moonLight.castShadow = moonIntensity > 0.05;

    // Sky Color Interpolation
    let targetSky = skyColorNight.clone();
    
    if (sunElevation > 0.1) {
        // Day
        const t = Math.min(1, (sunElevation - 0.1) * 1.5);
        targetSky = skyColorSunset.clone().lerp(skyColorDay, t);
    } else if (sunElevation > -0.2) {
        // Twilight / Sunrise / Sunset
        // Range -0.2 to 0.1 -> 0 to 1
        const t = (sunElevation + 0.2) / 0.3;
        targetSky = skyColorNight.clone().lerp(skyColorSunset, t);
    } 
    // Else Night (stays skyColorNight)

    scene.background.copy(targetSky);
    scene.fog.color.copy(targetSky);

    // Atmosphere / Hemisphere
    hemiLight.color.copy(targetSky);
    // Boost ground ambient slightly at night for "Moon bounce"
    const moonBounce = new THREE.Color(0x1a2b45).multiplyScalar(moonIntensity * 0.5); 
    const currentGround = groundColorNight.clone().add(moonBounce).lerp(groundColorDay, sunIntensity);
    hemiLight.groundColor.copy(currentGround);
    
    // Global Light for Vegetation (Fake GI)
    globalLightColor.setHex(0x000000);
    // Sun contribution
    globalLightColor.add(new THREE.Color(0xffdfba).multiplyScalar(sunIntensity));
    // Moon contribution - boosted for visibility
    globalLightColor.add(new THREE.Color(0x88aaff).multiplyScalar(moonIntensity * 0.8));
    // Ambient contribution
    globalLightColor.add(targetSky.multiplyScalar(0.4));
    // Minimum floor to prevent pitch black
    globalLightColor.addScalar(0.05); 
}

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    
    // Cycle Update
    updateDayNight(time);

    // Camera Pan
    const radius = 60;
    const speed = 0.03; // Slower pan
    camera.position.x = Math.sin(time * speed) * radius;
    camera.position.z = Math.cos(time * speed) * radius;
    camera.position.y = 18; 
    camera.lookAt(0, 4, 0);

    // Pass the calculated light color to vegetation shaders
    vegetation.update(time, globalLightColor);

    renderer.render(scene, camera);
}

// Handle resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();