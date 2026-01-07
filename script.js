// --- CONFIGURATION ---
const INITIAL_SPEED = 0.4;
const MAX_SPEED = 1.3;
let gameSpeed = INITIAL_SPEED;
const SPAWN_RATE_INITIAL = 1100;

// Variables
let scene, camera, renderer, player;
let obstacles = [], trees = [];
let score = 0;
let isGameRunning = false, isGameOver = false;
let animationId, spawnTimeout;

// Ad Variables
let adCount = 0; 
const ADS_REQUIRED = 3;

// Movement & Physics
let currentLane = 0; // -1, 0, 1
let isJumping = false;
let isSliding = false;
let isPressing = false; // For Tap & Hold

// Physics Constants
const LERP_SPEED = 0.6; // **FIXED LATENCY**: Increased from 0.2 to 0.6 for snappy movement
const JUMP_FORCE = 0.65;
const GRAVITY = 0.04;
let jumpVelocity = 0;

// Touch Handling
let touchStartX = 0, touchStartY = 0;

function init3D() {
    scene = new THREE.Scene(); 
    scene.background = new THREE.Color(0x87CEEB); 
    scene.fog = new THREE.Fog(0x87CEEB, 20, 80);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100); 
    camera.position.set(0, 5, 9); // Camera a bit closer
    camera.lookAt(0, 0, -4);

    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" }); 
    renderer.setSize(window.innerWidth, window.innerHeight); 
    renderer.shadowMap.enabled = true; 
    document.body.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dl = new THREE.DirectionalLight(0xffffff, 0.9); 
    dl.position.set(10, 20, 10); 
    dl.castShadow = true; 
    scene.add(dl);

    // Ground
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 400), new THREE.MeshLambertMaterial({ color: 0x7cfc00 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.1, -100); ground.receiveShadow = true; scene.add(ground);

    // Road
    const road = new THREE.Mesh(new THREE.PlaneGeometry(10, 400), new THREE.MeshLambertMaterial({ color: 0x555555 }));
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0, -100); road.receiveShadow = true; scene.add(road);

    // Player
    player = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
    player.position.y = 0.5; player.castShadow = true; scene.add(player);

    setupControls(); 
    renderer.render(scene, camera);
}

function firstStart() { 
    if(!renderer) init3D(); 
    document.getElementById('home-screen').classList.add('hidden'); 
    document.getElementById('hud').classList.remove('hidden'); 
    startGame(true); 
}

function startGame(reset) {
    isGameRunning = true; isGameOver = false;
    if(reset) { 
        score = 0; 
        gameSpeed = INITIAL_SPEED; 
        document.getElementById('score').innerText = '0'; 
    }
    
    // Reset Player
    currentLane = 0; 
    player.position.set(0, 0.5, 0); 
    player.scale.set(1, 1, 1);
    
    isJumping = false; 
    isSliding = false; 
    isPressing = false;
    jumpVelocity = 0;

    // Clear World
    obstacles.forEach(o => scene.remove(o)); 
    trees.forEach(t => scene.remove(t)); 
    obstacles = []; 
    trees = [];

    animate(); 
    spawnLoop();
}

function spawnLoop() {
    if(!isGameRunning) return;
    spawnObstacle(); 
    spawnTree();
    
    let delay = Math.max(350, SPAWN_RATE_INITIAL / (gameSpeed / INITIAL_SPEED));
    spawnTimeout = setTimeout(spawnLoop, delay);
}

function spawnObstacle() {
    const type = Math.floor(Math.random() * 3);
    let geo, mat, mesh, yPos, col;
    let lane = Math.floor(Math.random() * 3) - 1;

    if (type === 0) { // JUMP (Small, Low)
        geo = new THREE.BoxGeometry(2.5, 0.4, 0.4); // আরও চিকন
        mat = new THREE.MeshLambertMaterial({ color: 0xFFA500 }); // Orange
        yPos = 0.2; col = 'jump';
    } 
    else if (type === 1) { // DUCK (Big, High)
        geo = new THREE.BoxGeometry(2.5, 2.5, 0.5); 
        mat = new THREE.MeshLambertMaterial({ color: 0x1E90FF }); // Blue
        yPos = 2.8; col = 'slide'; // আরও উপরে
    } 
    else { // DODGE (Wall)
        geo = new THREE.BoxGeometry(2.8, 3.5, 0.5);
        mat = new THREE.MeshLambertMaterial({ color: 0xDC143C }); // Red
        yPos = 1.75; col = 'dodge';
    }

    mesh = new THREE.Mesh(geo, mat); 
    mesh.position.set(lane * 3, yPos, -100);
    mesh.castShadow = true; 
    mesh.receiveShadow = true; 
    mesh.userData = { type: col };
    
    scene.add(mesh); 
    obstacles.push(mesh);
}

function spawnTree() {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2, 8), new THREE.MeshLambertMaterial({ color: 0x8B4513 })));
    const l = new THREE.Mesh(new THREE.ConeGeometry(2, 4, 8), new THREE.MeshLambertMaterial({ color: 0x228B22 })); 
    l.position.y = 3; 
    grp.add(l);
    
    grp.position.set((Math.random() > 0.5 ? 1 : -1) * (7 + Math.random() * 10), 1, -100);
    scene.add(grp); 
    trees.push(grp);
}

