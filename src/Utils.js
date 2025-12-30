import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

export function getTerrainHeight(x, z) {
    // Base rolling hills - smoother/wider
    let y = noise2D(x * 0.008, z * 0.008) * 12;
    // Secondary shapes
    y += noise2D(x * 0.03, z * 0.03) * 4;
    // Detail
    y += noise2D(x * 0.1, z * 0.1) * 1.5;
    // Micro detail for roughness
    y += noise2D(x * 0.5, z * 0.5) * 0.25;
    
    return Math.max(y, -8); 
}

export function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}