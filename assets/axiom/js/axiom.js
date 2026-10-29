/*!
 * Axiom Ghost theme v1.2.1
 * Copyright (c) 2026 somersetnomad. All rights reserved.
 * Commercial licence: see LICENSE.md. Not for redistribution.
 */
/**
 * Axiom — Ghost theme engine
 * Spring physics, focal-point scroll spy, glass drawer, generative fields
 * and embeddable interactive components. Dependency-free.
 */
(function () {
    'use strict';

    var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var FINE_POINTER = window.matchMedia('(pointer: fine)').matches;
    var MOBILE_MQ = window.matchMedia('(max-width: 960px)');
    var root = document.documentElement;
    var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

    /* ======================================================================
       0. Spring physics core
       Damped harmonic oscillator: a = (-k·(x − target) − c·v) / m
       ====================================================================== */
    function Spring(value, opts) {
        opts = opts || {};
        this.value = value;
        this.target = value;
        this.velocity = 0;
        this.k = opts.stiffness || 170;
        this.c = opts.damping || 26;
        this.m = opts.mass || 1;
        this.precision = opts.precision || 0.01;
        this.onUpdate = opts.onUpdate || null;
        this.running = false;
        this._raf = null;
        this._tick = this._tick.bind(this);
    }

    Spring.prototype.to = function (target) {
        this.target = target;
        if (REDUCED) return this.set(target);
        if (!this._raf) {
            this.running = true;
            this._last = performance.now();
            this._raf = requestAnimationFrame(this._tick);
        }
        return this;
    };

    Spring.prototype.set = function (value) {
        this.stop();
        this.value = this.target = value;
        this.velocity = 0;
        if (this.onUpdate) this.onUpdate(value, this);
        return this;
    };

    Spring.prototype.stop = function () {
        if (this._raf) cancelAnimationFrame(this._raf);
        this._raf = null;
        this.running = false;
    };

    Spring.prototype._tick = function (now) {
        this._raf = null;
        var dt = Math.min((now - this._last) / 1000, 1 / 20);
        this._last = now;
        var steps = Math.max(1, Math.ceil(dt * 240));
        var h = dt / steps;
        for (var i = 0; i < steps; i++) {
            var a = (-this.k * (this.value - this.target) - this.c * this.velocity) / this.m;
            this.velocity += a * h;
            this.value += this.velocity * h;
        }
        if (Math.abs(this.velocity) < this.precision * 10 && Math.abs(this.value - this.target) < this.precision) {
            this.value = this.target;
            this.velocity = 0;
            this.running = false;
        }
        if (this.onUpdate) this.onUpdate(this.value, this);
        if (this.running) this._raf = requestAnimationFrame(this._tick);
    };

    /* Simulate spring curves and expose them to CSS as linear() easings */
    function springCurve(k, c) {
        var dt = 1 / 480, x = 0, v = 0, t = 0, next = 1 / 60;
        var samples = [0];
        while (t < 2) {
            var a = -k * (x - 1) - c * v;
            v += a * dt;
            x += v * dt;
            t += dt;
            if (t >= next) {
                samples.push(x);
                next += 1 / 60;
                if (Math.abs(x - 1) < 0.001 && Math.abs(v) < 0.01) break;
            }
        }
        samples[samples.length - 1] = 1;
        return {
            easing: 'linear(' + samples.map(function (s) { return +s.toFixed(4); }).join(', ') + ')',
            duration: Math.round(t * 1000) + 'ms'
        };
    }

    function installSpringEasings() {
        if (REDUCED || !window.CSS || !CSS.supports('transition-timing-function', 'linear(0, 0.5, 1)')) return;
        var presets = { snappy: [420, 36], bouncy: [320, 17], gentle: [140, 22] };
        Object.keys(presets).forEach(function (name) {
            var s = springCurve(presets[name][0], presets[name][1]);
            root.style.setProperty('--ease-' + name, s.easing);
            root.style.setProperty('--dur-' + name, s.duration);
        });
    }

    function themeColors() {
        var cs = getComputedStyle(root);
        var get = function (n) { return cs.getPropertyValue(n).trim(); };
        return {
            ink: get('--text-primary') || '#191816',
            accent: get('--text-accent') || '#2563eb',
            secondary: get('--text-secondary') || '#5f5d56',
            inkA: parseFloat(get('--field-ink-alpha')) || 0.3,
            accentA: parseFloat(get('--field-accent-alpha')) || 0.6
        };
    }

    function docTop(el) {
        var y = 0;
        while (el) { y += el.offsetTop; el = el.offsetParent; }
        return y;
    }

    function scrollOffset() {
        var bar = document.getElementById('mobileBar');
        return MOBILE_MQ.matches && bar ? bar.offsetHeight + 20 : 40;
    }

    function onVisible(el, cb) {
        if (!('IntersectionObserver' in window)) { cb(true); return; }
        new IntersectionObserver(function (entries) { cb(entries[0].isIntersecting); }).observe(el);
    }

    /* ======================================================================
       1. Reading progress (spring-smoothed)
       ====================================================================== */
    function initReadingProgress() {
        var bar = document.getElementById('progress-tracker');
        if (!bar) return;
        var sp = new Spring(0, {
            stiffness: 300, damping: 34, precision: 0.0005,
            onUpdate: function (v) { bar.style.transform = 'scaleX(' + clamp(v, 0, 1) + ')'; }
        });
        var update = function () {
            var total = root.scrollHeight - window.innerHeight;
            sp.to(total > 0 ? window.scrollY / total : 0);
        };
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        sp.set(0); update();
    }

    /* ======================================================================
       2. Theme engine (circular view-transition reveal)
       ====================================================================== */
    function initThemeEngine() {
        var btn = document.getElementById('themeToggle');
        var label = document.getElementById('themeLabel');
        if (!btn) return;

        var updateLabel = function () {
            var dark = root.getAttribute('data-theme') === 'dark';
            if (label) label.textContent = dark ? 'Light Theme ☼' : 'Dark Theme ☾';
        };

        var apply = function (next) {
            root.setAttribute('data-theme', next);
            try { localStorage.setItem('axiom-theme', next); } catch (e) {}
            updateLabel();
            window.dispatchEvent(new CustomEvent('axiom:themechange'));
        };

        btn.addEventListener('click', function () {
            var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            if (!document.startViewTransition || REDUCED) { apply(next); return; }

            var r = btn.getBoundingClientRect();
            var x = r.left + r.width / 2, y = r.top + r.height / 2;
            var end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
            var vt = document.startViewTransition(function () { apply(next); });
            vt.ready.then(function () {
                var easing = getComputedStyle(root).getPropertyValue('--ease-gentle').trim() || 'ease-out';
                root.animate(
                    { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + end + 'px at ' + x + 'px ' + y + 'px)'] },
                    { duration: 680, easing: easing, pseudoElement: '::view-transition-new(root)' }
                );
            }).catch(function () {});
        });

        updateLabel();
    }

    /* ======================================================================
       3. Ambient light pools — follow the pointer with spring lag
       ====================================================================== */
    function initAmbientLayer() {
        var a = document.querySelector('[data-blob="a"]');
        var b = document.querySelector('[data-blob="b"]');
        if (!a || !b) return;
        var sx = 0;

        function render() {
            var w = innerWidth, h = innerHeight;
            var drift = sx * h * 0.35;
            a.style.transform = 'translate3d(' + (mx.value * w) + 'px,' + (my.value * h - drift) + 'px,0)';
            b.style.transform = 'translate3d(' + ((1 - mx.value) * w * 0.9) + 'px,' + ((1 - my.value) * h * 0.9 + drift * 0.6) + 'px,0)';
        }

        var mx = new Spring(0.7, { stiffness: 18, damping: 9, precision: 0.0005, onUpdate: render });
        var my = new Spring(0.3, { stiffness: 18, damping: 9, precision: 0.0005, onUpdate: render });

        if (FINE_POINTER && !REDUCED) {
            window.addEventListener('pointermove', function (e) {
                mx.to(0.35 + (e.clientX / innerWidth) * 0.55);
                my.to(0.15 + (e.clientY / innerHeight) * 0.6);
            }, { passive: true });
        }

        window.addEventListener('scroll', function () {
            var total = root.scrollHeight - innerHeight;
            sx = total > 0 ? scrollY / total : 0;
            render();
        }, { passive: true });

        window.addEventListener('resize', render);
        render();
    }

    /* ======================================================================
       4. Scroller — spring anchor navigation + inertial stepped mouse wheels
       Trackpads and touch keep their native momentum.
       ====================================================================== */
    var Scroller = { to: function (y) { window.scrollTo(0, y); }, stop: function () {} };

    function initScroller() {
        var lastSet = null;
        var max = function () { return root.scrollHeight - innerHeight; };
        var spring = new Spring(scrollY, {
            stiffness: 120, damping: 22, precision: 0.5,
            onUpdate: function (v) { lastSet = v; window.scrollTo(0, v); }
        });

        function to(y) {
            y = clamp(y, 0, max());
            if (REDUCED) { window.scrollTo(0, y); return; }
            if (!spring.running) { spring.value = scrollY; spring.velocity = 0; }
            spring.to(y);
        }

        function stop() { if (spring.running) spring.stop(); }

        window.addEventListener('scroll', function () {
            if (spring.running && lastSet !== null && Math.abs(scrollY - lastSet) > 3) stop();
        }, { passive: true });
        ['touchstart', 'keydown', 'pointerdown'].forEach(function (ev) {
            window.addEventListener(ev, stop, { passive: true });
        });

        var inertial = document.body.getAttribute('data-inertial') !== 'off';
        if (inertial && FINE_POINTER && !REDUCED) {
            window.addEventListener('wheel', function (e) {
                if (e.ctrlKey || e.shiftKey || e.defaultPrevented) return;
                if (e.target.closest && e.target.closest('.sidebar, .canvas-container, input, textarea, iframe, [data-no-inertia]')) return;
                var stepped = e.deltaMode !== 0 || (Math.abs(e.deltaY) >= 50 && Math.abs(e.deltaX) < 1);
                if (!stepped) return;
                e.preventDefault();
                var unit = e.deltaMode === 1 ? 36 : e.deltaMode === 2 ? innerHeight * 0.9 : 1;
                var base = spring.running ? spring.target : scrollY;
                to(base + e.deltaY * unit * 1.1);
            }, { passive: false });
        }

        Scroller = { to: to, stop: stop };
    }

    /* Same-page anchor links glide with the scroll spring */
    function initAnchorLinks() {
        document.addEventListener('click', function (e) {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
            var a = e.target.closest && e.target.closest('a[href^="#"]');
            if (!a) return;
            var hash = a.getAttribute('href');
            if (hash.length < 2 || hash.indexOf('#/portal') === 0 || a.hasAttribute('data-portal')) return;
            var target = document.getElementById(decodeURIComponent(hash.slice(1)));
            if (!target) return;
            e.preventDefault();
            Scroller.to(docTop(target) - scrollOffset());
            history.pushState(null, '', hash);
        });
    }

    /* ======================================================================
       5. Sidebar — TOC from post headings, focal-point spy, sprung
          indicator, spring drawer
       ====================================================================== */
    var refreshSpy = function () {};

    function slugify(text) {
        return text.toLowerCase().trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-') || 'section';
    }

    function wordsBetween(start, end, container) {
        try {
            var range = document.createRange();
            range.setStartBefore(start);
            if (end) range.setEndBefore(end); else range.setEndAfter(container.lastChild);
            var text = range.toString().trim();
            return text ? text.split(/\s+/).length : 0;
        } catch (e) { return 0; }
    }

    function initSidebar() {
        var nav = document.getElementById('tocNavList');
        var sidebar = document.getElementById('sidebarNav');
        var toggle = document.getElementById('mobileMenuToggle');
        if (!nav || !sidebar) return;

        /* Sprung indicator that glides between active entries */
        var indicator = document.createElement('div');
        indicator.className = 'toc-indicator';
        nav.insertBefore(indicator, nav.firstChild);
        var renderIndicator = function () {
            indicator.style.transform = 'translate3d(0,' + yS.value + 'px,0)';
            indicator.style.height = Math.max(0, hS.value) + 'px';
        };
        var yS = new Spring(0, { stiffness: 340, damping: 24, precision: 0.2, onUpdate: renderIndicator });
        var hS = new Spring(0, { stiffness: 340, damping: 26, precision: 0.2, onUpdate: renderIndicator });
        var placed = false;

        function moveIndicator(link) {
            if (!link) { indicator.style.opacity = '0'; return; }
            indicator.style.opacity = '1';
            if (!placed) { yS.set(link.offsetTop); hS.set(link.offsetHeight); placed = true; }
            else { yS.to(link.offsetTop); hS.to(link.offsetHeight); }
        }

        /* Build the contents list from the post's headings */
        var tocBox = nav.querySelector('[data-toc]');
        var content = document.querySelector('.gh-content');
        var sections = [];

        if (tocBox && content) {
            var heads = Array.prototype.filter.call(content.querySelectorAll('h2, h3'), function (h) {
                return !h.closest('[data-axiom], .kg-toggle-card, .kg-callout-card, .kg-header-card, .kg-signup-card, .kg-cta-card, .footnotes, .sidenote');
            });
            var used = {};
            var n = 0;

            heads.forEach(function (h, i) {
                if (!h.id) {
                    var base = slugify(h.textContent), id = base, k = 2;
                    while (used[id] || document.getElementById(id)) id = base + '-' + k++;
                    h.id = id;
                }
                used[h.id] = true;

                var isSub = h.tagName === 'H3';
                var link = document.createElement('a');
                link.href = '#' + h.id;
                link.className = 'toc-item' + (isSub ? ' toc-sub' : '');
                var html = '';
                if (!isSub) {
                    n++;
                    var nextMajor = null;
                    for (var j = i + 1; j < heads.length; j++) { if (heads[j].tagName === 'H2') { nextMajor = heads[j]; break; } }
                    var mins = Math.max(1, Math.round(wordsBetween(h, nextMajor, content) / 238));
                    html += '<span class="toc-num">Section ' + String(n).padStart(2, '0') + '</span>';
                    html += '<span class="toc-label"></span>';
                    html += '<span class="toc-duration">' + mins + ' min read</span>';
                } else {
                    html += '<span class="toc-label"></span>';
                }
                html += '<span class="toc-progress" aria-hidden="true"><i></i></span>';
                link.innerHTML = html;
                link.querySelector('.toc-label').textContent = h.textContent;
                tocBox.appendChild(link);
                sections.push({ head: h, link: link });
            });

            if (!sections.length) {
                var lbl = nav.querySelector('[data-toc-label]');
                var fb = nav.querySelector('[data-toc-fallback]');
                if (lbl) lbl.hidden = true;
                if (fb) fb.hidden = false;
            }
        }

        /* Focal-point scroll spy: the reader's eye sits a third of the way down */
        var activeLink = null;
        function spy(force) {
            if (!sections.length) {
                if (force || !placed) moveIndicator(nav.querySelector('.toc-item.nav-current'));
                return;
            }
            var focal = innerHeight * 0.33;
            var contentBottom = content.getBoundingClientRect().bottom;
            var active = sections[0];

            sections.forEach(function (s, i) {
                var top = s.head.getBoundingClientRect().top;
                var end = sections[i + 1] ? sections[i + 1].head.getBoundingClientRect().top : contentBottom;
                if (top <= focal) active = s;
                var p = clamp((focal - top) / Math.max(1, end - top), 0, 1);
                s.link.style.setProperty('--p', p.toFixed(3));
            });

            if (scrollY >= root.scrollHeight - innerHeight - 2) active = sections[sections.length - 1];

            if (active.link === activeLink && !force) return;
            activeLink = active.link;
            sections.forEach(function (s) { s.link.classList.toggle('active', s.link === activeLink); });
            moveIndicator(activeLink);
        }

        var ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () { ticking = false; spy(false); });
        }, { passive: true });
        window.addEventListener('resize', function () { spy(true); });
        refreshSpy = function () { requestAnimationFrame(function () { spy(true); }); };
        spy(true);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(refreshSpy);

        /* Spring drawer (mobile) */
        var scrim = document.createElement('div');
        scrim.className = 'scrim';
        document.body.appendChild(scrim);
        var open = false;

        var drawer = new Spring(-1, {
            stiffness: 380, damping: 28, precision: 0.001,
            onUpdate: function (v) {
                if (!MOBILE_MQ.matches) return;
                sidebar.style.transform = 'translate3d(' + (v * sidebar.offsetWidth) + 'px,0,0)';
                scrim.style.opacity = clamp(1 + v, 0, 1).toFixed(3);
            }
        });

        function setDrawer(next) {
            open = next;
            if (toggle) toggle.setAttribute('aria-expanded', String(open));
            scrim.style.pointerEvents = open ? 'auto' : 'none';
            sidebar.inert = MOBILE_MQ.matches && !open;
            drawer.to(open ? 0 : -1);
            if (open) refreshSpy();
        }

        function syncMode() {
            if (MOBILE_MQ.matches) {
                open = false;
                sidebar.inert = true;
                drawer.set(-1);
            } else {
                drawer.stop();
                sidebar.style.transform = '';
                sidebar.inert = false;
                scrim.style.opacity = '0';
                scrim.style.pointerEvents = 'none';
            }
        }

        if (toggle) toggle.addEventListener('click', function () { setDrawer(!open); });
        scrim.addEventListener('click', function () { setDrawer(false); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) setDrawer(false); });
        sidebar.addEventListener('click', function (e) {
            if (MOBILE_MQ.matches && e.target.closest('a[href^="#"]')) setDrawer(false);
        });
        if (MOBILE_MQ.addEventListener) MOBILE_MQ.addEventListener('change', syncMode);
        else if (MOBILE_MQ.addListener) MOBILE_MQ.addListener(syncMode);
        syncMode();

        /* Highlight the tag pill for the current tag page */
        document.querySelectorAll('.sidebar .filter-tag').forEach(function (t) {
            try {
                if (new URL(t.href).pathname === location.pathname) t.classList.add('active');
            } catch (e) {}
        });
    }

    /* ======================================================================
       6. Footnotes → spring-expanding sidenotes
       Converts Markdown-card footnotes ([^1]) and the manual
       <sup class="sidenote-ref" data-note="id"> + <div class="sidenote" id="id">
       convention.
       ====================================================================== */
    function initFootnotes() {
        var content = document.querySelector('.gh-content');
        if (!content) return;

        var lastInserted = new Map();
        var converted = 0;

        /* Each Markdown card numbers its footnotes from 1, so ids can repeat
           across cards: resolve each ref against the next footnote list after it. */
        var lists = Array.prototype.slice.call(content.querySelectorAll('section.footnotes'));
        var findNote = function (a, id) {
            for (var i = 0; i < lists.length; i++) {
                if (a.compareDocumentPosition(lists[i]) & Node.DOCUMENT_POSITION_FOLLOWING) {
                    var hit = lists[i].querySelector('[id="' + id.replace(/"/g, '\\"') + '"]');
                    if (hit) return hit;
                }
            }
            return document.getElementById(id);
        };

        content.querySelectorAll('sup.footnote-ref > a[href^="#fn"]').forEach(function (a) {
            var li = findNote(a, decodeURIComponent(a.getAttribute('href').slice(1)));
            if (!li) return;
            var sup = a.parentElement;
            var noteId = 'sidenote-' + (++uid) + '-' + li.id;

            var wrap = document.createElement('div');
            wrap.className = 'sidenote';
            wrap.id = noteId;
            var box = document.createElement('div');
            box.className = 'sidenote-box';

            var clone = li.cloneNode(true);
            clone.querySelectorAll('.footnote-backref').forEach(function (n) { n.remove(); });
            var label = document.createElement('strong');
            label.textContent = 'Note ' + a.textContent.replace(/[\[\]]/g, '') + ' • ';
            var firstP = clone.querySelector('p');
            if (firstP) firstP.insertBefore(label, firstP.firstChild); else box.appendChild(label);
            while (clone.firstChild) box.appendChild(clone.firstChild);
            wrap.appendChild(box);

            var block = sup.closest('p, li, blockquote, h2, h3, h4, figure') || sup.parentElement;
            if (block.tagName === 'LI') block = block.closest('ul, ol') || block;
            var after = lastInserted.get(block) || block;
            after.parentNode.insertBefore(wrap, after.nextSibling);
            lastInserted.set(block, wrap);

            a.removeAttribute('href');
            sup.classList.add('sidenote-ref');
            sup.setAttribute('data-note', noteId);
            converted++;
        });

        if (converted) {
            content.querySelectorAll('section.footnotes, hr.footnotes-sep').forEach(function (n) { n.classList.add('is-converted'); });
        }

        content.querySelectorAll('.sidenote-ref[data-note]').forEach(bindSidenote);
    }

    function bindSidenote(ref) {
        var wrap = document.getElementById(ref.getAttribute('data-note'));
        if (!wrap || !wrap.firstElementChild) return;
        var box = wrap.firstElementChild;
        var open = false;
        var full = 1;

        ref.setAttribute('role', 'button');
        ref.setAttribute('tabindex', '0');
        ref.setAttribute('aria-expanded', 'false');
        ref.setAttribute('aria-controls', wrap.id);

        var sp = new Spring(0, {
            stiffness: 300, damping: 21, precision: 0.3,
            onUpdate: function (h, s) {
                var p = clamp(h / full, 0, 1.2);
                wrap.style.height = Math.max(0, h) + 'px';
                box.style.opacity = clamp(p, 0, 1).toFixed(3);
                box.style.transform = 'translateY(' + ((1 - p) * -10) + 'px) scale(' + (0.985 + 0.015 * Math.min(p, 1)) + ')';
                if (!s.running) {
                    if (open) { wrap.style.height = 'auto'; box.style.transform = ''; }
                    else wrap.style.visibility = 'hidden';
                }
            }
        });

        var toggle = function (e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            open = !open;
            ref.setAttribute('aria-expanded', String(open));
            wrap.style.visibility = 'visible';
            var current = wrap.offsetHeight;
            wrap.style.height = current + 'px';
            full = wrap.scrollHeight || 1;
            if (!sp.running) sp.value = current;
            sp.to(open ? full : 0);
            setTimeout(refreshSpy, 60);
        };

        ref.addEventListener('click', toggle);
        ref.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') toggle(e);
        });
    }

    /* ======================================================================
       7. Generative flow field — every <canvas data-field>
       ====================================================================== */
    function initFields() {
        var density = { calm: 0.55, balanced: 1, dense: 1.5 }[(document.body.getAttribute('data-field-density') || 'Balanced').toLowerCase()] || 1;
        document.querySelectorAll('canvas[data-field]').forEach(function (canvas) {
            mountField(canvas, density * (parseFloat(canvas.getAttribute('data-field-scale')) || 1));
        });
    }

    function mountField(canvas, densityScale) {
        var host = canvas.parentElement;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;
        var countEl = host.querySelector('[data-field-count]');
        var fluxEl = host.querySelector('[data-field-flux]');
        var fluxBar = host.querySelector('[data-field-bar]');

        var TRAIL = 10;
        var W = 0, H = 0, particles = [], colors = themeColors();
        var visible = true, energy = 0, lastScroll = scrollY, frame = 0;
        var mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, w: 0, tw: 0 };

        function spawn(p, initial) {
            p.x = Math.random() * W;
            p.y = Math.random() * H;
            p.life = 90 + Math.random() * 180;
            p.age = initial ? Math.random() * p.life : 0;
            p.accent = Math.random() < 0.12;
            p.hx = new Float32Array(TRAIL).fill(p.x);
            p.hy = new Float32Array(TRAIL).fill(p.y);
            p.head = 0;
            return p;
        }

        function resize() {
            var r = canvas.getBoundingClientRect();
            if (!r.width || !r.height) return;
            var dpr = Math.min(2, window.devicePixelRatio || 1);
            W = r.width; H = r.height;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            var n = Math.round(clamp((W * H) / 520, 80, 720) * densityScale);
            particles = [];
            for (var i = 0; i < n; i++) particles.push(spawn({}, true));
            if (countEl) countEl.textContent = n + ' vectors';
            if (REDUCED) drawStatic();
        }

        function angleAt(x, y, t) {
            var s = 0.0034;
            var phase = scrollY * 0.0016;
            return (
                Math.sin(x * s + t * 0.00021 + phase) +
                Math.cos(y * s * 1.35 - t * 0.00016) +
                Math.sin((x + y) * s * 0.5 + t * 0.0001 - phase * 0.6)
            ) * Math.PI * 0.72;
        }

        function drawStatic() {
            ctx.clearRect(0, 0, W, H);
            ctx.strokeStyle = colors.ink;
            ctx.globalAlpha = colors.inkA;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (var y = 14; y < H; y += 26) {
                for (var x = 14; x < W; x += 26) {
                    var a = angleAt(x, y, 0);
                    ctx.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6);
                    ctx.lineTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
                }
            }
            ctx.stroke();
            ctx.globalAlpha = 1;
        }

        window.addEventListener('pointermove', function (e) {
            var r = canvas.getBoundingClientRect();
            mouse.tx = e.clientX - r.left;
            mouse.ty = e.clientY - r.top;
            mouse.tw = (mouse.tx > -40 && mouse.tx < W + 40 && mouse.ty > -40 && mouse.ty < H + 40) ? 1 : 0;
        }, { passive: true });

        function loop(t) {
            if (!visible || document.hidden) return;

            var dy = scrollY - lastScroll;
            lastScroll = scrollY;
            energy = energy * 0.92 + Math.min(2.6, Math.abs(dy) * 0.06) * 0.08 + 0.004;

            mouse.x += (mouse.tx - mouse.x) * 0.12;
            mouse.y += (mouse.ty - mouse.y) * 0.12;
            mouse.w += (mouse.tw - mouse.w) * 0.06;

            var speed = 0.55 + energy * 1.6;
            var R = 160;

            for (var i = 0; i < particles.length; i++) {
                var p = particles[i];
                var a = angleAt(p.x, p.y, t);
                var vx = Math.cos(a), vy = Math.sin(a);

                if (mouse.w > 0.01) {
                    var ddx = p.x - mouse.x, ddy = p.y - mouse.y;
                    var d = Math.hypot(ddx, ddy);
                    if (d < R) {
                        var w = Math.pow(1 - d / R, 2) * mouse.w;
                        var sw = Math.atan2(ddy, ddx) + Math.PI / 2 + 0.35;
                        vx = vx * (1 - w) + Math.cos(sw) * w * 2.2;
                        vy = vy * (1 - w) + Math.sin(sw) * w * 2.2;
                    }
                }

                p.x += vx * speed;
                p.y += vy * speed;
                p.age++;
                p.head = (p.head + 1) % TRAIL;
                p.hx[p.head] = p.x;
                p.hy[p.head] = p.y;

                if (p.age > p.life || p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) spawn(p, false);
            }

            /* trails, oldest → newest, batched per segment age */
            ctx.clearRect(0, 0, W, H);
            ctx.lineCap = 'round';
            [false, true].forEach(function (accent) {
                ctx.strokeStyle = accent ? colors.accent : colors.ink;
                ctx.lineWidth = accent ? 1.3 : 1;
                var base = accent ? colors.accentA : colors.inkA;
                for (var k = 1; k < TRAIL; k++) {
                    ctx.beginPath();
                    for (var i2 = 0; i2 < particles.length; i2++) {
                        var q = particles[i2];
                        if (q.accent !== accent || q.age < TRAIL - k + 1) continue;
                        var i0 = (q.head + k) % TRAIL, i1 = (q.head + k + 1) % TRAIL;
                        ctx.moveTo(q.hx[i0], q.hy[i0]);
                        ctx.lineTo(q.hx[i1], q.hy[i1]);
                    }
                    ctx.globalAlpha = base * (k / TRAIL);
                    ctx.stroke();
                }
            });
            ctx.globalAlpha = 1;

            if (++frame % 10 === 0) {
                var flux = clamp(energy / 1.2, 0, 1);
                if (fluxEl) fluxEl.textContent = 'flux ' + flux.toFixed(2);
                if (fluxBar) fluxBar.style.transform = 'scaleX(' + Math.max(0.06, flux) + ')';
            }
            requestAnimationFrame(loop);
        }

        resize();
        if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host);
        window.addEventListener('axiom:themechange', function () { colors = themeColors(); if (REDUCED) drawStatic(); });

        if (REDUCED) return;

        onVisible(host, function (isVisible) {
            var was = visible;
            visible = isVisible;
            if (visible && !was) requestAnimationFrame(loop);
        });
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && visible) requestAnimationFrame(loop);
        });
        requestAnimationFrame(loop);
    }

    /* ======================================================================
       8. Embeddable components (drop into a Ghost HTML card)
          <div data-axiom="explorer"></div>
          <div data-axiom="topology"></div>
       ====================================================================== */
    var uid = 0;

    function moduleShell(el, title, pill, meta) {
        el.classList.add('interactive-module');
        el.innerHTML =
            '<div class="module-header">' +
                '<div class="module-title"><span></span><span class="module-pill"></span></div>' +
                '<div class="module-actions"></div>' +
            '</div><div class="module-body"></div>';
        el.querySelector('.module-title span').textContent = title;
        el.querySelector('.module-pill').textContent = pill;
        if (meta) {
            var m = document.createElement('span');
            m.className = 'module-meta';
            m.textContent = meta;
            el.querySelector('.module-actions').appendChild(m);
        }
        return { body: el.querySelector('.module-body'), actions: el.querySelector('.module-actions') };
    }

    var DEFAULT_MATRIX = {
        '1-1': 'Interfaces whisper. Tools dissolve into thinking, unmaking boundaries between hands and memory.',
        '1-2': 'Minimal cognitive resistance creates intuitive workflow continuity across exploratory thought sessions.',
        '1-3': 'Protocol efficiency is optimized when human latency asymptotically approaches zero through ambient inference.',
        '2-1': 'The interface acts as a quiet co-pilot, reflecting subtle hints into your stream of consciousness.',
        '2-2': 'When software infers intent, deterministic menus yield to probabilistic manifolds requiring continuous analog steering.',
        '2-3': 'A bi-directional semantic loop where the generative engine models cognitive state tensors and responds in real time.',
        '3-1': 'Ideas cascade like fluid streams. Every concept splits, rejoining the river of thought through recursive feedback loops of light.',
        '3-2': 'Comprehensive cognitive topologies replace discrete stacks, visualizing multidimensional vector branches as topological terrain.',
        '3-3': 'Formal state topologies represent non-Markovian decision networks wherein human creative heuristics guide stochastic sampling trajectories.'
    };

    function mountExplorer(el) {
        var data = el.dataset;
        var matrix = DEFAULT_MATRIX;
        var json = el.querySelector('script[type="application/json"]');
        if (json) { try { matrix = JSON.parse(json.textContent); } catch (e) {} }

        var xLabel = data.xLabel || 'Information Density';
        var yLabel = data.yLabel || 'Register & Stance';
        var xs = (data.x || 'Sparse / Concise|Balanced|Dense / Deep').split('|');
        var ys = (data.y || 'Poetic / Intuitive|Academic|Systemic / Formal').split('|');

        var shell = moduleShell(el, data.title || 'Semantic Dimension Explorer', data.pill || 'Interactive Probe', 'Live Parametric DOM');
        var idX = 'axiom-x-' + (++uid), idY = 'axiom-y-' + uid;
        shell.body.innerHTML =
            '<div class="latent-controls">' +
                '<div class="control-item"><label class="control-label" for="' + idX + '"><span class="lx"></span><span class="vx"></span></label>' +
                '<input type="range" id="' + idX + '" min="1" max="' + xs.length + '" step="1" value="' + Math.ceil(xs.length / 2) + '"></div>' +
                '<div class="control-item"><label class="control-label" for="' + idY + '"><span class="ly"></span><span class="vy"></span></label>' +
                '<input type="range" id="' + idY + '" min="1" max="' + ys.length + '" step="1" value="' + Math.ceil(ys.length / 2) + '"></div>' +
            '</div>' +
            '<div class="latent-projection"><div class="preview-text" aria-live="polite"></div></div>';

        var sx = shell.body.querySelector('#' + idX), sy = shell.body.querySelector('#' + idY);
        shell.body.querySelector('.lx').textContent = xLabel;
        shell.body.querySelector('.ly').textContent = yLabel;
        var vx = shell.body.querySelector('.vx'), vy = shell.body.querySelector('.vy');
        var preview = shell.body.querySelector('.preview-text');

        var fill = function (s) { s.style.setProperty('--fill', ((s.value - s.min) / Math.max(1, s.max - s.min)) * 100 + '%'); };
        var lastKey = null, timer = null;

        function update(initial) {
            fill(sx); fill(sy);
            vx.textContent = xs[sx.value - 1];
            vy.textContent = ys[sy.value - 1];
            var key = sx.value + '-' + sy.value;
            if (key === lastKey) return;
            lastKey = key;
            var text = '“' + (matrix[key] || '') + '”';

            if (initial || REDUCED) { preview.textContent = text; return; }
            clearTimeout(timer);
            preview.classList.add('is-leaving');
            timer = setTimeout(function () {
                preview.textContent = text;
                preview.classList.remove('is-leaving');
                preview.classList.add('is-entering');
                void preview.offsetWidth;
                preview.classList.remove('is-entering');
            }, 120);
        }

        sx.addEventListener('input', function () { update(false); });
        sy.addEventListener('input', function () { update(false); });
        update(true);
    }

    function mountTopology(el) {
        var data = el.dataset;
        var SEEDS = (data.seeds || 'Latent Root,Branch Alpha,Branch Beta,Stochastic Probe').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
        var LABELS = (data.labels || 'Hypothesis,Reframe,Analogy,Constraint,Counterfactual,Synthesis,Tangent,Critique,Prior,Divergence,Echo,Inference').split(',').map(function (s) { return s.trim(); });

        var shell = moduleShell(el, data.title || 'Dynamic State Topology', data.pill || 'Spring Physics');
        var stats = document.createElement('span');
        stats.className = 'module-meta';
        var inject = document.createElement('button');
        inject.type = 'button';
        inject.className = 'theme-toggle-btn';
        inject.textContent = 'Inject Node';
        shell.actions.appendChild(stats);
        shell.actions.appendChild(inject);

        shell.body.innerHTML =
            '<div class="canvas-container" style="height:' + (parseInt(data.height, 10) || 260) + 'px">' +
                '<canvas aria-label="Force-directed graph of thought nodes"></canvas>' +
                '<span class="canvas-hint">Click to seed a thought • Drag to perturb • Release to fling</span>' +
            '</div>';

        var canvas = shell.body.querySelector('canvas');
        var ctx = canvas.getContext('2d');
        var W = 0, H = 0, colors = themeColors();
        var nodes = [], edges = [];
        var drag = null, hover = null, visible = true;
        var ptr = { x: 0, y: 0, vx: 0, vy: 0, t: 0 };
        var REST = 86, tension = 0, frame = 0;

        function resize() {
            var r = canvas.getBoundingClientRect();
            if (!r.width) return;
            var oldW = W || r.width, oldH = H || r.height;
            var dpr = Math.min(2, window.devicePixelRatio || 1);
            W = r.width; H = r.height;
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            nodes.forEach(function (n) { n.x *= W / oldW; n.y *= H / oldH; });
        }

        function addNode(x, y, label, linkTo, seed) {
            var n = {
                x: x, y: y,
                vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3,
                r: 5 + Math.random() * 3, s: 0, sv: 0,
                label: label || LABELS[Math.floor(Math.random() * LABELS.length)],
                seed: !!seed
            };
            if (linkTo) {
                linkTo.forEach(function (t) { edges.push([t, n]); });
            } else if (nodes.length) {
                var best = null, bd = Infinity;
                nodes.forEach(function (m) { var d = Math.hypot(m.x - x, m.y - y); if (d < bd) { bd = d; best = m; } });
                edges.push([best, n]);
            }
            nodes.push(n);
            if (nodes.length > 36) {
                var victim = nodes.find(function (m) { return !m.seed && m !== drag; });
                if (victim) {
                    nodes = nodes.filter(function (m) { return m !== victim; });
                    edges = edges.filter(function (e) { return e[0] !== victim && e[1] !== victim; });
                }
            }
            return n;
        }

        function seed() {
            nodes = []; edges = [];
            SEEDS.forEach(function (label, i) {
                var ang = (i / Math.max(1, SEEDS.length)) * Math.PI * 2;
                var x = W / 2 + Math.cos(ang) * Math.min(W, H) * 0.3;
                var y = H / 2 + Math.sin(ang) * Math.min(W, H) * 0.3;
                var links = i === 0 ? [] : [nodes[Math.floor((i - 1) / 2)]];
                addNode(x, y, label, links, true);
            });
        }

        function hit(x, y) {
            for (var i = nodes.length - 1; i >= 0; i--) {
                if (Math.hypot(nodes[i].x - x, nodes[i].y - y) < nodes[i].r + 9) return nodes[i];
            }
            return null;
        }

        function local(e) {
            var r = canvas.getBoundingClientRect();
            return { x: e.clientX - r.left, y: e.clientY - r.top };
        }

        canvas.addEventListener('pointerdown', function (e) {
            var p = local(e);
            canvas.setPointerCapture(e.pointerId);
            ptr.x = p.x; ptr.y = p.y; ptr.vx = 0; ptr.vy = 0; ptr.t = performance.now();
            var n = hit(p.x, p.y);
            if (n) { drag = n; n.sv += 0.25; canvas.className = 'grabbing'; }
            else addNode(p.x, p.y);
            if (REDUCED) settle();
        });

        canvas.addEventListener('pointermove', function (e) {
            var p = local(e);
            var now = performance.now();
            var dt = Math.max(8, now - ptr.t);
            ptr.vx = ptr.vx * 0.5 + ((p.x - ptr.x) / dt) * 16 * 0.5;
            ptr.vy = ptr.vy * 0.5 + ((p.y - ptr.y) / dt) * 16 * 0.5;
            ptr.x = p.x; ptr.y = p.y; ptr.t = now;
            if (drag) {
                drag.x = clamp(p.x, 10, W - 10);
                drag.y = clamp(p.y, 10, H - 10);
                if (REDUCED) draw();
            } else {
                hover = hit(p.x, p.y);
                canvas.className = hover ? 'grab' : '';
            }
        });

        var release = function () {
            if (!drag) return;
            drag.vx = clamp(ptr.vx, -18, 18);
            drag.vy = clamp(ptr.vy, -18, 18);
            drag = null;
            canvas.className = hover ? 'grab' : '';
            if (REDUCED) settle();
        };
        canvas.addEventListener('pointerup', release);
        canvas.addEventListener('pointercancel', release);
        canvas.addEventListener('pointerleave', function () { if (!drag) { hover = null; canvas.className = ''; } });

        inject.addEventListener('click', function () {
            var parent = nodes[Math.floor(Math.random() * nodes.length)];
            var ang = Math.random() * Math.PI * 2;
            var n = addNode(parent.x + Math.cos(ang) * 20, parent.y + Math.sin(ang) * 20, null, [parent]);
            n.vx = Math.cos(ang) * 6; n.vy = Math.sin(ang) * 6;
            if (REDUCED) settle();
        });

        function step() {
            var i, j, a, b, dx, dy, d, d2, f;
            for (i = 0; i < nodes.length; i++) {
                a = nodes[i];
                for (j = i + 1; j < nodes.length; j++) {
                    b = nodes[j];
                    dx = b.x - a.x; dy = b.y - a.y;
                    d2 = Math.max(dx * dx + dy * dy, 120);
                    d = Math.sqrt(d2);
                    f = 1400 / d2;
                    dx /= d; dy /= d;
                    a.vx -= dx * f; a.vy -= dy * f;
                    b.vx += dx * f; b.vy += dy * f;
                }
            }
            var stretch = 0;
            edges.forEach(function (e) {
                var ea = e[0], eb = e[1];
                var ex = eb.x - ea.x, ey = eb.y - ea.y;
                var ed = Math.max(1, Math.hypot(ex, ey));
                var ef = (ed - REST) * 0.018;
                stretch += Math.abs(ed - REST) / REST;
                ea.vx += ex / ed * ef; ea.vy += ey / ed * ef;
                eb.vx -= ex / ed * ef; eb.vy -= ey / ed * ef;
            });
            tension = tension * 0.9 + (edges.length ? stretch / edges.length : 0) * 0.1;

            nodes.forEach(function (n) {
                n.sv += (1 - n.s) * 0.2; n.sv *= 0.72; n.s += n.sv;
                if (n === drag) { n.vx = n.vy = 0; return; }
                n.vx += (W / 2 - n.x) * 0.0006;
                n.vy += (H / 2 - n.y) * 0.0012;
                n.vx += (Math.random() - 0.5) * 0.05;
                n.vy += (Math.random() - 0.5) * 0.05;
                var m = 18;
                if (n.x < m) n.vx += (m - n.x) * 0.08;
                if (n.x > W - m) n.vx -= (n.x - (W - m)) * 0.08;
                if (n.y < m) n.vy += (m - n.y) * 0.08;
                if (n.y > H - m) n.vy -= (n.y - (H - m)) * 0.08;
                n.vx *= 0.86; n.vy *= 0.86;
                n.x += n.vx; n.y += n.vy;
            });
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            var i, j, d;

            ctx.lineWidth = 1;
            ctx.strokeStyle = colors.ink;
            ctx.globalAlpha = 0.06;
            ctx.beginPath();
            for (i = 0; i < nodes.length; i++) {
                for (j = i + 1; j < nodes.length; j++) {
                    d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
                    if (d < 150) { ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y); }
                }
            }
            ctx.stroke();

            ctx.strokeStyle = colors.accent;
            edges.forEach(function (e) {
                var ed = Math.hypot(e[1].x - e[0].x, e[1].y - e[0].y);
                var t = clamp(Math.abs(ed - REST) / REST, 0, 1);
                ctx.globalAlpha = 0.22 + t * 0.5;
                ctx.lineWidth = 1 + t * 0.8;
                ctx.beginPath(); ctx.moveTo(e[0].x, e[0].y); ctx.lineTo(e[1].x, e[1].y); ctx.stroke();
            });

            ctx.font = '10px "JetBrains Mono", monospace';
            nodes.forEach(function (n) {
                var r = Math.max(0, n.r * n.s);
                if (n === hover || n === drag) {
                    ctx.globalAlpha = 0.14;
                    ctx.fillStyle = colors.accent;
                    ctx.beginPath(); ctx.arc(n.x, n.y, r + 7, 0, Math.PI * 2); ctx.fill();
                }
                ctx.globalAlpha = 1;
                ctx.fillStyle = colors.accent;
                ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = clamp(n.s, 0, 1);
                ctx.fillStyle = colors.secondary;
                ctx.fillText(n.label, n.x + r + 6, n.y + 3);
            });
            ctx.globalAlpha = 1;
        }

        function settle() { for (var i = 0; i < 160; i++) step(); draw(); updateStats(); }
        function updateStats() { stats.textContent = nodes.length + ' nodes • tension ' + tension.toFixed(2); }

        function loop() {
            if (!visible) return;
            step(); draw();
            if (++frame % 12 === 0) updateStats();
            requestAnimationFrame(loop);
        }

        resize(); seed(); updateStats();
        if ('ResizeObserver' in window) new ResizeObserver(function () { resize(); if (REDUCED) draw(); }).observe(canvas);
        window.addEventListener('axiom:themechange', function () { colors = themeColors(); if (REDUCED) draw(); });

        if (REDUCED) { settle(); return; }

        onVisible(canvas, function (isVisible) {
            var was = visible;
            visible = isVisible;
            if (visible && !was) requestAnimationFrame(loop);
        });
        requestAnimationFrame(loop);
    }

    function initComponents() {
        document.querySelectorAll('[data-axiom="explorer"]').forEach(mountExplorer);
        document.querySelectorAll('[data-axiom="topology"]').forEach(mountTopology);
    }

    /* ======================================================================
       9. Reveal on scroll — sprung entrance
       ====================================================================== */
    function initReveal() {
        var content = document.querySelector('.gh-content');
        if (content && !REDUCED) {
            content.querySelectorAll(':scope > figure, :scope > .kg-card, :scope > .interactive-module, :scope > pre').forEach(function (el) {
                if (el.getBoundingClientRect().top > innerHeight) el.classList.add('reveal');
            });
        }

        var items = document.querySelectorAll('.reveal');
        if (REDUCED || !('IntersectionObserver' in window)) {
            items.forEach(function (el) { el.classList.add('in'); });
            return;
        }
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
            });
        }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
        items.forEach(function (el) { io.observe(el); });
    }

    /* ======================================================================
       10. Deep links
       ====================================================================== */
    function initDeepLinking() {
        var go = function () {
            var hash = window.location.hash;
            if (!hash || hash.indexOf('#/') === 0) return;
            var target = document.getElementById(decodeURIComponent(hash.slice(1)));
            if (!target) return;
            Scroller.to(docTop(target) - scrollOffset());
        };
        (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(function () { setTimeout(go, 120); });
        window.addEventListener('popstate', go);
    }

    /* ======================================================================
       Boot
       ====================================================================== */
    function boot() {
        installSpringEasings();
        initReadingProgress();
        initThemeEngine();
        initAmbientLayer();
        initScroller();
        initAnchorLinks();
        initComponents();
        initFootnotes();
        initSidebar();
        initFields();
        initReveal();
        initDeepLinking();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
