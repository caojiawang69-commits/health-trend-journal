export default function SignInCard({href,title='登录你的健康空间',description='登录后查看你的私人记录。',button='登录'}:{href:string;title?:string;description?:string;button?:string}){
 return <section className="card sign-in-card" aria-labelledby="sign-in-title">
  <h1 id="sign-in-title">{title}</h1>
  <p className="muted">{description}</p>
  <a className="primary" href={href} target="_top">{button}</a>
 </section>;
}
