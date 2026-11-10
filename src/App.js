import React,{useEffect,useRef,useState} from 'react';
import {View,Image,Pressable,Text,TextInput,ScrollView,StatusBar,BackHandler,Linking,PermissionsAndroid,Platform,ToastAndroid,useWindowDimensions,Animated} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import MapLibreGL from '@maplibre/maplibre-react-native';
import {ART,MAN,MAPRECTS,DASHRINGS,CARDS,LSS_GRID} from './art';
import {addFix,bandOf,barFraction,bearing,distance,fixSpeed,fmtTime,nextMotion,styleForApp,DEF,RB,MPH_PER_MS,KPH_PER_MPH} from './logic';

const GEO={
 trackmode:{bar:[26.7,685.7,351.3,10],pill:[170,158,60,24],dash:[15,555,376,52],row:{x:78,y:713,step:64},scaleY:663,pillTxt:'#FFFFFF'},
 maplink_motion:{bar:[29,660.3,351,9.7],pill:[168,133,60,24],dash:[46,534,322,45],row:{x:90,y:698,step:64},scaleY:638,pillTxt:'#FFFFFF'},
 maplink_default:{bar:[25.7,706.7,351,10],pill:[166,153,60,24],dash:[42,556,322,45],row:{x:94,y:742,step:64},scaleY:684.5,pillTxt:'#88FA4E'},
 streetmode:{bar:[19.7,708.3,351.3,10],pill:[162,162,60,24],dash:[13,567,377,53],scaleY:686,pillTxt:'#FFFFFF'},
};
const LOCK={manage_rides:1,shared_ride:1,create_group:1,manage_groups:1,group_page:1,create_lss:1,prompt1:1,prompt2:1,file_share:1};
const POSTED_LIMIT=65;
const SEED_RIDES=[{id:'better',name:'Better Riding',letter:'B',c:'#FF42A1',bands:DEF,art:1},{id:'sport',name:'SportRide',letter:'S',c:'#88FA4E',bands:DEF,art:1},{id:'lake',name:'Lake',letter:'L',c:'#56C1FF',bands:DEF,art:1},{id:'devoted',name:'Devoted',letter:'D',c:'#FFFB00',bands:DEF,art:1},{id:'biker',name:'Biker Bomb',letter:'B',c:'#FF2F92',bands:DEF,art:1,faded:1}];
const SEED_PINS=[{id:'a',letter:'A',c:'#FF42A1',name:'A',bands:DEF},{id:'sport',letter:'S',c:'#56C1FF',name:'SportRide',bands:DEF},{id:'devoted',letter:'D',c:'#FFFB00',name:'Devoted',bands:DEF},{id:'f',letter:'F',c:'#88FA4E',name:'F',bands:DEF},{id:'g',letter:'G',c:'#EE220C',name:'G',bands:DEF}];
const G0=[{n:'Group one',a:'Owner since October 2025',b:'12 Members',av:0},{n:'Group two',a:'Owner since August 2025',b:'10 Members',av:0},{n:'Group three',a:'Member since July 2025',b:'10 Members',av:1},{n:'Group four',a:'Member since July 2025',b:'10 Members',av:1},{n:'Group Five',a:'Owner since May 2025',b:'12 Members',av:0}];
const M0=[{n:'BILLY BOB',a:'Member since October 2025',b:'12 Members',av:0},{n:'JEFF BOB',a:'Member since August 2025',b:'10 Members',av:0},{n:'GRACE G',a:'Member since July 2025',b:'10 Members',av:1},{n:'ATOMIK G',a:'Member since July 2025',b:'10 Members',av:1},{n:'TONY BOB',a:'Member since May 2025',b:'12 Members',av:0}];

const st={screen:'profile',hist:[],rides:SEED_RIDES,pinned:SEED_PINS,active:SEED_PINS[1],mode:'trackmode',speed:0,target:0,top:0,dur:0,started:false,moving:false,paused:false,lowT:0,
 sel:null,groups:G0,gSel:0,members:M0,mSel:null,pick:{},stats:{'date created':1,distance:1,'top speed':1,participant:1,'team tag':1},comment:'',prev:null,
 lssColor:null,entry:'',draft:[],lssName:'',lssEdit:null,cgName:'',cgMood:'',cgEmail:'',cgShow:'tony@tandemgps.com',cgAdded:0,inbox:0,
 lng:null,lat:null,tlng:null,tlat:null,brg:0,trail:[],prevFix:null,fixes:[],lastFix:0};
const toast=m=>Platform.OS==='android'&&ToastAndroid.show(m,ToastAndroid.SHORT);
const missing=n=>toast(n+' screen is not in the guide yet');
const web=()=>Linking.openURL('https://tandemgps.com/theportal');
const save=()=>AsyncStorage.multiSet([['rides',JSON.stringify(st.rides)],['pinned',JSON.stringify(st.pinned)],['active',JSON.stringify(st.active)]]).catch(()=>{});
const spanOf=(s,t,i=0)=>MAN[s].spans.filter(x=>x.t===t)[i];
const DIG={};'0123456789'.split('').forEach(d=>{DIG[d]=MAN.create_lss.spans.filter(s=>s.t===d&&s.s===24)[0]});
const LET=l=>spanOf('trackmode',l)||spanOf('manage_rides',l);
const plateOf=()=>st.screen==='maplink'?(st.moving?'maplink_motion':'maplink_default'):st.screen;

