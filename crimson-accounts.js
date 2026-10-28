/** Crimson Intel Accounts v1 — Firebase Auth + private Firestore storage.
 * Load as <script type="module" src="./crimson-accounts.js"></script>
 * after enabling Firebase Auth and Firestore + publishing firestore.rules.
 * Firebase web config identifiers are public. Never put any admin SDK / private key here.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendPasswordResetEmail, signOut
} from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js';

const config = window.CRIMSON_FIREBASE_CONFIG;
const $ = id => document.getElementById(id);
const WATCH_KEY = 'crimson-growth-scout-watchlist-v2';
const REPORT_KEY = 'crimson-project-intel-reports-v1';
const clean = x => JSON.parse(JSON.stringify(x));
const notices = {watchlist:'crimson:watchlist-changed', reports:'crimson:reports-changed'};

// Lock the real application while Firebase checks authentication.
document.body.classList.add('ci-account-locked');
document.getElementById('ciAuthStartup')?.remove();
const style=document.createElement('style');
style.textContent=`
  body.ci-account-locked main {display:none!important}
  #ciAccountGate {position:relative;z-index:10;max-width:510px;margin:24px auto;padding:22px;
    border:1px solid #465071;border-radius:18px;background:#131a2e;color:#f2f3ff;
    font:15px system-ui,Arial,sans-serif}
  #ciAccountGate h2{margin:0 0 8px}#ciAccountGate p{line-height:1.55;color:#bac5e4}
  #ciAccountGate input{width:100%;display:block;margin:7px 0 14px;border-radius:9px;
    border:1px solid #465071;background:#090e20;color:#fff;padding:12px;font:inherit;box-sizing:border-box}
  #ciAccountGate button,#ciAccountBar button{cursor:pointer;border:0;border-radius:9px;padding:10px 14px;
    color:#fff;background:linear-gradient(115deg,#f64b82,#8657ef);font-weight:750}
  #ciAccountGate button.secondary{background:#303955}
  #ciAccountGate button:disabled{opacity:.55;cursor:wait}
  #ciAccountGate .ci-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:12px}
  #ciAccountGate small{display:block;margin-top:12px;color:#bac5e4}
  #ciAccountGate .ci-error{color:#ff929f;min-height:1.4em}
  #ciAccountBar{display:none;max-width:1180px;margin:0 auto;padding:8px 22px;
    color:#bac5e4;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
  body:not(.ci-account-locked) #ciAccountBar{display:flex}
  #ciAccountBar button{background:#303955}
  @media(max-width:550px){#ciAccountGate{margin:12px;padding:14px}#ciAccountBar{padding:8px 13px}}
`;
document.head.append(style);
const bar=document.createElement('div');bar.id='ciAccountBar';
bar.innerHTML='<span id="ciAccountEmail"></span><button id="ciAccountImport" type="button" style="display:none">Import older browser saves</button><button id="ciAccountLogout" type="button">Log out</button>';
const gate=document.createElement('section'); gate.id='ciAccountGate';
gate.innerHTML=`
  <h2>⚔ Crimson Intel Accounts</h2>
  <p>Sign in to access Crimson Intel. Your project watchlist and saved research reports are private to your account and sync across devices.</p>
  <div class="ci-tabs">
    <button type="button" data-mode="login">Log in</button>
    <button type="button" data-mode="signup" class="secondary">Create account</button>
  </div>
  <form id="ciAuthForm">
    <label for="ciAuthEmail">Email address</label>
    <input id="ciAuthEmail" type="email" autocomplete="username" required maxlength="180" placeholder="you@example.com">
    <label for="ciAuthPassword">Password</label>
    <input id="ciAuthPassword" type="password" autocomplete="current-password" required minlength="6" maxlength="120" placeholder="At least 6 characters">
    <button id="ciAuthSubmit" type="submit">Log in</button>
  </form>
  <div class="ci-tabs" style="margin-top:10px">
    <button id="ciAuthReset" type="button" class="secondary">Forgot password?</button>
  </div>
  <p id="ciAuthStatus" class="ci-error" role="status" aria-live="polite">Checking your session…</p>
  <small>No trading guarantees. Your email and password are handled by Firebase Authentication; Crimson Intel does not store your password in Firestore.</small>
`;
document.querySelector('header')?.insertAdjacentElement('afterend',bar);
document.body.append(gate);
let mode='login', app, auth, db, user=null, ready=false, watchlist=[], reports=[], off=[], generation=0;
const authStatus=(s,error=false)=>{const node=$('ciAuthStatus');node.textContent=s;node.style.color=error?'#ff929f':'#bac5e4';};
const notify=type=>window.dispatchEvent(new Event(notices[type]));
function clearAccount(){
  for(const unsubscribe of off)unsubscribe();off=[];user=null;ready=false;watchlist=[];reports=[];
  notify('watchlist');notify('reports');
  $('ciAccountEmail').textContent='';document.body.classList.add('ci-account-locked');
document.getElementById('ciAuthStartup')?.remove();gate.hidden=false;
}
function accountDoc(type){if(!user)throw Error('Please sign in first.');return doc(db,'users',user.uid,'data',type);}
async function write(type,items){
  if(!user||!ready)throw Error('Account data has not loaded yet.');
  if(!Array.isArray(items)||items.length>(type==='watchlist'?75:20))throw Error('Too many saved items.');
  const snapshot=clean(items),uid=user.uid;
  await setDoc(accountDoc(type),{items:snapshot,updatedAt:new Date().toISOString()});
  if(user?.uid!==uid)return;
  if(type==='watchlist')watchlist=snapshot;else reports=snapshot;
  notify(type);
}
window.CrimsonAccounts={
  isReady:()=>Boolean(user&&ready),
  getWatchlist:()=>user&&ready?clean(watchlist):[],
  getReports:()=>user&&ready?clean(reports):[],
  saveWatchlist:items=>write('watchlist',items),
  saveReports:items=>write('reports',items)
};
function selectMode(next){
  mode=next;
  $('ciAuthSubmit').textContent=mode==='signup'?'Create account':'Log in';
  $('ciAuthPassword').autocomplete=mode==='signup'?'new-password':'current-password';
  gate.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('secondary',b.dataset.mode!==next));
  authStatus('');
}
gate.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>selectMode(b.dataset.mode)));
$('ciAuthForm').addEventListener('submit',async event=>{
  event.preventDefault();
  if(!auth)return authStatus('Firebase is not configured yet.',true);
  const email=$('ciAuthEmail').value.trim(),password=$('ciAuthPassword').value;
  const btn=$('ciAuthSubmit');btn.disabled=true;authStatus('Connecting…');
  try{
    if(mode==='signup')await createUserWithEmailAndPassword(auth,email,password);
    else await signInWithEmailAndPassword(auth,email,password);
    $('ciAuthPassword').value='';
  }catch(e){
    const messages={
      'auth/email-already-in-use':'This email already has an account. Select Log in.',
      'auth/invalid-email':'Enter a valid email address.',
      'auth/weak-password':'Choose a stronger password.',
      'auth/invalid-credential':'Incorrect email or password.',
      'auth/too-many-requests':'Too many attempts. Try again later.',
      'auth/operation-not-allowed':'Enable Email/Password in Firebase Authentication settings.'
    };
    authStatus(messages[e.code]||('Sign-in error: '+(e.code||e.message)),true);
  }finally{btn.disabled=false;}
});
$('ciAuthReset').addEventListener('click',async()=>{
  const email=$('ciAuthEmail').value.trim();
  if(!auth)return authStatus('Firebase is not configured yet.',true);
  if(!email)return authStatus('Enter your email address above first.',true);
  try{
    await sendPasswordResetEmail(auth,email);
    authStatus('If an account exists for that email, a reset link will be sent.');
  }catch(e){authStatus('Password reset unavailable: '+(e.code||e.message),true);}
});
$('ciAccountImport').addEventListener('click',async()=>{
  if(!user||!ready)return;
  let oldWatch=[],oldReports=[];
  try{
    const a=JSON.parse(localStorage.getItem(WATCH_KEY)||'[]');
    const b=JSON.parse(localStorage.getItem(REPORT_KEY)||'[]');
    oldWatch=Array.isArray(a)?a:[];oldReports=Array.isArray(b)?b:[];
  }catch(e){alert('Could not read old saved data.');return;}
  if(!oldWatch.length&&!oldReports.length)return;
  if(!window.confirm('Import '+oldWatch.length+' legacy leads and '+oldReports.length+' legacy reports into '+user.email+'? Only import data that belongs to you.'))return;
  const btn=$('ciAccountImport');btn.disabled=true;
  try{
    const leads=[...watchlist,...oldWatch.filter(x=>!watchlist.some(y=>y.id===x.id))].slice(0,75);
    const docs=[...reports,...oldReports.filter(x=>!reports.some(y=>y.id===x.id))].slice(0,20);
    await write('watchlist',leads);await write('reports',docs);
    localStorage.removeItem(WATCH_KEY);localStorage.removeItem(REPORT_KEY);
    btn.style.display='none';alert('Legacy saved items imported into your account.');
  }catch(e){alert('Import failed: '+e.message+' (old browser data was kept).');}finally{btn.disabled=false;}
});
$('ciAccountLogout').addEventListener('click',async()=>{
  if(!auth)return;
  try{await signOut(auth);}catch(e){authStatus('Could not sign out: '+e.message,true);}
});
const completeConfig=config&&['apiKey','authDomain','projectId','appId'].every(k=>
  typeof config[k]==='string'&&config[k]&&!config[k].startsWith('PASTE_'));
if(!completeConfig){
  authStatus('Setup required: add your Firebase web configuration in index.html before the account script.',true);
}else{
  try{
    app=initializeApp(config,'crimson-intel-accounts');auth=getAuth(app);db=getFirestore(app);
    onAuthStateChanged(auth,async nextUser=>{
      const cycle=++generation;
      clearAccount();
      if(!nextUser){authStatus('Log in or create an account to continue.');return;}
      user=nextUser;authStatus('Loading your private watchlist and reports…');
      try{
        const refs=['watchlist','reports'].map(type=>accountDoc(type));
        const initial=await Promise.all(refs.map(ref=>getDoc(ref)));
        if(generation!==cycle)return;
        watchlist=Array.isArray(initial[0].data()?.items)?initial[0].data().items:[];
        reports=Array.isArray(initial[1].data()?.items)?initial[1].data().items:[];
        ready=true;
        $('ciAccountEmail').textContent=nextUser.email||'Signed in';
        try{
          const legacyW=JSON.parse(localStorage.getItem(WATCH_KEY)||'[]');
          const legacyR=JSON.parse(localStorage.getItem(REPORT_KEY)||'[]');
          $('ciAccountImport').style.display=(Array.isArray(legacyW)&&legacyW.length)||(Array.isArray(legacyR)&&legacyR.length)?'inline-block':'none';
        }catch(e){$('ciAccountImport').style.display='none';}
        gate.hidden=true;document.body.classList.remove('ci-account-locked');
        notify('watchlist');notify('reports');
        refs.forEach((ref,i)=>{
          const type=i===0?'watchlist':'reports';
          const unsub=onSnapshot(ref,snap=>{
            if(generation!==cycle)return;
            const items=Array.isArray(snap.data()?.items)?snap.data().items:[];
            if(type==='watchlist')watchlist=items;else reports=items;
            notify(type);
          },e=>{
            console.error('Crimson Intel account sync:',e);
            $('ciAccountEmail').textContent='Sync error: '+e.code;
          });
          off.push(unsub);
        });
      }catch(e){
        console.error('Crimson Intel account load:',e);
        ready=false;document.body.classList.add('ci-account-locked');
document.getElementById('ciAuthStartup')?.remove();gate.hidden=false;
        authStatus('Could not load private data. Check Firestore rules, database setup and authorized domain. '+(e.code||e.message),true);
      }
    },e=>authStatus('Authentication could not initialize: '+(e.code||e.message),true));
  }catch(e){authStatus('Firebase initialization failed: '+e.message,true);}
}
