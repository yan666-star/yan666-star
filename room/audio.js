/* study-room audio — all sounds synthesized with Web Audio API, no assets */
window.RoomAudio=(function(){
  let ctx=null,master=null,noiseBuffer=null;
  const loopStates={};
  const loops={};

  function ensure(){
    if(!ctx){
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return false;
      ctx=new AC();
      master=ctx.createGain();master.gain.value=0.42;master.connect(ctx.destination);
      const len=2*ctx.sampleRate,buf=ctx.createBuffer(1,len,ctx.sampleRate),d=buf.getChannelData(0);
      for(let i=0;i<len;i++)d[i]=Math.random()*2-1;
      noiseBuffer=buf;
      for(const k in loopStates) if(loopStates[k].on) startLoop(k);
    }
    if(ctx.state==='suspended')ctx.resume();
    return true;
  }
  function now(){return ctx.currentTime;}
  const mf=m=>440*Math.pow(2,(m-69)/12);

  /* primitives */
  function tone(o){
    const t=o.t!==undefined?o.t:now();
    const os=ctx.createOscillator(),g=ctx.createGain();
    os.type=o.type||'sine';
    os.frequency.setValueAtTime(o.f||440,t);
    if(o.f2)os.frequency.exponentialRampToValueAtTime(Math.max(o.f2,1),t+(o.dur||0.2));
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(o.g||0.05,t+(o.a||0.005));
    g.gain.exponentialRampToValueAtTime(0.0001,t+(o.dur||0.2));
    os.connect(g);g.connect(o.dest||master);
    os.start(t);os.stop(t+(o.dur||0.2)+0.05);
  }
  function noise(o){
    const t=o.t!==undefined?o.t:now();
    const s=ctx.createBufferSource();s.buffer=noiseBuffer;s.loop=true;
    s.playbackRate.value=0.7+Math.random()*0.6;
    const f=ctx.createBiquadFilter();f.type=o.type||'bandpass';
    f.frequency.value=o.f||1000;f.Q.value=o.q||1;
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(o.g||0.05,t+(o.a||0.004));
    g.gain.exponentialRampToValueAtTime(0.0001,t+(o.dur||0.2));
    s.connect(f);f.connect(g);g.connect(o.dest||master);
    s.start(t);s.stop(t+(o.dur||0.2)+0.05);
  }
  function squeak(dir,dur,g0){
    const t=now();
    const o=ctx.createOscillator();o.type='triangle';
    const f0=dir>0?520:760,f1=dir>0?820:560,f2=dir>0?640:470;
    o.frequency.setValueAtTime(f0,t);
    o.frequency.linearRampToValueAtTime(f1,t+dur*0.5);
    o.frequency.linearRampToValueAtTime(f2,t+dur);
    const vib=ctx.createOscillator();vib.frequency.value=5.5;
    const vg=ctx.createGain();vg.gain.value=26;
    vib.connect(vg);vg.connect(o.frequency);
    const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.Q.value=5;
    bp.frequency.setValueAtTime(f0*1.4,t);
    bp.frequency.linearRampToValueAtTime(f1*1.4,t+dur*0.5);
    bp.frequency.linearRampToValueAtTime(f2*1.4,t+dur);
    const g=ctx.createGain();
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(g0||0.055,t+0.06);
    g.gain.setValueAtTime((g0||0.055)*0.9,t+dur*0.55);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(bp);bp.connect(g);g.connect(master);
    o.start(t);o.stop(t+dur+0.02);vib.start(t);vib.stop(t+dur+0.02);
  }
  function clack(delay,g0){
    const v=g0||0.07,t=now()+(delay||0);
    tone({type:'square',f:1500,t,dur:0.022,g:v});
    noise({t:t+0.005,dur:0.03,f:2500,q:1.5,g:v*0.5});
  }
  function click(f,dur,g0){tone({type:'square',f:f||1300,dur:dur||0.03,g:g0||0.05});}
  function thud(f,g0,dur){tone({type:'sine',f:f||80,f2:(f||80)*0.6,dur:dur||0.16,g:g0||0.08});}

  /* continuous-loop helpers */
  function makeGain(v){
    const g=ctx.createGain();g.gain.value=0.0001;g.connect(master);
    const n=now();g.gain.linearRampToValueAtTime(v,n+1.2);
    return g;
  }
  function fadeOut(g,done){
    const n=now();g.gain.cancelScheduledValues(n);g.gain.setValueAtTime(Math.max(g.gain.value,0.0001),n);
    g.gain.linearRampToValueAtTime(0.0001,n+0.7);
    setTimeout(done,800);
  }
  function noiseSrc(dest,filterType,freq,q,g0){
    const s=ctx.createBufferSource();s.buffer=noiseBuffer;s.loop=true;
    const f=ctx.createBiquadFilter();f.type=filterType;f.frequency.value=freq;f.Q.value=q;
    const g=ctx.createGain();g.gain.value=g0;
    s.connect(f);f.connect(g);g.connect(dest);s.start();
    return s;
  }
  function oscSrc(dest,type,freq,g0){
    const o=ctx.createOscillator();o.type=type;o.frequency.value=freq;
    const g=ctx.createGain();g.gain.value=g0;
    o.connect(g);g.connect(dest);o.start();
    return o;
  }

  /* one-shots */
  const sfxMap={
    door(){squeak(1,0.55,0.05);clack(0,0.05);},
    doorClose(){squeak(-1,0.5,0.05);clack(0.32,0.06);},
    windowOpen(){clack(0,0.06);squeak(1,0.3,0.04);},
    windowClose(){squeak(-1,0.28,0.04);clack(0.26,0.07);},
    blindsUp(){for(let i=0;i<8;i++)noise({t:now()+i*0.055,dur:0.03,f:1100+i*160,q:3,g:0.028});},
    blindsDown(){for(let i=0;i<8;i++)noise({t:now()+i*0.055,dur:0.03,f:2100-i*150,q:3,g:0.028});},
    drawerOut(){noise({dur:0.4,f:380,f2:0,q:1.2,g:0.05,a:0.06});setTimeout(()=>thud(95,0.05,0.1),380);},
    drawerIn(){noise({dur:0.35,f:600,f2:0,q:1.2,g:0.045,a:0.05});setTimeout(()=>thud(110,0.06,0.1),330);},
    cabinet(){squeak(1,0.2,0.032);clack(0.2,0.05);},
    cabinetClose(){squeak(-1,0.2,0.032);clack(0.2,0.05);},
    book(){noise({dur:0.28,f:1600,q:0.8,g:0.05,a:0.02});},
    clockToggle(){tone({type:'square',f:300,dur:0.06,g:0.15});},
    tick(){noise({dur:0.008,type:'highpass',f:3800,g:0.045});tone({type:'triangle',f:1250,dur:0.012,g:0.045});},
    tock(){noise({dur:0.008,type:'highpass',f:3300,g:0.045});tone({type:'triangle',f:980,dur:0.012,g:0.045});},
    chair(){noise({dur:0.75,f:260,q:0.8,g:0.055,a:0.1});},
    switchOn(){click(1250,0.028,0.07);setTimeout(()=>click(900,0.02,0.05),70);},
    switchOff(){click(900,0.028,0.06);setTimeout(()=>click(700,0.02,0.04),70);},
    lamp(){click(2100,0.02,0.06);},
    mug(){tone({type:'sine',f:1568,dur:0.7,g:0.05});tone({type:'sine',f:2349,dur:0.5,g:0.02});},
    plant(){noise({dur:0.35,f:1500,q:0.7,g:0.04,a:0.02});},
    chime(){tone({type:'sine',f:1568,dur:1.4,g:0.025});tone({type:'sine',f:2349,dur:1.0,g:0.015});},
    picture(){tone({type:'sine',f:180,f2:120,dur:0.12,g:0.06});},
    globe(){tone({type:'triangle',f:210,f2:420,dur:0.35,g:0.035});},
    ball(){[0,0.55,1.1].forEach((d,i)=>tone({type:'sine',f:430,f2:150,t:now()+d,dur:0.15,g:0.075/(i+1)}));},

    /* computer / desk-specific */
    monitorOn(){
      const t=now();
      for(let i=0;i<4;i++)tone({type:'sine',f:800+i*220,t:t+i*0.05,dur:0.1,g:0.06});
    },
    monitorOff(){
      const t=now();
      for(let i=0;i<4;i++)tone({type:'sine',f:1700-i*200,t:t+i*0.04,dur:0.06,g:0.05});
    },
    pcBoot(){
      const t=now()+0.02;
      tone({type:'square',f:55,t,dur:0.45,g:0.08});
      tone({type:'sawtooth',f:110,t,dur:0.35,g:0.05});
      tone({type:'square',f:220,t,dur:0.2,g:0.04});
      setTimeout(()=>click(2000,0.04,0.06),420);
    },
    keyClick(){click(2400+Math.random()*600,0.012,0.05);},
    keyMulti(){for(let i=0;i<6;i++)setTimeout(()=>{click(1800+Math.random()*1200,0.012,0.05);},i*65+Math.random()*25);},
    mouseClick(){click(3000+Math.random()*400,0.008,0.04);},
    headphones(){
      noise({dur:0.5,f:900,q:2.5,g:0.06,a:0.05});
      setTimeout(()=>tone({type:'sine',f:780,f2:520,dur:0.25,g:0.04}),350);
    },
    headphonesOff(){
      tone({type:'sine',f:520,f2:260,dur:0.2,g:0.04});
    },
    midiNote(){tone({type:'square',f:440*Math.pow(2,(Math.floor(Math.random()*12)+60-69)/12),dur:0.18,g:0.05});},

    /* aquarium */
    aquariumFeed(){
      tone({type:'sine',f:200,dur:0.1,g:0.05});
      setTimeout(()=>noise({dur:0.25,f:600,q:1.5,g:0.04,a:0.05}),80);
    },
    bubble(){tone({type:'sine',f:600+Math.random()*500,dur:0.05,g:0.025});},
    fishDart(){tone({type:'sine',f:1300,f2:600,dur:0.08,g:0.03});},

    /* 3D printer */
    printerStep(){click(2200,0.005,0.025);},
    printerDone(){
      const t=now();
      tone({type:'sine',f:523,t,dur:0.18,g:0.08});
      tone({type:'sine',f:659,t:t+0.16,dur:0.18,g:0.08});
      tone({type:'sine',f:784,t:t+0.32,dur:0.25,g:0.08});
    },

    /* robot vacuum */
    robotStart(){
      tone({type:'sawtooth',f:120,f2:60,dur:0.25,g:0.05});
    },
    robotBump(){
      thud(60,0.08,0.1);
      click(800,0.02,0.04);
    },

    /* marker on whiteboard */
    markerSqueak(){
      tone({type:'square',f:2200,dur:0.16,g:0.04});
      noise({dur:0.14,type:'highpass',f:3000,q:3,g:0.02});
    },

    /* lava lamp */
    lavaPop(){
      if(Math.random()<0.4)tone({type:'sine',f:140+Math.random()*100,dur:0.06,g:0.04});
    },

    /* windows star chime */
    chimes(){
      const base=[1568,1760,2093,2349][Math.random()*4|0],t0=now()+0.02;
      [1,1.19,0.89].forEach((mm,i)=>{
        [1,2.76].forEach((m,j)=>tone({type:'sine',f:base*mm*m,t:t0+i*0.14,dur:1.7-j*0.4,g:0.012/(j+1)/(i?1.3:1)}));
      });
    }
  };

  /* continuous loops */
  const loopBuilders={
    fan(){
      const g=makeGain(0.06),L={g,nodes:[]};
      L.nodes.push(oscSrc(g,'sine',58,0.5));
      L.nodes.push(oscSrc(g,'triangle',117,0.12));
      const s=noiseSrc(g,'bandpass',260,0.8,0.4);
      const lfo=ctx.createOscillator();lfo.frequency.value=2.4;
      const lg=ctx.createGain();lg.gain.value=0.2;
      lfo.connect(lg);lg.connect(s.playbackRate);lfo.start();
      L.nodes.push(s,lfo);
      return L;
    },
    steam(){
      const g=makeGain(0.003),L={g,nodes:[noiseSrc(g,'highpass',5500,0.7,1)]};
      return L;
    },
    hum(){
      const g=makeGain(0.005),L={g,nodes:[]};
      L.nodes.push(oscSrc(g,'square',120,0.25));
      L.nodes.push(oscSrc(g,'sine',50,0.5));
      return L;
    },
    plantSway(){
      const g=makeGain(0.008),L={g,nodes:[]};
      const s=noiseSrc(g,'bandpass',1400,0.6,1);
      const lfo=ctx.createOscillator();lfo.frequency.value=0.7;
      const lg=ctx.createGain();lg.gain.value=0.35;
      lfo.connect(lg);lg.connect(s.playbackRate);lfo.start();
      L.nodes.push(s,lfo);
      return L;
    },
    pcFan(){
      const g=makeGain(0.05),L={g,nodes:[]};
      L.nodes.push(oscSrc(g,'triangle',85,0.6));
      L.nodes.push(oscSrc(g,'sawtooth',170,0.18));
      const s=noiseSrc(g,'bandpass',420,1.5,0.35);
      const lfo=ctx.createOscillator();lfo.frequency.value=9;
      const lg=ctx.createGain();lg.gain.value=0.12;
      lfo.connect(lg);lg.connect(s.playbackRate);lfo.start();
      L.nodes.push(s,lfo);
      return L;
    },
    aquarium(){
      const g=makeGain(0.02),L={g,nodes:[]};
      L.nodes.push(noiseSrc(g,'lowpass',340,0.6,1));
      const step=()=>{
        if(!L.on)return;
        if(Math.random()<0.35){
          tone({type:'sine',f:500+Math.random()*600,dur:0.04,g:0.018});
        }
        L.timer=setTimeout(step,400+Math.random()*1200);
      };
      step();
      return L;
    },
    printer(){
      const g=makeGain(0.045),L={g,nodes:[]};
      L.nodes.push(oscSrc(g,'square',78,0.3));
      L.nodes.push(noiseSrc(g,'bandpass',820,2,0.5));
      const step=()=>{
        if(!L.on)return;
        click(1200,0.006,0.04);
        L.timer=setTimeout(step,180);
      };
      step();
      return L;
    },
    lavaBubbles(){
      const L={g:master,on:true};
      const step=()=>{
        if(!L.on)return;
        if(Math.random()<0.25){
          tone({type:'sine',f:180+Math.random()*140,dur:0.05,g:0.025});
          tone({type:'sine',f:90+Math.random()*60,dur:0.08,g:0.018});
        }
        L.timer=setTimeout(step,700+Math.random()*1600);
      };
      step();
      return L;
    },
    dayAmb(){
      const L={g:master,on:true};
      L.nodes=[noiseSrc(master,'lowpass',320,0.5,0.012)];
      const step=()=>{
        if(!L.on)return;
        const t=now()+0.05,n=2+(Math.random()*2|0);
        for(let i=0;i<n;i++){
          const f0=2200+Math.random()*1400;
          tone({type:'sine',f:f0,f2:f0*0.72,t:t+i*0.12,dur:0.09,g:0.018});
        }
        L.timer=setTimeout(step,2500+Math.random()*5500);
      };
      L.timer=setTimeout(step,1200);
      return L;
    },
    nightAmb(){
      const L={g:master,on:true};
      L.nodes=[noiseSrc(master,'lowpass',200,0.5,0.008)];
      const step=()=>{
        if(!L.on)return;
        const t=now()+0.02;
        for(let i=0;i<4;i++)tone({type:'square',f:4300,t:t+i*0.055,dur:0.03,g:0.011});
        L.timer=setTimeout(step,700+Math.random()*900);
      };
      step();
      return L;
    },
    chiptune(){
      const g=makeGain(0.07),L={g,on:true};
      const bpm=140,spb=60/bpm,loopBeats=32;
      const lead=[
        [0,76,0.5],[0.5,79,0.5],[1,83,0.5],[1.5,79,0.5],
        [2,76,1],[3,71,0.5],[3.5,74,0.5],
        [4,79,1],[5,76,0.5],[5.5,79,0.5],[6,83,1],[7,81,1],
        [8,79,0.5],[8.5,76,0.5],[9,74,1],[10,71,1],
        [11,76,0.5],[11.5,79,0.5],[12,83,1.5],
        [13.5,81,0.5],[14,79,1],[15,76,1],
        [16,83,0.5],[16.5,79,0.5],[17,76,1],[18,74,0.5],[18.5,71,0.5],
        [19,72,1],[20,74,2],
        [22,76,1],[23,79,1],[24,76,2],
        [26,71,1],[27,74,1],[28,76,2],
        [30,79,1],[31,79,1]
      ];
      const bass=[[0,40],[4,36],[8,40],[12,36],[16,38],[20,40],[24,36],[26,38],[28,40],[30,36]];
      const pad=[[0,[57,60,64]],[8,[53,57,60]],[16,[48,52,55]],[24,[55,59,62]]];
      const schedule=(t0)=>{
        lead.forEach(n=>tone({type:'square',f:mf(n[1]),t:t0+n[0]*spb,dur:n[2]*spb*0.9,g:0.04,a:0.008,dest:g}));
        bass.forEach(n=>tone({type:'triangle',f:mf(n[1]),t:t0+n[0]*spb,dur:1.8*spb,g:0.045,a:0.01,dest:g}));
        pad.forEach(n=>n[1].forEach(m=>tone({type:'sine',f:mf(m),t:t0+n[0]*spb,dur:6*spb,g:0.012,a:0.3,dest:g})));
        L.nextT=t0+loopBeats*spb;
        L.timer=setTimeout(()=>{if(L.on)schedule(L.nextT);},loopBeats*spb*1000-300);
      };
      schedule(now()+0.15);
      return L;
    }
  };

  function startLoop(name){
    if(loops[name]&&loops[name].on)return;
    if(!loopBuilders[name])return;
    loops[name]=loopBuilders[name]();
    loops[name].on=true;
  }
  function stopLoop(name){
    const L=loops[name];
    if(!L)return;
    L.on=false;
    if(L.timer)clearTimeout(L.timer);
    if(L.g&&L.g!==master)fadeOut(L.g,()=>{if(L.nodes)L.nodes.forEach(n=>{try{n.stop();}catch(e){}});});
    else if(L.nodes)L.nodes.forEach(n=>{try{n.stop();}catch(e){}});
    delete loops[name];
  }

  return {
    unlock(){ensure();},
    sfx(name){if(!ctx)return;if(sfxMap[name])sfxMap[name]();},
    loop(name,on){
      const st=loopStates[name]||(loopStates[name]={on:false});
      if(st.on===on)return;
      st.on=on;
      if(!ctx)return;
      if(on)startLoop(name);else stopLoop(name);
    }
  };
})();
