import assert from 'node:assert/strict';
import {newMatch,pushEvent,undo,redo,replay,buildStats,validateBackup,newAppData} from '../js/model.js';
const team={id:'T',club:'VBC Interlaken',category:'Damen',season:'2026/27',players:Array.from({length:12},(_,i)=>({id:`p${i+1}`,first:`P${i+1}`,last:'',number:i+1,position:i===11?'L':'A'}))};
const ids=team.players.map(p=>p.id);
function init(server='home'){let m=newMatch(team,'Gast','2026-10-25',ids);return pushEvent(m,{type:'SET_START',lineup:ids.slice(0,6),liberoId:'p12',side:'left',firstServe:server});}
function rally(m,kind,winner){return pushEvent(m,{type:'RALLY',kind,winner});}
let m=init();
// Fault then opponent side-out -> next server faults, consecutive pattern.
m=rally(m,'fault','away');
m=rally(m,'opponent','home');
assert.equal(replay(m).current.slots[0].playerId,'p2');
m=rally(m,'fault','away');
assert.equal(buildStats(m).patterns.filter(e=>e.type==='consecutive').length,1);
let n=init('away');
n=rally(n,'opponent','home');
assert.equal(replay(n).current.slots[0].playerId,'p2');
assert.equal(replay(n).current.homeTurn,1);
// Libera replacement and undo participation accounting.
n=pushEvent(n,{type:'LIBERO',playerId:'p6',enter:true});
n=rally(n,'ace','home');
let stats=buildStats(n);
assert.equal(stats.stats.find(x=>x.player.id==='p12').played,1);
assert.equal(stats.stats.find(x=>x.player.id==='p6').played,1); // first rally only, before Libera entered
n=undo(n);assert.equal(buildStats(n).stats.find(x=>x.player.id==='p12').played,0);
n=redo(n);assert.equal(buildStats(n).stats.find(x=>x.player.id==='p12').played,1);
// 5th-set first team reaching 8 triggers exactly one side switch.
let z=init();
for(let setNo=1;setNo<5;setNo++){
  const toWin=setNo===5?15:25;
  if(replay(z).current.server==='away')z=rally(z,'opponent','home');
  for(let i=replay(z).current.home;i<toWin;i++)z=rally(z,'ace','home');
  assert.equal(replay(z).current.winner,'home');
  if(setNo<3)z=pushEvent(z,{type:'SET_START',lineup:ids.slice(0,6),liberoId:'p12',side:'left',firstServe:setNo%2?'away':'home'});
  if(setNo===3)break;
}
assert.equal(replay(z).finished,true);
assert.throws(()=>pushEvent(z,{type:'SET_START',lineup:ids.slice(0,6),firstServe:'away'}));
// Build five sets 2:2 then 5th for 8-point automatic switch.
let q=init();
for(let i=0;i<25;i++)q=rally(q,'ace','home'); // 1–0
q=pushEvent(q,{type:'SET_START',lineup:ids.slice(0,6),liberoId:'p12',side:'left',firstServe:'away'});
for(let i=0;i<25;i++)q=rally(q,'opponent','away'); // 1–1
q=pushEvent(q,{type:'SET_START',lineup:ids.slice(0,6),liberoId:'p12',side:'left',firstServe:'home'});
for(let i=0;i<25;i++)q=rally(q,'ace','home'); // 2–1
q=pushEvent(q,{type:'SET_START',lineup:ids.slice(0,6),liberoId:'p12',side:'left',firstServe:'away'});
for(let i=0;i<25;i++)q=rally(q,'opponent','away'); // 2–2
q=pushEvent(q,{type:'SET_START',lineup:ids.slice(0,6),liberoId:'p12',side:'left',firstServe:'away'});
for(let i=0;i<8;i++)q=rally(q,'opponent','away');
assert.equal(replay(q).current.side,'right');assert.equal(replay(q).current.sideSwitched,true);
q=undo(q);assert.equal(replay(q).current.side,'left');q=redo(q);assert.equal(replay(q).current.side,'right');
const backup={...newAppData(),matches:[q]};assert.equal(validateBackup(backup),true);
console.log('PASS – Fehlermuster, Libera-Einsatz, 5. Satz Seitenwechsel/Undo, Spielende und JSON-Sicherung.');
