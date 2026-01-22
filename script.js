// --- ENHANCED GAME CONFIGURATION ---
const CONFIG = {
    INITIAL_SPEED: 0.4,
    MAX_SPEED: 1.8,
    SPAWN_RATE_INITIAL: 1100,
    ADS_REQUIRED: 3,
    
    // Movement
    LERP_SPEED: 0.7,
    JUMP_FORCE: 0.7,
    GRAVITY: 0.04,
    SLIDE_DURATION: 800,
    
    // Game Economy
    COIN_VALUE: 10,
    GEM_VALUE: 50,
    COIN_SPAWN_RATE: 0.3,
    POWERUP_SPAWN_RATE: 0.1,
    
    // Ad System
    AD_INTERVAL: 30000,
    BANNER_AD_INTERVAL: 60000,
    INTERSTITIAL_COUNTDOWN: 5
};

// Game State
let gameState = {
    score: 0,
    coins: 0,
    gems: 0,
    highScore: parseInt(localStorage.getItem('highScore')) || 0,
    distance: 0,
    gameSpeed: CONFIG.INITIAL_SPEED,
    isGameRunning: false,
    isGameOver: false,
    isPaused: false,
    multiplier: 1.0,
    combo: 0,
    adCount: 0,
    lastAdShown: 0,
    powerups: {
        magnet: 0,
        shield: 0,
        speed: 0
    },
    currentCharacter: 0,
    characters: [
        { id: 0, name: "Runner", color: 0xff0000, unlocked: true, price: 0 },
        { id: 1, name: "Ninja", color: 0x0000ff, unlocked: false, price: 100 },
        { id: 2, name: "Robot", color: 0x00ff00, unlocked: false, price: 250 },
        { id: 3, name: "Knight", color: 0xffd700, unlocked: false, price: 500 }
    ]
};

// Three.js Variables
let scene, camera, renderer, player;
let obstacles = [], trees = [], coins = [], powerups = [];
let animationId, spawnTimeout, gameTime = 0;

// Player State
let currentLane = 0;
let isJumping = false, isSliding = false, jumpVelocity = 0;
let activePowerup = null, powerupTimer = 0;

// Touch Detection
let touchStartX = 0, touchStartY = 0, lastTapTime = 0;
let touchStartTime = 0, isSwiping = false;

// Ad System Variables
let adInterval, bannerInterval, interstitialCountdown;
let adQueue = [];

// Initialize 3D Environment
function init3D() {
    // Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x87CEEB, 20, 150);
    
    // Skybox
    const skyGeometry = new THREE.BoxGeometry(1000, 500, 1000);
    const skyMaterials = [
        new THREE.MeshBasicMaterial({ color: 0x87CEEB }),
        new THREE.MeshBasicMaterial({ color: 0x87CEEB }),
        new THREE.MeshBasicMaterial({ color: 0x87CEEB }),
        new THREE.MeshBasicMaterial({ color: 0x7CFC00 }),
        new THREE.MeshBasicMaterial({ color: 0x87CEEB }),
        new THREE.MeshBasicMaterial({ color: 0x87CEEB })
    ];
    const skybox = new THREE.Mesh(skyGeometry, skyMaterials);
    scene.add(skybox);
    
    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 8, 15);
    camera.lookAt(0, 0, 0);
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true, 
        alpha: true,
        powerPreference: "high-performance" 
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);
    
    // Enhanced Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(20, 40, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -50;
    directionalLight.shadow.camera.right = 50;
    directionalLight.shadow.camera.top = 50;
    directionalLight.shadow.camera.bottom = -50;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x7CFC00, 0.3);
    scene.add(hemisphereLight);
    
    // Ground
    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(200, 400),
        new THREE.MeshLambertMaterial({ 
            color: 0x7cfc00,
            side: THREE.DoubleSide
        })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.1, -100);
    ground.receiveShadow = true;
    scene.add(ground);
    
    // Road
    const road = new THREE.Mesh(
        new THREE.PlaneGeometry(12, 400),
        new THREE.MeshLambertMaterial({ 
            color: 0x333333,
            side: THREE.DoubleSide
        })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.01, -100);
    road.receiveShadow = true;
    scene.add(road);
    
    // Road markings
    for(let i = 0; i < 100; i++) {
        const line = new THREE.Mesh(
            new THREE.PlaneGeometry(0.5, 3),
            new THREE.MeshLambertMaterial({ color: 0xffffff })
        );
        line.rotation.x = -Math.PI / 2;
        line.position.set(0, 0.02, -100 + i * 8);
        scene.add(line);
    }
    
    // Player
    const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
    const playerMaterial = new THREE.MeshPhongMaterial({ 
        color: gameState.characters[gameState.currentCharacter].color,
        shininess: 100,
        specular: 0xffffff
    });
    player = new THREE.Mesh(playerGeometry, playerMaterial);
    player.position.set(0, 1, 0);
    player.castShadow = true;
    scene.add(player);
    
    createParticleSystem();
    setupControls();
    window.addEventListener('resize', onWindowResize);
}

