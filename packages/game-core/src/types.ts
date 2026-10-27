export type TrialState={courseId:string;configId?:string;status:'ready'|'running'|'finished';elapsed:number;raw?:number;penalties?:number;assists?:Array<{kind:string;step:number;seconds:number}>;checkpoint:number;total:number;splits:number[];completed?:Record<string,boolean>;hold?:number;event?:{id:string;message:string;at:number}|null};
export type Cosmetic='classic'|'charcoal'|'purple'|'blue';
export type Quality='auto'|'high'|'low';
export type RunLog={protocol:1;courseId:string;configId:string;ticks:number;events:Array<{step:number;type:string;vx?:number;wz?:number;action?:string;kind?:string}>};
