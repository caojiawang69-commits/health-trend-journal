import {ArenaPanel} from '../app/arena-panel';
import React from 'react';
import {createRoot} from 'react-dom/client';
import TrendPanel from '../features/trends/panel';
import {exampleTrends} from '../features/demo/example-data';
import type {TrendRange} from '../features/trends/model';
import '../app/globals.css';
const load=async(range:TrendRange)=>exampleTrends(range);
createRoot(document.getElementById('root')!).render(<main className="content demo-page"><header className="heading"><div><h1>健康趋势</h1><p>四年合成记录 · 选择时间范围，展开指标查看偏离个人基线的日期。</p></div></header><TrendPanel load={load}/><ArenaPanel forceDemo/></main>);
