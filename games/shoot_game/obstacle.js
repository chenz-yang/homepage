// Environmental Obstacles for Wild West Duel
import { audio } from './audio.js?v=28';

export class Obstacle {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'cactus', 'tnt', 'fence', 'chest'
        this.destroyed = false;
        this.flashCount = 0; // For TNT flashing before explosion
        this.isTriggered = false;

        // Custom bounds and health for chests
        if (type === 'chest') {
            this.width = 44;
            this.height = 36;
            this.radius = 22;
            this.health = 5; // chests always have 5 points
        } else {
            this.width = 40;
            this.height = 40;
            this.radius = 20;
            this.health = 3;
        }
    }

    draw(ctx) {
        if (this.destroyed) return;

        ctx.save();
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowOffsetY = 4;

        if (this.type === 'cactus') {
            this.drawCactus(ctx);
        } else if (this.type === 'tnt') {
            this.drawTNT(ctx);
        } else if (this.type === 'fence') {
            this.drawFence(ctx);
        } else if (this.type === 'chest') {
            this.drawChest(ctx);
        }

        ctx.restore();
    }

    drawCactus(ctx) {
        const scale = 0.8 + (this.health / 10); // shrinks slightly as it gets shot down
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(scale, scale);

        ctx.fillStyle = '#2d6a4f';
        ctx.strokeStyle = '#1b4332';
        ctx.lineWidth = 3;

        // Trunk
        ctx.beginPath();
        ctx.roundRect(-8, -25, 16, 45, [8, 8, 2, 2]);
        ctx.fill();
        ctx.stroke();

        // Left arm
        ctx.beginPath();
        ctx.moveTo(-6, -5);
        ctx.quadraticCurveTo(-18, -5, -18, -15);
        ctx.lineTo(-18, -22);
        ctx.quadraticCurveTo(-18, -27, -13, -27);
        ctx.quadraticCurveTo(-8, -27, -8, -22);
        ctx.lineTo(-8, -13);
        ctx.lineTo(-6, -13);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right arm
        ctx.beginPath();
        ctx.moveTo(6, 5);
        ctx.quadraticCurveTo(18, 5, 18, -5);
        ctx.lineTo(18, -12);
        ctx.quadraticCurveTo(18, -17, 13, -17);
        ctx.quadraticCurveTo(8, -17, 8, -12);
        ctx.lineTo(8, -3);
        ctx.lineTo(6, -3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw needles
        ctx.strokeStyle = '#d8f3dc';
        ctx.lineWidth = 1.5;
        const spikes = [
            [-13, -24], [-18, -18], [-13, -10],
            [-4, -20], [-4, -8], [-4, 6],
            [4, -14], [4, 0], [4, 12],
            [13, -14], [18, -8], [13, 0]
        ];
        spikes.forEach(([sx, sy]) => {
            ctx.beginPath();
            ctx.moveTo(sx - 2, sy);
            ctx.lineTo(sx + 2, sy);
            ctx.moveTo(sx, sy - 2);
            ctx.lineTo(sx, sy + 2);
            ctx.stroke();
        });

        // Health indicators cracks
        if (this.health < 3) {
            ctx.strokeStyle = '#52b788';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-5, -15); ctx.lineTo(3, -10);
            if (this.health < 2) {
                ctx.moveTo(-12, -15); ctx.lineTo(-6, -20);
                ctx.moveTo(8, -5); ctx.lineTo(14, -10);
            }
            ctx.stroke();
        }

        ctx.restore();
    }

    drawTNT(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        if (this.isTriggered && Math.floor(this.flashCount / 3) % 2 === 0) {
            ctx.fillStyle = '#ffffff';
        } else {
            ctx.fillStyle = '#b7094c';
        }
        
        ctx.strokeStyle = '#2b0914';
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.roundRect(-15, -20, 30, 40, [6, 6, 6, 6]);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#f4a261';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-15, -10); ctx.lineTo(15, -10);
        ctx.moveTo(-15, 10); ctx.lineTo(15, 10);
        ctx.stroke();

        ctx.fillStyle = '#fefae0';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TNT', 0, 0);

        ctx.strokeStyle = '#e76f51';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -20);
        ctx.quadraticCurveTo(5, -27, 10, -28);
        ctx.stroke();

        if (this.isTriggered) {
            ctx.fillStyle = '#ffb703';
            ctx.beginPath();
            ctx.arc(10, -28, 4 + Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillStyle = '#6c757d';
            ctx.beginPath();
            ctx.arc(10, -28, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawFence(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        ctx.fillStyle = '#543310';
        ctx.strokeStyle = '#321f0b';
        ctx.lineWidth = 2;

        ctx.fillRect(-16, -20, 6, 40);
        ctx.strokeRect(-16, -20, 6, 40);
        ctx.fillRect(10, -20, 6, 40);
        ctx.strokeRect(10, -20, 6, 40);

        ctx.fillRect(-20, -12, 40, 7);
        ctx.strokeRect(-20, -12, 40, 7);
        ctx.fillRect(-20, 5, 40, 7);
        ctx.strokeRect(-20, 5, 40, 7);

        if (this.health < 3) {
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(-10, -10); ctx.lineTo(-8, -6);
            if (this.health < 2) {
                ctx.moveTo(5, 7); ctx.lineTo(9, 10);
            }
            ctx.stroke();
        }

        ctx.restore();
    }

    drawChest(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Brown wooden box base
        ctx.fillStyle = '#6c3b10'; // Rich dark wood
        ctx.strokeStyle = '#371c04';
        ctx.lineWidth = 3;

        // Bottom box
        ctx.beginPath();
        ctx.roundRect(-20, -6, 40, 22, [0, 0, 4, 4]);
        ctx.fill();
        ctx.stroke();

        // Top lid
        ctx.fillStyle = '#834c1b'; // lighter wood top
        ctx.beginPath();
        ctx.roundRect(-20, -20, 40, 14, [6, 6, 0, 0]);
        ctx.fill();
        ctx.stroke();

        // Golden structural bands
        ctx.fillStyle = '#d4af37'; // gold
        ctx.fillRect(-15, -20, 4, 36);
        ctx.fillRect(11, -20, 4, 36);

        // Lock panel
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#8b7500';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.rect(-5, -6, 10, 10);
        ctx.fill();
        ctx.stroke();

        // Keyhole
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(0, -3, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-0.75, -3, 1.5, 5);

        ctx.restore();

        // Draw Health Indicators above the chest (5 gold stars/dots)
        this.drawChestHealth(ctx);
    }

    drawChestHealth(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y - 28);
        const spacing = 8;
        const startX = -((5 - 1) * spacing) / 2;
        for (let i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(startX + i * spacing, 0, 3, 0, Math.PI * 2);
            if (i < this.health) {
                ctx.fillStyle = '#ffd700';
                ctx.shadowBlur = 4;
                ctx.shadowColor = '#ffd700';
            } else {
                ctx.fillStyle = 'rgba(60, 40, 30, 0.4)';
            }
            ctx.fill();
        }
        ctx.restore();
    }

    takeDamage(damage, game, bulletOwner = null) {
        if (this.destroyed) return;
        
        if (this.type === 'tnt') {
            if (!this.isTriggered) {
                this.isTriggered = true;
                this.flashCount = 20;
                audio.playRicochet();
            }
        } else if (this.type === 'chest') {
            this.health -= damage;
            audio.playRicochet();

            // Spawn wood chips
            if (game && game.particles) {
                for (let i = 0; i < 6; i++) {
                    game.particles.push({
                        x: this.x,
                        y: this.y,
                        vx: (Math.random() - 0.5) * 5,
                        vy: (Math.random() - 0.5) * 5 - 1,
                        radius: 2 + Math.random() * 3,
                        color: '#6c3b10', // Dark wood debris
                        alpha: 1,
                        decay: 0.02 + Math.random() * 0.02,
                        gravity: 0.15
                    });
                }
            }

            if (this.health <= 0) {
                this.health = 0;
                this.destroyed = true;

                // Play reward arpeggio chime
                audio.playChestOpen();
                game.triggerScreenShake(8, 12);

                // Roll random healing reward: 1 to 3 hearts
                const reward = Math.floor(Math.random() * 3) + 1;

                if (bulletOwner) {
                    // Cap at the cowboy's actual maximum health (including upgrades)
                    bulletOwner.health = Math.min(bulletOwner.maxHealth, bulletOwner.health + reward);
                }

                // Spawn glorious golden sparkle particles
                if (game && game.particles) {
                    for (let i = 0; i < 20; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 0.5 + Math.random() * 4.0;
                        game.particles.push({
                            x: this.x,
                            y: this.y,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed - 1.5,
                            radius: 3.5 + Math.random() * 4.0,
                            color: '#ffd700', // Sparkling Gold stars
                            alpha: 1.0,
                            decay: 0.012 + Math.random() * 0.015,
                            gravity: -0.03 // float upwards
                        });
                    }
                }
            }
        } else {
            this.health -= damage;
            audio.playRicochet();
            
            if (game && game.particles) {
                const color = this.type === 'cactus' ? '#2d6a4f' : '#543310';
                for (let i = 0; i < 8; i++) {
                    game.particles.push({
                        x: this.x,
                        y: this.y,
                        vx: (Math.random() - 0.5) * 6,
                        vy: (Math.random() - 0.5) * 6 - 2,
                        radius: 2 + Math.random() * 3,
                        color: color,
                        alpha: 1,
                        decay: 0.02 + Math.random() * 0.02,
                        gravity: 0.15
                    });
                }
            }

            if (this.health <= 0) {
                this.destroyed = true;
            }
        }
    }

    update(game) {
        if (this.destroyed) return;

        if (this.type === 'tnt' && this.isTriggered) {
            this.flashCount--;
            if (this.flashCount <= 0) {
                this.explode(game);
            }
        }
    }

    explode(game) {
        this.destroyed = true;
        audio.playExplosion();

        game.triggerScreenShake();

        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 8;
            const colors = ['#ff5722', '#ff9800', '#ffeb3b', '#6c757d', '#333333'];
            game.particles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1,
                radius: 4 + Math.random() * 12,
                color: colors[Math.floor(Math.random() * colors.length)],
                alpha: 1,
                decay: 0.015 + Math.random() * 0.025,
                gravity: -0.02
            });
        }

        const explosionRadius = 120;
        [game.player1, game.player2].forEach(player => {
            if (!player || player.health <= 0) return;
            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            if (dist < explosionRadius) {
                player.takeDamage(1, game);
                const pushAngle = Math.atan2(player.y - this.y, player.x - this.x);
                const pushForce = (1 - dist / explosionRadius) * 15;
                player.x += Math.cos(pushAngle) * pushForce;
                player.y += Math.sin(pushAngle) * pushForce;
                player.clampToField(game.canvas.width, game.canvas.height);
            }
        });

        game.obstacles.forEach(other => {
            if (other === this || other.destroyed) return;
            const dist = Math.hypot(other.x - this.x, other.y - this.y);
            if (dist < explosionRadius) {
                if (other.type === 'tnt') {
                    if (!other.isTriggered) {
                        other.isTriggered = true;
                        other.flashCount = 2 + Math.floor(Math.random() * 5);
                    }
                } else {
                    other.takeDamage(3, game);
                }
            }
        });
    }
}

