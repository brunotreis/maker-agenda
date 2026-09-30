'use strict';
const D=window.MakerDomain,$=s=>document.querySelector(s);
const labels={pending:'Pendente',approved:'Aprovada',declined:'Não aprovada',cancelled:'Cancelada'};
const state={demo:false,profile:null,requests:[],calendar:[],admins:[],tab:'requests',status:'pending',busy:false,client:null,decision:null};
const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatDate=(value,options={day:'2-digit',month:'short',year:'numeric'})=>new Intl.DateTimeFormat('pt-BR',{timeZone:D.zone,...options}).format(new Date(value));
const formatTime=value=>formatDate(value,{hour:'2-digit',minute:'2-digit'});
function periodLabel(row){return `${formatDate(row.starts_at)} · ${formatTime(row.starts_at)}–${D.dateKey(row.starts_at)!==D.dateKey(row.ends_at)?formatDate(row.ends_at)+' ':''}${formatTime(row.ends_at)}`;}
function toast(message,error=false){$('#toast').textContent=message;$('#toast').classList.toggle('error',error);$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,error?9000:5500);}
function errorText(error){const code=error?.code;if(code==='23P01')return 'A impressora já tem uma reserva nesse período. Atualize a agenda e escolha outro horário.';if(error?.status===429||error?.code==='over_email_send_rate_limit')return 'Aguarde antes de solicitar outro link de acesso.';if(error?.message?.includes('Failed to fetch'))return 'Não foi possível conectar. Verifique sua internet e tente novamente.';return error?.message||'Não foi possível concluir. Tente novamente.';}
async function task(fn){if(state.busy)return;state.busy=true;const buttons=[...document.querySelectorAll('button')].filter(b=>!b.disabled);buttons.forEach(b=>b.disabled=true);try{await fn();}catch(error){toast(errorText(error),true);}finally{state.busy=false;buttons.forEach(b=>b.disabled=false);}}
async function rpc(name,params={}){const {data,error}=await state.client.rpc(name,params);if(error)throw error;return data;}
function demoProfile(){
  const role=$('#demo-role').value;
  if(role==='admin')return {id:'demo-admin',name:'Bruno · demonstração',email:'responsavel@ufob.edu.br',is_admin:true,is_owner:true};
  if(role==='delegate')return {id:'demo-delegate',name:'Gestor · fictício',email:'gestor.ficticio@ufob.edu.br',is_admin:state.demoAdmins.some(a=>a.email==='gestor.ficticio@ufob.edu.br'),is_owner:false};
  return {id:'demo-user',name:'Sofia Almeida · fictício',email:'solicitante@ufob.edu.br',is_admin:false,is_owner:false};
}
function seedDemo(){
  state.demoAdmins=[{email:'gestor.ficticio@ufob.edu.br',name:'Gestor de demonstração',is_owner:false,active:true,created_at:new Date().toISOString()}];
  const base=D.dateKey(Date.now());const day=offset=>{const value=new Date(`${base}T12:00:00-03:00`);value.setUTCDate(value.getUTCDate()+offset);return D.dateKey(value);};
  const make=(id,uid,name,email,title,printer,offset,time,duration,status,hoursAgo,description)=>({id,user_id:uid,name,email,title,description,printer_id:printer,...D.period(day(offset),time,duration),status,reason:'',created_at:new Date(Date.now()-hoursAgo*3600000).toISOString()});
  state.demoRows=[make('demo-001','demo-ana','Ana Costa','ana.ficticia@ufob.edu.br','Suporte para sensor de umidade',1,2,'09:00',3,'pending',28,'Protótipo para fixação de um sensor em bancada. Modelo para avaliação dimensional.'),make('demo-002','demo-caio','Caio Santos','caio.ficticio@ufob.edu.br','Engrenagem para protótipo didático',1,2,'10:00',2,'pending',20,'Peça de teste para um conjunto de transmissão. Período solicitado coincide parcialmente com o primeiro pedido.'),make('demo-003','demo-user','Sofia Almeida','solicitante@ufob.edu.br','Caixa para circuito eletrônico',2,3,'14:00',4,'pending',6,'Invólucro de um circuito de monitoramento. Teste inicial de encaixe dos componentes.'),make('demo-004','demo-joao','João Lima','joao.ficticio@ufob.edu.br','Modelo de estrutura celular',2,1,'09:00',2,'approved',48,'Material de apoio para atividade de ensino.'),make('demo-005','demo-admin','Bruno · demonstração','responsavel@ufob.edu.br','Peça para demonstração em aula',1,1,'14:00',2,'approved',42,'Peça demonstrativa.')];
}
async function refresh(){
  if(state.demo){state.profile=demoProfile();state.requests=state.demoRows.filter(r=>state.profile.is_admin||r.user_id===state.profile.id);state.calendar=state.demoRows.filter(r=>r.status==='approved').map(r=>state.profile.is_admin||r.user_id===state.profile.id?{...r}:{id:r.id,printer_id:r.printer_id,starts_at:r.starts_at,ends_at:r.ends_at,title:'Reservado',name:null,user_id:null});}
  else{const profile=await rpc('maker_profile');const [requests,calendar]=await Promise.all([rpc('maker_requests'),rpc('maker_calendar')]);state.profile=profile;state.requests=requests||[];state.calendar=calendar||[];}
  state.admins=state.profile.is_owner?(state.demo?[{email:'responsavel@ufob.edu.br',name:'Bruno · demonstração',is_owner:true,active:true},...state.demoAdmins]:await rpc('maker_administrators')):[];
  $('#auth-panel').hidden=true;$('#app-content').hidden=false;$('#fatal-error').hidden=true;
  $('#account-label').textContent=state.demo?(state.profile.is_owner?'Responsável principal · demonstração':state.profile.is_admin?'Administrador · demonstração':'Solicitante · demonstração'):state.profile.email;
  $('[data-tab="requests"]').hidden=!state.profile.is_admin;$('[data-tab="admins"]').hidden=!state.profile.is_owner;$('#signout').hidden=state.demo;
  if((state.tab==='requests'&&!state.profile.is_admin)||(state.tab==='admins'&&!state.profile.is_owner))state.tab='mine';
  if(!$('#request-name').value)$('#request-name').value=state.profile.name||'';
  render();
}
function switchTab(tab){if((tab==='requests'&&!state.profile?.is_admin)||(tab==='admins'&&!state.profile?.is_owner))return;state.tab=tab;render();}
function empty(title,message){return `<div class="empty"><strong>${e(title)}</strong><p>${e(message)}</p></div>`;}
function card(row,mine=false){
  const approve=state.profile.is_admin&&!mine&&row.status==='pending';const cancel=row.user_id===state.profile.id&&['pending','approved'].includes(row.status)&&new Date(row.starts_at)>new Date();
  return `<article class="request-card"><div class="card-top"><span class="request-number">PEDIDO ${e(row.id.slice(0,8).toUpperCase())}</span><span class="status ${e(row.status)}">${e(labels[row.status])}</span></div><h3>${e(row.title)}</h3><div class="request-person">${e(row.name)}${state.profile.is_admin?' · '+e(row.email):''}</div><div class="card-meta"><span class="printer-chip"><span class="printer-dot p${Number(row.printer_id)}"></span>Impressora ${Number(row.printer_id)===1?'01':'02'}</span><span>${e(periodLabel(row))}</span></div><p class="description">${e(row.description)}</p>${row.reason?`<div class="reason"><strong>Motivo:</strong> ${e(row.reason)}</div>`:''}<div class="card-bottom"><span class="submitted">Enviado em ${e(formatDate(row.created_at))}, às ${e(formatTime(row.created_at))}</span><div class="card-actions">${approve?`<button class="button small secondary" data-decide="declined" data-id="${e(row.id)}">Não aprovar</button><button class="button small primary" data-decide="approved" data-id="${e(row.id)}">Aprovar</button>`:''}${cancel?`<button class="button small secondary" data-cancel="${e(row.id)}">Cancelar pedido</button>`:''}</div></div></article>`;
}
function render(){
  if(!state.profile)return;
  const meta={requests:['PAINEL DO RESPONSÁVEL','Solicitações','Analise os pedidos na ordem em que chegaram.'],agenda:['AGENDA DO LABORATÓRIO','Programação das impressoras','Reservas aprovadas, organizadas pela data e pelo horário de uso.'],new:['NOVO PEDIDO','Solicitar horário','Conte o que você pretende imprimir e escolha o período de uso.'],mine:['ACOMPANHAMENTO','Meus pedidos','Confira o andamento das suas solicitações.'],admins:['GESTÃO DE ACESSOS','Administradores','Cadastre quem poderá analisar os pedidos do laboratório.']}[state.tab];
  $('#page-eyebrow').textContent=meta[0];$('#page-title').textContent=meta[1];$('#page-description').textContent=meta[2];
  for(const tab of ['requests','agenda','new','mine','admins']){$(`#${tab}-view`).hidden=tab!==state.tab;$(`[data-tab="${tab}"]`).classList.toggle('active',tab===state.tab);}
  $('#new-request').hidden=['new','admins'].includes(state.tab);$('#stats').hidden=['new','admins'].includes(state.tab);
  const pending=state.requests.filter(r=>r.status==='pending').length;
  $('#pending-count').textContent=pending;$('#stat-pending').textContent=String(pending).padStart(2,'0');$('#stat-approved').textContent=String(state.calendar.filter(r=>new Date(r.ends_at)>new Date()).length).padStart(2,'0');
  $('[data-status="pending"]').classList.toggle('selected',state.status==='pending');$('[data-status="all"]').classList.toggle('selected',state.status==='all');
  const requests=D.fifo(state.requests.filter(r=>state.status==='all'||r.status==='pending'));
  $('#requests-list').innerHTML=requests.length?requests.map(r=>card(r)).join(''):empty(state.status==='pending'?'Tudo em dia.':'Nenhuma solicitação.','Os pedidos aparecerão aqui assim que forem enviados.');
  const mine=D.fifo(state.requests.filter(r=>r.user_id===state.profile.id)).reverse();$('#mine-list').innerHTML=mine.length?mine.map(r=>card(r,true)).join(''):empty('Você ainda não enviou pedidos.','Escolha Solicitar horário para cadastrar seu primeiro projeto.');
  renderAgenda();renderAdmins();
}
function renderAgenda(){const filter=$('#agenda-printer').value,from=$('#agenda-from').value;const lower=from?new Date(`${from}T00:00:00-03:00`).getTime():0;const rows=D.chronological(state.calendar.filter(r=>(filter==='all'||String(r.printer_id)===filter)&&new Date(r.ends_at).getTime()>lower));let key='',html='';for(const row of rows){const day=D.dateKey(row.starts_at);if(day!==key){key=day;html+=`<div class="day-heading"><h2>${e(formatDate(row.starts_at,{weekday:'long',day:'2-digit',month:'long',year:'numeric'}))}</h2></div>`;}html+=`<article class="agenda-row ${Number(row.printer_id)===2?'printer2':''}"><div class="time">${e(formatTime(row.starts_at))}–${e(formatTime(row.ends_at))}${D.dateKey(row.starts_at)!==D.dateKey(row.ends_at)?`<small>Termina em ${e(formatDate(row.ends_at))}</small>`:''}</div><div class="printer-chip"><span class="printer-dot p${Number(row.printer_id)}"></span>Impressora ${Number(row.printer_id)===1?'01':'02'}</div><div class="project">${e(row.title||'Reservado')}<small>${row.name?e(row.name):'Horário ocupado'}</small></div></article>`;}$('#agenda-list').innerHTML=html||empty('Nenhuma reserva neste período.','As solicitações aprovadas aparecem aqui. Um espaço livre não significa aprovação automática.');}
function previewEnd(){try{const p=D.period($('#request-date').value,$('#request-time').value,$('#request-duration').value);$('#end-preview').textContent=`Término previsto: ${formatDate(p.ends_at)}, às ${formatTime(p.ends_at)}.`;}catch{$('#end-preview').textContent='';}}
async function decide(id,status,reason=''){
  if(state.demo){if(!state.profile.is_admin)throw new Error('Acesso restrito ao responsável.');const row=state.demoRows.find(r=>r.id===id);if(!row||row.status!=='pending')throw new Error('Este pedido já foi analisado.');if(status==='approved'){if(new Date(row.starts_at)<=new Date())throw new Error('Este horário já passou. Solicite um novo período.');if(state.demoRows.some(other=>other.id!==id&&other.status==='approved'&&D.overlaps(row,other)))throw {code:'23P01'};}row.status=status;row.reason=reason;}
  else await rpc('maker_decide',{p_id:id,p_status:status,p_reason:reason});
  await refresh();toast(status==='approved'?'Pedido aprovado. O horário já está na agenda.':'Pedido não aprovado. O solicitante pode consultar a resposta.');
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));$('#new-request').addEventListener('click',()=>switchTab('new'));$('.brand').addEventListener('click',event=>{event.preventDefault();if(state.profile)switchTab(state.profile.is_admin?'requests':'mine');});
document.querySelectorAll('[data-status]').forEach(b=>b.addEventListener('click',()=>{state.status=b.dataset.status;render();}));document.querySelectorAll('.refresh').forEach(b=>b.addEventListener('click',()=>task(async()=>{await refresh();toast('Dados atualizados.');})));
$('#demo-role').addEventListener('change',()=>task(async()=>{$('#request-name').value='';state.tab=$('#demo-role').value==='user'?'mine':'requests';await refresh();}));
$('#agenda-printer').addEventListener('change',renderAgenda);$('#agenda-from').addEventListener('change',renderAgenda);
['date','time','duration'].forEach(name=>$(`#request-${name}`).addEventListener('input',previewEnd));
$('#request-form').addEventListener('submit',event=>{event.preventDefault();task(async()=>{const name=$('#request-name').value.trim(),title=$('#request-title').value.trim(),description=$('#request-description').value.trim();if(name.length<2||title.length<3||!description)throw new Error('Preencha seu nome, o nome do projeto e a descrição.');const period=D.period($('#request-date').value,$('#request-time').value,$('#request-duration').value);const printer=Number($('#request-printer').value);if(![1,2].includes(printer))throw new Error('Selecione uma impressora.');if(state.demo){state.demoRows.push({id:crypto.randomUUID(),user_id:state.profile.id,name,email:state.profile.email,title,description,printer_id:printer,...period,status:'pending',reason:'',created_at:new Date().toISOString()});}else{await rpc('maker_create_request',{p_name:name,p_title:title,p_description:description,p_printer:printer,p_start:period.starts_at,p_end:period.ends_at});}$('#request-form').reset();$('#request-name').value=name;$('#request-date').min=D.dateKey(Date.now());previewEnd();state.tab='mine';await refresh();toast('Solicitação enviada. Aguarde a análise do responsável.');});});
$('#app-content').addEventListener('click',event=>{const button=event.target.closest('[data-decide],[data-cancel]');if(!button)return;if(button.dataset.cancel){if(!confirm('Cancelar este pedido? Se ele estiver aprovado, o horário será liberado.'))return;task(async()=>{const id=button.dataset.cancel;if(state.demo){const row=state.demoRows.find(r=>r.id===id);if(row.user_id!==state.profile.id)throw new Error('Acesso negado.');row.status='cancelled';}else await rpc('maker_cancel',{p_id:id});await refresh();toast('Pedido cancelado.');});}else if(button.dataset.decide==='approved'){task(async()=>{try{await decide(button.dataset.id,'approved');}catch(error){try{await refresh();}catch{}throw error;}});}else{state.decision=button.dataset.id;$('#decision-project').textContent=state.requests.find(r=>r.id===state.decision)?.title||'';$('#decision-reason').value='';$('#decision-dialog').showModal();}});
$('#close-dialog').addEventListener('click',()=>$('#decision-dialog').close());$('#decision-form').addEventListener('submit',event=>{event.preventDefault();task(async()=>{await decide(state.decision,'declined',$('#decision-reason').value.trim());$('#decision-dialog').close();});});
$('#login-form').addEventListener('submit',event=>{event.preventDefault();task(async()=>{const email=$('#login-email').value.trim().toLowerCase();if(!D.institutional(email))throw new Error('Use um e-mail com o domínio @ufob.edu.br.');const redirect=new URL(window.location.href);redirect.hash='';redirect.search='';const {error}=await state.client.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:redirect.href}});if(error)throw error;$('#login-message').textContent='Link enviado. Abra seu e-mail institucional e clique no link para entrar. Verifique também a pasta de spam.';toast('Confira seu e-mail institucional.');});});
$('#signout').addEventListener('click',()=>task(async()=>{const {error}=await state.client.auth.signOut();if(error)throw error;state.profile=null;state.requests=[];state.calendar=[];state.admins=[];$('#admins-list').replaceChildren();$('#request-form').reset();$('#app-content').hidden=true;$('#auth-panel').hidden=false;$('#signout').hidden=true;$('#account-label').textContent='Acesso institucional';$('#requests-list').replaceChildren();$('#mine-list').replaceChildren();$('#agenda-list').replaceChildren();}));
function loadSdk(){return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js';script.onload=resolve;script.onerror=()=>reject(new Error('Não foi possível carregar o serviço de acesso. Verifique sua conexão.'));document.head.append(script);});}
async function start(){
  $('#agenda-from').value=D.dateKey(Date.now());$('#request-date').min=D.dateKey(Date.now());
  const config=window.MAKER_CONFIG||{};const url=config.supabaseUrl||'',key=config.supabasePublishableKey||'';
  if(!url&&!key){state.demo=true;$('#demo-banner').hidden=false;seedDemo();await refresh();return;}
  if(!url||!key||!/^https:\/\/[^/]+/.test(url)||key.startsWith('sb_secret_'))throw new Error('Configuração incompleta ou inválida. Use a URL do projeto e somente a chave publicável em config.js.');
  if(location.protocol==='file:')throw new Error('O modo conectado deve ser aberto em um site HTTPS ou em um servidor local, não diretamente pelo arquivo.');
  await loadSdk();state.client=window.supabase.createClient(url,key);const {data,error}=await state.client.auth.getSession();if(error)throw error;
  if(data.session){await refresh();state.tab=state.profile.is_admin?'requests':'mine';render();}else{$('#auth-panel').hidden=false;}
  state.client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){state.profile=null;state.requests=[];state.calendar=[];state.admins=[];$('#admins-list').replaceChildren();$('#app-content').hidden=true;$('#auth-panel').hidden=false;$('#signout').hidden=true;$('#requests-list').replaceChildren();$('#mine-list').replaceChildren();$('#agenda-list').replaceChildren();}if(event==='SIGNED_IN'&&session&&!state.profile)setTimeout(()=>task(async()=>{await refresh();state.tab=state.profile.is_admin?'requests':'mine';render();}),0);});
}

