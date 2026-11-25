'use client';
import TrendPanel from '../../features/trends/panel';
import {exampleTrends} from '../../features/demo/example-data';
import type {TrendRange} from '../../features/trends/model';

const load=async(range:TrendRange)=>exampleTrends(range);
export default function Demo(){return <TrendPanel load={load}/>;}
