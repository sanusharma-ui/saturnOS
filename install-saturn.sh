#!/bin/sh
# Saturn OS layer installer. Run as root:  doas sh install-saturn.sh
set -e
U=sanu
H=/home/$U

echo "[1/5] Saturn Shell UI"
mkdir -p $H/saturn-shell/public
cat > $H/saturn-shell/public/index.html << 'HTML'
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Saturn OS</title>
<style>
*{box-sizing:border-box;margin:0}
body{height:100vh;overflow:hidden;background:#04040c;font-family:system-ui,sans-serif;color:#fff;user-select:none}
canvas{position:fixed;inset:0}
#intro{position:fixed;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#04040c;transition:opacity 1.6s;letter-spacing:.6em;font-weight:200;font-size:30px}
#intro small{font-size:11px;letter-spacing:.45em;opacity:.45;margin-top:14px}
body.on #intro{opacity:0;pointer-events:none}
#clock{position:fixed;top:28px;right:44px;text-align:right;font-weight:200;font-size:54px;text-shadow:0 0 30px #0008}
#clock small{display:block;font-size:14px;opacity:.6;letter-spacing:.2em}
#dock{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);display:flex;gap:16px;padding:12px 20px;border-radius:26px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(18px)}
.ic{width:62px;height:62px;border-radius:18px;display:flex;align-items:center;justify-content:center;font-size:30px;background:rgba(255,255,255,.08);cursor:pointer;transition:.18s}
.ic:hover{transform:translateY(-8px) scale(1.12);background:rgba(255,200,120,.22)}
#panel{position:fixed;right:30px;bottom:120px;width:380px;height:460px;display:none;flex-direction:column;background:rgba(10,12,26,.82);border:1px solid rgba(255,255,255,.12);border-radius:20px;backdrop-filter:blur(20px);overflow:hidden}
#log{flex:1;overflow:auto;padding:16px;font-size:14px;line-height:1.5}
#log p{margin:6px 0}#inp{border:0;padding:14px;background:rgba(255,255,255,.07);color:#fff;outline:0;font-size:14px}
</style></head><body>
<canvas id="c"></canvas>
<div id="intro">SATURN OS<small>BOOTING THE RINGS</small></div>
<div id="clock"></div>
<div id="panel"><div id="log"><p style="opacity:.6">Saturn: kuch bhi bolo. "terminal kholo" bhi chalega.</p></div><input id="inp" placeholder="Saturn se pucho... (Ctrl+Space)"></div>
<div id="dock">
 <div class="ic" title="Terminal" onclick="launch('terminal')">⌨️</div>
 <div class="ic" title="Files" onclick="launch('files')">📁</div>
 <div class="ic" title="Browser" onclick="launch('browser')">🌐</div>
 <div class="ic" title="Saturn AI" onclick="toggle()">🪐</div>
</div>
<script>
const c=document.getElementById('c'),x=c.getContext('2d');
let W,H,stars=[],mx=0,my=0;
function size(){W=c.width=innerWidth;H=c.height=innerHeight;
 stars=Array.from({length:240},()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.4+.2,p:Math.random()*6,s:Math.random()*.25+.05}))}
addEventListener('resize',size);size();
addEventListener('mousemove',e=>{mx=e.clientX/W-.5;my=e.clientY/H-.5});
function ring(cx,cy,R,tilt,front){
 for(const[a,b,al]of[[1.35,1.5,.16],[1.52,1.78,.5],[1.82,1.98,.3],[2.02,2.3,.2]]){
  const m=R*(a+b)/2;x.beginPath();
  x.ellipse(cx,cy,m,m*.26,tilt,front?0:Math.PI,front?Math.PI:2*Math.PI);
  x.lineWidth=R*(b-a)*.55;x.strokeStyle='rgba(232,205,160,'+al+')';x.stroke()}}
function planet(cx,cy,R){
 const g=x.createRadialGradient(cx-R*.35,cy-R*.35,R*.1,cx,cy,R);
 g.addColorStop(0,'#f6dfae');g.addColorStop(.55,'#d6a867');g.addColorStop(1,'#5b3d22');
 x.save();x.beginPath();x.arc(cx,cy,R,0,7);x.clip();x.fillStyle=g;x.fillRect(cx-R,cy-R,2*R,2*R);
 for(let i=-4;i<=4;i++){x.fillStyle=i%2?'rgba(120,70,30,.18)':'rgba(255,230,180,.12)';x.fillRect(cx-R,cy+i*R*.2-R*.05,2*R,R*.1)}
 const s=x.createLinearGradient(cx-R,cy,cx+R,cy);s.addColorStop(0,'rgba(0,0,0,0)');s.addColorStop(1,'rgba(0,0,10,.78)');
 x.fillStyle=s;x.fillRect(cx-R,cy-R,2*R,2*R);x.restore()}
