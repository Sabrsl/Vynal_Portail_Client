export default function Pager({page,pageCount,total,onChange,label='messages'}){
  if(pageCount<=1)return null;
  const pages=[];
  for(let i=1;i<=pageCount;i++){
    if(i===1||i===pageCount||Math.abs(i-page)<=1)pages.push(i);
    else if(pages[pages.length-1]!=='…')pages.push('…');
  }
  return <div className="msg-pager">
    <button type="button" className="ghost" disabled={page<=1} onClick={()=>onChange(page-1)}>‹ Précédent</button>
    <div className="pager-pages">{pages.map((p,i)=>p==='…'?<span key={`e${i}`}>…</span>:<button key={p} type="button" className={p===page?'on':''} onClick={()=>onChange(p)}>{p}</button>)}</div>
    <button type="button" className="ghost" disabled={page>=pageCount} onClick={()=>onChange(page+1)}>Suivant ›</button>
    <span className="pager-info">{total} {label}{total>1?'s':''}</span>
  </div>;
}
