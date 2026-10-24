/** ServeIQ v0.1 – pure, deterministic volleyball rules and statistics. */
export const VERSION = 1;
export const uid = () => (globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const opposite = s => s === 'home' ? 'away' : 'home';
export const sideOpposite = s => s === 'left' ? 'right' : 'left';
export const setTarget = number => number === 5 ? 15 : 25;
export const wonSet = (h, a, number) => Math.max(h,a) >= setTarget(number) && Math.abs(h-a) >= 2;
export const newAppData = () => ({schema:VERSION, teams:[],matches:[],draft:null, lastView:'teams',introSeen:false});
export function teamName(t) {
  return [t.club, t.category, t.league, t.group?`Gr. ${t.group}`:'', t.teamNumber?`#${t.teamNumber}`:'',t.season].filter(Boolean).join(' · ');
}
export const playerLabel = p => p ? `#${p.number} ${p.first} ${p.last}`.trim() : '–';
export const clone = x => JSON.parse(JSON.stringify(x));
export function newMatch(team, opponent, date, rosterIds) {
  if (!team || !opponent?.trim() || rosterIds.length < 6) throw Error('Team, Gegner und mindestens 6 Spielerinnen erforderlich.');
  return {id:uid(), teamId:team.id, teamSnapshot:clone(team), opponent:opponent.trim(),date,
    rosterIds:[...rosterIds], events:[], cursor:0, archivedEarly:false, createdAt:new Date().toISOString()};
}
export function pushEvent(match, event) {
  const state = replay(match);
  if(state.finished) throw Error('Dieses Spiel ist abgeschlossen.');
  if(match.archivedEarly) throw Error('Dieses Spiel ist archiviert.');
  const next=clone(match);
  next.events=next.events.slice(0,next.cursor);
  next.events.push({...event, at:new Date().toISOString()});
  next.cursor=next.events.length;
  const result=replay(next);
  if(result.error) throw Error(result.error);
  return next;
}
export function undo(match) {let x=clone(match);if(x.cursor>0 && !x.archivedEarly)x.cursor--;return x;}
export function redo(match) {let x=clone(match);if(x.cursor<x.events.length && !x.archivedEarly)x.cursor++;return x;}
function activePlayers(set){return set.slots.map(sl=>sl.libero?set.liberoId:sl.playerId);}
function currentServer(set){return set.slots[0]?.playerId;}
function snapshotRally(set,kind,winner) {
  return {kind,winner,serverId:set.server==='home'?currentServer(set):null,servingTeam:set.server,
    before:[set.home,set.away],participants:activePlayers(set),turn:set.homeTurn};
}
function eventApply(st,e,idx) {
  if(e.type==='SET_START') {
    if(st.sets.length && !st.sets.at(-1).winner) return 'Vor dem nächsten Satz muss der aktuelle Satz beendet sein.';
    if(st.sets.length>=5 || st.finished) return 'Das Spiel ist bereits beendet.';
    if(!Array.isArray(e.lineup)||e.lineup.length!==6||new Set(e.lineup).size!==6) return 'Genau sechs unterschiedliche Startspielerinnen nötig.';
    if(!e.lineup.every(id=>st.match.rosterIds.includes(id))) return 'Eine Startspielerin fehlt im Matchkader.';
    if(e.liberoId && (e.lineup.includes(e.liberoId)||!st.match.rosterIds.includes(e.liberoId))) return 'Ungültige Libera-Auswahl.';
    const number=st.sets.length+1;
    if(number>=2 && number<=4 && e.firstServe!==opposite(st.sets.at(-1).firstServe)) return 'Ab Satz 2–4 muss die Mannschaft beginnen, die im vorigen Satz nicht zuerst serviert hat.';
    const set={number,firstServe:e.firstServe,side:e.side||'left',home:0,away:0,server:e.firstServe,
      slots:e.lineup.map(id=>({starterId:id,playerId:id,libero:false})),liberoId:e.liberoId||null,
      regularSubs:0, subPairs:{},homeTurn:e.firstServe==='home'?1:0,rallies:[],substitutions:[],
      liberoMoves:[],pending:null,winner:null,sideSwitched:false,sideSwitchJustHappened:false,phaseNote:''};
    st.sets.push(set);return null;
  }
  const set=st.sets.at(-1);
  if(!set) return 'Zuerst den ersten Satz starten.';
  if(set.winner) return 'Dieser Satz ist beendet.';
  set.sideSwitchJustHappened=false;
  if(e.type==='NORMAL') {
    if(set.pending || set.server!=='home') return 'Normaler Service hier nicht möglich.';
    set.pending={serverId:currentServer(set),before:[set.home,set.away],turn:set.homeTurn};return null;
  }
  if(e.type==='RALLY') {
    if(set.pending && e.kind!=='normal') return 'Zuerst den normalen Service abschliessen.';
    if(!set.pending && e.kind==='normal') return 'Zuerst normalen Service erfassen.';
    if(set.server==='home' && !['ace','fault','normal'].includes(e.kind)) return 'Ungültige Serviceaktion.';
    if(set.server==='away' && e.kind!=='opponent') return 'Gegner serviert.';
    if(e.kind==='ace' && e.winner!=='home') return 'Ass bedeutet Punkt Interlaken.';
    if(e.kind==='fault' && e.winner!=='away') return 'Servicefehler bedeutet Punkt Gegner.';
    if(!['home','away'].includes(e.winner)) return 'Punktgewinner fehlt.';
    let rally=snapshotRally(set,e.kind,e.winner);
    if(set.pending) {rally.serverId=set.pending.serverId; rally.before=[...set.pending.before];rally.turn=set.pending.turn;}
    set.rallies.push(rally);
    if(e.winner==='home')set.home++;else set.away++;
    if(set.server==='away' && e.winner==='home') {
      set.slots.push(set.slots.shift()); // position 2 becomes position 1: clockwise side-out
      set.homeTurn++;
    }
    set.server=e.winner;
    set.pending=null;
    if(set.number===5 && !set.sideSwitched && Math.max(set.home,set.away)>=8) {
      set.sideSwitched=true;set.side=sideOpposite(set.side);set.sideSwitchJustHappened=true;
    }
    if(wonSet(set.home,set.away,set.number)) {
      set.winner=set.home>set.away?'home':'away';
      const homeWins=st.sets.filter(s=>s.winner==='home').length;
      const awayWins=st.sets.filter(s=>s.winner==='away').length;
      if(homeWins===3||awayWins===3)st.finished=true;
    }
    return null;
  }
  if(set.pending) return 'Ein normaler Service muss zuerst abgeschlossen werden.';
  if(e.type==='SUB') {
    if(set.regularSubs>=6) return 'Maximal sechs reguläre Wechsel pro Satz.';
    const pos=set.slots.findIndex(x=>x.playerId===e.outId);
    if(pos<0) return 'Die auszuwechselnde Spielerin steht nicht regulär auf dem Feld.';
    const slot=set.slots[pos];if(slot.libero)return 'Zuerst den Liberawechsel abschliessen.';
    if(!st.match.rosterIds.includes(e.inId))return 'Ersatzspielerin nicht im Matchkader.';
    if(set.slots.some(s=>s.playerId===e.inId || (s.libero&&set.liberoId===e.inId)))return 'Spielerin steht bereits auf dem Feld.';
    if(set.liberoId===e.inId) return 'Libera nur über Liberawechsel einsetzen.';
    const pair=set.subPairs[slot.starterId];
    if(!pair) {
      if(slot.playerId!==slot.starterId) return 'Ungültiger Erstwechsel.';
      const involved=Object.values(set.subPairs).some(p=>p.subId===e.inId);
      if(involved)return 'Diese Ersatzspielerin wurde bereits eingesetzt.';
      set.subPairs[slot.starterId]={subId:e.inId,returned:false};
    }else{
      if(pair.returned||slot.playerId!==pair.subId||e.inId!==slot.starterId)return 'Nur der regelkonforme Rückwechsel ist noch möglich.';
      pair.returned=true;
    }
    slot.playerId=e.inId;set.regularSubs++;
    set.substitutions.push({kind:'regular',out:e.outId,in:e.inId,at:[set.home,set.away],rallyIndex:set.rallies.length});return null;
  }
  if(e.type==='LIBERO') {
    if(!set.liberoId)return 'Für diesen Satz wurde keine Libera gewählt.';
    const pos=set.slots.findIndex(s=>s.playerId===e.playerId);
    if(pos<0)return 'Spielerin nicht in der aktuellen Aufstellung.';
    if(![0,4,5].includes(pos))return 'Liberawechsel nur im Hinterfeld (Positionen 1, 5, 6).';
    const slot=set.slots[pos];
    if(Boolean(slot.libero)===Boolean(e.enter))return 'Liberawechsel widerspricht dem aktuellen Status.';
    if(e.enter&&set.slots.some(s=>s.libero))return 'Es darf nur eine Libera gleichzeitig auf dem Feld sein.';
    if(e.enter&&pos===0&&set.server==='home')return 'Die Libera darf nicht am Service eingesetzt werden.';
    // A completed rally is required between libero replacement actions, apart from specific official exceptions.
    const last=set.liberoMoves.at(-1);
    if(last && last.rallyIndex===set.rallies.length) return 'Zwischen Liberawechseln muss grundsätzlich ein Ballwechsel abgeschlossen sein.';
    slot.libero=Boolean(e.enter);
    set.liberoMoves.push({enter:Boolean(e.enter),playerId:e.playerId,at:[set.home,set.away],rallyIndex:set.rallies.length});return null;
  }
  if(e.type==='SIDE') {set.side=sideOpposite(set.side);set.phaseNote='Spielfeldseite manuell korrigiert';return null;}
  return 'Unbekannte Aktion.';
}
export function replay(match){
  let st={match,sets:[],finished:false,error:null};
  for(let i=0;i<match.cursor;i++) {
    let error=eventApply(st,match.events[i],i);
    if(error){st.error=`Aktion ${i+1}: ${error}`;break;}
  }
  st.current=st.sets.at(-1)||null;
  st.homeSets=st.sets.filter(s=>s.winner==='home').length;
  st.awaySets=st.sets.filter(s=>s.winner==='away').length;
  return st;
}
export function buildStats(match, selectedSet=0){
  const st=replay(match);const players=match.teamSnapshot.players.filter(p=>match.rosterIds.includes(p.id));
  const sets=selectedSet?st.sets.filter(s=>s.number===selectedSet):st.sets;
  const allSets=st.sets;
  const detailed=[];const patterns=[];const phases=[];
  for(const set of sets){
    const served=set.rallies.filter(r=>r.servingTeam==='home');
    const byTurn=new Map();
    served.forEach(r=>{const key=`${r.turn}-${r.serverId}`;if(!byTurn.has(key))byTurn.set(key,[]);byTurn.get(key).push(r);});
    const runs=[...byTurn].map(([key,arr])=>({playerId:arr[0].serverId,turn:arr[0].turn,first:arr[0],last:arr.at(-1)})).sort((a,b)=>a.turn-b.turn);
    for(let i=1;i<runs.length;i++){
      const prev=runs[i-1],cur=runs[i];
      if(prev.last.kind==='fault' && cur.first.kind==='fault' && prev.playerId!==cur.playerId)patterns.push({type:'consecutive',set:set.number,players:[prev.playerId,cur.playerId]});
    }
    const lastByPlayer=new Map();
    for(const run of runs){const prev=lastByPlayer.get(run.playerId);
      if(prev && prev.last.kind==='fault' && run.first.kind==='fault')patterns.push({type:'repeat',set:set.number,players:[run.playerId]});
      lastByPlayer.set(run.playerId,run);
    }
    for(const r of served){
      const [h,a]=r.before,peak=Math.max(h,a),late=set.number===5?14:24;
      let phase;
      if(h>=late&&a>=late)phase='Verlängerung';
      else if(peak<=(set.number===5?5:9))phase='Start';
      else if(peak<=(set.number===5?11:19))phase='Aufbau';
      else phase='Entscheidung';
      const target=setTarget(set.number);
      const setballHome=h>=target-1&&h>a;
      const setballAway=a>=target-1&&a>h;
      phases.push({set:set.number,playerId:r.serverId,phase,score:`${h}:${a}`,situation:h>a?'Führung':h<a?'Rückstand':'Gleichstand',setball:setballHome?'Satzball für Interlaken':setballAway?'Satzball Gegner':'',kind:r.kind,winner:r.winner});
    }
  }
  const stats=players.map(p=>{
    const rallies=sets.flatMap(s=>s.rallies);
    const mine=rallies.filter(r=>r.servingTeam==='home'&&r.serverId===p.id);
    const ace=mine.filter(r=>r.kind==='ace').length,normal=mine.filter(r=>r.kind==='normal').length,
      fault=mine.filter(r=>r.kind==='fault').length,points=mine.filter(r=>r.winner==='home').length;
    const total=mine.length,efficiency=total?(ace-fault)/total*100:null,pq=total?points/total*100:null, fq=total?fault/total*100:null;
    const perSet=allSets.map(set=>{
      const count=set.rallies.filter(r=>r.participants.includes(p.id)).length;
      return {number:set.number,count,total:set.rallies.length,percent:set.rallies.length?count/set.rallies.length*100:0,
        result:`${set.home}:${set.away}`,won:set.winner,segments:segmentsFor(set,p.id)};
    });
    const entered=perSet.filter(s=>s.count>0).length;
    const played=perSet.reduce((sum,s)=>sum+s.count,0);
    const all=perSet.reduce((sum,s)=>sum+s.total,0);
    return {player:p,ace,normal,fault,points,total,efficiency,pq,fq,entered,played,all,
      participation:all?played/all*100:0,perSet};
  });
  return {stats,sets,patterns,phases,source:st};
}
function segmentsFor(set,id){
  const out=[];let began=-1;
  for(let i=0;i<=set.rallies.length;i++){
    const active=i<set.rallies.length&&set.rallies[i].participants.includes(id);
    if(active && began<0) began=i;
    if(!active && began>=0){
      const before=began===0?[0,0]:scoreAfter(set.rallies,began-1);
      const end=scoreAfter(set.rallies,i-1);
      out.push({start:`${before[0]}:${before[1]}`,end:`${end[0]}:${end[1]}`,rallies:i-began});began=-1;
    }
  }
  return out;
}
function scoreAfter(rallies,i){if(i<0)return [0,0];const r=rallies[i];return [r.before[0]+(r.winner==='home'?1:0),r.before[1]+(r.winner==='away'?1:0)];}
export function rating(type,value,total){
  if(value===null)return '–';
  if(total<10)return 'Wenig Daten';
  if(type==='efficiency') return value>=15?'Ausgezeichnet':value>=5?'Gut':value>=-5?'Genügend':'Ungenügend';
  if(type==='pq')return value>=60?'Ausgezeichnet':value>=50?'Gut':value>=40?'Genügend':'Ungenügend';
  return '–';
}
export function validateBackup(data){
  if(!data||data.schema!==VERSION||!Array.isArray(data.teams)||!Array.isArray(data.matches))throw Error('Ungültige oder inkompatible ServeIQ-Datensicherung.');
  for(const m of data.matches){if(!Array.isArray(m.events)||!Number.isInteger(m.cursor)||m.cursor<0||m.cursor>m.events.length||!m.teamSnapshot?.players)throw Error('Beschädigter Spielverlauf in Datensicherung.');}
  return true;
}
