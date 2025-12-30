import * as THREE from 'three';
import { getTerrainHeight } from './Utils.js';

export class Terrain {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.init();
    }

    init() {
        // Create a large plane
        const size = 200;
        const segments = 100;
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

        // Material with simple lighting
        const material = new THREE.MeshStandardMaterial({
            color: 0x2b3a42,
            roughness: 0.9,
            metalness: 0.1,
            flatShading: true 
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        this.scene.add(this.mesh);
    }
}