/**
 * The web document's interaction layer.
 *
 * docs/plans/CMA_REIMAGINED_2026-09-07.md, Delta 2 (Matt): "it must be
 * beautiful, interactive and engaging", and TASTE.md's third question — every
 * data section gives the reader something to do that reveals MORE DATA.
 *
 * Three rules this file exists to keep:
 *
 * 1. **Nothing here derives a figure.** Every reading a tap prints was
 *    composed at render, off `render_args`, and put on the element as
 *    `data-read` (or as `data-events` for a price path). The one exception is
 *    the offer-timing scrub, which interpolates BETWEEN two measured points on
 *    the curve it is scrubbing and says so in the reading it prints — the
 *    measured points themselves are named, never rounded away.
 * 2. **Nothing here is required to read the document.** Every control is
 *    BUILT BY THIS SCRIPT, so the print letter and a reader with no JavaScript
 *    see the document whole and see no dead buttons. Nothing a reader needs
 *    hides behind a hover (dataviz skill, step 5).
 * 3. **Keyboard and touch, both, everywhere.** Every hit target the renderers
 *    stamp carries `tabindex` and `role="button"`, so the handlers listen for
 *    click AND for Enter/Space, and the scrub takes arrow keys. Motion honours
 *    `prefers-reduced-motion`: the draw-on-enter is skipped entirely and the
 *    line is simply there.
 *
 * No library. The site loads none on this document and this adds none.
 */

