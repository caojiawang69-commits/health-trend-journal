import Dashboard from './dashboard';
import { requireChatGPTUser } from './chatgpt-auth';
export const dynamic = 'force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<{view?:string}>}){
 const {view}=await searchParams;
 const initialView=view==='plan'||view==='settings'||view==='journal'||view==='insights'?view:'trends';
 await requireChatGPTUser(initialView==='trends'?'/':'/?view='+initialView);
 return <Dashboard initialView={initialView}/>;
}