function renderAdmins(){
  if(!state.profile?.is_owner){$('#admins-list').replaceChildren();return;}
  $('#admins-list').innerHTML=state.admins.map(a=>`<article class="request-card admin-account"><div><h3>${e(a.name)}</h3><div class="request-person">${e(a.email)}</div><span class="status ${a.active?'approved':'pending'}">${a.is_owner?'Responsável principal':a.active?'Administrador · conta confirmada':'Autorizado · aguardando primeiro acesso'}</span>${!a.active?'<p>A pessoa deve entrar com esse e-mail e confirmar o link recebido.</p>':''}</div>${a.is_owner?'<span class="muted">Acesso protegido</span>':`<button type="button" class="button small secondary" data-remove-admin="${e(a.email)}">Remover acesso</button>`}</article>`).join('');
}
$('#admin-form').addEventListener('submit',event=>{event.preventDefault();task(async()=>{
  if(!state.profile?.is_owner)throw new Error('Somente o responsável principal pode gerenciar administradores.');
  const email=$('#admin-email').value.trim().toLowerCase(),name=$('#admin-name').value.trim();
  if(!D.institutional(email))throw new Error('Use um e-mail @ufob.edu.br.');
  if(name.length<2||name.length>100)throw new Error('Informe o nome do administrador.');
  if(state.demo){
    if(email===state.profile.email)throw new Error('O responsável principal já tem acesso permanente.');
    if(state.demoAdmins.some(a=>a.email===email))throw new Error('Este e-mail já está cadastrado como administrador.');
    state.demoAdmins.push({email,name,is_owner:false,active:false,created_at:new Date().toISOString()});
  }else await rpc('maker_add_administrator',{p_email:email,p_name:name});
  $('#admin-form').reset();await refresh();toast('Administrador cadastrado. Oriente a pessoa a entrar com o e-mail autorizado.');
});});
$('#admins-list').addEventListener('click',event=>{
  const button=event.target.closest('[data-remove-admin]');if(!button)return;const email=button.dataset.removeAdmin;
  if(!confirm(`Remover o acesso de administrador de ${email}? A pessoa continuará podendo solicitar horários.`))return;
  task(async()=>{
    if(!state.profile?.is_owner)throw new Error('Somente o responsável principal pode gerenciar administradores.');
    if(state.demo)state.demoAdmins=state.demoAdmins.filter(a=>a.email!==email);
    else await rpc('maker_remove_administrator',{p_email:email});
    await refresh();toast('Acesso de administrador removido. As reservas existentes foram mantidas.');
  });
});

start().catch(error=>{$('#fatal-error').textContent=errorText(error);$('#fatal-error').hidden=false;$('#app-content').hidden=true;});
