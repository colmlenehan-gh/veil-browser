import {build} from 'esbuild';
await build({entryPoints:['lib/sanitizer-entry.cjs'],outfile:'lib/generated/sanitize.cjs',platform:'node',format:'cjs',target:'node24',bundle:true,legalComments:'inline',logLevel:'warning'});
