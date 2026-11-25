import type {PeriodReview} from '../analysis/period';
const labels={week:'周回顾',month:'月回顾',year:'年回顾'};
export function PeriodReports({reports}:{reports:PeriodReview[]}) {
 if(!reports.length)return <p className="muted">聊天里的定期任务完成后，回顾会出现在这里。</p>;
 return <>{reports.map(r=><details className="sleep-details" key={r.end+r.period}>
  <summary>{labels[r.period]} · {r.from} 至 {r.end}</summary>
  <p className="reporttext">{r.body.split(/(https:\/\/[^\s<>()（）]+)/g).map((part,i)=>part.startsWith('https://')?<a key={i} href={part} target="_blank" rel="noreferrer">{part}</a>:part)}</p>
 </details>)}</>;
}
