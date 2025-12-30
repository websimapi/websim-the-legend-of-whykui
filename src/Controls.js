import * as THREE from 'three';
import nipplejs from 'nipplejs';
import { getTerrainHeight } from './Utils.js';

export class Controls {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // State
        this.moveVector = new THREE.Vector3(0, 0, 0);
        this.rotationVector = new THREE.Vector2(0, 0); // x: yaw, y: pitch
        this.phi = 0;   // Pitch
        this.theta = 0; // Yaw
        
        // Config
        this.moveSpeed = 10.0;
        this.lookSpeed = 2.0;
        this.lookSpeedTouch = 2.5;
        this.playerHeight = 1.7;

        this.keys = { w: false, a: false, s: false, d: false };

        this.initDesktop();
        this.initMobile();
    }

    initDesktop() {
        // Keyboard
        window.addEventListener('keydown', (e) => {
            switch(e.key.toLowerCase()) {
                case 'w': this.keys.w = true; break;
                case 'a': this.keys.a = true; break;
                case 's': this.keys.s = true; break;
                case 'd': this.keys.d = true; break;
            }
        });

        window.addEventListener('keyup', (e) => {
            switch(e.key.toLowerCase()) {
                case 'w': this.keys.w = false; break;
                case 'a': this.keys.a = false; break;
                case 's': this.keys.s = false; break;
                case 'd': this.keys.d = false; break;
            }
        });

        // Mouse Drag Look
        let isDragging = false;
        let lastMouseX = 0;
        let lastMouseY = 0;

        this.domElement.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                isDragging = true;
                lastMouseX = e.clientX;
                lastMouseY = e.clientY;
            }
        });

        window.addEventListener('mouseup', () => isDragging = false);

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const deltaX = e.clientX - lastMouseX;
            const deltaY = e.clientY - lastMouseY;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            // Apply Look
            this.theta -= deltaX * 0.002 * this.lookSpeed;
            this.phi -= deltaY * 0.002 * this.lookSpeed;
            this.clampRotation();
        });
    }

    initMobile() {
        // Nipple Joystick (Left Side)
        const zoneJoystick = document.getElementById('zone-joystick');
        const manager = nipplejs.create({
            zone: zoneJoystick,
            mode: 'static',
            position: { left: '50%', bottom: '50%' },
            color: 'white',
            size: 100
        });

        manager.on('move', (evt, data) => {
            if (data && data.vector) {
                // Nipple returns vector.y inverted usually relative to screen up? 
                // data.vector = {x, y} unit vector
                // We map this to Move Vector
                // Forward is -Z, Right is +X
                // Nipple Up (y=1) -> Forward (-z)
                this.moveVector.z = -data.vector.y;
                this.moveVector.x = data.vector.x;
            }
        });

        manager.on('end', () => {
            this.moveVector.set(0, 0, 0);
        });

        // Touch Drag Look (Right Side)
        const zoneLook = document.getElementById('zone-look');
        let lastTouchX = 0;
        let lastTouchY = 0;

        zoneLook.addEventListener('touchstart', (e) => {
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
        }, { passive: false });

        zoneLook.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scroll
            const touch = e.touches[0];
            const deltaX = touch.clientX - lastTouchX;
            const deltaY = touch.clientY - lastTouchY;
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;

            this.theta -= deltaX * 0.002 * this.lookSpeedTouch;
            this.phi -= deltaY * 0.002 * this.lookSpeedTouch;
            this.clampRotation();
        }, { passive: false });
    }

    clampRotation() {
        this.phi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, this.phi));
    }

    update(dt) {
        // Keyboard Override
        if (this.keys.w || this.keys.a || this.keys.s || this.keys.d) {
            this.moveVector.set(0,0,0);
            if (this.keys.w) this.moveVector.z -= 1;
            if (this.keys.s) this.moveVector.z += 1;
            if (this.keys.a) this.moveVector.x -= 1;
            if (this.keys.d) this.moveVector.x += 1;
            if (this.moveVector.lengthSq() > 0) this.moveVector.normalize();
        }

        // Apply Rotation to Camera
        const q = new THREE.Quaternion();
        q.setFromEuler(new THREE.Euler(this.phi, this.theta, 0, 'YXZ'));
        this.camera.quaternion.copy(q);

        // Calculate Movement Direction relative to Look
        if (this.moveVector.lengthSq() > 0.01) {
            const direction = new THREE.Vector3(this.moveVector.x, 0, this.moveVector.z);
            direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.theta);
            
            // Move
            this.camera.position.addScaledVector(direction, this.moveSpeed * dt);
        }

        // Terrain Collision
        const tx = this.camera.position.x;
        const tz = this.camera.position.z;
        
        // Bounds check (soft)
        if (Math.abs(tx) > 48 || Math.abs(tz) > 48) {
            // Push back
            this.camera.position.x *= 0.99;
            this.camera.position.z *= 0.99;
        }

        const terrainY = getTerrainHeight(tx, tz);
        const targetY = terrainY + this.playerHeight;

        // Smooth Y
        this.camera.position.y += (targetY - this.camera.position.y) * 10 * dt;
        
        // Hard Floor
        if (this.camera.position.y < terrainY + 0.5) {
            this.camera.position.y = terrainY + 0.5;
        }
    }
}