/** The stylesheet the controls and the readouts need. Immersive only. */
export function immersiveInteractionCss(): string {
  return `
/* ── the interactive layer (Delta 2) ─────────────────────────────────────── */
/* Every control below is created by script, so print never sees one. */
@media print{.rr-controls,.rr-read,.pp-list,.pp-toggle{display:none!important}}
.rr-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:14px 0 10px}
.rr-controls .rr-lbl{font-size:13px;opacity:.6;margin-right:2px}
.rr-btn{font:inherit;font-size:13px;line-height:1;color:var(--navy);background:transparent;border:1px solid var(--ink12);border-radius:10px;padding:12px 16px;cursor:pointer;min-height:44px}
.rr-btn:hover{border-color:var(--navy)}
.rr-btn:focus-visible{outline:3px solid rgba(16,39,66,.35);outline-offset:2px}
.rr-btn[aria-pressed="true"]{background:var(--navy);color:var(--cream);border-color:var(--navy)}
/* The live line every tap writes into. It holds its height so a tap does not
   reflow the section under the reader's thumb. */
.rr-read{min-height:1.5em;margin:6px 0 0;font-size:15px;line-height:1.5;color:var(--navy)}
.rr-read:empty::before{content:attr(data-hint);opacity:.5}
/* A mark whose answer is short is answered AT THE MARK, so the eye never
   leaves the drawing — the readout under the figure sat up to a chart's full
   height below the thing the reader had just tapped. The sentence still goes
   to the live region for a screen reader; it is only taken out of the flow. */
.rr-read.is-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap;min-height:0}
.rr-note text{font-family:inherit;font-weight:600;fill:var(--navy)}
.rr-note rect{fill:var(--cream);stroke:rgba(16,39,66,.22);stroke-width:.75}
/* Marks that answer a tap SAY SO, with a ring around the dot — the affordance
   is the mark, never a sentence under the chart telling a reader to tap it. */
.tl-mark,.bar-row,.month-mark,.pp-cut,.ws-dot{cursor:pointer}
.tl-mark:focus-visible,.bar-row:focus-visible,.month-mark:focus-visible,.pp-cut:focus-visible,.ws-dot:focus-visible{outline:3px solid rgba(16,39,66,.35)}
.tl-mark circle:last-of-type,.month-mark circle:last-of-type,.ws-dot circle:last-of-type{stroke:rgba(16,39,66,.16);stroke-width:5;paint-order:stroke}
/* A SET-ASIDE sale is hollow, and stays hollow: the soft focus ring above is
   a :last-of-type rule, and CSS beats the element's own stroke attribute, so
   the hollow mark rendered as a washed-out blob until this took it back. */
.ws-dot circle.ws-aside{stroke:var(--navy);stroke-width:1.75;paint-order:normal}
.tl-mark:hover circle:last-of-type,.month-mark:hover circle:last-of-type,.ws-dot:hover circle:last-of-type{stroke:rgba(16,39,66,.45)}
.bar-row.is-read rect{fill:rgba(16,39,66,.06)}
.tl-mark.is-read circle:last-of-type,.month-mark.is-read circle:last-of-type,.ws-dot.is-read circle:last-of-type{r:6;stroke:var(--navy)}
/* The marker carries opacity="0" on the element so the PRINT letter, which
   loads none of this, never draws a stray dashed line at day zero. A class
   beats a presentation attribute, so the scrub still appears here. */
.scrub{opacity:0;transition:opacity .2s ease-out}
/* The endpoint label sits under the last point, which is where the scrub lands
   when a reader drags to the end — the marker's dashed rule ran straight
   through "by day 180". While the reader is scrubbing, the scrub's own reading
   is the label, so the static one steps aside. */
.curve-scrub.is-scrubbing .curve-end{opacity:0}
.curve-scrub.is-scrubbing .scrub{opacity:1}
.scrub-hit{cursor:ew-resize}
/* The dated history behind a drawn price path. */
.pp-toggle{display:inline-flex;align-items:center;gap:8px;font:inherit;font-size:13px;color:var(--navy);background:transparent;border:0;border-bottom:1px solid var(--ink12);padding:12px 0;cursor:pointer;min-height:44px}
.pp-toggle:hover{border-bottom-color:var(--navy)}
/* The control says it opens. No sentence under the chart has to. */
.pp-chev{width:8px;height:8px;border-right:1.5px solid var(--navy);border-bottom:1.5px solid var(--navy);transform:rotate(45deg) translate(-2px,-2px);transition:transform .2s ease-out}
.pp-toggle[aria-expanded="true"] .pp-chev{transform:rotate(-135deg) translate(-2px,-2px)}
.pp-list{list-style:none;margin:6px 0 2px;padding:0;font-size:14px}
.pp-list li{display:flex;justify-content:space-between;gap:16px;padding:5px 0;border-bottom:1px solid var(--ink12)}
.pp-list .k{opacity:.65}
.pp-list .v{font-variant-numeric:tabular-nums;font-weight:600}
/* A sale, its pin and its price path light together. The COLUMN end of that
   pair is a control too: an overlay inside the header cell, so the <th> keeps
   its header semantics and the reader gets a 44px target and a focus ring. */
.comp-matrix th.v{position:relative}
.matrix-hit{position:absolute;inset:0;display:block;cursor:pointer;border-radius:6px}
.matrix-hit:focus-visible{outline:3px solid rgba(16,39,66,.35);outline-offset:-2px}
.matrix-hit:hover{background:rgba(16,39,66,.05)}
.comp-matrix th.v .matrix-addr,.comp-matrix th.v .matrix-thumb{position:relative;z-index:1}
@media print{.matrix-hit{display:none}}
.is-on{background:rgba(16,39,66,.07)}
th.v.is-on,.comp-stack-card.is-on{outline:2px solid var(--navy);outline-offset:2px;background:transparent}
/* The toggle that puts the working away. */
.is-plain tr[data-adj],.is-plain .comp-stack-line[data-adj]{display:none}
/* The phone card's own expand: the conclusion is always on the card, the
   working is one tap under it. Print never runs this script, but a reader who
   prints the web document from the browser gets the whole card. */
@media print{.comp-fold{display:block!important}}
.comp-stack-grid.is-answer{margin-top:10px;font-weight:600}
.comp-stack-grid.is-answer .k{font-weight:400}
/* One row of controls, not four (tasteReview round two, §2.3): a segmented
   pair and a select, side by side, wrapping only when they truly cannot fit. */
.rr-controls.is-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px}
.rr-seg{display:inline-flex;border:1px solid var(--ink12);border-radius:10px;overflow:hidden}
.rr-seg .rr-btn{border:0;border-radius:0;padding:12px 14px}
.rr-seg .rr-btn+.rr-btn{border-left:1px solid var(--ink12)}
.rr-select{font:inherit;font-size:13px;color:var(--navy);background:transparent;border:1px solid var(--ink12);border-radius:10px;padding:12px 14px;min-height:44px;cursor:pointer}
.rr-select:focus-visible{outline:3px solid rgba(16,39,66,.35);outline-offset:2px}
/* Chapter 1's line draws itself once, and only for a reader who wants motion. */
@media (prefers-reduced-motion:reduce){.tl-ask{stroke-dasharray:none!important;stroke-dashoffset:0!important}}
`
}