// Enhanced Particle System
function createParticleSystem() {
    const particleCount = 1000;
    const particles = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    
    for(let i = 0; i < particleCount * 3; i += 3) {
        positions[i] = (Math.random() - 0.5) * 200;
        positions[i + 1] = Math.random() * 50;
        positions[i + 2] = (Math.random() - 0.5) * 400 - 100;
        
        colors[i] = 0.87;
        colors[i + 1] = 0.81;
        colors[i + 2] = 0.91;
    }
    
    particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    const particleMaterial = new THREE.PointsMaterial({
        size: 3,
        vertexColors: true,
        transparent: true,
        opacity: 0.6
    });
    
    const particleSystem = new THREE.Points(particles, particleMaterial);
    scene.add(particleSystem);
}

// AD SYSTEM IMPLEMENTATION
function initAdSystem() {
    showBannerAd();
    
    setTimeout(() => {
        showInterstitialAd();
    }, 1000);
    
    bannerInterval = setInterval(showBannerAd, CONFIG.BANNER_AD_INTERVAL);
    adQueue.push('banner');
    adQueue.push('interstitial');
    
    if(typeof show_10416947 === 'function') {
        console.log('Ad SDK loaded successfully');
    }
}

function showBannerAd() {
    const banner = document.getElementById('banner-ad');
    const ads = [
        { text: "🎮 PLAY MORE GAMES!", color: "#FF4500" },
        { text: "💰 EARN REWARDS!", color: "#FFD700" },
        { text: "⚡ BOOST YOUR SCORE!", color: "#00BFFF" }
    ];
    
    const ad = ads[Math.floor(Math.random() * ads.length)];
    banner.innerHTML = `
        <div class="ad-content" style="background: ${ad.color}20; border-left: 5px solid ${ad.color}; padding: 10px; border-radius: 8px; display: flex; align-items: center; gap: 15px; width: 100%; justify-content: center;">
            <i class="fas fa-ad"></i>
            <span style="font-weight: bold;">${ad.text}</span>
            <button class="btn-ad-small" onclick="handleAdClick()" style="background: ${ad.color}; color: white; border: none; padding: 8px 15px; border-radius: 20px; font-size: 12px; cursor: pointer;">CLICK HERE</button>
        </div>
    `;
    
    banner.style.display = 'flex';
    setTimeout(() => {
        banner.style.display = 'none';
    }, 8000);
}

function showInterstitialAd() {
    if(gameState.isPaused || gameState.isGameOver) return;
    
    const interstitial = document.getElementById('interstitial-ad');
    interstitial.classList.remove('hidden');
    
    let countdown = CONFIG.INTERSTITIAL_COUNTDOWN;
    const countdownElement = document.getElementById('countdown');
    const closeBtn = document.querySelector('.btn-close-ad');
    
    closeBtn.disabled = true;
    closeBtn.style.cursor = 'not-allowed';
    
    const countdownInterval = setInterval(() => {
        countdown--;
        countdownElement.textContent = countdown;
        
        if(countdown <= 0) {
            clearInterval(countdownInterval);
            closeBtn.disabled = false;
            closeBtn.style.cursor = 'pointer';
            closeBtn.innerHTML = '<i class="fas fa-times"></i> CLOSE';
            closeBtn.onclick = closeInterstitial;
        }
    }, 1000);
    
    const adDisplay = document.getElementById('ad-display');
    const ads = [
        { title: "SPECIAL OFFER!", desc: "Get 2x coins for 24 hours!" },
        { title: "NEW CHARACTER!", desc: "Unlock the Ninja runner now!" },
        { title: "LIMITED TIME!", desc: "50% discount on all powerups!" }
    ];
    
    const ad = ads[Math.floor(Math.random() * ads.length)];
    adDisplay.innerHTML = `
        <div class="ad-full" style="text-align: center; color: white;">
            <h4 style="color: #FFD700; margin-bottom: 15px;">${ad.title}</h4>
            <p style="margin-bottom: 20px;">${ad.desc}</p>
            <div class="ad-image" style="width: 100%; height: 150px; background: linear-gradient(45deg, #FF4500, #FFD700); border-radius: 10px; margin-bottom: 20px;"></div>
            <button class="btn-ad-action" onclick="handleAdAction()" style="background: #00BFFF; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer;">LEARN MORE</button>
        </div>
    `;
}

