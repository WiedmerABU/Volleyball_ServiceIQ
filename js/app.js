import {uid,newAppData,teamName,playerLabel,newMatch,pushEvent,undo,redo,replay,buildStats,rating,validateBackup,opposite} from './model.js';
import {load,save} from './storage.js';
import {excelBlob,downloadBlob} from './excel.js';
const root=document.getElementById('app');
let data=newAppData();
const ui={view:'teams',teamId:null,sortMode:'number',editingTeam:null,playerId:null,matchId:null,statsId:null,statsReturn:'archive',statsSet:0,statsPlayer:null,
  info:'',modal:'',menuOpen:true,toast:'',wizardStep:0,draft:null,teamForm:null,pickerPos:0};
const esc=x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const attrs=x=>esc(x);
const el=(x)=>document.querySelector(x);
const icon=(s)=>`<span class="ico" aria-hidden="true">${s}</span>`;
const who=(m,id)=>playerLabel(m?.teamSnapshot.players.find(p=>p.id===id));
const pct=x=>x===null?'–':`${x>=0&&x!==0?'+':''}${x.toFixed(1).replace('.',',')} %`;
const rawpct=x=>x===null?'–':`${x.toFixed(1).replace('.',',')} %`;
const toast=(msg)=>{ui.toast=msg;render();setTimeout(()=>{if(ui.toast===msg){ui.toast='';render();}},4500);};
let saving=Promise.resolve();
let navTimeout;function armNav(){clearTimeout(navTimeout);if(window.matchMedia('(min-width: 900px)').matches)return;navTimeout=setTimeout(()=>{if(!ui.modal&&data.introSeen){ui.menuOpen=false;document.querySelector('.bottom-nav')?.classList.add('is-collapsed');}},8500);}
window.addEventListener('pointerdown',e=>{if(ui.menuOpen)armNav();},{passive:true});
window.addEventListener('keydown',()=>{if(ui.menuOpen)armNav();});
function commit(){data.lastView=ui.view;const snap=structuredClone(data);saving=saving.then(()=>save(snap)).then(ok=>{if(!ok)showAlert('Speichern fehlgeschlagen. Bitte JSON-Sicherung erstellen!');});}
function showAlert(msg){ui.modal='alert';ui.alertText=msg;render();}
function mcurrent(){return data.matches.find(m=>m.id===ui.matchId)||null;}
function activeMatch(){return data.matches.find(m=>!m.archivedEarly&&!replay(m).finished)||null;}
function playersFor(team){return [...(team?.players||[])].sort((a,b)=>a.number-b.number);}
function lineupHuman(set,m){return set.slots.map((s,i)=>`<div class="roster-entry"><span class="circle-number">${i+1}</span><span>${esc(who(m,s.playerId))}${s.libero?` <small class="tag">Libera auf Feld</small>`:''}</span></div>`).join('');}
function header(title='',subtitle=''){return `<header class="topbar"><div class="brand"><span class="brand-mark">◉</span><span>Serve<span class="iq">IQ</span></span></div>${title?`<span class="header-context">${esc(title)}</span>`:''}</header>${subtitle?`<p class="muted header-sub">${esc(subtitle)}</p>`:''}`;}
function shell(content){return `${header()}<main class="main">${content}</main><nav class="bottom-nav ${ui.menuOpen?'':'is-collapsed'}" aria-label="Hauptnavigation"><button type="button" class="nav-handle" data-action="nav-handle" aria-label="Navigation einblenden"><span></span></button><button data-action="nav" data-view="teams" class="nav-item ${ui.view==='teams'?'active':''}">${icon('♙')}<span>Teams</span></button><button data-action="nav" data-view="new" class="nav-item ${ui.view==='new'?'active':''}">${icon('＋')}<span>Neues Spiel</span></button><button data-action="nav" data-view="live" class="nav-item ${ui.view==='live'?'active':''}">${icon('◉')}<span>Live-Game</span></button><button data-action="nav" data-view="archive" class="nav-item ${ui.view==='archive'?'active':''}">${icon('▤')}<span>Archiv</span></button></nav>${ui.toast?`<div class="toast" role="status">${esc(ui.toast)}</div>`:''}${modalHtml()}`;}
function render(){if(!data.introSeen){root.innerHTML=`<main class="splash"><div class="splash-ball">🏐</div><div class="wordmark">Serve<span>IQ</span></div><p>Volleyball – Service – Score Tracker</p><button class="btn primary huge" data-action="intro">START</button><small>Funktionsprototyp · Version 0.1</small></main>`;return;}
  let content=ui.view==='teams'?teamsScreen():ui.view==='new'?newScreen():ui.view==='live'?liveScreen():archiveScreen();
  root.innerHTML=shell(content);
}
function teamsScreen(){
  if(ui.editingTeam)return teamEditor();
  const team=data.teams.find(x=>x.id===ui.teamId);
  if(team)return teamDetails(team);
  return `<section class="screen-head"><div><h1>Teams</h1><p>Mannschaften und Kader verwalten</p></div><button class="btn primary" data-action="new-team">＋ Neues Team</button></section>
   <h2>Vorhandene Teams</h2>${data.teams.length?data.teams.map(t=>`<button class="item-card" data-action="team-open" data-id="${t.id}"><span><strong>${esc(teamName(t))}</strong><small>${t.players.length} Spielerinnen / Spieler</small></span>${icon('›')}</button>`).join(''):'<div class="empty">Noch keine Teams vorhanden. Erstelle zuerst eine Mannschaft.</div>'}
   <section class="panel small-note"><b>Datensicherung</b><p>Die Daten werden nur auf diesem Gerät gespeichert. Sichere sie regelmässig als JSON.</p><div class="action-row"><button class="btn secondary" data-action="json-export">⇩ JSON sichern</button><button class="btn secondary" data-action="json-import">⇧ JSON importieren</button></div></section>`;
}
const seasonOptions=()=>{const date=new Date();let y=date.getFullYear();if(date.getMonth()<9)y--;return Array.from({length:6},(_,i)=>`${y+i}/${String((y+i+1)%100).padStart(2,'0')}`);};
const selectOpt=(opts,val)=>opts.map(v=>`<option value="${attrs(v)}" ${val===v?'selected':''}>${esc(v)}</option>`).join('');
function teamEditor(){const t=ui.teamForm||{};return `<div class="screen-head"><div><h1>${t.id?'Team bearbeiten':'Neues Team'}</h1><p>Verein · Saison · Kategorie</p></div></div>
  <form data-form="team" class="panel form-stack">
    <label>Verein<input name="club" required maxlength="90" placeholder="z. B. VBC Interlaken" value="${attrs(t.club||'')}"></label>
    <label>Saison<select name="season">${selectOpt(seasonOptions(),t.season||seasonOptions()[0])}</select></label>
    <label>Kategorie<select name="category" data-action="category-change">${selectOpt(['Damen','Herren','Juniorinnen','Mixed'],t.category||'Damen')}</select></label>
    <label>Liga / Altersklasse<select name="league" id="league-select">${selectOpt(categoryLeagues(t.category||'Damen'),t.league||categoryLeagues(t.category||'Damen')[0])}</select></label>
    <label>Gruppe<select name="group">${selectOpt(['','A','B','C','D'],t.group||'')}</select></label>
    <label>Mannschaftsnummer (optional, nicht für Damen)<input type="number" name="teamNumber" min="1" max="99" value="${attrs(t.teamNumber||'')}" ${(!t.category||t.category==='Damen')?'disabled':''}></label>
    <div class="action-row"><button class="btn primary" type="submit">Team speichern</button><button class="btn secondary" type="button" data-action="team-cancel">Abbrechen</button></div>
  </form>`;}
