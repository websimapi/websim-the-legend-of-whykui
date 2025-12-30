import * as THREE from 'three';
import { getTerrainHeight, randomRange } from './Utils.js';

const vertexShader = `
  varying vec2 vUv;
  varying float vHeight;
  uniform float uTime;
  
  attribute float aScale;
  attribute float aRotation;
  attribute vec3 aColor;
  
  varying vec3 vColor;

  // Simple noise for wind
  float noise(vec2 p) {
      return sin(p.x * 10.0 + uTime) * sin(p.y * 10.0 + uTime);
  }

  void main() {
    vUv = uv;
    vColor = aColor;
    
    vec3 pos = position;
    
    // Rotation
    float c = cos(aRotation);
    float s = sin(aRotation);
    mat2 rot = mat2(c, -s, s, c);
    pos.xz = rot * pos.xz;
    
    // Scaling
    pos *= aScale;
    
    // Wind Effect (only affects top of grass)
    float windStrength = 0.5;
    float windWave = sin(uTime * 1.5 + instanceMatrix[3][0] * 0.1 + instanceMatrix[3][2] * 0.1);
    
    // Bend grass based on height (uv.y or pos.y)
    // Assuming simple geometry where y goes from 0 to height
    float bend = pos.y * pos.y * 0.1 * windWave * windStrength;
    pos.x += bend;
    pos.z += bend * 0.5;

    // Instance transform
    vec4 instancePos = instanceMatrix * vec4(pos, 1.0);
    
    gl_Position = projectionMatrix * viewMatrix * instancePos;
    vHeight = pos.y;
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  varying vec3 vColor;
  uniform vec3 uGlobalLight;
  
  void main() {
    // Simple gradient for grass blade
    vec3 color = vColor;
    
    // Darker at bottom
    color *= smoothstep(-0.2, 1.0, vUv.y);
    
    // Apply global lighting (Day/Night)
    color *= uGlobalLight;
    
    gl_FragColor = vec4(color, 1.0);
  }
`;

const flowerFragmentShader = `
  varying vec2 vUv;
  varying vec3 vColor;
  uniform vec3 uGlobalLight;
  
  void main() {
    vec3 color = vColor;
    // Add a glowing center
    float dist = distance(vUv, vec2(0.5));
    if (dist < 0.2) color += 0.5;
    
    // Apply global lighting
    color *= uGlobalLight;

    gl_FragColor = vec4(color, 1.0);
  }
`;

export class Vegetation {
    constructor(scene, count = 5000) {
        this.scene = scene;
        this.count = count;
        this.grassMaterial = null;
        this.flowerMaterial = null;
        this.init();
    }

    init() {
        this.createGrass();
        this.createFlowers();
    }

    createGrass() {
        // Simple blade geometry
        const geometry = new THREE.PlaneGeometry(0.12, 1.2, 1, 3); // Slightly larger, fewer segments to optimize high count
        geometry.translate(0, 0.5, 0); // Pivot at bottom

        this.grassMaterial = new THREE.ShaderMaterial({
            vertexShader,
            fragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uGlobalLight: { value: new THREE.Color(1, 1, 1) }
            },
            side: THREE.DoubleSide
        });

        const mesh = new THREE.InstancedMesh(geometry, this.grassMaterial, this.count);
        
        const dummy = new THREE.Object3D();
        const scales = [];
        const rotations = [];
        const colors = [];

        for (let i = 0; i < this.count; i++) {
            const x = randomRange(-90, 90);
            const z = randomRange(-90, 90);
            const y = getTerrainHeight(x, z);

            dummy.position.set(x, y, z);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);

            scales.push(randomRange(0.8, 1.5));
            rotations.push(randomRange(0, Math.PI * 2));
            
            // Varied greens
            const r = randomRange(0.1, 0.3);
            const g = randomRange(0.4, 0.7);
            const b = randomRange(0.1, 0.3);
            colors.push(r, g, b);
        }

        geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(new Float32Array(scales), 1));
        geometry.setAttribute('aRotation', new THREE.InstancedBufferAttribute(new Float32Array(rotations), 1));
        geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(colors), 3));

        mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(mesh);
    }

    createFlowers() {
        // Simple flower geometry: a cone for stem? No, just the head for now to save polys
        // Let's do a cross-quad shape for the flower head
        const geometry = new THREE.PlaneGeometry(0.3, 0.3);
        geometry.rotateX(-Math.PI / 6); // Tilt up slightly
        geometry.translate(0, 0.8, 0); // Put at top of "stem" (we'll imply stem with position)

        this.flowerMaterial = new THREE.ShaderMaterial({
            vertexShader, // Reuse wind shader
            fragmentShader: flowerFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uGlobalLight: { value: new THREE.Color(1, 1, 1) }
            },
            side: THREE.DoubleSide
        });

        const flowerCount = this.count / 10;
        const mesh = new THREE.InstancedMesh(geometry, this.flowerMaterial, flowerCount);
        
        const dummy = new THREE.Object3D();
        const scales = [];
        const rotations = [];
        const colors = [];

        for (let i = 0; i < flowerCount; i++) {
            const x = randomRange(-90, 90);
            const z = randomRange(-90, 90);
            const y = getTerrainHeight(x, z);

            // Offset y slightly so it sits in the grass
            dummy.position.set(x, y, z);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);

            scales.push(randomRange(0.8, 1.2));
            rotations.push(randomRange(0, Math.PI * 2));
            
            // Algorithmic colors: Blues, Purples, Whites
            const type = Math.random();
            if (type < 0.33) colors.push(0.8, 0.8, 1.0); // White-ish
            else if (type < 0.66) colors.push(0.5, 0.2, 0.8); // Purple
            else colors.push(0.2, 0.5, 1.0); // Blue
        }

        geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(new Float32Array(scales), 1));
        geometry.setAttribute('aRotation', new THREE.InstancedBufferAttribute(new Float32Array(rotations), 1));
        geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(colors), 3));

        mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(mesh);
    }

    update(time, lightColor) {
        if (this.grassMaterial) {
            this.grassMaterial.uniforms.uTime.value = time;
            if (lightColor) this.grassMaterial.uniforms.uGlobalLight.value.copy(lightColor);
        }
        if (this.flowerMaterial) {
            this.flowerMaterial.uniforms.uTime.value = time;
            if (lightColor) this.flowerMaterial.uniforms.uGlobalLight.value.copy(lightColor);
        }
    }
}