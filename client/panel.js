'use strict';
const $=id=>document.getElementById(id),token=document.querySelector('meta[name=atec-token]').content;
let mode='standard',number=null,status=null,busy=false,sceneBusy=false,goal=null,preview=[],mapData=null,lastScene=null,initialized=false,view=null;
const phases={mapping:'正在建图',initializing:'初始重定位中',awaiting_confirmation:'请确认定位',navigating:'导航规划中',processing:'生成楼梯分层地图',stopped:'已停止',failed:'运行失败',starting:'正在启动'};
const mapStates={draft:'采集中 / 未完成保存',ready:'可用于导航',processing:'生成分层地图中',error:'分层处理失败'};
function message(text,error=false){$('message').textContent=text;$('message').classList.toggle('error',error)}
async function api(action,extra={}){const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json','X-ATEC-Token':token},body:JSON.stringify({action,...(!initialized&&action==='status'?{}:{mode}),map_id:number,...extra})});const data=await response.json();if(!response.ok||data.error)throw Error(data.error||'连接失败');return data}
function running(){return status?.service.ActiveState==='active'}
function matching(){return status?.runtime.mode===mode&&status?.runtime.map_id===number}
function renderStatus(s){status=s;if(!initialized){mode=s.mode;initialized=true;if(s.runtime.mode===mode&&s.maps.some(m=>m.id===s.runtime.map_id))number=s.runtime.map_id}
 for(const m of ['standard','stairs_v2']){$('tab-'+m).classList.toggle('active',mode===m);$('tab-'+m).setAttribute('aria-selected',String(mode===m));$('tab-'+m).disabled=busy||running()}
 $('mode-title').textContent=mode==='standard'?'标准版':'v2 · 楼梯专用';
 const items=s.maps||[];if(number&&!items.some(m=>m.id===number))number=null;if(!number&&items.length)number=items.at(-1).id;
 const selected=number?.toString()||'';if($('map-select').dataset.options!==items.map(m=>m.id).join(',')){$('map-select').replaceChildren();if(!items.length)$('map-select').add(new Option('暂无地图',''));for(const m of items)$('map-select').add(new Option(String(m.id),String(m.id)));$('map-select').dataset.options=items.map(m=>m.id).join(',')}$('map-select').value=selected;
 mapData=items.find(m=>m.id===number)||null;
 $('map-info').textContent=mapData?`${mapStates[mapData.state]||mapData.state} · ${mapData.count||0} 个保存点\n${mapData.message||''}`:'开始建图后自动分配编号。';
 const active=running();const phase=s.live_state||((s.runtime.task==='tomogram')?'processing':'starting');$('status').textContent=active?`${s.label} · ${phases[phase]||phase}`:(s.failure?'任务异常，查看日志':'Orin 已连接 · 已停止');
 $('motion-note').textContent=(s.enable_chassis?'底盘转发已开启，发送目标会驱动机器人。':'当前底盘转发关闭：可以建图、定位和检查路径，发送目标不会驱动机器狗。')+(mode==='stairs_v2'?' 楼梯版保存后会自动生成 PCT 分层地图；行走前仍需验证机器人外参与楼梯参数。':'');
 const mine=active&&matching(),mapping=mine&&s.runtime.task==='mapping';
 $('mapping-start').disabled=busy||active;$('mapping-save').disabled=busy||!matching()||s.runtime.task!=='mapping'||!mapData||mapData.state!=='draft';
 $('map-select').disabled=busy||active;$('navigate').disabled=busy||active||mapData?.state!=='ready';$('anchor').disabled=busy||active;
 $('confirm').hidden=!(mine&&s.runtime.task==='localize'&&phase==='awaiting_confirmation');$('confirm').disabled=busy||s.odom_age>3;
 $('retry-tomo').hidden=!(mode==='stairs_v2'&&mapData?.state==='error');$('retry-tomo').disabled=busy||active;
 $('stop').disabled=busy||!active;for(const id of ['record-waypoint','record-goal'])$(id).disabled=busy||!mapping||s.odom_age>3;
 $('send-goal').disabled=busy||!goal||!mine||phase!=='navigating';
 $('show-logs').disabled=busy;for(const id of ['fit','top','orbit'])$(id).disabled=busy;
 if(s.failure)message(s.failure.message,true);
}
function renderPoints(data){const old=$('anchor').value;const key=mode+':'+number+':'+JSON.stringify(data?.points||[]);if($('points').dataset.key===key)return;$('points').dataset.key=key;$('points').replaceChildren();$('anchor').replaceChildren(new Option('建图起点','origin'));
 for(const p of data?.points||[]){const label=(p.kind==='goal'?'目标':'航点')+' '+p.index+' · 层 '+p.floor;$('anchor').add(new Option(label,String(p.id)));const b=document.createElement('button');b.className='point';b.dataset.id=p.id;b.textContent=(p.kind==='goal'?'● ':'◆ ')+label;const small=document.createElement('small');small.textContent=`x ${p.xyz[0].toFixed(2)}  y ${p.xyz[1].toFixed(2)}  z ${p.xyz[2].toFixed(2)}`;b.append(small);b.addEventListener('click',()=>{if(p.kind==='goal')pick(p);else{view.center=[...p.xyz];view.draw()}});$('points').append(b)}if([...$('anchor').options].some(o=>o.value===old))$('anchor').value=old;
 if(!(data?.points||[]).some(p=>p.id===goal?.id)){goal=null;$('selected-goal').textContent='点击地图上的黄色目标点，或在列表中选择。'}
}
function pick(p){goal=p;view.selected=p.id;view.draw();$('selected-goal').textContent=`已选择目标 ${p.index} · 层 ${p.floor}`;document.querySelectorAll('.point').forEach(b=>b.classList.toggle('selected',Number(b.dataset.id)===p.id));if(status)renderStatus(status)}
async function refresh(){if(busy)return;try{const s=await api('status');renderStatus(s)}catch(e){$('status').textContent='Orin 未连接';message(e.message,true)}}
async function scene(load=false){if(busy||sceneBusy||!view)return;sceneBusy=true;const key=mode+':'+number;try{const data=await api('scene',{preview:load||lastScene!==key});if(key!==mode+':'+number)return;if(lastScene!==key){preview=[];view.reset();goal=null;lastScene=key}if(data.preview)preview=data.preview;renderPoints(data.map);const live=data.live||{};const fresh=data.active&&Date.now()/1000-(live.cloud_time||0)<3;const pts=[...preview,...(fresh?live.cloud||[]:[])];const odomFresh=data.active&&Date.now()/1000-(live.odom_time||0)<3;view.setData(pts,data.map?.points||[],odomFresh?live.odom:null,odomFresh?live.path:[]);$('empty').hidden=pts.length>0;$('cloud-status').textContent=`${pts.length.toLocaleString()} 点 · `+(fresh?'实时更新':data.active?'等待新点云':'已保存地图');$('position').textContent=odomFresh?live.odom.xyz.map((v,i)=>'xyz'[i]+' '+v.toFixed(2)).join(' / '):'';
 }catch(e){message(e.message,true)}finally{sceneBusy=false}}
async function act(action,extra={}){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);message({mapping_save:'正在保存地图，请保持机器人静止…',navigate:'正在加载地图并初始化定位…',mapping_start:'正在启动建图…'}[action]||'正在执行…');try{const s=await api(action,extra);if(action==='switch'){mode=extra.mode;number=null;goal=null;lastScene=null;preview=[];view.reset()}if(action==='mapping_start'){number=s.runtime.map_id;goal=null;lastScene=null;preview=[];view.reset()}busy=false;renderStatus(s);message(action==='goal'?'目标已提交。':action==='mapping_save'&&mode==='stairs_v2'?'点云已保存，正在后台生成楼梯分层地图。':'操作已完成');await scene(true)}catch(e){busy=false;message(e.message,true);await refresh()}finally{busy=false;document.querySelectorAll('.point').forEach(b=>b.disabled=false);$('show-logs').disabled=false;for(const id of ['fit','top','orbit'])$(id).disabled=false}}
try{view=new CloudView($('cloud'),$('overlay'),pick)}catch(e){message(e.message,true)}
for(const m of ['standard','stairs_v2'])$('tab-'+m).onclick=()=>act('switch',{mode:m});
$('mapping-start').onclick=()=>act('mapping_start');$('mapping-save').onclick=()=>act('mapping_save');$('navigate').onclick=()=>act('navigate',{anchor:$('anchor').value});$('confirm').onclick=()=>act('confirm_localization');$('stop').onclick=()=>act('stop');$('retry-tomo').onclick=()=>act('tomogram');
for(const kind of ['waypoint','goal'])$('record-'+kind).onclick=()=>act('record',{kind,floor:Number($('floor').value)});
$('send-goal').onclick=()=>goal&&act('goal',{point_id:goal.id});$('map-select').onchange=()=>{number=Number($('map-select').value)||null;goal=null;lastScene=null;preview=[];view.reset();renderStatus(status);scene(true)};
$('fit').onclick=()=>view.fit();$('top').onclick=()=>{view.pitch=Math.PI/2;view.draw()};$('orbit').onclick=()=>{view.pitch=.85;view.draw()};
for(const id of ['height-filter','zmin','zmax'])$(id).onchange=()=>{view.filter=$('height-filter').checked?[Number($('zmin').value),Number($('zmax').value)]:null;view.upload();view.draw()};
$('show-logs').onclick=async()=>{try{$('logs').textContent=(await api('logs')).logs;$('logs').hidden=false}catch(e){message(e.message,true)}};
document.querySelectorAll('button').forEach(b=>b.disabled=true);
(async()=>{await refresh();await scene(true);setInterval(refresh,3000);setInterval(()=>scene(),900)})();