function closeInterstitial() {
    document.getElementById('interstitial-ad').classList.add('hidden');
    setTimeout(() => {
        if(gameState.isGameRunning && !gameState.isGameOver) {
            showInterstitialAd();
        }
    }, 60000);
}

function handleAdClick() {
    if(typeof show_10416947 === 'function') {
        show_10416947().then(() => {
            gameState.coins += 50;
            updateUI();
            showRewardNotification("+50 Coins!");
        });
    } else {
        gameState.coins += 50;
        updateUI();
        showRewardNotification("+50 Coins!");
    }
}

function handleAdAction() {
    window.open('https://example.com', '_blank');
}

// Game Functions
function firstStart() {
    if(!renderer) init3D();
    initAdSystem();
    
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    
    showInterstitialAd();
    
    setTimeout(() => {
        startGame(true);
    }, CONFIG.INTERSTITIAL_COUNTDOWN * 1000);
}
function startGame(reset) {
    gameState.isGameRunning = true;
    gameState.isGameOver = false;
    
    if(reset) {
        gameState.score = 0;
        gameState.distance = 0;
        gameState.gameSpeed = CONFIG.INITIAL_SPEED;
        gameState.multiplier = 1.0;
        gameState.combo = 0;
        updateUI();
    }
    
    currentLane = 0;
    player.position.set(0, 1, 0);
    player.scale.set(1, 1, 1);
    isJumping = false;
    isSliding = false;
    jumpVelocity = 0;
    
    clearObjects();
    
    gameTime = 0;
    animate();
    spawnLoop();
    
    const bgMusic = document.getElementById('bg-music');
    bgMusic.volume = 0.3;
    bgMusic.play().catch(e => console.log("Audio play failed:", e));
    
    setTimeout(() => {
        if(gameState.isGameRunning) {
            showBannerAd();
        }
    }, 15000);
}

function spawnLoop() {
    if(!gameState.isGameRunning) return;
    
    spawnObstacle();
    spawnTree();
    
    if(Math.random() < CONFIG.COIN_SPAWN_RATE) {
        spawnCoin();
    }
    
    if(Math.random() < CONFIG.POWERUP_SPAWN_RATE) {
        spawnPowerup();
    }
    
    const delay = Math.max(250, CONFIG.SPAWN_RATE_INITIAL / (gameState.gameSpeed / CONFIG.INITIAL_SPEED));
    spawnTimeout = setTimeout(spawnLoop, delay);
}

function spawnObstacle() {
    const types = [
        { type: 'jump', height: 0.4, width: 2.5, color: 0xFFA500, yPos: 0.2 },
        { type: 'slide', height: 2.5, width: 2.5, color: 0x1E90FF, yPos: 2.8 },
        { type: 'dodge', height: 3.5, width: 2.8, color: 0xDC143C, yPos: 1.75 },
        { type: 'double', height: 1.5, width: 5, color: 0x9400D3, yPos: 0.75 }
    ];
    
    const obstacleType = types[Math.floor(Math.random() * types.length)];
    const lane = Math.floor(Math.random() * 3) - 1;
    
    const geometry = new THREE.BoxGeometry(obstacleType.width, obstacleType.height, 0.5);
    const material = new THREE.MeshPhongMaterial({ 
        color: obstacleType.color,
        shininess: 30
    });
    
    const obstacle = new THREE.Mesh(geometry, material);
    obstacle.position.set(lane * 4, obstacleType.yPos, -100);
    obstacle.castShadow = true;
    obstacle.receiveShadow = true;
    obstacle.userData = { type: obstacleType.type };
    
    if(obstacleType.type === 'double') {
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x9400D3,
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(geometry, glowMaterial);
        glow.scale.set(1.2, 1.2, 1.2);
        obstacle.add(glow);
    }
    
    scene.add(obstacle);
    obstacles.push(obstacle);
}

