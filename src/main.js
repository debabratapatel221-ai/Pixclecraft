import * as THREE from "three";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc4e3);
scene.fog = new THREE.Fog(0x8fc4e3, 24, 78);

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, .1, 120);
camera.position.set(0, 5, 9);
const renderer = new THREE.WebGLRenderer({antialias:false});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.querySelector("#game").appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight(0xd9efff, 0x59633c, 1.55); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff0d3, 2.1);
sun.position.set(-25, 40, 18); sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
sun.shadow.camera.left=-35; sun.shadow.camera.right=35; sun.shadow.camera.top=35; sun.shadow.camera.bottom=-35;
scene.add(sun);

const materials = {};
function pixelTexture(base, speck, seed=1) {
  const c=document.createElement("canvas"); c.width=64;c.height=64;
  const x=c.getContext("2d"); x.fillStyle=base;x.fillRect(0,0,64,64);
  let s=seed; const rand=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
  for(let i=0;i<360;i++){x.fillStyle=speck[Math.floor(rand()*speck.length)];const size=1+Math.floor(rand()*4);x.fillRect(Math.floor(rand()*64),Math.floor(rand()*64),size,size);}
  const t=new THREE.CanvasTexture(c);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestMipmapNearestFilter;t.colorSpace=THREE.SRGBColorSpace;return t;
}
const grassTop=pixelTexture("#70a83d",["#80b84a","#5f9634","#8cbd51","#679d38"],2);
const grassSide=pixelTexture("#795239",["#8b623f","#68452f","#70a83d","#5f9634"],3);
const dirt=pixelTexture("#795239",["#8b623f","#68452f","#916947"],4);
const stone=pixelTexture("#858783",["#999b96","#6f736f","#777b78","#a5a59e"],5);
const sand=pixelTexture("#d4c27b",["#e2d18d","#c6b36d","#eee0a2"],6);
const wood=pixelTexture("#80532f",["#9a693a","#684326","#b07a43"],7);
const leaves=pixelTexture("#397d35",["#4a9140","#2e6d30","#5a9d48","#28642c"],8);
const mats={
 grass:[new THREE.MeshLambertMaterial({map:grassSide}),new THREE.MeshLambertMaterial({map:grassSide}),new THREE.MeshLambertMaterial({map:grassTop}),new THREE.MeshLambertMaterial({map:dirt}),new THREE.MeshLambertMaterial({map:grassSide}),new THREE.MeshLambertMaterial({map:grassSide})],
 dirt:new THREE.MeshLambertMaterial({map:dirt}), stone:new THREE.MeshLambertMaterial({map:stone}), sand:new THREE.MeshLambertMaterial({map:sand}), wood:new THREE.MeshLambertMaterial({map:wood}), leaves:new THREE.MeshLambertMaterial({map:leaves})
};
const cube=new THREE.BoxGeometry(1,1,1), world=new THREE.Group();scene.add(world);
const blockMap=new Map(), blockMeshes=[];
const key=(x,y,z)=>`${x},${y},${z}`;
function addBlock(x,y,z,type,addToMap=true){
 const mesh=new THREE.Mesh(cube, type==="grass"?mats.grass:mats[type]||mats.dirt);
 mesh.position.set(x,y,z);mesh.castShadow=type!=="leaves";mesh.receiveShadow=true;mesh.userData={x,y,z,type};
 world.add(mesh);blockMeshes.push(mesh);if(addToMap)blockMap.set(key(x,y,z),mesh);return mesh;
}
function heightAt(x,z){return Math.floor(2+1.7*Math.sin(x*.19)+1.25*Math.cos(z*.16)+.75*Math.sin((x+z)*.11));}
function hash(x,z){const v=Math.sin(x*127.1+z*311.7)*43758.5453;return v-Math.floor(v);}
for(let x=-25;x<=25;x++)for(let z=-25;z<=25;z++){
 const h=heightAt(x,z);
 for(let y=-2;y<=h;y++){
  const type=y===h?(h<=1?"sand":"grass"):(y<h-3?"stone":"dirt");
  addBlock(x,y,z,type);
 }
 // trees, placed away from spawn and on suitable grass
 if(Math.abs(x)>4&&Math.abs(z)>4&&hash(x,z)>.976&&h>2){
  const trunk=3+Math.floor(hash(z,x)*2);
  for(let y=1;y<=trunk;y++)addBlock(x,h+y,z,"wood");
  for(let dy=trunk-1;dy<=trunk+2;dy++){
   const radius=dy===trunk+2?1:2;
   for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++){
    if(Math.abs(dx)+Math.abs(dz)<=(radius===2?3:2) && !(dx===0&&dz===0&&dy<=trunk))
      addBlock(x+dx,h+dy,z+dz,"leaves");
   }
  }
 }
}
const waterMat=new THREE.MeshLambertMaterial({color:0x4b9fc5,transparent:true,opacity:.78});
const water=new THREE.Mesh(new THREE.PlaneGeometry(100,100),waterMat);water.rotation.x=-Math.PI/2;water.position.y=1.0;scene.add(water);

