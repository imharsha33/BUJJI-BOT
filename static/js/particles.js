// Particle System
(function() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animId;
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    resize();
    window.addEventListener('resize', () => { resize(); initParticles(); });
    
    class Particle {
        constructor() {
            this.reset();
        }
        
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 1.5 + 0.5;
            this.speedX = (Math.random() - 0.5) * 0.3;
            this.speedY = (Math.random() - 0.5) * 0.3;
            this.life = 0;
            this.maxLife = Math.random() * 200 + 100;
            this.color = Math.random() > 0.5 ? '108, 142, 255' : '167, 139, 250';
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.life++;
            
            if (this.life > this.maxLife || 
                this.x < 0 || this.x > canvas.width || 
                this.y < 0 || this.y > canvas.height) {
                this.reset();
            }
        }
        
        draw() {
            const progress = this.life / this.maxLife;
            const opacity = progress < 0.2 ? progress / 0.2 : 
                           progress > 0.8 ? (1 - progress) / 0.2 : 1;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.color}, ${opacity * 0.6})`;
            ctx.fill();
        }
    }
    
    function initParticles() {
        const count = Math.min(80, Math.floor(canvas.width * canvas.height / 15000));
        particles = Array.from({ length: count }, () => new Particle());
    }
    
    function drawConnections() {
        const maxDist = 120;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < maxDist) {
                    const opacity = (1 - dist / maxDist) * 0.12;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(108, 142, 255, ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            }
        }
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        drawConnections();
        
        particles.forEach(p => {
            p.update();
            p.draw();
        });
        
        animId = requestAnimationFrame(animate);
    }
    
    initParticles();
    animate();
})();