function spawnCoin() {
    const lane = Math.floor(Math.random() * 3) - 1;
    
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
    const material = new THREE.MeshPhongMaterial({ 
        color: 0xFFD700,
        emissive: 0xFFD700,
        emissiveIntensity: 0.5,
        shininess: 100
    });
    
    const coin = new THREE.Mesh(geometry, material);
    coin.rotation.x = Math.PI / 2;
    coin.position.set(lane * 4, 1.5, -100);
    coin.castShadow = true;
    coin.userData = { type: 'coin', value: CONFIG.COIN_VALUE };
    
    scene.add(coin);
    coins.push(coin);
}

function spawnPowerup() {
    const powerups = [
        { type: 'magnet', color: 0x00BFFF, icon: 'fa-magnet' },
        { type: 'shield', color: 0x32CD32, icon: 'fa-shield-alt' },
        { type: 'speed', color: 0xFF4500, icon: 'fa-bolt' }
    ];
    
    const powerup = powerups[Math.floor(Math.random() * powerups.length)];
    const lane = Math.floor(Math.random() * 3) - 1;
    
    const geometry = new THREE.OctahedronGeometry(0.8);
    const material = new THREE.MeshPhongMaterial({ 
        color: powerup.color,
        emissive: powerup.color,
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.9
    });
    
    const powerupMesh = new THREE.Mesh(geometry, material);
    powerupMesh.position.set(lane * 4, 2, -100);
    powerupMesh.castShadow = true;
    powerupMesh.userData = { type: 'powerup', powerup: powerup.type };
    
    scene.add(powerupMesh);
    powerups.push(powerupMesh);
}

function spawnTree() {
    const treeGroup = new THREE.Group();
    
    const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 2, 8);
    const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.castShadow = true;
    treeGroup.add(trunk);
    
    for(let i = 0; i < 3; i++) {
        const leavesGeometry = new THREE.ConeGeometry(2 - i * 0.5, 3 - i * 0.5, 8);
        const leavesMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 1.5 + i * 1;
        leaves.castShadow = true;
        treeGroup.add(leaves);
    }
    
    const side = Math.random() > 0.5 ? 1 : -1;
    treeGroup.position.set(side * (8 + Math.random() * 15), 0, -100);
    scene.add(treeGroup);
    trees.push(treeGroup);
}

