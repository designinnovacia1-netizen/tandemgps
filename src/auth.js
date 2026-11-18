// Accounts for the demo build. They live only on this phone until a backend is connected.
import AsyncStorage from '@react-native-async-storage/async-storage';
export const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Not encryption: it only keeps the password from sitting in storage as plain text.
export function scramble(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0}return 'f'+h.toString(16)}
export function checkJoin(f){
 if(!f.user.trim())return 'Enter a user name';
 if(!EMAIL_RE.test(f.email.trim()))return 'Enter a valid email';
 if(!f.country)return 'Select your country';
 if(!f.city.trim())return 'Enter your city';
 if(f.pw.length<6)return 'Password needs at least 6 characters';
 if(f.pw!==f.pw2)return 'Passwords do not match';
 if(!f.terms)return 'Agree to the Terms of Service and Privacy Policy';
 return null}
async function accounts(){try{return JSON.parse(await AsyncStorage.getItem('accounts'))||{}}catch(e){return{}}}
export async function register(f){const a=await accounts(),key=f.email.trim().toLowerCase();if(a[key])return{error:'An account with that email already exists'};
 a[key]={user:f.user.trim(),email:key,country:f.country,city:f.city.trim(),pw:scramble(f.pw),since:new Date().getFullYear()};
 await AsyncStorage.multiSet([['accounts',JSON.stringify(a)],['session',key]]);return{account:a[key]}}
export async function login(email,pw){const a=await accounts(),u=a[email.trim().toLowerCase()];
 if(!u||u.pw!==scramble(pw))return{error:'Email or password is incorrect'};await AsyncStorage.setItem('session',u.email);return{account:u}}
export async function current(){try{const s=await AsyncStorage.getItem('session');if(!s)return null;return (await accounts())[s]||null}catch(e){return null}}
export const logout=()=>AsyncStorage.removeItem('session').catch(()=>{});
