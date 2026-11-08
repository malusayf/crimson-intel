"use strict";
/* Local encrypted dedicated Solana trading wallet provisioner.
 * Does not connect to any trading engine or expose private material in chat.
 */
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const {spawnSync}=require("node:child_process");
const input=process.stdin,output=process.stdout;
const ABC="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const directory=path.resolve(process.env.BOT_DATA_DIR||path.join(__dirname,".data"));
const keystore=path.join(directory,"bot-wallet.encrypted.json");
const addressFile=path.join(directory,"bot-wallet-address.txt");
function b58(bytes){
 let x=0n;
 for(const b of bytes)x=x*256n+BigInt(b);
 let str="";
 while(x>0n){str=ABC[Number(x%58n)]+str;x/=58n;}
 for(const b of bytes){if(b!==0)break;str="1"+str;}
 return str;
}
function publicKeyFromSeed(seed){
 const der=Buffer.concat([Buffer.from("302e020100300506032b657004220420","hex"),seed]);
 const privateKey=crypto.createPrivateKey({key:der,type:"pkcs8",format:"der"});
 const raw=crypto.createPublicKey(privateKey).export({format:"der",type:"spki"}).subarray(-32);
 return b58(raw);
}
async function hidden(prompt){
 if(!input.isTTY||!output.isTTY)throw Error("A local interactive terminal is required");
 output.write(prompt);
 return new Promise((resolve,reject)=>{
  const prev=input.isRaw;
  let result="";
  input.setRawMode(true);input.resume();
  function cleanup(){input.removeListener("data",receive);input.setRawMode(Boolean(prev));input.pause();}
  function receive(chunk){
   const text=chunk.toString("utf8");
   for(const ch of text){
    if(ch==="\u0003"){cleanup();output.write("\n");reject(Error("Cancelled"));return;}
    if(ch==="\n"||ch==="\r"){cleanup();output.write("\n");resolve(result);return;}
    if(ch==="\u007f"){result=result.slice(0,-1);continue;}
    if(result.length<512&&ch.charCodeAt(0)>=32)result+=ch;
   }
  }
  input.on("data",receive);
 });
}
async function main(){
 const command=String(process.argv[2]||"help");
 if(command==="show-address"){
  if(!fs.existsSync(addressFile))throw Error("Create a local wallet first");
  output.write("Public deposit address: "+fs.readFileSync(addressFile,"utf8"));
  return;
 }
 if(command==="verify"||command==="railway-secret"){
  if(!input.isTTY||!output.isTTY)throw Error("Run verification only in your local interactive terminal");
  const record=JSON.parse(fs.readFileSync(keystore,"utf8"));
  if(record.format!=="CRIMSON_BOT_WALLET_ENCRYPTED_V1")throw Error("Unexpected wallet format");
  const pass=await hidden("Wallet passphrase (hidden): ");
  const salt=Buffer.from(record.scrypt.salt,"base64");
  const iv=Buffer.from(record.aesGcm.iv,"base64");
  const tag=Buffer.from(record.aesGcm.tag,"base64");
  const ciphertext=Buffer.from(record.ciphertext,"base64");
  if(salt.length!==16||iv.length!==12||tag.length!==16||ciphertext.length!==32)
    throw Error("Encrypted wallet appears corrupted");
  const key=crypto.scryptSync(pass,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  let seed;
  try{
   const cipher=crypto.createDecipheriv("aes-256-gcm",key,iv);
   cipher.setAuthTag(tag);
   seed=Buffer.concat([cipher.update(ciphertext),cipher.final()]);
   const calculated=publicKeyFromSeed(seed);
   if(calculated!==record.publicKey)throw Error("Wallet public key mismatch");
   if(command==="railway-secret"){
    if(process.platform!=="darwin")throw Error("Secure clipboard setup currently supports macOS Terminal only");
    output.write("Confirmed dedicated wallet address: "+calculated+"\n");
    const clipboard=spawnSync("pbcopy",[],{input:seed.toString("base64"),timeout:2000});
    if(clipboard.status!==0)throw Error("macOS secure clipboard unavailable");
    output.write("Copied 32-byte dedicated wallet seed to macOS clipboard.\n"+
      "Paste directly into Railway's BOT_SIGNER_SEED_BASE64 secret variable.\n"+
      "Never paste in ChatGPT, GitHub, a website, or a screenshot. Clear clipboard after use.\n");
   }else output.write("PASS: encrypted seed decrypts and matches public address: "+calculated+"\n");
  }catch(e){throw Error("Wallet verification failed: wrong password or corrupted keystore");}
  finally{key.fill(0);if(seed)seed.fill(0);}
  return;
 }
 if(command!=="create"){
  output.write("Crimson local wallet: node bot/wallet-setup.cjs create | verify | show-address | railway-secret\n");
  return;
 }
 if(!input.isTTY||!output.isTTY)throw Error("Run locally in Terminal, not CI or chat");
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 if(fs.existsSync(keystore)||fs.existsSync(addressFile))
  throw Error("Wallet already exists. Refusing to overwrite it.");
 output.write("Creates a separate Solana wallet; this does NOT activate live trading.\n");
 const password=await hidden("New encryption passphrase (minimum 16 characters, hidden): ");
 if(password.length<16)throw Error("Passphrase too short");
 const confirm=await hidden("Confirm passphrase (hidden): ");
 if(password!==confirm)throw Error("Passphrases do not match");
 const seed=crypto.randomBytes(32);
 const address=publicKeyFromSeed(seed);
 const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12);
 const key=crypto.scryptSync(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
 const cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
 const ciphertext=Buffer.concat([cipher.update(seed),cipher.final()]);
 const record={
  format:"CRIMSON_BOT_WALLET_ENCRYPTED_V1",
  publicKey:address,createdAt:new Date().toISOString(),
  scrypt:{salt:salt.toString("base64"),N:16384,r:8,p:1},
  aesGcm:{iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64")},
  ciphertext:ciphertext.toString("base64")
 };
 try{
  fs.writeFileSync(keystore,JSON.stringify(record,null,2)+"\n",{flag:"wx",mode:0o600});
  fs.writeFileSync(addressFile,address+"\n",{flag:"wx",mode:0o600});
 }catch(e){
  try{fs.unlinkSync(keystore);}catch(_){}
  throw e;
 }finally{seed.fill(0);key.fill(0);}
 output.write("Created dedicated wallet locally.\nPUBLIC address: "+address+"\n"+
  "Encrypted keystore stored outside Git. Back up the file AND passphrase securely.\n"+
  "Do NOT fund this address until the execution service and recovery process are tested.\n");
}
main().catch(e=>{process.stderr.write("Setup stopped: "+e.message+"\n");process.exitCode=1;});
