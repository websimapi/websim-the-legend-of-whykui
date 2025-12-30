import * as THREE from 'three';
import { getTerrainHeight } from './Utils.js';

export class Terrain {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.init();
    }

    init() {
        // Create a large plane - Increased resolution for smoothness
        const size = 200;
        const segments = 256; 
        const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
        geometry.rotateX(-Math.PI / 2);

        // Displace vertices based on noise
        const posAttribute = geometry.attributes.position;
        for (let i = 0; i < posAttribute.count; i++) {
            const x = posAttribute.getX(i);
            const z = posAttribute.getZ(i);
            const y = getTerrainHeight(x, z);
            posAttribute.setY(i, y);
        }
        
        geometry.computeVertexNormals();

        // Material with better reaction to light
        const material = new THREE.MeshStandardMaterial({
            color: 0x3a4b52, // Slightly lighter/richer base
            roughness: 0.8,
            metalness: 0.0,
            flatShading: false // Smooth shading
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = false; // Self-shadowing on terrain can be expensive/ugly without bias tuning
        this.scene.add(this.mesh);
    }
}