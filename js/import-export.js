/* Easy Budget Tracker: Excel and CSV export and import.
   Plain script (not a module). Shares globals with the other js/ files and must load in the order listed in index.html. */
'use strict';
/* ---------- Excel / CSV export and import (runs entirely in the browser, nothing is uploaded) ---------- */
var XL_TYPES={income:'Income',bill:'Bill',spend:'Spending',saving:'Saving',card:'Credit card'};
var XL_KIND_NAME={income:'Income',bill:'Bills',spend:'Spending',saving:'Savings',card:'Credit cards'};
var MONTH_WORDS={jan:1,january:1,feb:2,february:2,mar:3,march:3,apr:4,april:4,may:5,jun:6,june:6,jul:7,july:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,nov:11,november:11,dec:12,december:12};

/* --- zip helpers (xlsx files are zip archives) --- */
var crcTable=null;
function crc32(u8){
  if(!crcTable){crcTable=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);crcTable[n]=c>>>0}}
  var crc=0xFFFFFFFF;for(var i=0;i<u8.length;i++)crc=crcTable[(crc^u8[i])&255]^(crc>>>8);return (crc^0xFFFFFFFF)>>>0;
}
function zipStore(files){
  var enc=new TextEncoder(),parts=[],central=[],offset=0;
  files.forEach(function(f){
    var nm=enc.encode(f.name),d=enc.encode(f.data),crc=crc32(d);
    var lh=new DataView(new ArrayBuffer(30));
    lh.setUint32(0,0x04034b50,true);lh.setUint16(4,20,true);lh.setUint16(6,0x0800,true);lh.setUint16(12,0x21,true);
    lh.setUint32(14,crc,true);lh.setUint32(18,d.length,true);lh.setUint32(22,d.length,true);lh.setUint16(26,nm.length,true);
    parts.push(new Uint8Array(lh.buffer),nm,d);
    var ch=new DataView(new ArrayBuffer(46));
    ch.setUint32(0,0x02014b50,true);ch.setUint16(4,20,true);ch.setUint16(6,20,true);ch.setUint16(8,0x0800,true);ch.setUint16(14,0x21,true);
    ch.setUint32(16,crc,true);ch.setUint32(20,d.length,true);ch.setUint32(24,d.length,true);ch.setUint16(28,nm.length,true);ch.setUint32(42,offset,true);
    central.push(new Uint8Array(ch.buffer),nm);
    offset+=30+nm.length+d.length;
  });
  var csize=0;central.forEach(function(c){csize+=c.length});
  var end=new DataView(new ArrayBuffer(22));
  end.setUint32(0,0x06054b50,true);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,csize,true);end.setUint32(16,offset,true);
  var all=parts.concat(central,[new Uint8Array(end.buffer)]),total=0;all.forEach(function(c){total+=c.length});
  var out=new Uint8Array(total),p=0;all.forEach(function(c){out.set(c,p);p+=c.length});return out;
}
async function zipRead(buf){
  var u8=new Uint8Array(buf),dv=new DataView(buf),i=u8.length-22,min=Math.max(0,u8.length-65557);
  while(i>=min&&dv.getUint32(i,true)!==0x06054b50)i--;
  if(i<min)throw new Error('zip');
  var n=dv.getUint16(i+10,true),off=dv.getUint32(i+16,true),ents={},dec=new TextDecoder();
  for(var k=0;k<n;k++){
    if(off+46>u8.length||dv.getUint32(off,true)!==0x02014b50)throw new Error('zip');
    var nl=dv.getUint16(off+28,true),el=dv.getUint16(off+30,true),cl=dv.getUint16(off+32,true);
    ents[dec.decode(u8.subarray(off+46,off+46+nl))]={method:dv.getUint16(off+10,true),csz:dv.getUint32(off+20,true),usz:dv.getUint32(off+24,true),lo:dv.getUint32(off+42,true)};
    off+=46+nl+el+cl;
  }
  return {u8:u8,dv:dv,ents:ents};
}
async function zipGet(z,name){
  var e=z.ents[name];if(!e)return null;
  if(e.usz>40e6)throw new Error('big');
  var lo=e.lo;if(z.dv.getUint32(lo,true)!==0x04034b50)throw new Error('zip');
  var start=lo+30+z.dv.getUint16(lo+26,true)+z.dv.getUint16(lo+28,true),data=z.u8.subarray(start,start+e.csz);
  if(e.method===0)return new TextDecoder().decode(data);
  if(e.method!==8)throw new Error('zip');
  var ds=new DecompressionStream('deflate-raw'),w=ds.writable.getWriter();
  w.write(data).catch(function(){});w.close().catch(function(){});
  var rd=ds.readable.getReader(),chunks=[],tot=0;
  for(;;){var x=await rd.read();if(x.done)break;tot+=x.value.length;if(tot>40e6){rd.cancel();throw new Error('big')}chunks.push(x.value)}
  var all=new Uint8Array(tot),p=0;chunks.forEach(function(c){all.set(c,p);p+=c.length});
  return new TextDecoder().decode(all);
}
function colIdx(ref){var m=/^([A-Z]+)/.exec(ref),n=0;if(!m)return 0;for(var i=0;i<m[1].length;i++)n=n*26+m[1].charCodeAt(i)-64;return n-1}
function colLetter(i){var s='';i++;while(i>0){var r=(i-1)%26;s=String.fromCharCode(65+r)+s;i=Math.floor((i-1)/26)}return s}

