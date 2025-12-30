import * as THREE from 'three';
import { Terrain } from './Terrain.js';
import { Vegetation } from './Vegetation.js';

// Setup basic scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Sky blue
scene.fog = new THREE.FogExp2(0x87CEEB, 0.02);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0x404040, 2); // Soft white light
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffdfba, 1.5); // Sunlight
dirLight.position.set(50, 50, 50);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 200;
dirLight.shadow.camera.left = -100;
dirLight.shadow.camera.right = 100;
dirLight.shadow.camera.top = 100;
dirLight.shadow.camera.bottom = -100;
scene.add(dirLight);

// Hemisphere light for better sky/ground blending
const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
scene.add(hemiLight);

// Content
const terrain = new Terrain(scene);
const vegetation = new Vegetation(scene, 15000); // 15k grass blades

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
let cameraAngle = 0;

function animate() {
    requestAnimationFrame(animate);

    const time = clock.getElapsedTime();
    const delta = clock.getDelta();

    // Pan camera
    // Circular path for infinite panning
    const radius = 60;
    const speed = 0.05;
    camera.position.x = Math.sin(time * speed) * radius;
    camera.position.z = Math.cos(time * speed) * radius;
    
    // Dynamic camera height based on terrain roughly?
    // For now, keep it fixed altitude but look at center
    camera.position.y = 15; // Hover
    camera.lookAt(0, 5, 0);

    vegetation.update(time);

    renderer.render(scene, camera);
}

// Handle resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();