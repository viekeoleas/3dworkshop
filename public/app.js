import * as THREE from 'three';
import {OrbitControls} from '/OrbitControls.js';
const $=s=>document.querySelector(s),host=$('#canvas');
const scene=new THREE.Scene();scene.background=new THREE.Color('#e9edf2');
const camera=new THREE.PerspectiveCamera(36,1,.1,10000);
let renderer;try{renderer=new THREE.WebGLRenderer({antialias:true});}catch{ $('#error').hidden=false;$('#error').textContent='3D недоступно. Включите аппаратное ускорение браузера.';throw Error('WebGL unavailable');}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));host.appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
scene.add(new THREE.HemisphereLight(0xffffff,0x7a8595,2.5));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(100,250,180);scene.add(light);
const grid=new THREE.GridHelper(400,40,0xb0bccb,0xd1d9e2);scene.add(grid);
let model=new THREE.Group();scene.add(model);let current;
function reset(){if(!current)return;const {width:w,height:h,depth:d}=current.dimensions;const size=Math.max(w,h,d);camera.position.set(size*1.65,size*1.45,size*1.85);controls.target.set(0,h*.42,0);controls.update();}
function show(p){current=p;$('#title').textContent=p.name;$('#description').textContent=p.description||'';$('#error').hidden=!p.error;if(p.error){$('#error').textContent=p.error;current=null;$('#dimensions').textContent='—';$('#wall').textContent='—';}
for(const c of [...model.children]){model.remove(c);c.geometry.dispose();c.material.dispose();}if(p.error)return;
const {width:w,depth:d,height:h,wall:t}=p.dimensions;
function box(x,y,z,px,py,pz){const m=new THREE.Mesh(new THREE.BoxGeometry(x,y,z),new THREE.MeshStandardMaterial({color:0x769fc2,roughness:.55,metalness:.05}));m.position.set(px,py,pz);model.add(m);}
box(w,t,d,0,t/2,0);box(t,h-t,d,-(w-t)/2,(h+t)/2,0);box(t,h-t,d,(w-t)/2,(h+t)/2,0);box(w-2*t,h-t,t,0,(h+t)/2,-(d-t)/2);box(w-2*t,h-t,t,0,(h+t)/2,(d-t)/2);
$('#dimensions').textContent=`${w} × ${d} × ${h} мм`;$('#wall').textContent=t+' мм';reset();}
$('#reset').onclick=reset;
new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(host);
renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
async function load(){try{const r=await fetch('/api/projects');if(!r.ok)throw Error();const {projects}=await r.json();$('#count').textContent=projects.length;$('#projects').replaceChildren();if(!projects.length){$('#title').textContent='Пока нет проектов';$('#description').textContent='Добавьте проект в папку projects.';return;}for(const p of projects){const b=document.createElement('button');b.textContent=p.name;const s=document.createElement('small');s.textContent=p.error?'Ошибка чтения':'3D-модель · '+p.units;b.appendChild(s);b.onclick=()=>{document.querySelectorAll('nav button').forEach(x=>x.setAttribute('aria-current','false'));b.setAttribute('aria-current','true');show(p);};$('#projects').appendChild(b);}$('#projects button').click();}catch{$('#error').hidden=false;$('#error').textContent='Не удалось прочитать проекты. Проверьте локальный сервис и папку projects.';$('#title').textContent='Ошибка загрузки';}}
load();
