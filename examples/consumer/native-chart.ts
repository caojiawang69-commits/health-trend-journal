import {emptyTrendPoint} from '../../features/trends/model';
import {detectDeviations} from '../../features/analysis/deviations';
import type {Night} from './external-api';

// An external SVG view. The built-in analysis runs without React or Recharts.
export function nativeChart(nights:Night[],from:string){
  const points=nights.map(({date,hrvMs})=>{
    const point=emptyTrendPoint(date);
    if(hrvMs!==null){point.hrv=hrvMs;point.hrvCount=1;point.observed=1;}
    return point;
  });
  const {flags}=detectDeviations(points,from);
  const flagged=new Set(flags.filter(f=>f.metric==='hrv').map(f=>f.date));
  const visible=points.filter(p=>p.date>=from);
  const maximum=Math.max(1,...visible.map(p=>p.hrv??0));
  const circles=visible.flatMap((p,i)=>p.hrv===null?[]:[
    '<circle data-flag="'+flagged.has(p.date)+'" cx="'+(6+i*12)+'" cy="'+(55-50*p.hrv/maximum)+'" r="4" fill="'+(flagged.has(p.date)?'#a54000':'#235fa0')+'"/>'
  ]);
  return {flags,svg:'<svg aria-label="Nightly HRV" viewBox="0 0 '+Math.max(12,12*visible.length)+' 60">'+circles.join('')+'</svg>'};
}
