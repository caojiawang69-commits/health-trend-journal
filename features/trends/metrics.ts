import type {HealthMetric} from './model';

export const metrics:Record<HealthMetric,{label:string;unit:string;color:string;decimals?:number}>={
 hrv:{label:'夜间 HRV',unit:'毫秒',color:'#1676ca'},
 sleep:{label:'睡眠时长',unit:'小时',color:'#267bc0',decimals:1},
 sleepScore:{label:'睡眠分数',unit:'分',color:'#1676ca'},
 deep:{label:'深睡',unit:'小时',color:'#224ca5',decimals:1},
 light:{label:'浅睡',unit:'小时',color:'#51a4ec',decimals:1},
 rem:{label:'快速眼动',unit:'小时',color:'#bd43a3',decimals:1},
 awake:{label:'清醒',unit:'小时',color:'#d46a8a',decimals:1},
 resting:{label:'静息心率',unit:'次/分',color:'#d74452'},
 heartMin:{label:'最低心率',unit:'次/分',color:'#267bc0'},
 heartMax:{label:'最高心率',unit:'次/分',color:'#f38647'},
 steps:{label:'步数',unit:'步',color:'#1676ca'},
 stepGoal:{label:'步数目标',unit:'步',color:'#858e9b'},
 distance:{label:'步行距离',unit:'公里',color:'#006f89',decimals:1},
 floors:{label:'上楼层数',unit:'层',color:'#8a651e',decimals:1},
 intensity:{label:'强度活动时间',unit:'分钟',color:'#bf671c',decimals:1},
 calories:{label:'热量消耗',unit:'千卡',color:'#18824a'},
 activeCalories:{label:'活动消耗',unit:'千卡',color:'#cf4e43'},
 restCalories:{label:'静息消耗',unit:'千卡',color:'#267bc0'},
 stress:{label:'压力指数',unit:'分',color:'#ae570b'},
};
export function metricValue(value:number,metric:HealthMetric){
 return value.toLocaleString('zh-CN',{maximumFractionDigits:metrics[metric].decimals??0});
}
