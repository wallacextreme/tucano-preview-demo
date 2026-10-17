/**
 * Vonixx 3D Cinema Showcase Carousel — Three.js + GSAP
 * ====================================================
 * High-end cinematic 3D carousel with studio lighting, physical materials,
 * subtle bloom post-processing, GSAP inertia physics, and graceful fallback.
 * 
 * Tucano Auto Peças — Nova Friburgo/RJ
 */

import * as THREE from 'three';

(function () {
    'use strict';

    // ──────────────── CONFIGURATION ────────────────
    const CFG = {
        RING_RADIUS: 14.6,
        CARD_W: 2.85,
        CARD_H: 3.55,
        IMG_W: 2.65,
        IMG_H: 1.32,
        CAMERA_Y: 0.65,
        CAMERA_Z: 20.6,
        CAMERA_FOV: 37,
        BG_COLOR: 0x020617,
        ORANGE: 0xf97316,
        ORANGE_GLOW: 0xfb923c,
        FLOAT_AMPLITUDE: 0.05,
        FLOAT_SPEED: 1.3,
        PARTICLE_COUNT: 50,
        MAX_DPR: 2.5,
        SNAP_DISTANCE: 140, // Pixels per card drag
    };

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ──────────────── DATA GATHERING ────────────────
    function gatherProducts() {
        const container = document.getElementById('vtx-product-data');
        if (!container) return [];
        return Array.from(container.querySelectorAll('article')).map((el, i) => ({
            index: parseInt(el.dataset.index ?? i, 10),
            name: el.dataset.name || 'Produto Vonixx',
            desc: el.dataset.desc || 'Produto de detalhamento automotivo profissional',
            price: el.dataset.price || 'Consulte',
            img: el.dataset.img || '',
            href: el.dataset.href || '#',
            aria: el.dataset.aria || `Ver detalhes de ${el.dataset.name}`,
        }));
    }

    // ──────────────── DOM REFERENCES ────────────────
    const stageEl = document.getElementById('vtx-stage');
    const overlayEl = document.getElementById('vtx-overlay');
    const overlayName = document.getElementById('vtx-overlay-name');
    const overlayDesc = document.getElementById('vtx-overlay-desc');
    const overlayPrice = document.getElementById('vtx-overlay-price');
    const overlayCta = document.getElementById('vtx-overlay-cta');
    const counterEl = document.getElementById('vtx-counter');
    const activeNameEl = document.getElementById('vtx-active-name');
    const dotsContainer = document.getElementById('vtx-dots');
    const prevBtn = document.getElementById('vtx-prev');
    const nextBtn = document.getElementById('vtx-next');

    if (!stageEl) return;

    const products = gatherProducts();
    const TOTAL = products.length;
    if (TOTAL === 0) return;

    const ANGLE_STEP = (Math.PI * 2) / TOTAL;

    // ──────────────── WEBGL DETECTION ────────────────
    function canWebGL() {
        try {
            const canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')));
        } catch {
            return false;
        }
    }

    // ════════════════════════════════════════════════
    //  CSS FALLBACK (When WebGL unavailable)
    // ════════════════════════════════════════════════
    function buildFallback() {
        stageEl.style.height = 'auto';
        stageEl.style.cursor = 'default';
        const track = document.createElement('div');
        track.className = 'vtx-fallback-track';
        products.forEach(p => {
            const card = document.createElement('a');
            card.href = p.href;
            card.className = 'vtx-fallback-card';
            card.setAttribute('aria-label', p.aria);
            card.innerHTML = `
                <img src="${p.img}" alt="${p.name}" loading="lazy" width="280" height="135" decoding="async">
                <span class="vtx-name">${p.name}</span>
                <span class="vtx-desc">${p.desc}</span>
                <span class="vtx-price">${p.price}</span>
            `;
            track.appendChild(card);
        });
        stageEl.appendChild(track);
        if (overlayEl) overlayEl.style.display = 'none';

        createDots((idx) => {
            const cards = track.querySelectorAll('.vtx-fallback-card');
            cards[idx]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        });
    }

    if (!canWebGL()) {
        buildFallback();
        return;
    }

    // ════════════════════════════════════════════════
    //  THREE.JS CINEMATIC 3D ENGINE
    // ════════════════════════════════════════════════
    let currentIndex = 0;
    let proxyX = 0;          // virtual drag position (pixels)
    let currentAngle = 0;    // interpolated 3D angle (radians)
    let isDragging = false;
    let isHovering = false;
    let mouseNDC = { x: 0, y: 0 };
    let animFrame = null;
    let dots = [];
    const cardMeshes = [];
    let particleMesh = null;
    let floatTime = 0;
    let contextLost = false;
    let isVisible = false;

    // ── 1. Renderer Setup (Hardware MSAA + Uncompressed Native Framebuffer) ──
    const dpr = Math.min(window.devicePixelRatio || 1, CFG.MAX_DPR);
    const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
    });
    renderer.setPixelRatio(dpr);
    renderer.setSize(stageEl.clientWidth, stageEl.clientHeight);
    renderer.setClearColor(CFG.BG_COLOR, 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    // Insert canvas behind overlay and masks
    stageEl.insertBefore(renderer.domElement, stageEl.firstChild);

    // WebGL Context Loss Recovery
    renderer.domElement.addEventListener('webglcontextlost', (e) => {
        e.preventDefault();
        contextLost = true;
        cancelAnimationFrame(animFrame);
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => {
        contextLost = false;
        clock.getDelta();
        animate();
    });

    // ── 2. Scene & Fog ──
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(CFG.BG_COLOR, 0.038);

    // ── 3. Camera Setup ──
    const camera = new THREE.PerspectiveCamera(
        CFG.CAMERA_FOV,
        stageEl.clientWidth / stageEl.clientHeight,
        0.1,
        100
    );
    function updateCameraForViewport() {
        const aspect = stageEl.clientWidth / stageEl.clientHeight;
        camera.aspect = aspect;
        // On narrow screens (mobile portrait), step camera back slightly to preserve card view
        if (aspect < 1.0) {
            camera.position.set(0, CFG.CAMERA_Y + 0.25, CFG.CAMERA_Z + 1.5);
            camera.fov = 40;
        } else if (aspect < 1.6) {
            camera.position.set(0, CFG.CAMERA_Y + 0.15, CFG.CAMERA_Z + 0.6);
            camera.fov = 38;
        } else {
            camera.position.set(0, CFG.CAMERA_Y + 0.05, CFG.CAMERA_Z);
            camera.fov = CFG.CAMERA_FOV;
        }
        camera.updateProjectionMatrix();
        camera.lookAt(0, 0.48, 0);
    }
    updateCameraForViewport();

    // ── 4. Studio Lighting Rig ──
    // Key Light: warm studio illumination from top-right
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.1);
    keyLight.position.set(6, 8, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(512, 512);
    keyLight.shadow.radius = 3;
    keyLight.shadow.bias = -0.0004;
    scene.add(keyLight);

    // Fill Light: cool slate fill from top-left
    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.7);
    fillLight.position.set(-7, 4, 6);
    scene.add(fillLight);

    // Rim Light: crisp backlight defining card silhouette
    const rimLight = new THREE.DirectionalLight(0xffffff, 1.2);
    rimLight.position.set(0, 4, -8);
    scene.add(rimLight);

    // Ambient
    const ambientLight = new THREE.AmbientLight(0x1e293b, 0.55);
    scene.add(ambientLight);

    // Dynamic Spotlight on active card
    const spotLight = new THREE.SpotLight(CFG.ORANGE, 2.8, 38, Math.PI / 5, 0.65, 1.4);
    spotLight.position.set(0, 6, CFG.RING_RADIUS + 1.5);
    spotLight.target.position.set(0, 0.35, CFG.RING_RADIUS + 0.45);
    scene.add(spotLight);
    scene.add(spotLight.target);

    // ── 5. Showroom Floor & Contact Shadow ──
    const floorGeo = new THREE.PlaneGeometry(36, 36);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.35, color: 0x000000 });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.rotation.x = -Math.PI / 2;
    floorMesh.position.y = -2.15;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Floor Pedestal Glow under active product
    function createFloorPedestalTexture() {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 512;
        const ctx = c.getContext('2d');
        const grad = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
        grad.addColorStop(0, 'rgba(249, 115, 22, 0.48)');
        grad.addColorStop(0.35, 'rgba(249, 115, 22, 0.20)');
        grad.addColorStop(0.7, 'rgba(249, 115, 22, 0.04)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return tex;
    }
    const pedestalGeo = new THREE.PlaneGeometry(4.0, 2.4);
    const pedestalMat = new THREE.MeshBasicMaterial({
        map: createFloorPedestalTexture(),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const pedestalMesh = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestalMesh.rotation.x = -Math.PI / 2;
    pedestalMesh.position.set(0, -2.14, CFG.RING_RADIUS + 0.25);
    scene.add(pedestalMesh);

    // ── 6. Rounded Rectangle Card Geometry Helper ──
    function createRoundedRectShape(w, h, r) {
        const s = new THREE.Shape();
        const x = -w / 2, y = -h / 2;
        s.moveTo(x + r, y);
        s.lineTo(x + w - r, y);
        s.quadraticCurveTo(x + w, y, x + w, y + r);
        s.lineTo(x + w, y + h - r);
        s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        s.lineTo(x + r, y + h);
        s.quadraticCurveTo(x, y + h, x, y + h - r);
        s.lineTo(x, y + r);
        s.quadraticCurveTo(x, y, x + r, y);
        return s;
    }

    const cardShape = createRoundedRectShape(CFG.CARD_W, CFG.CARD_H, 0.22);
    const cardPanelGeo = new THREE.ShapeGeometry(cardShape, 16);

    const borderShape = createRoundedRectShape(CFG.CARD_W + 0.08, CFG.CARD_H + 0.08, 0.25);
    const cardBorderGeo = new THREE.ShapeGeometry(borderShape, 16);

    const glowShape = createRoundedRectShape(CFG.CARD_W + 0.26, CFG.CARD_H + 0.26, 0.32);
    const cardGlowGeo = new THREE.ShapeGeometry(glowShape, 16);

    const imgGeo = new THREE.PlaneGeometry(CFG.IMG_W, CFG.IMG_H);

    // Pill badge helper for card header (crisp 512x128 canvas)
    function createPillTexture(text) {
        const c = document.createElement('canvas');
        c.width = 512; c.height = 128;
        const ctx = c.getContext('2d');
        ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
        ctx.beginPath();
        ctx.roundRect(8, 8, 496, 112, 56);
        ctx.fill();
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.65)';
        ctx.lineWidth = 6;
        ctx.stroke();

        ctx.font = '900 44px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fb923c';
        ctx.fillText(text, 256, 66);

        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.generateMipmaps = false;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        return tex;
    }
    const badgeTex = createPillTexture('VONIXX OFICIAL');
    const badgeGeo = new THREE.PlaneGeometry(1.24, 0.31);
    const badgeMat = new THREE.MeshBasicMaterial({
        map: badgeTex,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        side: THREE.FrontSide,
    });

    // ── 7. Card Meshes Creation ──
    const textureLoader = new THREE.TextureLoader();
    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    function createCardMesh(product) {
        const group = new THREE.Group();
        group.userData = {
            product,
            currentScale: 1,
            targetScale: 1,
            baseAngle: product.index * ANGLE_STEP,
        };

        // 1. Dark frosted glass panel
        const panelMat = new THREE.MeshPhysicalMaterial({
            color: 0x0c1322,
            roughness: 0.2,
            metalness: 0.12,
            clearcoat: 0.75,
            clearcoatRoughness: 0.18,
            transparent: true,
            opacity: 0.85,
            reflectivity: 0.85,
            depthWrite: true,
            side: THREE.FrontSide,
        });
        const panel = new THREE.Mesh(cardPanelGeo, panelMat);
        panel.castShadow = true;
        panel.receiveShadow = true;
        group.add(panel);

        // 2a. Outer Soft Glow Halo (additive neon aura for active card)
        const glowMat = new THREE.MeshBasicMaterial({
            color: CFG.ORANGE_GLOW,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            side: THREE.FrontSide,
            depthWrite: false,
        });
        const glow = new THREE.Mesh(cardGlowGeo, glowMat);
        glow.position.z = -0.016;
        glow.name = 'glow';
        group.add(glow);

        // 2b. Orange Glowing Frame (active card border)
        const borderMat = new THREE.MeshBasicMaterial({
            color: CFG.ORANGE,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.FrontSide,
        });
        const border = new THREE.Mesh(cardBorderGeo, borderMat);
        border.position.z = -0.010;
        border.name = 'border';
        group.add(border);

        // 3. Vonixx Brand Pill Badge at top of card
        const badge = new THREE.Mesh(badgeGeo, badgeMat);
        badge.position.set(0, 1.40, 0.025);
        group.add(badge);

        // 4. Product Banner Image Plane (Widescreen master artwork)
        const imgMat = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            depthWrite: false,
            side: THREE.FrontSide,
        });
        const imgMesh = new THREE.Mesh(imgGeo, imgMat);
        imgMesh.position.set(0, 0.44, 0.035);
        imgMesh.name = 'image';
        group.add(imgMesh);

        // Load 100% UNCOMPRESSED Native Master Texture (No mipmap downsampling!)
        // By disabling generateMipmaps and using LinearFilter, WebGL samples directly
        // from the 1500x700 master PNG without blur or downsampling artifacts.
        textureLoader.load(product.img, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.generateMipmaps = false;
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.ClampToEdgeWrapping;
            tex.wrapT = THREE.ClampToEdgeWrapping;
            tex.needsUpdate = true;
            imgMesh.material.map = tex;
            imgMesh.material.opacity = 1;
            imgMesh.material.needsUpdate = true;
        });

        // 5. Subtle pedestal bar inside card
        const shelfGeo = new THREE.PlaneGeometry(CFG.CARD_W * 0.88, 0.035);
        const shelfMat = new THREE.MeshBasicMaterial({
            color: CFG.ORANGE,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
        });
        const shelfMesh = new THREE.Mesh(shelfGeo, shelfMat);
        shelfMesh.position.set(0, -0.32, 0.025);
        group.add(shelfMesh);

        return group;
    }

    // Build cards ring
    products.forEach((product) => {
        const mesh = createCardMesh(product);
        const angle = mesh.userData.baseAngle;
        mesh.position.x = Math.sin(angle) * CFG.RING_RADIUS;
        mesh.position.z = Math.cos(angle) * CFG.RING_RADIUS;
        mesh.rotation.y = angle;
        scene.add(mesh);
        cardMeshes.push(mesh);
    });

    // ── 8. Bokeh / Ambient Dust Particles ──
    if (!prefersReducedMotion) {
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(CFG.PARTICLE_COUNT * 3);
        const sizes = new Float32Array(CFG.PARTICLE_COUNT);

        for (let i = 0; i < CFG.PARTICLE_COUNT; i++) {
            positions[i * 3]     = (Math.random() - 0.5) * 22;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 16 - 2;
            sizes[i] = Math.random() * 3.5 + 1.2;
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particleGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

        const particleMat = new THREE.PointsMaterial({
            color: CFG.ORANGE_GLOW,
            size: 0.07,
            transparent: true,
            opacity: 0.25,
            sizeAttenuation: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        particleMesh = new THREE.Points(particleGeo, particleMat);
        scene.add(particleMesh);
    }


    // ── 10. Commercial UI Overlay Update ──
    function updateUI(newIndex) {
        const p = products[newIndex];
        if (!p) return;

        currentIndex = newIndex;

        // Overlay text and link
        if (overlayName) overlayName.textContent = p.name;
        if (overlayDesc) overlayDesc.textContent = p.desc;
        if (overlayPrice) overlayPrice.textContent = p.price;
        if (overlayCta) {
            overlayCta.href = p.href;
            overlayCta.setAttribute('aria-label', p.aria);
        }
        if (overlayEl) {
            overlayEl.classList.add('is-visible');
            if (typeof gsap !== 'undefined') {
                gsap.fromTo(overlayEl,
                    { opacity: 0.6, y: 8 },
                    { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' }
                );
            }
        }

        // Active card scale pop entrance
        const activeMesh = cardMeshes[newIndex];
        if (activeMesh) {
            activeMesh.userData.currentScale = 0.96;
        }

        // External Counter & Active Name
        if (counterEl) counterEl.textContent = `${currentIndex + 1} / ${TOTAL}`;
        if (activeNameEl) activeNameEl.textContent = p.name;

        // Dots update
        dots.forEach((dot, i) => {
            const isActive = i === currentIndex;
            dot.classList.toggle('active', isActive);
            dot.setAttribute('aria-selected', isActive.toString());
            if (isActive && dotsContainer) {
                dot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        });
    }

    function createDots(onClickCb) {
        if (!dotsContainer) return;
        dotsContainer.innerHTML = '';
        dots = [];
        products.forEach((p, i) => {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = `vtx-dot ${i === 0 ? 'active' : ''}`;
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-label', `Ir para ${p.name}`);
            dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
            dot.addEventListener('click', (e) => {
                e.preventDefault();
                if (onClickCb) {
                    onClickCb(i);
                } else {
                    goTo(i);
                }
            });
            dotsContainer.appendChild(dot);
            dots.push(dot);
        });
    }

    // ── 11. Physics & Navigation Engine (GSAP Draggable + Inertia) ──
    const dragProxy = document.createElement('div');
    dragProxy.style.cssText = 'position:absolute;width:1px;height:1px;visibility:hidden;pointer-events:none;';
    document.body.appendChild(dragProxy);

    // Physics callback: syncs virtual pixel progress with 3D angle
    function onPhysicsUpdate(valX) {
        proxyX = valX;
        // Negative X drag = forward rotation (next product)
        const progress = -proxyX / CFG.SNAP_DISTANCE;
        currentAngle = progress * ANGLE_STEP;

        // Calculate active index smoothly
        const rawIndex = Math.round(progress) % TOTAL;
        const normalizedIndex = ((rawIndex % TOTAL) + TOTAL) % TOTAL;
        if (normalizedIndex !== currentIndex) {
            updateUI(normalizedIndex);
        }
    }

    function onPhysicsComplete(valX) {
        proxyX = valX;
        const progress = -proxyX / CFG.SNAP_DISTANCE;
        const rawIndex = Math.round(progress) % TOTAL;
        const normalizedIndex = ((rawIndex % TOTAL) + TOTAL) % TOTAL;
        updateUI(normalizedIndex);
    }

    if (typeof gsap !== 'undefined' && typeof Draggable !== 'undefined') {
        gsap.registerPlugin(Draggable);
        if (typeof InertiaPlugin !== 'undefined') gsap.registerPlugin(InertiaPlugin);

        Draggable.create(dragProxy, {
            type: 'x',
            trigger: stageEl,
            inertia: typeof InertiaPlugin !== 'undefined',
            snap: {
                x: function (endValue) {
                    return Math.round(endValue / CFG.SNAP_DISTANCE) * CFG.SNAP_DISTANCE;
                }
            },
            onDragStart: function () {
                isDragging = true;
                stageEl.style.cursor = 'grabbing';
            },
            onDrag: function () {
                onPhysicsUpdate(this.x);
            },
            onThrowUpdate: function () {
                onPhysicsUpdate(this.x);
            },
            onThrowComplete: function () {
                isDragging = false;
                stageEl.style.cursor = 'grab';
                onPhysicsComplete(this.x);
            },
            onDragEnd: function () {
                if (!this.tween) {
                    isDragging = false;
                    stageEl.style.cursor = 'grab';
                    onPhysicsComplete(this.x);
                }
            }
        });
    } else {
        // Fallback Pointer Drag without GSAP
        let pointerStartX = 0;
        let startProxyX = 0;
        stageEl.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            isDragging = true;
            pointerStartX = e.clientX;
            startProxyX = proxyX;
            stageEl.setPointerCapture?.(e.pointerId);
            stageEl.style.cursor = 'grabbing';
        });
        stageEl.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - pointerStartX;
            onPhysicsUpdate(startProxyX + dx);
        });
        const onPointerUp = (e) => {
            if (!isDragging) return;
            isDragging = false;
            stageEl.releasePointerCapture?.(e.pointerId);
            stageEl.style.cursor = 'grab';
            const snappedX = Math.round(proxyX / CFG.SNAP_DISTANCE) * CFG.SNAP_DISTANCE;
            proxyX = snappedX;
            onPhysicsComplete(snappedX);
        };
        stageEl.addEventListener('pointerup', onPointerUp);
        stageEl.addEventListener('pointercancel', onPointerUp);
    }

    // Programmatic Navigation with Cinematic Easing
    function goTo(targetIndex, animate = true) {
        if (targetIndex < 0 || targetIndex >= TOTAL) return;

        // Calculate shortest circular path
        let diff = targetIndex - currentIndex;
        if (diff > TOTAL / 2) diff -= TOTAL;
        if (diff < -TOTAL / 2) diff += TOTAL;

        const targetX = proxyX - diff * CFG.SNAP_DISTANCE;

        if (animate && typeof gsap !== 'undefined') {
            gsap.killTweensOf(dragProxy);
            gsap.to(dragProxy, {
                x: targetX,
                duration: prefersReducedMotion ? 0.01 : 0.8,
                ease: 'power4.out',
                onUpdate: () => onPhysicsUpdate(gsap.getProperty(dragProxy, 'x')),
                onComplete: () => {
                    proxyX = targetX;
                    onPhysicsComplete(targetX);
                }
            });
        } else {
            proxyX = targetX;
            onPhysicsUpdate(targetX);
            onPhysicsComplete(targetX);
        }
    }

    function next() { goTo((currentIndex + 1) % TOTAL); }
    function prev() { goTo((currentIndex - 1 + TOTAL) % TOTAL); }

    if (prevBtn) prevBtn.addEventListener('click', prev);
    if (nextBtn) nextBtn.addEventListener('click', next);

    // Keyboard Navigation
    stageEl.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
        else if (e.key === 'Home') { e.preventDefault(); goTo(0); }
        else if (e.key === 'End') { e.preventDefault(); goTo(TOTAL - 1); }
    });

    // Mouse Parallax & 3D Tilt
    stageEl.addEventListener('mousemove', (e) => {
        const rect = stageEl.getBoundingClientRect();
        mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });
    stageEl.addEventListener('mouseenter', () => { isHovering = true; });
    stageEl.addEventListener('mouseleave', () => {
        isHovering = false;
        mouseNDC.x = 0;
        mouseNDC.y = 0;
    });

    // ── 12. Main Animation & Render Loop ──
    const clock = new THREE.Clock();

    function animate() {
        if (contextLost) return;
        animFrame = requestAnimationFrame(animate);

        const dt = Math.min(clock.getDelta(), 0.05);
        floatTime += dt;

        // Update cards around ring
        cardMeshes.forEach((mesh, i) => {
            // Angle = baseAngle - currentAngle brings active item to angle 0 (front center)
            const cardAngle = mesh.userData.baseAngle - currentAngle;

            // Normalize angle distance from center [-PI, PI]
            const normAngle = Math.atan2(Math.sin(cardAngle), Math.cos(cardAngle));
            const distFromCenter = Math.abs(normAngle);
            const isActive = i === currentIndex;

            // Active card steps forward in front of the cylinder ring (+0.45)
            const rOffset = isActive ? 0.45 : 0;
            const currentR = CFG.RING_RADIUS + rOffset;
            mesh.position.x = Math.sin(cardAngle) * currentR;
            mesh.position.z = Math.cos(cardAngle) * currentR;

            // Explicit renderOrder: active card (100) always renders on top of neighbors
            mesh.renderOrder = isActive ? 100 : Math.max(1, 50 - Math.round(distFromCenter * 10));

            // 1. Dynamic Scale: active card is prominent, neighbors step down gracefully
            const scaleTarget = isActive ? 1.06 : Math.max(0.55, 0.78 - distFromCenter * 0.16);
            mesh.userData.currentScale += (scaleTarget - mesh.userData.currentScale) * 0.12;
            mesh.scale.setScalar(mesh.userData.currentScale);

            // 2. Glass Panel Opacity falloff
            const panel = mesh.children[0];
            if (panel && panel.material) {
                const targetOpacity = isActive ? 0.88 : Math.max(0.18, 0.65 - distFromCenter * 0.45);
                panel.material.opacity += (targetOpacity - panel.material.opacity) * 0.12;
            }

            // 3. Living, breathing neon glow on active card border & halo
            const border = mesh.getObjectByName('border');
            const glow = mesh.getObjectByName('glow');
            if (border && border.material) {
                if (isActive) {
                    const glowPulse = 0.70 + Math.sin(floatTime * 2.8) * 0.28;
                    border.material.opacity = glowPulse;
                } else {
                    border.material.opacity += (0 - border.material.opacity) * 0.15;
                }
            }
            if (glow && glow.material) {
                if (isActive) {
                    const auraPulse = 0.35 + Math.sin(floatTime * 2.8) * 0.18;
                    glow.material.opacity = auraPulse;
                } else {
                    glow.material.opacity += (0 - glow.material.opacity) * 0.15;
                }
            }

            // 4. Smooth organic levitation & subtle 3D cursor tilt (never static, never pops or clips)
            const floatY = Math.sin(floatTime * 1.8) * 0.12 + Math.sin(floatTime * 0.9) * 0.03;
            const floatRotZ = Math.sin(floatTime * 1.3) * 0.020;
            const floatRotX = Math.cos(floatTime * 1.1) * 0.016;

            if (isActive && !isDragging) {
                const targetTiltY = isHovering ? mouseNDC.x * 0.08 : 0;
                const targetTiltX = isHovering ? -mouseNDC.y * 0.06 : 0;

                const targetPosY = floatY + (isHovering ? mouseNDC.y * 0.05 : 0);
                mesh.position.y += (targetPosY - mesh.position.y) * 0.1;

                const targetRotZ = floatRotZ + (isHovering ? mouseNDC.x * 0.02 : 0);
                mesh.rotation.z += (targetRotZ - mesh.rotation.z) * 0.1;

                mesh.rotation.x += (floatRotX + targetTiltX - mesh.rotation.x) * 0.1;

                const targetRotY = cardAngle + (floatRotZ * 0.3) + targetTiltY;
                mesh.rotation.y += (targetRotY - mesh.rotation.y) * 0.12;
            } else {
                mesh.position.y += (0 - mesh.position.y) * 0.1;
                mesh.rotation.z += (0 - mesh.rotation.z) * 0.1;
                mesh.rotation.x += (0 - mesh.rotation.x) * 0.1;
                mesh.rotation.y = cardAngle;
            }

            // 5. Culling: only front-facing cards rendered
            mesh.visible = distFromCenter < 1.38;
        });

        // Spotlight & showroom floor glow breathe in sync with active product
        const activeCard = cardMeshes[currentIndex];
        if (activeCard) {
            spotLight.target.position.x = activeCard.position.x;
            spotLight.target.position.z = activeCard.position.z;
            spotLight.intensity = 2.4 + Math.sin(floatTime * 2.2) * 0.8;
            pedestalMat.opacity = 0.65 + Math.sin(floatTime * 2.2) * 0.25;
        }

        // Particle parallax & motion
        if (particleMesh && !prefersReducedMotion) {
            particleMesh.rotation.y += dt * 0.015;
            if (isHovering) {
                particleMesh.position.x += (mouseNDC.x * 0.25 - particleMesh.position.x) * 0.02;
                particleMesh.position.y += (mouseNDC.y * 0.12 - particleMesh.position.y) * 0.02;
            }
        }

        // Camera subtle cinematic sway
        if (!prefersReducedMotion && !isDragging) {
            camera.position.x += (mouseNDC.x * 0.15 - camera.position.x) * 0.025;
            camera.position.y += (CFG.CAMERA_Y + mouseNDC.y * 0.08 - camera.position.y) * 0.025;
            camera.lookAt(0, 0.48, 0);
        }

        // Direct hardware MSAA render at physical retina resolution (crystal-clear uncompressed textures)
        renderer.render(scene, camera);
    }

    // ── 13. Responsive Resize Handler ──
    let resizeTimer;
    function onResize() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const w = stageEl.clientWidth;
            const h = stageEl.clientHeight;
            const newDpr = Math.min(window.devicePixelRatio || 1, CFG.MAX_DPR);
            renderer.setPixelRatio(newDpr);
            renderer.setSize(w, h);
            updateCameraForViewport();
        }, 80);
    }
    window.addEventListener('resize', onResize, { passive: true });

    // ── 14. IntersectionObserver: 60fps power saving ──
    const visibilityObs = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            isVisible = e.isIntersecting;
            if (isVisible && !contextLost) {
                clock.getDelta();
                animate();
            } else {
                cancelAnimationFrame(animFrame);
            }
        });
    }, { threshold: 0.05 });
    visibilityObs.observe(stageEl);

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cancelAnimationFrame(animFrame);
        } else if (isVisible && !contextLost) {
            clock.getDelta();
            animate();
        }
    });

    // ── 15. Initial State ──
    createDots();
    updateUI(0);

    if (stageEl.getBoundingClientRect().top < window.innerHeight) {
        animate();
    }

})();
