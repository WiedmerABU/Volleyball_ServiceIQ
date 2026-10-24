/* Small dependency-free XLSX OpenXML generator using ZIP/STORED entries.
 * Each sheet contains textual/numeric cells, compatible with Excel/LibreOffice.
 */
import {buildStats, replay,playerLabel} from './model.js';
const enc=new TextEncoder();
const xml=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
function colName(i){let s='';while(i>=0){s=String.fromCharCode(65+i%26)+s;i=Math.floor(i/26)-1;}return s;}
function sheetXml(rows){const used=Math.max(1,...rows.map(r=>r.length));const end=colName(used-1)+Math.max(rows.length,1);
  const widths=Array.from({length:used},(_,i)=>Math.max(12,Math.min(42,Math.max(...rows.map(r=>String(r[i]??'').length),0)+3)));
  const cols=`<cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`;
  const content=rows.map((row,ri)=>`<row r="${ri+1}">${row.map((v,ci)=>{
    const addr=colName(ci)+(ri+1),style=ri===0?' s="1"':'';
    if(typeof v==='number'&&Number.isFinite(v))return `<c r="${addr}"${style}><v>${v}</v></c>`;
    return `<c r="${addr}"${style} t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  }).join('')}</row>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${end}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/>${cols}<sheetData>${content}</sheetData></worksheet>`;
}
function crc32(buf){let c=-1;for(const b of buf){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^-1)>>>0;}
function zipFiles(files){const parts=[],central=[];let offset=0;
  for(const [filename,contents] of files){const name=enc.encode(filename),data=enc.encode(contents),crc=crc32(data);
    const local=new Uint8Array(30+name.length+data.length),d=new DataView(local.buffer);
    d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint16(8,0,true);
    d.setUint32(14,crc,true);d.setUint32(18,data.length,true);d.setUint32(22,data.length,true);
    d.setUint16(26,name.length,true);local.set(name,30);local.set(data,30+name.length);parts.push(local);
    const c=new Uint8Array(46+name.length),v=new DataView(c.buffer);
    v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);
    v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);
    v.setUint16(28,name.length,true);v.setUint32(42,offset,true);c.set(name,46);central.push(c);
    offset+=local.length;
  }
  const centralLen=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);
  v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);
  v.setUint32(12,centralLen,true);v.setUint32(16,offset,true);
  return new Blob([...parts,...central,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
export function excelBlob(match){const st=replay(match),all=buildStats(match),p=id=>playerLabel(match.teamSnapshot.players.find(x=>x.id===id));
  const sheets=[];
  sheets.push(['Spielübersicht',[['ServeIQ – Spielübersicht','Wert'],['Team',match.teamSnapshot.club],['Kategorie',match.teamSnapshot.category],['Saison',match.teamSnapshot.season],['Gegner',match.opponent],['Datum',match.date],['Status',st.finished?'Abgeschlossen':match.archivedEarly?'Nicht abgeschlossen':'Laufend'],['Sätze Interlaken',st.homeSets],['Sätze Gegner',st.awaySets],[],['Satz','Interlaken','Gegner','Gewinner'],...st.sets.map(s=>[s.number,s.home,s.away,s.winner==='home'?'Interlaken':s.winner==='away'?'Gegner':'Offen'])]]);
  sheets.push(['Service Gesamt',[['Spielerin','Ass','Normal','Servicefehler','Total','Punkte bei Service','Effizienz (%)','Punktquote (%)','Fehlerquote (%)','Gespielte Sätze','Ballwechsel','Einsatzquote (%)'],
    ...all.stats.map(s=>[p(s.player.id),s.ace,s.normal,s.fault,s.total,s.points,s.efficiency===null?'':+s.efficiency.toFixed(1),s.pq===null?'':+s.pq.toFixed(1),s.fq===null?'':+s.fq.toFixed(1),s.entered,s.played,+s.participation.toFixed(1)])]]);
  sheets.push(['Service je Satz',[['Satz','Spielerin','Ass','Normal','Servicefehler','Total','Punktquote (%)'],...st.sets.flatMap(set=>buildStats(match,set.number).stats.map(s=>[set.number,p(s.player.id),s.ace,s.normal,s.fault,s.total,s.pq===null?'':+s.pq.toFixed(1)]))]]);
  sheets.push(['Fehlermuster',[['Satz','Typ','Spielerin A','Spielerin B'],...all.patterns.map(e=>[e.set,e.type==='repeat'?'Wiederholter Fehler':'Aufeinanderfolgende Aufschlägerinnen',p(e.players[0]),e.players[1]?p(e.players[1]):''])]]);
  sheets.push(['Spielstandsphasen',[['Satz','Spielerin','Phase','Spielstand vor Service','Situation','Satzball','Service','Ballwechsel gewonnen'],...all.phases.map(e=>[e.set,p(e.playerId),e.phase,e.score,e.situation,e.setball,e.kind,e.winner==='home'?'Interlaken':'Gegner'])]]);
  sheets.push(['Spielerinnen Einsatz',[['Spielerin','Satz','Satzergebnis','Ballwechsel gespielt','Ballwechsel gesamt','Einsatzquote (%)','Einsatzabschnitte (von–bis)'],...all.stats.flatMap(s=>s.perSet.map(x=>[p(s.player.id),x.number,x.result,x.count,x.total,+x.percent.toFixed(1),x.segments.map(z=>`${z.start} – ${z.end} (${z.rallies})`).join('; ')]))]]);
  sheets.push(['Wechsel',[['Satz','Typ','Spielstand','Spielerin raus','Spielerin rein','Ballwechsel Nr.'],...st.sets.flatMap(s=>[
    ...s.substitutions.map(x=>[s.number,'Regulär',x.at.join(':'),p(x.out),p(x.in),x.rallyIndex]),
    ...s.liberoMoves.map(x=>[s.number,x.enter?'Libera rein':'Libera raus',x.at.join(':'),p(x.enter?x.playerId:s.liberoId),p(x.enter?s.liberoId:x.playerId),x.rallyIndex])])]]);
  const files=[];
  files.push(['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`]);
  files.push(['_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`]);
  files.push(['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s[0])}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`]);
  files.push(['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`]);
  files.push(['xl/styles.xml',`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF123765"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`]);
  sheets.forEach((s,i)=>files.push([`xl/worksheets/sheet${i+1}.xml`,sheetXml(s[1])]));
  return zipFiles(files);
}
export function downloadBlob(blob,filename){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
