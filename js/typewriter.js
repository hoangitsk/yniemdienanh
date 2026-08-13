/**
 * Ý Niệm Điện Ảnh — Full Cinematic Typewriter Suite
 * Tự động gõ chữ tuần tự từ đầu trang web:
 * 1. Eyebrow: "Dự án cộng đồng về điện ảnh"
 * 2. Tiêu đề H1: "Ý Niệm" <br> "Điện Ảnh"
 * 3. Slogan Lead: Xoay vòng các câu slogan điện ảnh với con trỏ vàng nhấp nháy
 */
(function () {
    var DEFAULT_EYEBROW = "Dự án cộng đồng về điện ảnh";
    var DEFAULT_TITLE = "Ý Niệm<br>Điện Ảnh";

    var SLOGAN_PHRASES = [
        "Ghi lại những khoảnh khắc trước khi chúng trở thành ký ức.",
        "Nơi ý tưởng cất cánh và câu chuyện của bạn bắt đầu.",
        "Sân chơi làm phim ngắn cho học sinh - sinh viên toàn quốc.",
        "Biến mọi góc nhìn cuộc sống thành nghệ thuật điện ảnh.",
        "Khám phá nghệ thuật kể chuyện qua từng khung hình.",
        "Đồng kiến tạo hệ sinh thái điện ảnh trẻ Việt Nam."
    ];

    var currentActiveTimer = null;
    var sloganLoopTimer = null;
    var isRunning = false;

    function startHeroTypewriter(customEyebrow, customTitle) {
        var eyebrowEl = document.getElementById('heroTypewriterEyebrow');
        var cursorEyebrow = document.getElementById('cursorEyebrow');
        var titleEl = document.getElementById('heroTypewriterTitle');
        var cursorTitle = document.getElementById('cursorTitle');
        var sloganEl = document.getElementById('heroTypewriterText');
        var cursorSlogan = document.getElementById('cursorSlogan');

        if (!eyebrowEl && !titleEl && !sloganEl) return;

        if (currentActiveTimer) clearTimeout(currentActiveTimer);
        if (sloganLoopTimer) clearTimeout(sloganLoopTimer);

        var eyebrowTarget = (customEyebrow || (eyebrowEl ? eyebrowEl.getAttribute('data-text') : '') || DEFAULT_EYEBROW).trim();
        var rawTitle = customTitle || DEFAULT_TITLE;
        var titleLines = rawTitle.split(/<br\s*\/?>|\n/i).map(function(s){ return s.replace(/<[^>]*>/g, '').trim(); }).filter(Boolean);
        if (titleLines.length === 0) titleLines = ["Ý Niệm", "Điện Ảnh"];

        var prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            if (eyebrowEl) eyebrowEl.textContent = eyebrowTarget;
            if (titleEl) titleEl.innerHTML = titleLines.join('<br>');
            if (sloganEl) sloganEl.textContent = SLOGAN_PHRASES[0];
            if (cursorEyebrow) cursorEyebrow.style.display = 'none';
            if (cursorTitle) cursorTitle.style.display = 'none';
            if (cursorSlogan) cursorSlogan.style.display = 'none';
            return;
        }

        // Đặt trạng thái ban đầu
        if (eyebrowEl) eyebrowEl.textContent = '';
        if (titleEl) titleEl.innerHTML = '';
        if (sloganEl) sloganEl.textContent = '';

        if (cursorEyebrow) cursorEyebrow.style.display = 'inline-block';
        if (cursorTitle) cursorTitle.style.display = 'none';
        if (cursorSlogan) cursorSlogan.style.display = 'none';

        isRunning = true;

        // --- BƯỚC 1: Gõ Eyebrow ("Dự án cộng đồng về điện ảnh") ---
        function typeEyebrow(callback) {
            if (!eyebrowEl) {
                if (callback) callback();
                return;
            }
            var i = 0;
            function step() {
                if (i < eyebrowTarget.length) {
                    eyebrowEl.textContent += eyebrowTarget.charAt(i);
                    i++;
                    currentActiveTimer = setTimeout(step, 28);
                } else {
                    currentActiveTimer = setTimeout(function () {
                        if (cursorEyebrow) cursorEyebrow.style.display = 'none';
                        if (callback) callback();
                    }, 120);
                }
            }
            step();
        }

        // --- BƯỚC 2: Gõ Tiêu đề H1 ("Ý Niệm \n Điện Ảnh") ---
        function typeTitle(callback) {
            if (!titleEl) {
                if (callback) callback();
                return;
            }
            if (cursorTitle) cursorTitle.style.display = 'inline-block';

            var lineIndex = 0;
            var charIndex = 0;
            var renderedLines = [];

            function stepTitle() {
                var currentLineText = titleLines[lineIndex];
                if (charIndex < currentLineText.length) {
                    charIndex++;
                    var currentLineHtml = currentLineText.substring(0, charIndex);
                    var fullHtml = renderedLines.concat([currentLineHtml]).join('<br>');
                    titleEl.innerHTML = fullHtml;
                    currentActiveTimer = setTimeout(stepTitle, 50);
                } else {
                    renderedLines.push(currentLineText);
                    lineIndex++;
                    charIndex = 0;
                    if (lineIndex < titleLines.length) {
                        currentActiveTimer = setTimeout(function () {
                            titleEl.innerHTML = renderedLines.join('<br>') + '<br>';
                            currentActiveTimer = setTimeout(stepTitle, 70);
                        }, 90);
                    } else {
                        currentActiveTimer = setTimeout(function () {
                            if (cursorTitle) cursorTitle.style.display = 'none';
                            if (callback) callback();
                        }, 200);
                    }
                }
            }
            stepTitle();
        }

        // --- BƯỚC 3: Gõ & Vòng lặp Slogan ---
        function startSloganLoop() {
            if (!sloganEl) return;
            if (cursorSlogan) cursorSlogan.style.display = 'inline-block';

            var phraseIndex = 0;
            var charIndex = 0;
            var isDeleting = false;
            var isPaused = false;

            function getRandomSpeed() {
                return Math.floor(Math.random() * 20) + 35;
            }

            function typeSloganStep() {
                if (isPaused) return;

                var currentPhrase = SLOGAN_PHRASES[phraseIndex];

                if (isDeleting) {
                    charIndex--;
                    sloganEl.textContent = currentPhrase.substring(0, charIndex);

                    if (charIndex <= 0) {
                        isDeleting = false;
                        phraseIndex = (phraseIndex + 1) % SLOGAN_PHRASES.length;
                        sloganLoopTimer = setTimeout(typeSloganStep, 350);
                        return;
                    }
                    sloganLoopTimer = setTimeout(typeSloganStep, 18);
                } else {
                    charIndex++;
                    sloganEl.textContent = currentPhrase.substring(0, charIndex);

                    if (charIndex >= currentPhrase.length) {
                        isDeleting = true;
                        sloganLoopTimer = setTimeout(typeSloganStep, 3200);
                        return;
                    }

                    var lastChar = currentPhrase[charIndex - 1];
                    var delay = getRandomSpeed();
                    if (lastChar === ',' || lastChar === ';' || lastChar === '—' || lastChar === '-') {
                        delay += 160;
                    } else if (lastChar === '.' || lastChar === '!' || lastChar === '?') {
                        delay += 280;
                    }
                    sloganLoopTimer = setTimeout(typeSloganStep, delay);
                }
            }

            typeSloganStep();

            document.addEventListener('visibilitychange', function () {
                if (document.hidden) {
                    isPaused = true;
                    if (sloganLoopTimer) clearTimeout(sloganLoopTimer);
                } else if (isPaused) {
                    isPaused = false;
                    typeSloganStep();
                }
            });
        }

        currentActiveTimer = setTimeout(function () {
            typeEyebrow(function () {
                typeTitle(function () {
                    startSloganLoop();
                });
            });
        }, 80);
    }

    window.startHeroTypewriter = startHeroTypewriter;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            startHeroTypewriter();
        });
    } else {
        setTimeout(function() {
            startHeroTypewriter();
        }, 50);
    }
})();
