import {useEffect,useRef,useState} from 'react';
import {AlertTriangle,Move3D,RotateCcw} from 'lucide-react';
import {createSimulation,type Simulation,type SimulationDiagnostics,type SimulationOptions} from '../../../../packages/simulation-core/src/index';
export type {Simulation,SimulationDiagnostics};
export function SimulationViewport({preview=false,mode='playground',onReady,onDiagnostics,onTrial,cosmetic='classic',quality='auto',className=''}:SimulationOptions&{onReady?:(simulation:Simulation|null)=>void;className?:string}){
 const host=useRef<HTMLDivElement>(null),instance=useRef<Simulation|null>(null),callbacks=useRef({onReady,onDiagnostics,onTrial});callbacks.current={onReady,onDiagnostics,onTrial};
 const [progress,setProgress]=useState({completed:0,total:1,label:'Preparing your duck'}),[ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{if(!host.current)return;const abort=new AbortController();setError('');setReady(false);
 createSimulation(host.current,{preview,mode,cosmetic,quality,signal:abort.signal,onProgress:setProgress,onDiagnostics:d=>callbacks.current.onDiagnostics?.(d),onTrial:s=>callbacks.current.onTrial?.(s)}).then(result=>{if(abort.signal.aborted){result.dispose();return;}instance.current=result;setReady(true);callbacks.current.onReady?.(result);}).catch(e=>{if(!abort.signal.aborted)setError((e as Error).message);});return()=>{abort.abort();instance.current?.dispose();instance.current=null;callbacks.current.onReady?.(null);};
 // Cosmetic/quality changes only touch rendering; they must never reset physics.
 },[preview,mode,attempt]);
 useEffect(()=>{instance.current?.setCosmetic(cosmetic);},[cosmetic,ready]);useEffect(()=>{instance.current?.setQuality(quality);},[quality,ready]);
 return <div className={`simulation-viewport ${className}`} data-ready={ready}><div className="simulation-canvas" ref={host} aria-label={preview?'Interactive original Microduck model':'MuJoCo Microduck physics simulation'}/>{!ready&&!error&&<div className="sim-loading"><span className="loader-ring"/><div className="eyebrow">A SMALL ROBOT IS WAKING UP</div><strong>{progress.label}</strong><div className="progress-track"><span style={{width:`${Math.min(100,progress.completed/Math.max(1,progress.total)*100)}%`}}/></div><span className="mono">{progress.completed} / {progress.total} ASSETS</span></div>}{error&&<div className="sim-error"><AlertTriangle size={24}/><h3>Your duck needs a moment.</h3><p>{error}</p><button className="button secondary" onClick={()=>setAttempt(v=>v+1)}><RotateCcw size={15}/>Try loading again</button></div>}{ready&&preview&&<div className="orbit-hint"><Move3D size={14}/>Drag to explore · Scroll to zoom</div>}</div>;
}
