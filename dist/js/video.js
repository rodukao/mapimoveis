/* Only a validated YouTube ID is persisted or used to construct an embed URL. */
window.TerraVideo = (() => {
  const isId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{11}$/.test(value);
  const message = 'Cole um link válido de um vídeo do YouTube.';
  function parse(value) {
    if (typeof value !== 'string' || value.length > 2048 || !value.trim()) return null;
    try {
      const raw = value.trim(), url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw);
      if (!['https:','http:'].includes(url.protocol) || url.username || url.password || url.port) return null;
      const host = url.hostname.toLowerCase(), path = url.pathname.replace(/\/$/, '');
      let id;
      if (host === 'youtu.be' || host === 'www.youtu.be') id = path.match(/^\/([A-Za-z0-9_-]{11})$/)?.[1];
      else if (['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host)) {
        id = path === '/watch' && url.searchParams.getAll('v').length === 1 ? url.searchParams.get('v') : path.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})$/)?.[1];
      } else if (['youtube-nocookie.com','www.youtube-nocookie.com'].includes(host)) id = path.match(/^\/embed\/([A-Za-z0-9_-]{11})$/)?.[1];
      return isId(id) ? id : null;
    } catch (_) { return null; }
  }
  const watchUrl = id => isId(id) ? 'https://www.youtube.com/watch?v=' + id : '';
  const fromDetails = details => isId(details?.youtube_video_id) ? details.youtube_video_id : null;
  function player(id, title) {
    if (!isId(id)) throw Error(message);
    const frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/' + id + '?playsinline=1&rel=0';
    frame.title = 'Vídeo do imóvel — ' + (title || 'YouTube');
    frame.allow = 'accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    return frame;
  }
  function validateEditor() {
    const input = document.getElementById('youtube-url'), error = document.getElementById('youtube-error');
    const invalid = Boolean(input.value.trim()) && !parse(input.value);
    input.setCustomValidity(invalid ? message : '');
    input.setAttribute('aria-invalid', String(invalid));
    error.textContent = invalid ? message : ''; error.hidden = !invalid;
    return !invalid;
  }
  function fillEditor(details) {
    document.getElementById('youtube-url').value = watchUrl(fromDetails(details));
    validateEditor();
  }
  function editorId() {
    if (!validateEditor()) throw Error(message);
    return parse(document.getElementById('youtube-url').value);
  }
  function bindEditor() {
    const input = document.getElementById('youtube-url');
    input.addEventListener('input', () => {
      input.setCustomValidity(''); input.removeAttribute('aria-invalid');
      document.getElementById('youtube-error').hidden = true;
    });
    input.addEventListener('change', validateEditor);
  }
  return {isId,parse,watchUrl,fromDetails,player,validateEditor,fillEditor,editorId,bindEditor};
})();
