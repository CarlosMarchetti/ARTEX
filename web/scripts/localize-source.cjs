// Development-only migration: extract literal UI copy without modifying comments,
// identifiers, URLs, or TypeScript syntax. The resulting source has no runtime
// dependency on a translation service.
const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const han = /[\u3400-\u9fff]/;
function files(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir,e.name)] : []);
}
const occurrences=[];
for(const file of files(path.join(root,'src'))) {
  const source=fs.readFileSync(file,'utf8');
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  function visit(node) {
    let start=node.getStart(tree), end=node.end, kind='';
    if(ts.isStringLiteral(node)) { start++;end--;kind=ts.isJsxAttribute(node.parent)?'attribute':'string'; }
    else if(ts.isJsxText(node)) {
      start=node.pos;
      const raw=source.slice(start,end);
      start+=raw.length-raw.trimStart().length;
      end-=raw.length-raw.trimEnd().length;
      kind='jsx';
    } else if(node.kind===ts.SyntaxKind.NoSubstitutionTemplateLiteral) {start++;end--;kind='template';}
    else if(node.kind===ts.SyntaxKind.TemplateHead || node.kind===ts.SyntaxKind.TemplateMiddle) { start++;end-=2;kind='template';}
    else if(node.kind===ts.SyntaxKind.TemplateTail) {start++;end--;kind='template';}
    if(kind) {
      const text=source.slice(start,end);
      if(han.test(text)) occurrences.push({file:path.relative(root,file).replaceAll('\\','/'),start,end,kind,text,quote:source[node.getStart(tree)]});
    }
    ts.forEachChild(node,visit);
  }
  visit(tree);
}
const catalogPath=path.join(root,'../translations/pt-BR.json');
if(process.argv.includes('--extract')) {
  fs.mkdirSync(path.dirname(catalogPath),{recursive:true});
  fs.writeFileSync(path.join(root,'../translations/ui-occurrences.json'),JSON.stringify(occurrences,null,2));
  console.log(`${occurrences.length} occurrences; ${new Set(occurrences.map(o=>o.text)).size} distinct UI strings`);
} else {
  const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
  const grouped=new Map();
  for(const item of occurrences) {
    if(!Object.hasOwn(catalog,item.text)) throw Error(`Missing translation: ${item.text}`);
    if(!grouped.has(item.file))grouped.set(item.file,[]);
    grouped.get(item.file).push(item);
  }
  for(const [file,items] of grouped) {
    let content=fs.readFileSync(path.join(root,file),'utf8');
    for(const item of items.sort((a,b)=>b.start-a.start)) {
      let translated=catalog[item.text];
      // Keep separators surrounding interpolated values and decode literal
      // newline escapes before escaping the resulting source again.
      if(item.kind!=='jsx' && item.kind!=='attribute') {
        translated=translated.replaceAll('\\n','\n').replaceAll('\\t','\t');
        const leading=item.text.match(/^\s*/)[0], trailing=item.text.match(/\s*$/)[0];
        translated=leading+translated.trim()+trailing;
      }
      if(item.kind==='jsx'||item.kind==='attribute') {
        translated=translated.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('{','&#123;').replaceAll('}','&#125;').replaceAll('"','&quot;');
      } else {
        translated=translated.replaceAll('\\','\\\\');
        if(item.kind==='template') translated=translated.replaceAll('`','\\`').replaceAll('${','\\${');
        else translated=translated.replaceAll(item.quote,'\\'+item.quote);
        translated=translated.replaceAll('\r','\\r').replaceAll('\n','\\n');
      }
      content=content.slice(0,item.start)+translated+content.slice(item.end);
    }
    fs.writeFileSync(path.join(root,file),content);
  }
  console.log(`Localized ${grouped.size} source files.`);
}
