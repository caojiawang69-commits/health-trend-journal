import {ArenaPanel} from '../app/arena-panel';
import React from 'react';
import {createRoot} from 'react-dom/client';
import TrendPanel from '../features/trends/panel';
import {exampleTrends} from '../features/demo/example-data';
import type {TrendRange} from '../features/trends/model';
import '../app/globals.css';
const load=async(range:TrendRange)=>exampleTrends(range);
const demo = <main className="content demo-page"><header className="heading"><div><h1>健康趋势</h1><p>四年合成记录 · 选择时间范围，展开指标查看偏离个人基线的日期。</p></div></header><TrendPanel load={load}/><ArenaPanel forceDemo/></main>;
const site='https://health-trend-journal.caojiawang69.workers.dev';
function Welcome(){
  return <main className="content demo-page"><section className="card sign-in-card">
    <h1>我的健康空间</h1><p className="muted">连接自己的 Garmin 账号，回看步数和睡眠记录。</p>
    <nav aria-label="账号与演示" style={{display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
      <a className="primary" href={site+'/account/space'}>登录个人空间</a>
      <a href={site+'/account/register'}>创建账号</a>
      <a href="?view=demo#arena">体验公开演示</a>
    </nav></section></main>;
}
const showDemo=new URLSearchParams(location.search).get('view')==='demo'||location.hash==='#arena';
createRoot(document.getElementById('root')!).render(showDemo?demo:<Welcome/>);