function frame(t){
 t/=1000;x.fillStyle='#04040c';x.fillRect(0,0,W,H);
 const bg=x.createRadialGradient(W*.68,H*.45,0,W*.68,H*.45,W*.6);
 bg.addColorStop(0,'rgba(120,80,40,.22)');bg.addColorStop(1,'rgba(4,4,12,0)');x.fillStyle=bg;x.fillRect(0,0,W,H);
 for(const s of stars){const px=s.x-mx*s.r*14,py=s.y-my*s.r*14;
  x.fillStyle='rgba(255,255,255,'+(.35+.5*Math.sin(t*s.s*6+s.p))+')';x.fillRect(px,py,s.r,s.r)}
 const R=Math.min(W,H)*.15,cx=W*.66-mx*20,cy=H*.45+Math.sin(t*.6)*8-my*12,tilt=-.32+mx*.12;
 ring(cx,cy,R,tilt,false);planet(cx,cy,R);ring(cx,cy,R,tilt,true);
 requestAnimationFrame(frame)}
requestAnimationFrame(frame);
setTimeout(()=>document.body.classList.add('on'),2200);
const clock=document.getElementById('clock');
function tick(){const d=new Date();clock.innerHTML=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+'<small>'+d.toLocaleDateString([],{weekday:'long',day:'numeric',month:'long'}).toUpperCase()+'</small>'}
tick();setInterval(tick,1000);
function launch(a){fetch('/api/launch',{method:'POST',body:JSON.stringify({app:a})})}
function toggle(){const p=document.getElementById('panel');p.style.display=p.style.display=='flex'?'none':'flex';if(p.style.display=='flex')inp.focus()}
addEventListener('keydown',e=>{if(e.ctrlKey&&e.code=='Space'){e.preventDefault();toggle()}});
const log=document.getElementById('log'),inp=document.getElementById('inp');
const hist=[{role:'system',content:'You are Saturn, the AI of Saturn OS. Reply in 1-2 short sentences. If the user asks to open an app, reply ONLY with JSON like {"open":"terminal"}. Apps: terminal, files, browser.'}];
inp.onkeydown=async e=>{
 if(e.key!='Enter'||!inp.value.trim())return;
 const t=inp.value;inp.value='';
 log.innerHTML+='<p style="color:#ffd9a0">'+t.replace(/</g,'&lt;')+'</p>';
 hist.push({role:'user',content:t});
 const o=document.createElement('p');o.textContent='...';log.appendChild(o);
 try{const r=await fetch('http://localhost:8080/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:hist,max_tokens:200})});
  const d=await r.json(),txt=d.choices[0].message.content,m=txt.match(/"open"\s*:\s*"(terminal|files|browser)"/);
  if(m){launch(m[1]);o.textContent='Opening '+m[1]+'...'}else o.textContent=txt;
  hist.push({role:'assistant',content:txt});
 }catch(x){o.textContent='Brain offline (model load ho raha hoga, 30 sec ruko)'}
 log.scrollTop=log.scrollHeight};
</script></body></html>
HTML
chown -R $U:$U $H/saturn-shell

echo "[2/5] Saturn session (boots straight into Saturn Shell, no XFCE)"
cat > /usr/local/bin/saturn-session << 'SESSION'
#!/bin/sh
export DISPLAY=${DISPLAY:-:0}
cd /home/sanu/saturn-shell
xsetroot -solid '#04040c' 2>/dev/null
xfwm4 --compositor=off >/dev/null 2>&1 &
pgrep -f llama-server >/dev/null || nohup /home/sanu/llama.cpp/build/bin/llama-server -m /home/sanu/qwen2.5-1.5b-instruct-q4_k_m.gguf --port 8080 >/tmp/brain.log 2>&1 &
pgrep -f "node server.js" >/dev/null || nohup node server.js >/tmp/saturn.log 2>&1 &
sleep 2
while true; do
  chromium --kiosk --no-first-run --no-sandbox --disable-infobars --noerrdialogs http://localhost:3000 >/dev/null 2>&1
  sleep 1
done
SESSION
chmod +x /usr/local/bin/saturn-session

mkdir -p /usr/share/xsessions
cat > /usr/share/xsessions/saturn.desktop << 'DESK'
[Desktop Entry]
Name=Saturn OS
Comment=Saturn OS shell
Exec=/usr/local/bin/saturn-session
Type=Application
DESK

echo "[3/5] Autologin into Saturn"
mkdir -p /etc/lightdm/lightdm.conf.d
cat > /etc/lightdm/lightdm.conf.d/50-saturn.conf << CONF
[Seat:*]
autologin-user=$U
autologin-user-timeout=0
autologin-session=saturn
user-session=saturn
CONF

echo "[4/5] Branding"
sed -i 's/^NAME=.*/NAME="Saturn OS"/; s/^PRETTY_NAME=.*/PRETTY_NAME="Saturn OS 0.2"/' /etc/os-release
cat > /etc/motd << 'MOTD'

        ____
    .-'      '-.       S A T U R N   O S
  .'   _.---._   '.    the AI-first desktop
 ===[ (       ) ]===
  '.   '-...-'   .'
    '-.______.-'

MOTD
cp /etc/motd /etc/issue

echo "[5/5] Escape hatch"
cat > /usr/local/bin/saturn-revert << 'REV'
#!/bin/sh
rm -f /etc/lightdm/lightdm.conf.d/50-saturn.conf
echo "Autologin hata diya. Reboot karo, normal XFCE login aayega."
REV
chmod +x /usr/local/bin/saturn-revert

echo "Done. Ab: reboot"
