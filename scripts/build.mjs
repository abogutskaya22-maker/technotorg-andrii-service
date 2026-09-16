import {build} from 'esbuild';
import {mkdir,copyFile,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/assets',{recursive:true});
await Promise.all(['index.html','andrii-cutout.png','THIRD_PARTY_NOTICES.txt'].map(f=>copyFile(f,`dist/${f}`)));
await build({entryPoints:['assets/photo-upload.js'],outdir:'dist/assets',bundle:true,splitting:true,format:'esm',minify:true,target:['safari15','chrome100'],legalComments:'linked'});

await mkdir('dist/licenses',{recursive:true});
await copyFile('node_modules/heic-to/LICENSE','dist/licenses/heic-to.txt');
