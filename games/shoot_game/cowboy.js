// Cowboy player class, procedural canvas rendering, and AI decision tree
import { Bullet } from './bullet.js?v=40';
import { audio } from './audio.js?v=40';

export class Cowboy {
    constructor(x, y, role, weaponType = 'rapid') {
        this.x = x;
        this.y = y;
        this.role = role; // 'player1', 'player2', 'ai', 'helper_ai'
        this.weaponType = weaponType; // 'rapid', 'heavy', 'bomb'
        
        // Colors updated: Player 1 is Black, Player 2 & AI are White, helper_ai is translucent black
        if (role === 'helper_ai') {
            this.color = 'rgba(33, 37, 41, 0.75)';
            this.radius = 20;
            this.speed = 2.5;
            this.maxHealth = 3;
            this.health = 3;
            this.angle = 0; // facing right (assisting player1)
        } else {
            this.color = role === 'player1' ? '#212529' : '#f8f9fa';
            this.radius = 20;
            this.speed = 3;
            this.maxHealth = 50;
            this.health = 50;
            this.angle = role === 'player1' ? 0 : Math.PI; // aim direction
        }
        
        this.lastShotTime = 0;
        
        // Cooldown based on weapon type
        this.setWeaponProperties();

        this.walkCycle = 0;
        this.isMoving = false;
        
        this.hitFlash = 0; // frame counter
        
        // AI specific states
        this.aiState = 'wander';
        this.aiDecisionTimer = 0;
        this.targetX = x;
        this.targetY = y;
        this.dodgeCooldown = 0;
    }

    setWeaponProperties() {
        const isPlayerAligned = this.role === 'player1' || this.role === 'helper_ai';
        if (this.weaponType === 'heavy') {
            const lvl = (window.game && isPlayerAligned) ? (window.game.heavyLvl || 1) : 1;
            this.shootCooldown = 1500 - (lvl - 1) * 200; // Level 1: 1500ms, Level 5: 700ms!
            this.bulletSpeed = 7.5 + (lvl - 1) * 1.0;
        } else if (this.weaponType === 'bomb') {
            const lvl = (window.game && isPlayerAligned) ? (window.game.bombLvl || 1) : 1;
            this.shootCooldown = 2000 - (lvl - 1) * 250; // Level 1: 2000ms, Level 5: 1000ms!
            this.bulletSpeed = 8.5 + (lvl - 1) * 1.0;
        } else if (this.weaponType === 'laser') {
            const lvl = (window.game && isPlayerAligned) ? (window.game.lasergunLvl || 1) : 1;
            this.shootCooldown = 450 - lvl * 50; // Level 1: 400ms, Level 5: 200ms!
            this.bulletSpeed = 16.0 + (lvl - 1) * 2.0;
        } else {
            const lvl = (window.game && isPlayerAligned) ? (window.game.rapidLvl || 1) : 1;
            this.shootCooldown = 250 - (lvl - 1) * 20; // Level 1: 250ms, Level 5: 170ms!
            this.bulletSpeed = 11.0 + (lvl - 1) * 1.0;
        }
    }

