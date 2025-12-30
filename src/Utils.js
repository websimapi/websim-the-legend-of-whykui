import { createNoise2D } from 'simplex-noise';
import * as THREE from 'three';

const noise2D = createNoise2D();

// Terrain height function - Reused for physics and visual generation
export function getTerrainHeight(x, z) {
    // Large low-frequency shapes
    let y = noise2D(x * 0.015, z * 0.015) * 8;
    // Medium details
    y += noise2D(x * 0.05, z * 0.05) * 3;
    // Small variation
    y += noise2D(x * 0.1, z * 0.1) * 1;
    
    // Flatten valleys slightly
    if (y < -2) y = -2 + (y + 2) * 0.5;
    
    return y;
}

export function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

// Procedurally generate soil texture and normal map
export function generateSoilTextures() {
    const width = 512;
    const height = 512;
    
    const size = width * height;
    const dataDiffuse = new Uint8Array(4 * size);
    
    // Generate Diffuse
    for (let i = 0; i < size; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        
        // Base brown noise
        const n = noise2D(x * 0.05, y * 0.05);
        const n2 = noise2D(x * 0.2, y * 0.2);
        
        // Brown/Earth colors
        const r = 80 + n * 20 + n2 * 10;
        const g = 60 + n * 15 + n2 * 5;
        const b = 40 + n * 10;
        
        // Add some high freq noise
        const noiseVal = Math.random() * 20 - 10;
        
        dataDiffuse[i * 4] = r + noiseVal;
        dataDiffuse[i * 4 + 1] = g + noiseVal;
        dataDiffuse[i * 4 + 2] = b + noiseVal;
        dataDiffuse[i * 4 + 3] = 255;
    }
    
    const diffuseMap = new THREE.DataTexture(dataDiffuse, width, height);
    diffuseMap.wrapS = THREE.RepeatWrapping;
    diffuseMap.wrapT = THREE.RepeatWrapping;
    diffuseMap.needsUpdate = true;

    // Generate Normal Map from height data (using just the R channel of diffuse as proxy for 'height' variance)
    const dataNormal = new Uint8Array(4 * size);
    const v3 = new THREE.Vector3();
    
    for (let i = 0; i < size; i++) {
        const x = i % width;
        const y = Math.floor(i / width);
        
        // Sample neighbors
        const x1 = (x - 1 + width) % width;
        const x2 = (x + 1) % width;
        const y1 = (y - 1 + height) % height;
        const y2 = (y + 1) % height;
        
        // Use Red channel as height proxy
        const hL = dataDiffuse[(y * width + x1) * 4] / 255.0;
        const hR = dataDiffuse[(y * width + x2) * 4] / 255.0;
        const hD = dataDiffuse[(y1 * width + x) * 4] / 255.0;
        const hU = dataDiffuse[(y2 * width + x) * 4] / 255.0;
        
        // Sobel filter approx
        v3.set(hL - hR, 1.0 / 10.0, hD - hU).normalize();
        
        dataNormal[i * 4] = (v3.x * 0.5 + 0.5) * 255;
        dataNormal[i * 4 + 1] = (v3.y * 0.5 + 0.5) * 255;
        dataNormal[i * 4 + 2] = (v3.z * 0.5 + 0.5) * 255;
        dataNormal[i * 4 + 3] = 255;
    }

    const normalMap = new THREE.DataTexture(dataNormal, width, height);
    normalMap.wrapS = THREE.RepeatWrapping;
    normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.needsUpdate = true;

    return { diffuseMap, normalMap };
}