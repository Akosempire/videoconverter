/* Progressive enhancement: native multipart upload works without JavaScript. */
(() => {
  const $ = (id) => document.getElementById(id);
  const input = $('video');
  const preview = $('preview');
  let objectUrl;
  let busy = false;
  const time = (seconds) => {
    const value = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
    return [Math.floor(value / 3600), Math.floor(value % 3600 / 60), value % 60].map(n => String(n).padStart(2, '0')).join(':');
  };
  function feedback(message, kind = 'error') {
    const node = document.createElement('div');
    node.className = `alert ${kind}`;
    node.textContent = message;
    if (kind === 'error') node.setAttribute('role', 'alert');
    $('feedback').replaceChildren(node);
  }
  function reset() {
    preview.pause();
    preview.removeAttribute('src');
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    preview.load();
    preview.hidden = true;
    $('monitor-empty').hidden = false;
    $('source-card').hidden = true;
    $('library-empty').hidden = false;
    document.body.classList.remove('has-source');
    $('file-count').textContent = '0 files';
    $('clip-name').textContent = 'Your video will appear here';
    $('monitor-label').textContent = 'NO CLIP SELECTED';
    $('preview-info').textContent = 'Preview appears after import';
    $('timeline-status').textContent = 'Waiting for footage';
    $('export-caption').textContent = 'Import a file to start converting';
    $('timecode').textContent = '00:00:00';
    ['quarter', 'half', 'three', 'end'].forEach(key => $(`ruler-${key}`).textContent = '—');
    $('step-preview').classList.remove('is-active');
    $('step-export').classList.remove('is-active');
  }
  function selectFile() {
    reset();
    $('feedback').replaceChildren();
    const file = input.files[0];
    if (!file) return;
    if (!/\.mov$/i.test(file.name) || file.size > 500 * 1024 * 1024 || file.size === 0) {
      feedback('Choose a non-empty .MOV file no larger than 500 MB.');
      input.value = '';
      return;
    }
    $('source-card').hidden = false;
    $('library-empty').hidden = true;
    $('source-name').textContent = file.name;
    $('source-size').textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB · QuickTime video`;
    $('file-count').textContent = '1 file';
    $('clip-name').textContent = file.name;
    $('monitor-label').textContent = 'SOURCE PREVIEW';
    $('timeline-status').textContent = '1 source file ready';
    $('export-caption').textContent = 'Your original file stays unchanged';
    $('step-preview').classList.add('is-active');
    document.body.classList.add('has-source');
    objectUrl = URL.createObjectURL(file);
    preview.src = objectUrl;
    preview.hidden = false;
    $('monitor-empty').hidden = true;
  }
  input.addEventListener('change', selectFile);
  $('choose-file').addEventListener('click', () => { if (!busy) input.click(); });
  $('remove-file').addEventListener('click', () => { if (!busy) { input.value = ''; reset(); } });
  preview.addEventListener('loadedmetadata', () => {
    $('preview-info').textContent = `${preview.videoWidth} × ${preview.videoHeight} · ${time(preview.duration)}`;
    ['quarter', 'half', 'three', 'end'].forEach((key, i) => $(`ruler-${key}`).textContent = time(preview.duration * (i + 1) / 4));
  });
  preview.addEventListener('timeupdate', () => $('timecode').textContent = time(preview.currentTime));
  preview.addEventListener('error', () => {
    if (!objectUrl) return;
    preview.hidden = true;
    $('monitor-empty').hidden = false;
    $('preview-info').textContent = 'Preview unavailable for this codec';
    feedback('This browser cannot preview this MOV codec. You can still convert the file to MP4.', 'info');
  });
  const drop = $('drop-zone');
  ['dragenter', 'dragover'].forEach(event => drop.addEventListener(event, e => { e.preventDefault(); if (!busy) drop.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach(event => drop.addEventListener(event, () => drop.classList.remove('is-dragging')));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    if (busy) return;
    if (e.dataTransfer.files.length !== 1) { feedback('Please import one MOV file at a time.'); return; }
    input.files = e.dataTransfer.files;
    selectFile();
  });
  $('converter-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (busy || !input.files.length) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    busy = true;
    input.disabled = true;
    $('remove-file').disabled = true;
    $('choose-file').disabled = true;
    $('convert-button').disabled = true;
    $('convert-button').querySelector('span').textContent = 'Converting…';
    form.setAttribute('aria-busy', 'true');
    $('step-export').classList.add('is-active');
    feedback('Converting your footage. Larger files can take a few minutes. Keep this tab open.', 'info');
    try {
      const response = await fetch(form.action, { method: 'POST', body: data });
      const html = new DOMParser().parseFromString(await response.text(), 'text/html');
      const result = html.querySelector('#feedback');
      if (!result || !result.textContent.trim()) throw new Error(response.status === 413 ? 'This file exceeds the 500 MB upload limit.' : 'Conversion could not finish. Please try again.');
      $('feedback').replaceChildren(...Array.from(result.childNodes).map(n => document.importNode(n, true)));
      $('timeline-status').textContent = response.ok ? 'Export complete · Ready to download' : 'Export failed · Try again';
      if (response.ok) $('export-caption').textContent = 'Your MP4 is ready. Download it above.';
    } catch (error) {
      feedback(error.message || 'Connection interrupted. Please try again.');
      $('timeline-status').textContent = 'Export interrupted · Try again';
    } finally {
      busy = false;
      input.disabled = false;
      $('remove-file').disabled = false;
      $('choose-file').disabled = false;
      $('convert-button').disabled = false;
      $('convert-button').querySelector('span').textContent = 'Convert to MP4';
      form.removeAttribute('aria-busy');
    }
  });
})();
