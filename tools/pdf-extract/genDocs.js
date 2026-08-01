const fs=require('fs');
const lines=fs.readFileSync('C:\\code\\lsfa-central\\reference\\SACC-coding-index.txt','utf8').split('\n');
let m=new Map();
for(let l of lines){
  let match=l.match(/^(\d{4})\s+(.+)$/);
  if(match) m.set(match[1], match[2].trim());
}
let out='export const countryIdentifierOptions = [\n';
m.forEach((v,k)=>{ out += \  { value: "\", label: "\" },\n\; });
out+='];\n';
fs.writeFileSync('C:\\code\\lsfa-central\\frontend\\src\\pages\\SACC.ts',out);
