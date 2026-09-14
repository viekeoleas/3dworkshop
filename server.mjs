import http from 'node:http';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
export function validate(p){if(p.schemaVersion!==1||!p.id||typeof p.name!=='string'||p.units!=='mm')throw Error('Неподдерживаемый формат проекта');const d=p.dimensions;if(!d||!['width','depth','height','wall'].every(k=>Number.isFinite(d[k])&&d[k]>0)||2*d.wall>=Math.min(d.width,d.depth)||d.wall>=d.height)throw Error('Некорректные размеры корпуса');return p;}
export function createServer(projectDir=path.join(root,'projects')){return http.createServer(async(req,res)=>{
 const send=(status,data,type='application/json')=>{res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(type==='application/json'?JSON.stringify(data):data);};
 if(req.method!=='GET')return send(405,{error:'Только чтение'});
 const pathname=new URL(req.url,'http://localhost').pathname;
 try{
 if(pathname==='/api/health')return send(200,{app:'3dworkshop',version:1});
 if(pathname==='/api/projects'){
 const dirs=await readdir(projectDir,{withFileTypes:true});const projects=[];
 for(const d of dirs.filter(d=>d.isDirectory())){try{const p=validate(JSON.parse(await readFile(path.join(projectDir,d.name,'project.json'),'utf8')));projects.push({folder:d.name,...p});}catch{projects.push({folder:d.name,name:d.name,error:'Не удалось прочитать проект. Проверьте project.json и размеры.'});}}
 return send(200,{projects});}
 const files={'/':['public/index.html','text/html; charset=utf-8'],'/app.js':['public/app.js','text/javascript'],'/style.css':['public/style.css','text/css'],'/three.js':['node_modules/three/build/three.module.js','text/javascript'],'/three.core.js':['node_modules/three/build/three.core.js','text/javascript'],'/OrbitControls.js':['node_modules/three/examples/jsm/controls/OrbitControls.js','text/javascript']};
 if(!files[pathname])return send(404,{error:'Не найдено'});
 const [file,type]=files[pathname];send(200,await readFile(path.join(root,file)),type);
 }catch{send(500,{error:'Не удалось загрузить данные мастерской. Проверьте доступ к папке projects.'});}
 });}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||4317),url=`http://127.0.0.1:${port}`;
 const open=()=>{if(process.argv.includes('--open')&&process.platform==='win32')spawn('explorer.exe',[url],{detached:true,stdio:'ignore',windowsHide:true}).unref();};
 const server=createServer();server.on('error',async e=>{if(e.code==='EADDRINUSE'){try{const response=await fetch(url+'/api/health');if((await response.json()).app==='3dworkshop'){console.log('Мастерская уже запущена: '+url);open();return;}}catch{}console.error('Порт занят другим приложением: '+port);}else console.error(e.message);process.exitCode=1;});
 server.listen(port,'127.0.0.1',()=>{console.log('3D Workshop: '+url);open();});
}
