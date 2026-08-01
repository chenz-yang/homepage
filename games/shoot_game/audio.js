// Web Audio API Synthesizer for retro/arcade Wild West sound effects
class AudioSynth {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.compressor = null;
        this.muted = false;
        this.bgmRequested = false;
        this.noiseBuffer = null;

        const unlock = () => {
            if (!this.ctx) {
                this.init();
            }
            if (this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
                this.ctx.resume().catch(e => console.warn("Failed to resume AudioContext on gesture:", e));
            }
        };

        const setupUnlock = () => {
            if (typeof window === 'undefined') return;
            window.addEventListener('click', unlock);
            window.addEventListener('touchstart', unlock);
            window.addEventListener('touchend', unlock);
            window.addEventListener('keydown', unlock);
            window.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible' && this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
                    this.ctx.resume().catch(e => console.warn("Failed to resume AudioContext on visibility:", e));
                }
            });
        };

        setupUnlock();
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                try {
                    this.ctx = new AudioCtx({ sampleRate: 48000 });
                } catch (e) {
                    this.ctx = new AudioCtx();
                }
            }
        }
        if (this.ctx && !this.compressor) {
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-6, this.ctx.currentTime);
            this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
            this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
            this.compressor.release.setValueAtTime(0.1, this.ctx.currentTime);
            this.compressor.connect(this.ctx.destination);
        }
        if (this.ctx && !this.masterGain) {
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.65, this.ctx.currentTime);
            this.masterGain.connect(this.compressor || this.ctx.destination);
        }
        if (this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
            this.ctx.resume().catch(e => {});
        }
    }

    getDestination() {
        this.init();
        return this.masterGain || this.ctx.destination;
    }

    // Dual-layer autoCleanup: onended + fallback timer to guarantee 100% node disconnection on iOS Safari
    autoCleanup(sourceNode, durationSec = 1.0, ...connectedNodes) {
        if (!sourceNode) return;
        let cleaned = false;

        const doClean = () => {
            if (cleaned) return;
            cleaned = true;
            try {
                sourceNode.disconnect();
            } catch (e) {}
            connectedNodes.forEach(node => {
                if (node && typeof node.disconnect === 'function') {
                    try {
                        node.disconnect();
                    } catch (e) {}
                }
            });
        };

        sourceNode.onended = doClean;
        // Fallback timer in case WebKit drops onended during heavy touch events
        const timeoutMs = Math.max(100, Math.ceil((durationSec + 0.15) * 1000));
        setTimeout(doClean, timeoutMs);
    }

    setMuted(muted) {
        this.muted = !!muted;
        if (this.ctx && this.masterGain) {
            this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.65, this.ctx.currentTime);
        }
        if (this.muted) {
            if (this.bgmInterval) {
                clearInterval(this.bgmInterval);
                this.bgmInterval = null;
            }
        } else {
            if (this.bgmRequested && !this.bgmInterval) {
                this.startBGM();
            }
        }
        return this.muted;
    }

    toggleMute() {
        return this.setMuted(!this.muted);
    }

    // Custom noise generator helper for gunshots and explosions
    createNoiseBuffer() {
        if (!this.ctx) return null;
        if (this.noiseBuffer && this.noiseBuffer.sampleRate === this.ctx.sampleRate) return this.noiseBuffer;
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buffer;
        return buffer;
    }

    playShoot() {
        if (this.muted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // 1. Transient Pop (Sine)
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

        oscGain.gain.setValueAtTime(0.0001, now);
        oscGain.gain.linearRampToValueAtTime(0.4, now + 0.003);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
        oscGain.gain.linearRampToValueAtTime(0, now + 0.15);

        osc.connect(oscGain);
        oscGain.connect(this.getDestination());

        // 2. White Noise Blast (Gun powder)
        const noise = ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1000, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.2);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.0001, now);
        noiseGain.gain.linearRampToValueAtTime(0.6, now + 0.005);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        noiseGain.gain.linearRampToValueAtTime(0, now + 0.3);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.getDestination());

        this.autoCleanup(osc, 0.15, oscGain);
        this.autoCleanup(noise, 0.3, noiseFilter, noiseGain);

        osc.start(now);
        osc.stop(now + 0.15);
        noise.start(now);
        noise.stop(now + 0.3);
    }

    playHeavyShoot() {
        if (this.muted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // 1. Deep Pop (Sine)
        const osc = ctx.createOscillator();
        const oscGain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.18);

        oscGain.gain.setValueAtTime(0.0001, now);
        oscGain.gain.linearRampToValueAtTime(0.8, now + 0.004);
        oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        oscGain.gain.linearRampToValueAtTime(0, now + 0.2);

        osc.connect(oscGain);
        oscGain.connect(this.getDestination());

        // 2. Deep Lowpass Noise Blast
        const noise = ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();

        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(600, now);
        noiseFilter.frequency.exponentialRampToValueAtTime(40, now + 0.45);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.0001, now);
        noiseGain.gain.linearRampToValueAtTime(0.8, now + 0.005);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        noiseGain.gain.linearRampToValueAtTime(0, now + 0.5);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.getDestination());

        this.autoCleanup(osc, 0.2, oscGain);
        this.autoCleanup(noise, 0.5, noiseFilter, noiseGain);

        osc.start(now);
        osc.stop(now + 0.2);
        noise.start(now);
        noise.stop(now + 0.5);
    }

    playHit() {
        if (this.muted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Low grunt sound + flesh impact noise
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.linearRampToValueAtTime(60, now + 0.15);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);

        // Lowpass filter to make it sound muffled
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.getDestination());

        this.autoCleanup(osc, 0.2, filter, gain);

        osc.start(now);
        osc.stop(now + 0.2);
    }

    playRicochet() {
        if (this.muted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Classic western "piiiing" sound
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 0.05);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.35);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.004);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        gain.gain.linearRampToValueAtTime(0, now + 0.4);

        const delay = ctx.createDelay();
        delay.delayTime.setValueAtTime(0.03, now);

        const feedback = ctx.createGain();
        feedback.gain.setValueAtTime(0.3, now);

        osc.connect(gain);
        gain.connect(this.getDestination());

        // Feed gain into delay loop for a slight echo
        gain.connect(delay);
        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(this.getDestination());

        this.autoCleanup(osc, 0.4, gain, delay, feedback);

        osc.start(now);
        osc.stop(now + 0.4);
    }

    playExplosion() {
        if (this.muted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // Deep booming noise
        const noise = ctx.createBufferSource();
        noise.buffer = this.createNoiseBuffer();

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, now);
        filter.frequency.exponentialRampToValueAtTime(20, now + 1.2);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(1.0, now + 0.01);
        gain.gain.linearRampToValueAtTime(0.7, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
        gain.gain.linearRampToValueAtTime(0, now + 1.6);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.getDestination());

        // Low rumbling bass synth
        const subOsc = ctx.createOscillator();
        const subGain = ctx.createGain();
        subOsc.type = 'sawtooth';
        subOsc.frequency.setValueAtTime(80, now);
        subOsc.frequency.linearRampToValueAtTime(30, now + 0.5);

        subGain.gain.setValueAtTime(0.0001, now);
        subGain.gain.linearRampToValueAtTime(0.6, now + 0.01);
        subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
        subGain.gain.linearRampToValueAtTime(0, now + 0.65);

        const subFilter = ctx.createBiquadFilter();
        subFilter.type = 'lowpass';
        subFilter.frequency.setValueAtTime(100, now);

        subOsc.connect(subFilter);
        subFilter.connect(subGain);
        subGain.connect(this.getDestination());

        this.autoCleanup(noise, 1.6, filter, gain);
        this.autoCleanup(subOsc, 0.65, subFilter, subGain);

        noise.start(now);
        noise.stop(now + 1.6);
        subOsc.start(now);
        subOsc.stop(now + 0.65);
    }

    playCoinSound() {
        if (this.muted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const notes = [987.77, 1318.51, 1567.98]; // B5, E6, G6 (classic arcade ding-ding-ding)
        notes.forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const timeOffset = i * 0.08;
            const startTime = now + timeOffset;
            const noteEndTime = timeOffset + 0.3;

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.linearRampToValueAtTime(0.18, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.3);
            gain.gain.linearRampToValueAtTime(0, startTime + 0.3);

            osc.connect(gain);
            gain.connect(this.getDestination());

            this.autoCleanup(osc, noteEndTime, gain);

            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });
    }

    // Melodic Western Motif: "The Good, the Bad and the Ugly" (simplified whistle)
    playWesternWhistle() {
        if (this.muted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const notes = [
            { note: 440, duration: 0.15 }, // A4
            { note: 587.33, duration: 0.15 }, // D5
            { note: 440, duration: 0.15 }, // A4
            { note: 349.23, duration: 0.3 }  // F4
        ];

        let timeOffset = 0;
        notes.forEach(item => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const startTime = now + timeOffset;
            const noteEndTime = timeOffset + item.duration;
            
            // Triangle + sine gives a whistly quality
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(item.note, startTime);
            
            // Add vibrato
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.frequency.setValueAtTime(8, startTime);
            lfoGain.gain.setValueAtTime(15, startTime); // 15 Hz modulation depth
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.linearRampToValueAtTime(0.2, startTime + 0.03);
            gain.gain.linearRampToValueAtTime(0.2, startTime + item.duration - 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + item.duration);
            gain.gain.linearRampToValueAtTime(0, startTime + item.duration);

            osc.connect(gain);
            gain.connect(this.getDestination());

            this.autoCleanup(osc, noteEndTime, gain, lfo, lfoGain);

            lfo.start(startTime);
            osc.start(startTime);
            
            lfo.stop(startTime + item.duration);
            osc.stop(startTime + item.duration);

            timeOffset += item.duration + 0.05;
        });
    }

    playSheriffWhistle() {
        if (this.muted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        // High pitch whistle trill
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.setValueAtTime(22, now); // Fast warble trill
        lfoGain.gain.setValueAtTime(150, now); // Frequency swing in Hz
        
        lfo.connect(lfoGain);
        lfoGain.connect(osc.frequency);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
        gain.gain.linearRampToValueAtTime(0.25, now + 0.45);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
        gain.gain.linearRampToValueAtTime(0, now + 0.6);

        osc.connect(gain);
        gain.connect(this.getDestination());

        this.autoCleanup(osc, 0.6, gain, lfo, lfoGain);

        lfo.start(now);
        osc.start(now);
        
        lfo.stop(now + 0.6);
        osc.stop(now + 0.6);
    }

    playChestOpen() {
        if (this.muted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const notes = [587.33, 739.99, 880.00, 1174.66]; // D5, F#5, A5, D6
        notes.forEach((freq, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const timeOffset = index * 0.08;
            const startTime = now + timeOffset;
            const noteEndTime = timeOffset + 0.3;
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.3);
            gain.gain.linearRampToValueAtTime(0, startTime + 0.3);

            osc.connect(gain);
            gain.connect(this.getDestination());

            this.autoCleanup(osc, noteEndTime, gain);

            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });
    }

    playSpike() {
        if (this.muted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        gain.gain.linearRampToValueAtTime(0, now + 0.16);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(700, now);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.getDestination());

        this.autoCleanup(osc, 0.16, filter, gain);

        osc.start(now);
        osc.stop(now + 0.16);
    }

    startBGM() {
        this.bgmRequested = true;
        if (this.muted) return;
        this.init();
        if (this.bgmInterval) return; // Already playing

        const ctx = this.ctx;
        let step = 0;
        const bpm = 120;
        const stepTime = 60 / bpm / 2; // 8th notes (0.25 seconds per step)
        let nextStepTime = ctx.currentTime + 0.1;

        const playStep = () => {
            const time = nextStepTime;

            if (!this.muted) {
                // 1. Acoustic Gallop Bassline (Root-Fifth in D Minor: D -> A)
                if (step % 4 === 0 || step % 4 === 2 || step % 4 === 3) {
                    const bassOsc = ctx.createOscillator();
                    const bassGain = ctx.createGain();
                    
                    bassOsc.type = 'triangle';
                    const freq = (step % 4 === 0) ? 73.42 : 110.00; // D2 or A2
                    bassOsc.frequency.setValueAtTime(freq, time);

                    bassGain.gain.setValueAtTime(0.0001, time);
                    bassGain.gain.linearRampToValueAtTime(0.20, time + 0.02);
                    bassGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
                    bassGain.gain.linearRampToValueAtTime(0, time + 0.22);

                    const filter = ctx.createBiquadFilter();
                    filter.type = 'lowpass';
                    filter.frequency.setValueAtTime(150, time);

                    bassOsc.connect(filter);
                    filter.connect(bassGain);
                    bassGain.connect(this.getDestination());

                    this.autoCleanup(bassOsc, 0.22, filter, bassGain);

                    bassOsc.start(time);
                    bassOsc.stop(time + 0.22);
                }

                // 2. Rimshot/Horse Hoof Percussion (Noise) on offbeats
                if (step % 2 === 1) {
                    const drum = ctx.createBufferSource();
                    drum.buffer = this.createNoiseBuffer();

                    const drumFilter = ctx.createBiquadFilter();
                    drumFilter.type = 'bandpass';
                    drumFilter.frequency.setValueAtTime(400, time);

                    const drumGain = ctx.createGain();
                    drumGain.gain.setValueAtTime(0.0001, time);
                    drumGain.gain.linearRampToValueAtTime(0.03, time + 0.004);
                    drumGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.08);
                    drumGain.gain.linearRampToValueAtTime(0, time + 0.08);

                    drum.connect(drumFilter);
                    drumFilter.connect(drumGain);
                    drumGain.connect(this.getDestination());

                    this.autoCleanup(drum, 0.08, drumFilter, drumGain);

                    drum.start(time);
                    drum.stop(time + 0.08);
                }

                // 3. Whistle Melody
                const melody = [
                    293.66, 0, 349.23, 0, 293.66, 0, 0, 0,
                    392.00, 0, 293.66, 0, 349.23, 0, 0, 0,
                    440.00, 0, 523.25, 0, 440.00, 0, 0, 0,
                    392.00, 349.23, 293.66, 0, 0, 0, 0, 0
                ];

                const noteFreq = melody[step % 32];
                if (noteFreq > 0) {
                    const whistle = ctx.createOscillator();
                    const whistleGain = ctx.createGain();

                    whistle.type = 'sine';
                    whistle.frequency.setValueAtTime(noteFreq * 1.5, time);

                    const lfo = ctx.createOscillator();
                    const lfoGain = ctx.createGain();
                    lfo.frequency.setValueAtTime(7.5, time);
                    lfoGain.gain.setValueAtTime(12, time);
                    
                    lfo.connect(lfoGain);
                    lfoGain.connect(whistle.frequency);

                    whistleGain.gain.setValueAtTime(0.0001, time);
                    whistleGain.gain.linearRampToValueAtTime(0.05, time + 0.05);
                    whistleGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.45);
                    whistleGain.gain.linearRampToValueAtTime(0, time + 0.45);

                    whistle.connect(whistleGain);
                    whistleGain.connect(this.getDestination());

                    this.autoCleanup(whistle, 0.45, whistleGain, lfo, lfoGain);

                    lfo.start(time);
                    whistle.start(time);
                    
                    lfo.stop(time + 0.45);
                    whistle.stop(time + 0.45);
                }
            }

            step++;
            nextStepTime += stepTime;
        };

        const scheduler = () => {
            if (nextStepTime < ctx.currentTime - 0.15) {
                nextStepTime = ctx.currentTime;
            }
            while (nextStepTime < ctx.currentTime + 0.1) {
                playStep();
            }
        };

        this.bgmInterval = setInterval(scheduler, 35);
    }

    stopBGM(explicitStop = false) {
        if (explicitStop) {
            this.bgmRequested = false;
        }
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
    }

    // Melodic fanfare when a player wins
    playWinFanfare() {
        if (this.muted) return;
        this.init();
        const ctx = this.ctx;
        const now = ctx.currentTime;

        const notes = [
            { note: 293.66, time: 0.0, type: 'sawtooth' }, // D4
            { note: 369.99, time: 0.15, type: 'sawtooth' }, // F#4
            { note: 440.00, time: 0.3, type: 'sawtooth' }, // A4
            { note: 587.33, time: 0.45, type: 'sawtooth' }, // D5
            { note: 739.99, time: 0.65, type: 'sawtooth' }  // F#5 (Long note)
        ];

        notes.forEach((item, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const startTime = now + item.time;
            
            osc.type = item.type;
            osc.frequency.setValueAtTime(item.note, startTime);
            
            const dur = (index === notes.length - 1) ? 1.0 : 0.3;
            const noteEndTime = item.time + dur;

            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.linearRampToValueAtTime(0.12, startTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
            gain.gain.linearRampToValueAtTime(0, startTime + dur);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1500, startTime);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.getDestination());

            this.autoCleanup(osc, noteEndTime, filter, gain);

            osc.start(startTime);
            osc.stop(startTime + dur);
        });
    }
}

export const audio = new AudioSynth();
export default audio;
