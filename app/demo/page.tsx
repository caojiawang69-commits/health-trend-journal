import {ArenaPanel} from '../arena-panel';
import Demo from './demo';

export default function Page(){
 return <main className="content demo-page">
  <section className="heading"><div><p className="eyebrow">DEMO</p><h1>四年趋势演示</h1><p className="subtitle">这里的记录完全由程序生成，用来体验多年的曲线。不包含任何人的健康数据。</p></div><a className="primary" href="/">返回我的记录</a></section>
  <Demo/><ArenaPanel forceDemo/>
 </main>;
}
