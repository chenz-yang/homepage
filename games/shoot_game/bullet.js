// Bullet physics, trajectory, wind influence, and collision handling
import { audio } from './audio.js?v=4';

export class Bullet {
    constructor(x, y, angle, owner, type = 'normal') {
        this.x = x;
        this.y = y;
        this.owner = owner; // cowboy object
        this.type = type; // 'normal', 'heavy', 'bomb'
        this.destroyed = false;
        this.trail = [];
        this.maxTrailLength = 12;

        // Dynamic properties based on weapon type
        const isPlayerAligned = owner.id === 'player1' || owner.id === 'helper_ai';
        if (type === 'heavy') {
            const lvl = (window.game && isPlayerAligned) ? (window.game.heavyLvl || 1) : 1;
            this.speed = 7.5 + (lvl - 1) * 1.0;
            this.damage = lvl >= 5 ? 4 : (lvl >= 3 ? 3 : 2);
            this.radius = 6.0;
        } else if (type === 'bomb') {
            const lvl = (window.game && isPlayerAligned) ? (window.game.bombLvl || 1) : 1;
            this.speed = 8.5 + (lvl - 1) * 1.0;
            this.damage = lvl >= 5 ? 4 : (lvl >= 3 ? 3 : 2);
            this.radius = 5.0;
        } else if (type === 'laser') {
            const lvl = (window.game && isPlayerAligned) ? (window.game.lasergunLvl || 1) : 1;
            this.damage = lvl >= 5 ? 5 : (lvl >= 3 ? 4 : 3);
            this.speed = 16.0 + (lvl - 1) * 2.0;
            this.radius = 2.0;
        } else {
            const lvl = (window.game && isPlayerAligned) ? (window.game.rapidLvl || 1) : 1;
            this.speed = 11.0 + (lvl - 1) * 1.0;
            this.damage = lvl >= 4 ? 2 : 1;
            this.radius = 3.5;
        }

        this.vx = Math.cos(angle) * this.speed;
        this.vy = Math.sin(angle) * this.speed;
    }

    update(game) {
        if (this.destroyed) return;

        // Save trail position
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }

        // Apply wind (horizontal deflection) on level 3, 5, 7, and 10
        if ([3, 5, 7, 10].includes(game.level)) {
            this.vx += game.wind * 0.007;
        }

        // Move bullet
        this.x += this.vx;
        this.y += this.vy;

        // Check offscreen boundaries
        if (this.x < 0 || this.x > game.canvas.width || this.y < 0 || this.y > game.canvas.height) {
            this.destroyed = true;
            if (this.type === 'bomb') {
                game.summonSheriff();
            }
            return;
        }

        // Collision with outer borders
        const playTop = 65;
        const playBottom = game.canvas.height - 20;
        const playLeft = 20;
        const playRight = game.canvas.width - 20;

        if (this.y < playTop || this.y > playBottom || this.x < playLeft || this.x > playRight) {
            this.destroyWithSparks(game, this.x, this.y, '#ffd27d');
            audio.playRicochet();
            if (this.type === 'bomb') {
                game.summonSheriff();
            }
            return;
        }

        // Collision with obstacles
        for (let obstacle of game.obstacles) {
            if (obstacle.destroyed) continue;

            let hit = false;
            if (obstacle.type === 'fence') {
                const fLeft = obstacle.x - obstacle.width / 2;
                const fRight = obstacle.x + obstacle.width / 2;
                const fTop = obstacle.y - obstacle.height / 2;
                const fBottom = obstacle.y + obstacle.height / 2;
                if (this.x + this.radius > fLeft && this.x - this.radius < fRight &&
                    this.y + this.radius > fTop && this.y - this.radius < fBottom) {
                    hit = true;
                }
            } else {
                const dist = Math.hypot(this.x - obstacle.x, this.y - obstacle.y);
                if (dist < this.radius + obstacle.radius) {
                    hit = true;
                }
            }

            if (hit) {
                obstacle.takeDamage(this.damage, game, this.owner);
                const sparkColor = this.type === 'laser' ? '#00ffff' : (obstacle.type === 'cactus' ? '#2d6a4f' : '#ffd27d');
                const sparkCount = this.type === 'laser' ? 12 : 6;
                this.destroyWithSparks(game, this.x, this.y, sparkColor, sparkCount);
                if (this.type === 'bomb' && obstacle.type !== 'chest') {
                    game.summonSheriff();
                }
                return;
            }
        }

