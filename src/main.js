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
const skyColorNight = new THREE.Color(0x050510);
const skyColorSunset = new THREE.Color(0xfd5e53);

const groundColorDay = new THREE.Color(0x3a4b52); // Earthy
const groundColorNight = new THREE.Color(0x050505);

 // Configuration
const DAY_DURATION = 24 * 60; // 24 minutes in seconds (1 real second = 1 in-game minute)
const now = new Date();
// Map local time-of-day to game time: 1 real hour -> 1 in‑game minute
const START_TIME = ((now.getHours() + now.getMinutes() / 60) * 60) % DAY_DURATION;

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
    
    // Angle: 0 = Sunrise, 0.25 = Noon, 0.5 = Sunset, 0.75 = Midnight
    const theta = progress * Math.PI * 2;
    
    // Sun Position (rises in East(x+), sets in West(x-))
    const sunRadius = 150;
    const sunY = Math.sin(theta);
    const sunX = Math.cos(theta);
    
    sunMesh.position.set(sunX * sunRadius, sunY * sunRadius, 0);
    sunLight.position.copy(sunMesh.position);
    
    // Moon Position (opposite to sun)
    moonMesh.position.set(-sunX * sunRadius, -sunY * sunRadius, 0);
    moonLight.position.copy(moonMesh.position);

    // Light Intensity & Shadows
    // Sun is bright during day (sin(theta) > 0)
    const sunIntensity = Math.max(0, Math.sin(theta));
    sunLight.intensity = sunIntensity * 2.0;
    
    // Moon is bright during night (sin(theta) < 0)
    // We dampen it so it's not as bright as sun
    const moonIntensity = Math.max(0, -Math.sin(theta));
    moonLight.intensity = moonIntensity * 0.5;

    // Toggle shadows to save resources when light is below horizon
    sunLight.castShadow = sunIntensity > 0.1;
    moonLight.castShadow = moonIntensity > 0.1;

    // Sky Color Interpolation
    // Simple mixing
    let targetSky = skyColorNight;
    if (sunIntensity > 0) {
        // Sunrise/Sunset transition
        if (sunIntensity < 0.5) {
            targetSky = skyColorSunset.clone().lerp(skyColorDay, (sunIntensity) * 2);
        } else {
            targetSky = skyColorDay;
        }
    }
    
    // Smooth transition from Night to Sunrise
    if (sunIntensity <= 0 && sunIntensity > -0.2) {
         // Twilight
         targetSky = skyColorNight.clone().lerp(skyColorSunset, (sunIntensity + 0.2) * 5);
    }

    scene.background.copy(targetSky);
    scene.fog.color.copy(targetSky);

    // Atmosphere / Hemisphere
    // Up color matches sky, Down color matches ground tone
    hemiLight.color.copy(targetSky);
    
    const currentGround = groundColorNight.clone().lerp(groundColorDay, sunIntensity);
    hemiLight.groundColor.copy(currentGround);
    
    // Calculate global ambient brightness for vegetation
    // Mix sun color and moon color influence
    globalLightColor.setHex(0x000000);
    globalLightColor.add(new THREE.Color(0xffdfba).multiplyScalar(sunIntensity));
    globalLightColor.add(new THREE.Color(0x6688ff).multiplyScalar(moonIntensity * 0.5));
    globalLightColor.add(targetSky.multiplyScalar(0.3)); // Ambient
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