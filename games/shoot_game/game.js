import { Cowboy } from './cowboy.js?v=38';
import { Obstacle, Tumbleweed, GroundSpike } from './obstacle.js?v=38';
import { audio } from './audio.js?v=38';
import { TRANSLATIONS } from './translations.js?v=38';

console.log("Wild West Duel - Loaded version 35");

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Game States
        this.mode = 'pve'; // 'pve' or 'pvp'
        this.level = 1;
        this.state = 'menu'; // 'menu', 'playing', 'paused', 'gameover'
        this.keys = {};
        
        // Weapons (default: rapid)
        this.p1Weapon = 'rapid';
        this.p2Weapon = 'rapid';

        // Entities
        this.player1 = null;
        this.player2 = null;
        this.bullets = [];
        this.obstacles = [];
        this.tumbleweeds = [];
        this.groundSpikes = [];
        this.particles = [];
        this.spikeSpawnTimer = 0;
        
        // Sheriff Summon State
        this.sheriffActive = false;
        this.sheriffTimer = 0;
        this.sheriffX = 0;
        this.sheriffY = 0;

        // Wind variables
        this.wind = 0; // target wind velocity (-10 to 10)
        this.currentWind = 0; // interpolated wind velocity
        this.windTime = 0;
        this.windLines = [];
        
        // Screen Shake
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        
        // Floating Dust in menu
        this.menuDust = [];
        
        // Audio state
        this.isMuted = false;

        // Tumbleweed spawn controller
        this.tumbleweedSpawnTimer = 0;

        // Shop & Upgrades persistent stats
        this.coins = parseInt(localStorage.getItem('wild_west_coins')) || 0;
        this.hpUpgrades = parseInt(localStorage.getItem('wild_west_hp_upgrade')) || 0;
        this.hpActive = localStorage.getItem('wild_west_hp_active') !== 'false';
        this.doppelgangerCount = parseInt(localStorage.getItem('wild_west_doppelganger_count')) || 0;
        this.doppelgangerLvl = parseInt(localStorage.getItem('wild_west_doppelganger_level')) || 0;
        this.doppelgangerActive = localStorage.getItem('wild_west_doppelganger_active') !== 'false';
        this.lasergunLvl = parseInt(localStorage.getItem('wild_west_lasergun_level')) || 0;
        this.rapidLvl = parseInt(localStorage.getItem('wild_west_rapid_level')) || 1;
        this.heavyLvl = parseInt(localStorage.getItem('wild_west_heavy_level')) || 1;
        this.bombLvl = parseInt(localStorage.getItem('wild_west_bomb_level')) || 1;
        this.aiDifficulty = parseInt(localStorage.getItem('wild_west_ai_difficulty')) || 1;
        this.lastPrestigeChoiceTime = parseInt(localStorage.getItem('wild_west_prestige_time')) || 0;

        // Language setup
        this.currentLanguage = localStorage.getItem('wild_west_lang') || 'original';

        // Detect mobile device (smartphone or tablet like iPad)
        this.isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                              (navigator.maxTouchPoints > 0 && (/iPad/i.test(navigator.userAgent) || /Macintosh/i.test(navigator.userAgent)));
        
        // Detect smartphone specifically (mobile device with small screen dimension)
        this.isSmartphone = this.isMobileDevice && (Math.min(window.innerWidth, window.innerHeight) < 550);

        // A device has a physical keyboard if it's NOT a mobile device
        this.hasPhysicalKeyboard = !this.isMobileDevice;

        // Player names persistent stats with language defaults
        const defaultP1 = this.currentLanguage === 'chinese' ? '玩家 1' : 'Spieler 1';
        const defaultP2 = this.currentLanguage === 'chinese' ? '玩家 2' : 'Spieler 2';
        const defaultP2PvE = this.currentLanguage === 'chinese' ? '强盗' : 'Bandit';

        this.p1Name = localStorage.getItem('wild_west_p1_name') || defaultP1;
        this.p2Name = localStorage.getItem('wild_west_p2_name') || defaultP2;
        this.p2NamePvE = localStorage.getItem('wild_west_p2_name_pve') || defaultP2PvE;

        this.helperAIs = [];

        // Joystick inputs for mobile/touch play
        this.joystickMove = { x: 0, y: 0, active: false };
        this.joystickAim = { x: 0, y: 0, angle: 0, dist: 0, active: false };
        this.moveTouchId = null;
        this.aimTouchId = null;

        this.initDOM();
        this.initInput();
        this.createMenuDust();
        this.startMenuLoop();
        this.setLanguage(this.currentLanguage);
        this.forceRepaint();
    }

    forceRepaint() {
        // Safe trigger to force a style reflow and repaint on all main screens and interactive buttons
        const elements = document.querySelectorAll('.btn, .level-card, .shop-item, .screen, .menu-section');
        elements.forEach(el => {
            const voidOffset = el.offsetHeight;
            const originalOpacity = window.getComputedStyle(el).opacity;
            el.style.opacity = '0.99';
            el.offsetHeight; // triggers layout repaint
            el.style.opacity = originalOpacity;
        });
    }

    t(key, replacements = {}) {
        const lang = this.currentLanguage || 'original';
        let text = TRANSLATIONS[lang]?.[key] || TRANSLATIONS['original']?.[key] || key;
        for (const [k, v] of Object.entries(replacements)) {
            text = text.replace(`{${k}}`, v);
        }
        return text;
    }

    setLanguage(lang) {
        const oldLang = this.currentLanguage;
        this.currentLanguage = lang;
        localStorage.setItem('wild_west_lang', lang);
        console.log("setLanguage: changed to", lang, "state:", this.state);

        // Update button states in language selector
        const originalBtn = document.getElementById('lang-btn-original');
        const chineseBtn = document.getElementById('lang-btn-chinese');
        if (originalBtn && chineseBtn) {
            if (lang === 'chinese') {
                originalBtn.classList.remove('selected');
                chineseBtn.classList.add('selected');
            } else {
                originalBtn.classList.add('selected');
                chineseBtn.classList.remove('selected');
            }
        }

        // Adjust defaults for player names if user hasn't customized them yet
        const oldDefaultP1 = oldLang === 'chinese' ? '玩家 1' : 'Spieler 1';
        const oldDefaultP2 = oldLang === 'chinese' ? '玩家 2' : 'Spieler 2';
        const oldDefaultP2PvE = oldLang === 'chinese' ? '强盗' : 'Bandit';

        const newDefaultP1 = lang === 'chinese' ? '玩家 1' : 'Spieler 1';
        const newDefaultP2 = lang === 'chinese' ? '玩家 2' : 'Spieler 2';
        const newDefaultP2PvE = lang === 'chinese' ? '强盗' : 'Bandit';

        if (this.p1Name === oldDefaultP1) {
            this.p1Name = newDefaultP1;
            localStorage.setItem('wild_west_p1_name', this.p1Name);
        }
        if (this.p2Name === oldDefaultP2) {
            this.p2Name = newDefaultP2;
            localStorage.setItem('wild_west_p2_name', this.p2Name);
        }
        if (this.p2NamePvE === oldDefaultP2PvE) {
            this.p2NamePvE = newDefaultP2PvE;
            localStorage.setItem('wild_west_p2_name_pve', this.p2NamePvE);
        }

        // Sync inputs in DOM
        const p1Input = document.getElementById('p1-name-input');
        const p2Input = document.getElementById('p2-name-input');
        if (p1Input) p1Input.value = this.p1Name;
        if (p2Input) p2Input.value = this.mode === 'pvp' ? this.p2Name : this.p2NamePvE;

        // Update name labels & weapon title dynamically
        const p2Label = document.getElementById('p2-label-text');
        const p2WepTitle = document.getElementById('p2-weapon-title');
        const p2NameLabel = document.getElementById('p2-name-label');
        if (this.mode === 'pvp') {
            if (p2Label) p2Label.textContent = `${this.p2Name}${this.t('suffix-white')}`;
            if (p2WepTitle) p2WepTitle.textContent = `${this.p2Name}${this.t('suffix-white')}`;
            if (p2NameLabel) p2NameLabel.textContent = this.t('label-p2-name-pvp');
        } else {
            if (p2Label) p2Label.textContent = `${this.p2NamePvE}${this.t('suffix-ki')}`;
            if (p2WepTitle) p2WepTitle.textContent = this.t('weapon-p2-label-ki');
            if (p2NameLabel) p2NameLabel.textContent = this.t('label-p2-name-ki');
        }
        const p1Label = document.getElementById('p1-label-text');
        if (p1Label) p1Label.textContent = `${this.p1Name}${this.t('suffix-black')}`;

        // Translate all elements with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.innerHTML = this.t(key);
        });

        // Refresh dynamically rendered layouts
        this.updateShopUI();
        this.updateWeaponsUI();
        this.updateHUD();

        // Update mute button text
        const muteBtn = document.getElementById('mute-btn');
        if (muteBtn) {
            muteBtn.textContent = this.isMuted ? this.t('hud-mute-off') : this.t('hud-mute-on');
        }

        // Update Game Over text if active
        if (this.state === 'gameover') {
            const title = document.getElementById('victory-title');
            const subtitle = document.getElementById('victory-subtitle');
            if (this.player1 && this.player2) {
                if (this.player1.health <= 0 && this.player2.health <= 0) {
                    title.textContent = this.t('go-draw-title');
                    subtitle.textContent = this.t('go-draw-subtitle');
                } else if (this.player1.health <= 0) {
                    const oppName = this.mode === 'pvp' ? this.p2Name : this.p2NamePvE;
                    title.textContent = this.t('go-victory-title', { name: oppName });
                    subtitle.textContent = this.mode === 'pvp' ? this.t('go-p2-win-pvp-subtitle', { oppName, p1Name: this.p1Name }) : this.t('go-p2-win-ki-subtitle');
                } else {
                    title.textContent = this.t('go-victory-title', { name: this.p1Name });
                    subtitle.textContent = this.t('go-p1-win-subtitle');
                    
                    // Update reward banner translation dynamically if in PvE mode
                    if (this.mode === 'pve') {
                        const coinsEarned = this.aiDifficulty >= 5 ? 5 : 3;
                        const rewardBanner = document.getElementById('coins-reward-banner');
                        if (rewardBanner) {
                            rewardBanner.innerHTML = this.t('go-reward-banner', { val: coinsEarned });
                        }
                    }
                }
            }
        }

        // Update level display if playing
        if (this.state === 'playing') {
            const lvlName = document.getElementById('level-display-name');
            if (lvlName) {
                lvlName.textContent = `${this.t('level-label')} ${this.level}: ${this.t('level-' + this.level + '-name')}`;
            }
        }
    }

    get doppelgangerUnlocked() {
        return this.doppelgangerCount > 0;
    }
    get lasergunUnlocked() {
        return this.lasergunLvl > 0;
    }

    updateModeVisibility() {
        const diffSection = document.getElementById('difficulty-select-section');
        if (diffSection) {
            if (this.mode === 'pve') {
                diffSection.classList.remove('hidden');
            } else {
                diffSection.classList.add('hidden');
            }
        }
    }

    initDOM() {
        this.isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        
        if (this.isMobileDevice) {
            document.body.classList.add('mobile-device');
            document.documentElement.classList.add('mobile-device');
        } else {
            document.body.classList.add('pc-device');
            document.documentElement.classList.add('pc-device');
        }
        
        if (this.isSmartphone) {
            document.body.classList.add('smartphone');
            document.documentElement.classList.add('smartphone');
        }

        window.addEventListener('resize', () => {
            this.isSmartphone = this.isMobileDevice && (Math.min(window.innerWidth, window.innerHeight) < 550);
            if (this.isSmartphone) {
                document.body.classList.add('smartphone');
                document.documentElement.classList.add('smartphone');
            } else {
                document.body.classList.remove('smartphone');
                document.documentElement.classList.remove('smartphone');
            }
        });

        // Dynamic input detection: switch UI dynamically on touch vs keyboard interaction
        window.addEventListener('keydown', (e) => {
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                return;
            }
            if (this.isTouchDevice) {
                this.isTouchDevice = false;
                document.body.classList.remove('touch-device');
                document.documentElement.classList.remove('touch-device');
            }
        });

        window.addEventListener('touchstart', (e) => {
            if (!this.isTouchDevice) {
                this.isTouchDevice = true;
                document.body.classList.add('touch-device');
                document.documentElement.classList.add('touch-device');

                // If PvP mode was selected, fall back to PvE on touch device transition
                // ONLY fall back if this is a mobile device (no physical keyboard)
                if (this.mode === 'pvp' && this.isMobileDevice) {
                    this.mode = 'pve';
                    const pveBtn = document.querySelector('.mode-btn[data-mode="pve"]');
                    const pvpBtn = document.querySelector('.mode-btn[data-mode="pvp"]');
                    if (pveBtn && pvpBtn) {
                        pvpBtn.classList.remove('selected');
                        pveBtn.classList.add('selected');

                        // Update P2 labels for PvE (Bandit/KI)
                        const p2Label = document.getElementById('p2-label-text');
                        const p2WepTitle = document.getElementById('p2-weapon-title');
                        const p2NameLabel = document.getElementById('p2-name-label');
                        const p2Input = document.getElementById('p2-name-input');
                        if (p2Label) p2Label.textContent = `${this.p2NamePvE}${this.t('suffix-ki')}`;
                        if (p2WepTitle) p2WepTitle.textContent = this.t('weapon-p2-label-ki');
                        if (p2NameLabel) p2NameLabel.textContent = this.t('label-p2-name-ki');
                        if (p2Input) p2Input.value = this.p2NamePvE;
                    }
                    this.updateModeVisibility();
                }
            }
        }, { passive: true });

        // Language Select buttons
        const originalBtn = document.getElementById('lang-btn-original');
        const chineseBtn = document.getElementById('lang-btn-chinese');
        if (originalBtn && chineseBtn) {
            originalBtn.addEventListener('click', () => {
                this.setLanguage('original');
                audio.playRicochet();
            });
            chineseBtn.addEventListener('click', () => {
                this.setLanguage('chinese');
                audio.playRicochet();
            });
        }

        // Name Inputs DOM Elements
        const p1Input = document.getElementById('p1-name-input');
        const p2Input = document.getElementById('p2-name-input');
        const p2NameLabel = document.getElementById('p2-name-label');

        if (p1Input && p2Input) {
            p1Input.value = this.p1Name;
            p2Input.value = this.mode === 'pvp' ? this.p2Name : this.p2NamePvE;

            p1Input.addEventListener('input', () => {
                const defaultP1 = this.currentLanguage === 'chinese' ? '玩家 1' : 'Spieler 1';
                this.p1Name = p1Input.value.trim() || defaultP1;
                localStorage.setItem('wild_west_p1_name', this.p1Name);
            });

            p2Input.addEventListener('input', () => {
                if (this.mode === 'pvp') {
                    const defaultP2 = this.currentLanguage === 'chinese' ? '玩家 2' : 'Spieler 2';
                    this.p2Name = p2Input.value.trim() || defaultP2;
                    localStorage.setItem('wild_west_p2_name', this.p2Name);
                } else {
                    const defaultP2PvE = this.currentLanguage === 'chinese' ? '强盗' : 'Bandit';
                    this.p2NamePvE = p2Input.value.trim() || defaultP2PvE;
                    localStorage.setItem('wild_west_p2_name_pve', this.p2NamePvE);
                }
            });
        }

        // Mode buttons
        const modeButtons = document.querySelectorAll('.mode-btn');
        modeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                modeButtons.forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.mode = btn.getAttribute('data-mode');
                audio.playWesternWhistle(); // sound cue
                
                // Update labels
                const p2Label = document.getElementById('p2-label-text');
                const p2WepTitle = document.getElementById('p2-weapon-title');
                if (this.mode === 'pvp') {
                    if (p2Label) p2Label.textContent = `${this.p2Name}${this.t('suffix-white')}`;
                    if (p2WepTitle) p2WepTitle.textContent = `${this.p2Name}${this.t('suffix-white')}`;
                    if (p2NameLabel) p2NameLabel.textContent = this.t('label-p2-name-pvp');
                    if (p2Input) p2Input.value = this.p2Name;
                } else {
                    if (p2Label) p2Label.textContent = `${this.p2NamePvE}${this.t('suffix-ki')}`;
                    if (p2WepTitle) p2WepTitle.textContent = this.t('weapon-p2-label-ki');
                    if (p2NameLabel) p2NameLabel.textContent = this.t('label-p2-name-ki');
                    if (p2Input) p2Input.value = this.p2NamePvE;
                }
                this.updateModeVisibility();
            });
        });
        // Select PVE by default
        document.querySelector('.mode-btn[data-mode="pve"]').classList.add('selected');

        // Weapon select buttons
        const weaponButtons = document.querySelectorAll('.weapon-btn');
        weaponButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const player = btn.getAttribute('data-player');
                const weapon = btn.getAttribute('data-weapon');

                if (player === 'p1') {
                    document.querySelectorAll('.weapon-btn[data-player="p1"]').forEach(b => b.classList.remove('p1-wep-active'));
                    btn.classList.add('p1-wep-active');
                    this.p1Weapon = weapon;
                } else {
                    document.querySelectorAll('.weapon-btn[data-player="p2"]').forEach(b => b.classList.remove('p2-wep-active'));
                    btn.classList.add('p2-wep-active');
                    this.p2Weapon = weapon;
                }
                audio.playRicochet(); // click sound cue
            });
        });

        // Level cards
        const levelCards = document.querySelectorAll('.level-card');
        levelCards.forEach(card => {
            card.addEventListener('click', () => {
                levelCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.level = parseInt(card.getAttribute('data-level'));
                audio.playRicochet(); // sound cue
            });
        });

        // Difficulty cards
        const difficultyCards = document.querySelectorAll('.difficulty-card');
        difficultyCards.forEach(card => {
            card.addEventListener('click', () => {
                difficultyCards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                this.aiDifficulty = parseInt(card.getAttribute('data-difficulty'));
                localStorage.setItem('wild_west_ai_difficulty', this.aiDifficulty);
                audio.playRicochet(); // sound cue
            });
        });

        // Highlight active difficulty card on startup
        difficultyCards.forEach(card => {
            if (parseInt(card.getAttribute('data-difficulty')) === this.aiDifficulty) {
                card.classList.add('active');
            } else {
                card.classList.remove('active');
            }
        });

        // Start button
        document.getElementById('start-game-btn').addEventListener('click', () => {
            this.startGame();
        });

        // Pause / Unpause / Resume
        document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('resume-btn').addEventListener('click', () => this.togglePause());
        
        // Exit to main menu
        document.getElementById('exit-game-btn').addEventListener('click', () => this.exitToMenu());
        document.getElementById('pause-menu-btn').addEventListener('click', () => this.exitToMenu());
        document.getElementById('menu-btn').addEventListener('click', () => this.exitToMenu());

        // Rematch
        document.getElementById('rematch-btn').addEventListener('click', () => this.startGame());

        // Mute toggle
        const muteBtn = document.getElementById('mute-btn');
        muteBtn.addEventListener('click', () => {
            this.isMuted = audio.toggleMute();
            muteBtn.textContent = this.isMuted ? this.t('hud-mute-off') : this.t('hud-mute-on');
            if (this.isMuted) {
                audio.stopBGM();
            } else {
                audio.playRicochet();
                if (this.state === 'playing') {
                    audio.startBGM();
                }
            }
        });

        // Initialize Shop UI
        this.updateShopUI();

        // Initialize Shop & Weapons UI
        this.updateWeaponsUI();
        this.updateShopUI();
        this.updateModeVisibility();

        // Shop Upgrades: +1 HP
        const buyHpBtn = document.getElementById('buy-hp-btn');
        buyHpBtn.addEventListener('click', () => {
            if (this.hpUpgrades >= 10) return;
            const cost = 10 + this.hpUpgrades * 10;
            if (this.coins >= cost) {
                this.coins -= cost;
                this.hpUpgrades++;
                localStorage.setItem('wild_west_coins', this.coins);
                localStorage.setItem('wild_west_hp_upgrade', this.hpUpgrades);
                audio.playCoinSound();
                this.updateShopUI();
            } else {
                audio.playRicochet();
                buyHpBtn.classList.add('shake');
                setTimeout(() => buyHpBtn.classList.remove('shake'), 400);
            }
        });

        // HP Upgrade Toggle Button
        const toggleHpBtn = document.getElementById('toggle-hp-btn');
        toggleHpBtn.addEventListener('click', () => {
            if (this.hpUpgrades > 0) {
                this.hpActive = !this.hpActive;
                localStorage.setItem('wild_west_hp_active', this.hpActive);
                audio.playRicochet();
                this.updateShopUI();
            }
        });

        // Shop Upgrades: Doppelganger Count
        const buyDoppelCountBtn = document.getElementById('buy-doppel-count-btn');
        buyDoppelCountBtn.addEventListener('click', () => {
            if (this.doppelgangerCount >= 3) return;
            const cost = 30 + this.doppelgangerCount * 30; // 30, 60, 90
            if (this.coins >= cost) {
                this.coins -= cost;
                this.doppelgangerCount++;
                if (this.doppelgangerCount === 1) {
                    this.doppelgangerActive = true;
                }
                localStorage.setItem('wild_west_coins', this.coins);
                localStorage.setItem('wild_west_doppelganger_count', this.doppelgangerCount);
                localStorage.setItem('wild_west_doppelganger_active', this.doppelgangerActive);
                audio.playCoinSound();
                this.updateShopUI();
            } else {
                audio.playRicochet();
                buyDoppelCountBtn.classList.add('shake');
                setTimeout(() => buyDoppelCountBtn.classList.remove('shake'), 400);
            }
        });

        // Shop Upgrades: Doppelganger Level (Upgrade)
        const buyDoppelLvlBtn = document.getElementById('buy-doppel-lvl-btn');
        buyDoppelLvlBtn.addEventListener('click', () => {
            if (this.doppelgangerLvl >= 5) return;
            const cost = 30 + this.doppelgangerLvl * 10;
            if (this.coins >= cost) {
                this.coins -= cost;
                this.doppelgangerLvl++;
                localStorage.setItem('wild_west_coins', this.coins);
                localStorage.setItem('wild_west_doppelganger_level', this.doppelgangerLvl);
                audio.playCoinSound();
                this.updateShopUI();
            } else {
                audio.playRicochet();
                buyDoppelLvlBtn.classList.add('shake');
                setTimeout(() => buyDoppelLvlBtn.classList.remove('shake'), 400);
            }
        });

        // Doppelganger Toggle Button
        const toggleDoppelBtn = document.getElementById('toggle-doppel-btn');
        toggleDoppelBtn.addEventListener('click', () => {
            if (this.doppelgangerCount > 0) {
                this.doppelgangerActive = !this.doppelgangerActive;
                localStorage.setItem('wild_west_doppelganger_active', this.doppelgangerActive);
                audio.playRicochet();
                this.updateShopUI();
            }
        });

        // Shop Upgrades: Lasergun Buy/Upgrade
        const buyLaserBtn = document.getElementById('buy-laser-btn');
        buyLaserBtn.addEventListener('click', () => {
            if (this.lasergunLvl >= 5) return;
            const cost = 50 + this.lasergunLvl * 10;
            if (this.coins >= cost) {
                this.coins -= cost;
                this.lasergunLvl++;
                localStorage.setItem('wild_west_coins', this.coins);
                localStorage.setItem('wild_west_lasergun_level', this.lasergunLvl);
                audio.playCoinSound();
                this.updateShopUI();
                this.updateWeaponsUI();
            } else {
                audio.playRicochet();
                buyLaserBtn.classList.add('shake');
                setTimeout(() => buyLaserBtn.classList.remove('shake'), 400);
            }
        });

        // Shop Upgrades: Schnell Buy/Upgrade
        const buyRapidBtn = document.getElementById('buy-rapid-btn');
        buyRapidBtn.addEventListener('click', () => {
            if (this.rapidLvl >= 5) return;
            const cost = this.rapidLvl * 10;
            if (this.coins >= cost) {
                this.coins -= cost;
                this.rapidLvl++;
                localStorage.setItem('wild_west_coins', this.coins);
                localStorage.setItem('wild_west_rapid_level', this.rapidLvl);
                audio.playCoinSound();
                this.updateShopUI();
                this.updateWeaponsUI();
            } else {
                audio.playRicochet();
                buyRapidBtn.classList.add('shake');
                setTimeout(() => buyRapidBtn.classList.remove('shake'), 400);
            }
        });

        // Shop Upgrades: Langsam Buy/Upgrade
        const buyHeavyBtn = document.getElementById('buy-heavy-btn');
        buyHeavyBtn.addEventListener('click', () => {
            if (this.heavyLvl >= 5) return;
            const cost = this.heavyLvl * 10;
            if (this.coins >= cost) {
                this.coins -= cost;
                this.heavyLvl++;
                localStorage.setItem('wild_west_coins', this.coins);
                localStorage.setItem('wild_west_heavy_level', this.heavyLvl);
                audio.playCoinSound();
                this.updateShopUI();
                this.updateWeaponsUI();
            } else {
                audio.playRicochet();
                buyHeavyBtn.classList.add('shake');
                setTimeout(() => buyHeavyBtn.classList.remove('shake'), 400);
            }
        });

        // Shop Upgrades: Bombe Buy/Upgrade
        const buyBombBtn = document.getElementById('buy-bomb-btn');
        buyBombBtn.addEventListener('click', () => {
            if (this.bombLvl >= 5) return;
            const cost = this.bombLvl * 10;
            if (this.coins >= cost) {
                this.coins -= cost;
                this.bombLvl++;
                localStorage.setItem('wild_west_coins', this.coins);
                localStorage.setItem('wild_west_bomb_level', this.bombLvl);
                audio.playCoinSound();
                this.updateShopUI();
                this.updateWeaponsUI();
            } else {
                audio.playRicochet();
                buyBombBtn.classList.add('shake');
                setTimeout(() => buyBombBtn.classList.remove('shake'), 400);
            }
        });

        // Prestige buttons click listeners
        const prestigeKeepBtn = document.getElementById('prestige-keep-btn');
        prestigeKeepBtn.addEventListener('click', () => {
            this.lastPrestigeChoiceTime = Date.now();
            localStorage.setItem('wild_west_prestige_time', this.lastPrestigeChoiceTime);
            audio.playCoinSound();
            this.updateShopUI();
        });

        const prestigeResetBtn = document.getElementById('prestige-reset-btn');
        prestigeResetBtn.addEventListener('click', () => {
            this.coins = 0;
            this.hpUpgrades = 0;
            this.hpActive = true;
            this.doppelgangerCount = 0;
            this.doppelgangerLvl = 0;
            this.doppelgangerActive = false;
            this.lasergunLvl = 0;
            this.rapidLvl = 1;
            this.heavyLvl = 1;
            this.bombLvl = 1;
            this.lastPrestigeChoiceTime = 0;

            localStorage.removeItem('wild_west_coins');
            localStorage.removeItem('wild_west_hp_upgrade');
            localStorage.removeItem('wild_west_hp_active');
            localStorage.removeItem('wild_west_doppelganger_count');
            localStorage.removeItem('wild_west_doppelganger_upgrade');
            localStorage.removeItem('wild_west_doppelganger_level');
            localStorage.removeItem('wild_west_doppelganger_active');
            localStorage.removeItem('wild_west_lasergun_unlocked');
            localStorage.removeItem('wild_west_lasergun_level');
            localStorage.removeItem('wild_west_rapid_level');
            localStorage.removeItem('wild_west_heavy_level');
            localStorage.removeItem('wild_west_bomb_level');
            localStorage.removeItem('wild_west_prestige_time');

            this.p1Weapon = 'rapid';
            this.p2Weapon = 'rapid';

            // Reset UI states
            document.querySelectorAll('.weapon-btn[data-player="p1"]').forEach(b => {
                b.classList.remove('p1-wep-active');
                if (b.getAttribute('data-weapon') === 'rapid') b.classList.add('p1-wep-active');
            });
            document.querySelectorAll('.weapon-btn[data-player="p2"]').forEach(b => {
                b.classList.remove('p2-wep-active');
                if (b.getAttribute('data-weapon') === 'rapid') b.classList.add('p2-wep-active');
            });

            audio.playWesternWhistle();
            this.updateWeaponsUI();
            this.updateShopUI();
        });

        // QR Code button and modal listeners
        const qrToggleBtn = document.getElementById('qr-toggle-btn');
        if (qrToggleBtn) {
            qrToggleBtn.addEventListener('click', () => {
                this.showQRCode();
                audio.playWesternWhistle();
            });
        }

        const qrModalClose = document.getElementById('qr-modal-close');
        if (qrModalClose) {
            qrModalClose.addEventListener('click', () => {
                this.closeQRCode();
                audio.playRicochet();
            });
        }

        const qrModal = document.getElementById('qr-modal');
        if (qrModal) {
            qrModal.addEventListener('click', (e) => {
                if (e.target === qrModal) {
                    this.closeQRCode();
                    audio.playRicochet();
                }
            });
        }

        const qrCopyBtn = document.getElementById('qr-copy-btn');
        const qrLinkInput = document.getElementById('qr-link-input');
        if (qrCopyBtn && qrLinkInput) {
            qrCopyBtn.addEventListener('click', () => {
                qrLinkInput.select();
                qrLinkInput.setSelectionRange(0, 99999);
                try {
                    navigator.clipboard.writeText(qrLinkInput.value).then(() => {
                        qrCopyBtn.textContent = this.t('qr-copied');
                        qrCopyBtn.classList.remove('btn-gold');
                        qrCopyBtn.classList.add('btn-toggle-active');
                        audio.playCoinSound();
                        setTimeout(() => {
                            qrCopyBtn.textContent = this.t('qr-btn-copy');
                            qrCopyBtn.classList.remove('btn-toggle-active');
                            qrCopyBtn.classList.add('btn-gold');
                        }, 2000);
                    });
                } catch (err) {
                    document.execCommand('copy');
                    qrCopyBtn.textContent = this.t('qr-copied');
                    setTimeout(() => {
                        qrCopyBtn.textContent = this.t('qr-btn-copy');
                    }, 2000);
                }
            });
        }
    }

    showQRCode() {
        const qrModal = document.getElementById('qr-modal');
        const qrLinkInput = document.getElementById('qr-link-input');
        
        if (qrModal) {
            qrModal.classList.add('active');
            
            const currentURL = window.location.href;
            if (qrLinkInput) {
                qrLinkInput.value = currentURL;
            }
        }
    }

    closeQRCode() {
        const qrModal = document.getElementById('qr-modal');
        if (qrModal) {
            qrModal.classList.remove('active');
        }
    }

    updateShopUI() {
        document.getElementById('shop-coins-val').textContent = this.coins;

        // Render descriptions from templates so that the span IDs are present
        const hpDescContainer = document.getElementById('shop-hp-desc-container');
        hpDescContainer.innerHTML = this.t('shop-hp-desc', { val: `<span id="shop-hp-lvl">${this.hpUpgrades}</span>` }) + ` <span id="shop-hp-status" style="font-weight:bold; color:#ff9500;"></span>`;

        const doppelCountValContainer = document.getElementById('shop-doppel-count-container');
        doppelCountValContainer.innerHTML = this.t('shop-doppel-desc', { count: `<span id="shop-doppel-count-val">${this.doppelgangerCount}</span>` }) + ` <span id="shop-doppel-status"></span>`;

        const doppelLvlValContainer = document.getElementById('shop-doppel-lvl-container');
        const doppelHp = this.doppelgangerLvl > 0 ? (2 + this.doppelgangerLvl) : 3;
        const doppelCdr = this.doppelgangerLvl > 0 ? `${(this.doppelgangerLvl - 1) * 10}%` : '0%';
        doppelLvlValContainer.innerHTML = this.t('shop-doppel-hp-cdr', {
            hp: `<span id="shop-doppel-hp-val">${doppelHp}</span>`,
            cdr: `<span id="shop-doppel-cdr-val">${doppelCdr}</span>`,
            lvl: `<span id="shop-doppel-lvl-val">${this.doppelgangerLvl}</span>`
        });

        const laserDescContainer = document.getElementById('shop-laser-desc-container');
        laserDescContainer.innerHTML = this.t('shop-laser-desc', { lvl: `<span id="shop-laser-lvl">${this.lasergunLvl}</span>` }) + ` <span id="shop-laser-status"></span>`;

        const rapidDescContainer = document.getElementById('shop-rapid-desc-container');
        const rapidDmg = this.rapidLvl >= 4 ? 2 : 1;
        const rapidCd = 250 - (this.rapidLvl - 1) * 20;
        rapidDescContainer.innerHTML = this.t('shop-rapid-desc', {
            dmg: `<span id="shop-rapid-dmg">${rapidDmg}</span>`,
            cd: `<span id="shop-rapid-cd">${rapidCd}</span>`,
            lvl: `<span id="shop-rapid-lvl">${this.rapidLvl}</span>`
        });

        const heavyDescContainer = document.getElementById('shop-heavy-desc-container');
        const heavyDmg = this.heavyLvl >= 5 ? 4 : (this.heavyLvl >= 3 ? 3 : 2);
        const heavyCd = 1500 - (this.heavyLvl - 1) * 200;
        heavyDescContainer.innerHTML = this.t('shop-heavy-desc', {
            dmg: `<span id="shop-heavy-dmg">${heavyDmg}</span>`,
            cd: `<span id="shop-heavy-cd">${heavyCd}</span>`,
            lvl: `<span id="shop-heavy-lvl">${this.heavyLvl}</span>`
        });

        const bombDescContainer = document.getElementById('shop-bomb-desc-container');
        const bombDmg = this.bombLvl >= 5 ? 4 : (this.bombLvl >= 3 ? 3 : 2);
        const bombCd = 2000 - (this.bombLvl - 1) * 250;
        bombDescContainer.innerHTML = this.t('shop-bomb-desc', {
            dmg: `<span id="shop-bomb-dmg">${bombDmg}</span>`,
            cd: `<span id="shop-bomb-cd">${bombCd}</span>`,
            lvl: `<span id="shop-bomb-lvl">${this.bombLvl}</span>`
        });

        // Now find the buttons and set text / styles
        const buyHpBtn = document.getElementById('buy-hp-btn');
        const toggleHpBtn = document.getElementById('toggle-hp-btn');
        const hpStatus = document.getElementById('shop-hp-status');

        if (this.hpUpgrades > 0) {
            toggleHpBtn.classList.remove('hidden');
            if (this.hpActive) {
                toggleHpBtn.textContent = this.t('btn-deactivate-action');
                toggleHpBtn.className = 'btn btn-shop btn-toggle-active';
                hpStatus.textContent = this.t('status-active');
                hpStatus.style.color = '#2ecc71';
            } else {
                toggleHpBtn.textContent = this.t('btn-activate');
                toggleHpBtn.className = 'btn btn-shop btn-toggle-inactive';
                hpStatus.textContent = this.t('status-inactive');
                hpStatus.style.color = '#e74c3c';
            }
        } else {
            toggleHpBtn.classList.add('hidden');
            hpStatus.textContent = '';
        }
        
        if (this.hpUpgrades >= 10) {
            buyHpBtn.textContent = this.t('shop-max');
            buyHpBtn.disabled = true;
            buyHpBtn.style.opacity = '0.5';
            buyHpBtn.style.cursor = 'default';
        } else {
            const cost = 10 + this.hpUpgrades * 10;
            buyHpBtn.textContent = `${cost} 🪙`;
            buyHpBtn.disabled = false;
            buyHpBtn.style.opacity = '1';
            buyHpBtn.style.cursor = 'pointer';
        }

        // --- Doppelganger Count ---
        const doppelStatus = document.getElementById('shop-doppel-status');
        const buyDoppelCountBtn = document.getElementById('buy-doppel-count-btn');
        const toggleDoppelBtn = document.getElementById('toggle-doppel-btn');
        
        if (this.doppelgangerCount > 0) {
            toggleDoppelBtn.classList.remove('hidden');
            if (this.doppelgangerActive) {
                doppelStatus.textContent = this.t('status-active');
                doppelStatus.className = 'status-active';
                toggleDoppelBtn.textContent = this.t('btn-deactivate-action');
                toggleDoppelBtn.className = 'btn btn-shop btn-toggle-active';
            } else {
                doppelStatus.textContent = this.t('status-inactive');
                doppelStatus.className = 'status-inactive';
                toggleDoppelBtn.textContent = this.t('btn-activate');
                toggleDoppelBtn.className = 'btn btn-shop btn-toggle-inactive';
            }
        } else {
            doppelStatus.textContent = `(${this.t('status-locked')})`;
            doppelStatus.className = 'status-inactive';
            toggleDoppelBtn.classList.add('hidden');
        }

        if (this.doppelgangerCount >= 3) {
            buyDoppelCountBtn.textContent = this.t('shop-max');
            buyDoppelCountBtn.disabled = true;
            buyDoppelCountBtn.style.opacity = '0.5';
            buyDoppelCountBtn.style.cursor = 'default';
        } else {
            const cost = 30 + this.doppelgangerCount * 30;
            buyDoppelCountBtn.textContent = `${cost} 🪙`;
            buyDoppelCountBtn.disabled = false;
            buyDoppelCountBtn.style.opacity = '1';
            buyDoppelCountBtn.style.cursor = 'pointer';
        }

        // --- Doppelganger Level ---
        const buyDoppelLvlBtn = document.getElementById('buy-doppel-lvl-btn');
        if (this.doppelgangerLvl >= 5) {
            buyDoppelLvlBtn.textContent = this.t('shop-max');
            buyDoppelLvlBtn.disabled = true;
            buyDoppelLvlBtn.style.opacity = '0.5';
            buyDoppelLvlBtn.style.cursor = 'default';
        } else {
            const cost = 30 + this.doppelgangerLvl * 10;
            buyDoppelLvlBtn.textContent = `${cost} 🪙`;
            buyDoppelLvlBtn.disabled = false;
            buyDoppelLvlBtn.style.opacity = '1';
            buyDoppelLvlBtn.style.cursor = 'pointer';
        }

        // --- Lasergun ---
        const laserStatus = document.getElementById('shop-laser-status');
        const buyLaserBtn = document.getElementById('buy-laser-btn');
        if (this.lasergunLvl > 0) {
            laserStatus.textContent = this.t('status-unlocked', { lvl: this.lasergunLvl });
            laserStatus.className = 'status-active';
        } else {
            laserStatus.textContent = this.t('status-locked');
            laserStatus.className = 'status-inactive';
        }

        if (this.lasergunLvl >= 5) {
            buyLaserBtn.textContent = this.t('shop-max');
            buyLaserBtn.disabled = true;
            buyLaserBtn.style.opacity = '0.5';
            buyLaserBtn.style.cursor = 'default';
        } else {
            const cost = 50 + this.lasergunLvl * 10;
            buyLaserBtn.textContent = `${cost} 🪙`;
            buyLaserBtn.disabled = false;
            buyLaserBtn.style.opacity = '1';
            buyLaserBtn.style.cursor = 'pointer';
        }

        // --- Weapons (Max handling) ---
        const buyRapidBtn = document.getElementById('buy-rapid-btn');
        if (this.rapidLvl >= 5) {
            buyRapidBtn.textContent = this.t('shop-max');
            buyRapidBtn.disabled = true;
            buyRapidBtn.style.opacity = '0.5';
            buyRapidBtn.style.cursor = 'default';
        } else {
            const cost = this.rapidLvl * 10;
            buyRapidBtn.textContent = `${cost} 🪙`;
            buyRapidBtn.disabled = false;
            buyRapidBtn.style.opacity = '1';
            buyRapidBtn.style.cursor = 'pointer';
        }

        const buyHeavyBtn = document.getElementById('buy-heavy-btn');
        if (this.heavyLvl >= 5) {
            buyHeavyBtn.textContent = this.t('shop-max');
            buyHeavyBtn.disabled = true;
            buyHeavyBtn.style.opacity = '0.5';
            buyHeavyBtn.style.cursor = 'default';
        } else {
            const cost = this.heavyLvl * 10;
            buyHeavyBtn.textContent = `${cost} 🪙`;
            buyHeavyBtn.disabled = false;
            buyHeavyBtn.style.opacity = '1';
            buyHeavyBtn.style.cursor = 'pointer';
        }

        const buyBombBtn = document.getElementById('buy-bomb-btn');
        if (this.bombLvl >= 5) {
            buyBombBtn.textContent = this.t('shop-max');
            buyBombBtn.disabled = true;
            buyBombBtn.style.opacity = '0.5';
            buyBombBtn.style.cursor = 'default';
        } else {
            const cost = this.bombLvl * 10;
            buyBombBtn.textContent = `${cost} 🪙`;
            buyBombBtn.disabled = false;
            buyBombBtn.style.opacity = '1';
            buyBombBtn.style.cursor = 'pointer';
        }

        this.updatePrestigeUI();
    }

    updateWeaponsUI() {
        const p1Laser = document.getElementById('p1-wep-laser');
        const p2Laser = document.getElementById('p2-wep-laser');
        if (p1Laser && p2Laser) {
            if (this.lasergunUnlocked) {
                p1Laser.disabled = false;
                p1Laser.querySelector('.wep-name').textContent = this.t('wep-laser-unlocked');
                p2Laser.disabled = false;
                p2Laser.querySelector('.wep-name').textContent = this.t('wep-laser-unlocked');
            } else {
                p1Laser.disabled = true;
                p1Laser.querySelector('.wep-name').textContent = this.t('wep-laser-locked');
                p2Laser.disabled = true;
                p2Laser.querySelector('.wep-name').textContent = this.t('wep-laser-locked');
                
                if (this.p1Weapon === 'laser') {
                    this.p1Weapon = 'rapid';
                    document.querySelectorAll('.weapon-btn[data-player="p1"]').forEach(b => b.classList.remove('p1-wep-active'));
                    document.querySelector('.weapon-btn[data-player="p1"][data-weapon="rapid"]').classList.add('p1-wep-active');
                }
                if (this.p2Weapon === 'laser') {
                    this.p2Weapon = 'rapid';
                    document.querySelectorAll('.weapon-btn[data-player="p2"]').forEach(b => b.classList.remove('p2-wep-active'));
                    document.querySelector('.weapon-btn[data-player="p2"][data-weapon="rapid"]').classList.add('p2-wep-active');
                }
            }
        }

        // Dynamically update Player 1's weapon points display with actual upgraded damage values
        const ptsUnit = this.currentLanguage === 'chinese' ? ' 分' : ' Pkt';
        
        const p1RapidPts = document.querySelector('.weapon-btn[data-player="p1"][data-weapon="rapid"] .wep-pts');
        if (p1RapidPts) {
            const rapidDmg = this.rapidLvl >= 4 ? 2 : 1;
            p1RapidPts.textContent = `${rapidDmg}${ptsUnit}`;
        }
        
        const p1HeavyPts = document.querySelector('.weapon-btn[data-player="p1"][data-weapon="heavy"] .wep-pts');
        if (p1HeavyPts) {
            const heavyDmg = this.heavyLvl >= 5 ? 4 : (this.heavyLvl >= 3 ? 3 : 2);
            p1HeavyPts.textContent = `${heavyDmg}${ptsUnit}`;
        }
        
        const p1BombPts = document.querySelector('.weapon-btn[data-player="p1"][data-weapon="bomb"] .wep-pts');
        if (p1BombPts) {
            const bombDmg = this.bombLvl >= 5 ? 4 : (this.bombLvl >= 3 ? 3 : 2);
            p1BombPts.textContent = `${bombDmg}${ptsUnit}`;
        }
        
        const p1LaserPts = document.querySelector('.weapon-btn[data-player="p1"][data-weapon="laser"] .wep-pts');
        if (p1LaserPts) {
            const laserDmg = this.lasergunLvl >= 5 ? 5 : (this.lasergunLvl >= 3 ? 4 : 3);
            p1LaserPts.textContent = `${laserDmg}${ptsUnit}`;
        }
        this.forceRepaint();
    }

    updatePrestigeUI() {
        const prestigePanel = document.getElementById('prestige-panel');
        const hasEverything = this.hpUpgrades >= 10 && this.doppelgangerCount >= 3 && this.doppelgangerLvl >= 5 && this.lasergunLvl >= 5 && this.rapidLvl >= 5 && this.heavyLvl >= 5 && this.bombLvl >= 5;
        
        if (hasEverything) {
            prestigePanel.classList.remove('hidden');
            if (!this.lastPrestigeChoiceTime) {
                this.lastPrestigeChoiceTime = Date.now();
                localStorage.setItem('wild_west_prestige_time', this.lastPrestigeChoiceTime);
            }
            this.updatePrestigeTimer();
        } else {
            prestigePanel.classList.add('hidden');
        }
    }

    updatePrestigeTimer() {
        if (!this.lastPrestigeChoiceTime) return;
        const elapsed = Date.now() - this.lastPrestigeChoiceTime;
        const totalDuration = 10 * 60 * 1000; // 10 minutes in ms
        const remaining = Math.max(0, totalDuration - elapsed);

        const keepBtn = document.getElementById('prestige-keep-btn');
        const resetBtn = document.getElementById('prestige-reset-btn');
        const timerEl = document.getElementById('prestige-timer');

        if (remaining <= 0) {
            timerEl.textContent = this.t('prestige-timer-choose');
            timerEl.style.color = "#2ecc71";
            keepBtn.disabled = false;
            resetBtn.disabled = false;
        } else {
            const secondsTotal = Math.floor(remaining / 1000);
            const minutes = Math.floor(secondsTotal / 60);
            const seconds = secondsTotal % 60;
            timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            timerEl.style.color = "#ff9500";
            keepBtn.disabled = true;
            resetBtn.disabled = true;
        }
    }

    initInput() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            if (e.key.length === 1) {
                this.keys[e.key.toLowerCase()] = true;
                this.keys[e.key.toUpperCase()] = true;
            }
            
            // Prevent scrolling on space / arrow keys during play
            if (this.state === 'playing' && [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
            }
            if (e.key === 'Escape') {
                const qrModal = document.getElementById('qr-modal');
                if (qrModal && qrModal.classList.contains('active')) {
                    this.closeQRCode();
                    audio.playRicochet();
                    e.preventDefault();
                } else if (this.state === 'playing') {
                    this.togglePause();
                }
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
            if (e.key.length === 1) {
                this.keys[e.key.toLowerCase()] = false;
                this.keys[e.key.toUpperCase()] = false;
            }
        });

        window.addEventListener('blur', () => {
            this.keys = {};
        });

        // Touch events for mobile/touch screen joysticks
        const gameScreen = document.getElementById('game-screen');
        
        gameScreen.addEventListener('touchstart', (e) => {
            if (this.state !== 'playing') return;
            
            // Ignore touches on HUD/menu buttons (e.g., Pause, Mute, Exit)
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;

            const rect = gameScreen.getBoundingClientRect();

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const touchX = touch.clientX - rect.left;
                const touchY = touch.clientY - rect.top;

                // Left half of screen: Movement Joystick
                if (touchX < rect.width / 2 && this.moveTouchId === null) {
                    this.moveTouchId = touch.identifier;
                    this.moveBaseX = touchX;
                    this.moveBaseY = touchY;
                    
                    const moveJoy = document.getElementById('joystick-move');
                    if (moveJoy) {
                        moveJoy.style.left = `${touchX}px`;
                        moveJoy.style.top = `${touchY}px`;
                        moveJoy.style.display = 'block';
                        const knob = moveJoy.querySelector('.joystick-knob');
                        if (knob) knob.style.transform = 'translate(-50%, -50%)';
                        setTimeout(() => moveJoy.classList.add('active'), 10);
                    }
                    this.joystickMove = { x: 0, y: 0, active: true };
                }
                // Right half of screen: Aiming/Shooting Joystick
                else if (touchX >= rect.width / 2 && this.aimTouchId === null) {
                    this.aimTouchId = touch.identifier;
                    this.aimBaseX = touchX;
                    this.aimBaseY = touchY;
                    
                    const aimJoy = document.getElementById('joystick-aim');
                    if (aimJoy) {
                        aimJoy.style.left = `${touchX}px`;
                        aimJoy.style.top = `${touchY}px`;
                        aimJoy.style.display = 'block';
                        const knob = aimJoy.querySelector('.joystick-knob');
                        if (knob) knob.style.transform = 'translate(-50%, -50%)';
                        setTimeout(() => aimJoy.classList.add('active'), 10);
                    }
                    this.joystickAim = { x: 0, y: 0, angle: this.player1 ? this.player1.angle : 0, dist: 0, active: true };
                }
            }
        }, { passive: false });

        // Listen on window for touchmove/touchend to capture drags/releases off the edge of gameScreen
        window.addEventListener('touchmove', (e) => {
            if (this.state !== 'playing') return;
            
            // Only prevent default if we are actively tracking a joystick touch
            if (this.moveTouchId !== null || this.aimTouchId !== null) {
                e.preventDefault();
            }

            const rect = gameScreen.getBoundingClientRect();

            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const maxR = 50; // Max drag radius in pixels

                const touchX = touch.clientX - rect.left;
                const touchY = touch.clientY - rect.top;

                if (touch.identifier === this.moveTouchId) {
                    let dx = touchX - this.moveBaseX;
                    let dy = touchY - this.moveBaseY;
                    let dist = Math.hypot(dx, dy);
                    
                    if (dist > maxR) {
                        dx = (dx / dist) * maxR;
                        dy = (dy / dist) * maxR;
                        dist = maxR;
                    }
                    
                    const moveJoy = document.getElementById('joystick-move');
                    if (moveJoy) {
                        const knob = moveJoy.querySelector('.joystick-knob');
                        if (knob) {
                            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                        }
                    }
                    this.joystickMove = { x: dx / maxR, y: dy / maxR, active: true };
                }
                else if (touch.identifier === this.aimTouchId) {
                    let dx = touchX - this.aimBaseX;
                    let dy = touchY - this.aimBaseY;
                    let dist = Math.hypot(dx, dy);
                    
                    if (dist > maxR) {
                        dx = (dx / dist) * maxR;
                        dy = (dy / dist) * maxR;
                        dist = maxR;
                    }
                    
                    const aimJoy = document.getElementById('joystick-aim');
                    if (aimJoy) {
                        const knob = aimJoy.querySelector('.joystick-knob');
                        if (knob) {
                            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
                        }
                    }
                    
                    const angle = Math.atan2(dy, dx);
                    this.joystickAim = { x: dx / maxR, y: dy / maxR, angle: angle, dist: dist / maxR, active: true };
                    
                    // Update player aiming angle immediately
                    if (this.player1 && this.player1.health > 0) {
                        this.player1.angle = angle;
                    }
                }
            }
        }, { passive: false });

        const endTouchHandler = (e) => {
            // Releasing touches should always work to avoid stuck inputs (even if state changes to pause/gameover)
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];

                if (touch.identifier === this.moveTouchId) {
                    this.moveTouchId = null;
                    const moveJoy = document.getElementById('joystick-move');
                    if (moveJoy) {
                        moveJoy.classList.remove('active');
                        setTimeout(() => {
                            if (this.moveTouchId === null) moveJoy.style.display = 'none';
                        }, 150);
                    }
                    this.joystickMove = { x: 0, y: 0, active: false };
                }
                else if (touch.identifier === this.aimTouchId) {
                    // Shoot checking on release
                    if (this.joystickAim.active && this.player1 && this.player1.health > 0) {
                        if (this.joystickAim.dist > 0.2) {
                            // Fired in drag direction
                            this.player1.shoot(this);
                        } else {
                            // Quick tap: Auto-aim at the nearest active opponent (player2)
                            if (this.player2 && this.player2.health > 0) {
                                const angle = Math.atan2(this.player2.y - this.player1.y, this.player2.x - this.player1.x);
                                this.player1.angle = angle;
                                this.player1.shoot(this);
                            }
                        }
                    }
                    
                    this.aimTouchId = null;
                    const aimJoy = document.getElementById('joystick-aim');
                    if (aimJoy) {
                        aimJoy.classList.remove('active');
                        setTimeout(() => {
                            if (this.aimTouchId === null) aimJoy.style.display = 'none';
                        }, 150);
                    }
                    this.joystickAim = { x: 0, y: 0, angle: 0, dist: 0, active: false };
                }
            }
        };

        window.addEventListener('touchend', endTouchHandler, { passive: true });
        window.addEventListener('touchcancel', endTouchHandler, { passive: true });

        // Prevent iOS Safari double-tap to zoom on gameplay screen
        let lastTouchEnd = 0;
        gameScreen.addEventListener('touchend', (e) => {
            if (this.state !== 'playing') return;
            if (e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('#hud')) return;

            const now = Date.now();
            if (now - lastTouchEnd <= 300) {
                e.preventDefault(); // blocks double-tap zoom gesture
            }
            lastTouchEnd = now;
        }, { passive: false });

        this.canvas.addEventListener('dblclick', (e) => {
            e.preventDefault();
        });

        // Trigger repaint on focus/visibility change to keep buttons fully rendered
        window.addEventListener('focus', () => this.forceRepaint());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.forceRepaint();
            }
        });

        window.focus();
    }

    resetJoystickState() {
        this.moveTouchId = null;
        this.aimTouchId = null;
        this.joystickMove = { x: 0, y: 0, active: false };
        this.joystickAim = { x: 0, y: 0, angle: 0, dist: 0, active: false };
        
        const moveJoy = document.getElementById('joystick-move');
        const aimJoy = document.getElementById('joystick-aim');
        if (moveJoy) {
            moveJoy.classList.remove('active');
            moveJoy.style.display = 'none';
        }
        if (aimJoy) {
            aimJoy.classList.remove('active');
            aimJoy.style.display = 'none';
        }
    }

    createMenuDust() {
        this.menuDust = [];
        for (let i = 0; i < 40; i++) {
            this.menuDust.push({
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
                vx: 0.5 + Math.random() * 1.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: 1 + Math.random() * 2,
                alpha: 0.1 + Math.random() * 0.4
            });
        }
    }

    startMenuLoop() {
        let lastTickTime = Date.now();
        const tick = () => {
            if (this.state !== 'menu') return;

            this.menuDust.forEach(p => {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x > window.innerWidth) {
                    p.x = -10;
                    p.y = Math.random() * window.innerHeight;
                }
            });

            const now = Date.now();
            if (now - lastTickTime >= 1000) {
                lastTickTime = now;
                this.updatePrestigeTimer();
            }
            
            requestAnimationFrame(tick);
        };
        tick();
    }

    startGame() {
        audio.init();
        audio.playWesternWhistle();
        audio.startBGM(); // Start Spaghetti Western loop!

        this.resetJoystickState();
        window.scrollTo(0, 0); // Reset scroll position to top
        this.state = 'playing';
        if (this.isTouchDevice) {
            document.body.classList.add('touch-device');
            document.documentElement.classList.add('touch-device');
        } else {
            document.body.classList.remove('touch-device');
            document.documentElement.classList.remove('touch-device');
        }

        // Add class to lock body scroll only during gameplay
        document.body.classList.add('game-playing');
        document.documentElement.classList.add('game-playing');

        // Add classes for game mode styling
        if (this.mode === 'pvp') {
            document.body.classList.add('mode-pvp');
            document.body.classList.remove('mode-pve');
        } else {
            document.body.classList.add('mode-pve');
            document.body.classList.remove('mode-pvp');
        }
        this.bullets = [];
        this.obstacles = [];
        this.tumbleweeds = [];
        this.groundSpikes = [];
        this.particles = [];
        
        this.sheriffActive = false;
        this.sheriffTimer = 0;

        // Wind initialization
        this.wind = 0;
        this.currentWind = 0;
        this.windLines = [];
        this.tumbleweedSpawnTimer = 100;
        this.spikeSpawnTimer = 30 + Math.random() * 60;

        // Reset HUD displays
        document.getElementById('main-menu').classList.remove('active');
        document.getElementById('game-over-screen').classList.remove('active');
        document.getElementById('pause-screen').classList.remove('active');
        document.getElementById('game-screen').classList.add('active');
        document.getElementById('coins-reward-banner').classList.add('hidden');
        
        // Hide QR container during play
        const qrContainer = document.getElementById('qr-container');
        if (qrContainer) {
            qrContainer.classList.add('hidden');
        }
        // Load entered names and update HUD
        const p1Input = document.getElementById('p1-name-input');
        const p2Input = document.getElementById('p2-name-input');
        
        const defaultP1 = this.currentLanguage === 'chinese' ? '玩家 1' : 'Spieler 1';
        const defaultP2 = this.currentLanguage === 'chinese' ? '玩家 2' : 'Spieler 2';
        const defaultP2PvE = this.currentLanguage === 'chinese' ? '强盗' : 'Bandit';

        if (p1Input) {
            this.p1Name = p1Input.value.trim() || defaultP1;
        }
        if (p2Input) {
            if (this.mode === 'pvp') {
                this.p2Name = p2Input.value.trim() || defaultP2;
            } else {
                this.p2NamePvE = p2Input.value.trim() || defaultP2PvE;
            }
        }

        document.getElementById('p1-label-text').textContent = `${this.p1Name}${this.t('suffix-black')}`;
        if (this.mode === 'pvp') {
            document.getElementById('p2-label-text').textContent = `${this.p2Name}${this.t('suffix-white')}`;
        } else {
            document.getElementById('p2-label-text').textContent = `${this.p2NamePvE}${this.t('suffix-ki')}`;
        }

        this.setupLevel();

        // Spawn Cowboys: P1 is Black, P2/AI is White
        this.player1 = new Cowboy(120, this.canvas.height / 2 + 30, 'player1', this.p1Weapon);
        this.player1.maxHealth = 5 + (this.hpActive ? this.hpUpgrades : 0);
        this.player1.health = this.player1.maxHealth;
        
        if (this.mode === 'pvp') {
            this.player2 = new Cowboy(this.canvas.width - 120, this.canvas.height / 2 + 30, 'player2', this.p2Weapon);
        } else {
            // Level 10 KI boss utilizes the Lasergun for maximum lethality!
            const aiWeapon = this.aiDifficulty === 10 ? 'laser' : this.p2Weapon;
            this.player2 = new Cowboy(this.canvas.width - 120, this.canvas.height / 2 + 30, 'ai', aiWeapon);
        }

        // Spawn helper AI doppelgangers if unlocked, active & in single-player PvE mode
        this.helperAIs = [];
        if (this.mode === 'pve' && this.doppelgangerUnlocked && this.doppelgangerActive) {
            for (let i = 0; i < this.doppelgangerCount; i++) {
                const spawnY = 300 - (this.doppelgangerCount - 1) * 60 + i * 120;
                const helper = new Cowboy(100, spawnY, 'helper_ai', this.p1Weapon);
                helper.maxHealth = 2 + this.doppelgangerLvl; // Level 1: 3 HP, Level 5: 7 HP!
                helper.health = helper.maxHealth;
                this.helperAIs.push(helper);
            }
        }

        this.updateHUD();
        this.loop();
    }

    setupLevel() {
        const lvlName = document.getElementById('level-display-name');
        const windInd = document.getElementById('wind-indicator');

        this.obstacles = [];
        this.tumbleweeds = [];
        this.groundSpikes = [];
        this.spikeSpawnTimer = 30 + Math.random() * 60;

        switch(this.level) {
            case 1:
                lvlName.textContent = 'Level 1: Sunny Prairie';
                windInd.classList.add('hidden');
                this.wind = 0;
                this.spawnObstacle(350, this.canvas.height / 2 - 80, 'chest');
                this.spawnObstacle(850, this.canvas.height / 2 + 140, 'chest');
                this.spawnObstacle(400, this.canvas.height / 2 + 100, 'chest');
                this.spawnObstacle(800, this.canvas.height / 2 - 40, 'chest');
                break;
            case 2:
                lvlName.textContent = 'Level 2: Cactus Canyon';
                windInd.classList.add('hidden');
                this.wind = 0;
                this.spawnObstacle(350, this.canvas.height / 2 - 80, 'cactus');
                this.spawnObstacle(850, this.canvas.height / 2 + 140, 'cactus');
                this.spawnObstacle(300, this.canvas.height / 2 + 30, 'chest');
                this.spawnObstacle(900, this.canvas.height / 2 + 30, 'chest');
                this.spawnObstacle(420, this.canvas.height / 2 + 120, 'cactus');
                this.spawnObstacle(780, this.canvas.height / 2 - 60, 'cactus');
                break;
            case 3:
                lvlName.textContent = 'Level 3: Windy Valley';
                windInd.classList.remove('hidden');
                this.wind = (Math.random() > 0.5 ? 1 : -1) * (4 + Math.random() * 5);
                this.spawnObstacle(350, this.canvas.height / 2 - 40, 'cactus');
                this.spawnObstacle(850, this.canvas.height / 2 + 100, 'cactus');
                this.spawnObstacle(400, this.canvas.height / 2 + 30, 'chest');
                this.spawnObstacle(800, this.canvas.height / 2 - 80, 'chest');
                this.spawnObstacle(320, this.canvas.height / 2 + 140, 'chest');
                break;
            case 4:
                lvlName.textContent = 'Level 4: Dynamite Junction';
                windInd.classList.add('hidden');
                this.wind = 0;
                this.spawnObstacle(300, this.canvas.height / 2 + 30, 'tnt');
                this.spawnObstacle(900, this.canvas.height / 2 + 30, 'tnt');
                this.spawnObstacle(380, this.canvas.height / 2 - 70, 'cactus');
                this.spawnObstacle(820, this.canvas.height / 2 + 130, 'cactus');
                this.spawnObstacle(250, this.canvas.height / 2 + 110, 'chest');
                this.spawnObstacle(950, this.canvas.height / 2 - 50, 'chest');
                this.spawnObstacle(400, this.canvas.height / 2 - 10, 'chest');
                this.spawnObstacle(800, this.canvas.height / 2 + 70, 'chest');
                this.spawnObstacle(200, this.canvas.height / 2 - 20, 'tnt');
                this.spawnObstacle(1000, this.canvas.height / 2 + 80, 'tnt');
                break;
            case 5:
                lvlName.textContent = 'Level 5: Tombstone Showdown';
                windInd.classList.remove('hidden');
                this.wind = (Math.random() > 0.5 ? 1 : -1) * (6 + Math.random() * 6);
                
                this.spawnObstacle(350, this.canvas.height / 2 - 120, 'tnt');
                this.spawnObstacle(850, this.canvas.height / 2 + 180, 'tnt');
                this.spawnObstacle(300, this.canvas.height / 2 + 30, 'chest');
                this.spawnObstacle(900, this.canvas.height / 2 + 30, 'chest');
                this.spawnObstacle(400, this.canvas.height / 2 - 60, 'chest');
                this.spawnObstacle(800, this.canvas.height / 2 + 120, 'chest');
                this.spawnObstacle(450, this.canvas.height / 2 + 30, 'fence');
                this.spawnObstacle(750, this.canvas.height / 2 + 30, 'fence');
                break;
            case 6:
                lvlName.textContent = 'Level 6: Desert Fortress';
                windInd.classList.add('hidden');
                this.wind = 0;
                this.spawnObstacle(300, this.canvas.height / 2 + 30, 'fence');
                this.spawnObstacle(900, this.canvas.height / 2 + 30, 'fence');
                this.spawnObstacle(200, this.canvas.height / 2 - 60, 'chest');
                this.spawnObstacle(1000, this.canvas.height / 2 + 120, 'chest');
                this.spawnObstacle(400, this.canvas.height / 2 + 120, 'chest');
                this.spawnObstacle(800, this.canvas.height / 2 - 60, 'chest');
                this.spawnObstacle(350, this.canvas.height / 2 + 120, 'fence');
                this.spawnObstacle(850, this.canvas.height / 2 - 60, 'fence');
                break;
            case 7:
                lvlName.textContent = 'Level 7: Windstorm Ruins';
                windInd.classList.remove('hidden');
                this.wind = (Math.random() > 0.5 ? 1 : -1) * (8 + Math.random() * 6);
                this.spawnObstacle(300, this.canvas.height / 2 - 80, 'cactus');
                this.spawnObstacle(900, this.canvas.height / 2 + 140, 'cactus');
                this.spawnObstacle(400, this.canvas.height / 2 + 30, 'fence');
                this.spawnObstacle(800, this.canvas.height / 2 + 30, 'fence');
                this.spawnObstacle(350, this.canvas.height / 2 + 30, 'chest');
                this.spawnObstacle(280, this.canvas.height / 2 - 20, 'chest');
                this.spawnObstacle(920, this.canvas.height / 2 + 80, 'chest');
                break;
            case 8:
                lvlName.textContent = 'Level 8: TNT Minefield';
                windInd.classList.add('hidden');
                this.wind = 0;
                this.spawnObstacle(300, this.canvas.height / 2 + 30, 'tnt');
                this.spawnObstacle(900, this.canvas.height / 2 + 30, 'tnt');
                this.spawnObstacle(350, this.canvas.height / 2 - 60, 'tnt');
                this.spawnObstacle(850, this.canvas.height / 2 + 120, 'tnt');
                this.spawnObstacle(400, this.canvas.height / 2 + 120, 'tnt');
                this.spawnObstacle(800, this.canvas.height / 2 - 60, 'tnt');
                this.spawnObstacle(250, this.canvas.height / 2 + 30, 'chest');
                this.spawnObstacle(950, this.canvas.height / 2 + 30, 'chest');
                break;
            case 9:
                lvlName.textContent = 'Level 9: Tumbleweed Alley';
                windInd.classList.add('hidden');
                this.wind = 0;
                this.spawnObstacle(350, this.canvas.height / 2 + 30, 'cactus');
                this.spawnObstacle(850, this.canvas.height / 2 + 30, 'cactus');
                this.spawnObstacle(400, this.canvas.height / 2 - 40, 'chest');
                this.spawnObstacle(800, this.canvas.height / 2 + 100, 'chest');
                this.spawnObstacle(250, this.canvas.height / 2 + 30, 'chest');
                this.spawnObstacle(950, this.canvas.height / 2 + 30, 'chest');
                break;
            case 10:
                lvlName.textContent = 'Level 10: Armageddon Duel';
                windInd.classList.remove('hidden');
                this.wind = (Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 8);
                this.spawnObstacle(350, this.canvas.height / 2 + 30, 'tnt');
                this.spawnObstacle(850, this.canvas.height / 2 + 30, 'tnt');
                this.spawnObstacle(400, this.canvas.height / 2 - 60, 'cactus');
                this.spawnObstacle(800, this.canvas.height / 2 + 120, 'cactus');
                this.spawnObstacle(300, this.canvas.height / 2 + 120, 'fence');
                this.spawnObstacle(900, this.canvas.height / 2 - 60, 'fence');
                this.spawnObstacle(450, this.canvas.height / 2 - 20, 'chest');
                this.spawnObstacle(750, this.canvas.height / 2 + 80, 'chest');
                this.spawnObstacle(250, this.canvas.height / 2 + 30, 'chest');
                this.spawnObstacle(950, this.canvas.height / 2 + 30, 'chest');
                break;
        }

        if (lvlName) {
            lvlName.textContent = `${this.t('level-label')} ${this.level}: ${this.t('level-' + this.level + '-name')}`;
        }

        this.windLines = [];
        if ([3, 5, 7, 10].includes(this.level)) {
            for (let i = 0; i < 15; i++) {
                this.windLines.push({
                    x: Math.random() * this.canvas.width,
                    y: 70 + Math.random() * (this.canvas.height - 110),
                    len: 40 + Math.random() * 80,
                    speed: 2 + Math.random() * 4
                });
            }
        }
    }

    spawnObstacle(x, y, type) {
        this.obstacles.push(new Obstacle(x, y, type));
    }

    triggerScreenShake(intensity = 8, frames = 15) {
        this.shakeTimer = frames;
        this.shakeIntensity = intensity;
    }

    togglePause() {
        if (this.state === 'playing') {
            this.state = 'paused';
            audio.stopBGM(); // Pause music
            document.getElementById('pause-screen').classList.add('active');
        } else if (this.state === 'paused') {
            this.state = 'playing';
            audio.startBGM(); // Resume music
            document.getElementById('pause-screen').classList.remove('active');
            this.loop();
        }
    }


    exitToMenu() {
        this.resetJoystickState();
        document.body.classList.remove('game-playing');
        document.documentElement.classList.remove('game-playing');
        document.body.classList.remove('mode-pvp');
        document.body.classList.remove('mode-pve');
        window.scrollTo(0, 0); // Reset scroll position to top
        this.state = 'menu';
        audio.stopBGM(); // Stop music
        document.getElementById('game-screen').classList.remove('active');
        document.getElementById('game-over-screen').classList.remove('active');
        document.getElementById('pause-screen').classList.remove('active');
        document.getElementById('main-menu').classList.add('active');
        
        // Show QR container in menu
        const qrContainer = document.getElementById('qr-container');
        if (qrContainer) {
            qrContainer.classList.remove('hidden');
        }
        
        // Remove active gameplay class to unlock menu scrolling on mobile devices
        document.body.classList.remove('game-playing');
        document.documentElement.classList.remove('game-playing');
        this.updateShopUI();
        this.createMenuDust();
        this.startMenuLoop();
        this.forceRepaint();
    }


    updateHUD() {
        const renderStars = (containerId, health, maxHealth = 5) => {
            const container = document.getElementById(containerId);
            container.innerHTML = '';
            for (let i = 0; i < maxHealth; i++) {
                const star = document.createElement('div');
                star.className = 'sheriff-star';
                if (i >= health) {
                    star.classList.add('lost');
                }
                container.appendChild(star);
            }
        };

        renderStars('p1-hearts', this.player1 ? this.player1.health : (5 + this.hpUpgrades), this.player1 ? this.player1.maxHealth : (5 + this.hpUpgrades));
        renderStars('p2-hearts', this.player2 ? this.player2.health : 5, this.player2 ? this.player2.maxHealth : 5);

        const windText = document.getElementById('wind-text');
        const windArrow = document.getElementById('wind-arrow');
        
        if ([3, 5, 7, 10].includes(this.level)) {
            const displaySpeed = Math.round(Math.abs(this.currentWind) * 8);
            windText.textContent = this.t('hud-wind', { speed: displaySpeed });
            if (this.currentWind > 0) {
                windArrow.style.transform = 'rotate(0deg)';
            } else {
                windArrow.style.transform = 'rotate(180deg)';
            }
        }
    }

    checkCollisions() {
        this.helperAIs.forEach(helper => {
            if (helper.health > 0) {
                this.checkEntityCollision(this.player1, helper);
                this.checkEntityCollision(this.player2, helper);
            }
        });
        this.checkEntityCollision(this.player1, this.player2);
    }

    isOnBridge(x, y) {
        const waterMinX = 540;
        const waterMaxX = 660;
        if (x >= waterMinX && x <= waterMaxX) {
            const onBridgeNorth = (y >= 180 && y <= 280);
            const onBridgeSouth = (y >= 520 && y <= 620);
            return onBridgeNorth || onBridgeSouth;
        }
        return false;
    }

    isInTunnel(x, y) {
        const tunnelMinX = 530;
        const tunnelMaxX = 670;
        return (x >= tunnelMinX && x <= tunnelMaxX && y >= 340 && y <= 460);
    }

    isPositionInWater(x, y) {
        const waterMinX = 550;
        const waterMaxX = 650;
        if (x >= waterMinX && x <= waterMaxX) {
            if (!this.isOnBridge(x, y) && !this.isInTunnel(x, y)) {
                return true;
            }
        }
        return false;
    }

    checkEntityCollision(c1, c2) {
        if (!c1 || !c2 || c1.health <= 0 || c2.health <= 0) return;
        const dist = Math.hypot(c1.x - c2.x, c1.y - c2.y);
        const minDist = c1.radius + c2.radius;
        if (dist < minDist) {
            const pushAngle = Math.atan2(c1.y - c2.y, c1.x - c2.x);
            const overlap = minDist - dist;
            c1.x += Math.cos(pushAngle) * overlap * 0.5;
            c1.y += Math.sin(pushAngle) * overlap * 0.5;
            c2.x -= Math.cos(pushAngle) * overlap * 0.5;
            c2.y -= Math.sin(pushAngle) * overlap * 0.5;
        }
    }

    spawnTumbleweeds() {
        if (![5, 9, 10].includes(this.level)) return;

        this.tumbleweedSpawnTimer--;
        if (this.tumbleweedSpawnTimer <= 0) {
            // Speed up spawn rate on level 9 (Tumbleweed Alley) and level 10
            const maxCooldown = this.level === 9 ? 120 : 240;
            const minCooldown = this.level === 9 ? 60 : 180;
            this.tumbleweedSpawnTimer = minCooldown + Math.random() * (maxCooldown - minCooldown);

            const fromLeft = Math.random() > 0.5;
            const x = fromLeft ? -20 : this.canvas.width + 20;
            const y = 100 + Math.random() * (this.canvas.height - 180);
            const vx = (fromLeft ? 1 : -1) * (1.5 + Math.random() * (this.level === 9 ? 3.0 : 2.0));
            const vy = (Math.random() - 0.5) * 0.8;

            this.tumbleweeds.push(new Tumbleweed(x, y, vx, vy));
        }
    }

    spawnGroundSpikes() {
        if (this.level < 6 || this.level > 10) return;

        this.spikeSpawnTimer--;
        if (this.spikeSpawnTimer <= 0) {
            // Spawn every 1.5 to 3.5 seconds
            const minCooldown = 90;
            const maxCooldown = 210;
            this.spikeSpawnTimer = minCooldown + Math.random() * (maxCooldown - minCooldown);

            let valid = false;
            let x = 0;
            let y = 0;
            let attempts = 0;

            while (!valid && attempts < 50) {
                attempts++;
                // Playfield boundaries: minX = 40, maxX = 1160, minY = 95, maxY = 760
                // We keep some safety margins so spikes spawn nicely on screen
                x = 100 + Math.random() * (this.canvas.width - 200);
                y = 130 + Math.random() * (this.canvas.height - 200);

                // Avoid water
                if (this.isPositionInWater(x, y)) continue;

                // Avoid existing obstacles
                let tooClose = false;
                for (let obs of this.obstacles) {
                    if (obs.destroyed) continue;
                    const dist = Math.hypot(x - obs.x, y - obs.y);
                    if (dist < obs.radius + 35) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                // Avoid other active ground spikes
                for (let spike of this.groundSpikes) {
                    if (spike.destroyed) continue;
                    const dist = Math.hypot(x - spike.x, y - spike.y);
                    if (dist < 50) {
                        tooClose = true;
                        break;
                    }
                }
                if (tooClose) continue;

                valid = true;
            }

            if (valid) {
                this.groundSpikes.push(new GroundSpike(x, y));
            }
        }
    }

    summonSheriff() {
        if (this.sheriffActive) return;

        this.sheriffActive = true;
        this.sheriffTimer = 110; // ~1.8 seconds duration
        this.sheriffX = this.canvas.width / 2;
        this.sheriffY = 120;

        audio.playSheriffWhistle();
    }

    spawnSheriffSparks(player) {
        if (!player || player.health <= 0) return;
        const angle = Math.atan2(player.y - this.sheriffY, player.x - this.sheriffX);
        const dist = Math.hypot(player.x - this.sheriffX, player.y - this.sheriffY);

        // Spawn tracer line of gold particles
        for (let i = 0; i < 12; i++) {
            const ratio = i / 12;
            const px = this.sheriffX + Math.cos(angle) * dist * ratio;
            const py = this.sheriffY + Math.sin(angle) * dist * ratio;

            this.particles.push({
                x: px,
                y: py,
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                radius: 1.5 + Math.random() * 2.0,
                color: '#ffd700',
                alpha: 1.0,
                decay: 0.05 + Math.random() * 0.05,
                gravity: 0
            });
        }
    }

    update() {
        this.currentWind += (this.wind - this.currentWind) * 0.05;

        if ([3, 5, 7, 10].includes(this.level)) {
            this.windTime++;
            if (this.windTime > 300) {
                this.windTime = 0;
                const maxWind = this.level === 10 ? 18 : this.level === 7 ? 14 : this.level === 5 ? 12 : 8;
                this.wind = (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * maxWind);
            }
        }

        // Update players & helper AIs
        this.player1.update(this.keys, this);
        this.player2.update(this.keys, this);
        this.helperAIs.forEach(helper => {
            if (helper.health > 0) {
                helper.update(this.keys, this);
            }
        });

        this.checkCollisions();

        // Update Sheriff action sequence (draw against helper AI too)
        if (this.sheriffActive) {
            this.sheriffTimer--;
            if (this.sheriffTimer === 55) {
                // Shoot all players!
                audio.playShoot();
                audio.playShoot(); // double gun boom!
                this.helperAIs.forEach(helper => {
                    if (helper.health > 0) {
                        audio.playShoot();
                    }
                });
                this.triggerScreenShake(12, 15);
                
                // Spawn tracers
                this.spawnSheriffSparks(this.player1);
                this.spawnSheriffSparks(this.player2);
                this.helperAIs.forEach(helper => {
                    if (helper.health > 0) {
                        this.spawnSheriffSparks(helper);
                    }
                });

                // Apply damage
                this.player1.takeDamage(1, this);
                this.player2.takeDamage(1, this);
                this.helperAIs.forEach(helper => {
                    if (helper.health > 0) {
                        helper.takeDamage(1, this);
                    }
                });
            }
            if (this.sheriffTimer <= 0) {
                this.sheriffActive = false;
            }
        }

        // Update bullets
        this.bullets.forEach(bullet => bullet.update(this));
        this.bullets = this.bullets.filter(bullet => !bullet.destroyed);

        // Update obstacles
        this.obstacles.forEach(obstacle => obstacle.update(this));
        this.obstacles = this.obstacles.filter(obstacle => !obstacle.destroyed);

        // Spawn and update Ground Spikes
        this.spawnGroundSpikes();
        this.groundSpikes.forEach(spike => spike.update(this));
        this.groundSpikes = this.groundSpikes.filter(spike => !spike.destroyed);

        // Spawn and update Tumbleweeds
        this.spawnTumbleweeds();
        this.tumbleweeds.forEach(t => t.update(this));
        this.tumbleweeds = this.tumbleweeds.filter(t => !t.destroyed);

        // Update particles
        this.particles.forEach(p => {
            p.x += p.vx;
            p.y += p.vy;
            if (p.gravity) p.vy += p.gravity;
            p.alpha -= p.decay;
        });
        this.particles = this.particles.filter(p => p.alpha > 0);

        // Update wind lines animation
        if ([3, 5, 7, 10].includes(this.level)) {
            const dir = this.currentWind > 0 ? 1 : -1;
            const wSpeed = Math.abs(this.currentWind) * 0.6;
            
            this.windLines.forEach(l => {
                l.x += dir * (l.speed + wSpeed);
                
                if (dir > 0 && l.x > this.canvas.width) {
                    l.x = -l.len;
                    l.y = 70 + Math.random() * (this.canvas.height - 110);
                } else if (dir < 0 && l.x + l.len < 0) {
                    l.x = this.canvas.width;
                    l.y = 70 + Math.random() * (this.canvas.height - 110);
                }
            });
        }

        this.updateHUD();

        if (this.player1.health <= 0 || this.player2.health <= 0) {
            this.endGame();
        }
    }

    endGame() {
        document.body.classList.remove('game-playing');
        document.documentElement.classList.remove('game-playing');
        document.body.classList.remove('mode-pvp');
        document.body.classList.remove('mode-pve');
        window.scrollTo(0, 0); // Reset scroll position to top
        this.state = 'gameover';
        audio.stopBGM(); // Stop music on match end
        
        const title = document.getElementById('victory-title');
        const subtitle = document.getElementById('victory-subtitle');

        const rewardBanner = document.getElementById('coins-reward-banner');

        if (this.player1.health <= 0 && this.player2.health <= 0) {
            title.textContent = this.t('go-draw-title');
            subtitle.textContent = this.t('go-draw-subtitle');
            if (rewardBanner) rewardBanner.classList.add('hidden');
        } else if (this.player1.health <= 0) {
            const oppName = this.mode === 'pvp' ? this.p2Name : this.p2NamePvE;
            title.textContent = this.t('go-victory-title', { name: oppName });
            subtitle.textContent = this.mode === 'pvp' ? this.t('go-p2-win-pvp-subtitle', { oppName, p1Name: this.p1Name }) : this.t('go-p2-win-ki-subtitle');
            audio.playHit();
            if (rewardBanner) rewardBanner.classList.add('hidden');
        } else {
            title.textContent = this.t('go-victory-title', { name: this.p1Name });
            subtitle.textContent = this.t('go-p1-win-subtitle');
            audio.playWinFanfare();

            // Earn coins if PvE mode
            if (this.mode === 'pve') {
                const coinsEarned = this.aiDifficulty >= 5 ? 5 : 3;
                this.coins += coinsEarned;
                localStorage.setItem('wild_west_coins', this.coins);
                
                if (rewardBanner) {
                    rewardBanner.innerHTML = this.t('go-reward-banner', { val: coinsEarned });
                    rewardBanner.classList.remove('hidden');
                }
                
                // Play a brief delayed coin sound effect for maximum dopamine
                setTimeout(() => {
                    audio.playCoinSound();
                }, 800);
            } else {
                if (rewardBanner) rewardBanner.classList.add('hidden');
            }
        }

        document.getElementById('game-screen').classList.remove('active');
        document.getElementById('game-over-screen').classList.add('active');
        this.forceRepaint();
    }


    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Screen Shake Translate
        this.ctx.save();
        if (this.shakeTimer > 0) {
            const dx = (Math.random() - 0.5) * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.shakeIntensity;
            this.ctx.translate(dx, dy);
            this.shakeTimer--;
        }

        // 1. Draw Sandy Arena floor
        this.ctx.fillStyle = '#dfb582';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. Draw Ground textures
        this.ctx.strokeStyle = '#d6a871';
        this.ctx.lineWidth = 4;
        
        this.ctx.beginPath();
        this.ctx.moveTo(30, 180); this.ctx.lineTo(this.canvas.width - 30, 190);
        this.ctx.moveTo(50, 320); this.ctx.lineTo(this.canvas.width - 50, 310);
        this.ctx.moveTo(80, 420); this.ctx.lineTo(this.canvas.width - 80, 435);
        this.ctx.stroke();

        // 2b. Draw River (Water stream) in the middle
        this.ctx.save();
        this.ctx.fillStyle = '#2c7a7b'; // Beautiful Wild West dark cyan/teal water
        this.ctx.fillRect(550, 65, 100, this.canvas.height - 80);
        
        // Water ripples
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        this.ctx.lineWidth = 2;
        for (let y = 80; y < this.canvas.height - 30; y += 40) {
            this.ctx.beginPath();
            this.ctx.moveTo(560 + Math.sin(y * 0.05) * 5, y);
            this.ctx.quadraticCurveTo(600, y + 10, 640 + Math.sin(y * 0.05) * 5, y);
            this.ctx.stroke();
        }
        this.ctx.restore();

        // 2c. Draw Bridges
        const drawSingleBridge = (ctx, yStart, height) => {
            ctx.save();
            ctx.shadowBlur = 5;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowOffsetY = 3;

            // Wooden base
            ctx.fillStyle = '#8c6239';
            ctx.strokeStyle = '#4e3621';
            ctx.lineWidth = 2;
            ctx.fillRect(540, yStart, 120, height);
            ctx.strokeRect(540, yStart, 120, height);

            // Wood planks
            ctx.strokeStyle = '#5c4028';
            ctx.lineWidth = 1.5;
            for (let x = 545; x <= 655; x += 10) {
                ctx.beginPath();
                ctx.moveTo(x, yStart);
                ctx.lineTo(x, yStart + height);
                ctx.stroke();
            }

            // Railings
            ctx.fillStyle = '#5c4028';
            ctx.fillRect(540, yStart - 4, 120, 6);
            ctx.strokeRect(540, yStart - 4, 120, 6);
            ctx.fillRect(540, yStart + height - 2, 120, 6);
            ctx.strokeRect(540, yStart + height - 2, 120, 6);
            ctx.restore();
        };
        drawSingleBridge(this.ctx, 180, 100);
        drawSingleBridge(this.ctx, 520, 100);

        // 2d. Draw Tunnel Floor
        this.ctx.fillStyle = '#3c2a1a'; // Dark dirt floor
        this.ctx.fillRect(530, 340, 140, 120);
        this.ctx.strokeStyle = '#1b120c';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(530, 340, 140, 120);

        // 3. Draw wind lines (under cowboys)
        if ([3, 5, 7, 10].includes(this.level)) {
            this.ctx.save();
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            this.ctx.lineWidth = 1.5;
            this.windLines.forEach(l => {
                this.ctx.beginPath();
                this.ctx.moveTo(l.x, l.y);
                this.ctx.lineTo(l.x + l.len, l.y);
                this.ctx.stroke();
            });
            this.ctx.restore();
        }

        // 3b. Draw ground spikes
        this.groundSpikes.forEach(s => s.draw(this.ctx));

        // 4. Draw obstacles
        this.obstacles.forEach(o => o.draw(this.ctx));

        // 5. Draw tumbleweeds
        this.tumbleweeds.forEach(t => t.draw(this.ctx));

        // 6. Draw Sheriff if active
        if (this.sheriffActive) {
            this.drawSheriff(this.ctx);
        }

        // 7. Draw players
        this.player1.draw(this.ctx);
        this.player2.draw(this.ctx);
        this.helperAIs.forEach(helper => {
            if (helper.health > 0) {
                helper.draw(this.ctx);
            }
        });

        // 8. Draw bullets
        this.bullets.forEach(b => b.draw(this.ctx));

        // 8b. Draw Tunnel Roof (Visually hides players and bullets)
        this.ctx.save();
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        this.ctx.shadowOffsetY = 5;

        // Roof structure
        this.ctx.fillStyle = '#4a2f1b'; // Dark wood logs
        this.ctx.fillRect(530, 340, 140, 120);

        // Roof planks / logs lines
        this.ctx.strokeStyle = '#27190e';
        this.ctx.lineWidth = 4;
        for (let y = 345; y <= 455; y += 15) {
            this.ctx.beginPath();
            this.ctx.moveTo(530, y);
            this.ctx.lineTo(670, y);
            this.ctx.stroke();
        }

        // Support arches at the entrances
        this.ctx.fillStyle = '#2c190d';
        this.ctx.fillRect(525, 335, 10, 130);
        this.ctx.strokeRect(525, 335, 10, 130);
        this.ctx.fillRect(665, 335, 10, 130);
        this.ctx.strokeRect(665, 335, 10, 130);
        this.ctx.restore();

        // 9. Draw particles
        this.particles.forEach(p => {
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });

        // 10. Draw Outer Wooden Fence
        this.drawBorderFence(this.ctx);

        this.ctx.restore();
    }

    drawSheriff(ctx) {
        ctx.save();
        ctx.translate(this.sheriffX, this.sheriffY);

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath();
        ctx.ellipse(0, 20, 16, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Boots
        ctx.fillStyle = '#3a2215';
        ctx.fillRect(-8, 10, 5, 10);
        ctx.fillRect(3, 10, 5, 10);

        // Gold Poncho/Body
        ctx.fillStyle = '#ffd700'; // shiny gold
        ctx.strokeStyle = '#8b7500';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-15, 14);
        ctx.quadraticCurveTo(0, 18, 16, 14);
        ctx.lineTo(11, -10);
        ctx.quadraticCurveTo(0, -6, -11, -10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Gold Badge (Sheriff Star) on chest
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(0, 0, 5, 5, 0, 0, Math.PI * 2);
        ctx.stroke();

        // Head
        ctx.fillStyle = '#ffdbac';
        ctx.beginPath();
        ctx.arc(0, -18, 8, 0, Math.PI * 2);
        ctx.fill();

        // Eye
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(-3, -19, 1.2, 0, Math.PI * 2);
        ctx.arc(3, -19, 1.2, 0, Math.PI * 2);
        ctx.fill();

        // Brown Hat
        ctx.fillStyle = '#8b521b';
        ctx.strokeStyle = '#4a2f1b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(0, -22, 16, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-7, -26);
        ctx.bezierCurveTo(-8, -34, 8, -34, 7, -26);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Gun arms
        ctx.strokeStyle = '#ffd700';
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        
        if (this.sheriffTimer > 55) {
            // preparing, hands on holsters
            ctx.beginPath();
            ctx.moveTo(-10, 0); ctx.lineTo(-15, 7);
            ctx.moveTo(10, 0); ctx.lineTo(15, 7);
            ctx.stroke();
        } else {
            // Draw Guns and Shooting at Players
            // Left arm
            ctx.beginPath();
            ctx.moveTo(-10, 0); ctx.lineTo(-24, -2);
            ctx.stroke();
            // Right arm
            ctx.beginPath();
            ctx.moveTo(10, 0); ctx.lineTo(24, -2);
            ctx.stroke();

            // Left Gun
            ctx.fillStyle = '#333';
            ctx.fillRect(-29, -4, 5, 3);
            ctx.fillRect(-27, -1, 2, 4);

            // Right Gun
            ctx.fillRect(24, -4, 5, 3);
            ctx.fillRect(25, -1, 2, 4);
            
            // Firing sparks
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(-32, -3, 6 + Math.random() * 4, 0, Math.PI * 2);
            ctx.arc(32, -3, 6 + Math.random() * 4, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    drawBorderFence(ctx) {
        ctx.save();
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = '#654321';
        ctx.strokeStyle = '#3d2511';
        ctx.lineWidth = 2.5;

        const topY = 65;
        const bottomY = this.canvas.height - 15;
        const leftX = 15;
        const rightX = this.canvas.width - 15;

        // Draw horizontal rails
        ctx.fillRect(leftX, topY + 4, rightX - leftX, 3);
        ctx.fillRect(leftX, topY + 12, rightX - leftX, 3);
        ctx.fillRect(leftX, bottomY - 14, rightX - leftX, 3);
        ctx.fillRect(leftX, bottomY - 6, rightX - leftX, 3);

        ctx.fillRect(leftX + 4, topY, 3, bottomY - topY);
        ctx.fillRect(leftX + 12, topY, 3, bottomY - topY);
        ctx.fillRect(rightX - 14, topY, 3, bottomY - topY);
        ctx.fillRect(rightX - 6, topY, 3, bottomY - topY);

        // Draw posts
        const postInterval = 60;
        for (let x = leftX; x <= rightX; x += postInterval) {
            ctx.fillRect(x - 4, topY, 8, 20);
            ctx.strokeRect(x - 4, topY, 8, 20);
            ctx.fillRect(x - 4, bottomY - 20, 8, 20);
            ctx.strokeRect(x - 4, bottomY - 20, 8, 20);
        }

        for (let y = topY; y <= bottomY; y += postInterval) {
            ctx.fillRect(leftX, y - 4, 20, 8);
            ctx.strokeRect(leftX, y - 4, 20, 8);
            ctx.fillRect(rightX - 20, y - 4, 20, 8);
            ctx.strokeRect(rightX - 20, y - 4, 20, 8);
        }

        ctx.restore();
    }

    loop() {
        if (this.state !== 'playing') return;

        this.update();
        this.draw();

        requestAnimationFrame(() => this.loop());
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
});
