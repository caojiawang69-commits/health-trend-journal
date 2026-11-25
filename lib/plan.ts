export type Mode='high'|'medium'|'low';
export type Macro={carbs:number;protein:number;fat:number};
export type Targets={high:Macro;medium:Macro;low:Macro;ratios:{rice:number;noodle:number}};
export const modeNames:Record<Mode,{label:string;name:string}>={high:{label:'高碳日',name:'高强度训练'},medium:{label:'中碳日',name:'上肢或常规力量，或 45 分钟以上中等有氧'},low:{label:'低碳日',name:'休息 / 轻活动'}};
// Initial targets are unset until the owner edits them.
export const defaultTargets:Targets={high:{carbs:0,protein:0,fat:0},medium:{carbs:0,protein:0,fat:0},low:{carbs:0,protein:0,fat:0},ratios:{rice:3,noodle:3}};
export const kcal=(m:Macro)=>Math.round(m.carbs*4+m.protein*4+m.fat*9);
const num=(x:unknown,max:number,min=0)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
const validMacro=(m:any)=>!!m&&num(m.carbs,700)&&num(m.protein,400)&&num(m.fat,300);
export function validTargets(t:any):t is Targets{return !!t&&validMacro(t.high)&&validMacro(t.medium)&&validMacro(t.low)&&!!t.ratios&&num(t.ratios.rice,5,1.5)&&num(t.ratios.noodle,5,1.5);}