const player={pos:new THREE.Vector3(0,5,8),vel:new THREE.Vector3(),yaw:0,pitch:0,onGround:false};
camera.position.copy(player.pos);
let locked=false,keys={},selected="grass";
const raycaster=new THREE.Raycaster();raycaster.far=6;
const types=["grass","dirt","stone","wood","leaves","sand"];
const colors={grass:"#70a83d",dirt:"#795239",stone:"#858783",wood:"#80532f",leaves:"#397d35",sand:"#d4c27b"};
const hotbar=document.querySelector("#hotbar");
types.forEach((t,i)=>{const s=document.createElement("div");s.className="slot"+(i===0?" active":"");s.innerHTML=`<span>${i+1}</span><i class="swatch" style="background:${colors[t]}"></i>`;s.onclick=()=>select(t);hotbar.appendChild(s)});
function select(t){selected=t;[...hotbar.children].forEach((e,i)=>e.classList.toggle("active",types[i]===t));toast(`${t.toUpperCase()} SELECTED`)}
function toast(msg){const e=document.querySelector("#toast");e.textContent=msg;e.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.classList.remove("show"),1100)}
document.querySelector("#play").onclick=()=>{renderer.domElement.requestPointerLock();document.querySelector("#welcome").style.display="none"};
document.addEventListener("pointerlockchange",()=>{locked=document.pointerLockElement===renderer.domElement;if(!locked&&document.querySelector("#welcome").style.display==="none")document.querySelector("#welcome").style.display="grid"});
document.addEventListener("mousemove",e=>{if(!locked)return;player.yaw-=e.movementX*.0022;player.pitch-=e.movementY*.0022;player.pitch=Math.max(-1.48,Math.min(1.48,player.pitch))});
document.addEventListener("keydown",e=>{keys[e.code]=true;if(e.code.startsWith("Digit")){const n=Number(e.code.slice(5));if(types[n-1])select(types[n-1])}});
document.addEventListener("keyup",e=>keys[e.code]=false);
document.addEventListener("contextmenu",e=>e.preventDefault());
function targetBlock(){camera.updateMatrixWorld();raycaster.setFromCamera(new THREE.Vector2(0,0),camera);return raycaster.intersectObjects(blockMeshes,false)[0]}
document.addEventListener("mousedown",e=>{
 if(!locked)return;const hit=targetBlock();if(!hit)return;
 const b=hit.object.userData;
 if(e.button===0){world.remove(hit.object);blockMap.delete(key(b.x,b.y,b.z));blockMeshes.splice(blockMeshes.indexOf(hit.object),1)}
 if(e.button===2){const n=hit.face.normal;const p=hit.object.position.clone().add(n);const x=Math.round(p.x),y=Math.round(p.y),z=Math.round(p.z);if(!blockMap.has(key(x,y,z)))addBlock(x,y,z,selected)}
});
function solidAt(x,y,z){return blockMap.has(key(Math.round(x),Math.round(y),Math.round(z)))}
function update(dt){
 const forward=new THREE.Vector3(-Math.sin(player.yaw),0,-Math.cos(player.yaw));
 const right=new THREE.Vector3(Math.cos(player.yaw),0,-Math.sin(player.yaw));
 const move=new THREE.Vector3();if(keys.KeyW)move.add(forward);if(keys.KeyS)move.sub(forward);if(keys.KeyD)move.add(right);if(keys.KeyA)move.sub(right);if(move.lengthSq())move.normalize();
 const speed=keys.ShiftLeft?8:5;player.vel.x=move.x*speed;player.vel.z=move.z*speed;
 player.vel.y-=19*dt;
 if(keys.Space&&player.onGround){player.vel.y=7.4;player.onGround=false}
 let nx=player.pos.x+player.vel.x*dt,nz=player.pos.z+player.vel.z*dt,ny=player.pos.y+player.vel.y*dt;
 if(!solidAt(nx,player.pos.y-1.5,player.pos.z)&&!solidAt(nx,player.pos.y-.5,player.pos.z))player.pos.x=nx;
 if(!solidAt(player.pos.x,player.pos.y-1.5,nz)&&!solidAt(player.pos.x,player.pos.y-.5,nz))player.pos.z=nz;
 if(solidAt(player.pos.x,ny-1.7,player.pos.z)){player.pos.y=Math.floor(ny-1.7)+2.7;player.vel.y=0;player.onGround=true}else{player.pos.y=ny;player.onGround=false}
 if(player.pos.y<-10){player.pos.set(0,9,8);player.vel.set(0,0,0)}
 camera.position.copy(player.pos);camera.rotation.order="YXZ";camera.rotation.y=player.yaw;camera.rotation.x=player.pitch;
 document.querySelector("#coords").textContent=`X ${Math.round(player.pos.x)} · Y ${Math.round(player.pos.y)} · Z ${Math.round(player.pos.z)}`;
}
let last=performance.now();
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.04);last=now;if(locked)update(dt);renderer.render(scene,camera)}
animate(last);
addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
