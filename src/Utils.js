import { createNoise2D } from 'simplex-noise';

const noise2D = createNoise2D();

export function getTerrainHeight(x, z) {
    // Base rolling hills
    let y = noise2D(x * 0.01, z * 0.01) * 10;
    // Detail
    y += noise2D(x * 0.05, z * 0.05) * 2;
    // Micro detail
    y += noise2D(x * 0.2, z * 0.2) * 0.5;
    
    // Flatten valleys for water or paths (optional, kept simple for now)
    return Math.max(y, -5); 
}

export function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}