// 每 100 克（牛奶为 100 毫升，鸡蛋为每个）在所标口径下的营养素，参考《中国食物成分表》与 USDA 常见值，品牌差异以标签为准
type Kind='meat'|'rice'|'noodle'|'none';
export type Food={id:string;name:string;group:'protein'|'carb'|'dairy'|'fruit'|'legume';unit:'克'|'毫升'|'个';kind:Kind;per:Macro;tip?:string};
export const foods:Food[]=[
 {id:'protein_powder',name:'蛋白粉（75%蛋白质）',group:'dairy',unit:'克',kind:'none',per:{protein:75,carbs:0,fat:0},tip:'按粉末重量计算：32克含24克蛋白质。碳水和脂肪未提供，暂不计入；不代表实际为零。'},
 {id:'beef_lean',name:'牛肉（瘦：牛腱、里脊）',group:'protein',unit:'克',kind:'meat',per:{protein:21,carbs:0,fat:4}},
 {id:'beef_fatty',name:'牛肉（肥瘦：牛腩、肥牛卷）',group:'protein',unit:'克',kind:'meat',per:{protein:17,carbs:0,fat:20},tip:'肥牛卷脂肪差异很大，以包装为准'},
 {id:'chicken_breast',name:'鸡胸肉（去皮）',group:'protein',unit:'克',kind:'meat',per:{protein:23,carbs:0,fat:2}},
 {id:'chicken_thigh',name:'鸡腿肉（去皮）',group:'protein',unit:'克',kind:'meat',per:{protein:19,carbs:0,fat:6}},
 {id:'pork_lean',name:'猪瘦肉 / 里脊',group:'protein',unit:'克',kind:'meat',per:{protein:20,carbs:0,fat:5}},
 {id:'pork_fatty',name:'猪肉（肥瘦 / 五花）',group:'protein',unit:'克',kind:'meat',per:{protein:9,carbs:0,fat:35}},
 {id:'egg',name:'鸡蛋',group:'protein',unit:'个',kind:'none',per:{protein:6.5,carbs:0.4,fat:5},tip:'按中等大小一个约 50 克可食部分'},
 {id:'rice',name:'米饭（白米）',group:'carb',unit:'克',kind:'rice',per:{protein:7.5,carbs:77,fat:0.6}},
 {id:'noodle_dry',name:'挂面 / 干面条',group:'carb',unit:'克',kind:'noodle',per:{protein:10.5,carbs:75,fat:0.6}},
 {id:'noodle_fresh',name:'鲜湿面（未煮）',group:'carb',unit:'克',kind:'none',per:{protein:8.5,carbs:58,fat:1},tip:'只按未煮的重量计算'},
 {id:'milk',name:'全脂牛奶',group:'dairy',unit:'毫升',kind:'none',per:{protein:3.2,carbs:4.8,fat:3.6}},
 {id:'milk_skim',name:'脱脂 / 低脂牛奶',group:'dairy',unit:'毫升',kind:'none',per:{protein:3.4,carbs:5,fat:0.5}},
 {id:'greek_yogurt',name:'希腊酸奶（无糖）',group:'dairy',unit:'克',kind:'none',per:{protein:9,carbs:5,fat:2},tip:'品牌差异大，可用“其他”按标签录入'},
 {id:'potato',name:'土豆（生）',group:'carb',unit:'克',kind:'none',per:{protein:2,carbs:17,fat:0.1}},
 {id:'sweet_potato',name:'红薯（生）',group:'carb',unit:'克',kind:'none',per:{protein:1.6,carbs:20,fat:0.1}},
 {id:'corn',name:'玉米（鲜，可食部分）',group:'carb',unit:'克',kind:'none',per:{protein:3.3,carbs:19,fat:1.2}},
 {id:'banana',name:'香蕉（去皮）',group:'fruit',unit:'克',kind:'none',per:{protein:1.1,carbs:22,fat:0.3}},
 {id:'apple',name:'苹果',group:'fruit',unit:'克',kind:'none',per:{protein:0.3,carbs:13,fat:0.2}},
 {id:'oats',name:'燕麦片（干）',group:'carb',unit:'克',kind:'none',per:{protein:13,carbs:68,fat:6.5}},
 {id:'brown_rice',name:'糙米饭（熟）',group:'carb',unit:'克',kind:'none',per:{protein:2.7,carbs:26,fat:1}},
 {id:'quinoa',name:'藜麦（熟）',group:'carb',unit:'克',kind:'none',per:{protein:4.4,carbs:21.3,fat:1.9}},
 {id:'pasta',name:'意大利面（熟，无酱）',group:'carb',unit:'克',kind:'none',per:{protein:5.8,carbs:31,fat:0.9}},
 {id:'whole_wheat_bread',name:'全麦面包',group:'carb',unit:'克',kind:'none',per:{protein:12,carbs:43,fat:3.5}},
 {id:'boiled_potato',name:'土豆（水煮）',group:'carb',unit:'克',kind:'none',per:{protein:1.9,carbs:20,fat:0.1}},
 {id:'cooked_sweet_potato',name:'红薯（蒸煮）',group:'carb',unit:'克',kind:'none',per:{protein:1.4,carbs:18,fat:0.2}},
 {id:'salmon',name:'三文鱼（熟，无额外用油）',group:'protein',unit:'克',kind:'none',per:{protein:22,carbs:0,fat:12}},
 {id:'shrimp',name:'虾仁（熟）',group:'protein',unit:'克',kind:'none',per:{protein:24,carbs:0.2,fat:0.3}},
 {id:'tuna',name:'水浸金枪鱼罐头（沥干）',group:'protein',unit:'克',kind:'none',per:{protein:25.5,carbs:0,fat:0.8}},
 {id:'cod',name:'鳕鱼（熟，无额外用油）',group:'protein',unit:'克',kind:'none',per:{protein:23,carbs:0,fat:0.9}},
 {id:'tofu',name:'硬豆腐 / 北豆腐',group:'legume',unit:'克',kind:'none',per:{protein:12,carbs:3,fat:7},tip:'不同品牌含水量差异较大，以包装为准'},
 {id:'edamame',name:'毛豆仁（熟，去荚）',group:'legume',unit:'克',kind:'none',per:{protein:11.9,carbs:8.9,fat:5.2}},
 {id:'lentils',name:'小扁豆（熟）',group:'legume',unit:'克',kind:'none',per:{protein:9,carbs:20.1,fat:0.4}},
 {id:'chickpeas',name:'鹰嘴豆（熟）',group:'legume',unit:'克',kind:'none',per:{protein:8.9,carbs:27.4,fat:2.6}},
 {id:'black_beans',name:'黑豆（熟）',group:'legume',unit:'克',kind:'none',per:{protein:8.9,carbs:23.7,fat:0.5}},
 {id:'orange',name:'橙子（去皮）',group:'fruit',unit:'克',kind:'none',per:{protein:0.9,carbs:11.8,fat:0.1}},
];
export const foodById=(id:string)=>foods.find(f=>f.id===id);
export const MEAT_YIELD=0.72;// 肉类熟后约剩 72% 重量
export type State='raw'|'cooked';
export const hasCooked=(f:Food)=>f.kind!=='none';
export function stateLabel(f:Food,s:State){return f.kind==='meat'?(s==='raw'?'生重':'熟重'):f.kind==='none'?'':(s==='raw'?'生米 / 干面':'煮熟后');}
// 每单位（克 / 毫升 / 个）对应的营养素
export function perUnit(f:Food,s:State,t:Targets):Macro{
 const div=f.kind==='none'||s==='raw'?1:f.kind==='meat'?MEAT_YIELD:f.kind==='rice'?t.ratios.rice:t.ratios.noodle;
 const scale=(f.unit==='个'?1:0.01)/div;
 return {protein:f.per.protein*scale,carbs:f.per.carbs*scale,fat:f.per.fat*scale};
}
export type Custom={name:string}&Macro;
export type Entry={id:string;meal:string;food:string;state:State;amount:number;custom?:Custom;proteinPercent?:number;src?:string};
export const meals=['早餐','午餐','晚餐','加餐'];
export function entryMacro(e:Entry,t:Targets):Macro{
 if(e.food==='custom'&&e.custom)return {protein:e.custom.protein*e.amount/100,carbs:e.custom.carbs*e.amount/100,fat:e.custom.fat*e.amount/100};
 const f=foodById(e.food);if(!f)return {protein:0,carbs:0,fat:0};
 const u=perUnit(f,e.state,t);return {protein:(e.food==='protein_powder'&&e.proteinPercent!==undefined?e.proteinPercent/100:u.protein)*e.amount,carbs:u.carbs*e.amount,fat:u.fat*e.amount};
}
export function sum(list:Macro[]):Macro{return list.reduce((a,m)=>({protein:a.protein+m.protein,carbs:a.carbs+m.carbs,fat:a.fat+m.fat}),{protein:0,carbs:0,fat:0});}
function validEntry(e:any):e is Entry{
 if(!e||typeof e.id!=='string'||e.id.length>40||(e.src!==undefined&&(typeof e.src!=='string'||e.src.length>64))||!meals.includes(e.meal)||!['raw','cooked'].includes(e.state)||!num(e.amount,5000,0.1))return false;
 if(e.proteinPercent!==undefined&&(e.food!=='protein_powder'||!num(e.proteinPercent,100,0.1)))return false;
 if(e.food==='custom')return !!e.custom&&typeof e.custom.name==='string'&&e.custom.name.length<=40&&num(e.custom.protein,100)&&num(e.custom.carbs,100)&&num(e.custom.fat,100);
 return !!foodById(e.food);
}

