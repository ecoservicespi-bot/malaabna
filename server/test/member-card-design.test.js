'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Design=require('../member-card-design');
const valid={title:' بطاقة النادي ',palette:'green',showPhoto:true,showSchoolFr:false,photoWidthMm:19,photoHeightMm:25,photoFit:'cover',photoZoomPercent:100,photoPositionX:50,photoPositionY:50,photoRotateDeg:30,photoBrightnessPercent:120,photoContrastPercent:80,photoFlipH:true,fields:{birth:true,birthplace:false,category:true,address:false,validity:true,reg:false}};

test('normalizes only supported card fields and presets',()=>{
 const result=Design.normalizeDesign(valid);
 assert.deepEqual(result,{title:'بطاقة النادي',palette:'green',showPhoto:true,showSchoolFr:false,photoWidthMm:19,photoHeightMm:25,photoFit:'cover',photoZoomPercent:100,photoPositionX:50,photoPositionY:50,photoRotateDeg:30,photoBrightnessPercent:120,photoContrastPercent:80,photoFlipH:true,fields:{birth:true,birthplace:false,category:true,address:false,validity:true,reg:false}});
});
test('rejects malformed palettes, field types, and injected field names',()=>{
 assert.equal(Design.normalizeDesign({...valid,palette:'custom-css'}),null);
 assert.equal(Design.normalizeDesign({...valid,fields:{...valid.fields,birth:'yes'}}),null);
 assert.equal(Design.normalizeDesign({...valid,fields:{...valid.fields,unexpected:true}}),null);
});
test('legacy designs get defaults and image dimensions are range-checked',()=>{
 const legacy={...valid};delete legacy.photoWidthMm;delete legacy.photoHeightMm;delete legacy.photoFit;delete legacy.photoZoomPercent;delete legacy.photoPositionX;delete legacy.photoPositionY;delete legacy.photoRotateDeg;delete legacy.photoBrightnessPercent;delete legacy.photoContrastPercent;delete legacy.photoFlipH;
 assert.equal(Design.normalizeDesign(legacy).photoWidthMm,19);
 assert.equal(Design.normalizeDesign(legacy).photoHeightMm,25);
 assert.equal(Design.normalizeDesign(legacy).photoFit,'cover');
 assert.equal(Design.normalizeDesign(legacy).photoZoomPercent,100);
 assert.equal(Design.normalizeDesign(legacy).photoPositionX,50);
 assert.equal(Design.normalizeDesign(legacy).photoPositionY,50);
 assert.equal(Design.normalizeDesign(legacy).photoRotateDeg,0);
 assert.equal(Design.normalizeDesign(legacy).photoBrightnessPercent,100);
 assert.equal(Design.normalizeDesign(legacy).photoContrastPercent,100);
 assert.equal(Design.normalizeDesign(legacy).photoFlipH,false);
 assert.equal(Design.normalizeDesign(legacy,{photoRotateDeg:-90,photoBrightnessPercent:130,photoContrastPercent:60,photoFlipH:true}).photoRotateDeg,-90);
 assert.equal(Design.normalizeDesign(legacy,{photoRotateDeg:-90,photoBrightnessPercent:130,photoContrastPercent:60,photoFlipH:true}).photoBrightnessPercent,130);
 assert.equal(Design.normalizeDesign(legacy,{photoRotateDeg:-90,photoBrightnessPercent:130,photoContrastPercent:60,photoFlipH:true}).photoContrastPercent,60);
 assert.equal(Design.normalizeDesign(legacy,{photoRotateDeg:-90,photoBrightnessPercent:130,photoContrastPercent:60,photoFlipH:true}).photoFlipH,true);
 assert.equal(Design.normalizeDesign(legacy,{photoWidthMm:22,photoHeightMm:27}).photoWidthMm,22);
 assert.equal(Design.normalizeDesign(legacy,{photoWidthMm:22,photoHeightMm:27}).photoHeightMm,27);
 assert.equal(Design.normalizeDesign(legacy,{photoFit:'contain',photoPositionY:70}).photoFit,'contain');
 assert.equal(Design.normalizeDesign(legacy,{photoZoomPercent:160}).photoZoomPercent,160);
 assert.equal(Design.normalizeDesign(legacy,{photoPositionX:75}).photoPositionX,75);
 assert.equal(Design.normalizeDesign(legacy,{photoFit:'contain',photoPositionY:70}).photoPositionY,70);
 assert.equal(Design.normalizeDesign({...valid,photoWidthMm:24}),null);
 assert.equal(Design.normalizeDesign({...valid,photoHeightMm:'28'}),null);
 assert.equal(Design.normalizeDesign({...valid,photoFit:'stretch'}),null);
 assert.equal(Design.normalizeDesign({...valid,photoZoomPercent:201}),null);
 assert.equal(Design.normalizeDesign({...valid,photoPositionX:-1}),null);
 assert.equal(Design.normalizeDesign({...valid,photoPositionY:101}),null);
 assert.equal(Design.normalizeDesign({...valid,photoRotateDeg:181}),null);
 assert.equal(Design.normalizeDesign({...valid,photoRotateDeg:45.5}),null);
 assert.equal(Design.normalizeDesign({...valid,photoBrightnessPercent:49}),null);
 assert.equal(Design.normalizeDesign({...valid,photoBrightnessPercent:'120'}),null);
 assert.equal(Design.normalizeDesign({...valid,photoContrastPercent:151}),null);
 assert.equal(Design.normalizeDesign({...valid,photoFlipH:'yes'}),null);
});
test('limits saved titles and falls back to a safe default',()=>{
 assert.equal(Design.normalizeDesign({...valid,title:'   '}).title,'بطاقة اللاعب');
 assert.equal(Design.normalizeDesign({...valid,title:'x'.repeat(100)}).title.length,48);
});
test('only admins can save the shared design; delegated studio permission no longer grants access',()=>{
 assert.equal(Design.canEdit({role:'admin',permissions:[]}),true);
 assert.equal(Design.canEdit({role:'admin',permissions:['cards','cardStudio']}),true);
 assert.equal(Design.canEdit({role:'member',permissions:['cards','cardStudio']}),false);
 assert.equal(Design.canEdit({role:'member',permissions:['cards']}),false);
 assert.equal(Design.canEdit({role:'member',permissions:['cardStudio']}),false);
 assert.equal(Design.canEdit({role:'coach',permissions:['cards','cardStudio']}),false);
 assert.equal(Design.canEdit(null),false);
 assert.equal(Design.canEdit({}),false);
});
test('HTTP save path rechecks session, permission, and server version before atomic commit',()=>{
 const fs=require('node:fs');const path=require('node:path');
 const server=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
 assert.match(server,/function commitMemberCardDesign\(req\)[\s\S]*?sessionFromRequest\(req\)[\s\S]*?MemberCardDesign\.canEdit\(auth\.user\)[\s\S]*?base!==String\(current\.updatedAt\|\|''\)[\s\S]*?guardedWrite\(/);
 assert.match(server,/app\.post\('\/api\/auth\/card-design'/);
});
