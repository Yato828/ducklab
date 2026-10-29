import {useEffect,useState} from 'react';
import {COURSE} from '../../../../packages/game-core/src/course.js';import {GAMEPLAY_CONFIG} from '../../../../packages/game-core/src/version.js';import type {RunLog} from '../../../../packages/game-core/src/types';
export type Entry={id:string;nickname:string;milliseconds:number;rank:number;status:'verified';courseId:string;configId:string;verifiedAt:string};
export type Board={courseId:string;configId:string;worldBest:Entry|null;entries:Entry[]};
export type Submission={id:string;status:'queued'|'verifying'|'verified'|'rejected';error?:string;milliseconds?:number;rank?:number;newWorldBest?:boolean};
const base=(import.meta.env.VITE_LEADERBOARD_API_URL||'/api').replace(/\/$/,'');
async function request<T>(path:string,options:RequestInit={}):Promise<T>{const response=await fetch(base+path,{...options,signal:AbortSignal.timeout(12000)});let body;try{body=await response.json();}catch{throw new Error('Leaderboard is not connected. Your personal best is saved on this device.');}if(!response.ok)throw new Error(body.error||'Leaderboard unavailable.');return body;}
export async function loadLeaderboard(){const board=await request<Board>('/leaderboard');if(board.courseId!==COURSE.id||board.configId!==GAMEPLAY_CONFIG||!Array.isArray(board.entries))throw new Error('The leaderboard is running a different course configuration.');return board;}
export function submitRun(nickname:string,run:RunLog){return request<Submission>('/runs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nickname,run})});}
export function runStatus(id:string){return request<Submission>('/runs/'+encodeURIComponent(id));}
export function useLeaderboard(){const [board,setBoard]=useState<Board|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);useEffect(()=>{let live=true;const refresh=()=>loadLeaderboard().then(b=>{if(live){setBoard(b);setError('');}}).catch(e=>{if(live)setError(e.message);}).finally(()=>{if(live)setLoading(false);});refresh();const timer=setInterval(()=>{if(!document.hidden)refresh();},30000);return()=>{live=false;clearInterval(timer);};},[]);return {board,error,loading};}
