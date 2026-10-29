import { createContext, useContext, useState, type ReactNode } from 'react';
import {project} from '../lib/project';
import { ArrowUpRight, Check, X, AlertCircle } from 'lucide-react';
const NoticeContext = createContext<(message: string, error?: boolean) => void>(() => {});
export const useNotice = () => useContext(NoticeContext);
export function NoticeProvider({children}:{children:ReactNode}) {
  const [notice, setNotice] = useState<{message:string;error:boolean}|null>(null);
  return <NoticeContext.Provider value={(message,error=false) => {setNotice({message,error}); window.setTimeout(()=>setNotice(null),6000);}}>{children}{notice && <div className={`toast ${notice.error?'error':''}`} role="status">{notice.error?<AlertCircle size={18}/>:<Check size={18}/>}<span>{notice.message}</span><button onClick={()=>setNotice(null)} aria-label="Dismiss notification"><X size={16}/></button></div>}</NoticeContext.Provider>;
}
export function Brand({small=false}:{small?:boolean}) { return <a href="/" className={`brand ${small?'small':''}`} aria-label="DuckLab home"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 5h13l9 8v7L16 29H5V5Z"/><circle cx="19" cy="12" r="2" className="brand-eye"/><path d="M25 13h6v5h-6z"/></svg><span>{project.name}</span></a>; }
export function PageHeading({eyebrow,title,children,action}:{eyebrow:string;title:string;children?:ReactNode;action?:ReactNode}) {return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{children&&<p>{children}</p>}</div>{action}</div>;}
export function EmptyState({icon,title,children,action}:{icon:ReactNode;title:string;children:ReactNode;action?:ReactNode}) { return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{children}</p>{action}</div>; }
export function LinkButton({href,children,secondary=false}:{href:string;children:ReactNode;secondary?:boolean}) {return <a className={`button ${secondary?'secondary':''}`} href={href}>{children}<ArrowUpRight size={16}/></a>;}
export function Footer(){return <footer><Brand small/><p>Small robot. Big little adventures.</p><div><a href="/customize">Customize</a><a href="/about#licenses">Licenses & attribution</a><a href="/about#privacy">Privacy</a><a href="/about#terms">Terms</a><a href="https://github.com/pollen-robotics/microduck" target="_blank" rel="noreferrer">Microduck ↗</a></div><span className="mono">REAL PHYSICS · SOLANA · ${project.symbol}</span></footer>;}