/* --- read an .xlsx workbook --- */
async function xlsxBook(z){
  var P=new DOMParser();function X(t){return P.parseFromString(t,'application/xml')}
  var wbT=await zipGet(z,'xl/workbook.xml');if(!wbT)throw new Error('xlsx');
  var relsT=await zipGet(z,'xl/_rels/workbook.xml.rels'),rels={};
  if(relsT)[].slice.call(X(relsT).getElementsByTagName('Relationship')).forEach(function(r){rels[r.getAttribute('Id')]=r.getAttribute('Target')});
  var sheets=[].slice.call(X(wbT).getElementsByTagName('sheet')).map(function(s){
    var rid=s.getAttribute('r:id')||s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id'),t=rels[rid]||'';
    t=t.charAt(0)==='/'?t.slice(1):'xl/'+t;return {name:s.getAttribute('name')||'Sheet',path:t};
  });
  if(!sheets.length)throw new Error('xlsx');
  var ssT=await zipGet(z,'xl/sharedStrings.xml'),ss=[];
  if(ssT)[].slice.call(X(ssT).getElementsByTagName('si')).forEach(function(si){var t='';[].slice.call(si.getElementsByTagName('t')).forEach(function(n){if(n.parentNode.nodeName!=='rPh')t+=n.textContent});ss.push(t)});
  return {z:z,sheets:sheets,ss:ss,X:X};
}
async function xlsxSheet(book,i){
  var sh=book.sheets[i];if(!sh)return [];
  var t=await zipGet(book.z,sh.path);if(!t)return [];
  var doc=book.X(t),rows=[],rowEls=doc.getElementsByTagName('row'),seq=0;
  for(var a=0;a<rowEls.length;a++){
    var re=rowEls[a],ri=re.getAttribute('r')?(+re.getAttribute('r')-1):seq;seq=ri+1;
    if(ri>=60000)break;
    var arr=rows[ri]=[],cs=re.getElementsByTagName('c');
    for(var b=0;b<cs.length;b++){
      var c=cs[b],ref=c.getAttribute('r'),ci=ref?colIdx(ref):b,ty=c.getAttribute('t'),ve=c.getElementsByTagName('v')[0],val='';
      if(ty==='inlineStr'){val=[].slice.call(c.getElementsByTagName('t')).map(function(n){return n.textContent}).join('')}
      else if(ve){var raw=ve.textContent;
        if(ty==='s')val=book.ss[+raw]||'';else if(ty==='b')val=raw==='1'?'TRUE':'FALSE';else if(ty==='e')val='';else if(ty==='str')val=raw;
        else{var nv=parseFloat(raw);val=isFinite(nv)?nv:raw}}
      if(ci<500)arr[ci]=val;
    }
  }
  for(var r=0;r<rows.length;r++){if(!rows[r])rows[r]=[];for(var q=0;q<rows[r].length;q++)if(rows[r][q]===undefined)rows[r][q]=''}
  return rows;
}

