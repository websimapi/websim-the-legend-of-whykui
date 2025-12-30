import * as THREE from 'three';
import { randomRange } from './Utils.js';

const grassVertexShader = `
    varying vec2 vUv;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    attribute float aScale;
    attribute vec3 aColor;
    attribute float aRotation;

    uniform float uTime;
    uniform float uWindStrength;

    void main() {
        vUv = uv;
        vColor = aColor;
        
        // --- Geometry construction ---
        vec3 pos = position;
        
        // Scale
        pos.y *= aScale;
        
        // Rotation
        float c = cos(aRotation);
        float s = sin(aRotation);
        pos.xz = mat2(c, -s, s, c) * pos.xz;
        
        // --- Wind Animation ---
        // Simple procedural wind noise
        vec4 worldInstancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float noise = sin(uTime * 2.0 + worldInstancePos.x * 0.5 + worldInstancePos.z * 0.3);
        
        // Bend factor increases with height (uv.y)
        float bend = pow(uv.y, 2.0) * noise * uWindStrength * 0.5;
        
        pos.x += bend;
        pos.z += bend * 0.2; // secondary axis bend
        
        // --- Final Transform ---
        vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        
        // Approx normal for lighting
        vec3 normal = vec3(0.0, 1.0, 0.0);
        // Tilt normal with bend
        normal.x -= bend;
        normal = normalize(mat3(instanceMatrix) * mat3(c, -s, s, c) * normal);
        vNormal = normal;
        
        vViewPosition = -mvPosition.xyz;
    }
`;

const grassFragmentShader = `
    varying vec2 vUv;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    uniform float uRtxEnabled;
    
    // Simple Lighting Params
    const vec3 sunDirection = normalize(vec3(0.5, 0.8, 0.2));
    const vec3 sunColor = vec3(1.0, 0.95, 0.8);
    const vec3 ambientColor = vec3(0.1, 0.2, 0.3);

    void main() {
        // Taper shape discard
        float width = 1.0 - vUv.y * 0.8; // taper at top
        if (abs(vUv.x - 0.5) * 2.0 > width) discard;

        // Base Gradient
        vec3 color = mix(vColor * 0.5, vColor * 1.5, vUv.y);
        
        // --- Lighting ---
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);
        
        // Diffuse (Wrap lighting for SSS feel)
        float NdotL = dot(normal, sunDirection);
        float diff = NdotL * 0.5 + 0.5; // Half-Lambert
        
        // Backlight / Translucency
        float backLight = max(0.0, dot(viewDir, -sunDirection));
        float sss = pow(backLight, 4.0) * vUv.y * 0.8;
        
        // Specular
        vec3 halfVec = normalize(sunDirection + viewDir);
        float NdotH = dot(normal, halfVec);
        float spec = pow(max(0.0, NdotH), 32.0) * 0.2;
        
        // Combine
        vec3 lighting = ambientColor + (sunColor * diff) + (sunColor * sss) + (sunColor * spec);
        
        // AO at bottom
        float ao = smoothstep(0.0, 0.4, vUv.y);
        lighting *= (0.2 + 0.8 * ao);

        gl_FragColor = vec4(color * lighting, 1.0);
        
        // If RTX is on, maybe we boost saturation slightly or leave it to post
        if (uRtxEnabled > 0.5) {
            gl_FragColor.rgb *= 1.1;
        }
    }
`;

export class Vegetation {
    constructor(scene, terrainMesh, count = 20000) {
        this.scene = scene;
        this.terrainMesh = terrainMesh;
        this.count = count;
        this.mesh = null;
        this.material = null;
        this.init();
    }

    init() {
        // Shared Geometry
        const geometry = new THREE.PlaneGeometry(0.15, 1.0, 1, 4);
        geometry.translate(0, 0.5, 0); // Pivot base

        // Material
        this.material = new THREE.ShaderMaterial({
            vertexShader: grassVertexShader,
            fragmentShader: grassFragmentShader,
            uniforms: {
                uTime: { value: 0 },
                uWindStrength: { value: 1.0 },
                uRtxEnabled: { value: 0.0 }
            },
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.InstancedMesh(geometry, this.material, this.count);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;

        // Placement Logic
        const dummy = new THREE.Object3D();
        const raycaster = new THREE.Raycaster();
        const down = new THREE.Vector3(0, -1, 0);
        
        const scales = [];
        const colors = [];
        const rotations = [];
        
        let validCount = 0;
        
        for (let i = 0; i < this.count; i++) {
            // Random Pos
            const x = randomRange(-48, 48);
            const z = randomRange(-48, 48);
            
            // Raycast to find ground height and normal
            raycaster.set(new THREE.Vector3(x, 50, z), down);
            const intersects = raycaster.intersectObject(this.terrainMesh);
            
            let scale = 0; // default hidden
            let color = [0,0,0];
            let rot = 0;

            if (intersects.length > 0) {
                const hit = intersects[0];
                const slope = hit.face.normal.y; // 1 is flat up
                
                // Only place on relatively flat ground (grass doesn't grow on steep cliffs)
                if (slope > 0.7) {
                    dummy.position.copy(hit.point);
                    rot = Math.random() * Math.PI * 2;
                    scale = randomRange(0.7, 1.3);
                    
                    // Jitter color hue (HSL -> RGB manual or approx)
                    // Base Green (0.2, 0.5, 0.1)
                    const hueShift = Math.random() * 0.2 - 0.1;
                    color = [0.1 + hueShift, 0.4 + hueShift, 0.1];
                    validCount++;
                }
            }

            dummy.scale.setScalar(scale); // if scale 0, invisible
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
            
            scales.push(scale);
            rotations.push(rot);
            colors.push(...color);
        }

        geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(new Float32Array(scales), 1));
        geometry.setAttribute('aRotation', new THREE.InstancedBufferAttribute(new Float32Array(rotations), 1));
        geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(colors), 3));

        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);
    }

    update(time, rtxEnabled, windEnabled) {
        if (this.material) {
            this.material.uniforms.uTime.value = time;
            this.material.uniforms.uRtxEnabled.value = rtxEnabled ? 1.0 : 0.0;
            this.material.uniforms.uWindStrength.value = windEnabled ? 1.0 : 0.1;
        }
    }
}