export type DayPlan={mode:Mode;focus:string;status:'planned'|'completed';note:string;weight:number|null;waist:number|null;foods:Entry[];updated?:string};
export function validDate(s:unknown):s is string{return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
export function validPlan(p:any):p is DayPlan{return !!p&&Object.hasOwn(modeNames,p.mode)&&['planned','completed'].includes(p.status)&&typeof p.focus==='string'&&p.focus.length<=100&&typeof p.note==='string'&&p.note.length<=2000&&[p.weight,p.waist].every(x=>x===null||(typeof x==='number'&&Number.isFinite(x)&&x>0&&x<=400))&&(p.foods===undefined||(Array.isArray(p.foods)&&p.foods.length<=80&&p.foods.every(validEntry)));}
export function defaultPlan(_date:string):DayPlan{return {mode:'medium',focus:'',status:'planned',note:'',weight:null,waist:null,foods:[]};}
// 旧记录没有 foods 字段
export const normalizePlan=(p:any):DayPlan=>({...p,foods:Array.isArray(p?.foods)?p.foods:[]});

// 餐食估算：AI 看照片 / 按备注文字识别，结果需用户确认后才计入
export type EstItem={food:string;state:State;amount:number;low:number|null;high:number|null;basis:'note'|'photo';custom?:Custom};
export type Estimate={items:EstItem[];comment:string;at:string;photos:number;mode:'ai'|'text'};
export function cleanItems(list:unknown):EstItem[]{
 return (Array.isArray(list)?list:[]).map((it:any)=>{
  const custom=it?.food==='custom'&&it.custom&&typeof it.custom.name==='string'?{name:String(it.custom.name).slice(0,40),protein:+it.custom.protein||0,carbs:+it.custom.carbs||0,fat:+it.custom.fat||0}:undefined;
  const f=foodById(it?.food);if(!f&&!custom)return null;
  const amount=Number(it.amount);if(!Number.isFinite(amount)||amount<0||amount>5000)return null;
  const state:State=f&&hasCooked(f)?(it.state==='raw'?'raw':'cooked'):'raw';
  const r=(x:unknown)=>Number(x)>0?Math.round(Number(x)*10)/10:null;
  return {food:custom?'custom':f!.id,state,amount:Math.round(amount*10)/10,low:r(it.low),high:r(it.high),basis:it.basis==='note'?'note':'photo',...(custom?{custom}:{})} as EstItem;
 }).filter((x):x is EstItem=>!!x).slice(0,20);
}
const CN:Record<string,number>={'一':1,'两':2,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10,'半':0.5};
const RULES:[RegExp,string][]=[[/蛋白粉/,'protein_powder'],[/燕麦/,'oats'],[/糙米饭|熟糙米/,'brown_rice'],[/藜麦饭|熟藜麦/,'quinoa'],[/意大利面|意面/,'pasta'],[/全麦面包/,'whole_wheat_bread'],[/熟土豆|水煮土豆/,'boiled_potato'],[/熟红薯|蒸红薯|煮红薯/,'cooked_sweet_potato'],[/三文鱼/,'salmon'],[/鳕鱼/,'cod'],[/虾仁|熟虾/,'shrimp'],[/金枪鱼罐头/,'tuna'],[/北豆腐|硬豆腐/,'tofu'],[/毛豆仁|熟毛豆/,'edamame'],[/熟(?:小)?扁豆|扁豆泥/,'lentils'],[/熟鹰嘴豆/,'chickpeas'],[/熟黑豆/,'black_beans'],[/橙子/,'orange'],[/牛腩|肥牛/,'beef_fatty'],[/牛/,'beef_lean'],[/鸡腿/,'chicken_thigh'],[/鸡胸|鸡肉/,'chicken_breast'],[/五花|肥肉/,'pork_fatty'],[/猪|里脊|瘦肉/,'pork_lean'],[/蛋/,'egg'],[/脱脂|低脂奶/,'milk_skim'],[/酸奶/,'greek_yogurt'],[/奶/,'milk'],[/鲜面|湿面/,'noodle_fresh'],[/面/,'noodle_dry'],[/米|饭/,'rice'],[/红薯|地瓜/,'sweet_potato'],[/土豆|马铃薯/,'potato'],[/玉米/,'corn'],[/香蕉/,'banana'],[/苹果/,'apple']];
// 按备注识别，例如“米饭200g，鸡胸150克，两个鸡蛋”；没写重量的 amount 为 0，由用户补
export function parseNote(text:string):EstItem[]{
 const out:EstItem[]=[];
 for(const part of String(text||'').split(/[，,；;、\s。+＋和及]/)){
  const s=part.trim();const rule=s&&RULES.find(([re])=>re.test(s));if(!rule)continue;
  const f=foodById(rule[1])!;if(/生|未煮|干重/.test(s)&&['brown_rice','quinoa','pasta','boiled_potato','cooked_sweet_potato','salmon','shrimp','cod','edamame','lentils','chickpeas','black_beans'].includes(f.id))continue;let amount=0;const m=s.match(/(\d+(?:\.\d+)?)/);
  if(m)amount=Number(m[1]);else if(f.unit==='个'){const c=s.match(/([一两二三四五六七八九十半])\s*[个只]/);if(c)amount=CN[c[1]];}
  const state:State=f.kind==='meat'?(/生/.test(s)?'raw':'cooked'):f.kind==='none'?'raw':(/生米|大米|干米|干面|挂面|生/.test(s)?'raw':'cooked');
  out.push({food:f.id,state,amount,low:null,high:null,basis:'note'});
 }
 return out;
}
export const FOOD_TABLE=foods.map(f=>`${f.id}|${f.name}${f.id==='protein_powder'?'（碳水和脂肪未知，暂不计入）':''}|单位:${f.unit}|${hasCooked(f)?'需填 raw 或 cooked':'填 raw'}|每${f.unit==='个'?'个':'100'+f.unit} 蛋白${f.per.protein} 碳水${f.per.carbs} 脂肪${f.per.fat}`).join('\n');
