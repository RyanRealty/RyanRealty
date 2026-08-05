/**
 * rr-cma-doc — the interactive layer for served CMA documents (screen only).
 *
 * The stored html_content is a pure print-grade artifact; the /cma/[slug]
 * route injects this script at serve time (next to rr-doc-tracker.js), so the
 * web experience gains navigation + motion while the PDF path — which renders
 * the stored HTML directly — never sees any of it. That is the §0 guarantee:
 * one artifact, identical numbers in both media, zero content hiding.
 *
 * What it adds, all progressive enhancement:
 *   1. A sticky top bar after the cover scrolls away: address, a reading
 *      progress bar, and a Contents menu built from the document's own
 *      section headings (scroll-spy highlights the current one).
 *   2. Fade-up reveal on each page's content blocks (300ms, 16px travel,
 *      ease-out — the §3 motion ladder), gated behind an html-level class so
 *      no-JS and print render everything static and visible.
 *   3. A one-time count-up on stat values when they first scroll into view.
 *      The markup always holds the final verified number; motion ends there.
 *   All of it is skipped under prefers-reduced-motion.
 */
(function () {
  try {
    if (window.matchMedia && window.matchMedia('print').matches) return
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    var pages = Array.prototype.slice.call(document.querySelectorAll('section.page'))
    if (pages.length < 3) return

    // ── Styles (screen-scoped; the hidden reveal state exists ONLY under
    //    html.rr-anim, which this script adds — print and no-JS never hide) ──
    var css = [
      '@media screen {',
      '#rr-docbar{position:fixed;top:0;left:0;right:0;z-index:60;background:rgba(250,248,244,0.96);backdrop-filter:blur(8px);border-bottom:1px solid rgba(16,39,66,0.12);transform:translateY(-110%);transition:transform .3s ease-out;font-family:inherit;}',
      '#rr-docbar.on{transform:translateY(0);}',
      '#rr-docbar .bar-in{max-width:1040px;margin:0 auto;display:flex;align-items:center;gap:16px;padding:10px 20px;}',
      '#rr-docbar .bar-t{color:#102742;font-size:14px;font-weight:600;letter-spacing:.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;}',
      '#rr-docbar .bar-btn{color:#102742;background:none;border:1px solid rgba(16,39,66,0.25);border-radius:999px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:.04em;text-transform:uppercase;}',
      '#rr-docbar .bar-btn:hover{background:rgba(16,39,66,0.06);}',
      '#rr-prog{position:absolute;bottom:-1px;left:0;height:2px;background:#102742;width:0;transition:width .15s linear;}',
      '#rr-toc{position:fixed;top:52px;right:16px;z-index:61;background:#faf8f4;border:1px solid rgba(16,39,66,0.15);border-radius:14px;box-shadow:0 12px 32px rgb(16 39 66 / 0.18);padding:10px;max-height:70vh;overflow:auto;min-width:280px;display:none;}',
      '#rr-toc.open{display:block;}',
      '#rr-toc a{display:block;color:#102742;text-decoration:none;font-size:13px;padding:7px 12px;border-radius:8px;line-height:1.35;}',
      '#rr-toc a:hover{background:rgba(16,39,66,0.06);}',
      '#rr-toc a.now{background:rgba(16,39,66,0.09);font-weight:600;}',
      'html.rr-anim .rr-rv{opacity:0;transform:translateY(16px);}',
      'html.rr-anim .rr-rv.rr-in{opacity:1;transform:none;transition:opacity .3s ease-out,transform .3s ease-out;}',
      '}',
    ].join('\n')
    var styleEl = document.createElement('style')
    styleEl.textContent = css
    document.head.appendChild(styleEl)

    // ── Section map from the document's own headings ──
    var sections = []
    pages.forEach(function (pg, i) {
      var h = pg.querySelector('h2.section, h2')
      if (!pg.id) pg.id = 'rr-pg-' + (i + 1)
      if (h && h.textContent.trim()) sections.push({ id: pg.id, label: h.textContent.trim(), el: pg })
    })

    // ── Sticky bar + contents menu ──
    var subject = document.title.replace(/^CMA\s*·\s*/, '')
    var bar = document.createElement('div')
    bar.id = 'rr-docbar'
    bar.innerHTML =
      '<div class="bar-in"><div class="bar-t"></div><button class="bar-btn" type="button" aria-haspopup="true" aria-expanded="false">Contents</button></div><div id="rr-prog"></div>'
    bar.querySelector('.bar-t').textContent = subject
    document.body.appendChild(bar)
    var toc = document.createElement('nav')
    toc.id = 'rr-toc'
    toc.setAttribute('aria-label', 'Report contents')
    sections.forEach(function (s) {
      var a = document.createElement('a')
      a.href = '#' + s.id
      a.textContent = s.label
      a.addEventListener('click', function (ev) {
        ev.preventDefault()
        toc.classList.remove('open')
        btn.setAttribute('aria-expanded', 'false')
        s.el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
      })
      toc.appendChild(a)
    })
    document.body.appendChild(toc)
    var btn = bar.querySelector('.bar-btn')
    btn.addEventListener('click', function () {
      var open = toc.classList.toggle('open')
      btn.setAttribute('aria-expanded', open ? 'true' : 'false')
    })
    document.addEventListener('click', function (ev) {
      if (!toc.contains(ev.target) && !btn.contains(ev.target)) {
        toc.classList.remove('open')
        btn.setAttribute('aria-expanded', 'false')
      }
    })

    var prog = bar.querySelector('#rr-prog')
    // Plain handler on purpose: an rAF throttle wedges in tabs that load
    // hidden (the callback never fires, the gate flag never clears), and the
    // work here is one class toggle + a dozen rect reads.
    function onScroll() {
      var max = document.documentElement.scrollHeight - window.innerHeight
      var y = window.scrollY || 0
      bar.classList.toggle('on', y > 500)
      prog.style.width = (max > 0 ? Math.min(100, (y / max) * 100) : 0) + '%'
      // Scroll-spy: the deepest section whose top has passed mid-viewport.
      var current = null
      for (var i = 0; i < sections.length; i++) {
        if (sections[i].el.getBoundingClientRect().top < window.innerHeight * 0.5) current = sections[i].id
      }
      var links = toc.querySelectorAll('a')
      for (var j = 0; j < links.length; j++) {
        links[j].classList.toggle('now', links[j].getAttribute('href') === '#' + current)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    if (reduced || !('IntersectionObserver' in window)) return

    // ── Reveal-on-scroll ──
    document.documentElement.classList.add('rr-anim')
    var blocks = []
    pages.forEach(function (pg) {
      var kids = pg.querySelectorAll(
        ':scope > h2, :scope > p, :scope > .stat-strip, :scope > .chart-block, :scope > table, :scope > ul, :scope > .trace, :scope > h3'
      )
      Array.prototype.forEach.call(kids, function (el, i) {
        el.classList.add('rr-rv')
        el.style.transitionDelay = Math.min(i * 45, 270) + 'ms'
        blocks.push(el)
      })
    })
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('rr-in')
            io.unobserve(e.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px' }
    )
    blocks.forEach(function (b) { io.observe(b) })
    // Failsafe: verified content must NEVER stay hidden behind motion. If the
    // observer stalls (hidden tab, odd embedder), everything reveals anyway.
    setTimeout(function () {
      blocks.forEach(function (b) { b.classList.add('rr-in') })
    }, 4000)

    // ── Count-up on stat values (ends at the exact markup number) ──
    var statEls = document.querySelectorAll('.stat .val')
    var live = []
    function snapAll() {
      // The verified number must be on screen the instant motion cannot be
      // trusted: print, tab hide, page leave.
      live.forEach(function (a) {
        a.done = true
        a.el.textContent = a.final
      })
      live = []
    }
    window.addEventListener('beforeprint', snapAll)
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') snapAll()
    })
    var cio = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return
          cio.unobserve(e.target)
          var el = e.target
          var finalText = el.textContent
          var m = /^([^0-9]*)([\d,]+(?:\.\d+)?)(.*)$/.exec(finalText.trim())
          if (!m) return
          var target = parseFloat(m[2].replace(/,/g, ''))
          if (!isFinite(target) || target === 0) return
          var decimals = (m[2].split('.')[1] || '').length
          var anim = { el: el, final: finalText, done: false }
          live.push(anim)
          var t0 = null
          var DUR = 700
          function frame(ts) {
            if (anim.done) return
            if (t0 == null) t0 = ts
            var p = Math.min(1, (ts - t0) / DUR)
            var eased = 1 - Math.pow(1 - p, 3)
            var v = target * eased
            var txt = decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString('en-US')
            el.textContent = m[1] + txt + m[3]
            if (p < 1) requestAnimationFrame(frame)
            else {
              anim.done = true
              el.textContent = anim.final
              live = live.filter(function (a) { return a !== anim })
            }
          }
          requestAnimationFrame(frame)
        })
      },
      { rootMargin: '0px 0px -10% 0px' }
    )
    Array.prototype.forEach.call(statEls, function (el) { cio.observe(el) })
  } catch (e) {
    /* the document must render perfectly without this layer */
  }
})()
