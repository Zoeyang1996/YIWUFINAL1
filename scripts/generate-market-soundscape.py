"""Create three original market soundscapes.
Requires numpy and macOS say voices. All speech is synthetic, not actor recordings.
Generated PCM assets work independently of the visitor's OS/speech voices.
"""
from pathlib import Path
import json, subprocess, tempfile, wave
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets/audio'
RATE, SECONDS = 24000, 48
COUNT = RATE * SECONDS
rng = np.random.default_rng(20261030)

def read_wav(file):
    with wave.open(str(file)) as w:
        assert w.getsampwidth()==2 and w.getframerate()==RATE
        x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768
        if w.getnchannels()>1: x=x.reshape(-1,w.getnchannels()).mean(axis=1)
    return x

def speech(text, voice, rate, file):
    name=voice if voice=='Tingting' else f'{voice} (中文（中国大陆）)'
    subprocess.run(['say','-v',name,'-r',str(rate),'-o',str(file),'--file-format=WAVE',f'--data-format=LEI16@{RATE}',text],check=True,timeout=45)
    x=read_wav(file)
    active=np.flatnonzero(np.abs(x)>.008)
    if not len(active): raise RuntimeError(f'Silent voice: {name}')
    x=x[max(0,active[0]-int(.045*RATE)):min(len(x),active[-1]+int(.13*RATE))]
    x-=x.mean()
    # Normalize speech loudness while retaining headroom for consonants.
    x*=min(.17/max(np.sqrt(np.mean(x*x)),.001),.78/max(np.abs(x)))
    edge=min(120,len(x)//4);x[:edge]*=np.linspace(0,1,edge);x[-edge:]*=np.linspace(1,0,edge)
    return x

def write(file,x):
    file.parent.mkdir(parents=True,exist_ok=True)
    with wave.open(str(file),'wb') as w:
        w.setnchannels(1 if x.ndim==1 else x.shape[1]);w.setsampwidth(2);w.setframerate(RATE)
        w.writeframes((np.clip(x,-.99,.99)*32767).astype('<i2').tobytes())

def lowpass(x,hz):
    # Symmetric frequency filter for off-screen, distant sound.
    f=np.fft.rfftfreq(len(x),1/RATE)
    return np.fft.irfft(np.fft.rfft(x)/(1+(f/hz)**4),n=len(x))

def layer(mix,x,at,gain=1,pan=0):
    idx=(int(at*RATE)+np.arange(len(x)))%COUNT
    mix[idx]+=x[:,None]*gain*np.array([np.sqrt((1-pan)/2),np.sqrt((1+pan)/2)])

def noise(seconds,cutoff):
    x=lowpass(rng.normal(size=int(seconds*RATE)),cutoff)
    return x/max(np.std(x),.001)

def knock(f=340,duration=.15):
    t=np.arange(int(duration*RATE))/RATE
    return (np.sin(2*np.pi*f*t)+.3*np.sin(2*np.pi*f*2.7*t))*np.exp(-t*45)*(1-np.exp(-t*1800))

def bird():
    t=np.arange(int(.65*RATE))/RATE
    freq=2400+700*np.sin(2*np.pi*t*4)+400*t
    env=np.sin(np.pi*np.minimum(1,t/.65))**2*(.5+.5*np.sin(t*2*np.pi*9))**3
    return np.sin(2*np.pi*np.cumsum(freq)/RATE)*env

def environment(phase,crowd):
    mix=np.zeros((COUNT,2))
    time=np.arange(COUNT)/RATE
    wind=noise(SECONDS,280)
    layer(mix,wind*(.7+.3*np.sin(2*np.pi*time/SECONDS*3)),0,.006 if phase!='night' else .009,-.2)
    if phase!='night':
        # Multiple separate conversations, staggered around the street.
        density=4 if phase=='morning' else 7
        for speaker in range(density):
            at=rng.uniform(-4,1)
            while at<SECONDS:
                x=crowd[rng.integers(len(crowd))]
                speed=rng.uniform(.94,1.07)
                x=np.interp(np.arange(0,len(x),speed),np.arange(len(x)),x)
                x=lowpass(x,rng.uniform(700,1400))
                layer(mix,x,at,.10 if phase=='morning' else .14,rng.uniform(-.9,.9))
                at+=len(x)/RATE+rng.uniform(.8,3.2)
        # A few recognizable calls set the scene without a constant announcer.
        for at in np.arange(3,SECONDS,11 if phase=='morning' else 7):
            layer(mix,lowpass(crowd[int(at)%len(crowd)],2100),at,.30 if phase=='morning' else .36,rng.uniform(-.65,.65))
        for at in np.arange(.7,SECONDS,.8 if phase=='morning' else .48):
            layer(mix,knock(rng.uniform(100,170),.13),at+rng.uniform(-.1,.1),rng.uniform(.012,.028),rng.uniform(-.8,.8))
        if phase=='morning':
            for at in [2,12,25,39]: layer(mix,bird(),at,.025,rng.uniform(-.8,.8))
            for at in np.arange(1.5,SECONDS,3.8):
                t=np.arange(int(.45*RATE))/RATE
                cup=(np.sin(2*np.pi*1720*t)+.35*np.sin(2*np.pi*2670*t))*np.exp(-t*15)*(1-np.exp(-t*1500))
                layer(mix,cup,at,.026,.55)
            steam=noise(3,2200)*np.sin(np.linspace(0,np.pi,3*RATE))**2
            for at in [5,19,34]: layer(mix,steam,at,.006,-.65)
        else:
            for at in [1,13,28,40]:
                t=np.arange(4*RATE)/RATE
                wheel=noise(4,450)*(.45+.55*np.sin(2*np.pi*5.2*t)**2)*np.sin(np.pi*t/4)**2
                layer(mix,wheel,at,.018,-.45)
            for at in np.arange(2,SECONDS,2.7): layer(mix,knock(480),at,.038,.6)
    else:
        # Night is deliberately free of voices, calls, crockery, and cart traffic.
        water=noise(SECONDS,1200)*(.6+.4*np.sin(2*np.pi*time/SECONDS*5)**2)
        layer(mix,water,0,.0025,.65)
        for at in [1,6.7,14,22.8,33,42]:
            t=np.arange(int(1.1*RATE))/RATE
            pulse=np.maximum(0,np.sin(2*np.pi*13*t))**7
            cricket=np.sin(2*np.pi*3650*t)*pulse*np.sin(np.pi*t/1.1)**2
            layer(mix,cricket,at,.015,rng.uniform(-.8,.8))
        for at in [10,36]: layer(mix,knock(830,.3),at,.009,-.7)
    dry=mix.copy()
    for delay,gain in [(.073,.10),(.163,.06),(.297,.035)]: mix+=np.roll(dry[:,::-1],int(delay*RATE),axis=0)*gain
    mix-=mix.mean(axis=0)
    # Preserve the intentional loudness difference; never normalize night to noon.
    mix*=min(1,.65/max(np.abs(mix).max(),.001))
    edge=240;mix[:edge]*=np.linspace(0,1,edge)[:,None];mix[-edge:]*=np.linspace(1,0,edge)[:,None]
    return mix

reports=[]
with tempfile.TemporaryDirectory(prefix='yiwu-voices-') as tmp:
    tmp=Path(tmp)
    morning=[];noon=[]
    for i,(text,voice) in enumerate([
        ('热乎的早点，刚出锅。','Grandma'),('来碗热茶吧。','Eddy'),('早啊，给我来一份。','Sandy'),('好嘞，您慢走。','Rocko'),
        ('看看这料子，多好。','Flo'),('这个怎么卖呀？','Shelley'),('便宜一些吧。','Reed'),('好，您拿好。','Tingting'),('借过，借过。','Grandpa'),
    ]):
        x=speech(text,voice,170,tmp/f'crowd-{i}.wav')
        (morning if i<4 else noon).append(x)
    for phase in ['morning','noon','night']:
        x=environment(phase,morning if phase=='morning' else noon)
        write(OUT/f'ambience/{phase}.wav',x)
        reports.append({'phase':phase,'seconds':SECONDS,'rms':round(float(np.sqrt(np.mean(x*x))),4),'peak':round(float(np.abs(x).max()),4)})
ambiences={p:{'file':f'assets/audio/ambience/{p}.wav','duration':SECONDS} for p in ['morning','noon','night']}
(ROOT/'js/data/soundscape.js').write_text('// Generated by scripts/generate-market-soundscape.py; phase-specific ambience.\nexport const AMBIENCES = '+json.dumps(ambiences,ensure_ascii=False,indent=2)+';\n')
print(json.dumps(reports,ensure_ascii=False,indent=2))