// Tumbleweed obstacle
export class Tumbleweed {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 18;
        this.angle = 0;
        this.rotSpeed = (vx > 0 ? 1 : -1) * 0.08;
        this.destroyed = false;
        this.health = 1;
    }

    draw(ctx) {
        if (this.destroyed) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.strokeStyle = '#bfa17c';
        ctx.lineWidth = 2.5;
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';

        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius, this.radius - 4, (i * Math.PI) / 3, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.strokeStyle = '#9c7c56';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius - 8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    update(game) {
        if (this.destroyed) return;

        this.x += this.vx;
        this.y += this.vy;
        this.angle += this.rotSpeed;

        const fenceTop = 75;
        const fenceBottom = game.canvas.height - 35;
        if (this.y - this.radius < fenceTop) {
            this.y = fenceTop + this.radius;
            this.vy = -this.vy;
        } else if (this.y + this.radius > fenceBottom) {
            this.y = fenceBottom - this.radius;
            this.vy = -this.vy;
        }

        if (this.vx > 0 && this.x - this.radius > game.canvas.width) {
            this.destroyed = true;
        } else if (this.vx < 0 && this.x + this.radius < 0) {
            this.destroyed = true;
        }

        [game.player1, game.player2].forEach(player => {
            if (!player || player.health <= 0) return;
            const dist = Math.hypot(player.x - this.x, player.y - this.y);
            const minDist = this.radius + player.radius;
            if (dist < minDist) {
                const pushAngle = Math.atan2(player.y - this.y, player.x - this.x);
                player.x += Math.cos(pushAngle) * 1.5;
                player.y += Math.sin(pushAngle) * 1.5;
                player.clampToField(game.canvas.width, game.canvas.height);
            }
        });
    }

    takeDamage(damage, game) {
        this.destroyed = true;
        audio.playRicochet();

        if (game && game.particles) {
            for (let i = 0; i < 6; i++) {
                game.particles.push({
                    x: this.x,
                    y: this.y,
                    vx: (Math.random() - 0.5) * 4,
                    vy: (Math.random() - 0.5) * 4 - 1,
                    radius: 1 + Math.random() * 2,
                    color: '#bfa17c',
                    alpha: 1,
                    decay: 0.03 + Math.random() * 0.02,
                    gravity: 0.1
                });
            }
        }
    }
}

