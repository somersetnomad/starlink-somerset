/* Rural Signal: adapts Jekyll's output to the Axiom theme script.
   Loaded just before axiom.js, at the end of <body>, so the content is
   already parsed and these changes are in place when Axiom boots. */
(function () {
  'use strict';

  var content = document.querySelector('.gh-content');

  /* 1. Footnotes: kramdown → the Ghost/markdown-it markup Axiom converts
        into spring-expanding sidenotes. */
  if (content) {
    content.querySelectorAll('a.footnote[href^="#fn"]').forEach(function (a) {
      if (a.parentElement && a.parentElement.tagName === 'SUP') a.parentElement.classList.add('footnote-ref');
    });
    content.querySelectorAll('a.reversefootnote').forEach(function (a) { a.classList.add('footnote-backref'); });
    content.querySelectorAll('div.footnotes').forEach(function (div) {
      var section = document.createElement('section');
      section.className = 'footnotes';
      while (div.firstChild) section.appendChild(div.firstChild);
      div.parentNode.replaceChild(section, div);
    });
  }

  /* 2. Transcript fold: a "Transcript" H2 and everything after it fold away. */
  if (content) {
    var heads = content.querySelectorAll(':scope > h2');
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].textContent.trim().toLowerCase() !== 'transcript') continue;
      var h = heads[i];
      var details = document.createElement('details');
      details.className = 'transcript-fold';
      var summary = document.createElement('summary');
      h.parentNode.insertBefore(details, h);
      summary.appendChild(h);
      details.appendChild(summary);
      var next = details.nextSibling;
      while (next && !(next.nodeType === 1 && next.classList.contains('footnotes'))) {
        var move = next;
        next = next.nextSibling;
        details.appendChild(move);
      }
      break;
    }
  }

  /* 3. Timestamps: "- 12:30 Topic" bullets become buttons that seek the player. */
  var audio = document.querySelector('[data-episode] audio');
  if (content && audio) {
    var re = /^\s*((?:\d{1,2}:)?\d{1,2}:\d{2})(?=\s)/;
    content.querySelectorAll('li').forEach(function (li) {
      var node = li.firstChild;
      while (node && node.nodeType === 1 && node.tagName === 'P') node = node.firstChild;
      if (!node || node.nodeType !== 3) return;
      var m = node.nodeValue.match(re);
      if (!m) return;
      var parts = m[1].split(':').map(Number);
      var secs = parts.reduce(function (acc, n) { return acc * 60 + n; }, 0);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'timestamp';
      btn.textContent = m[1];
      btn.setAttribute('aria-label', 'Play from ' + m[1]);
      btn.addEventListener('click', function () {
        audio.currentTime = secs;
        var p = audio.play();
        if (p && p.catch) p.catch(function () {});
      });
      node.nodeValue = node.nodeValue.slice(m[0].length);
      node.parentNode.insertBefore(btn, node);
    });
  }

  /* 4. Essay template: reading focus and margin notes (after Axiom boots). */
  var isEssay = document.body.classList.contains('post-template-custom-essay');
  if (content && isEssay) {
    var afterAxiom = function () {
      setTimeout(function () {
        content.classList.add('margin-notes');
        var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduce || !('IntersectionObserver' in window)) return;
        var blocks = content.querySelectorAll(':scope > p, :scope > ul, :scope > ol, :scope > blockquote');
        var current = null;
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            if (current) current.classList.remove('is-focus');
            current = e.target;
            current.classList.add('is-focus');
            content.classList.add('has-focus');
          });
        }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });
        blocks.forEach(function (b) { io.observe(b); });
      }, 0);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', afterAxiom);
    else afterAxiom();
  }

  /* 5. Search: replaces Ghost's built-in search with a small static index. */
  var box = document.getElementById('siteSearch');
  if (box) {
    var input = document.getElementById('siteSearchInput');
    var list = document.getElementById('siteSearchResults');
    var index = null;
    var lastFocus = null;

    var esc = function (s) {
      return String(s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    };
    var mark = function (text, terms) {
      var out = esc(text);
      terms.forEach(function (t) {
        out = out.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi'), '<mark>$1</mark>');
      });
      return out;
    };
    var snippet = function (body, terms) {
      var lower = body.toLowerCase();
      var at = lower.indexOf(terms[0]);
      if (at < 0) return '';
      var start = Math.max(0, at - 60);
      return (start > 0 ? '… ' : '') + body.slice(start, at + 120).trim() + ' …';
    };

    var render = function () {
      var q = input.value.trim().toLowerCase();
      list.innerHTML = '';
      if (!index) return;
      var terms = q.split(/\s+/).filter(Boolean);
      var hits = index.filter(function (p) {
        if (!terms.length) return true;
        var hay = (p.title + ' ' + p.excerpt + ' ' + p.tags.join(' ') + ' ' + p.body).toLowerCase();
        return terms.every(function (t) { return hay.indexOf(t) > -1; });
      });
      if (!hits.length) {
        list.innerHTML = '<li class="site-search-empty">No guides match that yet.</li>';
        return;
      }
      hits.slice(0, 12).forEach(function (p) {
        var li = document.createElement('li');
        var extra = terms.length ? snippet(p.body, terms) : '';
        li.innerHTML = '<a href="' + esc(p.url) + '">' +
          '<span class="r-title">' + mark(p.title, terms) + '</span>' +
          '<span class="r-meta">' + esc(p.date) + (p.tags.length ? ' // ' + esc(p.tags.join(', ')) : '') + '</span>' +
          '<span class="r-text">' + mark(extra || p.excerpt || '', terms) + '</span></a>';
        list.appendChild(li);
      });
    };

    var open = function () {
      lastFocus = document.activeElement;
      box.hidden = false;
      document.documentElement.style.overflow = 'hidden';
      input.focus();
      if (index) { render(); return; }
      fetch(box.getAttribute('data-index'))
        .then(function (r) { return r.json(); })
        .then(function (data) { index = data; render(); })
        .catch(function () { list.innerHTML = '<li class="site-search-empty">Search is unavailable right now.</li>'; });
    };
    var close = function () {
      box.hidden = true;
      document.documentElement.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    document.querySelectorAll('[data-site-search]').forEach(function (b) { b.addEventListener('click', open); });
    box.querySelectorAll('[data-search-close]').forEach(function (b) { b.addEventListener('click', close); });
    input.addEventListener('input', render);
    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || '') || (e.target && e.target.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); box.hidden ? open() : close(); return; }
      if (e.key === '/' && box.hidden && !typing) { e.preventDefault(); open(); return; }
      if (e.key === 'Escape' && !box.hidden) close();
    });
  }
})();