function categoryLeagues(c){return c==='Damen'?['2. Liga','3. Liga','4. Liga','5. Liga']:c==='Herren'?['2. Liga','3. Liga','4. Liga']:c==='Juniorinnen'?['U23','U20','U18','U16','U14','Kids Volley']:['Mixed'];}
function teamDetails(t){const rows=playersFor(t);if(ui.sortMode==='position'){const order=['P','M','A','D','L',''];rows.sort((a,b)=>order.indexOf(a.position||'')-order.indexOf(b.position||'') || a.number-b.number);}return `<section class="screen-head"><div><button class="textlink" data-action="team-back">‹ Alle Teams</button><h1>${esc(t.club)}</h1><p>${esc(teamName(t))}</p></div></section>
    <div class="action-row"><button class="btn secondary" data-action="team-edit" data-id="${t.id}">Team bearbeiten</button><button class="btn danger-ghost" data-action="team-delete" data-id="${t.id}">Löschen</button></div>
    <div class="screen-head tighter"><h2>Kader (${rows.length})</h2><div class="action-row"><button class="btn secondary" data-action="roster-sort">Sortierung: ${ui.sortMode==='number'?'Nr.':'Position'}</button><button class="btn primary" data-action="player-new">＋ Spielerin</button></div></div>
    ${rows.length?rows.map(p=>`<button class="item-card" data-action="player-edit" data-id="${p.id}"><span class="circle-number">${p.number}</span><span><strong>${esc(p.first)} ${esc(p.last)}</strong><small>${esc(({P:'Pass',M:'Mitte',A:'Aussen',D:'Diagonal',L:'Libera'})[p.position]||'Position offen')}</small></span>${icon('›')}</button>`).join(''):'<div class="empty">Noch keine Spielerinnen im Kader.</div>'}
    <p class="small muted">Spielhistorie und Statistiken behalten die damaligen Spielerinnendaten auch nach Änderungen im Team.</p>`;}