/**
 * The script. One IIFE, no globals, every block in its own try so a failure in
 * one chapter cannot take the rest of the document down.
 */
export function immersiveInteractionScript(): string {
  return `(function(){
var REDUCED=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches
function el(tag,cls,text){var n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n}
function usd(n){return '$'+Math.round(n).toLocaleString('en-US')}
function longDate(iso){
  if(!iso)return ''
  var d=new Date(iso+'T12:00:00.000Z')
  return isNaN(d.getTime())?'':d.toLocaleString('en-US',{month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})
}
/** The live line for a section, made once, placed after the node it reads. */
function readout(after,hint){
  var next=after.nextElementSibling
  if(next&&next.classList&&next.classList.contains('rr-read'))return next
  var r=el('p','rr-read');r.setAttribute('role','status');r.setAttribute('aria-live','polite')
  r.setAttribute('data-hint',hint||'')
  after.parentNode.insertBefore(r,after.nextSibling)
  return r
}
/**
 * The answer, drawn beside the mark that was tapped.
 *
 * One note per drawing, moved rather than remade. It is clamped inside the
 * viewBox on both axes and flips under the mark when there is no room above,
 * so a mark near the top of the plot never pushes its own label off the frame.
 */
function note(svg,mark,text){
  if(!text)return
  var vb=svg.viewBox&&svg.viewBox.baseVal
  if(!vb||!vb.width)return
  var box
  try{box=mark.getBBox()}catch(e){return}
  if(!box||(!box.width&&!box.height))return
  var NS='http://www.w3.org/2000/svg'
  var g=svg.querySelector('.rr-note')
  if(!g){
    g=document.createElementNS(NS,'g');g.setAttribute('class','rr-note')
    g.appendChild(document.createElementNS(NS,'rect'))
    g.appendChild(document.createElementNS(NS,'text'))
    svg.appendChild(g)
  }else{svg.appendChild(g)}
  var rect=g.firstChild,label=g.lastChild
  var fs=vb.width<=400?11:12
  label.setAttribute('font-size',String(fs))
  label.setAttribute('text-anchor','middle')
  label.textContent=text
  var w
  try{w=label.getComputedTextLength()}catch(e){w=text.length*fs*0.56}
  if(!w)w=text.length*fs*0.56
  var padX=6,padY=4,h=fs+padY*2
  var cx=box.x+box.width/2
  var half=w/2+padX
  cx=Math.min(Math.max(cx,half+2),vb.width-half-2)
  // Above the mark, unless the mark sits within the note's own height of the
  // top edge.
  var above=box.y-10-h>=2
  var top=above?box.y-10-h:box.y+box.height+10
  top=Math.min(Math.max(top,2),Math.max(vb.height-h-2,2))
  rect.setAttribute('x',String(cx-half));rect.setAttribute('y',String(top))
  rect.setAttribute('width',String(w+padX*2));rect.setAttribute('height',String(h))
  rect.setAttribute('rx','4')
  label.setAttribute('x',String(cx));label.setAttribute('y',String(top+padY+fs*0.8))
}
function press(node,fn){
  node.addEventListener('click',fn)
  node.addEventListener('keydown',function(e){
    if(e.key==='Enter'||e.key===' '||e.key==='Spacebar'){e.preventDefault();fn(e)}
  })
}
function controls(before,label){
  var box=el('div','rr-controls')
  if(label)box.appendChild(el('span','rr-lbl',label))
  before.parentNode.insertBefore(box,before)
  return box
}
function button(box,text,pressed,fn){
  var b=el('button','rr-btn',text)
  b.type='button';b.setAttribute('aria-pressed',pressed?'true':'false')
  b.addEventListener('click',function(){
    var sibs=box.querySelectorAll('.rr-btn')
    for(var i=0;i<sibs.length;i++)sibs[i].setAttribute('aria-pressed','false')
    b.setAttribute('aria-pressed','true')
    fn()
  })
  box.appendChild(b)
  return b
}

/* ── 1. a mark that names itself: the timeline, the bars, the month line ──── */
try{
  // NO INSTRUCTION CAPTIONS. Four of them shipped, one under each figure,
  // telling the reader to tap the mark, drag the curve, tap the bar, tap the
  // month — the same tell as the Atlas pinch-to-zoom sentence TASTE.md bans.
  // The affordance is on the control instead: a ring around every mark that
  // answers a tap, a placed handle on the scrub, a chevron on the toggle.
  // The third field says whether the answer is placed AT the mark. A timeline
  // cut, a month and a sale dot each answer in a few words, so the answer goes
  // beside the mark and the paragraph becomes a screen-reader line. The bars
  // answer in a full sentence with a comparison in it, which belongs in
  // reading type under the chart.
  var GROUPS=[['.tl-mark','',1],['.bar-row','',0],['.month-mark','',1],['.ws-dot','',1]]
  GROUPS.forEach(function(g){
    var nodes=[].slice.call(document.querySelectorAll(g[0]))
    nodes.forEach(function(n){
      var svg=n.ownerSVGElement||n.closest('svg')
      if(!svg)return
      var read=readout(svg.parentNode&&svg.parentNode.classList.contains('fig')?svg.parentNode:svg,g[1])
      if(g[2])read.classList.add('is-sr')
      // The bars and the marks are toggles, so they announce their state the
      // way the pills do. They shipped with aria-pressed left null.
      n.setAttribute('aria-pressed','false')
      function show(){
        nodes.forEach(function(o){
          if(o.ownerSVGElement!==svg)return
          o.classList.remove('is-read')
          o.setAttribute('aria-pressed','false')
        })
        n.classList.add('is-read')
        n.setAttribute('aria-pressed','true')
        var text=n.getAttribute('data-read')||''
        read.textContent=text
        if(g[2])note(svg,n,text)
      }
      press(n,show)
      n.addEventListener('mouseenter',show)
    })
  })
}catch(e){}

/* ── 2. the offer-timing curve, scrubbed ─────────────────────────────────── */
/* The readout SNAPS to the six measured days the contract supplies. It used to
   interpolate and print a tenth of a percent at any of 187 positions — a
   figure nobody measured, printed to a precision nobody has (CLAUDE.md §0).
   The marker and the reading now only ever land on 7, 14, 30, 60, 90, 180. */
try{
  [].slice.call(document.querySelectorAll('svg.curve-scrub')).forEach(function(svg){
    var pts,plot
    try{pts=JSON.parse(svg.getAttribute('data-points')||'[]');plot=JSON.parse(svg.getAttribute('data-plot')||'[]')}catch(err){return}
    if(!pts.length||plot.length<5)return
    var L=plot[0],R=plot[1],TOP=plot[2],BOT=plot[3],MAXD=plot[4]
    var hit=svg.querySelector('.scrub-hit'),line=svg.querySelector('.scrub-line'),dot=svg.querySelector('.scrub-dot')
    if(!hit||!line||!dot)return
    var read=readout(svg,'')
    var i=0
    function reading(k){
      return 'By day '+pts[k][0]+', '+pts[k][1].toFixed(1)+' percent of these sales had an accepted offer.'
    }
    function put(k,announce){
      i=Math.max(0,Math.min(pts.length-1,k))
      var d=pts[i][0],pct=pts[i][1]
      var x=L+((R-L)*d)/Math.max(MAXD,1)
      var y=BOT-((BOT-TOP)*Math.min(pct,100))/100
      line.setAttribute('x1',x);line.setAttribute('x2',x)
      dot.setAttribute('cx',x);dot.setAttribute('cy',y)
      svg.classList.add('is-scrubbing')
      hit.setAttribute('aria-valuenow',String(d))
      hit.setAttribute('aria-valuetext',reading(i))
      if(announce!==false)read.textContent=reading(i)
    }
    /** The measured point nearest the finger, never a day between two of them. */
    function nearest(day){
      var best=0,bd=Infinity
      for(var k=0;k<pts.length;k++){
        var gap=Math.abs(pts[k][0]-day)
        if(gap<bd){bd=gap;best=k}
      }
      return best
    }
    function fromEvent(e){
      var box=svg.getBoundingClientRect()
      var vb=svg.viewBox.baseVal
      var px=((e.clientX-box.left)/Math.max(box.width,1))*vb.width
      put(nearest(((px-L)/Math.max(R-L,1))*MAXD))
    }
    hit.setAttribute('tabindex','0')
    hit.setAttribute('role','slider')
    hit.setAttribute('aria-label','Days to an accepted offer')
    hit.setAttribute('aria-valuemin',String(pts[0][0]))
    hit.setAttribute('aria-valuemax',String(pts[pts.length-1][0]))
    hit.addEventListener('pointerdown',function(e){fromEvent(e);hit.setPointerCapture&&hit.setPointerCapture(e.pointerId)})
    hit.addEventListener('pointermove',function(e){if(e.buttons||e.pointerType==='mouse')fromEvent(e)})
    hit.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'||e.key==='ArrowUp'){e.preventDefault();put(i+1)}
      else if(e.key==='ArrowLeft'||e.key==='ArrowDown'){e.preventDefault();put(i-1)}
      else if(e.key==='Home'){e.preventDefault();put(0)}
      else if(e.key==='End'){e.preventDefault();put(pts.length-1)}
    })
    // A slider that announces nothing until the first key press is a slider a
    // screen reader cannot read, so the handle is placed and both ARIA values
    // are set from the first render. It also PRINTS its reading from the first
    // render: three separate readers looked at the resting handle and its
    // dashed rule and reported "a large dot at day 60 with no label — reads as
    // a leftover hover state baked into the screenshot". A visible mark on a
    // chart says what it is.
    put(Math.min(3,pts.length-1))
  })
}catch(e){}

/* ── 3. a price path expands into its dated history ──────────────────────── */
try{
  [].slice.call(document.querySelectorAll('.pp-wrap[data-events]')).forEach(function(wrap){
    var rows
    try{rows=JSON.parse(wrap.getAttribute('data-events')||'[]')}catch(err){return}
    if(!rows.length)return
    var list=el('ol','pp-list');list.hidden=true
    rows.forEach(function(r){
      var li=el('li')
      li.appendChild(el('span','k',r.k+(r.d?' '+longDate(r.d):', date not recorded')))
      li.appendChild(el('span','v',usd(r.p)))
      list.appendChild(li)
    })
    // Inside a phone sale card the toggle opens the WHOLE working — the drawn
    // price path, its dated history and every adjustment line — because the
    // card's job on a phone is the conclusion and the audit trail is one tap
    // under it (tasteReview round two, item 3: the document got longer, not
    // shorter). Everywhere else it opens the dated list alone.
    var fold=wrap.closest?wrap.closest('.comp-fold'):null
    var openWord=fold?(fold.getAttribute('data-fold-label')||'How this sale was adjusted'):'Price history'
    var shutWord='Hide '+openWord.charAt(0).toLowerCase()+openWord.slice(1)
    var toggle=el('button','pp-toggle')
    var chev=el('span','pp-chev');chev.setAttribute('aria-hidden','true')
    var word=el('span','pp-word',openWord)
    toggle.appendChild(chev);toggle.appendChild(word)
    toggle.type='button';toggle.setAttribute('aria-expanded','false')
    toggle.addEventListener('click',function(){
      var open=list.hidden
      list.hidden=!open
      if(fold)fold.hidden=!open
      toggle.setAttribute('aria-expanded',open?'true':'false')
      word.textContent=open?shutWord:openWord
    })
    wrap.appendChild(list)
    if(fold){
      fold.hidden=true
      fold.parentNode.insertBefore(toggle,fold)
    }else{
      wrap.insertBefore(toggle,list)
    }
    // A tap on a dated cut in the drawing names it without opening the list.
    var cuts=[].slice.call(wrap.querySelectorAll('.pp-cut'))
    if(cuts.length){
      var read=readout(wrap,'')
      cuts.forEach(function(c){
        press(c,function(){
          read.textContent='Cut to '+usd(Number(c.getAttribute('data-price')||0))+' on '+longDate(c.getAttribute('data-date'))+'.'
        })
      })
    }
  })
}catch(e){}

/* ── 3b. any other folded block gets the same control ────────────────────── */
/* TASTE.md bans a section whose primary content is more than two paragraphs of
   prose with no figure, and names the remedy: "it sits under a disclosure".
   Basis and limits ran eight paragraphs, 1,697px, at the end of a document
   already too long on a phone (tasteReview round two, item 3). The four
   paragraphs a reader USES stay on the page; the statutory block sits behind
   this control, and the printed letter — which runs no script — carries all of
   it either way. */
try{
  [].slice.call(document.querySelectorAll('.comp-fold[data-fold-label]')).forEach(function(fold){
    var prev=fold.previousElementSibling
    if(prev&&prev.classList&&prev.classList.contains('pp-toggle'))return
    var openWord=fold.getAttribute('data-fold-label')||'More'
    var shutWord='Hide '+openWord.charAt(0).toLowerCase()+openWord.slice(1)
    var toggle=el('button','pp-toggle')
    var chev=el('span','pp-chev');chev.setAttribute('aria-hidden','true')
    var word=el('span','pp-word',openWord)
    toggle.appendChild(chev);toggle.appendChild(word)
    toggle.type='button';toggle.setAttribute('aria-expanded','false')
    toggle.addEventListener('click',function(){
      var open=fold.hidden
      fold.hidden=!open
      toggle.setAttribute('aria-expanded',open?'true':'false')
      word.textContent=open?shutWord:openWord
    })
    fold.hidden=true
    fold.parentNode.insertBefore(toggle,fold)
  })
}catch(e){}

/* ── 4. a sale, its pin and its price path light together ────────────────── */
try{
  function light(id,scroll){
    var nodes=document.querySelectorAll('[data-comp],[data-pin]')
    for(var i=0;i<nodes.length;i++){
      var n=nodes[i]
      var k=n.getAttribute('data-comp')||n.getAttribute('data-pin')
      n.classList.toggle('is-on',k===id)
    }
    if(!scroll)return
    // The row the pin belongs to, brought into view — the pin is on the map,
    // the reading is in the grid, and a tap should not leave the reader to
    // find it (Delta 2, chapter 3).
    var target=document.querySelector('.comp-stack-card[data-comp="'+id+'"]:not([hidden])')||
      document.querySelector('th.v[data-comp="'+id+'"]')
    if(target&&target.scrollIntoView)target.scrollIntoView({block:'center',behavior:REDUCED?'auto':'smooth'})
  }
  function lightFrom(t){
    if(!t)return
    var fromPin=!!t.closest('.pin-map,.pin-map-wrap')
    light(t.getAttribute('data-comp')||t.getAttribute('data-pin'),fromPin)
  }
  document.addEventListener('click',function(e){
    lightFrom(e.target&&e.target.closest?e.target.closest('[data-comp],[data-pin]'):null)
  })
  // Enter and Space on the column header's own control. A span with
  // role="button" does not fire a click from the keyboard the way a <button>
  // does, and the column end of the sale-to-pin pair was unreachable without a
  // mouse (tasteReview round two, §4).
  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter'&&e.key!==' '&&e.key!=='Spacebar')return
    var t=e.target&&e.target.closest?e.target.closest('.matrix-hit'):null
    if(!t)return
    e.preventDefault()
    lightFrom(t)
  })
}catch(e){}

/* ── 5. every matrix: put the working away, re-order it, filter it ───────── */
/*
 * DELTA 3: three matrices, one column set, so ONE wiring runs over all three.
 * It used to be scoped to #what-its-worth and to the one grid that lived
 * there; a control that only existed on matrix 1 would tell a reader the other
 * two are not the same object, which is the whole point of the shared columns.
 *
 * Per matrix: the adjustments toggle when that matrix has working to put away
 * (matrix 1 only), the order select always, and the status filter on the one
 * matrix whose homes are in two states (matrix 3, for sale and under contract).
 */
try{
  var MATRIX_CHAPTERS=['sales-that-set-it','did-not-sell','competition']
  MATRIX_CHAPTERS.forEach(function(id){
    var chapter=document.getElementById(id)
    if(!chapter)return
    // The SHARED tables. The adjustment grid under matrix 1 repeats the same
    // columns and is moved by the same sort, but it is not what the controls
    // are counted over.
    var tables=[].slice.call(chapter.querySelectorAll('table.comp-matrix'))
    var shared=tables.filter(function(t){return !t.classList.contains('is-adjustments')})
    if(!shared.length)return
    var stack=chapter.querySelector('.comp-stack')
    var anchor=chapter.querySelector('.comp-matrix-wrap')||shared[0]

    // ONE ROW OF CONTROLS. Raising the pills to 44px pushed this chapter's
    // controls onto four rows at 375 — 208px of stacked buttons before the
    // reader reached a single sale (tasteReview round two, §2.3). The toggle
    // stays a segmented pair, because it is two states of one thing; the order
    // becomes a select, because four mutually exclusive options is a select.
    // ONE HOME IS NOT AN ORDER. A matrix holding the reader plus a single
    // listing offered "Most recent / Price today / Size" over nothing.
    var homeCount=shared.reduce(function(n,t){return n+t.querySelectorAll('thead th.v').length-1},0)
    var box=controls(anchor,'')
    box.className='rr-controls is-row'
    var hasAdj=chapter.querySelectorAll('tr[data-adj]').length>0
    if(hasAdj){
      var seg=el('div','rr-seg')
      box.appendChild(seg)
      button(seg,'With the adjustments',true,function(){chapter.classList.remove('is-plain')})
      button(seg,'Sale prices only',false,function(){chapter.classList.add('is-plain')})
    }

    // The sort runs ACROSS every table, not within each one. A wide grid splits
    // into two or three tables so it fits the page, and a within-table sort
    // returned two descending runs, which a reader reads as a sort that did not
    // work. The tables are a page-width mechanism, so a home is free to move
    // between them.
    var groups=tables.map(function(t){
      return {
        table:t,
        head:t.querySelector('thead tr'),
        // How many HOME columns this table holds. The shape stays put; only
        // which home sits in each slot changes.
        size:t.querySelectorAll('thead th.v').length-1
      }
    })
    // The order the document was printed in, kept so the reader can get back
    // to it. Restoring "the original" by leaving the DOM alone stopped working
    // the moment the sort could move a column between tables.
    var printed=[]
    ;[].slice.call(shared[0].querySelectorAll('thead th.v')).slice(1).forEach(function(h){
      printed.push(h.getAttribute('data-comp'))
    })
    function order(key,dir){
      // Every home column in the chapter, with the cell it owns in each row.
      // Captured BEFORE anything moves: the references have to outlive the
      // reshuffle. Each TABLE is sorted from its own columns, so the shared
      // grid and the adjustment grid under it stay in step.
      var byTable=groups.map(function(g){
        var heads=[].slice.call(g.table.querySelectorAll('thead th.v'))
        var rows=[].slice.call(g.table.querySelectorAll('tbody tr'))
        var items=[]
        heads.forEach(function(h,i){
          // Column 0 is the reader's own home, in every table, and never moves.
          if(i===0)return
          items.push({head:h,cells:rows.map(function(tr){return tr.querySelectorAll('td')[i]})})
        })
        return {g:g,items:items,rows:rows}
      })
      function cmp(a,b){
        if(!key){
          return printed.indexOf(a.head.getAttribute('data-comp'))-printed.indexOf(b.head.getAttribute('data-comp'))
        }
        var va=a.head.getAttribute('data-sort-'+key),vb=b.head.getAttribute('data-sort-'+key)
        if(va==null&&vb==null)return 0
        if(va==null)return 1
        if(vb==null)return -1
        if(key==='date')return dir*(va<vb?-1:va>vb?1:0)
        return dir*(Number(va)-Number(vb))
      }
      // ACROSS the shared tables, then the adjustment tables realigned to the
      // same result, so the two grids can never show a different order.
      var sharedTables=byTable.filter(function(t){return !t.g.table.classList.contains('is-adjustments')})
      var adjTables=byTable.filter(function(t){return t.g.table.classList.contains('is-adjustments')})
      var pool=[]
      sharedTables.forEach(function(t){pool=pool.concat(t.items)})
      pool.sort(cmp)
      var at=0,global=[]
      sharedTables.forEach(function(t){
        for(var k=0;k<t.g.size;k++){
          var it=pool[at++]
          if(!it)break
          t.g.head.appendChild(it.head)
          t.rows.forEach(function(tr,ri){if(it.cells[ri])tr.appendChild(it.cells[ri])})
          global.push(it.head.getAttribute('data-comp'))
        }
      })
      var adjPool=[]
      adjTables.forEach(function(t){adjPool=adjPool.concat(t.items)})
      var byKey={}
      adjPool.forEach(function(it){byKey[it.head.getAttribute('data-comp')]=it})
      var ai=0
      adjTables.forEach(function(t){
        for(var k=0;k<t.g.size;k++){
          var it=byKey[global[ai++]]
          if(!it)break
          t.g.head.appendChild(it.head)
          t.rows.forEach(function(tr,ri){if(it.cells[ri])tr.appendChild(it.cells[ri])})
        }
      })
      function reflow(container,sel){
        if(!container)return
        var byPin={}
        ;[].slice.call(container.querySelectorAll(sel)).forEach(function(n){
          byPin[n.getAttribute('data-comp')||n.getAttribute('data-pin')]=n
        })
        global.forEach(function(pin){if(byPin[pin])container.appendChild(byPin[pin])})
      }
      reflow(stack,'.comp-stack-card:not(.is-yours)')
    }
    // "As weighted" was a lie: the printed order is newest first, and the
    // weights ran 31.9, 14.2, 15.1, 27.3, 11.6 down the row under a pill
    // claiming they were sorted by it.
    var ORDERS=[['As printed',null,1],['Most recent','date',-1],['Price today','price',-1],['Size','size',-1],['Days on market','days',-1]]
      .filter(function(o){
        return o[1]===null||chapter.querySelector('thead th.v[data-sort-'+o[1]+']')!=null
      })
    if(ORDERS.length>1&&homeCount>1){
      var sel=el('select','rr-select')
      sel.setAttribute('aria-label','Order the homes in this table')
      ORDERS.forEach(function(o,i){
        var opt=el('option',null,o[0])
        opt.value=String(i)
        sel.appendChild(opt)
      })
      sel.addEventListener('change',function(){
        var o=ORDERS[Number(sel.value)||0]
        order(o[1],o[2])
      })
      box.appendChild(sel)
    }

    /* Matrix 3 only: for sale · under contract · all. A home already under
     * contract is not something a seller competes with in the same way, and
     * the chapter prints both, so the filter hides COLUMNS by their status
     * rather than splitting the matrix into two tables. */
    var statuses={}
    ;[].slice.call(chapter.querySelectorAll('thead th.v[data-status]')).forEach(function(h){
      statuses[h.getAttribute('data-status')]=true
    })
    if(statuses.active&&statuses.pending){
      var fbox=controls(anchor,'Show:')
      function only(status){
        tables.forEach(function(t){
          var heads=[].slice.call(t.querySelectorAll('thead th.v'))
          var rows=[].slice.call(t.querySelectorAll('tbody tr'))
          heads.forEach(function(h,i){
            if(i===0)return
            var on=!status||h.getAttribute('data-status')===status
            h.hidden=!on
            rows.forEach(function(tr){
              var td=tr.querySelectorAll('td')[i]
              if(td)td.hidden=!on
            })
          })
        })
        ;[].slice.call(chapter.querySelectorAll('.comp-stack-card[data-status]')).forEach(function(c){
          c.hidden=!!status&&c.getAttribute('data-status')!==status
        })
      }
      button(fbox,'All',true,function(){only(null)})
      button(fbox,'For sale',false,function(){only('active')})
      button(fbox,'Under contract',false,function(){only('pending')})
    }
  })
}catch(e){}

/* ── 7. chapter 1's line draws itself, once, for a reader who wants motion ─ */
try{
  if(!REDUCED&&'IntersectionObserver'in window){
    var lines=[].slice.call(document.querySelectorAll('svg[data-draw] .tl-ask'))
    lines.forEach(function(path){
      var len=0
      try{len=path.getTotalLength()}catch(err){return}
      if(!len)return
      path.style.strokeDasharray=len+' '+len
      path.style.strokeDashoffset=String(len)
      var io=new IntersectionObserver(function(es){
        es.forEach(function(entry){
          if(!entry.isIntersecting)return
          io.disconnect()
          path.style.transition='stroke-dashoffset 400ms ease-out'
          path.style.strokeDashoffset='0'
        })
      },{rootMargin:'0px 0px -20% 0px'})
      io.observe(path.ownerSVGElement||path)
      // Never left half-drawn: a reader who never scrolls it into view, or a
      // browser that drops the callback, still gets the whole line.
      setTimeout(function(){io.disconnect();path.style.strokeDashoffset='0'},5000)
    })
  }
}catch(e){}
})();`
}