export default function App(){
 const [,setRev]=useState(0);const rerender=useRef(()=>setRev(v=>v+1)).current;
 const winD=useWindowDimensions();const [box,setBox]=useState(null);const win=box||winD;const [mapStyle,setMapStyle]=useState(null);
 const app=useRef(null);
 const nav=(s,noHist)=>{if(LOCK[s]&&st.moving)return;if(!noHist&&st.screen!==s)st.hist.push(st.screen);st.screen=s;rerender()};
 const back=()=>{const s=st.hist.pop();if(s&&!(LOCK[s]&&st.moving)){st.screen=s;rerender()}};
 app.current={nav,back,rerender};

 useEffect(()=>{AsyncStorage.multiGet(['rides','pinned','active']).then(v=>{const o=Object.fromEntries(v);if(o.rides)st.rides=JSON.parse(o.rides);if(o.pinned)st.pinned=JSON.parse(o.pinned);if(o.active)st.active=JSON.parse(o.active);rerender()}).catch(()=>{});
  const sub=BackHandler.addEventListener('hardwareBackPress',()=>{if(st.hist.length){back();return true}return false});return()=>sub.remove()},[]);

 useEffect(()=>{let watch=null,dead=false;
  (async()=>{let ok=true;if(Platform.OS==='android'){const r=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);ok=r===PermissionsAndroid.RESULTS.GRANTED}
   if(!ok){toast('TandemGPS needs location for the speedometer');return}if(dead)return;
   Geolocation.setRNConfiguration({skipPermissionRequests:true,locationProvider:'android'});
   watch=Geolocation.watchPosition(p=>{const c=p.coords,pv=st.prevFix,here=[c.longitude,c.latitude];const now=Date.now();st.fixes=addFix(st.fixes,{t:now,p:here,acc:c.accuracy});const v=fixSpeed(c.speed,st.fixes);st.lastFix=now;console.log('TG fix',JSON.stringify({reported:c.speed,acc:c.accuracy,ts:p.timestamp,n:st.fixes.length,mps:v}));
     if(pv&&distance([pv.lon,pv.lat],here)>3){st.tb=c.heading!=null&&c.heading>=0&&(v||0)>1?c.heading:bearing([pv.lon,pv.lat],here);st.trail=st.trail.concat([here]).slice(-1500)}
     if(st.lng==null){st.lng=c.longitude;st.lat=c.latitude;st.trail=[here];rerender()}
     st.tlng=c.longitude;st.tlat=c.latitude;st.prevFix={lat:c.latitude,lon:c.longitude,t:p.timestamp};st.target=Math.max(0,(v||0)*MPH_PER_MS)},
    ()=>{},{enableHighAccuracy:true,distanceFilter:0,interval:1000,fastestInterval:500,maximumAge:1000})})();
  return()=>{dead=true;if(watch!=null)Geolocation.clearWatch(watch)}},[]);

 useEffect(()=>{const id=setInterval(()=>{const dt=.1;if(st.lastFix&&Date.now()-st.lastFix>4000)st.target=0;st.speed+=(st.target-st.speed)*Math.min(1,dt*3);if(st.speed<.05&&st.target===0)st.speed=0;
   const was=st.moving,m=nextMotion(st.speed,st.paused,was,st.lowT,Date.now());st.moving=m.moving;st.lowT=m.lowT;
   if(st.moving&&!st.paused){if(!st.started){st.started=true;st.top=0;st.dur=0}st.dur+=dt;if(st.speed>st.top)st.top=st.speed}
   if(was!==st.moving){if(st.moving&&LOCK[st.screen]){st.hist=[];st.screen=st.mode}
    if(!st.moving&&st.inbox&&st.screen!=='shared_ride'){st.inbox=0;st.hist.push(st.screen);st.screen='shared_ride'}rerender()}},100);return()=>clearInterval(id)},[]);

 useEffect(()=>{let live=true;const tryStyle=async i=>{const urls=['https://tiles.openfreemap.org/styles/dark','https://tiles.openfreemap.org/styles/liberty'];try{const r=await fetch(urls[i]);if(!r.ok)throw 0;const j=await r.json();if(live)setMapStyle(styleForApp(j))}catch(e){if(i<urls.length-1)tryStyle(i+1);else if(live)setTimeout(()=>tryStyle(0),15000)}};tryStyle(0);return()=>{live=false}},[]);

 const sName=plateOf(),m=MAN[sName],k=Math.min(win.width/m.w,win.height/m.h) /* one scale for both axes, so the client's art is never stretched */,ox=(win.width-m.w*k)/2,oy=(win.height-m.h*k)/2;
 const c={k,sName,nav,back,rerender};
 let plate=ART['plate_'+sName];if(sName==='create_lss'&&st.draft.length)plate=ART.plate_create_lss_empty;if(sName==='create_group')plate=ART.plate_create_group_empty;
 const mr=MAPRECTS[sName],liveMap=!!(mr&&mapStyle&&st.lng!=null);
 const Sc=SCREENS[sName];console.log('TG screen',sName,'moving',st.moving,'speed',st.speed.toFixed(1),'top',st.top.toFixed(1));
 return <View style={{flex:1,backgroundColor:'#000'}} onLayout={e=>{const l=e.nativeEvent.layout;if(!box||box.width!==l.width||box.height!==l.height)setBox({width:l.width,height:l.height})}}><StatusBar hidden/>
  <View style={{position:'absolute',left:ox,top:oy,width:m.w*k,height:m.h*k,overflow:'hidden'}}>
   <Image source={plate} style={{position:'absolute',left:0,top:0,width:m.w*k,height:m.h*k}} fadeDuration={0}/>
   {mapStyle&&<LiveMap style={mapStyle} rect={liveMap?mr:null} k={k} showRoute={sName!=='trackmode'}/>}
   {liveMap&&<View pointerEvents="none" style={{position:'absolute',left:0,top:0}}><Image source={ART['fg_'+sName]} fadeDuration={0} style={{width:m.w*k,height:m.h*k}}/></View>}
   <Sc c={c}/>
  </View></View>;
}

