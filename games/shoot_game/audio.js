// Web Audio API Synthesizer for retro/arcade Wild West sound effects
class AudioSynth {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.noiseBuffer = null;

        const removeUnlock = () => {
            window.removeEventListener('click', unlock);
            window.removeEventListener('touchstart', unlock);
            window.removeEventListener('touchend', unlock);
        };

        const unlock = () => {
            try {
                if (!this.ctx) {
                    this.init();
                }
                if (this.ctx && (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted')) {
                    this.ctx.resume().catch(e => console.warn("Failed to resume AudioContext on gesture:", e));
                }
                if (this.ctx && this.ctx.state === 'running') {
                    removeUnlock();
                }
            } catch(e) {
                console.warn("Unlock audio failed:", e);
            }
        };

        const setupUnlock = () => {
            window.addEventListener('click', unlock);
            window.addEventListener('touchstart', unlock);
            window.addEventListener('touchend', unlock);
        };

        if (typeof window !== 'undefined') {
            setupUnlock();
        }
    }

    init() {
        if (!this.ctx) {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    this.ctx = new AudioCtx();
                }
            } catch (e) {
                console.warn("AudioContext init failed:", e);
                this.ctx = null;
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            try {
                this.ctx.resume().catch(() => {});
            } catch(e) {}
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        return this.muted;
    }

    // Custom noise generator helper for gunshots and explosions
    createNoiseBuffer() {
        try {
            if (!this.ctx) return null;
            if (this.noiseBuffer) return this.noiseBuffer;
            const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            this.noiseBuffer = buffer;
            return buffer;
        } catch(e) {
            console.warn("createNoiseBuffer error:", e);
            return null;
        }
    }

    playShoot() {
        try {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const ctx = this.ctx;
            const now = ctx.currentTime;

            // 1. Transient Pop (Sine)
            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);

            oscGain.gain.setValueAtTime(0, now);
            oscGain.gain.linearRampToValueAtTime(0.4, now + 0.003);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);

            osc.connect(oscGain);
            oscGain.connect(ctx.destination);

            // 2. White Noise Blast (Gun powder)
            const noiseBuf = this.createNoiseBuffer();
            if (noiseBuf) {
                const noise = ctx.createBufferSource();
                noise.buffer = noiseBuf;

                const noiseFilter = ctx.createBiquadFilter();
                noiseFilter.type = 'bandpass';
                noiseFilter.frequency.setValueAtTime(1000, now);
                noiseFilter.frequency.exponentialRampToValueAtTime(100, now + 0.2);

                const noiseGain = ctx.createGain();
                noiseGain.gain.setValueAtTime(0, now);
                noiseGain.gain.linearRampToValueAtTime(0.6, now + 0.005);
                noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

                noise.connect(noiseFilter);
                noiseFilter.connect(noiseGain);
                noiseGain.connect(ctx.destination);

                noise.start(now);
                noise.stop(now + 0.3);
            }