// Enhanced Game Loop
function animate() {
    if(!gameState.isGameRunning) return;
    
    gameTime += 1;
    gameState.distance += gameState.gameSpeed * 0.1;
    
    const targetX = currentLane * 4;
    player.position.x += (targetX - player.position.x) * CONFIG.LERP_SPEED;
    
    if(isSliding) {
        player.scale.y = Math.max(0.5, player.scale.y - 0.1);
        player.position.y = 0.25;
    } else if(!isJumping) {
        player.scale.y = Math.min(1, player.scale.y + 0.1);
        player.position.y = 1;
    }
    
    if(isJumping) {
        player.position.y += jumpVelocity;
        jumpVelocity -= CONFIG.GRAVITY;
        player.rotation.x += 0.05;
        
        if(player.position.y <= 1) {
            player.position.y = 1;
            player.rotation.x = 0;
            isJumping = false;
            jumpVelocity = 0;
            playSound('jump-sound');
        }
    }
    
    obstacles.forEach((obstacle, index) => {
        obstacle.position.z += gameState.gameSpeed;
        obstacle.rotation.y += 0.01;
        
        if(obstacle.position.z > 10) {
            scene.remove(obstacle);
            obstacles.splice(index, 1);
            
            gameState.score += Math.floor(10 * gameState.multiplier);
            gameState.combo++;
            
            if(gameState.combo % 5 === 0) {
                gameState.multiplier = Math.min(3.0, gameState.multiplier + 0.1);
            }
            
            updateUI();
        }
    });
    
    coins.forEach((coin, index) => {
        coin.position.z += gameState.gameSpeed;
        coin.rotation.y += 0.1;
        
        if(coin.position.z > 10) {
            scene.remove(coin);
            coins.splice(index, 1);
        }
        
        if(checkCollision(player, coin, 1.5)) {
            scene.remove(coin);
            coins.splice(index, 1);
            
            const coinValue = CONFIG.COIN_VALUE * gameState.multiplier;
            gameState.coins += coinValue;
            gameState.score += Math.floor(coinValue);
            
            playSound('coin-sound');
            showFloatingText("+" + coinValue, coin.position, 0xFFD700);
            updateUI();
        }
    });
    
    powerups.forEach((powerup, index) => {
        powerup.position.z += gameState.gameSpeed;
        powerup.rotation.y += 0.05;
        powerup.rotation.x += 0.03;
        
        if(powerup.position.z > 10) {
            scene.remove(powerup);
            powerups.splice(index, 1);
        }
        
        if(checkCollision(player, powerup, 1.5)) {
            scene.remove(powerup);
            powerups.splice(index, 1);
            
            const powerupType = powerup.userData.powerup;
            gameState.powerups[powerupType]++;
            activatePowerup(powerupType);
            
            playSound('coin-sound');
            showFloatingText(powerupType.toUpperCase() + "!", powerup.position, 0x00BFFF);
            updatePowerupDisplay();
        }
    });
    
    trees.forEach((tree, index) => {
        tree.position.z += gameState.gameSpeed;
        if(tree.position.z > 10) {
            scene.remove(tree);
            trees.splice(index, 1);
        }
    });
    
    for(let obstacle of obstacles) {
        if(checkCollision(player, obstacle, 1.0)) {
            const obstacleType = obstacle.userData.type;
            let hit = false;
            
            switch(obstacleType) {
                case 'jump':
                    hit = player.position.y < 1.2;
                    break;
                case 'slide':
                    hit = !isSliding && player.position.y > 2;
                    break;
                case 'dodge':
                    hit = true;
                    break;
                case 'double':
                    hit = !isJumping && !isSliding;
                    break;
            }
            
            if(hit) {
                if(gameState.powerups.shield > 0) {
                    gameState.powerups.shield--;
                    scene.remove(obstacle);
                    obstacles = obstacles.filter(o => o !== obstacle);
                    playSound('coin-sound');
                    showFloatingText("SHIELD!", player.position, 0x32CD32);
                    updatePowerupDisplay();
                } else {
                    gameOver();
                    return;
                }
            }
        }
    }
    
    if(gameState.gameSpeed < CONFIG.MAX_SPEED) {
        gameState.gameSpeed += 0.00005 * gameState.multiplier;
    }
    
    camera.position.z = player.position.z + 15;
    camera.position.x += (player.position.x * 0.5 - camera.position.x) * 0.05;
    camera.position.y = 8 + Math.sin(gameTime * 0.01) * 0.5;
    
    scene.children.forEach(child => {
        if(child instanceof THREE.Points) {
            const positions = child.geometry.attributes.position.array;
            for(let i = 0; i < positions.length; i += 3) {
                positions[i + 2] += 0.1;
                if(positions[i + 2] > 100) {
                    positions[i + 2] = -200;
                }
            }
            child.geometry.attributes.position.needsUpdate = true;
        }
    });
    
    if(gameTime % 1800 === 0) {
        showBannerAd();
    }
    
    if(gameTime % 3600 === 0) {
        showInterstitialAd();
    }
    
    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
}

// Enhanced Controls
function setupControls() {
    document.addEventListener('keydown', (e) => {
        if(!gameState.isGameRunning || gameState.isPaused) return;
        
        switch(e.key) {
            case 'ArrowLeft':
                if(currentLane > -1) {
                    currentLane--;
                    playSound('jump-sound');
                }
                break;
            case 'ArrowRight':
                if(currentLane < 1) {
                    currentLane++;
                    playSound('jump-sound');
                }
                break;
            case 'ArrowUp':
                if(!isJumping) {
                    isJumping = true;
                    jumpVelocity = CONFIG.JUMP_FORCE;
                    playSound('jump-sound');
                }
                break;
            case 'ArrowDown':
            case ' ':
                triggerSlide();
                break;
            case 'm':
                activatePowerup('magnet');
                break;
            case 's':
                activatePowerup('shield');
                break;
            case 'b':
                activatePowerup('speed');
                break;
        }
    });
    
    document.addEventListener('touchstart', (e) => {
        if(!gameState.isGameRunning || gameState.isPaused) return;
        
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
        
        const currentTime = Date.now();
        const tapLength = currentTime - lastTapTime;
        
        if(tapLength < 300 && tapLength > 0) {
            triggerSlide();
            e.preventDefault();
        }
        
        lastTapTime = currentTime;
    });
    
    document.addEventListener('touchend', (e) => {
        if(!gameState.isGameRunning || gameState.isPaused) return;
        
        const touch = e.changedTouches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;
        const deltaTime = Date.now() - touchStartTime;
        
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        if(distance > 10) {
            if(Math.abs(deltaX) > Math.abs(deltaY)) {
                if(deltaX > 30 && currentLane < 1) {
                    currentLane++;
                    playSound('jump-sound');
                } else if(deltaX < -30 && currentLane > -1) {
                    currentLane--;
                    playSound('jump-sound');
                }
            } else {
                if(deltaY < -30 && !isJumping) {
                    isJumping = true;
                    jumpVelocity = CONFIG.JUMP_FORCE;
                    playSound('jump-sound');
                }
            }
        }
    });
    
    document.addEventListener('mousedown', (e) => {
        if(!gameState.isGameRunning || gameState.isPaused) return;
        
        touchStartX = e.clientX;
        touchStartY = e.clientY;
        touchStartTime = Date.now();
    });
    
    document.addEventListener('mouseup', (e) => {
        if(!gameState.isGameRunning || gameState.isPaused) return;
        
        const deltaX = e.clientX - touchStartX;
        const deltaY = e.clientY - touchStartY;
        const deltaTime = Date.now() - touchStartTime;
        
        if(deltaTime < 200 && Math.abs(deltaX) < 5 && Math.abs(deltaY) < 5) {
            if(!isJumping) {
                isJumping = true;
                jumpVelocity = CONFIG.JUMP_FORCE;
                playSound('jump-sound');
            }
        }
    });
    
    let clickCount = 0;
    document.addEventListener('click', (e) => {
        if(!gameState.isGameRunning || gameState.isPaused) return;
        
        clickCount++;
        if(clickCount === 1) {
            setTimeout(() => {
                if(clickCount === 2) {
                    triggerSlide();
                }
                clickCount = 0;
            }, 300);
        }
    });
}