function LiveMap({style,rect,k,showRoute}){const cam=useRef(null);const [shape,setShape]=useState(null);
 useEffect(()=>{const id=setInterval(()=>{if(st.lng==null||st.tlng==null)return;st.lng+=(st.tlng-st.lng)*.5;st.lat+=(st.tlat-st.lat)*.5;if(st.tb!=null){const d=((st.tb-st.brg+540)%360)-180;st.brg=(st.brg+d*.35+360)%360}
   cam.current&&cam.current.setCamera({centerCoordinate:[st.lng,st.lat],heading:st.brg,pitch:58,zoomLevel:16.3,animationDuration:220,animationMode:'linearTo',padding:{paddingTop:rect?rect[3]*k*.35:0,paddingBottom:0,paddingLeft:0,paddingRight:0}});
   if(st.trail.length>1)setShape({type:'Feature',properties:{},geometry:{type:'LineString',coordinates:st.trail}})},220);return()=>clearInterval(id)},[rect,k]);
 const box=rect?{left:rect[0]*k,top:rect[1]*k,width:rect[2]*k,height:rect[3]*k}:{left:-2000,top:0,width:10,height:10};
 return <View pointerEvents="none" style={{position:'absolute',...box,overflow:'hidden'}}>
  <MapLibreGL.MapView style={{flex:1}} mapStyle={style} logoEnabled={false} attributionEnabled={false} compassEnabled={false} zoomEnabled={false} scrollEnabled={false} rotateEnabled={false} pitchEnabled={false}>
   <MapLibreGL.Camera ref={cam} defaultSettings={{centerCoordinate:[st.lng||-98.49,st.lat||29.42],zoomLevel:16.3,pitch:58}}/>
   {shape&&showRoute&&<MapLibreGL.ShapeSource id="route" shape={shape}><MapLibreGL.LineLayer id="r0" style={{lineColor:'#88FA4E',lineWidth:2,lineOffset:-3,lineJoin:'round',lineCap:'round'}}/><MapLibreGL.LineLayer id="r1" style={{lineColor:'#88FA4E',lineWidth:2,lineOffset:3,lineJoin:'round',lineCap:'round'}}/></MapLibreGL.ShapeSource>}
  </MapLibreGL.MapView>
  <Text style={{position:'absolute',top:1,right:3,fontSize:7*k,color:'#aaa'}} onPress={()=>Linking.openURL('https://www.openstreetmap.org/copyright')}>OpenFreeMap © OpenMapTiles Data from OpenStreetMap</Text>
 </View>}

/* building blocks, all coordinates in screen units */
const b=(k,x,y,w,h)=>({position:'absolute',left:x*k,top:y*k,width:w*k,height:h*k});
const Hot=({k,x,y,w,h,on,label})=><Pressable accessibilityLabel={label} onPress={on} style={b(k,x,y,w,h)}/>;
const Cov=({k,x,y,w,h,c='#000',r=0})=><View pointerEvents="none" style={[b(k,x,y,w,h),{backgroundColor:c,borderRadius:r*k}]}/>;
/* Android ignores pointerEvents on Image, so any image on top swallows taps unless a View wraps it. */
const Pic=({k,src,x,y,w,h,r,o})=><View pointerEvents="none" style={b(k,x,y,w,h)}><Image source={src} fadeDuration={0} style={[{width:w*k,height:h*k},r?{borderRadius:r*k}:null,o!=null?{opacity:o}:null]}/></View>;
function Spr({k,sp,c,x,y,clip,o}){if(!sp)return null;const X=x==null?sp.x:x,Y=y==null?sp.y:y;
 if(clip)return <View pointerEvents="none" style={[b(k,X,Y,sp.w,clip),{overflow:'hidden'}]}><Image source={sp.img} fadeDuration={0} style={{width:sp.w*k,height:sp.h*k,tintColor:c||sp.c,opacity:o==null?1:o}}/></View>;
 return <View pointerEvents="none" style={b(k,X,Y,sp.w,sp.h)}><Image source={sp.img} fadeDuration={0} style={{width:sp.w*k,height:sp.h*k,tintColor:c||sp.c,opacity:o==null?1:o}}/></View>}
const Cp=({k,x,y,w,t,size,c,align})=><Text pointerEvents="none" numberOfLines={1} style={{position:'absolute',left:x*k,top:y*k,width:w?w*k:undefined,fontSize:size*k,color:c,fontFamily:'serif',fontVariant:['small-caps'],textAlign:align||'left'}}>{t}</Text>;
function Digits({k,t,cx,y,h,c}){const sc=h/27.3,ds=String(t).split('').map(d=>DIG[d]).filter(Boolean);let w=0;ds.forEach(d=>{w+=d.w*sc*.72});let x=cx-w/2;return ds.map((d,i)=>{const X=x-d.w*sc*.14;x+=d.w*sc*.72;return <View key={i} pointerEvents="none" style={b(k,X,y,d.w*sc,d.h*sc)}><Image source={d.img} fadeDuration={0} style={{width:d.w*sc*k,height:d.h*sc*k,tintColor:c}}/></View>})}
const Bar=({k,x,y,w,h,bands})=>bands.map((bd,i)=><Cov key={i} k={k} x={x+i*w/bands.length} y={y} w={w/bands.length+.5} h={h} c={bd.c}/>);
const toggleNote=(on)=>toast(on);

