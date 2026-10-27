import type {Cosmetic,Quality} from '../../../../packages/game-core/src/types';
export function getPreferences():{cosmetic:Cosmetic;quality:Quality}{try{const p=JSON.parse(localStorage.getItem('ducklab.preferences')??'{}');return {cosmetic:['classic','charcoal','purple','blue'].includes(p.cosmetic)?p.cosmetic:'classic',quality:['auto','high','low'].includes(p.quality)?p.quality:'auto'};}catch{return {cosmetic:'classic',quality:'auto'};}}
export function storePreferences(p:{cosmetic:Cosmetic;quality:Quality}){try{localStorage.setItem('ducklab.preferences',JSON.stringify(p));return true;}catch{return false;}}
export function availableCosmetic(cosmetic:Cosmetic,eligible:boolean):Cosmetic{return ['classic','charcoal'].includes(cosmetic)||eligible?cosmetic:'classic';}
export function download(name:string,blob:Blob){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function localRecordStorage(){try{return window.localStorage;}catch{return {getItem:(_key:string)=>null,setItem:(_key:string,_value:string)=>{throw new Error('Browser storage is unavailable.');}};}}