function animate() {
    if(!isGameRunning) return;

    // --- INSTANT MOVEMENT LOGIC ---
    // Here we use LERP_SPEED (0.6) instead of (0.2) for fast reaction
    let targetX = currentLane * 3;
    player.position.x += (targetX - player.position.x) * LERP_SPEED;

    // --- SLIDE / DUCK LOGIC ---
    // If Holding Down OR Pressing Down Key
    if (isPressing && !isJumping) {
        isSliding = true;
        // Fast Ducking
        player.scale.y += (0.5 - player.scale.y) * LERP_SPEED; 
        player.position.y = 0.25;
    } else if (!isJumping) {
        isSliding = false;
        // Fast Standing up
        player.scale.y += (1.0 - player.scale.y) * LERP_SPEED; 
        if(player.position.y < 0.5) player.position.y = 0.5;
    }

    // --- JUMP LOGIC ---
    if(isJumping) {
        player.position.y += jumpVelocity; 
        jumpVelocity -= GRAVITY;
        
        // Ground Check
        if(player.position.y <= 0.5) { 
            player.position.y = 0.5; 
            isJumping = false; 
            jumpVelocity = 0; // Reset velocity
        }
    }

    // --- OBSTACLE MANAGEMENT ---
    for(let i = obstacles.length - 1; i >= 0; i--) {
        let ob = obstacles[i]; 
        ob.position.z += gameSpeed;
        
        // Hitbox Check
        if (ob.position.z > -1 && ob.position.z < 1 && Math.abs(ob.position.x - player.position.x) < 1) {
            let hit = false;
            
            // Logic for specific obstacles
            if (ob.userData.type === 'jump' && player.position.y < 0.6) hit = true; // Not jumping high enough
            if (ob.userData.type === 'slide' && (!isSliding && player.position.y > 1.5)) hit = true; // Head collision
            if (ob.userData.type === 'dodge') hit = true; // Side collision
            
            if (hit) { gameOver(); return; }
        }
        
        if (ob.position.z > 10) { 
            scene.remove(ob); 
            obstacles.splice(i, 1); 
            score++; 
            document.getElementById('score').innerText = score; 
        }
    }

    // Trees Logic
    trees.forEach((t, i) => { 
        t.position.z += gameSpeed; 
        if (t.position.z > 10) { scene.remove(t); trees.splice(i, 1); } 
    });

    // Speed Progression
    if(gameSpeed < MAX_SPEED) gameSpeed += 0.0001;

    renderer.render(scene, camera); 
    animationId = requestAnimationFrame(animate);
}

function setupControls() {
    // Keyboard Controls
    document.addEventListener('keydown', e => {
        if(!isGameRunning) return;
        if(e.key === 'ArrowLeft' && currentLane > -1) currentLane--;
        if(e.key === 'ArrowRight' && currentLane < 1) currentLane++;
        if(e.key === 'ArrowUp' && !isJumping) { isJumping = true; jumpVelocity = JUMP_FORCE; }
        if(e.key === 'ArrowDown') isPressing = true;
    });
    document.addEventListener('keyup', e => { 
        if(e.key === 'ArrowDown') isPressing = false; 
    });

    // Mobile Touch Controls
    document.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
        isPressing = true; // Assume slide/hold starts immediately on touch
    });
    
    document.addEventListener('touchend', e => {
        if(!isGameRunning) return;
        isPressing = false; // Release hold
        
        let dx = e.changedTouches[0].screenX - touchStartX;
        let dy = e.changedTouches[0].screenY - touchStartY;
        
        // Check for Swipe vs Tap
        if(Math.abs(dx) > Math.abs(dy)) {
            // Horizontal Swipe
            if(Math.abs(dx) > 30) {
                if(dx > 0 && currentLane < 1) currentLane++;
                if(dx < 0 && currentLane > -1) currentLane--;
            }
        } else {
            // Vertical Swipe
            if(dy < -30 && !isJumping) {
                isJumping = true; jumpVelocity = JUMP_FORCE;
            }
        }
    });

    // Cancel 'Hold' if swiping sideways
    document.addEventListener('touchmove', e => {
        if(Math.abs(e.changedTouches[0].screenX - touchStartX) > 30) {
            isPressing = false;
        }
    });
}

function gameOver() { 
    isGameOver = true; 
    isGameRunning = false; 
    clearTimeout(spawnTimeout); 
    cancelAnimationFrame(animationId); 
    
    document.getElementById('hud').classList.add('hidden'); 
    document.getElementById('final-score').innerText = score; 
    document.getElementById('game-over-screen').classList.remove('hidden'); 
    
    adCount = 0; 
    updateAdButtons(); 
}

function watchAd() { 
    const b = document.getElementById('btn-watch-ad'); 
    b.disabled = true; b.innerText = "LOADING..."; 
    
    if(typeof show_10416947 === 'function') {
        show_10416947().then(() => { 
            adCount++; updateAdButtons(); 
        }).catch(() => { 
            b.innerText = "FAILED"; b.disabled = false; 
        }); 
    } else {
        setTimeout(() => { adCount++; updateAdButtons(); }, 1000); 
    }
}

function updateAdButtons() { 
    const b = document.getElementById('btn-watch-ad'), r = document.getElementById('btn-resume-game'); 
    if(adCount < ADS_REQUIRED) { 
        b.style.display = 'inline-block'; 
        r.style.display = 'none'; 
        b.innerText = `WATCH AD (${adCount}/${ADS_REQUIRED})`; 
        b.disabled = false; 
    } else { 
        b.style.display = 'none'; 
        r.style.display = 'inline-block'; 
    } 
}

function resumeGame() { 
    document.getElementById('game-over-screen').classList.add('hidden'); 
    document.getElementById('hud').classList.remove('hidden'); 
    startGame(false); 
}

function restartGame() { 
    document.getElementById('game-over-screen').classList.add('hidden'); 
    document.getElementById('hud').classList.remove('hidden'); 
    startGame(true); 
}

function openModal(id) { document.getElementById(id).style.display = 'block'; } 
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
