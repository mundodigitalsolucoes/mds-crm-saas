// Metadata-only READ ONLY dry-run. No filesystem changes, no apply mode, no production access.
import {PrismaClient} from '@prisma/client';
if(process.argv.slice(2).some(arg=>arg!=='--dry-run'))throw Error('Only --dry-run is supported');
const url=new URL(process.env.DATABASE_URL||'http://invalid');
if(url.hostname!=='127.0.0.1'||url.port!=='5432'||url.pathname!=='/mds_crm_dev')throw Error('Disposable database required');
const db=new PrismaClient();
try{
 const result=await db.$transaction(async tx=>{
  await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
  const attachments=await tx.attachment.findMany({select:{id:true,url:true,organizationId:true,filename:true}});
  const branding=await tx.organization.findMany({select:{logo:true,favicon:true}});
  const publicBranding=new Set(branding.flatMap(o=>[o.logo,o.favicon]).filter(Boolean));
  const counts={total:attachments.length,private:0,legacy:0,unknown:0,brandingOverlap:0};
  for(const file of attachments){if(file.url==='/api/attachments/'+encodeURIComponent(file.id))counts.private++;else if(file.url===`/uploads/${file.organizationId}/${file.filename}`)counts.legacy++;else counts.unknown++;if(publicBranding.has(file.url))counts.brandingOverlap++;}
  return{mode:'metadata-read-only-dry-run',counts,filesystemChecked:false,productionAccess:false,applySupported:false,cutoverApproved:false};
 });
 console.log(JSON.stringify(result,null,2));
}finally{await db.$disconnect();}
