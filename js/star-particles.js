/**
 * Ý Niệm Điện Ảnh - Celestial Ocean & Star Particle System
 * - Bầu trời sao trải đều tự nhiên toàn bộ trang web.
 * - Khi di chuyển chuột: Các ngôi sao lân cận bị hút nhẹ theo con trỏ chuột và tự động tạo mạng lưới liên kết ánh sáng vàng kim tinh tế.
 * - Chỉ khi nhấp chuột / chạm màn hình (Click/Tap): Sóng nước loang tỏa (Water Ripple Rings) và chùm tia sao phát quang bung tỏa.
 */

(function () {
    'use strict';

    class InteractiveStarField {
        constructor(canvasId = 'stars') {
            this.canvasId = canvasId;
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) return;

            this.ctx = this.canvas.getContext('2d', { alpha: true });
            if (!this.ctx) return;

            this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

            this.width = 0;
            this.height = 0;
            this.dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.animId = null;
            this.lastTime = performance.now();

            // Trạng thái chuột tương tác
            this.mouse = {
                x: -9999,
                y: -9999,
                active: false,
                radius: 145 // Bán kính hút và tạo liên kết ánh sáng
            };

            // Danh sách các thực thể
            this.stars = [];
            this.ripples = [];
            this.sparkles = [];
            this.shootingStars = [];

            // Bảng màu chuẩn Ý Niệm Điện Ảnh
            this.colors = {
                gold: '#e4b866',
                goldLight: '#f6e4bd',
                goldCore: '#ffffff',
                goldDark: '#cc9d4f',
                cyanGlow: '#82cfff'
            };

            // Thời gian tạo sao băng ngẫu nhiên tiếp theo
            this.nextShootingStarTime = performance.now() + 5000 + Math.random() * 6000;

            this.init();
        }

        init() {
            this.resize();
            this.bindEvents();
            this.createStars();
            this.start();
        }

        resize() {
            this.width = window.innerWidth;
            this.height = window.innerHeight;

            this.canvas.width = Math.floor(this.width * this.dpr);
            this.canvas.height = Math.floor(this.height * this.dpr);

            this.canvas.style.width = this.width + 'px';
            this.canvas.style.height = this.height + 'px';

            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

            // Phân bổ đều lại các ngôi sao trên toàn bộ kích thước màn hình
            this.createStars();
        }

        // Tạo các ngôi sao trải đều toàn bộ trang
        createStars() {
            const area = this.width * this.height;
            // Mật độ sao phân bố đồng đều khắp khung nhìn: min 35, max 85
            const starCount = this.prefersReducedMotion
                ? Math.min(40, Math.max(20, Math.floor(area / 35000)))
                : Math.min(85, Math.max(35, Math.floor(area / 20000)));

            this.stars = [];
            for (let i = 0; i < starCount; i++) {
                const x = Math.random() * this.width;
                const y = Math.random() * this.height;
                const rand = Math.random();

                let type = 0; // 0: Đốm ngọc phát sáng tròn (60%)
                if (rand > 0.75) type = 1;      // 25% Sao 4 cánh kim cương lấp lánh (Diamond Sparkle)
                else if (rand > 0.60) type = 2; // 15% Sao 5 cánh hoàng gia (5-Point Star)

                const size = type === 0 
                    ? (Math.random() * 1.5 + 0.6) 
                    : (type === 1 ? (Math.random() * 3.5 + 2.0) : (Math.random() * 3.8 + 2.2));

                this.stars.push({
                    baseX: x,
                    baseY: y,
                    x: x,
                    y: y,
                    vx: 0,
                    vy: 0,
                    size: size,
                    baseAlpha: Math.random() * 0.5 + 0.35,
                    alpha: 0.5,
                    twinkleSpeed: Math.random() * 0.016 + 0.005,
                    twinklePhase: Math.random() * Math.PI * 2,
                    type: type,
                    rotation: Math.random() * Math.PI,
                    rotSpeed: (Math.random() - 0.5) * 0.006,
                    // Dao động sóng nước bồng bềnh êm ái
                    waveFreqX: Math.random() * 0.0012 + 0.0006,
                    waveFreqY: Math.random() * 0.0016 + 0.0008,
                    waveAmpX: Math.random() * 8 + 3,
                    waveAmpY: Math.random() * 12 + 4,
                    wavePhase: Math.random() * Math.PI * 2,
                    waveHeightOffset: 0,
                    waveGlow: 0,
                    mouseGlow: 0
                });
            }
        }

        // Tạo vòng sóng nước loang tỏa CHỈ KHI NHẤP CHUỘT / CHẠM MÀN HÌNH
        addClickRipple(x, y, strength = 1.0) {
            if (this.prefersReducedMotion) return;
            if (this.ripples.length >= 8) this.ripples.shift();

            this.ripples.push({
                x: x,
                y: y,
                radius: 4,
                maxRadius: Math.min(this.width, this.height) * 0.42 * Math.min(1.3, strength),
                speed: 3.2 * Math.sqrt(strength),
                amplitude: 18 * strength,
                wavelength: 42,
                alpha: 0.7 * Math.min(1.0, strength),
                decay: 0.008 / Math.max(0.5, strength),
                colorGold: true
            });
        }

        // Bung tỏa chùm tia sao phát quang khi nhấp chuột
        addClickStarburst(x, y) {
            const count = this.prefersReducedMotion ? 6 : 18;
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.3;
                const speed = Math.random() * 4.0 + 1.6;
                this.sparkles.push({
                    x: x,
                    y: y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: Math.random() * 2.6 + 1.0,
                    alpha: 1.0,
                    decay: Math.random() * 0.02 + 0.016,
                    color: Math.random() > 0.3 ? this.colors.goldLight : this.colors.cyanGlow,
                    gravity: 0.03,
                    isSparkle: true,
                    rot: Math.random() * Math.PI,
                    rotSpeed: (Math.random() - 0.5) * 0.12
                });
            }
        }

        // Tạo vệt sao băng xẹt qua bầu trời
        createShootingStar() {
            if (this.prefersReducedMotion) return;
            const startX = Math.random() * (this.width * 0.8) + (this.width * 0.1);
            const startY = Math.random() * (this.height * 0.35);
            const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.22;
            const speed = Math.random() * 12 + 15;
            const length = Math.random() * 80 + 60;

            this.shootingStars.push({
                x: startX,
                y: startY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                length: length,
                alpha: 1.0,
                decay: 0.016,
                size: Math.random() * 1.6 + 1.1
            });

            this.nextShootingStarTime = performance.now() + 8000 + Math.random() * 10000;
        }

        bindEvents() {
            const onResize = () => this.resize();
            window.addEventListener('resize', onResize, { passive: true });

            // Cập nhật tọa độ chuột để hút sao & tạo liên kết ánh sáng
            const onMouseMove = (e) => {
                this.mouse.x = e.clientX;
                this.mouse.y = e.clientY;
                this.mouse.active = true;
            };

            const onMouseLeave = () => {
                this.mouse.active = false;
                this.mouse.x = -9999;
                this.mouse.y = -9999;
            };

            // Hỗ trợ cảm ứng trên thiết bị di động
            const onTouchMove = (e) => {
                if (e.touches && e.touches.length > 0) {
                    const touch = e.touches[0];
                    this.mouse.x = touch.clientX;
                    this.mouse.y = touch.clientY;
                    this.mouse.active = true;
                }
            };

            const onTouchEnd = () => {
                this.mouse.active = false;
                this.mouse.x = -9999;
                this.mouse.y = -9999;
            };

            // Khi nhấp chuột: Kích hoạt sóng nước loang và bụi sao bung tỏa
            const onMouseDown = (e) => {
                this.addClickRipple(e.clientX, e.clientY, 1.3);
                this.addClickStarburst(e.clientX, e.clientY);
            };

            // Khi chạm trên di động: Kích hoạt sóng nước loang và bụi sao
            const onTouchStart = (e) => {
                if (e.touches && e.touches.length > 0) {
                    const touch = e.touches[0];
                    this.mouse.x = touch.clientX;
                    this.mouse.y = touch.clientY;
                    this.mouse.active = true;
                    this.addClickRipple(touch.clientX, touch.clientY, 1.2);
                    this.addClickStarburst(touch.clientX, touch.clientY);
                }
            };

            window.addEventListener('mousemove', onMouseMove, { passive: true });
            document.addEventListener('mouseleave', onMouseLeave, { passive: true });
            window.addEventListener('touchmove', onTouchMove, { passive: true });
            window.addEventListener('touchend', onTouchEnd, { passive: true });

            window.addEventListener('mousedown', onMouseDown, { passive: true });
            window.addEventListener('touchstart', onTouchStart, { passive: true });

            // Tạm dừng animation khi tab bị ẩn để tối ưu hiệu năng
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.stop();
                } else {
                    this.lastTime = performance.now();
                    this.start();
                }
            });
        }

        // ================= VẼ CÁC LOẠI HẠT & NGÔI SAO =================

        // 1. Sao 4 cánh kim cương lấp lánh (Sparkle)
        draw4Star(ctx, x, y, size, alpha, rot = 0) {
            ctx.save();
            ctx.translate(x, y);
            if (rot !== 0) ctx.rotate(rot);

            // Quầng sáng mềm
            ctx.beginPath();
            ctx.moveTo(0, -size * 1.6);
            for (let i = 0; i < 4; i++) {
                ctx.quadraticCurveTo(0, 0, size * 1.6, 0);
                ctx.rotate(Math.PI / 2);
            }
            ctx.closePath();
            ctx.fillStyle = `rgba(224, 178, 98, ${alpha * 0.22})`;
            ctx.fill();

            // Nhân sao chính
            ctx.beginPath();
            ctx.moveTo(0, -size);
            for (let i = 0; i < 4; i++) {
                ctx.quadraticCurveTo(0, 0, size, 0);
                ctx.rotate(Math.PI / 2);
            }
            ctx.closePath();
            ctx.fillStyle = `rgba(246, 228, 189, ${alpha})`;
            ctx.fill();

            // Tâm sáng trắng
            if (size > 2.5) {
                ctx.beginPath();
                ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.85})`;
                ctx.fill();
            }

            ctx.restore();
        }

        // 2. Sao 5 cánh hoàng gia cổ điển
        draw5Star(ctx, cx, cy, rOuter, rInner, alpha, rot = 0) {
            let angle = (Math.PI / 2 * 3) + rot;
            const step = Math.PI / 5;

            // Quầng sáng ngoài
            this.draw5StarPath(ctx, cx, cy, rOuter * 1.4, rInner * 1.4, angle, step);
            ctx.fillStyle = `rgba(224, 178, 98, ${alpha * 0.2})`;
            ctx.fill();

            // Nhân sao
            this.draw5StarPath(ctx, cx, cy, rOuter, rInner, angle, step);
            ctx.fillStyle = `rgba(246, 228, 189, ${alpha})`;
            ctx.fill();

            // Tâm sáng
            ctx.beginPath();
            ctx.arc(cx, cy, rInner * 0.4, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
            ctx.fill();
        }

        draw5StarPath(ctx, cx, cy, rOuter, rInner, startAngle, step) {
            let a = startAngle;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * rOuter, cy + Math.sin(a) * rOuter);
            for (let i = 0; i < 5; i++) {
                a += step;
                ctx.lineTo(cx + Math.cos(a) * rInner, cy + Math.sin(a) * rInner);
                a += step;
                ctx.lineTo(cx + Math.cos(a) * rOuter, cy + Math.sin(a) * rOuter);
            }
            ctx.closePath();
        }

        // 3. Đốm ngọc phát quang tròn
        drawCircleStar(ctx, x, y, radius, alpha, glowBonus = 0) {
            if (radius > 1.0 || glowBonus > 0) {
                ctx.beginPath();
                ctx.arc(x, y, radius * (2.0 + glowBonus * 1.2), 0, Math.PI * 2);
                ctx.fillStyle = `rgba(224, 178, 98, ${(alpha * 0.22) + glowBonus * 0.18})`;
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(250, 235, 198, ${Math.min(1.0, alpha + glowBonus * 0.25)})`;
            ctx.fill();
        }

        // ================= VÒNG LẶP RENDER & VẬT LÝ =================

        update(time) {
            const dt = Math.min((time - this.lastTime) * 0.001, 0.1);
            this.lastTime = time;

            // 1. Cập nhật các vòng sóng nước lan tỏa khi click
            for (let i = this.ripples.length - 1; i >= 0; i--) {
                const rp = this.ripples[i];
                rp.radius += rp.speed;
                rp.alpha -= rp.decay;

                if (rp.alpha <= 0 || rp.radius >= rp.maxRadius) {
                    this.ripples.splice(i, 1);
                }
            }

            // 2. Cập nhật sao nền, dao động bồng bềnh & lực hút từ tính theo chuột
            const nowMs = performance.now();
            const mouseRadius = this.mouse.radius || 145;

            this.stars.forEach(st => {
                // Nhấp nháy nhẹ nhàng tự nhiên
                st.twinklePhase += st.twinkleSpeed;
                st.rotation += st.rotSpeed;
                const baseTwinkle = 0.25 + 0.75 * Math.abs(Math.sin(st.twinklePhase));
                st.alpha = st.baseAlpha * baseTwinkle;

                // Dao động sóng biển điều hòa tuần hoàn
                const waveTime = nowMs * 0.001;
                const waveOffsetX = Math.sin(waveTime * st.waveFreqX * 1000 + st.baseY * 0.004 + st.wavePhase) * st.waveAmpX;
                const waveOffsetY = Math.sin(waveTime * st.waveFreqY * 1000 + st.baseX * 0.005 + st.wavePhase) * st.waveAmpY;

                const targetX = st.baseX + waveOffsetX;
                const targetY = st.baseY + waveOffsetY;

                // Lực đàn hồi kéo về vị trí cân bằng
                st.vx += (targetX - st.x) * 0.035;
                st.vy += (targetY - st.y) * 0.035;

                // Tác động khi có sóng nước từ cú nhấp chuột (click ripple)
                st.waveHeightOffset = 0;
                st.waveGlow = 0;

                for (let j = 0; j < this.ripples.length; j++) {
                    const rp = this.ripples[j];
                    const dx = st.x - rp.x;
                    const dy = st.y - rp.y;
                    const dist = Math.hypot(dx, dy);

                    const delta = Math.abs(dist - rp.radius);
                    if (delta < rp.wavelength && dist > 1) {
                        const progress = 1 - (rp.radius / rp.maxRadius);
                        const waveFactor = Math.cos((delta / rp.wavelength) * Math.PI) * progress * rp.alpha;

                        // Đẩy nhẹ theo phương pháp tuyến của đỉnh sóng
                        const normalX = dx / dist;
                        const normalY = dy / dist;
                        st.vx += normalX * waveFactor * 2.0;
                        st.vy += normalY * waveFactor * 2.0;

                        st.waveHeightOffset += waveFactor * rp.amplitude;
                        st.waveGlow = Math.max(st.waveGlow, waveFactor * 1.4);
                    }
                }

                // Lực hút từ trường nhẹ nhàng theo con trỏ chuột khi di chuyển
                if (this.mouse.active && !this.prefersReducedMotion) {
                    const mdx = this.mouse.x - st.x;
                    const mdy = this.mouse.y - st.y;
                    const mdist = Math.hypot(mdx, mdy);

                    if (mdist < mouseRadius && mdist > 2) {
                        const pullFactor = Math.pow(1 - mdist / mouseRadius, 1.4);
                        const pullStrength = 1.8; // Hút êm dịu, mượt mà
                        st.vx += (mdx / mdist) * pullFactor * pullStrength;
                        st.vy += (mdy / mdist) * pullFactor * pullStrength;

                        st.mouseGlow = Math.max(st.mouseGlow || 0, pullFactor * 0.7);
                    } else {
                        st.mouseGlow = (st.mouseGlow || 0) * 0.9;
                    }
                } else {
                    st.mouseGlow = (st.mouseGlow || 0) * 0.9;
                }

                // Giảm chấn ma sát
                st.vx *= 0.86;
                st.vy *= 0.86;

                st.x += st.vx;
                st.y += st.vy;
            });

            // 3. Cập nhật bụi sao bung tỏa khi click
            for (let i = this.sparkles.length - 1; i >= 0; i--) {
                const sp = this.sparkles[i];
                sp.x += sp.vx;
                sp.y += sp.vy;
                sp.vy += sp.gravity;
                sp.vx *= 0.95;
                sp.vy *= 0.95;
                sp.alpha -= sp.decay;
                sp.rot += sp.rotSpeed;

                if (sp.alpha <= 0) {
                    this.sparkles.splice(i, 1);
                }
            }

            // 4. Cập nhật sao băng
            if (nowMs >= this.nextShootingStarTime && this.shootingStars.length === 0) {
                this.createShootingStar();
            }

            for (let i = this.shootingStars.length - 1; i >= 0; i--) {
                const ss = this.shootingStars[i];
                ss.x += ss.vx;
                ss.y += ss.vy;
                ss.alpha -= ss.decay;

                if (ss.alpha <= 0 || ss.x > this.width + 100 || ss.y > this.height + 100) {
                    this.shootingStars.splice(i, 1);
                }
            }
        }

        render() {
            this.ctx.clearRect(0, 0, this.width, this.height);

            // 1. Vẽ các vòng sóng nước lan tỏa khi click
            this.ripples.forEach(rp => {
                const progress = rp.radius / rp.maxRadius;
                const currentAlpha = rp.alpha * (1 - progress * 0.7);
                if (currentAlpha <= 0.01) return;

                this.ctx.save();
                this.ctx.beginPath();
                this.ctx.arc(rp.x, rp.y, rp.radius, 0, Math.PI * 2);

                const grad = this.ctx.createRadialGradient(
                    rp.x, rp.y, Math.max(0, rp.radius - rp.wavelength * 0.8),
                    rp.x, rp.y, rp.radius + rp.wavelength * 0.35
                );

                grad.addColorStop(0, 'rgba(228, 184, 102, 0)');
                grad.addColorStop(0.6, `rgba(246, 228, 189, ${currentAlpha * 0.38})`);
                grad.addColorStop(0.85, `rgba(228, 184, 102, ${currentAlpha * 0.25})`);
                grad.addColorStop(1, 'rgba(228, 184, 102, 0)');

                this.ctx.fillStyle = grad;
                this.ctx.fill();
                this.ctx.restore();
            });

            // 2. Vẽ đường tơ ánh sáng liên kết từ con trỏ chuột đến các ngôi sao lân cận (Constellation Links on Mouse)
            if (this.mouse.active && this.mouse.x > 0 && this.mouse.y > 0 && !this.prefersReducedMotion) {
                const mouseRadius = this.mouse.radius || 145;
                const nearbyStars = [];

                this.stars.forEach(st => {
                    const drawY = st.y - st.waveHeightOffset;
                    const dx = this.mouse.x - st.x;
                    const dy = this.mouse.y - drawY;
                    const dist = Math.hypot(dx, dy);

                    if (dist < mouseRadius) {
                        nearbyStars.push({ star: st, dist: dist, x: st.x, y: drawY });

                        // Đường liên kết từ con trỏ chuột tới ngôi sao
                        const lineFactor = 1 - dist / mouseRadius;
                        const alpha = Math.pow(lineFactor, 1.2) * 0.42 * Math.min(1.0, st.alpha + 0.35);

                        this.ctx.save();
                        this.ctx.beginPath();
                        this.ctx.moveTo(this.mouse.x, this.mouse.y);
                        this.ctx.lineTo(st.x, drawY);

                        const grad = this.ctx.createLinearGradient(this.mouse.x, this.mouse.y, st.x, drawY);
                        grad.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.95})`);
                        grad.addColorStop(0.35, `rgba(246, 228, 189, ${alpha * 0.75})`);
                        grad.addColorStop(1, `rgba(224, 178, 98, ${alpha * 0.35})`);

                        this.ctx.strokeStyle = grad;
                        this.ctx.lineWidth = Math.max(0.65, lineFactor * 1.6);
                        this.ctx.stroke();
                        this.ctx.restore();
                    }
                });

                // Nối các ngôi sao nằm trong vùng trường tương tác của chuột
                const nearLen = nearbyStars.length;
                for (let i = 0; i < nearLen; i++) {
                    for (let j = i + 1; j < nearLen; j++) {
                        const s1 = nearbyStars[i];
                        const s2 = nearbyStars[j];
                        const dx = s1.x - s2.x;
                        const dy = s1.y - s2.y;
                        const dist = Math.hypot(dx, dy);

                        const interConnectDist = 115;
                        if (dist < interConnectDist) {
                            const lineFactor = (1 - dist / interConnectDist);
                            const alpha = lineFactor * 0.20 * Math.min(1.0, (1 - s1.dist / mouseRadius) + (1 - s2.dist / mouseRadius));

                            this.ctx.beginPath();
                            this.ctx.moveTo(s1.x, s1.y);
                            this.ctx.lineTo(s2.x, s2.y);
                            this.ctx.strokeStyle = `rgba(224, 178, 98, ${alpha})`;
                            this.ctx.lineWidth = 0.75;
                            this.ctx.stroke();
                        }
                    }
                }

                // Điểm sáng tinh tế ở tâm con trỏ chuột
                this.ctx.beginPath();
                this.ctx.arc(this.mouse.x, this.mouse.y, 2.5, 0, Math.PI * 2);
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                this.ctx.fill();

                this.ctx.beginPath();
                this.ctx.arc(this.mouse.x, this.mouse.y, 6.5, 0, Math.PI * 2);
                this.ctx.fillStyle = 'rgba(224, 178, 98, 0.22)';
                this.ctx.fill();
            }

            // 3. Vẽ các ngôi sao trải đều toàn trang
            this.stars.forEach(st => {
                const drawY = st.y - st.waveHeightOffset;
                const bonusGlow = (st.waveGlow || 0) + (st.mouseGlow || 0);
                const totalAlpha = Math.min(1.0, st.alpha + bonusGlow * 0.45);
                const currentSize = st.size * (1 + bonusGlow * 0.28);

                if (st.type === 1) {
                    this.draw4Star(this.ctx, st.x, drawY, currentSize, totalAlpha, st.rotation);
                } else if (st.type === 2) {
                    this.draw5Star(this.ctx, st.x, drawY, currentSize, currentSize * 0.4, totalAlpha, st.rotation);
                } else {
                    this.drawCircleStar(this.ctx, st.x, drawY, currentSize, totalAlpha, bonusGlow);
                }
            });

            // 4. Vẽ các hạt bụi sao bung tỏa khi click
            this.sparkles.forEach(sp => {
                if (sp.isSparkle) {
                    this.draw4Star(this.ctx, sp.x, sp.y, sp.size, sp.alpha, sp.rot);
                } else {
                    this.ctx.beginPath();
                    this.ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
                    this.ctx.fillStyle = `rgba(246, 228, 189, ${sp.alpha})`;
                    this.ctx.fill();
                }
            });

            // 5. Vẽ sao băng
            this.shootingStars.forEach(ss => {
                this.ctx.save();
                const tailX = ss.x - (ss.vx / Math.hypot(ss.vx, ss.vy)) * ss.length;
                const tailY = ss.y - (ss.vy / Math.hypot(ss.vx, ss.vy)) * ss.length;

                const grad = this.ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
                grad.addColorStop(0, 'rgba(228, 184, 102, 0)');
                grad.addColorStop(0.7, `rgba(246, 228, 189, ${ss.alpha * 0.6})`);
                grad.addColorStop(1, `rgba(255, 255, 255, ${ss.alpha})`);

                this.ctx.beginPath();
                this.ctx.moveTo(tailX, tailY);
                this.ctx.lineTo(ss.x, ss.y);
                this.ctx.strokeStyle = grad;
                this.ctx.lineWidth = ss.size * 1.4;
                this.ctx.lineCap = 'round';
                this.ctx.stroke();

                this.draw4Star(this.ctx, ss.x, ss.y, ss.size * 2.2, ss.alpha, Math.PI / 4);
                this.ctx.restore();
            });
        }

        loop(time) {
            this.update(time);
            this.render();
            this.animId = requestAnimationFrame((t) => this.loop(t));
        }

        start() {
            if (!this.animId) {
                this.animId = requestAnimationFrame((t) => this.loop(t));
            }
        }

        stop() {
            if (this.animId) {
                cancelAnimationFrame(this.animId);
                this.animId = null;
            }
        }
    }

    // Khởi tạo hệ thống sao & tương thích ngược
    function initInteractiveStars() {
        if (!document.getElementById('stars')) return;
        if (window.yndaStarField) {
            window.yndaStarField.resize();
            return;
        }
        window.yndaStarField = new InteractiveStarField('stars');
    }

    window.initStars = initInteractiveStars;
    window.InteractiveStarField = InteractiveStarField;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initInteractiveStars);
    } else {
        initInteractiveStars();
    }
})();