function Speedo({c,s}){const {k}=c,g=GEO[s],[,tick]=useState(0);const glow=useRef(new Animated.Value(0)).current;
 useEffect(()=>{const id=setInterval(()=>tick(v=>v+1),200);return()=>clearInterval(id)},[]);
 const r=st.active,bds=r.bands,n=bds.length,custom=JSON.stringify(bds)!==JSON.stringify(DEF),i=bandOf(st.speed,bds),col=bds[i].c,on=st.moving&&!st.paused;
 useEffect(()=>{Animated.timing(glow,{toValue:on?1:0,duration:300,useNativeDriver:true}).start()},[on]);
 const [bx,by,bw,bh]=g.bar,fx=barFraction(st.speed,bds,custom?null:RB),[dx,dy,dw,dh]=DASHRINGS[s],over=st.speed>POSTED_LIMIT,[px,py,pw,ph]=g.pill,fs=(15.5*dw/360+1)*k;
 const dg={position:'absolute',top:0,bottom:0,textAlign:'center',textAlignVertical:'center',color:'#fff',fontWeight:'700',fontSize:fs,fontVariant:['tabular-nums']};
 return <>{custom&&<><Cov k={k} x={bx-16} y={g.scaleY-2} w={bw+40} h={by-g.scaleY+bh+4}/><Bar k={k} x={bx} y={by} w={bw} h={bh} bands={bds}/><Digits k={k} t="0" cx={bx+2} y={g.scaleY} h={17} c={s==='maplink_default'?'#88FA4E':'#FFFFFF'}/>{bds.map((bd,j)=><Digits key={j} k={k} t={bd.to} cx={bx+bw*(j+1)/n} y={g.scaleY} h={17} c={s==='maplink_default'?'#88FA4E':'#FFFFFF'}/>)}</>}
  {on&&<Cov k={k} x={bx+bw*fx} y={by} w={bw*(1-fx)} h={bh} c="rgba(0,0,0,.78)"/>}
  <View pointerEvents="none" style={[b(k,px,py,pw,ph),{borderRadius:12*k,backgroundColor:over?'#F27100':'#1CB000'}]}><Spr k={k} sp={spanOf(s,'65')} c={g.pillTxt} x={(pw-34.8)/2} y={-2.6}/></View>
  {st.started&&<View pointerEvents="none" style={[b(k,dx,dy,dw,dh),{backgroundColor:'#000',borderWidth:1.3,borderColor:'#88FA4E',borderRadius:dh*k}]}>
   <Text style={[dg,{left:'2%',width:'28%'}]}>{st.top.toFixed(2)}</Text><Text style={[dg,{left:'34%',width:'32%'}]}>{fmtTime(st.dur)}</Text><Text style={[dg,{left:'70%',width:'28%'}]}>{(st.top*KPH_PER_MPH).toFixed(2)}</Text></View>}
  <View pointerEvents="none" style={{position:'absolute',left:0,top:0,right:0,bottom:0,zIndex:9}}><Animated.Image source={ART.lss_glow} fadeDuration={0} style={{width:'100%',height:'100%',tintColor:col,opacity:glow}} resizeMode="stretch"/></View></>}

function Pins({c,s}){const {k,rerender}=c,g=GEO[s].row;return <><Cov k={k} x={g.x-8} y={g.y-6} w={328} h={52}/>
 <View style={b(k,g.x-8,g.y-6,324,52)}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{width:(8+st.pinned.length*g.step)*k,height:52*k}}>
  {st.pinned.map((r,i)=>{const sp=LET(r.letter);return <Pressable key={r.id+i} onPress={()=>{st.active=r;save();toast('Speedo: '+r.name);rerender()}} style={[b(k,3+i*g.step,1,40,43),{borderWidth:3*k,borderColor:r.c,borderRadius:9*k}]}>{sp?<Spr k={k} sp={sp} c={r.c} x={3} y={0}/>:<Cp k={k} x={6} y={0} t={r.letter} size={28} c={r.c}/>}</Pressable>})}
 </ScrollView></View></>}
const Hide=({k,rects})=>st.moving?rects.map((r,i)=><Cov key={i} k={k} x={r[0]} y={r[1]} w={r[2]} h={r[3]}/>):null;
const voice=()=>{st.voice=!st.voice;toast(st.voice?'Voice directions on':'Voice directions off')};
const traffic=()=>{st.traffic=!st.traffic;toast(st.traffic?'Traffic on':'Traffic off')};
const pause=c=>()=>{st.paused=!st.paused;toast(st.paused?'Tracking paused':'Tracking resumed');c.rerender()};
const startShare=c=>()=>{st.prev=st.screen;c.nav('prompt1')};

function Row({k,g,s,x,y,on,avx,press}){const ox=x-avx+2,col=on?'#F27200':'#88FA4E',sp=g.custom?null:spanOf(s,g.n),a=spanOf(s,g.a),bb=spanOf(s,g.b);
 return <Pressable accessibilityLabel={g.n} onPress={press} style={b(k,avx-2,y-16,345,64)}><Pic k={k} src={ART['av'+g.av]} x={2} y={10} w={52} h={52} r={26}/>
  {sp?<Spr k={k} sp={sp} c={col} x={ox} y={16} clip={21}/>:<Cp k={k} x={ox} y={15} t={g.n} size={22} c={col}/>}
  {a?<Spr k={k} sp={a} c="#88FA4E" x={ox} y={38} clip={14}/>:<Cp k={k} x={ox} y={36} t={g.a} size={12} c="#88FA4E"/>}
  {bb?<Spr k={k} sp={bb} c="#88FA4E" x={ox} y={52} clip={14}/>:<Cp k={k} x={ox} y={50} t={g.b} size={12} c="#88FA4E"/>}</Pressable>}
