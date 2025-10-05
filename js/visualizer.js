// visualizer.js - Audio visualization handling

export class Visualizer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.dataArray = null;
        this.bufferLength = null;
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        this.isInitialized = false;
    }

    // Initialize audio context and analyser
    async initialize(audioElement) {
        if (this.isInitialized) return this.resume();

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaElementSource(audioElement);
            
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.dataArray = new Uint8Array(this.bufferLength);
            
            source.connect(this.analyser);
            this.analyser.connect(this.audioContext.destination);
            
            this.canvas = document.getElementById('visualizerCanvas');
            if (this.canvas) {
                this.ctx = this.canvas.getContext('2d');
                this.isInitialized = true;
                this.startVisualization();
            }
            
            return true;
        } catch (e) {
            console.error('Visualizer init error:', e);
            return false;
        }
    }

    // Resume audio context if suspended
    async resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            try {
                await this.audioContext.resume();
                return true;
            } catch (e) {
                console.error('AudioContext resume error:', e);
                return false;
            }
        }
        return true;
    }

    // Start the visualization loop
    startVisualization() {
        if (!this.isInitialized || this.animationId) return;
        this.draw();
    }

    // Stop the visualization loop
    stopVisualization() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // Main drawing function
    draw() {
        this.animationId = requestAnimationFrame(() => this.draw());

        if (!this.ctx || !this.analyser) return;
        
        this.analyser.getByteFrequencyData(this.dataArray);

        const width = this.canvas.width = this.canvas.clientWidth;
        const height = this.canvas.height = this.canvas.clientHeight;

        // Smooth trailing blur
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        this.ctx.fillRect(0, 0, width, height);
        this.ctx.globalCompositeOperation = 'lighter';

        const barCount = this.bufferLength;
        const barWidth = width / barCount * 2;
        const time = Date.now() * 0.003;

        // Global metrics for dynamic effects
        const volume = this.dataArray.reduce((a, b) => a + b, 0) / this.bufferLength;
        const intensity = this.dataArray
            .filter((v, i) => i % 8 === 0)
            .reduce((a, b) => a + b, 0) / (this.bufferLength / 8);

        for (let i = 0; i < barCount; i++) {
            const value = this.dataArray[i] / 255;
            const eased = Math.pow(value, 1.5); // smoother scaling
            const barHeight = eased * height * 1.7;

            const x = i * barWidth * 0.6 + Math.sin(i * 0.1 + time * 4) * 2;

            // Multi-layer color shifting
            const hue = (i * 2 + time * 80 + Math.sin(i * 0.3 + time) * 60 + (volume * 0.8)) % 360;
            const saturation = 85 + Math.sin(time + i * 0.15) * 10;
            const light = 40 + eased * 45 + Math.sin(i + time * 0.5) * 5;

            // Colorful glow with gradient
            const gradient = this.ctx.createLinearGradient(x, height, x, height - barHeight);
            gradient.addColorStop(0, `hsla(${hue}, ${saturation}%, ${light + 5}%, 0.6)`);
            gradient.addColorStop(1, `hsla(${hue + 20}, ${saturation + 5}%, ${light}%, 1)`);

            this.ctx.fillStyle = gradient;

            // Round top rectangle
            this.ctx.beginPath();
            this.ctx.moveTo(x, height);
            this.ctx.lineTo(x, height - barHeight + 10);
            this.ctx.quadraticCurveTo(x, height - barHeight, x + 10, height - barHeight);
            this.ctx.lineTo(x + barWidth - 10, height - barHeight);
            this.ctx.quadraticCurveTo(x + barWidth, height - barHeight, x + barWidth, height - barHeight + 10);
            this.ctx.lineTo(x + barWidth, height);
            this.ctx.closePath();
            this.ctx.fill();
        }

        this.ctx.globalCompositeOperation = 'source-over';
    }

    // Cleanup
    destroy() {
        this.stopVisualization();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        this.isInitialized = false;
    }
}