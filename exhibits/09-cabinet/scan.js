/* ---------- a real HTML/JS scanner ----------
   Naive counting is wrong: this very file contains the text
   "<script>" inside its own strings. So we walk the document and
   skip quoted strings, template literals and comments — which also
   lets us detect genuinely broken files (unclosed blocks, unclosed
   strings), not just missing tags. */
function scanScripts(html){
  const scripts = [];
  const errors = [];
  let i = 0;
  while(true){
    const open = html.indexOf('<script', i);
    if(open < 0) break;
    const gt = html.indexOf('>', open);
    if(gt < 0){ errors.push('unterminated <script tag'); break; }
    const tag = html.slice(open, gt+1);
    const isSrc = /\bsrc\s*=/.test(tag);
    const type = (tag.match(/type\s*=\s*["']([^"']+)/)||[])[1] || '';

    let j = gt+1, mode = 'code', body = '';
    for(; j < html.length; j++){
      const c = html[j], n = html[j+1];
      if(mode === 'code'){
        if(c === '/' && n === '/'){ mode='line'; body+=c; j++; body+=n; continue; }
        if(c === '/' && n === '*'){ mode='block'; body+=c; j++; body+=n; continue; }
        if(c === "'" || c === '"'){ mode=c; body+=c; continue; }
        if(c === '`'){ mode='tpl'; body+=c; continue; }
        if(c === '<' && html.startsWith('</script', j)) break;
      } else if(mode === 'line'){
        if(c === '\n') mode='code';
      } else if(mode === 'block'){
        if(c === '*' && n === '/'){ mode='code'; body+=c; j++; body+=n; continue; }
      } else if(mode === "'" || mode === '"'){
        if(c === '\\'){ body+=c; j++; body+=html[j]; continue; }
        if(c === mode) mode='code';
      } else if(mode === 'tpl'){
        if(c === '\\'){ body+=c; j++; body+=html[j]; continue; }
        if(c === '`') mode='code';
      }
      body += c;
    }
    if(j >= html.length){ errors.push('script block never closed'); scripts.push({body,src:isSrc,type}); break; }
    if(mode !== 'code') errors.push('unclosed string or comment inside a script block');
    const srcUrl = isSrc ? ((tag.match(/src\s*=\s*["']([^"']+)/)||[])[1] || '') : '';
    scripts.push({ body, src:srcUrl, type });
    i = html.indexOf('>', j) + 1;
  }
  return { scripts, errors };
}


window.scanScripts = scanScripts;
