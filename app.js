const $ = s => document.querySelector(s);
const screenEl = $('#screen');
const modal = $('#modal'), modalCard = $('#modalCard');

const DBKEY='beattag_v2_state';
let state = JSON.parse(localStorage.getItem(DBKEY) || 'null') || seedState();
let currentType='text';
let captureBlob=null, captureUrl='', recorder=null, chunks=[], stream=null;

function seedState(){
  return {
    currentProfile:'p1',
    profiles:{
      p1:{id:'p1',name:'Mithilesh',handle:'@mithilesh',coins:280,streak:3,unlocks:[],createdAt:Date.now()}
    },
    challenges:[
      {id:'c1',creator:'p1',creatorName:'Mithilesh',title:'Can you take a better sunset photo?',type:'text',text:'Post a better sunset photo than mine 🌇',createdAt:Date.now()-7200000,parentId:null,generation:1,likes:{},dislikes:{},comments:[],attempts:0,tags:['Shivam'],media:null},
      {id:'c2',creator:'guest1',creatorName:'Aman',title:'Beat my 30 push-ups!',type:'text',text:'30 push-ups in one go. Can you beat it? 💪',createdAt:Date.now()-14400000,parentId:null,generation:1,likes:{},dislikes:{},comments:[],attempts:2,tags:[],media:null}
    ],
    notifications:[{text:'Welcome to BeatTag 🔥',time:Date.now(),read:false}],
    purchases:[]
  }
}
function save(){localStorage.setItem(DBKEY,JSON.stringify(state)); updateCoins();}
function profile(){return state.profiles[state.currentProfile]}
function updateCoins(){const e=$('#coinCount'); if(e)e.textContent=profile().coins}
function fmt(t){const m=Math.floor((Date.now()-t)/60000); if(m<1)return'now'; if(m<60)return m+'m ago'; const h=Math.floor(m/60); if(h<24)return h+'h ago'; return Math.floor(h/24)+'d ago'}
function toast(msg){const d=document.createElement('div');d.className='toast';d.textContent=msg;document.body.appendChild(d);setTimeout(()=>d.remove(),1800)}
function go(tab){
  document.querySelectorAll('.bottom-nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  if(tab==='home')renderHome();
  if(tab==='explore')renderExplore();
  if(tab==='create')renderCreate();
  if(tab==='chains')renderChains();
  if(tab==='profile')renderProfile();
  if(tab==='shop')renderShop();
  window.scrollTo({top:0,behavior:'smooth'});
}
function renderHome(){
  screenEl.innerHTML=`<section class="hero"><h1>Beat it. Tag them.<br>Keep it going.</h1><p>Create any challenge, beat your friends, and grow the chain.</p><div class="hero-actions"><button class="primary" onclick="go('create')">＋ Create Challenge</button><button class="secondary" onclick="go('shop')">🛍 Coin Shop</button></div></section>
  <div class="pills"><button class="pill active">For You</button><button class="pill">🔥 Trending</button><button class="pill">Friends</button><button class="pill">New</button></div>
  <div class="section-title"><h2>Challenges</h2><span class="muted">${state.challenges.length} posts</span></div><div id="feed"></div>`;
  const feed=$('#feed');
  state.challenges.slice().sort((a,b)=>b.createdAt-a.createdAt).forEach(c=>feed.appendChild(challengeCard(c)));
}
function mediaHTML(c){
  if(c.media?.kind==='image') return `<img src="${c.media.data}" alt="challenge">`;
  if(c.media?.kind==='video') return `<video src="${c.media.data}" controls playsinline></video>`;
  if(c.media?.kind==='audio') return `<audio src="${c.media.data}" controls></audio>`;
  return `<div class="text-media">${escapeHTML(c.text||c.title)}</div>`;
}
function challengeCard(c){
  const n=$('#challengeCardTpl').content.cloneNode(true);
  n.querySelector('.creatorName').textContent=c.creatorName;
  n.querySelector('.avatar').textContent=(c.creatorName||'?')[0].toUpperCase();
  n.querySelector('.meta').textContent=`${fmt(c.createdAt)} • Generation ${c.generation}`;
  n.querySelector('.challenge-title').textContent=c.title;
  n.querySelector('.media-wrap').innerHTML=mediaHTML(c);
  const like=n.querySelector('.likeBtn'), dis=n.querySelector('.dislikeBtn');
  const pid=state.currentProfile;
  like.querySelector('span').textContent=Object.keys(c.likes||{}).length;
  dis.querySelector('span').textContent=Object.keys(c.dislikes||{}).length;
  n.querySelector('.commentBtn span').textContent=(c.comments||[]).length;
  like.classList.toggle('active',!!c.likes?.[pid]); dis.classList.toggle('active',!!c.dislikes?.[pid]);
  like.onclick=()=>react(c.id,'like'); dis.onclick=()=>react(c.id,'dislike');
  n.querySelector('.commentBtn').onclick=()=>openComments(c.id);
  n.querySelector('.beatBtn').onclick=()=>openBeat(c.id);
  n.querySelector('.tagBtn').onclick=()=>tagFriend(c.id);
  n.querySelector('.shareBtn').onclick=()=>shareChallenge(c.id);
  n.querySelector('.chainline').textContent=`⛓ ${c.attempts||0} attempts • ${c.generation} generation${c.generation>1?'s':''}`;
  return n;
}
function react(id,type){
  const c=state.challenges.find(x=>x.id===id), pid=state.currentProfile;
  c.likes ||= {}; c.dislikes ||= {};
  if(type==='like'){
    if(c.likes[pid]) delete c.likes[pid]; else {c.likes[pid]=true; delete c.dislikes[pid];}
  }else{
    if(c.dislikes[pid]) delete c.dislikes[pid]; else {c.dislikes[pid]=true; delete c.likes[pid];}
  }
  save(); renderHome();
}
function renderExplore(){
  screenEl.innerHTML=`<div class="section-title"><h2>Explore</h2></div><div class="searchbar"><input id="search" placeholder="Search challenges, users, categories..."><button class="primary" onclick="doSearch()">Search</button></div>
  <div class="pills"><button class="pill active">All</button><button class="pill">Photography</button><button class="pill">Music</button><button class="pill">Gaming</button><button class="pill">Fitness</button></div><div id="results"></div>`;
  $('#search').addEventListener('input',doSearch); doSearch();
}
function doSearch(){
  const q=($('#search')?.value||'').trim().toLowerCase(), out=$('#results'); if(!out)return;
  out.innerHTML=''; const arr=state.challenges.filter(c=>!q||`${c.title} ${c.text} ${c.creatorName}`.toLowerCase().includes(q));
  if(!arr.length)out.innerHTML='<div class="empty">No challenge found.</div>'; else arr.forEach(c=>out.appendChild(challengeCard(c)));
}
function renderCreate(parentId=null){
  currentType='text'; captureBlob=null; captureUrl='';
  screenEl.innerHTML=`<div class="section-title"><h2>${parentId?'Beat this challenge':'Create Challenge'}</h2></div>
  <section class="panel">
    <div class="type-tabs"><button class="active" data-type="text">Text</button><button data-type="photo">Photo</button><button data-type="video">Video</button><button data-type="audio">Audio</button></div>
    <div class="field"><label>Challenge title</label><input id="titleInput" maxlength="100" placeholder="Can you beat this?"></div>
    <div class="field"><label>Message / rules</label><textarea id="textInput" placeholder="Explain the challenge..."></textarea></div>
    <div id="captureArea"></div>
    <div class="field"><label>Tag friends (optional)</label><input id="tagInput" placeholder="Rahul, Aman, Priya"></div>
    <button class="primary" style="width:100%" id="postBtn">${parentId?'🔥 Post Attempt':'🚀 Publish Challenge'}</button>
  </section>`;
  document.querySelectorAll('.type-tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.type-tabs button').forEach(x=>x.classList.remove('active'));b.classList.add('active');currentType=b.dataset.type;renderCapture();});
  $('#postBtn').onclick=()=>publishChallenge(parentId);
  renderCapture();
}
function renderCapture(){
  const a=$('#captureArea'); if(!a)return;
  if(currentType==='text'){a.innerHTML=''; stopStream(); return;}
  const accept=currentType==='photo'?'image/*':currentType==='video'?'video/*':'audio/*';
  a.innerHTML=`<div class="capture-box"><strong>${currentType==='photo'?'📷 Photo':currentType==='video'?'🎥 Video':'🎙 Audio'}</strong><div class="capture-actions">
    ${currentType!=='audio'?`<button class="secondary" onclick="openCamera('${currentType}')">Open ${currentType==='photo'?'Camera':'Camera'}</button>`:`<button class="secondary" onclick="toggleAudioRecord()">Start Recording</button>`}
    <label class="secondary">Choose File<input id="filePick" type="file" accept="${accept}" ${currentType!=='audio'?'capture="environment"':''} hidden></label></div>
    <div class="capture-preview" id="preview"></div></div>`;
  $('#filePick').onchange=e=>fileChosen(e.target.files[0]);
}
async function openCamera(kind){
  stopStream();
  try{
    stream=await navigator.mediaDevices.getUserMedia({video:true,audio:kind==='video'});
    const p=$('#preview'); p.innerHTML=`<video id="liveCam" autoplay playsinline muted></video><div class="capture-actions"><button class="primary" id="snapBtn">${kind==='photo'?'Take Photo':'Start Video'}</button></div>`;
    $('#liveCam').srcObject=stream;
    if(kind==='photo') $('#snapBtn').onclick=takePhoto;
    else $('#snapBtn').onclick=startVideoRecord;
  }catch(e){toast('Camera permission denied or unavailable. You can choose a file instead.')}
}
function takePhoto(){
  const v=$('#liveCam'), c=document.createElement('canvas'); c.width=v.videoWidth||720;c.height=v.videoHeight||1280;c.getContext('2d').drawImage(v,0,0,c.width,c.height);
  c.toBlob(async b=>{captureBlob=b;captureUrl=await blobToDataURL(b);stopStream();showCaptured('image');},'image/jpeg',.86);
}
function startVideoRecord(){
  chunks=[]; recorder=new MediaRecorder(stream);
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
  recorder.onstop=async()=>{captureBlob=new Blob(chunks,{type:recorder.mimeType||'video/webm'});captureUrl=await blobToDataURL(captureBlob);stopStream();showCaptured('video')};
  recorder.start(); const btn=$('#snapBtn');btn.textContent='Stop Video';btn.onclick=()=>recorder.stop();
}
async function toggleAudioRecord(){
  if(recorder&&recorder.state==='recording'){recorder.stop();return}
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];recorder=new MediaRecorder(stream);
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
    recorder.onstop=async()=>{captureBlob=new Blob(chunks,{type:recorder.mimeType||'audio/webm'});captureUrl=await blobToDataURL(captureBlob);stopStream();showCaptured('audio')};
    recorder.start(); const btn=document.querySelector('.capture-actions .secondary'); if(btn)btn.textContent='Stop Recording'; toast('Recording started');
  }catch(e){toast('Microphone permission denied or unavailable.')}
}
function fileChosen(f){if(!f)return; const r=new FileReader();r.onload=()=>{captureUrl=r.result;captureBlob=f;showCaptured(currentType==='photo'?'image':currentType)};r.readAsDataURL(f)}
function showCaptured(kind){const p=$('#preview'); if(!p)return; p.innerHTML=kind==='image'?`<img src="${captureUrl}">`:kind==='video'?`<video src="${captureUrl}" controls playsinline></video>`:`<audio src="${captureUrl}" controls></audio>`}
function blobToDataURL(b){return new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(b)})}
function stopStream(){if(stream){stream.getTracks().forEach(t=>t.stop());stream=null}}
function publishChallenge(parentId){
  const title=$('#titleInput').value.trim(), text=$('#textInput').value.trim();
  if(!title){toast('Challenge title likho');return}
  if(currentType!=='text'&&!captureUrl){toast('Photo/video/audio add karo');return}
  const parent=parentId?state.challenges.find(c=>c.id===parentId):null;
  const c={id:'c'+Date.now(),creator:state.currentProfile,creatorName:profile().name,title,type:currentType,text,createdAt:Date.now(),parentId:parentId||null,generation:parent?(parent.generation+1):1,likes:{},dislikes:{},comments:[],attempts:0,tags:($('#tagInput').value||'').split(',').map(x=>x.trim()).filter(Boolean),media:null};
  if(captureUrl)c.media={kind:currentType==='photo'?'image':currentType,data:captureUrl};
  state.challenges.unshift(c);
  if(parent){parent.attempts=(parent.attempts||0)+1; profile().coins+=25;} else profile().coins+=10;
  state.notifications.unshift({text:parent?'Attempt posted. +25 coins 🔥':'Challenge created. +10 coins 🪙',time:Date.now(),read:false});
  save(); toast('Posted successfully'); go('home');
}
function openBeat(id){renderCreate(id)}
function openComments(id){
  const c=state.challenges.find(x=>x.id===id);
  modal.classList.remove('hidden'); modalCard.innerHTML=`<div class="modal-head"><h3>Comments</h3><button class="close" onclick="closeModal()">×</button></div>
  <div id="commentList">${(c.comments||[]).map(x=>`<div class="comment"><strong>${escapeHTML(x.name)}</strong><span>${escapeHTML(x.text)}</span></div>`).join('')||'<div class="empty">No comments yet.</div>'}</div>
  <div class="field"><textarea id="commentText" placeholder="Write a comment..."></textarea></div><button class="primary" style="width:100%" onclick="addComment('${id}')">Post Comment</button>`;
}
function addComment(id){
  const txt=$('#commentText').value.trim();if(!txt)return;
  const c=state.challenges.find(x=>x.id===id); c.comments.push({profile:state.currentProfile,name:profile().name,text:txt,time:Date.now()});save();openComments(id);
}
function closeModal(){modal.classList.add('hidden');stopStream()}
function tagFriend(id){
  const c=state.challenges.find(x=>x.id===id);
  modal.classList.remove('hidden'); modalCard.innerHTML=`<div class="modal-head"><h3>Tag a friend</h3><button class="close" onclick="closeModal()">×</button></div>
  <p class="muted">Friend ka naam likho. Share button se WhatsApp/other apps par link bhej sakte ho.</p><div class="field"><input id="friendName" placeholder="Friend name"></div><button class="primary" style="width:100%" onclick="confirmTag('${id}')">Tag & Share</button>`;
}
async function confirmTag(id){
  const name=$('#friendName').value.trim(); if(!name)return;
  const c=state.challenges.find(x=>x.id===id); c.tags ||= []; if(!c.tags.includes(name))c.tags.push(name); profile().coins+=2;save();closeModal();toast(name+' tagged • +2 coins');shareChallenge(id);
}
async function shareChallenge(id){
  const c=state.challenges.find(x=>x.id===id); const url=location.href.split('#')[0]+'#challenge='+id;
  const text=`🔥 BeatTag challenge: ${c.title}\nCan you beat it?`;
  try{if(navigator.share)await navigator.share({title:'BeatTag Challenge',text,url});else{await navigator.clipboard.writeText(text+'\n'+url);toast('Challenge link copied')}}catch(e){}
}
function renderChains(){
  const mine=state.challenges.filter(c=>c.creator===state.currentProfile||isDescendantOfMine(c));
  screenEl.innerHTML=`<div class="section-title"><h2>Challenge Chains</h2><span class="muted">${mine.length}</span></div><div class="panel"><div class="chain-tree" id="tree"></div></div>`;
  const tree=$('#tree'); if(!mine.length){tree.innerHTML='<div class="empty">No chains yet.</div>';return}
  mine.slice().sort((a,b)=>a.generation-b.generation).forEach((c,i)=>{if(i)tree.insertAdjacentHTML('beforeend','<div class="chain-arrow">↓</div>');tree.insertAdjacentHTML('beforeend',`<div class="chain-node"><div class="avatar">${c.creatorName[0]}</div><div><strong>${escapeHTML(c.creatorName)}</strong><div>${escapeHTML(c.title)}</div><small class="muted">Generation ${c.generation} • ${c.attempts||0} attempts</small></div></div>`)})
}
function isDescendantOfMine(c){let p=c;let guard=0;while(p?.parentId&&guard++<50){p=state.challenges.find(x=>x.id===p.parentId);if(p?.creator===state.currentProfile)return true}return false}
function renderProfile(){
  const p=profile(), mine=state.challenges.filter(c=>c.creator===p.id), likes=mine.reduce((s,c)=>s+Object.keys(c.likes||{}).length,0), attempts=mine.reduce((s,c)=>s+(c.attempts||0),0), maxGen=Math.max(1,...mine.map(c=>c.generation));
  screenEl.innerHTML=`<section class="panel profile-head"><div class="profile-avatar">${p.name[0]}</div><h2>${escapeHTML(p.name)}</h2><div class="muted">${escapeHTML(p.handle)}</div><div style="margin-top:9px"><span class="badge">🔥 ${p.streak} day streak</span><span class="badge">🪙 ${p.coins} coins</span></div>
  <button class="secondary" style="margin-top:12px" onclick="editProfile()">Edit Profile</button></section>
  <div class="grid"><div class="stat"><strong>${mine.length}</strong><span>Challenges</span></div><div class="stat"><strong>${attempts}</strong><span>Attempts</span></div><div class="stat"><strong>${likes}</strong><span>Likes received</span></div><div class="stat"><strong>${maxGen}</strong><span>Longest generation</span></div></div>
  <div class="section-title"><h2>My Challenges</h2><button class="ghost" onclick="go('shop')">Coin Shop</button></div><div id="myFeed"></div>`;
  const f=$('#myFeed'); if(!mine.length)f.innerHTML='<div class="empty">Create your first challenge.</div>'; else mine.forEach(c=>f.appendChild(challengeCard(c)));
}
function editProfile(){
  const p=profile();modal.classList.remove('hidden');modalCard.innerHTML=`<div class="modal-head"><h3>Edit Profile</h3><button class="close" onclick="closeModal()">×</button></div><div class="field"><label>Name</label><input id="epName" value="${escapeAttr(p.name)}"></div><div class="field"><label>Handle</label><input id="epHandle" value="${escapeAttr(p.handle)}"></div><button class="primary" style="width:100%" onclick="saveProfile()">Save</button>`
}
function saveProfile(){const p=profile();p.name=$('#epName').value.trim()||p.name;p.handle=$('#epHandle').value.trim()||p.handle;save();closeModal();renderProfile()}
const SHOP=[
 {id:'firepack',icon:'🔥',name:'Fire Reaction Pack',desc:'Special fiery reaction set',cost:100,duration:'7 days'},
 {id:'frame',icon:'⚡',name:'Neon Profile Frame',desc:'Animated-looking neon profile frame',cost:300,duration:'30 days'},
 {id:'theme',icon:'🌌',name:'Galaxy Challenge Theme',desc:'Special challenge-card theme',cost:220,duration:'14 days'},
 {id:'sticker',icon:'😎',name:'Sticker Pack',desc:'Extra challenge stickers',cost:140,duration:'30 days'},
 {id:'trophy',icon:'🏆',name:'Legend Trophy',desc:'Permanent collectible trophy',cost:1200,duration:'Permanent'},
 {id:'confetti',icon:'🎉',name:'Victory Effect',desc:'Celebration effect after a win',cost:180,duration:'7 days'}
];
function renderShop(){
  screenEl.innerHTML=`<div class="section-title"><h2>🛍 Coin Shop</h2><span class="muted">🪙 ${profile().coins}</span></div><p class="muted">Core BeatTag features are free. Coins only unlock fun cosmetic items.</p><div class="shop-grid" id="shop"></div>`;
  const s=$('#shop');SHOP.forEach(it=>{const owned=isOwned(it.id);s.insertAdjacentHTML('beforeend',`<div class="shop-item"><div class="shop-icon">${it.icon}</div><h3>${it.name}</h3><p>${it.desc}<br>${it.duration}</p><button class="${owned?'secondary':'primary'}" ${owned?'disabled':''} onclick="buyItem('${it.id}')">${owned?'Unlocked':`🪙 ${it.cost}`}</button></div>`)})
}
function isOwned(id){const x=state.purchases.find(p=>p.profile===state.currentProfile&&p.item===id);if(!x)return false;if(!x.expiresAt)return true;return x.expiresAt>Date.now()}
function buyItem(id){
  const it=SHOP.find(x=>x.id===id),p=profile(); if(isOwned(id))return;if(p.coins<it.cost){toast('Not enough coins');return}
  p.coins-=it.cost; let exp=null;if(it.duration.includes('7 days'))exp=Date.now()+7*864e5;if(it.duration.includes('14 days'))exp=Date.now()+14*864e5;if(it.duration.includes('30 days'))exp=Date.now()+30*864e5;
  state.purchases.push({profile:p.id,item:id,boughtAt:Date.now(),expiresAt:exp});save();toast(it.name+' unlocked');renderShop();
}
function openNotifications(){
  state.notifications.forEach(n=>n.read=true);save();modal.classList.remove('hidden');modalCard.innerHTML=`<div class="modal-head"><h3>Notifications</h3><button class="close" onclick="closeModal()">×</button></div>${state.notifications.map(n=>`<div class="comment"><strong>${escapeHTML(n.text)}</strong><span>${fmt(n.time)}</span></div>`).join('')||'<div class="empty">No notifications.</div>'}`
}
function escapeHTML(s=''){return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function escapeAttr(s=''){return escapeHTML(s)}
window.addEventListener('hashchange',()=>{const m=location.hash.match(/challenge=(.+)/);if(m){const c=state.challenges.find(x=>x.id===m[1]);if(c){renderHome();setTimeout(()=>toast('Challenge opened: '+c.title),100)}}});
updateCoins();go('home');