    takeDamage(amount, game) {
        if (this.health <= 0) return;

        this.health -= amount;
        this.hitFlash = 15; // flash for 15 frames
        audio.playHit();

        // Screen Shake
        game.triggerScreenShake();

        // Blood particles
        if (game.particles) {
            for (let i = 0; i < 15; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1 + Math.random() * 5;
                game.particles.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 1,
                    radius: 2 + Math.random() * 3,
                    color: '#d90429', // Blood red
                    alpha: 1,
                    decay: 0.02 + Math.random() * 0.02,
                    gravity: 0.15
                });
            }
        }

        if (this.health <= 0) {
            this.health = 0;
            // Death visual burst
            if (game.particles) {
                for (let i = 0; i < 20; i++) {
                    game.particles.push({
                        x: this.x,
                        y: this.y,
                        vx: (Math.random() - 0.5) * 5,
                        vy: (Math.random() - 0.5) * 5 - 2,
                        radius: 3 + Math.random() * 4,
                        color: this.color,
                        alpha: 1,
                        decay: 0.015 + Math.random() * 0.015,
                        gravity: 0.1
                    });
                }
            }
        }
    }

    shoot(game) {
        if (this.health <= 0) return;
        if (game && game.isInTunnel && game.isInTunnel(this.x, this.y)) return; // Tunnelblockade

        const now = Date.now();
        if (now - this.lastShotTime >= this.shootCooldown) {
            this.lastShotTime = now;
            
            // Spawn bullet at the tip of the gun barrel
            const barrelLen = 30;
            const bx = this.x + Math.cos(this.angle) * barrelLen;
            const by = this.y + Math.sin(this.angle) * barrelLen;
            
            game.bullets.push(new Bullet(bx, by, this.angle, this, this.weaponType));
            
            if (this.weaponType === 'heavy') {
                audio.playHeavyShoot();
            } else {
                audio.playShoot();
            }

            // Gun muzzle flash particles
            for (let i = 0; i < 6; i++) {
                const sparkAngle = this.angle + (Math.random() - 0.5) * 0.4;
                const speed = 2 + Math.random() * 5;
                game.particles.push({
                    x: bx,
                    y: by,
                    vx: Math.cos(sparkAngle) * speed,
                    vy: Math.sin(sparkAngle) * speed,
                    radius: this.weaponType === 'heavy' ? 3 + Math.random() * 3 : 2 + Math.random() * 2,
                    color: this.weaponType === 'bomb' ? '#ff9800' : '#ffb703',
                    alpha: 1,
                    decay: 0.04 + Math.random() * 0.04,
                    gravity: 0
                });
            }
        }
    }

    clampToField(width, height) {
        // Sand playfield boundaries
        const minX = 40;
        const maxX = width - 40;
        const minY = 95;
        const maxY = height - 40;

        if (this.x < minX) this.x = minX;
        if (this.x > maxX) this.x = maxX;
        if (this.y < minY) this.y = minY;
        if (this.y > maxY) this.y = maxY;
    }

    update(keys, game) {
        if (this.health <= 0) return;

        if (this.hitFlash > 0) this.hitFlash--;

        this.isMoving = false;

        if (this.role === 'player1') {
            this.handlePlayer1Controls(keys, game);
        } else if (this.role === 'player2') {
            this.handlePlayer2Controls(keys, game);
        } else if (this.role === 'ai') {
            this.handleAI(game);
        } else if (this.role === 'helper_ai') {
            this.handleHelperAI(game);
        }

        // Apply leg swing when moving
        if (this.isMoving) {
            this.walkCycle += 0.15;
        } else {
            this.walkCycle = 0;
        }

        // Keep inside fence
        this.clampToField(game.canvas.width, game.canvas.height);
    }

    handlePlayer1Controls(keys, game) {
        let dx = 0;
        let dy = 0;

        // Joystick movement (touch play)
        if (game.joystickMove && game.joystickMove.active) {
            dx = game.joystickMove.x * this.speed;
            dy = game.joystickMove.y * this.speed;
        } else {
            // Keyboard movement
            if (keys['w'] || keys['W']) dy -= this.speed;
            if (keys['s'] || keys['S']) dy += this.speed;
            if (keys['a'] || keys['A']) dx -= this.speed;
            if (keys['d'] || keys['D']) dx += this.speed;

            if (dx !== 0 && dy !== 0) {
                // Diagonal speed normalization
                dx *= 0.7071;
                dy *= 0.7071;
            }
        }

        if (dx !== 0 || dy !== 0) {
            // Try movement (slide against obstacles if any)
            if (!this.checkObstacleCollision(this.x + dx, this.y, game)) {
                this.x += dx;
                this.isMoving = true;
            }
            if (!this.checkObstacleCollision(this.x, this.y + dy, game)) {
                this.y += dy;
                this.isMoving = true;
            }
        }

        // Aiming Gun rotation
        if (game.joystickAim && game.joystickAim.active) {
            this.angle = game.joystickAim.angle;
        } else {
            const rotSpeed = 0.05;
            if (keys['q'] || keys['Q']) this.angle -= rotSpeed;
            if (keys['e'] || keys['E']) this.angle += rotSpeed;
        }

        // Shoot
        if (keys[' ']) {
            this.shoot(game);
        }
    }

    handlePlayer2Controls(keys, game) {
        let dx = 0;
        let dy = 0;

        if (keys['ArrowUp']) dy -= this.speed;
        if (keys['ArrowDown']) dy += this.speed;
        if (keys['ArrowLeft']) dx -= this.speed;
        if (keys['ArrowRight']) dx += this.speed;

        if (dx !== 0 || dy !== 0) {
            if (dx !== 0 && dy !== 0) {
                dx *= 0.7071;
                dy *= 0.7071;
            }
            
            if (!this.checkObstacleCollision(this.x + dx, this.y, game)) {
                this.x += dx;
                this.isMoving = true;
            }
            if (!this.checkObstacleCollision(this.x, this.y + dy, game)) {
                this.y += dy;
                this.isMoving = true;
            }
        }

        // Aiming Gun rotation
        const rotSpeed = 0.05;
        if (keys['u'] || keys['U']) this.angle -= rotSpeed;
        if (keys['o'] || keys['O']) this.angle += rotSpeed;

        // Shoot
        if (keys['Enter']) {
            this.shoot(game);
        }
    }

    checkObstacleCollision(newX, newY, game) {
        if (game && game.isPositionInWater && game.isPositionInWater(newX, newY)) {
            return true;
        }

        for (let obs of game.obstacles) {
            if (obs.destroyed) continue;

            if (obs.type === 'fence') {
                const fLeft = obs.x - obs.width / 2;
                const fRight = obs.x + obs.width / 2;
                const fTop = obs.y - obs.height / 2;
                const fBottom = obs.y + obs.height / 2;

                if (newX + this.radius > fLeft && newX - this.radius < fRight &&
                    newY + this.radius > fTop && newY - this.radius < fBottom) {
                    return true;
                }
            } else {
                const dist = Math.hypot(newX - obs.x, newY - obs.y);
                if (dist < this.radius + obs.radius - 2) { // 2px margin for smoother slide
                    return true;
                }
            }
        }
        return false;
    }

    getPlayerVelocity(game) {
        const player = game.player1;
        let pvx = 0, pvy = 0;
        if (!player) return { x: 0, y: 0 };
        if (game.keys['w'] || game.keys['W']) pvy = -player.speed;
        if (game.keys['s'] || game.keys['S']) pvy = player.speed;
        if (game.keys['a'] || game.keys['A']) pvx = -player.speed;
        if (game.keys['d'] || game.keys['D']) pvx = player.speed;
        return { x: pvx, y: pvy };
    }

    handleHelperAI(game) {
        const opponent = game.player2;
        if (!opponent || opponent.health <= 0) return;

        this.aiDecisionTimer--;
        this.dodgeCooldown = Math.max(0, this.dodgeCooldown - 1);

        // Base properties scaled by upgrade level
        this.setWeaponProperties();
        const lvl = game.doppelgangerLvl || 1;
        const speedScale = 1.0 + (lvl - 1) * 0.1; // Level 1: 1.0x, Level 5: 1.4x
        const cooldownScale = 1.0 - (lvl - 1) * 0.1; // Level 1: 1.0x, Level 5: 0.6x
        
        this.shootCooldown = this.shootCooldown * cooldownScale;
        this.speed = 2.4 * speedScale;

        if (this.aiDecisionTimer <= 0) {
            this.aiDecisionTimer = 35 + Math.random() * 50;
            // Move around left side of field, avoiding outer boundary details
            this.targetX = 80 + Math.random() * 140;
            this.targetY = 100 + Math.random() * (game.canvas.height - 180);
        }

        this.handleEvasion(game);
        this.moveTowardsTarget(game);

        // Aim at enemy (with slight wind compensation if wind levels)
        const dist = Math.hypot(opponent.x - this.x, opponent.y - this.y);
        const windOffset = [3, 5, 7, 10].includes(game.level) ? -game.wind * dist * 0.05 : 0;
        this.angle = Math.atan2(opponent.y + windOffset - this.y, opponent.x - this.x);

        // Shoot at enemy
        if (Math.random() < 0.035) {
            this.shoot(game);
        }
    }

    // AI DECISION TREE & CONTROLS (SCALED FOR 10 LEVELS)
    handleAI(game) {
        const player = game.player1;
        if (!player || player.health <= 0) return;

        this.aiDecisionTimer--;
        this.dodgeCooldown = Math.max(0, this.dodgeCooldown - 1);

        const lvl = game.aiDifficulty || 1;

        // Calculate dynamic cooldown & speed based on chosen weapon type & level difficulty
        let baseCooldown = 250; // rapid default
        if (this.weaponType === 'heavy') baseCooldown = 1500;
        else if (this.weaponType === 'bomb') baseCooldown = 2000;

        // Cooldown and Speed scale progressively up to level 10
        const mults = [2.2, 1.9, 1.6, 1.35, 1.15, 0.95, 0.85, 0.75, 0.65, 0.55];
        const speeds = [1.8, 2.1, 2.4, 2.6, 2.8, 3.0, 3.2, 3.4, 3.6, 3.8];
        
        const lvlIndex = Math.min(Math.max(lvl - 1, 0), 9);
        this.shootCooldown = baseCooldown * mults[lvlIndex];
        this.speed = speeds[lvlIndex];

        // --- LEVEL 1: DUMB RANDOM WALKER ---
        if (lvl === 1) {
            if (this.aiDecisionTimer <= 0) {
                this.aiDecisionTimer = 60 + Math.random() * 90;
                this.targetX = game.canvas.width * 0.7 + (Math.random() - 0.5) * 150;
                this.targetY = game.canvas.height / 2 + (Math.random() - 0.5) * 200;
            }

            this.moveTowardsTarget(game);
            
            // Aim slowly at player
            const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x);
            this.angle += (angleToPlayer - this.angle) * 0.05;

            // Shoot randomly
            if (Math.random() < 0.015) {
                this.shoot(game);
            }
        }
        
        // --- LEVEL 2 & 3: BASIC ALIGN & TRACK ---
        else if (lvl === 2 || lvl === 3) {
            if (this.aiDecisionTimer <= 0) {
                this.aiDecisionTimer = 40 + Math.random() * 60;
                this.targetX = game.canvas.width * 0.75 + (Math.random() - 0.5) * 100;
            }
            this.targetY = player.y; // Keep track of player's Y

            this.moveTowardsTarget(game);

            // Aim at player, compensate for wind on Level 3
            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            const windOffset = (lvl === 3 && [3, 5, 7, 10].includes(game.level)) ? -game.wind * dist * 0.05 : 0;
            this.angle = Math.atan2(player.y + windOffset - this.y, player.x - this.x);

            // Shoot when lined up
            if (Math.abs(player.y - this.y) < 80 && Math.random() < 0.035) {
                this.shoot(game);
            }
        }

        // --- LEVEL 4 & 5: COVER SEEKING ---
        else if (lvl === 4 || lvl === 5) {
            let coverObs = this.findNearestCover(game);
            
            if (coverObs && Math.random() < 0.7) {
                this.targetX = coverObs.x + 35;
                this.targetY = coverObs.y;
            } else {
                if (this.aiDecisionTimer <= 0) {
                    this.aiDecisionTimer = 30 + Math.random() * 40;
                    this.targetX = game.canvas.width * 0.75 + (Math.random() - 0.5) * 80;
                    this.targetY = player.y + (Math.random() - 0.5) * 150;
                }
            }

            if (lvl === 5) {
                // Strategic TNT avoidance
                let dangerousTnt = game.obstacles.find(o => o.type === 'tnt' && o.isTriggered && Math.hypot(this.x - o.x, this.y - o.y) < 140);
                if (dangerousTnt) {
                    const runAngle = Math.atan2(this.y - dangerousTnt.y, this.x - dangerousTnt.x);
                    this.targetX = this.x + Math.cos(runAngle) * 100;
                    this.targetY = this.y + Math.sin(runAngle) * 100;
                    this.aiDecisionTimer = 15;
                }
            }

            this.moveTowardsTarget(game);

            // Aim compensating for wind if applicable
            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            const windOffset = [3, 5, 7, 10].includes(game.level) ? -game.wind * dist * 0.05 : 0;
            this.angle = Math.atan2(player.y + windOffset - this.y, player.x - this.x);

            if (Math.random() < 0.04) {
                this.shoot(game);
            }
        }

        // --- LEVEL 6 & 7: PREDICTIVE AIMING & BULLET EVASION ---
        else if (lvl === 6 || lvl === 7) {
            this.handleEvasion(game);
            this.moveTowardsTarget(game);

            // Predictive Aiming
            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            const t = dist / this.bulletSpeed; // travel time
            
            const playerVel = this.getPlayerVelocity(game);
            const windOffset = (lvl === 7 && [3, 5, 7, 10].includes(game.level)) ? -game.wind * dist * 0.05 : 0;

            const predX = player.x + playerVel.x * t * 0.8;
            const predY = player.y + playerVel.y * t * 0.8 + windOffset;

            this.angle = Math.atan2(predY - this.y, predX - this.x);

            if (Math.random() < 0.045) {
                this.shoot(game);
            }
        }

        // --- LEVEL 8 & 9: EVASION, PREDICTIVE AIMING & TACTICAL PLAY ---
        else if (lvl === 8 || lvl === 9) {
            this.handleEvasion(game);

            // TNT Evasion or Cover Seeking
            let dangerousTnt = game.obstacles.find(o => o.type === 'tnt' && o.isTriggered && Math.hypot(this.x - o.x, this.y - o.y) < 140);
            if (dangerousTnt) {
                const runAngle = Math.atan2(this.y - dangerousTnt.y, this.x - dangerousTnt.x);
                this.targetX = this.x + Math.cos(runAngle) * 100;
                this.targetY = this.y + Math.sin(runAngle) * 100;
                this.aiDecisionTimer = 15;
            } else {
                let coverObs = lvl === 9 ? this.findNearestCover(game) : null;
                if (coverObs && Math.random() < 0.75) {
                    this.targetX = coverObs.x + 35;
                    this.targetY = coverObs.y;
                } else {
                    if (this.aiDecisionTimer <= 0) {
                        this.aiDecisionTimer = 25 + Math.random() * 35;
                        this.targetX = game.canvas.width * 0.75 + (Math.random() - 0.5) * 80;
                        this.targetY = player.y + (Math.random() - 0.5) * 150;
                    }
                }
            }

            this.moveTowardsTarget(game);

            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            const t = dist / this.bulletSpeed;
            const playerVel = this.getPlayerVelocity(game);
            const windOffset = [3, 5, 7, 10].includes(game.level) ? -game.wind * dist * 0.05 : 0;

            const predX = player.x + playerVel.x * t * 0.85;
            const predY = player.y + playerVel.y * t * 0.85 + windOffset;

            this.angle = Math.atan2(predY - this.y, predX - this.x);

            if (Math.random() < 0.048) {
                this.shoot(game);
            }
        }

        // --- LEVEL 10: TERMINATOR COWBOY ---
        else if (lvl === 10) {
            this.handleEvasion(game);

            // TNT Evasion and shooting TNT strategy
            let dangerousTnt = game.obstacles.find(o => o.type === 'tnt' && o.isTriggered && Math.hypot(this.x - o.x, this.y - o.y) < 140);
            if (dangerousTnt) {
                const runAngle = Math.atan2(this.y - dangerousTnt.y, this.x - dangerousTnt.x);
                this.targetX = this.x + Math.cos(runAngle) * 100;
                this.targetY = this.y + Math.sin(runAngle) * 100;
                this.aiDecisionTimer = 15;
            } else {
                if (this.aiDecisionTimer <= 0) {
                    this.aiDecisionTimer = 15 + Math.random() * 25;
                    
                    // Target TNT near Player 1
                    let targetTnt = game.obstacles.find(o => o.type === 'tnt' && !o.isTriggered && Math.hypot(player.x - o.x, player.y - o.y) < 95);
                    if (targetTnt && Math.random() < 0.6) {
                        this.targetX = this.x;
                        this.targetY = this.y + (Math.random() - 0.5) * 50;
                        this.shootTnt = targetTnt;
                    } else {
                        this.shootTnt = null;
                        this.targetX = game.canvas.width * 0.8 + (Math.random() - 0.5) * 70;
                        this.targetY = player.y + (Math.random() - 0.5) * 100;
                    }
                }
            }

            this.moveTowardsTarget(game);

            // Perfect Aiming + perfect wind compensation + TNT strategy
            if (this.shootTnt && !this.shootTnt.destroyed) {
                this.angle = Math.atan2(this.shootTnt.y - this.y, this.shootTnt.x - this.x);
            } else {
                const dist = Math.hypot(player.x - this.x, player.y - this.y);
                const t = dist / this.bulletSpeed;
                const playerVel = this.getPlayerVelocity(game);
                const windOffset = [3, 5, 7, 10].includes(game.level) ? -game.wind * dist * 0.05 : 0;

                const predX = player.x + playerVel.x * t * 0.95;
                const predY = player.y + playerVel.y * t * 0.95 + windOffset;

                this.angle = Math.atan2(predY - this.y, predX - this.x);
            }

            this.shoot(game);
        }
    }

    moveTowardsTarget(game) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 10) {
            let stepX = (dx / dist) * this.speed;
            let stepY = (dy / dist) * this.speed;

            if (!this.checkObstacleCollision(this.x + stepX, this.y, game)) {
                this.x += stepX;
                this.isMoving = true;
            }
            if (!this.checkObstacleCollision(this.x, this.y + stepY, game)) {
                this.y += stepY;
                this.isMoving = true;
            }
        }
    }

    findNearestCover(game) {
        let bestCover = null;
        let minDist = Infinity;
        game.obstacles.forEach(o => {
            if (o.type === 'cactus' && !o.destroyed) {
                const dist = Math.hypot(this.x - o.x, this.y - o.y);
                if (dist < minDist) {
                    minDist = dist;
                    bestCover = o;
                }
            }
        });
        return bestCover;
    }

    handleEvasion(game) {
        if (this.dodgeCooldown > 0) return;

        // Ground spike avoidance (highest priority)
        if (game.groundSpikes) {
            const nearbySpike = game.groundSpikes.find(s => !s.destroyed && Math.hypot(this.x - s.x, this.y - s.y) < 65);
            if (nearbySpike) {
                this.dodgeCooldown = 20; 
                this.aiDecisionTimer = 20;
                
                let runAngle = Math.atan2(this.y - nearbySpike.y, this.x - nearbySpike.x);
                if (Math.hypot(this.x - nearbySpike.x, this.y - nearbySpike.y) < 1) {
                    runAngle = Math.random() * Math.PI * 2;
                }
                
                this.targetX = this.x + Math.cos(runAngle) * 80;
                this.targetY = this.y + Math.sin(runAngle) * 80;
                
                // Clamp target values to boundaries
                const minX = 60;
                const maxX = game.canvas.width - 60;
                const minY = 120;
                const maxY = game.canvas.height - 60;
                if (this.targetX < minX) this.targetX = minX;
                if (this.targetX > maxX) this.targetX = maxX;
                if (this.targetY < minY) this.targetY = minY;
                if (this.targetY > maxY) this.targetY = maxY;
                
                return;
            }
        }

        // Search for incoming player bullets
        const dangerBullet = game.bullets.find(b => {
            if (b.owner === this || b.destroyed) return false;
            
            if (b.vx > 0) { // Bullet moving right
                const distY = Math.abs(b.y - this.y);
                const distX = this.x - b.x;
                if (distX > 0 && distX < 250 && distY < 50) {
                    return true;
                }
            }
            return false;
        });

        if (dangerBullet) {
            this.dodgeCooldown = 25; 
            this.aiDecisionTimer = 25;
            
            const roomUp = this.y - 95;
            const roomDown = (game.canvas.height - 40) - this.y;
            
            const direction = roomUp > roomDown ? -1 : 1;
            this.targetX = this.x; 
            this.targetY = this.y + direction * 70;
        }
    }

    // DRAW METHOD
    draw(ctx) {
        if (this.health <= 0) return;
        if (window.game && window.game.isInTunnel && window.game.isInTunnel(this.x, this.y)) {
            return; // Im Tunnel unsichtbar!
        }

        ctx.save();

        // 1. Draw Aim Guide Line (Dotted laser sight)
        this.drawAimGuide(ctx);

        // 2. Draw Cowboy Body Parts
        ctx.translate(this.x, this.y);

        // Apply hit flash (white silhouette)
        if (this.hitFlash > 0 && Math.floor(this.hitFlash / 2) % 2 === 0) {
            ctx.fillStyle = '#ffffff';
            ctx.strokeStyle = '#ffffff';
            this.drawCowboySilhouette(ctx);
        } else {
            this.drawCowboyDetailed(ctx);
        }
        if (this.role === 'helper_ai') {
            ctx.save();
            // Draw background bar
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillRect(-15, -45, 30, 5);
            // Draw health bar
            ctx.fillStyle = '#ffcc00';
            const hpPct = Math.max(0, this.health / this.maxHealth);
            ctx.fillRect(-15, -45, 30 * hpPct, 5);
            // Draw border
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.strokeRect(-15, -45, 30, 5);
            ctx.restore();
        }

        ctx.restore();
    }

    drawAimGuide(ctx) {
        ctx.save();
        
        const isJoystickAiming = (this.role === 'player1' && window.game && window.game.joystickAim && window.game.joystickAim.active);
        
        if (isJoystickAiming) {
            // Draw a prominent, glowing red laser guide line matching the red joystick
            ctx.strokeStyle = 'rgba(255, 59, 48, 0.75)';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 8]);
            
            // Add shadow glow
            ctx.shadowColor = 'rgba(255, 59, 48, 0.8)';
            ctx.shadowBlur = 8;
            
            const lineLen = 600; // Longer line for better aiming visibility
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + Math.cos(this.angle) * lineLen, this.y + Math.sin(this.angle) * lineLen);
            ctx.stroke();
        } else {
            // Standard guide line
            ctx.strokeStyle = (this.role === 'player1' || this.role === 'helper_ai') ? 'rgba(212, 175, 55, 0.45)' : 'rgba(255, 255, 255, 0.45)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 6]);

            const lineLen = 220;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x + Math.cos(this.angle) * lineLen, this.y + Math.sin(this.angle) * lineLen);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawCowboySilhouette(ctx) {
        ctx.beginPath();
        ctx.arc(0, -22, 9, 0, Math.PI * 2);
        
        ctx.moveTo(-15, 15);
        ctx.lineTo(15, 15);
        ctx.lineTo(10, -12);
        ctx.lineTo(-10, -12);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.ellipse(0, -25, 20, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillRect(-10, -37, 20, 12);
    }

    drawCowboyDetailed(ctx) {
        const flip = (this.angle > Math.PI/2 || this.angle < -Math.PI/2) ? -1 : 1;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 20, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // 1. Legs / Boots
        // Player 1/helper_ai boots are dark gray/black, Player 2/AI boots are brown
        ctx.fillStyle = (this.role === 'player1' || this.role === 'helper_ai') ? '#111111' : '#4a2f1b';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5;
        
        let legL = 0;
        let legR = 0;
        if (this.isMoving) {
            legL = Math.sin(this.walkCycle) * 8;
            legR = -Math.sin(this.walkCycle) * 8;
        }

        // Left Boot
        ctx.fillRect(-9 + legL/2, 10 + Math.abs(legL)/4, 6, 10);
        ctx.strokeRect(-9 + legL/2, 10 + Math.abs(legL)/4, 6, 10);
        
        // Right Boot
        ctx.fillRect(3 + legR/2, 10 + Math.abs(legR)/4, 6, 10);
        ctx.strokeRect(3 + legR/2, 10 + Math.abs(legR)/4, 6, 10);

        // 2. Poncho / Body Coat
        ctx.fillStyle = this.color;
        // Outline gets a clear contrast
        ctx.strokeStyle = (this.role === 'player1' || this.role === 'helper_ai') ? '#0a0a0a' : '#a5a5a5';
        ctx.lineWidth = 2.2;

        ctx.beginPath();
        ctx.moveTo(-16, 14);
        ctx.quadraticCurveTo(0, 18, 16, 14);
        ctx.lineTo(11, -10);
        ctx.quadraticCurveTo(0, -6, -11, -10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Belt
        ctx.fillStyle = (this.role === 'player1' || this.role === 'helper_ai') ? '#1e120c' : '#5c3d2e';
        ctx.fillRect(-12, 5, 24, 4);

        // Bandana/Scarf (Player 1/helper_ai has Gold/Yellow bandana, Player 2/AI has Red bandana)
        ctx.fillStyle = (this.role === 'player1' || this.role === 'helper_ai') ? '#ffcc00' : '#d90429';
        ctx.beginPath();
        ctx.moveTo(-6, -9);
        ctx.lineTo(6, -9);
        ctx.lineTo(0, -3);
        ctx.closePath();
        ctx.fill();

        // 3. Head / Skin
        ctx.fillStyle = '#ffdbac';
        ctx.beginPath();
        ctx.arc(0, -18, 8, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(flip * 3, -19, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // 4. Gun Arm
        ctx.save();
        ctx.rotate(this.angle);

        ctx.strokeStyle = this.color;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(15, 2);
        ctx.stroke();

        // Draw Revolver Gun
        ctx.fillStyle = '#7f8c8d'; // Silver
        ctx.fillRect(14, 0, 10, 4);
        ctx.fillStyle = '#34495e'; // Cylinder
        ctx.fillRect(12, -1, 5, 5);
        ctx.fillStyle = '#8e44ad'; // Handle
        ctx.fillRect(11, 2, 3, 6);

        ctx.restore();

        // 5. Cowboy Hat
        ctx.save();
        ctx.translate(0, -22);

        // Hat Brim
        ctx.fillStyle = this.color;
        ctx.strokeStyle = (this.role === 'player1' || this.role === 'helper_ai') ? '#0a0a0a' : '#a5a5a5';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 18, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Hat Ribbon
        ctx.fillStyle = (this.role === 'player1' || this.role === 'helper_ai') ? '#ffd700' : '#d90429'; // Gold ribbon for black hat, Red ribbon for white hat
        ctx.fillRect(-8, -4, 16, 4);

        // Hat Crown
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(-8, -4);
        ctx.bezierCurveTo(-9, -15, 9, -15, 8, -4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}