function triggerSlide() {
    if(isJumping || gameState.isPaused) return;
    
    isSliding = true;
    playSound('jump-sound');
    
    setTimeout(() => {
        isSliding = false;
    }, CONFIG.SLIDE_DURATION);
}

// Powerup System
function activatePowerup(type) {
    if(gameState.powerups[type] <= 0) return;
    
    gameState.powerups[type]--;
    
    switch(type) {
        case 'magnet':
            activePowerup = 'magnet';
            powerupTimer = 600;
            break;
        case 'shield':
            break;
        case 'speed':
            activePowerup = 'speed';
            powerupTimer = 300;
            const originalSpeed = gameState.gameSpeed;
            gameState.gameSpeed *= 1.5;
            setTimeout(() => {
                gameState.gameSpeed = originalSpeed;
            }, 5000);
            break;
    }
    
    updatePowerupDisplay();
}

// Game State Management
function gameOver() {
    gameState.isGameOver = true;
    gameState.isGameRunning = false;
    
    clearTimeout(spawnTimeout);
    cancelAnimationFrame(animationId);
    
    playSound('crash-sound');
    
    if(gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        localStorage.setItem('highScore', gameState.highScore);
        showFloatingText("NEW HIGH SCORE!", player.position, 0xFFD700);
    }
    
    const earnedCoins = Math.floor(gameState.score / 10);
    gameState.coins += earnedCoins;
    localStorage.setItem('gameCoins', gameState.coins);
    
    setTimeout(() => {
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('final-score').textContent = gameState.score;
        document.getElementById('best-score').textContent = gameState.highScore;
        document.getElementById('earned-coins').textContent = earnedCoins;
        document.getElementById('game-over-screen').classList.remove('hidden');
        
        showInterstitialAd();
        updateChallengeProgress();
    }, 1000);
}

function watchAd() {
    const adButton = document.getElementById('btn-watch-ad');
    adButton.disabled = true;
    adButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> LOADING...';
    
    if(typeof show_10416947 === 'function') {
        show_10416947()
            .then(() => {
                gameState.adCount++;
                updateAdButtons();
                showRewardNotification("Ad watched successfully!");
            })
            .catch((error) => {
                console.error('Ad error:', error);
                adButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> FAILED';
                adButton.disabled = false;
            });
    } else {
        setTimeout(() => {
            gameState.adCount++;
            updateAdButtons();
            showRewardNotification("+1 Ad Credit!");
            adButton.innerHTML = `<i class="fas fa-ad"></i> WATCH AD (${gameState.adCount}/3)`;
            adButton.disabled = false;
        }, 2000);
    }
}

function updateAdButtons() {
    const adButton = document.getElementById('btn-watch-ad');
    const resumeButton = document.getElementById('btn-resume-game');
    const adCountElement = document.getElementById('ad-count');
    
    adCountElement.textContent = gameState.adCount;
    adButton.innerHTML = `<i class="fas fa-ad"></i> WATCH AD (${gameState.adCount}/3)`;
    
    if(gameState.adCount >= CONFIG.ADS_REQUIRED) {
        adButton.style.display = 'none';
        resumeButton.style.display = 'inline-block';
    } else {
        adButton.style.display = 'inline-block';
        resumeButton.style.display = 'none';
        adButton.disabled = false;
    }
}

