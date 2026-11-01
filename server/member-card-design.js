'use strict';
const PALETTES=new Set(['blue','green','gold','violet']);
const FIELDS=['birth','birthplace','category','address','validity','reg'];
function normalizeDesign(value,fallback){
 if(!value||typeof value!=='object'||Array.isArray(value)||!PALETTES.has(value.palette))return null;
 if(typeof value.showPhoto!=='boolean'||typeof value.showSchoolFr!=='boolean')return null;
 if(!value.fields||typeof value.fields!=='object'||Array.isArray(value.fields))return null;
 const fields={};
 for(const key of FIELDS){if(typeof value.fields[key]!=='boolean')return null;fields[key]=value.fields[key];}
 if(Object.keys(value.fields).some(key=>!FIELDS.includes(key)))return null;
 const prior=fallback&&typeof fallback==='object'?fallback:{};
 const photoWidthMm=value.photoWidthMm===undefined?(Number.isInteger(prior.photoWidthMm)?prior.photoWidthMm:19):value.photoWidthMm;
 const photoHeightMm=value.photoHeightMm===undefined?(Number.isInteger(prior.photoHeightMm)?prior.photoHeightMm:25):value.photoHeightMm;
 const photoFit=value.photoFit===undefined?(prior.photoFit==='contain'?'contain':'cover'):value.photoFit;
 const photoZoomPercent=value.photoZoomPercent===undefined?(Number.isInteger(prior.photoZoomPercent)?prior.photoZoomPercent:100):value.photoZoomPercent;
 const photoPositionX=value.photoPositionX===undefined?(Number.isInteger(prior.photoPositionX)?prior.photoPositionX:50):value.photoPositionX;
 const photoPositionY=value.photoPositionY===undefined?(Number.isInteger(prior.photoPositionY)?prior.photoPositionY:50):value.photoPositionY;
 const photoRotateDeg=value.photoRotateDeg===undefined?(Number.isInteger(prior.photoRotateDeg)?prior.photoRotateDeg:0):value.photoRotateDeg;
 const photoBrightnessPercent=value.photoBrightnessPercent===undefined?(Number.isInteger(prior.photoBrightnessPercent)?prior.photoBrightnessPercent:100):value.photoBrightnessPercent;
 const photoContrastPercent=value.photoContrastPercent===undefined?(Number.isInteger(prior.photoContrastPercent)?prior.photoContrastPercent:100):value.photoContrastPercent;
 const photoFlipH=value.photoFlipH===undefined?(prior.photoFlipH===true):value.photoFlipH;
 if(!Number.isInteger(photoWidthMm)||photoWidthMm<14||photoWidthMm>23)return null;
 if(!Number.isInteger(photoHeightMm)||photoHeightMm<17||photoHeightMm>28)return null;
 if(photoFit!=='cover'&&photoFit!=='contain')return null;
 if(!Number.isInteger(photoZoomPercent)||photoZoomPercent<100||photoZoomPercent>200)return null;
 if(!Number.isInteger(photoPositionX)||photoPositionX<0||photoPositionX>100)return null;
 if(!Number.isInteger(photoPositionY)||photoPositionY<0||photoPositionY>100)return null;
 if(!Number.isInteger(photoRotateDeg)||photoRotateDeg<-180||photoRotateDeg>180)return null;
 if(!Number.isInteger(photoBrightnessPercent)||photoBrightnessPercent<50||photoBrightnessPercent>150)return null;
 if(!Number.isInteger(photoContrastPercent)||photoContrastPercent<50||photoContrastPercent>150)return null;
 if(typeof photoFlipH!=='boolean')return null;
 const title=String(value.title||'').replace(/\s+/g,' ').trim().slice(0,48)||'بطاقة اللاعب';
 return {title,palette:value.palette,showPhoto:value.showPhoto,showSchoolFr:value.showSchoolFr,photoWidthMm,photoHeightMm,photoFit,photoZoomPercent,photoPositionX,photoPositionY,photoRotateDeg,photoBrightnessPercent,photoContrastPercent,photoFlipH,fields};
}
function canEdit(user){
 if(!user)return false;
 return user.role==='admin';
}
module.exports={normalizeDesign,canEdit,PALETTES,FIELDS};