export class GroundSpike {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 18;
        this.state = 'warning'; // 'warning', 'active', 'retracting'
        this.timer = 0;
        this.warningDuration = 50; // frames
        this.activeDuration = 80;  // frames
        this.retractDuration = 25; // frames
        this.damagedEntities = new Set();
        this.destroyed = false;
        
        // Spike scale / height for animation
        this.heightPercent = 0; // 0 to 1
    }
    
    update(game) {
        if (this.destroyed) return;
        this.timer++;
        
        if (this.state === 'warning') {
            this.heightPercent = 0;
            if (this.timer >= this.warningDuration) {
                this.state = 'active';
                this.timer = 0;
                audio.playSpike(); // Play the spike sound effect!
                // Trigger screen shake slightly
                game.triggerScreenShake(3, 8);
                // Damage any entity close enough when emerging
                this.checkDamage(game);
            }
        } else if (this.state === 'active') {
            // Animate height going up quickly in the first 10 frames
            if (this.timer < 10) {
                this.heightPercent = this.timer / 10;
            } else {
                this.heightPercent = 1;
            }
            
            // Check damage continuously for entities moving into it
            this.checkDamage(game);
            
            if (this.timer >= this.activeDuration) {
                this.state = 'retracting';
                this.timer = 0;
            }
        } else if (this.state === 'retracting') {
            this.heightPercent = 1 - (this.timer / this.retractDuration);
            if (this.timer >= this.retractDuration) {
                this.heightPercent = 0;
                this.destroyed = true;
            }
        }
    }
    
    checkDamage(game) {
        if (this.state !== 'active') return;
        
        const entities = [game.player1, game.player2, ...game.helperAIs];
        entities.forEach(entity => {
            if (!entity || entity.health <= 0) return;
            if (this.damagedEntities.has(entity)) return;
            
            const dist = Math.hypot(entity.x - this.x, entity.y - this.y);
            const minDist = this.radius + entity.radius - 2; // slight margin
            if (dist < minDist) {
                entity.takeDamage(1, game);
                this.damagedEntities.add(entity);
                
                // Spawn spike hit particles (red/dusty/blood)
                if (game.particles) {
                    for (let i = 0; i < 10; i++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = 1 + Math.random() * 4;
                        game.particles.push({
                            x: entity.x,
                            y: entity.y,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed - 1,
                            radius: 1.5 + Math.random() * 2.5,
                            color: '#b7094c', // Red spike dust / blood
                            alpha: 1,
                            decay: 0.03 + Math.random() * 0.03,
                            gravity: 0.1
                        });
                    }
                }
            }
        });
    }
    
    draw(ctx) {
        if (this.destroyed) return;
        
        ctx.save();
        
        if (this.state === 'warning') {
            // Draw a warning area: pulsing red circle with cracks
            const pulse = 1 + Math.sin(this.timer * 0.15) * 0.15;
            ctx.strokeStyle = `rgba(220, 20, 60, ${0.4 + Math.sin(this.timer * 0.15) * 0.25})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            
            // Outer dashed circle
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * pulse, 0, Math.PI * 2);
            ctx.stroke();
            
            // Faint red center fill
            ctx.fillStyle = `rgba(220, 20, 60, ${0.08 + Math.sin(this.timer * 0.15) * 0.05})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw small ground cracks or dust warning indicators
            ctx.strokeStyle = 'rgba(120, 80, 60, 0.5)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            for (let i = 0; i < 4; i++) {
                const angle = (i * Math.PI) / 2;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y);
                ctx.lineTo(this.x + Math.cos(angle) * (this.radius * 0.6), this.y + Math.sin(angle) * (this.radius * 0.6));
                ctx.stroke();
            }
        } else {
            // Active or retracting spikes
            // Draw a base plate / cracked ground
            ctx.fillStyle = 'rgba(70, 50, 40, 0.4)';
            ctx.beginPath();
            ctx.ellipse(this.x, this.y + 5, this.radius * 1.1, this.radius * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw multiple sharp red spikes emerging
            const spikeOffsets = [
                { dx: 0, dy: -5, h: 28, w: 8 },
                { dx: -12, dy: 2, h: 20, w: 6 },
                { dx: 12, dy: 4, h: 18, w: 6 },
                { dx: -5, dy: 8, h: 16, w: 5 },
                { dx: 6, dy: -8, h: 22, w: 5 }
            ];
            
            spikeOffsets.sort((a, b) => a.dy - b.dy); // Draw back to front for proper depth
            
            spikeOffsets.forEach(sp => {
                const sx = this.x + sp.dx;
                const sy = this.y + sp.dy;
                const currentHeight = sp.h * this.heightPercent;
                
                // Draw spike shadow
                ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
                ctx.beginPath();
                ctx.moveTo(sx - sp.w, sy);
                ctx.lineTo(sx + sp.w, sy);
                ctx.lineTo(sx + sp.w * 0.5, sy + 3);
                ctx.closePath();
                ctx.fill();
                
                // Draw spike itself
                const gradient = ctx.createLinearGradient(sx - sp.w, sy, sx + sp.w, sy);
                gradient.addColorStop(0, '#800919'); // Dark crimson shadow side
                gradient.addColorStop(0.3, '#d90429'); // Bright red main
                gradient.addColorStop(1, '#ff4d6d'); // Highlight side
                
                ctx.fillStyle = gradient;
                ctx.strokeStyle = '#590d22'; // Very dark red border
                ctx.lineWidth = 1.5;
                
                ctx.beginPath();
                ctx.moveTo(sx - sp.w, sy);
                ctx.lineTo(sx, sy - currentHeight); // Peak
                ctx.lineTo(sx + sp.w, sy);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                // Draw shiny metallic highlight line on spike
                if (this.heightPercent > 0.5) {
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(sx, sy - currentHeight);
                    ctx.lineTo(sx - sp.w * 0.2, sy);
                    ctx.stroke();
                }
            });
        }
        
        ctx.restore();
    }
}
