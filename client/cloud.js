'use strict';
// Orthographic WebGL point cloud with a matching projected picking overlay.
class CloudView {
 constructor(canvas,overlay,onPick){
  this.canvas=canvas;this.overlay=overlay;this.ctx=overlay.getContext('2d');this.onPick=onPick;
  this.yaw=-0.7;this.pitch=0.85;this.center=[0,0,0];this.scale=25;this.points=[];this.markers=[];this.path=[];this.robot=null;this.selected=null;this.filter=null;this.hits=[];this.needsFit=true;
  this.gl=canvas.getContext('webgl',{antialias:true,alpha:false});
  if(!this.gl)throw Error('浏览器不支持 WebGL，请开启硬件加速');
  const gl=this.gl;
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
  this.program=gl.createProgram();
  gl.attachShader(this.program,shader(gl.VERTEX_SHADER,`attribute vec3 p;uniform vec3 center;uniform vec2 size;uniform vec2 angle;uniform float zoom;uniform vec2 range;varying vec3 color;void main(){vec3 d=p-center;float x=cos(angle.x)*d.x-sin(angle.x)*d.y;float t=sin(angle.x)*d.x+cos(angle.x)*d.y;float y=-sin(angle.y)*t+cos(angle.y)*d.z;float depth=cos(angle.y)*t+sin(angle.y)*d.z;gl_Position=vec4(x*zoom*2.0/size.x,y*zoom*2.0/size.y,-depth/10000.0,1.0);gl_PointSize=2.2;float h=clamp((p.z-range.x)/max(0.1,range.y-range.x),0.0,1.0);color=mix(vec3(0.15,0.55,0.65),vec3(0.97,0.75,0.38),h);}`));
  gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 color;void main(){if(distance(gl_PointCoord,vec2(0.5))>0.5)discard;gl_FragColor=vec4(color,1.0);}`));
  gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('WebGL 初始化失败');
  this.buffer=gl.createBuffer();this.count=0;
  let drag=null;
  overlay.addEventListener('contextmenu',e=>e.preventDefault());
  overlay.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,sx:e.clientX,sy:e.clientY,pan:e.shiftKey||e.button===2};overlay.setPointerCapture(e.pointerId)});
  overlay.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;
   if(drag.pan){const a=dx/this.scale,b=dy/this.scale/Math.max(.2,Math.sin(this.pitch));this.center[0]-=Math.cos(this.yaw)*a+Math.sin(this.yaw)*b;this.center[1]-=-Math.sin(this.yaw)*a+Math.cos(this.yaw)*b}
   else{this.yaw+=dx*.008;this.pitch=Math.max(.08,Math.min(Math.PI/2,this.pitch+dy*.008))}this.draw()});
  overlay.addEventListener('pointerup',e=>{if(drag&&Math.hypot(e.clientX-drag.sx,e.clientY-drag.sy)<5){const r=overlay.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const h=this.hits.filter(h=>Math.hypot(x-h.x,y-h.y)<15).sort((a,b)=>a.dist-b.dist)[0];if(h)this.onPick(h.point)}drag=null});
  overlay.addEventListener('pointercancel',()=>drag=null);
  overlay.addEventListener('wheel',e=>{e.preventDefault();this.scale=Math.max(.1,Math.min(1500,this.scale*Math.exp(-e.deltaY*.001)));this.draw()},{passive:false});
  new ResizeObserver(()=>this.draw()).observe(overlay);
 }
 reset(){this.points=[];this.markers=[];this.path=[];this.robot=null;this.selected=null;this.needsFit=true;this.upload();this.draw()}
 setData(points,markers,robot,path){this.points=points||[];this.markers=markers||[];this.robot=robot;this.path=path||[];this.upload();if(this.needsFit&&this.points.length>50){this.fit();this.needsFit=false}else this.draw()}
 upload(){let data=this.points;if(this.filter)data=data.filter(p=>p[2]>=this.filter[0]&&p[2]<=this.filter[1]);this.count=data.length;const gl=this.gl;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data.flat()),gl.DYNAMIC_DRAW);let lo=Infinity,hi=-Infinity;for(const p of data){lo=Math.min(lo,p[2]);hi=Math.max(hi,p[2])}this.range=data.length?[lo,hi]:[0,1]}
 project(p){const d=p.map((v,i)=>v-this.center[i]),c=Math.cos(this.yaw),s=Math.sin(this.yaw),t=s*d[0]+c*d[1];return {x:this.overlay.clientWidth/2+(c*d[0]-s*d[1])*this.scale,y:this.overlay.clientHeight/2-(-Math.sin(this.pitch)*t+Math.cos(this.pitch)*d[2])*this.scale,dist:-(Math.cos(this.pitch)*t+Math.sin(this.pitch)*d[2])}}
 fit(){const data=this.points.length?this.points:this.markers.map(p=>p.xyz);if(!data.length)return;const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const p of data)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],p[i]);hi[i]=Math.max(hi[i],p[i])}this.center=lo.map((v,i)=>(v+hi[i])/2);const radius=Math.max(3,Math.hypot(...hi.map((v,i)=>v-lo[i])));this.scale=Math.min(this.overlay.clientWidth,this.overlay.clientHeight)*.8/radius;this.draw()}
 draw(){const gl=this.gl,w=this.overlay.clientWidth,h=this.overlay.clientHeight;if(!w||!h)return;
  // CSS-pixel render targets keep point size and marker picking consistent.
  for(const c of [this.canvas,this.overlay])if(c.width!==w||c.height!==h){c.width=w;c.height=h}
  gl.viewport(0,0,w,h);gl.clearColor(.035,.06,.085,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.useProgram(this.program);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  const loc=gl.getAttribLocation(this.program,'p');gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);
  const u=n=>gl.getUniformLocation(this.program,n);gl.uniform3fv(u('center'),this.center);gl.uniform2f(u('size'),w,h);gl.uniform2f(u('angle'),this.yaw,this.pitch);gl.uniform1f(u('zoom'),this.scale);gl.uniform2fv(u('range'),this.range||[0,1]);gl.drawArrays(gl.POINTS,0,this.count);
  const ctx=this.ctx;ctx.clearRect(0,0,w,h);ctx.font='12px system-ui';this.hits=[];
  const line=(a,b,color)=>{a=this.project(a);b=this.project(b);ctx.strokeStyle=color;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()};
  line([0,0,0],[2,0,0],'#a96868');line([0,0,0],[0,2,0],'#6b9f7f');line([0,0,0],[0,0,2],'#658cbb');
  if(this.path.length>1){ctx.strokeStyle='#e2e9ee';ctx.lineWidth=2;ctx.beginPath();this.path.forEach((p,i)=>{const q=this.project(p);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.stroke();ctx.lineWidth=1}
  for(const p of this.markers){if(this.filter&&(p.xyz[2]<this.filter[0]||p.xyz[2]>this.filter[1]))continue;const q=this.project(p.xyz);const goal=p.kind==='goal';ctx.fillStyle=goal?'#ffce70':'#5cd4c2';ctx.strokeStyle='#0b1219';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,goal?7:5,0,Math.PI*2);ctx.fill();ctx.stroke();if(p.id===this.selected){ctx.strokeStyle='#fff';ctx.beginPath();ctx.arc(q.x,q.y,12,0,Math.PI*2);ctx.stroke()}ctx.fillStyle='#e6edf3';ctx.fillText((goal?'目标':'航点')+p.index+' · '+p.floor,q.x+11,q.y-9);if(goal)this.hits.push({...q,point:p})}
  if(this.robot){const q=this.project(this.robot.xyz);ctx.fillStyle='#85b5ff';ctx.beginPath();ctx.arc(q.x,q.y,7,0,Math.PI*2);ctx.fill();const end=[this.robot.xyz[0]+Math.cos(this.robot.yaw),this.robot.xyz[1]+Math.sin(this.robot.yaw),this.robot.xyz[2]];line(this.robot.xyz,end,'#bdd3ff');ctx.fillText('机器人',q.x+12,q.y+17)}
 }
}
window.CloudView=CloudView;