function playerModal(){const t=data.teams.find(x=>x.id===ui.teamId),p=t?.players.find(x=>x.id===ui.playerId);if(!t)return '';
  const base=ui.playerNumberPage||0,low=base*20+1,high=Math.min(99,low+19);
  return `<div class="modal-backdrop" data-action="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><h2>${p?'Spielerin bearbeiten':'Spielerin hinzufügen'}</h2>
    <form data-form="player" class="form-stack"><label>Vorname<input name="first" required value="${attrs(ui.playerDraft?.first??p?.first??'')}"></label><label>Nachname<input name="last" value="${attrs(ui.playerDraft?.last??p?.last??'')}"></label>
    <label>Position<select name="position">${selectOpt(['','P','M','A','D','L'],ui.playerDraft?.position??p?.position??'')}</select></label>
    <span class="field-label">Trikotnummer ${low}–${high}</span><div class="number-grid">${Array.from({length:high-low+1},(_,i)=>low+i).map(n=>`<button class="number-choice ${ui.numberChoice===n || (!ui.numberChoice&&p?.number===n)?'selected':''}" type="button" data-action="pick-number" data-number="${n}" ${t.players.some(a=>a.number===n&&a.id!==p?.id)?'disabled':''}>${n}</button>`).join('')}</div>
    <div class="action-row"><button class="btn secondary" type="button" data-action="number-page" data-dir="-1" ${base===0?'disabled':''}>‹ 20</button><button class="btn secondary" type="button" data-action="number-page" data-dir="1" ${high===99?'disabled':''}>20 ›</button></div>
    <input type="hidden" name="number" value="${ui.numberChoice||p?.number||''}"/>
    <div class="action-row"><button class="btn primary" type="submit">Speichern</button><button class="btn secondary" type="button" data-action="modal-close">Abbrechen</button></div>
    ${p?`<button class="btn danger-ghost" type="button" data-action="player-delete" data-id="${p.id}">Spielerin löschen</button>`:''}
    </form></section></div>`;
}
function newScreen(){if(!ui.draft){const live=activeMatch();return `<section class="screen-head"><div><h1>Neues Spiel</h1><p>Matchdaten und Startaufstellung</p></div></section>${live?`<div class="notice"><strong>Es läuft bereits ein Spiel.</strong><p>${esc(live.teamSnapshot.club)} – ${esc(live.opponent)}</p><button class="btn secondary" data-action="open-live" data-id="${live.id}">Laufendes Spiel öffnen</button></div>`:''}<div class="panel"><p>Erstelle ein neues Spiel mit einem vorhandenen Team.</p><button class="btn primary wide" data-action="start-wizard" ${data.teams.length?'':'disabled'}>＋ Spiel erstellen</button>${data.teams.length?'':'<p class="small">Erstelle zuerst ein Team und mindestens sechs Spielerinnen.</p>'}</div>`;}
  const d=ui.draft,t=data.teams.find(x=>x.id===d.teamId);
  if(ui.wizardStep===0)return `<h1>Neues Spiel · Spieldaten</h1><form class="panel form-stack" data-form="match-basic">
    <label>Eigenes Team<select name="teamId" required>${data.teams.map(t=>`<option value="${t.id}" ${t.id===d.teamId?'selected':''}>${esc(teamName(t))}</option>`).join('')}</select></label>
    <label>Gegner<input name="opponent" placeholder="Gegnerischer Verein" maxlength="100" required value="${attrs(d.opponent||'')}"></label>
    <label>Spieldatum<input type="date" name="date" required value="${attrs(d.date)}"></label>
    <div class="action-row"><button type="submit" class="btn primary">Weiter: Matchkader</button><button type="button" class="btn secondary" data-action="cancel-wizard">Abbrechen</button></div></form>`;
  if(!t){ui.draft=null;return '<p>Team nicht gefunden.</p>';}
  if(ui.wizardStep===1)return `<h1>Neues Spiel · Matchkader</h1><p class="muted">Alle Spielerinnen sind vorausgewählt. Abwesende abwählen.</p>
    <div class="panel">${playersFor(t).map(p=>`<label class="checkrow"><input type="checkbox" data-action="roster-toggle" data-id="${p.id}" ${d.rosterIds.includes(p.id)?'checked':''}><span>${esc(playerLabel(p))}</span><small>${esc(p.position||'')}</small></label>`).join('')}</div>
    <div class="action-row"><button class="btn primary" data-action="wizard-next" ${d.rosterIds.length<6?'disabled':''}>Weiter: Aufstellung (${d.rosterIds.length})</button><button class="btn secondary" data-action="wizard-back">Zurück</button></div>`;
  const candidates=t.players.filter(p=>d.rosterIds.includes(p.id));
  if(ui.wizardStep===2)return `<h1>Neues Spiel · Startaufstellung</h1><p>Sechs unterschiedliche Spielerinnen auf Position 1–6 setzen.</p><div class="court-list">${d.lineup.map((id,i)=>`<label class="court-position"><span class="circle-number">${i+1}</span><select data-action="lineup-change" data-pos="${i}"><option value="">Position ${i+1} auswählen</option>${candidates.filter(p=>p.position!=='L'||p.id===id).map(p=>`<option value="${p.id}" ${id===p.id?'selected':''}>${esc(playerLabel(p))}</option>`).join('')}</select></label>`).join('')}</div>
    <div class="panel"><label>Libera (optional; unterhalb des Feldes)<select data-action="libero-select"><option value="">Keine Libera</option>${candidates.filter(p=>p.position==='L'||p.id===d.liberoId).map(p=>`<option value="${p.id}" ${p.id===d.liberoId?'selected':''}>${esc(playerLabel(p))}</option>`).join('')}</select></label></div>
    <div class="panel form-stack"><span class="field-label">Spielfeldseite aus Sicht der erfassenden Person</span><div class="seg"><button class="btn ${d.side==='left'?'primary':'secondary'}" data-action="set-side" data-val="left">← Interlaken links</button><button class="btn ${d.side==='right'?'primary':'secondary'}" data-action="set-side" data-val="right">Interlaken rechts →</button></div>
     <span class="field-label">1. Service (bitte auswählen)</span><div class="seg"><button class="btn ${d.firstServe==='home'?'primary':'secondary'}" data-action="set-serve" data-val="home">Interlaken</button><button class="btn ${d.firstServe==='away'?'primary':'secondary'}" data-action="set-serve" data-val="away">Gegner</button></div></div>
     <div class="action-row"><button class="btn primary" data-action="wizard-next">Zusammenfassung</button><button class="btn secondary" data-action="wizard-back">Zurück</button></div>`;
  return `<h1>Neues Spiel · Zusammenfassung</h1><div class="panel form-stack"><p><b>${esc(t.club)} – ${esc(d.opponent)}</b><br>${esc(d.date)}</p><h3>Startaufstellung</h3>${d.lineup.map((id,i)=>`<div>Position ${i+1}: ${esc(playerLabel(t.players.find(p=>p.id===id)))}</div>`).join('')}
    <p>Libera: ${d.liberoId?esc(playerLabel(t.players.find(p=>p.id===d.liberoId))):'keine'}<br>Spielfeldseite: ${d.side==='left'?'links':'rechts'}<br>Erster Service: ${d.firstServe==='home'?'Interlaken':'Gegner'}</p>
    <button class="btn primary huge" data-action="confirm-match">Spiel starten</button><button class="btn secondary" data-action="wizard-back">Zurück / korrigieren</button></div>`;
}
function liveScreen(){let m=mcurrent();if(!m||m.archivedEarly||replay(m).finished)m=activeMatch();
  if(!m)return `<h1>Live-Game</h1><div class="empty">Kein laufendes Spiel vorhanden.<br><button class="btn primary" data-action="nav" data-view="new">Neues Spiel eröffnen</button></div>`;
  ui.matchId=m.id;const st=replay(m),s=st.current;
  if(st.error)return `<div class="notice error">Fehler im Verlauf: ${esc(st.error)}</div>`;
  if(!s || s.winner)return endOfSet(m,st);
  const servName=s.server==='home'?who(m,s.slots[0].playerId):'Service Gegner';
  const sideLeft=s.side==='left';
  let buttons='';
  if(s.server==='home'&&!s.pending){buttons=`<div class="service-actions"><button class="btn big-action ace" data-action="rally" data-kind="ace" data-winner="home">1. ASS</button><button class="btn big-action normal" data-action="normal">2. NORMALER SERVICE</button><button class="btn big-action fault" data-action="rally" data-kind="fault" data-winner="away">3. SERVICEFEHLER</button></div>`;}
  else{const title=s.pending?'Normaler Service – wer gewinnt den Ballwechsel?':'Gegner serviert – wer gewinnt den Ballwechsel?';
    const a=`<button class="btn point-home" data-action="rally" data-kind="${s.pending?'normal':'opponent'}" data-winner="home">PUNKT<br>INTERLAKEN</button>`;
    const b=`<button class="btn point-away" data-action="rally" data-kind="${s.pending?'normal':'opponent'}" data-winner="away">PUNKT<br>GEGNER</button>`;
    buttons=`<p class="point-title">${title}</p><div class="point-buttons">${sideLeft?a+b:b+a}</div>`;
  }
  const liberoOn=s.slots.some(x=>x.libero),liberoPos=s.slots.findIndex(x=>x.libero);
  return `<div class="scoreboard"><div class="score-team ${s.server==='home'?'serving':''}"><small>${esc(m.teamSnapshot.club)} ${s.server==='home'?'●':''}</small><span>${s.home}</span></div><div class="score-set"><small>Satz ${s.number}</small><strong>${st.homeSets} : ${st.awaySets}</strong><small>Sätze</small></div><div class="score-team ${s.server==='away'?'serving':''}"><small>${esc(m.opponent)} ${s.server==='away'?'●':''}</small><span>${s.away}</span></div></div>
  <div class="current-player"><small>${s.server==='home'?'AKTUELLE AUFSCHLÄGERIN':'AUFSCHLAGRECHT'}</small><h1>${esc(servName)}</h1><p>${s.server==='home'?'Position 1 · Interlaken':'Gegner am Service'}</p></div>
  ${s.sideSwitchJustHappened?'<div class="notice">Seitenwechsel im 5. Satz bei 8 Punkten automatisch erfasst.</div>':''}
  ${liberoOn&&(liberoPos===0||liberoPos<=2)?`<div class="notice mild">Liberawechsel prüfen: Libera befindet sich ${liberoPos===0?'auf der Aufschlagposition':'im Vorderfeld'}. Bitte tatsächlichen Wechsel erfassen.</div>`:''}
  ${buttons}
  <div class="controls"><button class="btn control" data-action="undo" ${m.cursor===0?'disabled':''}>↶<small>Rückgängig</small></button><button class="btn control" data-action="redo" ${m.cursor===m.events.length?'disabled':''}>↷<small>Vorwärts</small></button><button class="btn control" data-action="change-open">⇄<small>Wechsel</small></button><button class="btn control" data-action="stats-open" data-id="${m.id}">▥<small>Statistik</small></button></div>
  <div class="secondary-controls"><button class="textlink" data-action="side-toggle">←→ Spielfeldseite anpassen</button><button class="textlink danger" data-action="stop-open">Spiel abbrechen ···</button></div>`;
}
function endOfSet(m,st){const s=st.current;return `<div class="scoreboard"><div class="score-team"><small>${esc(m.teamSnapshot.club)}</small><span>${s.home}</span></div><div class="score-set"><small>Satz ${s.number}</small><strong>${st.homeSets} : ${st.awaySets}</strong><small>Sätze</small></div><div class="score-team"><small>${esc(m.opponent)}</small><span>${s.away}</span></div></div>
 <div class="win-panel">🏆<h1>${st.finished?'Spiel beendet':`Satz ${s.number} beendet`}</h1><p>${s.winner==='home'?esc(m.teamSnapshot.club):esc(m.opponent)} gewinnt ${s.home}:${s.away}</p>
 <div class="action-row">${st.finished?`<button class="btn primary" data-action="stats-open" data-id="${m.id}">Spielstatistik</button><button class="btn secondary" data-action="nav" data-view="archive">Zum Archiv</button>`:`<button class="btn primary" data-action="prepare-set">Nächsten Satz vorbereiten</button><button class="btn secondary" data-action="stats-open" data-id="${m.id}">Satzstatistik</button>`}</div></div>
 <div class="action-row"><button class="btn secondary" data-action="undo">↶ Letzte Aktion rückgängig</button><button class="btn secondary" data-action="redo" ${m.cursor===m.events.length?'disabled':''}>↷ Vorwärts</button></div>`;
}
function archiveScreen(){if(ui.statsId)return statsScreen();
  const sorted=[...data.matches].sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
  return `<section class="screen-head"><div><h1>Archiv</h1><p>Alle gespeicherten Spiele</p></div></section>${sorted.length?sorted.map(m=>{
    const st=replay(m),last=st.current,status=st.finished?'Abgeschlossen':m.archivedEarly?'Nicht abgeschlossen':'Laufend';
    return `<div class="archive-card"><div class="archive-head"><strong>${esc(m.teamSnapshot.club)} – ${esc(m.opponent)}</strong><span class="tag">${status}</span></div><div class="archive-score">${st.homeSets} : ${st.awaySets} <small>Sätze</small></div><p class="muted small">${esc(m.date)} · ${esc(m.teamSnapshot.category)} · ${esc(m.teamSnapshot.season)}</p><p class="muted small">${st.sets.map(s=>`${s.home}:${s.away}${!s.winner?' (offen)':''}`).join(' · ')||'Noch kein Satz'}</p>
    <div class="action-row"><button class="btn secondary" data-action="stats-open" data-id="${m.id}">Auswertung</button><button class="btn secondary" data-action="excel" data-id="${m.id}">⇩ Excel</button>${status==='Laufend'?`<button class="btn secondary" data-action="open-live" data-id="${m.id}">Fortsetzen</button>`:''}<button class="btn danger-ghost" data-action="match-delete" data-id="${m.id}">Löschen</button></div></div>`;
  }).join(''):'<div class="empty">Noch keine Spiele gespeichert.</div>'}
  <section class="panel small-note"><h2>Datensicherung</h2><p>JSON ist eine vollständige Sicherung für einen Gerätewechsel. Excel ist die Auswertung und kann nicht als Spielverlauf importiert werden.</p><div class="action-row"><button class="btn secondary" data-action="json-export">⇩ JSON sichern</button><button class="btn secondary" data-action="json-import">⇧ JSON importieren</button></div></section>`;
}
function statsScreen(){const m=data.matches.find(x=>x.id===ui.statsId);if(!m){ui.statsId=null;return archiveScreen();}
  const st=replay(m),v=buildStats(m,ui.statsSet),all=buildStats(m);
  const label=(id)=>who(m,id);
  const tableRows=v.stats.map(s=>`<tr data-action="stats-player" data-id="${s.player.id}"><td>${esc(label(s.player.id))}</td><td>${s.ace}</td><td>${s.normal}</td><td>${s.fault}</td><td>${s.total}</td></tr>`).join('');
  const active=v.stats.find(x=>x.player.id===ui.statsPlayer)||v.stats[0];
  const perSet=active?.perSet||[];
  const info=(key)=>`<button class="infobtn" data-action="info" data-id="${key}" aria-label="Erklärung öffnen">ⓘ</button>`;
  return `<button class="textlink" data-action="stats-close">‹ Zurück</button><section class="screen-head"><div><h1>Statistik</h1><p>${esc(m.teamSnapshot.club)} – ${esc(m.opponent)} · ${esc(m.date)}</p></div><button class="btn secondary" data-action="excel" data-id="${m.id}">⇩ Excel</button></section>
  <div class="chip-scroll"><button class="chip ${ui.statsSet===0?'selected':''}" data-action="stats-filter" data-number="0">Gesamtes Spiel</button>${st.sets.map(s=>`<button class="chip ${ui.statsSet===s.number?'selected':''}" data-action="stats-filter" data-number="${s.number}">Satz ${s.number}</button>`).join('')}</div>
  <section class="panel"><h2>1. Service-Statistik ${info('service')}</h2><div class="table-wrap"><table><thead><tr><th>Spielerin</th><th>Ass</th><th>Normal</th><th>Fehler</th><th>Total</th></tr></thead><tbody>${tableRows||'<tr><td colspan="5">Noch keine Services.</td></tr>'}</tbody></table></div><small class="muted">Spielerin antippen für Details.</small></section>
  <section class="panel"><h2>2. Qualitätskennzahlen ${info('qualities')}</h2><div class="table-wrap"><table><thead><tr><th>Spielerin</th><th>SE</th><th>PQ</th><th>Fehlerquote</th></tr></thead><tbody>${v.stats.map(s=>`<tr><td>${esc(label(s.player.id))}</td><td>${pct(s.efficiency)}<small>${rating('efficiency',s.efficiency,s.total)}</small></td><td>${rawpct(s.pq)}<small>${rating('pq',s.pq,s.total)}</small></td><td>${rawpct(s.fq)}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Bewertungen unter zehn Services: «Wenig Daten».</p></section>
  <section class="panel"><h2>3. Servicefehler-Muster ${info('patterns')}</h2>${v.patterns.length?v.patterns.map(x=>`<div class="pattern-entry"><span class="tag">Satz ${x.set}</span><span>${x.type==='repeat'?'Wiederholter Fehler:':'Aufeinanderfolgende Aufschlägerinnen:'} ${x.players.map(label).map(esc).join(' → ')}</span></div>`).join(''):'<p class="muted">Keine entsprechenden Muster erfasst.</p>'}</section>
  <section class="panel"><h2>4. Spielerinnen-Details ${info('details')}</h2><label>Spielerin<select data-action="stats-select-player">${v.stats.map(s=>`<option value="${s.player.id}" ${active?.player.id===s.player.id?'selected':''}>${esc(label(s.player.id))}</option>`).join('')}</select></label>
  ${active?`<div class="metric-grid"><div><b>${active.entered}</b><small>Gespielte Sätze</small></div><div><b>${active.played}/${active.all}</b><small>Ballwechsel</small></div><div><b>${rawpct(active.participation)}</b><small>Einsatzquote</small></div></div>
   <div class="table-wrap"><table><thead><tr><th>Satz</th><th>Endstand*</th><th>Einsatz</th><th>Quote</th></tr></thead><tbody>${perSet.map(s=>`<tr><td>${s.number}</td><td>${s.result}</td><td>${s.count}/${s.total}</td><td>${rawpct(s.percent)}</td></tr>`).join('')}</tbody></table></div><small class="muted">* Bei laufenden Sätzen: aktueller Stand.</small>
   <h3>Einsatzabschnitte (Punktestand vorher → nachher)</h3>${perSet.flatMap(s=>s.segments.map(seg=>`<p class="small">Satz ${s.number}: ${seg.start} → ${seg.end}, ${seg.rallies} Ballwechsel</p>`)).join('')||'<p class="muted">Noch keine Einsätze.</p>'}`:''}</section>
  <section class="panel"><h2>5. Spielstandsphasen ${info('phases')}</h2><div class="table-wrap"><table><thead><tr><th>Phase</th><th>Asse</th><th>Normal</th><th>Fehler</th></tr></thead><tbody>${['Start','Aufbau','Entscheidung','Verlängerung'].map(phase=>{const x=v.phases.filter(x=>x.phase===phase);return `<tr><td>${phase}</td><td>${x.filter(x=>x.kind==='ace').length}</td><td>${x.filter(x=>x.kind==='normal').length}</td><td>${x.filter(x=>x.kind==='fault').length}</td></tr>`;}).join('')}</tbody></table></div><p class="small muted">Jeder eigene Service wird anhand des Punktestands vor dem Aufschlag zugeordnet. Satzballsituationen stehen im Excel-Export.</p></section>
  <section class="panel"><h2>6. Wechsel und Aufstellungen ${info('changes')}</h2>${st.sets.map(s=>`<h3>Satz ${s.number}</h3><p class="small">Start: ${s.slots.map(x=>esc(label(x.starterId))).join(' · ')}</p>${s.substitutions.map(x=>`<p class="small">${x.at.join(':')} · ${esc(label(x.out))} → ${esc(label(x.in))}</p>`).join('')}${s.liberoMoves.map(x=>`<p class="small">${x.at.join(':')} · Libera ${x.enter?'ein':'aus'} für ${esc(label(x.playerId))}</p>`).join('')}` ).join('')}</section>`;
}
const infoText={
  service:`Ass = direkter Punkt durch Aufschlag. Normal = gültiger Aufschlag mit anschliessendem Ballwechsel. Fehler = direkter Punkt Gegner durch Aufschlagfehler. Total = Ass + Normal + Fehler.`,
  qualities:`Service-Effizienz (SE) = (Asse − Servicefehler) ÷ alle Services × 100. Bewertung: ausgezeichnet ab +15 %, gut ab +5 %, genügend ab −5 %, sonst ungenügend. Punktquote (PQ) = gewonnene Ballwechsel bei eigenen Services ÷ alle eigenen Services × 100. Bewertung: ausgezeichnet ab 60 %, gut ab 50 %, genügend ab 40 %, sonst ungenügend. Fehlerquote = Servicefehler ÷ alle Services × 100. Diese Grenzen sind Orientierungshilfen für Amateurteams, keine offiziellen Normen. Unter 10 Services wenig aussagekräftig.`,
  patterns:`Wiederholter Fehler: Dieselbe Spielerin beendet einen Servicedurchgang mit Fehler und macht beim nächsten eigenen Servicedurchgang sofort wieder einen Fehler. Aufeinanderfolgende Aufschlägerinnen: Der letzte Service der vorherigen Spielerin war ein Fehler und die nächste Aufschlägerin macht bei ihrem ersten Service ebenfalls einen Fehler. Die Betrachtung beginnt pro Satz neu.`,
  details:`Gespielte Sätze = Sätze mit mindestens einem Ballwechsel auf dem Feld. Einsatz = eigene Ballwechsel / alle Ballwechsel des Satzes. Beispiel 31/47 = 31 von 47 gespielten Ballwechseln. Einsatzquote = dieser Anteil in Prozent. Die Einsatzabschnitte zeigen den Spielstand vor dem ersten und nach dem letzten Ballwechsel des jeweiligen Einsatzes. Auch Liberawechsel werden berücksichtigt, sofern sie erfasst sind.`,
  phases:`Sätze 1–4: Start 0–9, Aufbau 10–19, Entscheidung ab 20; Verlängerung ab 24:24. Satz 5: Start 0–5, Aufbau 6–11, Entscheidung ab 12; Verlängerung ab 14:14. Es zählt der höhere Punktestand, ausser in der Verlängerung: dort müssen beide Teams mindestens 24 beziehungsweise 14 erreicht haben. Führung, Gleichstand, Rückstand und Satzball werden je Service im Export geführt.`,
  changes:`Ein regulärer Wechsel kostet einen der maximal sechs Wechsel pro Satz. Die ausgewechselte Startspielerin darf nur für denselben Ersatz zurückkehren. Liberawechsel sind getrennt und zählen nicht zu diesen sechs Wechseln. Alle erfassten Wechsel werden mit Spielstand gespeichert.`
};
function modalHtml(){if(!ui.modal)return '';
  if(ui.modal==='player')return playerModal();
  if(ui.modal==='alert'||ui.modal==='confirm')return `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true"><h2>${ui.modal==='confirm'?'Bitte bestätigen':'Hinweis'}</h2><p>${esc(ui.alertText||'')}</p><div class="action-row">${ui.modal==='confirm'?`<button class="btn danger" data-action="confirm-yes">Ja, ausführen</button><button class="btn secondary" data-action="modal-close">Abbrechen</button>`:`<button class="btn primary" data-action="modal-close">OK</button>`}</div></div></div>`;
  const m=mcurrent(),s=m&&replay(m).current;
  if(ui.modal==='stop')return `<div class="modal-backdrop"><div class="modal"><h2>Spiel abbrechen</h2><p>Was soll mit dem Spiel passieren?</p><div class="form-stack"><button class="btn primary" data-action="stop-archive">Im Archiv speichern («Nicht abgeschlossen»)</button><button class="btn danger" data-action="stop-delete">Endgültig löschen</button><button class="btn secondary" data-action="modal-close">Zurück zum Spiel</button></div></div></div>`;
  if(ui.modal==='change'&&s){const hasLibero=Boolean(s.liberoId);return `<div class="modal-backdrop"><div class="modal"><h2>Spielerwechsel</h2><div class="form-stack"><button class="btn primary" data-action="change-type" data-type="regular">Normaler Spielerwechsel</button><button class="btn secondary" data-action="change-type" data-type="libero" ${hasLibero?'':'disabled'}>Liberawechsel</button><button class="btn secondary" data-action="modal-close">Schliessen</button></div><p class="small muted">Reguläre Wechsel: ${s.regularSubs}/6</p></div></div>`;}
  if(ui.modal==='regular'&&s){const ins=m.rosterIds.filter(id=>!s.slots.some(sl=>sl.playerId===id)&&id!==s.liberoId);
    return `<div class="modal-backdrop"><div class="modal"><h2>Regulärer Spielerwechsel</h2><p class="muted">${s.regularSubs}/6 Wechsel verwendet. Rückwechsel nur zum selben Ersatz.</p><form data-form="regular" class="form-stack"><label>Auswechseln<select name="outId">${s.slots.map(sl=>`<option value="${sl.playerId}" ${sl.libero?'disabled':''}>${esc(who(m,sl.playerId))}${sl.libero?' – Libera aktiv':''}</option>`).join('')}</select></label>
    <label>Einwechseln<select name="inId">${m.rosterIds.filter(id=>!s.slots.some(sl=>sl.playerId===id)&&id!==s.liberoId).concat(s.slots.map(sl=>sl.starterId).filter(id=>!s.slots.some(sl=>sl.playerId===id))).filter((x,i,a)=>a.indexOf(x)===i).map(id=>`<option value="${id}">${esc(who(m,id))}</option>`).join('')}</select></label><button class="btn primary" type="submit">Wechsel bestätigen</button><button class="btn secondary" type="button" data-action="modal-close">Abbrechen</button></form></div></div>`;}
  if(ui.modal==='libero'&&s){return `<div class="modal-backdrop"><div class="modal"><h2>Liberawechsel</h2><p>Libera: ${esc(who(m,s.liberoId))}</p><div class="form-stack">${s.slots.map((sl,i)=>({sl,i})).filter(x=>[0,4,5].includes(x.i)).map(x=>`<button class="btn ${x.sl.libero?'primary':'secondary'}" data-action="libero-action" data-player="${x.sl.playerId}" data-enter="${x.sl.libero?'false':'true'}">Position ${x.i+1}: ${esc(who(m,x.sl.playerId))} – Libera ${x.sl.libero?'auswechseln':'einwechseln'}</button>`).join('')}<button class="btn secondary" data-action="modal-close">Schliessen</button></div><p class="small muted">Ein Wechsel ist nur in einer Spielunterbrechung möglich.</p></div></div>`;}
  if(ui.modal==='nextset'&&s){const n=s.number+1,first=n===5?'':opposite(s.firstServe),o=ui.nextOptions||{lineup:s.slots.map(x=>x.starterId),liberoId:s.liberoId,side:s.side,firstServe:first};ui.nextOptions=o;
    const p=m.teamSnapshot.players.filter(x=>m.rosterIds.includes(x.id));
    return `<div class="modal-backdrop"><div class="modal"><h2>Startaufstellung Satz ${n}</h2><p class="small muted">Vorschlag: Startaufstellung des vorherigen Satzes. Nicht die Schlussaufstellung.</p><div class="form-stack"><form data-form="nextset" class="form-stack">${o.lineup.map((id,i)=>`<label>Position ${i+1}<select name="pos${i}">${p.filter(x=>x.position!=='L'||x.id===id).map(x=>`<option value="${x.id}" ${x.id===id?'selected':''}>${esc(playerLabel(x))}</option>`).join('')}</select></label>`).join('')}
    <label>Libera<select name="liberoId"><option value="">Keine Libera</option>${p.filter(x=>x.position==='L'||x.id===o.liberoId).map(x=>`<option value="${x.id}" ${x.id===o.liberoId?'selected':''}>${esc(playerLabel(x))}</option>`).join('')}</select></label>
    <label>Seite<select name="side">${selectOpt(['left','right'],o.side)}</select></label>
    <label>Erster Service ${n===5?'(neue Auslosung)':'(automatisch gemäss Regel)'}<select name="firstServe" ${n===5?'required':''}><option value="" ${!first?'selected':''}>${n===5?'Bitte wählen':'–'}</option><option value="home" ${o.firstServe==='home'?'selected':''}>Interlaken</option><option value="away" ${o.firstServe==='away'?'selected':''}>Gegner</option></select></label>
    <button class="btn primary huge" type="submit">Satz ${n} starten</button><button class="btn secondary" type="button" data-action="modal-close">Abbrechen</button></form></div></div></div>`;}
  if(ui.modal==='info')return `<div class="modal-backdrop"><div class="modal"><h2>ⓘ Erklärung</h2><p>${esc(infoText[ui.info]||'')}</p><button class="btn primary" data-action="modal-close">Schliessen</button></div></div>`;
  return '';
}
function confirmAction(msg,fn){ui.modal='confirm';ui.alertText=msg;ui.confirmFn=fn;render();}
function afterEvent(event){const m=mcurrent();try{const x=pushEvent(m,event);data.matches[data.matches.findIndex(k=>k.id===m.id)]=x;commit();render();return true;}catch(err){showAlert(err.message);return false;}}
function navigate(view){ui.menuOpen=true;armNav();ui.view=view;ui.modal='';if(view!=='teams'){ui.teamId=null;ui.editingTeam=null;}if(view!=='archive')ui.statsId=null;
  if(view==='live'){const a=activeMatch();if(a)ui.matchId=a.id;}
  commit();render();}