function resumeGame() {
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    
    gameState.adCount = 0;
    updateAdButtons();
    
    startGame(false);
}

function restartGame() {
    gameState.adCount = 0;
    updateAdButtons();
    
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    startGame(true);
         }
// UI Updates
function updateUI() {
    document.getElementById('score').textContent = Math.floor(gameState.score);
    document.getElementById('speed').textContent = gameState.gameSpeed.toFixed(1);
    document.getElementById('distance').textContent = Math.floor(gameState.distance);
    document.getElementById('multiplier').textContent = gameState.multiplier.toFixed(1) + 'x';
    document.getElementById('high-score').textContent = gameState.highScore;
    document.getElementById('coins').textContent = gameState.coins;
    document.getElementById('gems').textContent = gameState.gems;
}

function updatePowerupDisplay() {
    const magnetBtn = document.getElementById('magnet-btn');
    const shieldBtn = document.getElementById('shield-btn');
    const speedBtn = document.getElementById('speed-btn');
    
    magnetBtn.innerHTML = `<i class="fas fa-magnet"></i>${gameState.powerups.magnet > 0 ? gameState.powerups.magnet : ''}`;
    shieldBtn.innerHTML = `<i class="fas fa-shield-alt"></i>${gameState.powerups.shield > 0 ? gameState.powerups.shield : ''}`;
    speedBtn.innerHTML = `<i class="fas fa-bolt"></i>${gameState.powerups.speed > 0 ? gameState.powerups.speed : ''}`;
    
    magnetBtn.classList.toggle('cooldown', gameState.powerups.magnet === 0);
    shieldBtn.classList.toggle('cooldown', gameState.powerups.shield === 0);
    speedBtn.classList.toggle('cooldown', gameState.powerups.speed === 0);
}

// Utility Functions
function checkCollision(obj1, obj2, threshold = 1.0) {
    const dx = obj1.position.x - obj2.position.x;
    const dy = obj1.position.y - obj2.position.y;
    const dz = obj1.position.z - obj2.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance < threshold;
}

function clearObjects() {
    obstacles.forEach(obj => scene.remove(obj));
    trees.forEach(obj => scene.remove(obj));
    coins.forEach(obj => scene.remove(obj));
    powerups.forEach(obj => scene.remove(obj));
    
    obstacles = [];
    trees = [];
    coins = [];
    powerups = [];
}

function playSound(soundId) {
    const sound = document.getElementById(soundId);
    if(sound) {
        sound.currentTime = 0;
        sound.volume = 0.3;
        sound.play().catch(e => console.log("Sound play failed:", e));
    }
}

function showFloatingText(text, position, color) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 128;
    
    context.fillStyle = `rgb(${color >> 16}, ${(color >> 8) & 0xff}, ${color & 0xff})`;
    context.font = 'bold 32px Arial';
    context.textAlign = 'center';
    context.fillText(text, 128, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(position);
    sprite.position.y += 3;
    sprite.scale.set(5, 2.5, 1);
    
    scene.add(sprite);
    
    let opacity = 1;
    const animateText = () => {
        opacity -= 0.02;
        sprite.position.y += 0.05;
        sprite.material.opacity = opacity;
        
        if(opacity > 0) {
            requestAnimationFrame(animateText);
        } else {
            scene.remove(sprite);
        }
    };
    animateText();
}

