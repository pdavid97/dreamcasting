# 원작 대표 이미지 자동 선택. 원작 캐스팅이 함께 나온 단체 이미지가 있으면 그것, 없으면 원작 포스터
# 얼굴 "위치"만 찾고(YuNet) 누구인지는 판별하지 않음. 필요한 얼굴 수 = max(원작 배역 수, 원작 배역 배우의 크레딧 순번 최댓값)
# 입력: topics.json [{id,tm,poster,need}]  출력: oart.json {id:{kind,path,w,h,faces,src}}
import json,os,sys,urllib.request,cv2
sys.path.insert(0,'/tmp/gp');exec(open('/tmp/gp/res.py').read().split('C=json.load')[0])
det=cv2.FaceDetectorYN.create('/tmp/faces/yunet.onnx','',(320,320),0.85);os.makedirs('/tmp/gp/img',exist_ok=True)
def faces(fn):
    im=cv2.imread(fn);h,w=im.shape[:2];det.setInputSize((w,h));_,f=det.detect(im)
    F=[] if f is None else [[round(float(x[0]/w),4),round(float(x[1]/h),4),round(float(x[2]/w),4),round(float(x[3]/h),4)] for x in f if x[2]*x[3]>=w*h*.004]
    return sorted(F),w,h
def get(p,sz):
    fn='/tmp/gp/img/'+p.strip('/')
    if not os.path.exists(fn):urllib.request.urlretrieve(f'https://image.tmdb.org/t/p/{sz}'+p,fn)
    return fn
out={}
for t in json.load(open(sys.argv[1])):
    need=t['need'];best=None
    L=call({'imgs':t['tm']}) or {}
    cands=[('poster',x) for x in (L.get('posters') or [])[:20] if x.get('l') in ('ko','en',None)]+[('still',x) for x in (L.get('backdrops') or [])[:15]]
    for k,x in cands:
        try:F,w,h=faces(get(x['p'],'w500' if k=='poster' else 'w780'))
        except Exception:continue
        if len(F)<need:continue
        A=sorted(f[2]*f[3] for f in F);top=A[-need:];ratio=top[0]/top[-1]
        if ratio<.3 or top[0]<.006:continue
        G=sorted(F,key=lambda f:-f[2]*f[3])[:need];ys=[f[1]+f[3]/2 for f in G]
        if max(ys)-min(ys)>.45:continue  # 위아래로 흩어진 콜라주나 몽타주는 단체 사진으로 보지 않음
        sc=ratio*40+(10 if len(F)==need else 0)-max(0,len(F)-need-3)*6+(5 if k=='poster' else 0)+min(top[0]*300,15)+(x.get('v') or 0)
        if not best or sc>best[0]:best=(sc,{'kind':'group','path':x['p'],'w':w,'h':h,'faces':F,'src':k})
    if not best:
        p='/'+t['poster'].split('/')[-1];F,w,h=faces(get(p,'w500'));best=(0,{'kind':'poster','path':p,'w':w,'h':h,'faces':F,'src':'poster'})
    out[t['id']]=best[1];print(t['id'],need,best[1]['kind'],best[1]['src'],len(best[1]['faces']),best[1]['path'])
json.dump(out,open('/tmp/gp/oart.json','w'),ensure_ascii=False)