            osc.start(now);
            osc.stop(now + 0.15);
        } catch(e) {
            console.warn("playShoot error:", e);
        }
    }

    playHeavyShoot() {
        try {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const ctx = this.ctx;
            const now = ctx.currentTime;

            // 1. Deep Pop (Sine)
            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.18);

            oscGain.gain.setValueAtTime(0, now);
            oscGain.gain.linearRampToValueAtTime(0.8, now + 0.004);
            oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

            osc.connect(oscGain);
            oscGain.connect(ctx.destination);

            // 2. Deep Lowpass Noise Blast
            const noiseBuf = this.createNoiseBuffer();
            if (noiseBuf) {
                const noise = ctx.createBufferSource();
                noise.buffer = noiseBuf;

                const noiseFilter = ctx.createBiquadFilter();
                noiseFilter.type = 'lowpass';
                noiseFilter.frequency.setValueAtTime(600, now);
                noiseFilter.frequency.exponentialRampToValueAtTime(40, now + 0.45);

                const noiseGain = ctx.createGain();
                noiseGain.gain.setValueAtTime(0, now);
                noiseGain.gain.linearRampToValueAtTime(0.8, now + 0.005);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

                noise.connect(noiseFilter);
                noiseFilter.connect(noiseGain);
                noiseGain.connect(ctx.destination);

                noise.start(now);
                noise.stop(now + 0.5);
            }

            osc.start(now);
            osc.stop(now + 0.2);
        } catch(e) {
            console.warn("playHeavyShoot error:", e);
        }
    }

    playHit() {
        try {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const ctx = this.ctx;
            const now = ctx.currentTime;

            // Low grunt sound + flesh impact noise
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(120, now);
            osc.frequency.linearRampToValueAtTime(60, now + 0.15);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.3, now + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(300, now);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.2);
        } catch(e) {
            console.warn("playHit error:", e);
        }
    }

    playRicochet() {
        try {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const ctx = this.ctx;
            const now = ctx.currentTime;

            // Classic western "piiiing" sound
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1200, now);
            osc.frequency.exponentialRampToValueAtTime(2000, now + 0.05);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.35);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.004);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

            const delay = ctx.createDelay();
            delay.delayTime.setValueAtTime(0.03, now);

            const feedback = ctx.createGain();
            feedback.gain.setValueAtTime(0.3, now);

            osc.connect(gain);
            gain.connect(ctx.destination);

            gain.connect(delay);
            delay.connect(feedback);
            feedback.connect(delay);
            delay.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.4);
        } catch(e) {
            console.warn("playRicochet error:", e);
        }
    }

    playExplosion() {
        try {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const ctx = this.ctx;
            const now = ctx.currentTime;

            const noiseBuf = this.createNoiseBuffer();
            if (noiseBuf) {
                const noise = ctx.createBufferSource();
                noise.buffer = noiseBuf;

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(400, now);
                filter.frequency.exponentialRampToValueAtTime(20, now + 1.2);

                const gain = ctx.createGain();
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(1.0, now + 0.01);
                gain.gain.linearRampToValueAtTime(0.7, now + 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

                noise.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);

                noise.start(now);
                noise.stop(now + 1.6);
            }

            const subOsc = ctx.createOscillator();
            const subGain = ctx.createGain();
            subOsc.type = 'sawtooth';
            subOsc.frequency.setValueAtTime(80, now);
            subOsc.frequency.linearRampToValueAtTime(30, now + 0.5);

            subGain.gain.setValueAtTime(0, now);
            subGain.gain.linearRampToValueAtTime(0.6, now + 0.01);
            subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

            const subFilter = ctx.createBiquadFilter();
            subFilter.type = 'lowpass';
            subFilter.frequency.setValueAtTime(100, now);

            subOsc.connect(subFilter);
            subFilter.connect(subGain);
            subGain.connect(ctx.destination);

            subOsc.start(now);
            subOsc.stop(now + 0.65);
        } catch(e) {
            console.warn("playExplosion error:", e);
        }
    }

    playCoinSound() {
        try {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const ctx = this.ctx;
            const now = ctx.currentTime;

            const notes = [987.77, 1318.51, 1567.98];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + i * 0.08);

                gain.gain.setValueAtTime(0, now + i * 0.08);
                gain.gain.linearRampToValueAtTime(0.18, now + i * 0.08 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.25);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + i * 0.08);
                osc.stop(now + i * 0.08 + 0.3);
            });
        } catch(e) {
            console.warn("playCoinSound error:", e);
        }
    }

    playWesternWhistle() {
        try {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const ctx = this.ctx;
            const now = ctx.currentTime;

            const notes = [
                { note: 440, duration: 0.15 },
                { note: 587.33, duration: 0.15 },
                { note: 440, duration: 0.15 },
                { note: 349.23, duration: 0.3 }
            ];

            let timeOffset = 0;
            notes.forEach(item => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(item.note, now + timeOffset);
                
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.setValueAtTime(8, now + timeOffset);
                lfoGain.gain.setValueAtTime(15, now + timeOffset);
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);

                gain.gain.setValueAtTime(0, now + timeOffset);
                gain.gain.linearRampToValueAtTime(0.2, now + timeOffset + 0.03);
                gain.gain.linearRampToValueAtTime(0.2, now + timeOffset + item.duration - 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + item.duration);

                osc.connect(gain);
                gain.connect(ctx.destination);

                lfo.start(now + timeOffset);
                osc.start(now + timeOffset);
                
                lfo.stop(now + timeOffset + item.duration);
                osc.stop(now + timeOffset + item.duration);

                timeOffset += item.duration + 0.05;
            });
        } catch(e) {
            console.warn("playWesternWhistle error:", e);
        }
    }

    playSheriffWhistle() {
        try {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const ctx = this.ctx;
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1400, now);

            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();
            lfo.frequency.setValueAtTime(22, now);
            lfoGain.gain.setValueAtTime(150, now);
            
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
            gain.gain.linearRampToValueAtTime(0.25, now + 0.45);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

            osc.connect(gain);
            gain.connect(ctx.destination);

            lfo.start(now);
            osc.start(now);
            
            lfo.stop(now + 0.6);
            osc.stop(now + 0.6);
        } catch(e) {
            console.warn("playSheriffWhistle error:", e);
        }
    }

    playChestOpen() {
        try {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const ctx = this.ctx;
            const now = ctx.currentTime;

            const notes = [587.33, 739.99, 880.00, 1174.66];
            notes.forEach((freq, index) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + index * 0.08);

                gain.gain.setValueAtTime(0, now + index * 0.08);
                gain.gain.linearRampToValueAtTime(0.15, now + index * 0.08 + 0.02);
                gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.08 + 0.25);

                osc.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + index * 0.08);
                osc.stop(now + index * 0.08 + 0.3);
            });
        } catch(e) {
            console.warn("playChestOpen error:", e);
        }
    }

    playSpike() {
        try {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const ctx = this.ctx;
            const now = ctx.currentTime;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.2, now + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.005, now + 0.16);

            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(700, now);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            osc.start(now);
            osc.stop(now + 0.16);
        } catch(e) {
            console.warn("playSpike error:", e);
        }
    }

    startBGM() {
        try {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            if (this.bgmInterval) return;

            const ctx = this.ctx;
            let step = 0;
            const bpm = 120;
            const stepTime = 60 / bpm / 2;
            let nextStepTime = ctx.currentTime + 0.1;

            const playStep = () => {
                try {
                    const time = nextStepTime;

                    if (!this.muted && this.ctx) {
                        if (step % 4 === 0 || step % 4 === 2 || step % 4 === 3) {
                            const bassOsc = ctx.createOscillator();
                            const bassGain = ctx.createGain();
                            
                            bassOsc.type = 'triangle';
                            const freq = (step % 4 === 0) ? 73.42 : 110.00;
                            bassOsc.frequency.setValueAtTime(freq, time);

                            bassGain.gain.setValueAtTime(0, time);
                            bassGain.gain.linearRampToValueAtTime(0.20, time + 0.02);
                            bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

                            const filter = ctx.createBiquadFilter();
                            filter.type = 'lowpass';
                            filter.frequency.setValueAtTime(150, time);

                            bassOsc.connect(filter);
                            filter.connect(bassGain);
                            bassGain.connect(ctx.destination);

                            bassOsc.start(time);
                            bassOsc.stop(time + 0.22);
                        }

                        if (step % 2 === 1) {
                            const drumBuf = this.createNoiseBuffer();
                            if (drumBuf) {
                                const drum = ctx.createBufferSource();
                                drum.buffer = drumBuf;

                                const drumFilter = ctx.createBiquadFilter();
                                drumFilter.type = 'bandpass';
                                drumFilter.frequency.setValueAtTime(400, time);

                                const drumGain = ctx.createGain();
                                drumGain.gain.setValueAtTime(0, time);
                                drumGain.gain.linearRampToValueAtTime(0.03, time + 0.004);
                                drumGain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

                                drum.connect(drumFilter);
                                drumFilter.connect(drumGain);
                                drumGain.connect(ctx.destination);

                                drum.start(time);
                                drum.stop(time + 0.08);
                            }
                        }

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

                            whistleGain.gain.setValueAtTime(0, time);
                            whistleGain.gain.linearRampToValueAtTime(0.05, time + 0.05);
                            whistleGain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

                            whistle.connect(whistleGain);
                            whistleGain.connect(ctx.destination);

                            lfo.start(time);
                            whistle.start(time);
                            
                            lfo.stop(time + 0.45);
                            whistle.stop(time + 0.45);
                        }
                    }

                    step++;
                    nextStepTime += stepTime;
                } catch(e) {
                    console.warn("BGM step error:", e);
                }
            };

            const scheduler = () => {
                try {
                    if (nextStepTime < ctx.currentTime - 0.15) {
                        nextStepTime = ctx.currentTime;
                    }
                    while (nextStepTime < ctx.currentTime + 0.1) {
                        playStep();
                    }
                } catch(e) {
                    console.warn("BGM scheduler error:", e);
                }
            };

            this.bgmInterval = setInterval(scheduler, 35);
        } catch(e) {
            console.warn("startBGM error:", e);
        }
    }

    stopBGM() {
        try {
            if (this.bgmInterval) {
                clearInterval(this.bgmInterval);
                this.bgmInterval = null;
            }
        } catch(e) {
            console.warn("stopBGM error:", e);
        }
    }

    playWinFanfare() {
        try {
            if (this.muted) return;
            this.init();
            if (!this.ctx) return;
            const ctx = this.ctx;
            const now = ctx.currentTime;

            const notes = [
                { note: 293.66, time: 0.0, type: 'sawtooth' },
                { note: 369.99, time: 0.15, type: 'sawtooth' },
                { note: 440.00, time: 0.3, type: 'sawtooth' },
                { note: 587.33, time: 0.45, type: 'sawtooth' },
                { note: 739.99, time: 0.65, type: 'sawtooth' }
            ];

            notes.forEach((item, index) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                
                osc.type = item.type;
                osc.frequency.setValueAtTime(item.note, now + item.time);
                
                const dur = (index === notes.length - 1) ? 1.0 : 0.3;

                gain.gain.setValueAtTime(0, now + item.time);
                gain.gain.linearRampToValueAtTime(0.12, now + item.time + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.001, now + item.time + dur);

                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(1500, now + item.time);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(ctx.destination);

                osc.start(now + item.time);
                osc.stop(now + item.time + dur);
            });
        } catch(e) {
            console.warn("playWinFanfare error:", e);
        }
    }
}

export const audio = new AudioSynth();
export default audio;