function showRewardNotification(text) {
    const notification = document.createElement('div');
    notification.className = 'reward-notification';
    notification.innerHTML = `<i class="fas fa-gift"></i> ${text}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(45deg, #FFD700, #FFA500);
        color: #000;
        padding: 15px 25px;
        border-radius: 10px;
        font-weight: bold;
        z-index: 10000;
        animation: slideIn 0.5s ease, slideOut 0.5s ease 2.5s forwards;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if(notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

function updateChallengeProgress() {
    const progress = Math.min(100, (gameState.score / 500) * 100);
    document.getElementById('challenge-progress').style.width = progress + '%';
}

function onWindowResize() {
    if(camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Modal Functions
function openModal(id) {
    document.getElementById(id).style.display = 'block';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function openCharacterSelect() {
    const grid = document.getElementById('characters-grid');
    grid.innerHTML = '';
    
    gameState.characters.forEach((char, index) => {
        const charElement = document.createElement('div');
        charElement.className = `character-item ${char.unlocked ? '' : 'locked'} ${index === gameState.currentCharacter ? 'selected' : ''}`;
        charElement.innerHTML = `
            <div class="char-icon" style="background: #${char.color.toString(16).padStart(6, '0')}; width: 60px; height: 60px; border-radius: 10px; margin: 0 auto 10px;"></div>
            <h4>${char.name}</h4>
            ${char.unlocked ? '' : `<div class="char-price"><i class="fas fa-coins"></i> ${char.price}</div>`}
        `;
        
        if(char.unlocked) {
            charElement.onclick = () => selectCharacter(index);
        } else {
            charElement.onclick = () => buyCharacter(index);
        }
        
        grid.appendChild(charElement);
    });
    
    openModal('character-modal');
}

function selectCharacter(index) {
    gameState.currentCharacter = index;
    player.material.color.setHex(gameState.characters[index].color);
    closeModal('character-modal');
}

function buyCharacter(index) {
    const char = gameState.characters[index];
    if(gameState.coins >= char.price) {
        gameState.coins -= char.price;
        char.unlocked = true;
        gameState.currentCharacter = index;
        player.material.color.setHex(char.color);
        updateUI();
        closeModal('character-modal');
        showRewardNotification(`Unlocked ${char.name}!`);
    } else {
        showRewardNotification("Not enough coins!");
    }
}

function openShop() {
    const shopItems = document.getElementById('shop-items');
    shopItems.innerHTML = '';
    
    const items = [
        { id: 'magnet', name: "Magnet", price: 50, icon: "fa-magnet", desc: "Attract coins for 10s" },
        { id: 'shield', name: "Shield", price: 100, icon: "fa-shield-alt", desc: "Block one obstacle" },
        { id: 'speed', name: "Speed Boost", price: 75, icon: "fa-bolt", desc: "Run 50% faster for 5s" },
        { id: 'double', name: "2x Coins", price: 200, icon: "fa-coins", desc: "Double coins for 30s" },
        { id: 'revive', name: "Extra Life", price: 300, icon: "fa-heart", desc: "Auto-revive once" },
        { id: 'remove', name: "Remove Ads", price: 1000, icon: "fa-ad", desc: "No ads for 24 hours" }
    ];
    
    items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'shop-item';
        itemElement.innerHTML = `
            <i class="fas ${item.icon}"></i>
            <h4>${item.name}</h4>
            <p>${item.desc}</p>
            <div class="shop-item-price">
                <i class="fas fa-coins"></i> ${item.price}
            </div>
            <button class="btn-buy" onclick="buyItem('${item.id}', ${item.price})" style="background: #FFD700; color: #000; border: none; padding: 8px 15px; border-radius: 10px; margin-top: 10px; cursor: pointer;">BUY</button>
        `;
        shopItems.appendChild(itemElement);
    });
    
    openModal('shop-modal');
}

function buyItem(id, price) {
    if(gameState.coins >= price) {
        gameState.coins -= price;
        
        switch(id) {
            case 'magnet':
                gameState.powerups.magnet++;
                break;
            case 'shield':
                gameState.powerups.shield++;
                break;
            case 'speed':
                gameState.powerups.speed++;
                break;
        }
        
        updateUI();
        updatePowerupDisplay();
        showRewardNotification(`Purchased ${id}!`);
    } else {
        showRewardNotification("Not enough coins!");
    }
}

function shareScore() {
    if(navigator.share) {
        navigator.share({
            title: 'Village Run',
            text: `I scored ${gameState.score} points in Village Run! Can you beat my score?`,
            url: window.location.href
        });
    } else {
        navigator.clipboard.writeText(`I scored ${gameState.score} points in Village Run!`);
        showRewardNotification("Score copied to clipboard!");
    }
}

function goHome() {
    gameState.isGameRunning = false;
    clearTimeout(spawnTimeout);
    cancelAnimationFrame(animationId);
    
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('home-screen').classList.remove('hidden');
    
    showBannerAd();
}

// Initialize game when page loads
window.addEventListener('load', () => {
    const savedCoins = localStorage.getItem('gameCoins');
    if(savedCoins) {
        gameState.coins = parseInt(savedCoins);
    }
    
    updateUI();
    updatePowerupDisplay();
    
    const savedChar = localStorage.getItem('selectedCharacter');
    if(savedChar) {
        gameState.currentCharacter = parseInt(savedChar);
    }
    
    document.getElementById('bg-music').volume = 0.1;
    
    ['bg-music', 'jump-sound', 'coin-sound', 'crash-sound'].forEach(id => {
        const audio = document.getElementById(id);
        audio.load();
    });
});
