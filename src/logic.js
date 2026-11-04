export const DEF=[{to:20,c:'#88F94E'},{to:40,c:'#F27100'},{to:60,c:'#D31876'},{to:80,c:'#72FCE9'},{to:300,c:'#88F94E'}];
export const RB=[.192,.205,.205,.205,.193];
export const MPH_PER_MS=2.23694,KPH_PER_MPH=1.60934;
export function bandOf(mph,bands){for(let i=0;i<bands.length;i++)if(mph<bands[i].to)return i;return bands.length-1}
export function barFraction(mph,bands,widths){const n=bands.length,w=widths||bands.map(()=>1/n),i=bandOf(mph,bands),lo=i?bands[i-1].to:0;let x=0;for(let j=0;j<i;j++)x+=w[j];return x+w[i]*Math.min(1,Math.max(0,(mph-lo)/(bands[i].to-lo)))}
export function nextMotion(mph,paused,was,lowT,now){const raw=mph>=5,t=raw?now:lowT;return{lowT:t,moving:!paused&&(raw||(was&&now-t<2500))}}
export function fmtTime(s){const f=v=>('0'+Math.floor(v)).slice(-2);return f(s/3600)+':'+f(s%3600/60)+':'+f(s%60)}
export function distance(a,b){const r=Math.PI/180,x=(b[0]-a[0])*r*Math.cos((a[1]+b[1])/2*r),y=(b[1]-a[1])*r;return Math.sqrt(x*x+y*y)*6371000}
export function bearing(a,b){const r=Math.PI/180,y=Math.sin((b[0]-a[0])*r)*Math.cos(b[1]*r),x=Math.cos(a[1]*r)*Math.sin(b[1]*r)-Math.sin(a[1]*r)*Math.cos(b[1]*r)*Math.cos((b[0]-a[0])*r);return (Math.atan2(y,x)/r+360)%360}
export function styleForApp(style){const layers=[];(style.layers||[]).forEach(l=>{const id=l.id.toLowerCase(),o={...l,paint:{...(l.paint||{})}};
 if(l.type==='fill-extrusion')return;
 if(l.type==='background')o.paint['background-color']='#3a3a3a';
 else if(l.type==='fill')o.paint['fill-color']=id.includes('water')?'#262a2d':'#363636';
 else if(l.type==='line')o.paint['line-color']=id.includes('water')?'#262a2d':'#555555';
 else if(l.type==='symbol'&&l.layout&&l.layout['text-field']){o.paint['text-color']='#c4c4c4';o.paint['text-halo-color']='#222222';o.paint['text-halo-width']=1}
 layers.push(o)});return{...style,layers}}
/* Fastest believable speed in m/s, about 335 mph. Anything above it is a GPS jump, like a stale first fix. */
export const MAX_MS=150;
export function addFix(list,fix,windowMs=5000){const last=list[list.length-1];if(last&&last.p&&fix.p){const dt=(fix.t-last.t)/1000;if(dt<=0||distance(last.p,fix.p)/dt>MAX_MS)return[fix]}return list.concat([fix]).filter(f=>fix.t-f.t<=windowMs)}
/* Speed in m/s. Many providers report 0 when they have no speed, so distance over recent fixes
   is the fallback. The floor stops GPS jitter on a parked bike from reading as motion. */
export function fixSpeed(reported,fixes){if(reported!=null&&reported>0.5&&reported<=MAX_MS)return reported;const a=fixes[0],z=fixes[fixes.length-1];if(!a||a===z)return 0;const dt=(z.t-a.t)/1000;if(dt<=0)return 0;const d=distance(a.p,z.p);return d>Math.max(10,z.acc||0)?d/dt:0}
