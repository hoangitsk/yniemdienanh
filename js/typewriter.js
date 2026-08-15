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
    var currentRunId = 0;
    var isPaused = false;

    // Lắng nghe visibilitychange 1 lần duy nhất toàn cục
    if (!window.__ynda_typewriter_visibility_bound) {
        window.__ynda_typewriter_visibility_bound = true;
        document.addEventListener('visibilitychange', function () {
            isPaused = document.hidden;
        });
    }

    function startHeroTypewriter(customEyebrow, customTitle) {
        var eyebrowEl = document.getElementById('heroTypewriterEyebrow');
        var cursorEyebrow = document.getElementById('cursorEyebrow');
        var titleEl = document.getElementById('heroTypewriterTitle');
        var cursorTitle = document.getElementById('cursorTitle');
        var sloganEl = document.getElementById('heroTypewriterText');
        var cursorSlogan = document.getElementById('cursorSlogan');

        if (!eyebrowEl && !titleEl && !sloganEl) return;

        // Tăng runId để hủy toàn bộ callback / timeout của các lần chạy trước đó ngay lập tức
        var runId = ++currentRunId;

        if (currentActiveTimer) {
            clearTimeout(currentActiveTimer);
            currentActiveTimer = null;
        }
        if (sloganLoopTimer) {
            clearTimeout(sloganLoopTimer);
            sloganLoopTimer = null;
        }

        var eyebrowTarget = (customEyebrow || (eyebrowEl ? eyebrowEl.getAttribute('data-text') : '') || DEFAULT_EYEBROW).trim();
        var rawTitle = customTitle || DEFAULT_TITLE;
        var titleLines = rawTitle.split(/<br\s*\/?>|\n/i).map(function (s) { return s.replace(/<[^>]*>/g, '').trim(); }).filter(Boolean);
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

        // Đặt trạng thái ban đầu an toàn
        if (eyebrowEl) eyebrowEl.textContent = '';
        if (titleEl) titleEl.innerHTML = '';
        if (sloganEl) sloganEl.textContent = '';

        if (cursorEyebrow) cursorEyebrow.style.display = 'inline-block';
        if (cursorTitle) cursorTitle.style.display = 'none';
        if (cursorSlogan) cursorSlogan.style.display = 'none';

        // --- BƯỚC 1: Gõ Eyebrow ("Dự án cộng đồng về điện ảnh") ---
        function typeEyebrow(callback) {
            if (!eyebrowEl) {
                if (callback) callback();
                return;
            }
            var i = 1;
            function stepEyebrow() {
                if (runId !== currentRunId) return;
                if (i <= eyebrowTarget.length) {
                    eyebrowEl.textContent = eyebrowTarget.substring(0, i);
                    i++;
                    currentActiveTimer = setTimeout(stepEyebrow, 28);
                } else {
                    currentActiveTimer = setTimeout(function () {
                        if (runId !== currentRunId) return;
                        if (cursorEyebrow) cursorEyebrow.style.display = 'none';
                        if (callback) callback();
                    }, 120);
                }
            }
            stepEyebrow();
        }

        // --- BƯỚC 2: Gõ Tiêu đề H1 ("Ý Niệm \n Điện Ảnh") ---
        function typeTitle(callback) {
            if (!titleEl) {
                if (callback) callback();
                return;
            }
            if (cursorTitle) cursorTitle.style.display = 'inline-block';

            var lineIndex = 0;
            var charIndex = 1;
            var renderedLines = [];

            function stepTitle() {
                if (runId !== currentRunId) return;
                var currentLineText = titleLines[lineIndex];
                if (charIndex <= currentLineText.length) {
                    var currentLineHtml = currentLineText.substring(0, charIndex);
                    var fullHtml = renderedLines.concat([currentLineHtml]).join('<br>');
                    titleEl.innerHTML = fullHtml;
                    charIndex++;
                    currentActiveTimer = setTimeout(stepTitle, 50);
                } else {
                    renderedLines.push(currentLineText);
                    lineIndex++;
                    charIndex = 1;
                    if (lineIndex < titleLines.length) {
                        currentActiveTimer = setTimeout(function () {
                            if (runId !== currentRunId) return;
                            titleEl.innerHTML = renderedLines.join('<br>') + '<br>';
                            currentActiveTimer = setTimeout(stepTitle, 70);
                        }, 90);
                    } else {
                        currentActiveTimer = setTimeout(function () {
                            if (runId !== currentRunId) return;
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

            function getRandomSpeed() {
                return Math.floor(Math.random() * 20) + 35;
            }

            function typeSloganStep() {
                if (runId !== currentRunId) return;
                if (isPaused) {
                    sloganLoopTimer = setTimeout(typeSloganStep, 200);
                    return;
                }

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
        }

        currentActiveTimer = setTimeout(function () {
            if (runId !== currentRunId) return;
            typeEyebrow(function () {
                if (runId !== currentRunId) return;
                typeTitle(function () {
                    if (runId !== currentRunId) return;
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
        setTimeout(function () {
            startHeroTypewriter();
        }, 50);
    }
})();