/* --- write an .xlsx workbook: rows of cells; a cell is a string, a number or {v,f,s} --- */
function xmlEsc(t){return String(t).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function xlsxBuild(rows,sheetName,widths,freezeCols){
  var sd='';
  rows.forEach(function(row,r){
    var cx='';
    row.forEach(function(cell,c){
      if(cell===null||cell===undefined||cell==='')return;
      var ref=colLetter(c)+(r+1),o=(typeof cell==='object')?cell:{v:cell},st=o.s||0;
      if(typeof o.v==='number'){cx+='<c r="'+ref+'" s="'+(st||2)+'">'+(o.f?'<f>'+xmlEsc(o.f)+'</f>':'')+'<v>'+(Math.round(o.v*100)/100)+'</v></c>'}
      else cx+='<c r="'+ref+'" t="inlineStr"'+(st?' s="'+st+'"':'')+'><is><t xml:space="preserve">'+xmlEsc(o.v)+'</t></is></c>';
    });
    sd+='<row r="'+(r+1)+'">'+cx+'</row>';
  });
  var cols='<cols>'+widths.map(function(w,i){return '<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+w+'" customWidth="1"/>'}).join('')+'</cols>';
  var view='<sheetViews><sheetView workbookViewId="0"><pane xSplit="'+freezeCols+'" ySplit="1" topLeftCell="'+colLetter(freezeCols)+'2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>';
  var NS='xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  return zipStore([
    {name:'[Content_Types].xml',data:H+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'},
    {name:'_rels/.rels',data:H+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'},
    {name:'xl/workbook.xml',data:H+'<workbook '+NS+' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+xmlEsc(sheetName)+'" sheetId="1" r:id="rId1"/></sheets><calcPr fullCalcOnLoad="1"/></workbook>'},
    {name:'xl/_rels/workbook.xml.rels',data:H+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/styles.xml',data:H+'<styleSheet '+NS+'><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="4" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'},
    {name:'xl/worksheets/sheet1.xml',data:H+'<worksheet '+NS+'>'+view+cols+'<sheetData>'+sd+'</sheetData></worksheet>'}
  ]);
}

/* --- build the export grid for one year --- */
function xlGrid(year){
  var months=[];for(var i=1;i<=12;i++)months.push(year+'-'+pad2(i));
  var data=[];
  KINDS.forEach(function(K){
    if(K.k==='loan'){state.loans.forEach(function(l){data.push({type:'Loan',name:l.name,vals:months.map(function(m){return (l.paid&&l.paid[m])?loanVal(l,m):0})})});return}
    if(K.k==='collect'){CLd().forEach(function(c){data.push({type:'Collectible',name:c.name,vals:months.map(function(m){return clOut(c,m)})})});return}
    state.items.filter(function(i){return i.kind===K.k}).forEach(function(it){data.push({type:XL_TYPES[K.k],name:it.name,vals:months.map(function(m){return (needsPaid(it,m)&&!(it.paid&&it.paid[m]))?0:itemVal(it,m)})})});
  });
  TX_KINDS.forEach(function(k){
    var vals=months.map(function(m){return txMonth(m).filter(function(x){return x.kind===k}).reduce(function(a,x){return a+x.amount},0)});
    if(vals.some(function(v){return v>0}))data.push({type:k==='loan'?'Loan':XL_TYPES[k],name:'Logged transactions',vals:vals});
  });
  var backVals=months.map(function(m){return calc(m).back});
  if(backVals.some(function(v){return v>0}))data.push({type:'Collected back',name:'Collected back (collectibles)',vals:backVals});
  var inc=[],out=[],left=[],pend=[];months.forEach(function(m){var c=calc(m);inc.push(c.income);out.push(c.out);left.push(c.left);pend.push(c.pend)});
  return {months:months,data:data,inc:inc,out:out,left:left,pend:pend};
}
function xlsxExport(year){
  var g=xlGrid(year),n=g.data.length,rows=[],head=['Type','Category'].concat(g.months.map(short)).concat(['Total']);
  rows.push(head.map(function(h){return {v:h,s:1}}));
  g.data.forEach(function(d,k){
    var r=k+2,row=[d.type,d.name];d.vals.forEach(function(v){row.push(v)});
    row.push({v:d.vals.reduce(function(a,b){return a+b},0),f:'SUM(C'+r+':N'+r+')'});rows.push(row);
  });
  rows.push([]);
  var last=n+1,incRow=n+3,outRow=n+4,leftRow=n+5,sum=function(a){return a.reduce(function(x,y){return x+y},0)},bRow=0;
  g.data.forEach(function(d,k){if(d.type==='Collected back')bRow=k+2});
  var rI=['','Total income'],rO=['','Total outgoings'],rL=['','Left over'];
  rI[1]={v:'Total income',s:1};rO[1]={v:'Total outgoings',s:1};rL[1]={v:'Left over',s:1};
  g.months.forEach(function(m,k){
    var L=colLetter(k+2);
    rI.push({v:g.inc[k],s:3,f:'SUMIF($A$2:$A$'+last+',"Income",'+L+'$2:'+L+'$'+last+')'});
    rO.push({v:g.out[k],s:3,f:'SUM('+L+'$2:'+L+'$'+last+')-'+L+incRow+(bRow?'-'+L+bRow:'')});
    rL.push({v:g.left[k],s:3,f:L+incRow+'-'+L+outRow+(bRow?'+'+L+bRow:'')});
  });
  rI.push({v:sum(g.inc),s:3,f:'SUM(C'+incRow+':N'+incRow+')'});rO.push({v:sum(g.out),s:3,f:'SUM(C'+outRow+':N'+outRow+')'});rL.push({v:sum(g.left),s:3,f:'SUM(C'+leftRow+':N'+leftRow+')'});
  rows.push(rI,rO,rL);
  if(g.pend.some(function(v){return v>0}))rows.push([],['',{v:'Not yet paid (not counted above)',s:1}].concat(g.pend.map(function(v){return {v:v,s:3}}),[{v:sum(g.pend),s:3}]));
  var widths=[14,28].concat(g.months.map(function(){return 12})).concat([14]);
  return xlsxBuild(rows,'Budget '+year,widths,2);
}
function csvCell(v){
  var s=String(v==null?'':v);
  if(/^[=+\-@]/.test(s)&&isNaN(Number(s)))s="'"+s;
  return /[",\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
}
function csvExport(year){
  var g=xlGrid(year),lines=[],f2=function(n){return (Math.round(n*100)/100).toFixed(2)};
  lines.push(['Type','Category'].concat(g.months.map(short)).concat(['Total']).map(csvCell).join(','));
  g.data.forEach(function(d){lines.push([d.type,d.name].map(csvCell).concat(d.vals.map(f2),[f2(d.vals.reduce(function(a,b){return a+b},0))]).join(','))});
  var sum=function(a){return a.reduce(function(x,y){return x+y},0)};
  lines.push('');
  lines.push(['','Total income'].concat(g.inc.map(f2),[f2(sum(g.inc))]).join(','));
  lines.push(['','Total outgoings'].concat(g.out.map(f2),[f2(sum(g.out))]).join(','));
  lines.push(['','Left over'].concat(g.left.map(f2),[f2(sum(g.left))]).join(','));
  if(g.pend.some(function(v){return v>0})){lines.push('');lines.push(['','Not yet paid (not counted above)'].concat(g.pend.map(f2),[f2(sum(g.pend))]).join(','))}
  return '﻿'+lines.join('\r\n')+'\r\n';
}
function xlDownload(name,blob,msg){
  try{
    var f=new File([blob],name,{type:blob.type});
    if(navigator.canShare&&navigator.canShare({files:[f]})){navigator.share({files:[f],title:name}).catch(function(){});setStatus('Choose where to save the file');return}
  }catch(e){}
  try{var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000);setStatus(msg)}
  catch(e){setStatus('Could not create the file')}
}
function doXlExport(kind){
  var sel=$('xl-year'),year=sel?+sel.value:+cur.split('-')[0];if(!year)year=+cur.split('-')[0];
  if(kind==='xlsx'){
    track('export-excel');
    xlDownload('budget-'+year+'.xlsx',new Blob([xlsxExport(year)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),'Excel file downloaded for '+year);
  }else{
    track('export-csv');
    xlDownload('budget-'+year+'.csv',new Blob([csvExport(year)],{type:'text/csv;charset=utf-8'}),'CSV file downloaded for '+year);
  }
}
function xlYearOptions(){
  var y0=+state.startMonth.split('-')[0],y1=+ymNow().split('-')[0]+1,yc=+cur.split('-')[0];
  state.items.forEach(function(i){Object.keys(i.over||{}).forEach(function(m){var y=+m.split('-')[0];if(y>1999&&y<2200){if(y<y0)y0=y;if(y>y1)y1=y}})});
  if(yc<y0)y0=yc;if(yc>y1)y1=yc;
  var o='';for(var y=y0;y<=y1;y++)o+='<option'+(y===yc?' selected':'')+'>'+y+'</option>';return o;
}

/* --- read CSV text --- */
function decodeText(buf){
  try{return new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(e){try{return new TextDecoder('windows-1252').decode(buf)}catch(e2){return new TextDecoder().decode(buf)}}
}
function parseCSV(text){
  if(text.charCodeAt(0)===0xFEFF)text=text.slice(1);
  var sample=text.slice(0,4000).split(/\r\n|\n|\r/).slice(0,8).join('\n'),best=',',bc=-1;
  [',',';','\t','|'].forEach(function(d){var c=sample.split(d).length-1;if(c>bc){bc=c;best=d}});
  var rows=[],row=[],cell='',q=false,i=0,n=text.length;
  for(;i<n;i++){
    var ch=text.charAt(i);
    if(q){if(ch==='"'){if(text.charAt(i+1)==='"'){cell+='"';i++}else q=false}else cell+=ch}
    else if(ch==='"'&&cell==='')q=true;
    else if(ch===best){row.push(cell);cell=''}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text.charAt(i+1)==='\n')i++;row.push(cell);cell='';rows.push(row);row=[];if(rows.length>=60000)break}
    else cell+=ch;
  }
  if(cell!==''||row.length){row.push(cell);rows.push(row)}
  return rows.map(function(r){return r.map(function(c){var t=c.trim();if(/^'[=+\-@]/.test(t))t=t.slice(1);return t})});
}

/* --- understand amounts, dates and month headings --- */
function pf(v){if(amtBadChars(v))return NaN;var n=parseAmt(v);return n===null?NaN:n}
var AMT_MAX=1e9;
function amtClamp(n){return n>AMT_MAX?AMT_MAX:n<-AMT_MAX?-AMT_MAX:n}
/* v9.29: typed text may contain only digits, . , spaces, a currency symbol, one sign (leading or trailing) or ( ) around the number.
   Anything else (2+3, 0x1F, 12abc, 1-2) is rejected instead of being quietly turned into a different number.
   parseAmt stays lenient because Excel/CSV import relies on it. */
function amtBadChars(v){
  if(typeof v==='number')return false;
  var s=String(v==null?'':v).trim();if(!s)return false;
  if(/^[+-]?(\d+\.?\d*|\.\d+)e[+-]?\d+$/i.test(s))return false;
  s=s.replace(/[\uFF10-\uFF19\u0660-\u0669\u06F0-\u06F9]/g,'0').replace(/\uFF0E/g,'.').replace(/\uFF0C/g,',').replace(/\uFF0D|\u2212/g,'-');
  s=s.replace(/[\u20B1$\u20AC\u00A3\u00A5\u20B9\u20A9\u20AB\u0E3F\u20A6\u20BD\u20BA\u20B4\u20AA\u00A0\s]/g,'');
  if(/^\(.*\)$/.test(s))s=s.slice(1,-1);
  if(!/^[+-]?(\d[\d.,]*|\.\d[\d.,]*)-?$/.test(s)||/^[+-].*-$/.test(s))return true;
  var core=s.replace(/^[+-]/,'').replace(/-$/,'');
  /* the digits themselves: 1250.50, 1,250.50, 1.250,50, 1250,5 are fine; 1.2.3, 1,2,3 and 1,2345 are not */
  if(/^\d*\.?\d*$/.test(core))return false;
  if(/^\d{1,3}(,\d{3})+(\.\d*)?$/.test(core))return false;
  if(/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(core))return false;
  if(/^\d+,\d{1,2}$/.test(core))return false;
  return true;
}
/* what to tell the user about a typed amount: '' if fine, else a short message. kind is optional (income and bills may not be negative) */
function amtProblem(raw,kind){
  var s=String(raw==null?'':raw).trim();if(!s)return '';
  if(amtBadChars(s))return 'Numbers only';
  var n=parseAmt(s);if(n===null)return 'Numbers only';
  if(n<0&&(kind==='income'||kind==='bill'))return 'Cannot be negative';
  if(Math.abs(n)>=AMT_MAX)return 'Too large';
  return '';
}
function parseAmt(v){
  if(typeof v==='number')return isFinite(v)?amtClamp(v):null;
  var s=String(v==null?'':v).trim();if(!s)return null;
  if(/^[+-]?(\d+\.?\d*|\.\d+)e[+-]?\d+$/i.test(s)){var sn=Number(s);return isFinite(sn)?amtClamp(sn):null}
  s=s.replace(/[\uFF10-\uFF19]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0xFF10+48)}).replace(/[\u0660-\u0669]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0x660+48)}).replace(/[\u06F0-\u06F9]/g,function(c){return String.fromCharCode(c.charCodeAt(0)-0x6F0+48)}).replace(/\uFF0E/g,'.').replace(/\uFF0C/g,',').replace(/\uFF0D|\u2212/g,'-');
  var neg=false;
  if(/^\(.*\)$/.test(s)){neg=true;s=s.slice(1,-1)}
  s=s.replace(/[^\d.,\-+]/g,'');
  if(!/\d/.test(s))return null;
  if(/-$/.test(s)){neg=true;s=s.slice(0,-1)}
  if(s.charAt(0)==='-'){neg=true;s=s.slice(1)}
  s=s.replace(/^\+/,'').replace(/[-+]/g,'');
  var lc=s.lastIndexOf(','),ld=s.lastIndexOf('.');
  if(lc>=0&&ld>=0){s=lc>ld?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'')}
  else if(lc>=0){s=(/,\d{1,2}$/.test(s)&&(s.match(/,/g)||[]).length===1)?s.replace(',','.'):s.replace(/,/g,'')}
  else if((s.match(/\./g)||[]).length>1)s=s.replace(/\./g,'');
  var n=parseFloat(s);if(!isFinite(n))return null;return amtClamp(neg?-n:n);
}
function ymStr(y,m){return y+'-'+pad2(m)}
function serialYM(v){if(!(v>20000&&v<80000))return null;var d=new Date(Math.round((v-25569)*864e5));return ymStr(d.getUTCFullYear(),d.getUTCMonth()+1)}
function detectOrder(vals){
  var dm=0,md=0;
  vals.forEach(function(v){var m=/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/.exec(String(v));if(m){if(+m[1]>12&&+m[1]<=31&&+m[2]<=12)dm++;if(+m[2]>12&&+m[2]<=31&&+m[1]<=12)md++}});
  return dm>md?'dmy':'mdy';
}
function parseDateYM(v,order){
  if(v==null||v==='')return null;
  if(typeof v==='number')return serialYM(v);
  var s=String(v).trim(),m,mo,y;
  if(/^\d{5}(\.\d+)?$/.test(s))return serialYM(parseFloat(s));
  if((m=/^(\d{4})[-\/.](\d{1,2})(?:[-\/.]\d{1,2})?(?:\D|$)/.exec(s))){mo=+m[2];return (mo>=1&&mo<=12)?ymStr(+m[1],mo):null}
  if((m=/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/.exec(s))){y=+m[3];if(y<100)y+=2000;mo=(order==='dmy')?+m[2]:+m[1];return (mo>=1&&mo<=12)?ymStr(y,mo):null}
  if((m=/^(\d{1,2})[-\/.](\d{4})$/.exec(s))){mo=+m[1];return (mo>=1&&mo<=12)?ymStr(+m[2],mo):null}
  if((m=/^(\d{1,2})(?:st|nd|rd|th)?[\s\-]+([A-Za-z]{3,9})\.?,?[\s\-]+(\d{2,4})/.exec(s))&&MONTH_WORDS[m[2].toLowerCase()]){y=+m[3];if(y<100)y+=2000;return ymStr(y,MONTH_WORDS[m[2].toLowerCase()])}
  if((m=/^([A-Za-z]{3,9})\.?[\s\-]+(?:\d{1,2}(?:st|nd|rd|th)?,?[\s\-]+)?(\d{2,4})/.exec(s))&&MONTH_WORDS[m[1].toLowerCase()]){y=+m[2];if(y<100)y+=2000;return ymStr(y,MONTH_WORDS[m[1].toLowerCase()])}
  return null;
}
/* month column headings: returns {m, y|null} or null */
function parseMonthHeader(h){
  if(h===''||h==null)return null;
  if(typeof h==='number'){var sy=serialYM(h);return sy?{m:+sy.split('-')[1],y:+sy.split('-')[0]}:null}
  var s=String(h).trim(),m;
  if((m=/^(\d{4})[-\/ .](\d{1,2})$/.exec(s))&&+m[2]>=1&&+m[2]<=12)return {m:+m[2],y:+m[1]};
  if((m=/^(\d{1,2})[-\/ .](\d{4})$/.exec(s))&&+m[1]>=1&&+m[1]<=12)return {m:+m[1],y:+m[2]};
  if((m=/^([A-Za-z]{3,9})\.?[\s\-']*(\d{2}|\d{4})?$/.exec(s))&&MONTH_WORDS[m[1].toLowerCase()]){var y=m[2]?+m[2]:null;if(y!==null&&y<100)y+=2000;return {m:MONTH_WORDS[m[1].toLowerCase()],y:y}}
  var sd=/^\d{5}(\.\d+)?$/.test(s)?serialYM(parseFloat(s)):null;if(sd)return {m:+sd.split('-')[1],y:+sd.split('-')[0]};
  return null;
}
function typeFromLabel(t){
  t=String(t==null?'':t).trim().toLowerCase();if(!t)return null;
  if(/loan/.test(t))return 'loan';if(/collectib|utang|owe/.test(t))return 'collect';if(/card|credit/.test(t))return 'card';if(/^inc|salary|earn|revenue/.test(t))return 'income';
  if(/sav|invest|goal/.test(t))return 'saving';if(/bill|fixed|utilit|rent|subscr/.test(t))return 'bill';if(/spend|expens|variable|flex|need|want/.test(t))return 'spend';
  return null;
}

/* --- import wizard --- */
var IM=null,imUndo=null;
function imOpen(){var d=$('impDlg');if(!d.open){if(d.showModal)d.showModal();else d.setAttribute('open','')}}
function imClose(){var d=$('impDlg');if(d.close)d.close();else d.removeAttribute('open');setTimeout(function(){if(!d.open)d.innerHTML=''},0)}
function imMsg(html){$('impDlg').innerHTML='<div class="imp"><h2>Import from Excel or CSV</h2><p>'+html+'</p><div class="srow"><button class="tbtn primary" data-imp="close">OK</button></div></div>';imOpen()}
async function imLoadFile(file){
  if(!file)return;
  if(file.size>15e6){imMsg('That file is larger than 15 MB. Try exporting a shorter date range.');return}
  var low=file.name.toLowerCase(),buf;
  try{buf=await file.arrayBuffer()}catch(e){imMsg('That file could not be opened.');return}
  try{
    if(/\.(xlsx|xlsm)$/.test(low)){
      if(typeof DecompressionStream==='undefined'){imMsg('This browser cannot open Excel files. In Excel, choose Save As and pick CSV, then import the CSV file.');return}
      var book=await xlsxBook(await zipRead(buf));
      IM={name:file.name,book:book,sheetIdx:0,rows:await xlsxSheet(book,0)};
    }else if(/\.xls$/.test(low)){imMsg('Old .xls files cannot be read. In Excel, choose Save As and pick Excel Workbook (.xlsx) or CSV, then import that file.');return}
    else IM={name:file.name,book:null,sheetIdx:0,rows:parseCSV(decodeText(buf))};
  }catch(e){imMsg('That file could not be read. Check that it is a valid .xlsx or .csv file.');return}
  if(!IM.rows.length||IM.rows.every(function(r){return !r.some(function(c){return String(c).trim()!==''})})){IM=null;imMsg('That file looks empty.');return}
  imInit();
}
function imNonEmpty(r){return (r||[]).filter(function(c){return String(c).trim()!==''}).length}
function imInit(){
  var rows=IM.rows,h=0;
  for(var i=0;i<Math.min(rows.length,40);i++){var r=rows[i]||[];if(imNonEmpty(r)>=2&&r.some(function(c){return typeof c==='string'&&c.trim()!==''&&isNaN(Number(c))})){h=i;break}}
  IM.hdr=h;IM.step=1;IM.sel={};IM.dir='signed';IM.replace=true;IM.year=+cur.split('-')[0];IM.cols={};
  IM.existing=state.sample?[]:state.items;
  imGuess();imRender();imOpen();
}
function imNCols(){var n=0;for(var i=IM.hdr;i<Math.min(IM.rows.length,IM.hdr+30);i++)n=Math.max(n,(IM.rows[i]||[]).length);return n}
function imHead(i){var h=(IM.rows[IM.hdr]||[])[i];h=(h===undefined||h==='')?'':String(h).trim();return (h||'(blank)')+' · '+colLetter(i)}
function imGuess(){
  var heads=(IM.rows[IM.hdr]||[]).map(function(h){return String(h==null?'':h).trim().toLowerCase()}),n=imNCols(),find=function(re){for(var i=0;i<n;i++)if(re.test(heads[i]||''))return String(i);return ''};
  var months=0;for(var i=0;i<n;i++)if(parseMonthHeader((IM.rows[IM.hdr]||[])[i]))months++;
  var c=IM.cols;
  c.date=find(/date|posted|time|^day$/);
  c.amount=find(/^amount|^amt|^value|debit|^total$|price|^php|₱/);
  c.group=find(/categor/)||find(/descr|merchant|payee|particular|detail|narrat|memo|name|item/);
  c.cat=find(/categor|^name$|item|particular|descr|label|expense|account/);
  c.type=find(/^typ|kind|^group$/);
  if(c.cat===''){for(var j=0;j<n;j++){var d=IM.rows[IM.hdr+1];if(d&&typeof d[j]==='string'&&isNaN(Number(d[j]))&&String(j)!==c.type){c.cat=String(j);break}}}
  if(c.type===c.cat)c.type='';
  IM.mode=months>=3?'table':'tx';
  var dv=[];if(c.date!==''){for(var k=IM.hdr+1;k<Math.min(IM.rows.length,IM.hdr+200);k++)dv.push((IM.rows[k]||[])[+c.date])}
  IM.order=detectOrder(dv);
}
function imMonthCols(){
  var heads=IM.rows[IM.hdr]||[],out=[];
  for(var i=0;i<imNCols();i++){var p=parseMonthHeader(heads[i]);if(p)out.push({i:i,m:p.m,y:p.y||IM.year})}
  return out;
}
function imRender(){
  var d=$('impDlg');
  if(IM.step===1)d.innerHTML=imSetupHTML();
  else if(IM.step===2)d.innerHTML=imLinkHTML();
  else d.innerHTML=imDoneHTML();
}
function imSetupHTML(){
  var n=imNCols(),c=IM.cols,rows=IM.rows;
  function opts(sel,none){var o=none?'<option value="">'+none+'</option>':'';for(var i=0;i<n;i++)o+='<option value="'+i+'"'+(String(sel)===String(i)?' selected':'')+'>'+esc(imHead(i))+'</option>';return o}
  var h='<div class="imp"><h2>Import from Excel or CSV</h2><p class="status">File: <b>'+esc(IM.name)+'</b>. It is read on this device and never uploaded.</p>';
  if(IM.book&&IM.book.sheets.length>1)h+='<label class="impf">Sheet<select data-imp-f="sheet">'+IM.book.sheets.map(function(s,i){return '<option value="'+i+'"'+(i===IM.sheetIdx?' selected':'')+'>'+esc(s.name)+'</option>'}).join('')+'</select></label>';
  h+='<div class="impf"><span>What does each row in your file hold?</span><label class="chk"><input type="radio" name="impmode" data-imp-f="mode" value="tx"'+(IM.mode==='tx'?' checked':'')+'> One transaction per row (bank, e-wallet or expense list)</label><label class="chk"><input type="radio" name="impmode" data-imp-f="mode" value="table"'+(IM.mode==='table'?' checked':'')+'> One category per row, with months in columns</label></div>';
  h+='<label class="impf">Row where the column titles are<input class="num" type="number" min="1" max="'+rows.length+'" data-imp-f="hdr" value="'+(IM.hdr+1)+'"></label>';
  h+='<div class="impgrid">';
  if(IM.mode==='tx'){
    h+='<label class="impf">Date column<select data-imp-f="date">'+opts(c.date,'Choose…')+'</select></label>'+
      '<label class="impf">Amount column<select data-imp-f="amount">'+opts(c.amount,'Choose…')+'</select></label>'+
      '<label class="impf">Link by this column (category, merchant or description)<select data-imp-f="group">'+opts(c.group,'Choose…')+'</select></label>'+
      '<label class="impf">Date order<select data-imp-f="order"><option value="mdy"'+(IM.order==='mdy'?' selected':'')+'>Month/Day/Year (12/31/2026)</option><option value="dmy"'+(IM.order==='dmy'?' selected':'')+'>Day/Month/Year (31/12/2026)</option></select></label>'+
      '<label class="impf">What do the amounts mean?<select data-imp-f="dir"><option value="signed"'+(IM.dir==='signed'?' selected':'')+'>Negative = money spent, positive = money received</option><option value="posspend"'+(IM.dir==='posspend'?' selected':'')+'>Positive = money spent (expense list or card statement)</option><option value="allspend"'+(IM.dir==='allspend'?' selected':'')+'>Everything is money spent</option></select></label>';
  }else{
    var mc=imMonthCols();
    h+='<label class="impf">Category column<select data-imp-f="cat">'+opts(c.cat,'Choose…')+'</select></label>'+
      '<label class="impf">Type column (optional)<select data-imp-f="type">'+opts(c.type,'None: treat new rows as spending')+'</select></label>'+
      '<label class="impf">Year for month titles without a year<input class="num" type="number" min="2000" max="2100" data-imp-f="year" value="'+IM.year+'"></label>';
    h+='<p class="status" style="grid-column:1/-1;margin:0">'+(mc.length?'Month columns found: '+mc.map(function(x){return MONTHS[x.m-1]+' '+x.y}).join(', '):'No month columns found in that row. Check the row number above.')+'</p>';
  }
  h+='</div>';
  var show=rows.slice(IM.hdr,IM.hdr+6);
  h+='<div class="impscroll"><table class="imptab"><tbody>'+show.map(function(r,ri){var t='';for(var i=0;i<Math.min(n,12);i++){var v=(r||[])[i];t+=(ri===0?'<th>':'<td>')+esc(v===undefined?'':String(v).slice(0,28))+(ri===0?'</th>':'</td>')}return '<tr>'+t+'</tr>'}).join('')+'</tbody></table></div>';
  var ok=IM.mode==='tx'?(c.date!==''&&c.amount!==''&&c.group!==''):(c.cat!==''&&imMonthCols().length>0);
  h+='<div class="srow"><button class="tbtn" data-imp="close">Cancel</button><button class="tbtn primary" data-imp="next"'+(ok?'':' disabled')+'>Next: link to categories</button></div></div>';
  return h;
}
/* the list of distinct values in the file that the user links to categories */
function imValues(){
  var rows=IM.rows,map={},list=[],c=IM.cols,g=+(IM.mode==='tx'?c.group:c.cat),tcol=c.type===''?-1:+c.type,mc=imMonthCols();
  for(var r=IM.hdr+1;r<rows.length;r++){
    var row=rows[r]||[];if(!imNonEmpty(row))continue;
    var raw=row[g];raw=(raw===undefined||raw==='')?'':String(raw).trim();
    if(IM.mode==='table'){
      if(!raw||/^(total|left over|subtotal|grand total)/i.test(raw))continue;
      var ty=tcol>=0?typeFromLabel(row[tcol]):null;if(ty==='loan'||ty==='collect')continue;
    }
    var key=raw.toLowerCase()||'(blank)',e=map[key];
    if(!e){e=map[key]={raw:raw||'(blank)',key:key,count:0,sum:0,kind:null};list.push(e)}
    e.count++;
    if(IM.mode==='tx'){var a=parseAmt(row[+c.amount]);if(a!==null)e.sum+=a}
    else{var ty2=tcol>=0?typeFromLabel(row[tcol]):null;if(ty2&&!e.kind)e.kind=ty2}
  }
  list.sort(function(a,b){return b.count-a.count});
  return list;
}
function imDefaultSel(v){
  var saved=state.importMap&&state.importMap[v.key];
  if(saved==='skip')return 'skip';
  if(saved&&saved.indexOf('i:')===0&&IM.existing.some(function(i){return 'i:'+i.id===saved}))return saved;
  var ex=IM.existing,nm=function(i){return String(i.name||'').trim().toLowerCase()},hit=null;
  ex.forEach(function(i){if(!hit&&nm(i)===v.key&&(!v.kind||i.kind===v.kind))hit=i});
  if(!hit)ex.forEach(function(i){if(!hit&&nm(i)===v.key)hit=i});
  if(!hit&&v.key.length>=4)ex.forEach(function(i){var n=nm(i);if(!hit&&n.length>=4&&(v.key.indexOf(n)>=0||n.indexOf(v.key)>=0))hit=i});
  if(hit)return 'i:'+hit.id;
  var kind=v.kind||((IM.mode==='tx'&&IM.dir==='signed'&&v.sum>0)?'income':'spend');
  return 'n:'+kind;
}
function imTargetOptions(sel){
  var o='<option value="skip"'+(sel==='skip'?' selected':'')+'>Skip: do not import</option>';
  ['income','bill','spend','saving','card'].forEach(function(k){
    var its=IM.existing.filter(function(i){return i.kind===k});if(!its.length)return;
    o+='<optgroup label="Existing: '+XL_KIND_NAME[k]+'">'+its.map(function(i){return '<option value="i:'+esc(i.id)+'"'+(sel==='i:'+i.id?' selected':'')+'>'+esc(i.name||'Unnamed')+'</option>'}).join('')+'</optgroup>';
  });
  o+='<optgroup label="Create a new category">'+['spend','bill','income','saving','card'].map(function(k){return '<option value="n:'+k+'"'+(sel==='n:'+k?' selected':'')+'>New '+(k==='spend'?'spending category':k==='bill'?'bill':k==='income'?'income source':k==='saving'?'savings goal':'credit card')+'</option>'}).join('')+'</optgroup>';
  return o;
}
function imLinkHTML(){
  var vals=IM.values,h='<div class="imp"><h2>Link your file to categories</h2><p class="status">Pick where each value in <b>'+esc(imHead(+(IM.mode==='tx'?IM.cols.group:IM.cols.cat)).replace(/ · .*$/,''))+'</b> should go. Names that match are linked for you, and your choices are remembered next time.</p>';
  h+='<div class="impscroll"><table class="imptab link"><thead><tr><th>In your file</th><th>Goes to</th></tr></thead><tbody>';
  vals.forEach(function(v,i){
    var sel=IM.sel[v.key]||(IM.sel[v.key]=imDefaultSel(v));
    h+='<tr><td><b>'+esc(v.raw)+'</b><br><span class="status">'+v.count+' row'+(v.count===1?'':'s')+(IM.mode==='tx'&&v.sum?' · net '+fmt(v.sum):'')+'</span></td><td><select data-imp-map="'+i+'" aria-label="Category for '+esc(v.raw)+'">'+imTargetOptions(sel)+'</select></td></tr>';
  });
  h+='</tbody></table></div>';
  h+='<div class="impf"><span>If a month already has an amount</span><label class="chk"><input type="radio" name="imprep" data-imp-f="replace" value="1"'+(IM.replace?' checked':'')+'> Replace it with the imported amount</label><label class="chk"><input type="radio" name="imprep" data-imp-f="replace" value="0"'+(IM.replace?'':' checked')+'> Add the imported amount to it</label></div>';
  h+='<div id="impSummary" class="insight-note"></div>';
  h+='<div class="srow"><button class="tbtn" data-imp="back">Back</button><button class="tbtn" data-imp="close">Cancel</button><button class="tbtn primary" data-imp="import" id="impGo">Import</button></div></div>';
  return h;
}
/* turn the file into amounts per category per month, using the chosen links */
function imPlan(){
  var rows=IM.rows,c=IM.cols,targets={},order=[],skipped=0,used=0,minYM=null,maxYM=null,mc=imMonthCols(),tcol=c.type===''?-1:+c.type;
  function target(v,sel){
    var key;if(sel.indexOf('i:')===0)key=sel;else key=sel+':'+v.key;
    var t=targets[key];
    if(!t){
      if(sel.indexOf('i:')===0){var it=IM.existing.filter(function(i){return 'i:'+i.id===sel})[0];if(!it)return null;t={key:key,id:it.id,kind:it.kind,name:it.name,isNew:false,months:{},vals:[]}}
      else t={key:key,id:null,kind:sel.slice(2),name:v.raw==='(blank)'?'Imported':v.raw.slice(0,60),isNew:true,months:{},vals:[]};
      targets[key]=t;order.push(t);
    }
    if(t.vals.indexOf(v.key)<0)t.vals.push(v.key);return t;
  }
  function addTo(t,ym,amt){t.months[ym]=(t.months[ym]||0)+amt;if(!minYM||ym<minYM)minYM=ym;if(!maxYM||ym>maxYM)maxYM=ym}
  var g=+(IM.mode==='tx'?c.group:c.cat),byKey={};IM.values.forEach(function(v){byKey[v.key]=v});
  for(var r=IM.hdr+1;r<rows.length;r++){
    var row=rows[r]||[];if(!imNonEmpty(row))continue;
    var raw=row[g];raw=(raw===undefined||raw==='')?'':String(raw).trim();var key=raw.toLowerCase()||'(blank)',v=byKey[key];
    if(IM.mode==='tx'){
      var ym=parseDateYM(row[+c.date],IM.order),a=parseAmt(row[+c.amount]);
      if(!ym||a===null){skipped++;continue}
      var sel=IM.sel[key];if(!v||!sel||sel==='skip')continue;
      var s=IM.dir==='signed'?a:(IM.dir==='posspend'?-a:-Math.abs(a)),t=target(v,sel);if(!t)continue;
      addTo(t,ym,t.kind==='income'?s:-s);used++;
    }else{
      if(!v)continue;var sel2=IM.sel[key];if(!sel2||sel2==='skip')continue;
      var t2=target(v,sel2);if(!t2)continue;var any=false;
      mc.forEach(function(m){var cell=row[m.i];if(cell===''||cell===undefined)return;var a2=parseAmt(cell);if(a2===null)return;addTo(t2,ymStr(m.y,m.m),a2);any=true});
      if(any)used++;else skipped++;
    }
  }
  var clamped=0;
  order.forEach(function(t){var tot=0;Object.keys(t.months).forEach(function(m){var v=Math.round(t.months[m]*100)/100;if(v<0){v=0;clamped++}t.months[m]=v;tot+=v});t.total=tot});
  return {targets:order.filter(function(t){var ks=Object.keys(t.months);return ks.length&&(!t.isNew||ks.some(function(m){return t.months[m]!==0}))}),skipped:skipped,clamped:clamped,used:used,minYM:minYM,maxYM:maxYM};
}
function imSummaryUpdate(){
  var el=$('impSummary');if(!el)return;
  var p=IM.plan=imPlan(),go=$('impGo');
  if(!p.targets.length){el.textContent='Nothing to import yet. Link at least one value to a category, and check the date and amount columns on the previous step.';if(go)go.disabled=true;return}
  var nNew=p.targets.filter(function(t){return t.isNew}).length;
  el.innerHTML='<b>'+p.used+' row'+(p.used===1?'':'s')+'</b> will fill <b>'+p.targets.length+' categor'+(p.targets.length===1?'y':'ies')+'</b> from <b>'+esc(label(p.minYM))+'</b> to <b>'+esc(label(p.maxYM))+'</b>'+(nNew?' ('+nNew+' new)':'')+'.'+(p.skipped?' '+p.skipped+' row'+(p.skipped===1?' was':'s were')+' skipped because the date or amount could not be read.':'')+(p.clamped?' '+p.clamped+' monthly total'+(p.clamped===1?' was':'s were')+' below zero (for example refunds) and will be set to 0.':'')+(state.sample?' You are viewing the sample budget, so this will start your own budget.':'')+
    '<br><span class="status">'+p.targets.slice(0,6).map(function(t){return esc(t.name)+': '+fmt(t.total)}).join(' · ')+(p.targets.length>6?' · …':'')+'</span>';
  if(go)go.disabled=false;
}
function imDoneHTML(){
  var r=IM.result;
  return '<div class="imp"><h2>Import finished</h2><p>Filled <b>'+r.cells+'</b> monthly amount'+(r.cells===1?'':'s')+' in <b>'+r.cats+'</b> categor'+(r.cats===1?'y':'ies')+(r.created?' ('+r.created+' new)':'')+'. Use the month arrows to look through '+esc(label(r.minYM))+' to '+esc(label(r.maxYM))+'.</p><div class="srow"><button class="tbtn" data-imp="undo">Undo this import</button><button class="tbtn primary" data-imp="close">Done</button></div></div>';
}
function imApply(){
  var p=IM.plan;if(!p||!p.targets.length)return;
  var snap=JSON.stringify(state);
  if(state.sample){var keep={currency:state.currency,theme:state.theme,remind:state.remind,collapsed:state.collapsed};state=blank();state.currency=keep.currency;state.theme=keep.theme;state.remind=keep.remind;state.collapsed=keep.collapsed||{}}
  var cells=0,created=0,cats=0,map=state.importMap=state.importMap||{};
  p.targets.forEach(function(t){
    var it=t.isNew?null:state.items.filter(function(i){return i.id===t.id})[0];
    if(!t.isNew&&!it)return;
    if(t.isNew){it={id:uid(),kind:t.kind,name:t.name,usual:0,repeat:false,start:null,over:{},due:0,paid:{}};state.items.push(it);created++}
    var touched=false;
    Object.keys(t.months).forEach(function(ym){
      var now=itemVal(it,ym),nv=IM.replace?t.months[ym]:now+t.months[ym];nv=Math.round(nv*100)/100;
      if(Math.abs(nv-now)<0.005)return;
      it.over[ym]=nv;cells++;touched=true;
    });
    if(touched)cats++;
    t.vals.forEach(function(k){map[k]='i:'+it.id});
  });
  IM.values.forEach(function(v){if(IM.sel[v.key]==='skip')map[v.key]='skip'});
  var keys=Object.keys(map);if(keys.length>300)keys.slice(0,keys.length-300).forEach(function(k){delete map[k]});
  state.sample=false;
  if(p.maxYM)cur=p.maxYM;
  imUndo=snap;save();renderAll();track('import-completed');
  IM.result={cells:cells,cats:cats,created:created,minYM:p.minYM,maxYM:p.maxYM};IM.step=3;imRender();
}
function imUndoNow(){
  if(!imUndo)return;
  try{var s=sane(JSON.parse(imUndo));if(s){state=s;imUndo=null;save();renderAll();setStatus('Import undone')}}catch(e){}
  imClose();
}
document.addEventListener('click',function(ev){
  var x=ev.target.closest&&ev.target.closest('[data-act="xl-xlsx"],[data-act="xl-csv"]');
  if(x){doXlExport(x.getAttribute('data-act')==='xl-xlsx'?'xlsx':'csv');return}
  var b=ev.target.closest&&ev.target.closest('[data-imp]');if(!b)return;
  var a=b.getAttribute('data-imp');
  if(a==='close'){imClose();IM=null}
  else if(a==='back'){IM.step=1;imRender()}
  else if(a==='next'){
    IM.values=imValues();
    if(!IM.values.length){imMsg('No rows with a category were found below the title row.');return}
    if(IM.values.length>200){imMsg('This column has '+IM.values.length+' different values, which is too many to link one by one. Go back and choose a column with fewer values, such as a category column.');IM.step=1;return}
    IM.sel={};IM.step=2;imRender();imSummaryUpdate();
  }
  else if(a==='import'){imApply()}
  else if(a==='undo'){imUndoNow()}
});
document.addEventListener('change',function(ev){
  var e=ev.target;if(!e||!e.getAttribute)return;
  if(e.id==='imp-file'){var f=e.files&&e.files[0];e.value='';imLoadFile(f);return}
  var k=e.getAttribute('data-imp-f');
  if(k&&IM){
    var v=e.value;
    if(k==='sheet'){IM.sheetIdx=+v;xlsxSheet(IM.book,IM.sheetIdx).then(function(rows){IM.rows=rows;IM.hdr=0;imInit()});return}
    if(k==='mode')IM.mode=v;
    else if(k==='hdr'){IM.hdr=Math.max(0,Math.min(IM.rows.length-1,(+v||1)-1));imGuess()}
    else if(k==='order')IM.order=v;
    else if(k==='dir')IM.dir=v;
    else if(k==='year')IM.year=Math.max(2000,Math.min(2100,+v||IM.year));
    else if(k==='replace'){IM.replace=v==='1';return}
    else IM.cols[k]=v;
    imRender();return;
  }
  var mi=e.getAttribute('data-imp-map');
  if(mi!==null&&IM&&IM.values){var val=IM.values[+mi];if(val){IM.sel[val.key]=e.value;imSummaryUpdate()}}
});