root.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b)return;
  if(b.tagName==='BUTTON')e.preventDefault();
  const action=b.dataset.action,id=b.dataset.id;
  try{switch(action){
    case'intro':data.introSeen=true;ui.view=data.lastView||'teams';ui.menuOpen=true;armNav();commit();render();break;
    case'nav':navigate(b.dataset.view);break;
    case'nav-handle':ui.menuOpen=true;armNav();render();break;
    case'new-team':ui.editingTeam=true;ui.teamForm={club:'VBC Interlaken',category:'Damen',league:'4. Liga',season:seasonOptions()[0],players:[]};render();break;
    case'team-open':ui.teamId=id;render();break;
    case'team-back':ui.teamId=null;render();break;
    case'roster-sort':ui.sortMode=ui.sortMode==='number'?'position':'number';render();break;
    case'team-cancel':ui.editingTeam=false;ui.teamForm=null;render();break;
    case'team-edit':ui.editingTeam=true;ui.teamForm=structuredClone(data.teams.find(t=>t.id===id));render();break;
    case'team-delete':confirmAction('Team wirklich löschen? Archivierte Spiele bleiben erhalten.',()=>{data.teams=data.teams.filter(t=>t.id!==id);ui.teamId=null;commit();render();});break;
    case'player-new':ui.playerId=null;ui.playerDraft=null;ui.numberChoice=null;ui.playerNumberPage=0;ui.modal='player';render();break;
    case'player-edit':{ui.playerId=id;ui.playerDraft=null;const p=data.teams.find(t=>t.id===ui.teamId).players.find(p=>p.id===id);ui.numberChoice=p.number;ui.playerNumberPage=Math.floor((p.number-1)/20);ui.modal='player';render();break;}
    case'player-delete':confirmAction('Spielerin wirklich aus dem Team entfernen?',()=>{const t=data.teams.find(t=>t.id===ui.teamId);t.players=t.players.filter(p=>p.id!==id);ui.modal='';commit();render();});break;
    case'number-page':ui.playerNumberPage=Math.max(0,Math.min(4,(ui.playerNumberPage||0)+Number(b.dataset.dir)));render();break;
    case'pick-number':ui.numberChoice=Number(b.dataset.number);document.querySelectorAll('.number-choice').forEach(x=>x.classList.toggle('selected',Number(x.dataset.number)===ui.numberChoice));document.querySelector('[name=number]').value=String(ui.numberChoice);break;
    case'category-change':break;
    case'cancel-wizard':ui.draft=null;ui.wizardStep=0;render();break;
    case'start-wizard':{if(activeMatch())throw Error('Bitte zuerst das noch laufende Spiel öffnen und abschliessen oder als nicht abgeschlossen archivieren.');const t=data.teams[0];ui.draft={teamId:t.id,opponent:'',date:new Date().toLocaleDateString('en-CA'),rosterIds:t.players.map(p=>p.id),lineup:Array(6).fill(''),liberoId:'',side:'left',firstServe:''};ui.wizardStep=0;render();break;}
    case'wizard-back':ui.wizardStep=Math.max(0,ui.wizardStep-1);render();break;
    case'wizard-next':{
      if(ui.wizardStep===1&&ui.draft.rosterIds.length<6)throw Error('Mindestens sechs Spielerinnen im Matchkader.');
      if(ui.wizardStep===2){const d=ui.draft;if(d.lineup.some(x=>!x)||new Set(d.lineup).size!==6)throw Error('Bitte sechs unterschiedliche Spielerinnen auswählen.');
        if(d.liberoId&&d.lineup.includes(d.liberoId))throw Error('Libera darf nicht in den sechs Rotationspositionen stehen.');if(!d.firstServe)throw Error('Bitte den ersten Service auswählen.');}
      ui.wizardStep++;render();break;}
    case'lineup-change':break;
    case'set-side':ui.draft.side=b.dataset.val;render();break;
    case'set-serve':ui.draft.firstServe=b.dataset.val;render();break;
    case'confirm-match':{
      const d=ui.draft,t=data.teams.find(t=>t.id===d.teamId);
      const m=newMatch(t,d.opponent,d.date,d.rosterIds);const started=pushEvent(m,{type:'SET_START',lineup:d.lineup,liberoId:d.liberoId,side:d.side,firstServe:d.firstServe});
      data.matches.push(started);ui.matchId=started.id;ui.draft=null;ui.wizardStep=0;ui.view='live';commit();render();break;}
    case'open-live':ui.matchId=id;ui.view='live';ui.statsId=null;render();break;
    case'normal':afterEvent({type:'NORMAL'});break;
    case'rally':afterEvent({type:'RALLY',kind:b.dataset.kind,winner:b.dataset.winner});break;
    case'undo':{const m=mcurrent();if(!m)return;data.matches[data.matches.findIndex(x=>x.id===m.id)]=undo(m);commit();render();break;}
    case'redo':{const m=mcurrent();if(!m)return;data.matches[data.matches.findIndex(x=>x.id===m.id)]=redo(m);commit();render();break;}
    case'side-toggle':afterEvent({type:'SIDE'});break;
    case'change-open':ui.modal='change';render();break;
    case'change-type':ui.modal=b.dataset.type==='regular'?'regular':'libero';render();break;
    case'libero-action':{const ok=afterEvent({type:'LIBERO',playerId:b.dataset.player,enter:b.dataset.enter==='true'});if(ok){ui.modal='';render();}break;}
    case'stop-open':ui.modal='stop';render();break;
    case'stop-archive':{const m=mcurrent();m.archivedEarly=true;ui.modal='';ui.view='archive';commit();render();break;}
    case'stop-delete':confirmAction('Das gesamte Spiel unwiderruflich löschen?',()=>{data.matches=data.matches.filter(x=>x.id!==ui.matchId);ui.modal='';ui.view='archive';commit();render();});break;
    case'prepare-set':ui.nextOptions=null;ui.modal='nextset';render();break;
    case'stats-open':ui.statsReturn=ui.view;ui.statsId=id;ui.statsSet=0;ui.statsPlayer=null;ui.modal='';ui.view='archive';render();break;
    case'stats-close':ui.statsId=null;ui.view=ui.statsReturn==='live'?'live':'archive';render();break;
    case'stats-filter':ui.statsSet=Number(b.dataset.number);ui.statsPlayer=null;render();break;
    case'stats-player':ui.statsPlayer=id;render();break;
    case'info':ui.info=id;ui.modal='info';render();break;
    case'excel':{const m=data.matches.find(x=>x.id===id);downloadBlob(excelBlob(m),`ServeIQ_${m.date}_${m.opponent.replace(/[^a-z0-9äöü-]/gi,'_').slice(0,32)}.xlsx`);toast('Excel-Datei wird heruntergeladen.');break;}
    case'json-export':downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),`ServeIQ_Sicherung_${new Date().toISOString().slice(0,10)}.json`);toast('JSON-Sicherung wird heruntergeladen.');break;
    case'json-import':fileInput.click();break;
    case'match-delete':confirmAction('Spiel und alle Statistiken endgültig löschen?',()=>{data.matches=data.matches.filter(x=>x.id!==id);ui.statsId=null;commit();render();});break;
    case'modal-close':ui.modal='';render();break;
    case'confirm-yes':{const f=ui.confirmFn;ui.confirmFn=null;ui.modal='';if(f)f();break;}
    default:break;
  }}catch(err){showAlert(err.message||String(err));}
});
root.addEventListener('input',e=>{if(e.target.closest('[data-form="player"]')&&['first','last'].includes(e.target.name)){ui.playerDraft={...(ui.playerDraft||{}),[e.target.name]:e.target.value};}});
root.addEventListener('change',e=>{
  const t=e.target,action=t.dataset.action;
  if(action==='lineup-change'){ui.draft.lineup[Number(t.dataset.pos)]=t.value;}
  if(action==='libero-select'){ui.draft.liberoId=t.value;}
  if(action==='roster-toggle'){const list=ui.draft.rosterIds;if(t.checked){if(!list.includes(t.dataset.id))list.push(t.dataset.id);}else ui.draft.rosterIds=list.filter(x=>x!==t.dataset.id);render();}
  if(action==='stats-select-player'){ui.statsPlayer=t.value;render();}
  if(t.name==='position'&&t.closest('[data-form="player"]')){ui.playerDraft={...(ui.playerDraft||{}),position:t.value};}
  if(t.name==='category'&&t.closest('[data-form="team"]')){const form=t.closest('form');form.querySelector('[name="league"]').innerHTML=selectOpt(categoryLeagues(t.value),'');form.querySelector('[name="teamNumber"]').disabled=t.value==='Damen';}
});
root.addEventListener('submit',e=>{
  const form=e.target.closest('[data-form]');if(!form)return;e.preventDefault();const d=Object.fromEntries(new FormData(form));
  try{switch(form.dataset.form){
    case'team':{let t=ui.teamForm;t={...t,club:(d.club||'').trim(),season:d.season,category:d.category,league:d.league,group:d.group,teamNumber:d.category==='Damen'?'':d.teamNumber,players:t.players||[]};
      if(!t.club)throw Error('Bitte Vereinsnamen eingeben.');if(t.id){data.teams[data.teams.findIndex(x=>x.id===t.id)]=t;}else{t.id=uid();data.teams.push(t);}
      ui.teamId=t.id;ui.teamForm=null;ui.editingTeam=false;commit();render();break;}
    case'player':{const t=data.teams.find(t=>t.id===ui.teamId),n=ui.numberChoice||Number(d.number);
      if(!n||n<1||n>99)throw Error('Bitte Trikotnummer auswählen.');
      if(t.players.some(p=>p.number===n&&p.id!==ui.playerId))throw Error('Trikotnummer bereits vergeben.');
      const p={id:ui.playerId||uid(),first:(d.first||'').trim(),last:(d.last||'').trim(),position:d.position,number:n};if(!p.first)throw Error('Vorname fehlt.');
      if(ui.playerId)t.players[t.players.findIndex(x=>x.id===ui.playerId)]=p;else t.players.push(p);
      ui.modal='';commit();render();break;}
    case'match-basic':{const t=data.teams.find(t=>t.id===d.teamId);if(t.players.length<6)throw Error('Dieses Team hat weniger als sechs Spielerinnen.');
      ui.draft={...ui.draft,teamId:t.id,opponent:d.opponent.trim(),date:d.date,rosterIds:t.players.map(p=>p.id),lineup:Array(6).fill(''),liberoId:'',firstServe:''};ui.wizardStep=1;render();break;}
    case'regular':afterEvent({type:'SUB',outId:d.outId,inId:d.inId});if(ui.modal!=='alert')ui.modal='';render();break;
    case'nextset':{const m=mcurrent(),st=replay(m),n=st.sets.length+1;
      const e={type:'SET_START',lineup:Array.from({length:6},(_,i)=>d[`pos${i}`]),liberoId:d.liberoId,side:d.side,firstServe:d.firstServe};
      if(n<=4)e.firstServe=opposite(st.current.firstServe);
      if(n===5&&!e.firstServe)throw Error('Im fünften Satz den ersten Service nach Auslosung auswählen.');
      afterEvent(e);if(ui.modal!=='alert')ui.modal='';render();break;}
  }}catch(err){showAlert(err.message||String(err));}
});
// Import is intentionally performed only after explicit replacement confirmation.
const fileInput=document.createElement('input');fileInput.type='file';fileInput.id='import-file';fileInput.accept='.json,application/json';fileInput.hidden=true;document.body.append(fileInput);
fileInput.addEventListener('change',async()=>{const file=fileInput.files?.[0];if(!file)return;
 try{const parsed=JSON.parse(await file.text());validateBackup(parsed);
   confirmAction('JSON-Sicherung importieren? Alle bisher auf diesem Gerät gespeicherten Teams und Spiele werden ersetzt.',()=>{
     data=parsed;ui.statsId=null;ui.matchId=null;ui.draft=null;ui.teamId=null;ui.view='teams';data.introSeen=true;commit();render();});
 }catch(err){showAlert(`Import fehlgeschlagen: ${err.message}`);}finally{fileInput.value='';}
});
(async()=>{data=await load();ui.view=data.lastView||'teams';armNav();if(ui.view==='live'){const m=activeMatch();if(m)ui.matchId=m.id;}render();if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Offline-Cache:',err));})();

let swipeStart=0;root.addEventListener('touchstart',e=>{if(e.touches.length===1&&e.touches[0].clientY>window.innerHeight-60)swipeStart=e.touches[0].clientY;},{passive:true});root.addEventListener('touchend',e=>{if(swipeStart&&e.changedTouches[0].clientY<swipeStart-22){ui.menuOpen=true;armNav();render();}swipeStart=0;},{passive:true});
