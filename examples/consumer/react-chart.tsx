import {createRoot} from 'react-dom/client';
import MetricCard from '../../features/trends/metric-card';
import type {MetricSeries} from '../../features/trends/model';

export async function mount(container:HTMLElement){
  const response=await fetch('/study/series');
  if(!response.ok)throw new Error('Study series unavailable');
  const series:MetricSeries=await response.json();
  createRoot(container).render(<MetricCard metric="hrv" payload={series}
    baselineDescription="此前三个有效夜晚的中位数" />);
}