        // Collision with tumbleweeds
        for (let tumble of game.tumbleweeds) {
            if (tumble.destroyed) continue;
            const dist = Math.hypot(this.x - tumble.x, this.y - tumble.y);
            if (dist < this.radius + tumble.radius) {
                tumble.takeDamage(1, game);
                const sparkColor = this.type === 'laser' ? '#00ffff' : '#bfa17c';
                const sparkCount = this.type === 'laser' ? 12 : 6;
                this.destroyWithSparks(game, this.x, this.y, sparkColor, sparkCount);
                if (this.type === 'bomb') {
                    game.summonSheriff();
                }
                return;
            }
        }

        // Collision with targets (differentiating friendly helper AI vs player and opponent)
        let targets = [];
        if (this.owner.role === 'player1' || this.owner.role === 'helper_ai') {
            if (game.player2 && game.player2.health > 0) {
                targets.push(game.player2);
            }
        } else {
            if (game.player1 && game.player1.health > 0) {
                targets.push(game.player1);
            }
            game.helperAIs.forEach(helper => {
                if (helper.health > 0) {
                    targets.push(helper);
                }
            });
        }

        for (let target of targets) {
            if (game && game.isOnBridge && game.isOnBridge(target.x, target.y)) {
                continue; // Can't be hit on bridges!
            }
            const dist = Math.hypot(this.x - target.x, this.y - target.y);
            if (dist < this.radius + target.radius) {
                target.takeDamage(this.damage, game);
                if (this.type === 'bomb') {
                    this.explodeBombOnOpponent(game, this.x, this.y);
                } else {
                    const sparkCount = this.type === 'laser' ? 18 : (this.type === 'heavy' ? 25 : 12);
                    const sparkColor = this.type === 'laser' ? '#00ffff' : '#d90429';
                    this.destroyWithSparks(game, this.x, this.y, sparkColor, sparkCount);
                }
                return;
            }
        }
    }

    explodeBombOnOpponent(game, x, y) {
        this.destroyed = true;
        audio.playExplosion();
        game.triggerScreenShake(12, 18);
        
        // Spawn rich fire explosion particles
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 6;
            const colors = ['#ff5722', '#ff9800', '#ffeb3b', '#6c757d'];
            game.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                radius: 3 + Math.random() * 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                decay: 0.02 + Math.random() * 0.02,
                gravity: -0.01 // float upwards
            });
        }
    }

    draw(ctx) {
        if (this.destroyed) return;

        // Draw smoke trail
        if (this.trail.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x, this.trail[0].y);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
            if (this.type === 'laser') {
                ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
                ctx.lineWidth = 3.5;
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#00ffff';
            } else {
                ctx.strokeStyle = this.type === 'heavy' ? 'rgba(210, 190, 180, 0.5)' : 'rgba(230, 220, 210, 0.4)';
                ctx.lineWidth = this.type === 'heavy' ? 4 : 2.5;
            }
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.type === 'bomb') {
            // Draw round black bomb shape
            ctx.fillStyle = '#212529';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Draw fuse
            ctx.strokeStyle = '#e76f51';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, -this.radius);
            ctx.quadraticCurveTo(2, -this.radius - 4, 4, -this.radius - 3);
            ctx.stroke();
            
            // Spark
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(4, -this.radius - 3, 2 + Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'heavy') {
            // Large glowing red-orange heavy bullet
            ctx.fillStyle = '#ff4500';
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff8c00';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'laser') {
            // Neon cyan laser beam capsule
            ctx.strokeStyle = '#00ffff';
            ctx.shadowBlur = 12;
            ctx.shadowColor = '#00ffff';
            ctx.lineWidth = 3.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            const angle = Math.atan2(this.vy, this.vx);
            ctx.moveTo(-Math.cos(angle) * 15, -Math.sin(angle) * 15);
            ctx.lineTo(0, 0);
            ctx.stroke();
        } else {
            // Normal golden bullet
            ctx.fillStyle = '#ffcc00';
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#ff9900';
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    destroyWithSparks(game, x, y, color, count = 6) {
        this.destroyed = true;

        if (!game || !game.particles) return;

        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 4;
            game.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                radius: 1 + Math.random() * 2,
                color: color,
                alpha: 1,
                decay: 0.03 + Math.random() * 0.04,
                gravity: 0.1
            });
        }
    }
}
