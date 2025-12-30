import * as THREE from 'three';
import { getTerrainHeight, generateSoilTextures } from './Utils.js';

export class Terrain {
    constructor(scene) {
        this.scene = scene;
        this.mesh = null;
        this.init();
    }

    init() {
        // Size ≈100, Resolution ≈64
        const size = 100;
        const segments = 128; // Slightly higher for better lighting
        const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
        geometry.rotateX(-Math.PI / 2);

        // Deform and set vertex colors
        const posAttribute = geometry.attributes.position;
        const colors = [];
        const count = posAttribute.count;

        for (let i = 0; i < count; i++) {
            const x = posAttribute.getX(i);
            const z = posAttribute.getZ(i);
            const y = getTerrainHeight(x, z);
            posAttribute.setY(i, y);
        }

        geometry.computeVertexNormals();

        // Bake Lighting into Vertex Colors
        const normals = geometry.attributes.normal;
        for (let i = 0; i < count; i++) {
            // Slope factor (Upness)
            const ny = normals.getY(i);
            // Height factor
            const y = posAttribute.getY(i);
            
            // Color Logic:
            // High slope = Rock (Dark Grey)
            // Low slope = Soil/Grass base (Brownish)
            // Low height = darker (Occlusion)
            
            const isFlat = THREE.MathUtils.smoothstep(0.5, 0.8, ny);
            const heightOcc = THREE.MathUtils.smoothstep(-5, 5, y);
            
            const baseColor = new THREE.Color(0x2d4c1e); // Grass Green Base
            const rockColor = new THREE.Color(0x4a4a4a); // Rock Grey
            
            // Bias towards grass color for stylized look
            const finalColor = rockColor.clone().lerp(baseColor, THREE.MathUtils.smoothstep(0.6, 0.9, isFlat));
            finalColor.multiplyScalar(0.5 + 0.5 * heightOcc); // AO

            colors.push(finalColor.r, finalColor.g, finalColor.b);
        }

        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        // Generate Textures
        const { diffuseMap, normalMap } = generateSoilTextures();

        diffuseMap.repeat.set(8, 8);
        normalMap.repeat.set(8, 8);

        const material = new THREE.MeshStandardMaterial({
            map: diffuseMap,
            normalMap: normalMap,
            vertexColors: true,
            roughness: 0.9,
            metalness: 0.1,
            normalScale: new THREE.Vector2(1.5, 1.5)
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
        this.scene.add(this.mesh);
    }
}