/* Shared DOM helpers keep user-supplied text out of HTML templates. */
window.TerraUI = (() => {
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key,value] of Object.entries(attrs)) {
      if (key === 'class') node.className = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else if (key in node && !key.startsWith('aria')) node[key] = value;
      else node.setAttribute(key,String(value));
    }
    node.append(...children.flat().filter(child => child !== null && child !== undefined));
    return node;
  }
  function dialog(title, {wide = false} = {}) {
    const heading = el('h2', {id:'dialog-title-'+crypto.randomUUID()}, title);
    const content = el('div', {class:'panel-content'});
    const close = el('button', {type:'button','aria-label':'Fechar'}, '×');
    const node = el('dialog', {class:'terra-panel'+(wide?' panel-wide':''),'aria-labelledby':heading.id}, el('div',{class:'panel-header'},heading,close),content);
    close.onclick = () => node.close();
    node.addEventListener('close', () => {const toast=node.querySelector('#toast');if(toast)document.body.append(toast);node.remove();}, {once:true});
    document.body.append(node); node.showModal();
    return {node,content,close};
  }
  function error(container, exception) {
    const msg = el('p',{class:'operation-message',role:'alert'},window.TerraData.explain(exception));
    container.querySelector('.operation-message')?.remove(); container.append(msg);
  }
  async function busy(button, task, target = button.parentElement) {
    if (button.disabled) return;
    const label = button.textContent;
    button.disabled = true; button.textContent = 'Aguarde…';
    try { return await task(); } catch (exception) { error(target,exception); }
    finally { button.disabled = false; button.textContent = label; }
  }
  function field(label, node) { return el('label',{},label,node); }
  function options(values, value = '') { return Object.entries(values).map(([key,label]) => new Option(label,key,false,key === value)); }
  return {el,dialog,error,busy,field,options};
})();
