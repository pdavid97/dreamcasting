import cv2,numpy as np,math,sys,json
det=cv2.FaceDetectorYN.create('yunet.onnx','',(320,320),0.6)
def face(path):
    im=cv2.imread(path)
    if im is None: return None
    h,w=im.shape[:2];det.setInputSize((w,h));_,f=det.detect(im)
    if f is None or not len(f): return None
    f=max(f,key=lambda r:r[2]*r[3]*r[14])
    x,y,bw,bh=f[:4];re_=f[4:6];le=f[6:8];nose=f[8:10];rm=f[10:12];lm=f[12:14]
    ec=(re_+le)/2;mc=(rm+lm)/2
    em=np.linalg.norm(mc-ec);iod=np.linalg.norm(le-re_);chin=(y+bh)-ec[1]
    roll=math.degrees(math.atan2(le[1]-re_[1],le[0]-re_[0]))
    return [round(float(ec[0]/w),4),round(float(ec[1]/h),4),round(float(em/h),4),round(float(iod/h),4),round(float(chin/h),4),round(float(roll),2),round(float(f[14]),3),round(float(bw*bh/(w*h)),3)]
if __name__=='__main__': print(face(sys.argv[1]))
