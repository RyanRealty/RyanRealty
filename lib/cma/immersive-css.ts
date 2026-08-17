/**
 * Immersive /cma/[slug] stylesheet. Screen document, not a print sheet:
 * no page numbers, flush photo crops, motion on this house's figures.
 */

export function immersiveStylesheet(): string {
  return `
:root{--navy:#102742;--cream:#faf8f4;--ink:rgba(16,39,66,1);--ink70:rgba(16,39,66,.7);--ink12:rgba(16,39,66,.12)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:Geist,system-ui,sans-serif;background:var(--cream);color:var(--ink);line-height:1.55;-webkit-font-smoothing:antialiased}
img{max-width:100%;display:block}
.page-num,.pg-num,.pageNumber,.pg-footer,.toc .p{display:none}
.sc{min-height:100svh;display:flex;align-items:center;padding:96px 24px;position:relative}
.sc.tight{min-height:72svh}
.sc-cream{background:var(--cream)}
.sc-navy{background:var(--navy);color:var(--cream)}
.in{max-width:880px;margin:0 auto;width:100%}
.in.wide{max-width:1120px}
.kick{font-size:13px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;opacity:.65;margin-bottom:18px}
.h{font-family:'Amboqia Boriango',Georgia,serif;font-weight:400;font-size:clamp(30px,5vw,54px);line-height:1.08;letter-spacing:-.01em;margin-bottom:22px}
.sub{font-family:'Amboqia Boriango',Georgia,serif;font-weight:400;font-size:clamp(22px,3vw,30px);margin:56px 0 18px}
.lede{font-size:clamp(16px,2vw,19px);color:inherit;opacity:.85;max-width:640px;margin-bottom:34px}
.body{font-size:16px;opacity:.85;max-width:640px;margin-top:28px}
.src{font-size:12px;opacity:.55;margin-top:30px;max-width:720px;font-variant-numeric:tabular-nums}
.sc-navy .src{opacity:.5}
.hero{overflow:hidden;background:var(--navy);color:#fff;align-items:flex-end;padding-bottom:72px}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.92;border-radius:0}
.hero-scrim{position:absolute;inset:0;background:linear-gradient(180deg,rgba(16,39,66,.28) 0%,rgba(16,39,66,.12) 40%,rgba(16,39,66,.82) 100%)}
.hero .in{position:relative;z-index:2}
.hero-kick{font-size:13px;font-weight:600;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.85);margin-bottom:14px}
.hero-h{font-family:'Amboqia Boriango',Georgia,serif;font-weight:400;font-size:clamp(40px,8vw,92px);line-height:1.0;letter-spacing:-.01em;text-shadow:0 2px 24px rgba(16,39,66,.45)}
.hero-sub{font-size:clamp(15px,2vw,19px);color:rgba(255,255,255,.9);margin-top:16px}
.hero-for{font-size:14px;color:rgba(255,255,255,.7);margin-top:8px}
.cue{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);z-index:2;width:26px;height:40px;border:2px solid rgba(255,255,255,.7);border-radius:14px}
.cue::after{content:'';position:absolute;left:50%;top:8px;width:4px;height:8px;background:rgba(255,255,255,.9);border-radius:2px;transform:translateX(-50%)}
.ans-n{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(64px,13vw,150px);line-height:1;letter-spacing:-.02em;font-variant-numeric:tabular-nums;margin:6px 0 10px}
.ans-l{font-size:15px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;opacity:.65}
.conf{display:inline-block;margin-top:16px;padding:7px 16px;border:1px solid var(--ink12);border-radius:999px;font-size:13px;font-weight:600}
.range{margin-top:56px}
.range-track{position:relative;height:8px;background:var(--ink12)}
.range-fill{position:absolute;top:0;bottom:0;left:0;background:var(--navy);width:var(--w,0%);transition:width 1.1s cubic-bezier(.2,.7,.2,1)}
.range-marks{display:flex;justify-content:space-between;margin-top:14px;gap:12px}
.rm{flex:1}
.rm-v{font-size:clamp(18px,2.6vw,26px);font-weight:700;font-variant-numeric:tabular-nums}
.rm-l{font-size:12.5px;opacity:.6;margin-top:2px}
.rm.mid .rm-v{color:var(--navy)}
.stat3,.stat4{display:grid;gap:28px;margin:44px 0}
.stat3{grid-template-columns:repeat(3,1fr)}
.stat4{grid-template-columns:repeat(4,1fr)}
.st-n{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(34px,5vw,58px);line-height:1;font-variant-numeric:tabular-nums}
.st-l{font-size:14px;opacity:.72;margin-top:10px;line-height:1.45}
.tl{display:flex;align-items:center;gap:18px;margin:40px 0;flex-wrap:wrap}
.tl-item{min-width:120px}
.tl-lbl{font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.6}
.tl-val{font-family:'Amboqia Boriango',Georgia,serif;font-size:clamp(24px,3.4vw,38px);margin-top:4px;font-variant-numeric:tabular-nums}
.tl-arrow{flex:1;min-width:40px;height:2px;background:rgba(250,248,244,.35);position:relative}
.tl-arrow::after{content:'';position:absolute;right:0;top:-4px;border-left:8px solid rgba(250,248,244,.55);border-top:5px solid transparent;border-bottom:5px solid transparent}
.story-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:44px}
.story-card{background:rgba(250,248,244,.06);border:1px solid rgba(250,248,244,.14);padding:22px}
.story-lens{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.65;margin-bottom:10px}
.story-fact{font-size:15.5px;font-weight:600;line-height:1.4}
.story-mean{font-size:14px;opacity:.75;margin-top:10px;line-height:1.45}
.cmp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:8px}
.cmp{background:#fff;border:1px solid var(--ink12);overflow:hidden}
.cmp-img{width:100%;aspect-ratio:16/10;object-fit:cover;display:block;border-radius:0}
.cmp-img.ph{display:flex;align-items:center;justify-content:center;background:var(--navy);color:var(--cream);font-family:'Amboqia Boriango',Georgia,serif;font-size:40px}
.cmp-b{padding:18px 20px 20px}
.cmp-a{font-size:14px;font-weight:600;opacity:.8}
.cmp-p{font-family:'Amboqia Boriango',Georgia,serif;font-size:30px;margin:6px 0 8px;font-variant-numeric:tabular-nums}
.cmp-m{font-size:13px;opacity:.65;font-variant-numeric:tabular-nums}
.cmp-adj{font-size:13.5px;margin-top:10px;padding-top:10px;border-top:1px solid var(--ink12)}
.szn{margin:16px 0 8px}
.szn svg{width:100%;height:auto;display:block}
.srcgrid{display:grid;gap:10px;margin-top:8px}
.srcrow{display:grid;grid-template-columns:220px 1fr;gap:16px;padding:12px 0;border-top:1px solid var(--ink12);font-size:13px}
.srck{font-weight:600}
.srcv{opacity:.7;font-variant-numeric:tabular-nums}
@media (max-width:700px){.srcrow{grid-template-columns:1fr;gap:4px}}
.plan-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin-top:8px}
.plan{background:rgba(250,248,244,.06);border:1px solid rgba(250,248,244,.14);padding:20px}
.plan-t{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.7;margin-bottom:8px}
.plan-a{font-size:16px;font-weight:600;line-height:1.45}
.plan-b{font-size:13px;opacity:.7;margin-top:8px}
.yr{display:flex;gap:10px;align-items:flex-end;height:300px;margin:10px 0 18px;overflow-x:auto;padding-bottom:6px}
.yr-col{flex:1;min-width:64px;display:flex;flex-direction:column;align-items:center;height:100%}
.yr-v{font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;margin-bottom:6px;white-space:nowrap}
.yr-bar-wrap{flex:1;width:100%;display:flex;align-items:flex-end;justify-content:center}
.yr-bar{width:72%;max-width:52px;height:var(--h);background:var(--navy);transform:scaleY(0);transform-origin:bottom;transition:transform 1s cubic-bezier(.2,.7,.2,1)}
.on .yr-bar{transform:scaleY(1)}
.yr-m{font-size:13px;font-weight:600;margin-top:8px}
.yr-c{font-size:11.5px;opacity:.55;margin-top:2px}
.sty-grid{display:grid;grid-template-columns:1fr 1fr;gap:28px 44px;margin:34px 0 10px}
.sty-h{font-family:'Amboqia Boriango',Georgia,serif;font-weight:400;font-size:22px;margin-bottom:8px}
.sty-b{font-size:15.5px;opacity:.85;line-height:1.6}
.nb-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:6px}
.nb{background:#fff;border:1px solid var(--ink12);overflow:hidden}
.nb-img{width:100%;aspect-ratio:4/3;object-fit:cover;display:block;border-radius:0}
.nb-b{padding:14px 16px 16px}
.nb-a{font-size:13.5px;font-weight:600;opacity:.8}
.nb-p{font-size:13px;font-variant-numeric:tabular-nums;opacity:.65;margin-top:3px}
.nb-l{font-size:13.5px;margin-top:9px;line-height:1.5}
.pos{font-weight:600;opacity:1}
.fin,.bench{max-width:640px;margin-top:6px}
.fin-row,.bench-row{display:flex;align-items:center;gap:14px;margin:14px 0}
.fin-l,.bench-l{width:190px;font-size:14px;opacity:.85}
.fin-track,.bench-track{flex:1;height:14px;background:rgba(250,248,244,.14);overflow:hidden}
.sc-cream .fin-track,.sc-cream .bench-track{background:var(--ink12)}
.fin-bar,.bench-bar{height:100%;width:0;background:var(--cream);transition:width 1s cubic-bezier(.2,.7,.2,1)}
.bench-bar.warm{opacity:.55}
.on .fin-bar,.on .bench-bar{width:var(--w)}
.fin-v,.bench-v{width:64px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;font-size:15px}
.like-grid,.cando-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:10px}
.like,.cando{background:#fff;border:1px solid var(--ink12);padding:22px}
.like-h,.cando-h{font-size:16px;font-weight:600;line-height:1.4}
.like-d{font-size:13.5px;opacity:.65;margin-top:8px}
.cando-t{font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.55;margin-bottom:8px}
.next-in{display:flex;gap:48px;align-items:flex-end}
.br-img{width:min(300px,32vw);height:auto;flex:0 0 auto}
.next-b{flex:1}
.cta{display:flex;gap:14px;flex-wrap:wrap;margin:30px 0 22px}
.btn{display:inline-block;padding:15px 28px;font-weight:600;font-size:15.5px;text-decoration:none;transition:transform .18s ease,box-shadow .18s ease}
.btn:hover{transform:translateY(-1px)}
.btn.pri{background:var(--navy);color:var(--cream);box-shadow:0 12px 28px rgb(16 39 66 / .22)}
.btn.sec{border:1.5px solid var(--navy);color:var(--navy)}
.btn.ter{color:var(--ink70);text-decoration:underline;text-underline-offset:4px;padding-left:8px;padding-right:8px}
.sig{font-size:14.5px;font-weight:600}
.fine{font-size:12px;opacity:.55;margin-top:14px;max-width:640px;line-height:1.5}
#bar{position:fixed;top:0;left:0;right:0;z-index:50;display:flex;align-items:center;gap:16px;padding:12px 20px;background:rgba(250,248,244,.94);backdrop-filter:blur(10px);border-bottom:1px solid var(--ink12);transform:translateY(-110%);transition:transform .3s ease}
#bar.on{transform:none}
#bar .bt{font-size:14px;font-weight:600;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bar a{font-size:13px;font-weight:600;color:var(--navy);text-decoration:none;border:1px solid var(--ink12);padding:6px 14px}
#prog{position:absolute;bottom:-1px;left:0;height:2px;background:var(--navy);width:0}
html.anim .r{opacity:0;transform:translateY(22px)}
html.anim .on .r{opacity:1;transform:none;transition:opacity .55s ease-out,transform .55s ease-out}
html.anim .on .r:nth-child(2){transition-delay:.06s}
html.anim .on .r:nth-child(3){transition-delay:.12s}
html.anim .on .r:nth-child(4){transition-delay:.18s}
html.anim .on .r:nth-child(5){transition-delay:.24s}
@media (prefers-reduced-motion:no-preference){.hero-img{animation:kb 26s ease-in-out infinite alternate}}
@keyframes kb{from{transform:scale(1)}to{transform:scale(1.08)}}
@media (max-width:860px){
  .stat3,.stat4{grid-template-columns:1fr 1fr}
  .cmp-grid,.story-grid,.like-grid,.cando-grid,.sty-grid,.plan-grid{grid-template-columns:1fr}
  .nb-grid{grid-template-columns:1fr 1fr}
  .yr{height:220px}
  .next-in{flex-direction:column;align-items:flex-start}
  .fin-l,.bench-l{width:120px}
  .sc{padding:72px 18px}
}
@media (max-width:560px){.stat3,.stat4{grid-template-columns:1fr}}
@media print{
  .sc{min-height:0;padding:24px}
  #bar,.cue{display:none}
  .hero{color:var(--navy)}
}
`
}
