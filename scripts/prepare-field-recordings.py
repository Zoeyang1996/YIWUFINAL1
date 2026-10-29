"""Prepare CC0 field recordings; never synthesize dialogue or crowd voices.
Usage: python scripts/prepare-field-recordings.py --ffmpeg <exe> --sources <directory>
Source URLs and license are recorded in assets/audio/ambience/SOURCES.md.
"""
import argparse, json, subprocess
from pathlib import Path
import numpy as np

parser=argparse.ArgumentParser();parser.add_argument('--ffmpeg',required=True);parser.add_argument('--sources',required=True)
args=parser.parse_args();root=Path(__file__).resolve().parents[1];out=root/'assets/audio/ambience';out.mkdir(parents=True,exist_ok=True)
rate=24000;report=[]
for id,start,rms in [('morning',12,.10),('noon',8,.12),('night',28,.10)]:
    raw=subprocess.check_output([args.ffmpeg,'-v','error','-ss',str(start),'-i',str(Path(args.sources)/(id+'.mp3')),
        '-t','50','-ar',str(rate),'-ac','2','-f','f32le','pipe:1'])
    audio=np.frombuffer(raw,dtype='<f4').reshape(-1,2).copy();assert len(audio)==50*rate
    audio-=audio.mean(axis=0);fade=2*rate;t=np.linspace(0,1,fade)[:,None]
    loop=audio[fade:].copy();loop[-fade:]=audio[-fade:]*(1-t)+audio[:fade]*t
    loop*=rms/max(np.sqrt(np.mean(loop**2)),.001)
    # A soft limiter reins in isolated horn/transient peaks without making the bed inaudible.
    loop=np.tanh(loop/.6)*.6
    subprocess.run([args.ffmpeg,'-y','-v','error','-f','f32le','-ar',str(rate),'-ac','2','-i','pipe:0',
        '-c:a','libmp3lame','-b:a','112k',str(out/(id+'-field.mp3'))],input=loop.astype('<f4').tobytes(),check=True)
    report.append({'id':id,'duration':48,'rms':float(np.sqrt(np.mean(loop**2))),'peak':float(np.abs(loop).max()),
        'bytes':(out/(id+'-field.mp3')).stat().st_size,'loopJoinDelta':float(np.max(np.abs(loop[-1]-loop[0])))})
(out/'levels.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8');print(json.dumps(report,indent=2))
