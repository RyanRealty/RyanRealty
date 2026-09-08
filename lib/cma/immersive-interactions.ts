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
.tl-mark:hover circle:last-of-type,.month-mark:hover circle:last-of-type,.ws-dot:hover circle:last-of-type{stroke:rgba(16,39,66,.45)}
.bar-row.is-read rect{fill:rgba(16,39,66,.06)}
.tl-mark.is-read circle:last-of-type,.month-mark.is-read circle:last-of-type,.ws-dot.is-read circle:last-of-type{r:6;stroke:var(--navy)}
/* The marker carries opacity="0" on the element so the PRINT letter, which
   loads none of this, never draws a stray dashed line at day zero. A class
   beats a presentation attribute, so the scrub still appears here. */
.scrub{opacity:0;transition:opacity .2s ease-out}
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
/* A sale, its pin and its price path light together. */
.is-on{background:rgba(16,39,66,.07)}
th.v.is-on,.comp-stack-card.is-on{outline:2px solid var(--navy);outline-offset:2px;background:transparent}
/* The toggle that puts the working away. */
.is-plain tr[data-adj],.is-plain .comp-stack-line[data-adj]{display:none}
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
    // screen reader cannot read. The handle is placed, and both ARIA values
    // are set, from the first render; the live line stays empty until the
    // reader moves it, so nothing shouts at them on load.
    put(Math.min(3,pts.length-1),false)
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
    var toggle=el('button','pp-toggle')
    var chev=el('span','pp-chev');chev.setAttribute('aria-hidden','true')
    var word=el('span','pp-word','Price history')
    toggle.appendChild(chev);toggle.appendChild(word)
    toggle.type='button';toggle.setAttribute('aria-expanded','false')
    toggle.addEventListener('click',function(){
      var open=list.hidden
      list.hidden=!open
      toggle.setAttribute('aria-expanded',open?'true':'false')
      word.textContent=open?'Hide price history':'Price history'
    })
    wrap.appendChild(toggle);wrap.appendChild(list)
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
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest?e.target.closest('[data-comp],[data-pin]'):null
    if(!t)return
    var fromPin=!!t.closest('.pin-map,.pin-map-wrap')
    light(t.getAttribute('data-comp')||t.getAttribute('data-pin'),fromPin)
  })
}catch(e){}

/* ── 5. chapter 3: put the working away, and re-order the sales ──────────── */
try{
  var worth=document.getElementById('what-its-worth')
  var tables=worth?[].slice.call(worth.querySelectorAll('table.comp-matrix')):[]
  if(worth&&tables.length){
    var stack=worth.querySelector('.comp-stack')
    var anchor=worth.querySelector('.comp-matrix-wrap')||tables[0]

    // The toggle is a class on the chapter, so it works whatever the grid was
    // chunked into. It hides the working and keeps the conclusion.
    var box=controls(anchor,'The sales:')
    button(box,'With the adjustments',true,function(){worth.classList.remove('is-plain')})
    button(box,'Sale prices only',false,function(){worth.classList.add('is-plain')})

    // The sort runs WITHIN each table, never across them: a table is headed
    // "Sales 4 through 6", and moving a sale between tables would make that
    // heading false. The cards and the price paths take the same permutation
    // in the same order, so all three readings of the chapter agree.
    var sortBox=controls(anchor,'Order:')
    var groups=tables.map(function(t){
      return {
        table:t,
        head:t.querySelector('thead tr'),
        heads:[].slice.call(t.querySelectorAll('thead th.v'))
      }
    })
    function order(key,dir){
      var global=[]
      groups.forEach(function(g){
        // Column 0 is the reader's own home, in every table, and never moves.
        var idx=g.heads.map(function(h,i){return i}).slice(1)
        if(key){
          idx.sort(function(a,b){
            var va=g.heads[a].getAttribute('data-sort-'+key),vb=g.heads[b].getAttribute('data-sort-'+key)
            if(va==null&&vb==null)return 0
            if(va==null)return 1
            if(vb==null)return -1
            if(key==='date')return dir*(va<vb?-1:va>vb?1:0)
            return dir*(Number(va)-Number(vb))
          })
        }
        var perm=[0].concat(idx)
        perm.forEach(function(i){g.head.appendChild(g.heads[i])})
        ;[].slice.call(g.table.querySelectorAll('tbody tr')).forEach(function(tr){
          var tds=[].slice.call(tr.querySelectorAll('td'))
          perm.forEach(function(i){if(tds[i])tr.appendChild(tds[i])})
        })
        idx.forEach(function(i){global.push(g.heads[i].getAttribute('data-comp'))})
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
    button(sortBox,'As weighted',true,function(){order(null,1)})
    button(sortBox,'Most recent',false,function(){order('date',-1)})
    button(sortBox,'Price today',false,function(){order('price',-1)})
    button(sortBox,'Size',false,function(){order('size',-1)})
  }
}catch(e){}

/* ── 6. chapter 4: for sale · under contract · all ───────────────────────── */
try{
  var comp=document.getElementById('competition')
  var grids=comp?[].slice.call(comp.querySelectorAll('.rival-grid')):[]
  if(comp&&grids.length>1){
    var blocks=grids.map(function(g){
      var head=g.previousElementSibling
      var status=(g.querySelector('[data-status]')||{getAttribute:function(){return ''}}).getAttribute('data-status')
      return {grid:g,head:head&&head.tagName==='H3'?head:null,status:status}
    })
    var fbox=controls(blocks[0].head||blocks[0].grid,'Show:')
    function only(status){
      blocks.forEach(function(b){
        var on=!status||b.status===status
        b.grid.hidden=!on
        if(b.head)b.head.hidden=!on
      })
    }
    button(fbox,'All',true,function(){only(null)})
    button(fbox,'For sale',false,function(){only('active')})
    button(fbox,'Under contract',false,function(){only('pending')})
  }
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