function Rows({c,list,s,x,y,sel,set,avx}){const {k}=c;return <View style={b(k,0,222,392,345)}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{height:Math.max(345,(list.length*68.85+8))*k}}>{list.map((g,i)=><Row key={g.n+i} k={k} g={g} s={s} x={x} y={y-222+i*68.85} avx={avx} on={sel===i} press={()=>{set(sel===i?null:i);c.rerender()}}/>)}</ScrollView></View>}
const Field=({k,x,y,w,h,value,onChange,color='#F27200',max,multi,size=18,label})=><TextInput accessibilityLabel={label} value={value} onChangeText={onChange} maxLength={max} multiline={multi} autoCapitalize="none" style={[b(k,x,y,w,h),{color,fontSize:size*k,padding:0,textAlign:'center',fontFamily:'serif',fontVariant:['small-caps']}]}/>;

const SCREENS={
 profile:({c})=>{const {k,nav,back}=c;return <><Hot k={k} x={118} y={10} w={160} h={144} on={web} label="Website"/><Hot k={k} x={49} y={40} w={50} h={50} on={()=>missing('Login')} label="Logout"/><Hot k={k} x={305} y={48} w={55} h={54} on={pause(c)} label="Pause"/><Hot k={k} x={309} y={162} w={54} h={52} on={()=>missing('Messages')} label="Messages"/>
  <Hot k={k} x={178} y={290} w={120} h={90} on={()=>missing('Messages')} label="Profile picture"/><Hot k={k} x={131} y={323} w={47} h={47} on={back} label="Go back"/><Hot k={k} x={120} y={380} w={160} h={40} on={()=>missing('Edit Profile')} label="Edit profile"/>
  <Hot k={k} x={150} y={470} w={100} h={60} on={()=>nav('manage_rides')} label="Rides"/><Hot k={k} x={140} y={560} w={120} h={60} on={()=>nav('manage_groups')} label="Groups"/><Hot k={k} x={135} y={665} w={130} h={85} on={()=>nav(st.mode)} label="Lets go"/>
  {['Terms and Conditions','Delete Account','About','Privacy Policy','Password and Security'].map((n,i)=><Hot key={n} k={k} x={20+i*72} y={755} w={68} h={30} on={()=>missing(n)} label={n}/>)}</>},
 trackmode:({c})=>{const {k,nav,back}=c;st.mode='trackmode';return <><Speedo c={c} s="trackmode"/>
  {st.active.id!=='sport'&&<><Cov k={k} x={102} y={128} w={186} h={28}/><Cp k={k} x={0} y={126} w={397} t={st.active.name} size={26} c="#88FA4E" align="center"/></>}
  <Pins c={c} s="trackmode"/><Hide k={k} rects={[[25,20,78,78],[292,24,72,72],[160,609,76,47],[186,655,38,12]]}/>
  {!st.moving&&<><Hot k={k} x={30} y={25} w={70} h={68} on={back} label="Go back"/><Hot k={k} x={295} y={28} w={65} h={63} on={startShare(c)} label="Share"/><Hot k={k} x={165} y={596} w={66} h={62} on={()=>nav('streetmode')} label="Search map"/><Hot k={k} x={15} y={708} w={50} h={50} on={()=>nav('create_lss')} label="Create LSS"/></>}
  <Hot k={k} x={131} y={16} w={133} h={120} on={()=>nav('profile')} label="Profile"/><Hot k={k} x={30} y={118} w={66} h={66} on={()=>nav('streetmode')} label="StreetMode"/><Hot k={k} x={293} y={118} w={65} h={65} on={()=>{st.auto=!st.auto;toast(st.auto?'AutoMap started':'AutoMap stopped')}} label="AutoMap"/>
  <Hot k={k} x={19} y={607} w={56} h={58} on={voice} label="Speaker"/><Hot k={k} x={302} y={609} w={52} h={51} on={traffic} label="Traffic"/></>},
 maplink_motion:({c})=>{const {k,nav}=c;st.mode='maplink';return <><Speedo c={c} s="maplink_motion"/><Pins c={c} s="maplink_motion"/><Hide k={k} rects={[[26,20,68,66],[304,18,70,64]]}/><Cov k={k} x={23} y={678} w={46} h={46} c="rgba(0,0,0,.5)" r={23}/>
  <Hot k={k} x={132} y={1} w={133} h={120} on={()=>nav('profile')} label="Profile"/><Hot k={k} x={33} y={117} w={54} h={54} on={()=>nav('streetmode')} label="StreetMode"/><Hot k={k} x={313} y={122} w={50} h={49} on={()=>toast('Map navigation reversed')} label="Reverse"/><Hot k={k} x={26} y={578} w={48} h={50} on={voice} label="Speaker"/><Hot k={k} x={313} y={581} w={53} h={52} on={traffic} label="Traffic"/></>},
 maplink_default:({c})=>{const {k,nav,back}=c;st.mode='maplink';return <><Speedo c={c} s="maplink_default"/><Pins c={c} s="maplink_default"/>
  <Hot k={k} x={39} y={25} w={72} h={72} on={back} label="Go back"/><Hot k={k} x={289} y={28} w={73} h={72} on={startShare(c)} label="Share"/><Hot k={k} x={125} y={6} w={139} h={125} on={()=>nav('profile')} label="Profile"/><Hot k={k} x={42} y={137} w={69} h={69} on={()=>nav('streetmode')} label="StreetMode"/><Hot k={k} x={290} y={137} w={70} h={69} on={()=>toast('Map navigation reversed')} label="Reverse"/><Hot k={k} x={42} y={602} w={66} h={69} on={voice} label="Speaker"/><Hot k={k} x={299} y={600} w={73} h={73} on={traffic} label="Traffic"/><Hot k={k} x={21} y={739} w={48} h={48} on={()=>nav('create_lss')} label="Create LSS"/></>},
 streetmode:({c})=>{const {k,nav,back}=c;return <><Speedo c={c} s="streetmode"/><Hide k={k} rects={[[160,622,70,48],[186,668,44,12]]}/><Hot k={k} x={129} y={35} w={124} h={112} on={()=>nav('profile')} label="Profile"/>
  {!st.moving&&<><Hot k={k} x={38} y={61} w={47} h={47} on={back} label="Go back"/><Hot k={k} x={303} y={56} w={54} h={53} on={pause(c)} label="Pause"/><Hot k={k} x={160} y={608} w={70} h={62} on={()=>missing('Create and search map')} label="Search"/><Hot k={k} x={15} y={735} w={50} h={50} on={()=>nav('create_lss')} label="Create LSS"/><Hot k={k} x={70} y={735} w={320} h={50} on={()=>nav('manage_rides')} label="Pinned rides"/></>}
  <Hot k={k} x={38} y={632} w={43} h={45} on={voice} label="Speaker"/><Hot k={k} x={303} y={628} w={52} h={51} on={traffic} label="Traffic"/></>},
 manage_rides:({c})=>{const {k,nav,back,rerender}=c,NY=[256.8,310.7,364.7,418.7,483.3],BY=[246.8,307.1,364.8,422.4,480.1],LX=[66.5,67.4,67.4,68.5,68.5],sel=st.sel;
  return <><Hot k={k} x={11} y={10} w={102} h={102} on={back} label="Go back"/><Hot k={k} x={300} y={40} w={60} h={60} on={pause(c)} label="Pause"/>
  <Hot k={k} x={129} y={10} w={133} h={120} label="Pin" on={()=>{if(sel==null){toast('Highlight a ride, then tap the logo to pin');return}const r=st.rides[sel];if(!st.pinned.some(x=>x.id===r.id)){st.pinned=st.pinned.concat([r]);save();toast(r.name+' pinned')}else toast(r.name+' is already pinned')}}/>
  <Hot k={k} x={295} y={160} w={52} h={52} on={()=>missing('Create Map')} label="Create MapLink"/>
  <View style={b(k,40,226,340,296)}><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{height:Math.max(296,(st.rides.length*58+20))*k}}>{st.rides.map((r,i)=>{const on=sel===i,col=on?'#F27200':'#88FA4E',ny=(i<5?NY[i]:483.3+(i-4)*57.7)-226,by=(i<5?BY[i]:480.1+(i-4)*57.7)-226,lx=(i<5?LX[i]:67)-40,oy=by-2,sp=spanOf('manage_rides',r.name),ls=LET(r.letter),op=r.faded&&!on?.4:1;
   return <Pressable key={r.id+i} accessibilityLabel={r.name} onPress={()=>{st.sel=on?null:i;rerender()}} style={b(k,0,oy,340,i<4?NY[i+1]-NY[i]+6:64)}><View style={[b(k,lx-7,by-oy-1,42,42),{borderWidth:3*k,borderColor:r.c,borderRadius:9*k,opacity:op}]}/>{ls?<Spr k={k} sp={ls} c={r.c} x={lx} y={by-oy} o={op}/>:<Cp k={k} x={lx+3} y={by-oy} t={r.letter} size={28} c={r.c}/>}
    {r.id==='biker'&&!on?<Pic k={k} src={ART.crop_biker} x={70} y={ny-oy-5} w={170} h={32}/>:sp?<Spr k={k} sp={sp} c={col} x={74.9} y={ny-oy}/>:<Cp k={k} x={75} y={ny-oy} t={r.name} size={21} c={col}/>}
    {on&&<Bar k={k} x={75} y={ny-oy+26} w={170} h={4} bands={r.bands}/>}</Pressable>})}</ScrollView></View>
  {sel!=null&&<><Pic k={k} src={ART.crop_manage_rides_share} x={25} y={146} w={85} h={85}/><Pic k={k} src={ART.crop_manage_rides_trash} x={28} y={625} w={95} h={95}/><Pic k={k} src={ART.crop_manage_rides_edit} x={285} y={625} w={100} h={100}/>
   <Hot k={k} x={25} y={146} w={85} h={85} on={()=>{st.active=st.rides[sel];startShare(c)()}} label="Share"/>
   <Hot k={k} x={28} y={625} w={95} h={95} on={()=>{st.rides=st.rides.filter((_,i)=>i!==sel);st.sel=null;save();rerender()}} label="Delete"/>
   <Hot k={k} x={285} y={625} w={100} h={100} on={()=>{const r=st.rides[sel];st.lssEdit=r.id;st.lssName=r.name;st.draft=r.bands.slice();st.entry='';st.lssColor=null;nav('create_lss')}} label="Edit"/></>}
  <Hot k={k} x={140} y={690} w={120} h={90} on={()=>{if(sel!=null)st.active=st.rides[sel];save();nav('trackmode')}} label="Lets go"/></>},
 create_lss:({c})=>{const {k,nav,back,rerender}=c,d=st.draft,n=d.length;
  const confirm=()=>{const v=parseInt(st.entry,10);if(!st.lssColor){toast('Select a color first');return}if(!v){toast('Enter a speed first');return}const last=n?d[n-1].to:0;if(v<=last){toast('Speed must be above '+last);st.entry='';rerender();return}if(n>=6){toast('Six colors maximum');return}st.draft=d.concat([{to:v,c:st.lssColor}]);st.entry='';st.lssColor=null;rerender()};
  const finish=()=>{if(!n){toast('Add at least one color and speed');return}if(!st.lssName){toast('Create a filename first');return}const pal=['#FF42A1','#88FA4E','#56C1FF','#FFFB00','#EE220C'];let r=st.lssEdit?st.rides.find(x=>x.id===st.lssEdit):null;if(r){r.name=st.lssName;r.bands=d;r.art=0}else{r={id:'r'+Date.now(),name:st.lssName,letter:st.lssName.charAt(0).toUpperCase(),c:pal[st.rides.length%5],bands:d};st.rides=[r].concat(st.rides)}st.active=r;st.draft=[];st.lssName='';st.lssEdit=null;st.entry='';save();st.hist=[];st.screen='trackmode';rerender()};
  return <><Hot k={k} x={50} y={38} w={55} h={52} on={()=>{st.draft=[];st.lssEdit=null;st.lssName='';back()}} label="Go back"/><Hot k={k} x={137} y={4} w={119} h={119} on={()=>nav('profile')} label="Profile"/>
  <Pressable accessibilityLabel="Color selector" style={b(k,72,226,256,140)} onPress={e=>{const gx=Math.floor(e.nativeEvent.locationX/k/4),gy=Math.floor(e.nativeEvent.locationY/k/4),col=(LSS_GRID[gy]||[])[gx];if(col){st.lssColor=col;rerender()}}}/>
  {n>0&&<><Bar k={k} x={78} y={389.3} w={244.3} h={9.4} bands={d}/><Digits k={k} t="0" cx={80} y={366} h={16} c="#88FA4E"/>{d.map((bd,i)=><Digits key={i} k={k} t={bd.to} cx={78+244.3*(i+1)/n} y={366} h={16} c="#88FA4E"/>)}</>}
  {(st.entry!==''||n>0||st.lssColor)&&<Cov k={k} x={168} y={511} w={60} h={28} r={14}/>}
  {st.entry!==''&&<Digits k={k} t={st.entry} cx={197} y={513} h={24} c="#FFFFFF"/>}
  {Object.keys(DIG).map(x=>{const s=DIG[x];return <Hot key={x} k={k} x={s.x-8} y={s.y-6} w={s.w+16} h={s.h+12} on={()=>{if(st.entry.length<3){st.entry+=x;rerender()}}} label={'Digit '+x}/>})}
  <Hot k={k} x={130} y={435} w={135} h={70} on={confirm} label="Confirm"/>
  {st.lssColor&&<View pointerEvents="none" style={{position:'absolute',left:0,top:0,right:0,bottom:0}}><Image source={ART.lss_glow} fadeDuration={0} resizeMode="stretch" style={{width:'100%',height:'100%',tintColor:st.lssColor}}/></View>}
  {!!st.lssName&&<Cov k={k} x={72} y={612} w={250} h={31} c="#351806" r={16}/>}
  <Field k={k} x={74} y={613} w={246} h={30} value={st.lssName} max={20} label="Filename" onChange={v=>{st.lssName=v;rerender()}}/>
  <Hot k={k} x={140} y={680} w={120} h={90} on={finish} label="Lets go"/></>},
 manage_groups:({c})=>{const {k,nav,back,rerender}=c;return <><Hot k={k} x={40} y={39} w={66} h={66} on={back} label="Go back"/><Hot k={k} x={280} y={40} w={70} h={70} on={()=>nav('create_group')} label="Create group"/><Hot k={k} x={134} y={16} w={119} h={119} on={web} label="Website"/><Hot k={k} x={145} y={160} w={74} h={62} on={()=>nav('create_group')} label="Add"/>
  <Rows c={c} list={st.groups} s="manage_groups" x={141.7} y={223} sel={st.gSel} set={v=>{st.gSel=v}} avx={66}/>
  {st.gSel!=null&&<><Pic k={k} src={ART.crop_manage_groups_trash} x={25} y={650} w={100} h={95}/><Pic k={k} src={ART.crop_manage_groups_edit} x={285} y={655} w={100} h={90}/><Hot k={k} x={25} y={650} w={100} h={95} on={()=>{st.groups=st.groups.filter((_,i)=>i!==st.gSel);st.gSel=null;rerender()}} label="Delete"/><Hot k={k} x={285} y={655} w={100} h={90} on={()=>missing('Edit Group')} label="Edit"/></>}
  <Hot k={k} x={135} y={680} w={130} h={100} on={()=>nav('group_page')} label="Visit"/></>},
 group_page:({c})=>{const {k,nav,back,rerender}=c;return <><Hot k={k} x={40} y={39} w={66} h={66} on={back} label="Go back"/><Hot k={k} x={285} y={30} w={75} h={75} on={()=>nav('create_group')} label="Create group"/><Hot k={k} x={134} y={16} w={119} h={119} on={web} label="Website"/><Hot k={k} x={155} y={158} w={74} h={62} on={()=>nav('create_group')} label="Add"/>
  <Rows c={c} list={st.members} s="group_page" x={141.7} y={223.3} sel={st.mSel} set={v=>{st.mSel=v}} avx={66}/><Pic k={k} src={ART.icon_hand} x={230} y={407} w={60} h={59}/>
  {st.mSel!=null&&<><Pic k={k} src={ART.crop_group_page_trash} x={35} y={595} w={95} h={95}/><Pic k={k} src={ART.crop_group_page_edit} x={280} y={600} w={100} h={90}/><Hot k={k} x={35} y={595} w={95} h={95} on={()=>{st.members=st.members.filter((_,i)=>i!==st.mSel);st.mSel=null;rerender()}} label="Delete"/><Hot k={k} x={280} y={600} w={100} h={90} on={()=>missing('Edit Member')} label="Edit"/></>}
  <Hot k={k} x={130} y={670} w={130} h={100} on={()=>nav(st.mode)} label="Lets go"/></>},
 prompt1:({c})=>{const {k,nav,back,rerender}=c;return <><Hot k={k} x={0} y={0} w={392} h={790} label="Close picker" on={()=>{nav('file_share');setTimeout(()=>nav('prompt2',true),450)}}/><Hot k={k} x={20} y={50} w={60} h={60} on={back} label="Go back"/>
  {st.groups.map((g,i)=><Row key={g.n+i} k={k} g={g} s="manage_groups" x={119.9} y={231.4+i*68.8} avx={44} on={!!st.pick[i]} press={()=>{st.pick[i]=!st.pick[i];rerender()}}/>)}</>},
 prompt2:({c})=>{const {k,nav,rerender}=c,ys=[249.5,266.5,283.5,300.5,317.5],cols=[[65,'date created','distance','duration','average speed','top speed'],[205,'participant','lifetime','membership','team tag','top speed set by']];
  return <><Hot k={k} x={25} y={30} w={70} h={70} on={()=>nav('file_share',true)} label="Go back"/>
  {cols.map(cl=>ys.map((y,i)=>{const name=cl[i+1],on=!!st.stats[name];return <Pressable key={name} accessibilityLabel={name} style={b(k,cl[0],y-1,135,19)} onPress={()=>{if(!on&&Object.keys(st.stats).length>=5)return;if(on)delete st.stats[name];else st.stats[name]=1;rerender();if(!on&&Object.keys(st.stats).length===5)setTimeout(()=>nav('file_share',true),350)}}><View style={[b(k,-2,0,18,18),{backgroundColor:CARDS[i],alignItems:'center',justifyContent:'center'}]}><Text style={{color:on?'#61D836':'#88FA4E',fontSize:(on?15:12)*k,lineHeight:17*k}}>{on?'✓':'○'}</Text></View></Pressable>}))}
  {!!st.comment&&<Cov k={k} x={92} y={207} w={222} h={38} c={CARDS[5]} r={4}/>}
  <Field k={k} x={95} y={207} w={216} h={38} size={13} multi max={80} value={st.comment} label="Comment" onChange={v=>{st.comment=v;rerender()}}/>
  <Hot k={k} x={60} y={575} w={270} h={110} on={()=>nav('maplink')} label="Preview map"/><Hot k={k} x={125} y={700} w={150} h={85} on={()=>nav('maplink')} label="Lets go"/></>},
 file_share:({c})=>{const {k,nav,rerender}=c;return <><Hot k={k} x={25} y={30} w={70} h={70} on={()=>nav(st.prev||st.mode,true)} label="Go back"/><Hot k={k} x={290} y={30} w={70} h={70} on={pause(c)} label="Pause"/><Hot k={k} x={133} y={13} w={119} h={119} on={web} label="Website"/><Hot k={k} x={155} y={560} w={90} h={90} on={()=>nav('maplink')} label="View map"/>
  <Hot k={k} x={135} y={690} w={130} h={95} label="Share" on={()=>{const groups=Object.keys(st.pick).filter(x=>st.pick[x]).length;toast('Shared to '+groups+(groups===1?' group':' groups'));st.pick={};st.screen=st.prev||st.mode;st.hist=[];rerender();
   /* one phone stands in for the recipient: the shared ride arrives once stationary */
   setTimeout(()=>{if(st.moving){st.inbox=1}else{toast('You received a shared ride');st.hist.push(st.screen);st.screen='shared_ride';rerender()}},4000)}}/></>},
 shared_ride:({c})=>{const {k,nav,back}=c;return <><Hot k={k} x={25} y={30} w={70} h={70} on={back} label="Go back"/><Hot k={k} x={138} y={9} w={113} h={112} on={web} label="Website"/><Hot k={k} x={155} y={548} w={80} h={80} on={()=>nav('maplink')} label="View map"/><Hot k={k} x={130} y={690} w={130} h={95} on={()=>nav('maplink')} label="Lets go"/></>},
 create_group:({c})=>{const {k,nav,back,rerender}=c,boxO=useRef(new Animated.Value(1)).current,[,force]=useState(0);
  const F=[['cgName','Enter Group Name',163],['cgMood','s e t  m o o d',203],['cgEmail','Enter Member Email',244]];
  return <><Hot k={k} x={40} y={25} w={70} h={70} on={back} label="Go back"/><Hot k={k} x={295} y={30} w={70} h={70} on={pause(c)} label="Pause"/><Hot k={k} x={135} y={14} w={119} h={119} on={web} label="Website"/>
  {F.map(f=><React.Fragment key={f[0]}>{!st[f[0]]&&<Spr k={k} sp={spanOf('create_group',f[1])}/>}<Field k={k} x={60} y={f[2]} w={276} h={33} value={st[f[0]]} label={f[1]} onChange={v=>{st[f[0]]=v;if(f[0]==='cgEmail')st.cgShow=/@tandemgps\.com$/i.test(v)?v.toLowerCase():null;force(x=>x+1)}}/></React.Fragment>)}
  <Animated.View pointerEvents="none" style={[b(k,0,430,397,60),{opacity:boxO}]}>{st.cgShow==='tony@tandemgps.com'?<Spr k={k} sp={spanOf('create_group','tony@tandemgps.com')} y={15.9}/>:st.cgShow?<Cp k={k} x={0} y={16} w={397} t={st.cgShow} size={21} c="#F27200" align="center"/>:null}</Animated.View>
  <Hot k={k} x={85} y={560} w={225} h={55} label="Confirm" on={()=>{if(!st.cgShow){toast('Enter a member email first');return}st.cgAdded++;Animated.timing(boxO,{toValue:0,duration:600,useNativeDriver:true}).start(()=>{st.cgShow=null;st.cgEmail='';boxO.setValue(1);rerender()})}}/>
  <Hot k={k} x={140} y={680} w={120} h={100} label="Save" on={()=>{st.groups=[{n:st.cgName||'New Group',a:'Owner since November 2026',b:(st.cgAdded+1)+' Members',av:0,custom:1}].concat(st.groups);st.cgName=st.cgMood=st.cgEmail='';st.cgAdded=0;st.cgShow='tony@tandemgps.com';st.gSel=0;st.hist=[];st.screen='manage_groups';rerender()}}/></>},
};
