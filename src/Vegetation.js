import * as THREE from 'three';
import { randomRange } from './Utils.js';

const grassVertexShader = `
    varying vec2 vUv;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vSway;
    
    attribute float aScale;
    attribute vec3 aColor;
    attribute float aRotation;

    uniform float uTime;
    uniform float uWindStrength;

    void main() {
        vUv = uv;
        vColor = aColor;
        
        // World position of the instance base
        vec4 worldInstancePos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        
        // --- Wind Calculation ---
        // Multi-frequency noise for more natural movement
        float t = uTime * 1.5;
        float windX = sin(t + worldInstancePos.x * 0.5 + worldInstancePos.z * 0.2);
        float windZ = cos(t * 0.8 + worldInstancePos.x * 0.3 + worldInstancePos.z * 0.5);
        float windDetail = sin(t * 3.0 + worldInstancePos.x + worldInstancePos.z);
        
        float sway = (windX + windZ * 0.5 + windDetail * 0.2) * uWindStrength;
        vSway = sway;

        // --- Geometry ---
        vec3 pos = position;
        pos.y *= aScale;
        
        // Rotation
        float c = cos(aRotation);
        float s = sin(aRotation);
        pos.xz = mat2(c, -s, s, c) * pos.xz;
        
        // Apply Sway based on height (parabolic for stiffness)
        float bendFactor = pow(uv.y, 1.5);
        pos.x += sway * 0.5 * bendFactor;
        pos.z += sway * 0.2 * bendFactor;
        
        // --- Outputs ---
        vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
        vec4 mvPosition = viewMatrix * worldPos;
        gl_Position = projectionMatrix * mvPosition;
        
        // Normal adjustment for stylized lighting
        // We tilt the normal slightly towards the sway to catch light
        vec3 normal = vec3(0.0, 1.0, 0.0);
        normal.x -= sway * 0.3;
        normal = normalize(mat3(instanceMatrix) * mat3(c, -s, s, c) * normal);
        
        // Make normals point slightly up more uniformly for "fluffy" look
        vNormal = normalize(mix(normal, vec3(0.0, 1.0, 0.0), 0.4));
        vViewPosition = -mvPosition.xyz;
    }
`;

const grassFragmentShader = `
    varying vec2 vUv;
    varying vec3 vColor;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vSway;

    uniform float uRtxEnabled;
    
    // Lighting Params
    // Matches direction of main DirectionalLight (50, 80, 20)
    const vec3 sunDirection = normalize(vec3(0.5, 0.8, 0.2));
    const vec3 sunColor = vec3(1.1, 1.05, 0.9);
    const vec3 ambientColor = vec3(0.4, 0.45, 0.5); // Slightly brighter, less stark blue

    void main() {
        // Zelda-style shape: tapered tip
        // Width at y=0 is 1.0, at y=1 is 0.0
        float shapeWidth = 1.0 - pow(vUv.y, 0.8); 
        if (abs(vUv.x - 0.5) * 2.0 > shapeWidth) discard;

        // --- Color Gradient ---
        // Base is dark, top is light/yellowish
        vec3 colorBottom = vColor * 0.8;
        vec3 colorTop = vColor * 1.6 + vec3(0.1, 0.1, 0.0); // Add yellow tint
        vec3 color = mix(colorBottom, colorTop, smoothstep(0.0, 1.0, vUv.y));

        // --- Lighting ---
        vec3 normal = normalize(vNormal);
        vec3 viewDir = normalize(vViewPosition);

        // Simple Half-Lambert for soft shading
        float NdotL = dot(normal, sunDirection);
        float lightIntensity = NdotL * 0.5 + 0.5;
        
        // Add a bit of "rim" on the sway side
        float rim = 1.0 - max(0.0, dot(viewDir, normal));
        rim = pow(rim, 3.0) * 0.5;

        // Specular shine (glossy grass)
        vec3 halfVec = normalize(sunDirection + viewDir);
        float NdotH = dot(normal, halfVec);
        float spec = pow(max(0.0, NdotH), 20.0) * 0.3 * vUv.y; // Only shiny at top
        
        // Ambient Occlusion ramp at bottom
        float ao = smoothstep(0.0, 0.3, vUv.y);
        
        vec3 finalLighting = ambientColor + (sunColor * lightIntensity) + (sunColor * spec) + (sunColor * rim);
        finalLighting *= (0.4 + 0.6 * ao); // darkening at root

        gl_FragColor = vec4(color * finalLighting, 1.0);
        
        // Boost saturation for stylized look
        if (uRtxEnabled > 0.5) {
            vec3 gray = vec3(dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114)));
            gl_FragColor.rgb = mix(gray, gl_FragColor.rgb, 1.3); // Saturation boost
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
        const geometry = new THREE.PlaneGeometry(0.3, 1.0, 1, 1); // Wider, less poly
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
                    
                    // Vibrant Zelda-like Green
                    // Variation between slightly bluish green and yellowish green
                    const v = Math.random();
                    // Base: R:0.1, G:0.6, B:0.1
                    // Variation adds slightly R/G
                    const r = 0.05 + v * 0.1;
                    const g = 0.45 + v * 0.3;
                    const b = 0.05 + v * 0.1;
                    
                    color = [r, g, b];
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