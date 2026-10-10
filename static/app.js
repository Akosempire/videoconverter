/* A single source of truth for empty, ready, uploading, processing and result states. */
(() => {
  const $ = id => document.getElementById(id);
  const input = $('video'), preview = $('preview'), form = $('converter-form');
  input.tabIndex = -1; // The visible import buttons provide keyboard access.
  let file = null, objectUrl = null, request = null, busy = false, generation = 0;
  const qualityDescriptions = {standard:'A balance of clarity and file size.', high:'More detail, with a larger output file.', small:'A smaller file, with more compression.'};
  const size = bytes => bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const duration = seconds => {
    if (!Number.isFinite(seconds)) return 'Unavailable';
    const total = Math.floor(seconds);
    return `${total >= 3600 ? `${Math.floor(total / 3600)}:` : ''}${String(Math.floor(total / 60) % 60).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
  };
  function message(text, kind = 'error') {
    const node = document.createElement('div');
    node.className = `alert ${kind}`;
    node.textContent = text;
    if (kind === 'error') node.setAttribute('role','alert');
    $('feedback').replaceChildren(node);
  }
  function session(text) { $('session-status').lastChild.textContent = ` ${text}`; }
  function setBusy(value) {
    busy = value;
    input.disabled = value;
    $('export-options').disabled = value;
    $('remove-file').disabled = value;
    document.querySelectorAll('[data-import], #choose-file').forEach(button => button.disabled = value);
    $('convert-button').disabled = value || !file;
    form.setAttribute('aria-busy',String(value));
  }
  function readyJob() {
    $('activity-empty').hidden = !!file;
    $('job').hidden = !file;
    $('job').classList.remove('is-complete','is-error');
    $('download-button').hidden = true;
    $('download-button').removeAttribute('href');
    $('progress').value = 0;
    $('progress').setAttribute('aria-label','Upload progress');
    $('job-status').textContent = 'Ready to convert';
    $('job-detail').textContent = 'Choose your export settings, then convert.';
    $('activity-label').textContent = file ? 'READY' : 'NOT STARTED';
  }
  function clearSource() {
    generation += 1;
    preview.pause();
    preview.removeAttribute('src');
    preview.load();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    file = null;
    preview.hidden = true;
    $('thumbnail').hidden = true;
    $('thumbnail').removeAttribute('src');
    $('thumbnail-fallback').hidden = false;
    $('thumbnail-duration').textContent = '';
    $('preview-empty').hidden = false;
    $('preview-unavailable').hidden = true;
    $('preview-label').textContent = 'NO FILE SELECTED';
    $('preview-note').textContent = 'A preview will appear after you add a file';
    $('media-empty').hidden = false;
    ['media-card','source-details','media-actions'].forEach(id => $(id).hidden = true);
    document.body.classList.remove('has-file');
    $('file-count').textContent = '0';
    $('export-caption').textContent = 'Add a file to start converting.';
    $('convert-button').querySelector('span').textContent = 'Convert to MP4';
    $('feedback').replaceChildren();
    readyJob();
    setBusy(false);
    session('Ready when you are');
  }
  function importSource() { if (!busy) input.click(); }
  $('choose-file').addEventListener('click',importSource);
  document.querySelectorAll('[data-import]').forEach(button => button.addEventListener('click',importSource));
  $('remove-file').addEventListener('click', () => { if (!busy) { input.value = ''; clearSource(); $('choose-file').focus(); } });
  input.addEventListener('change', () => {
    if (busy) return;
    const selected = input.files[0];
    if (!selected) return;
    clearSource();
    if (!/\.mov$/i.test(selected.name) || selected.size === 0 || selected.size > 500 * 1024 * 1024) {
      input.value = '';
      message('Choose a non-empty MOV file no larger than 500 MB.');
      return;
    }
    file = selected;
    objectUrl = URL.createObjectURL(file);
    $('source-name').textContent = file.name;
    $('source-name').title = file.name;
    $('source-size').textContent = `${size(file.size)} · MOV`;
    $('job-name').textContent = file.name;
    $('job-name').title = file.name;
    $('source-duration').textContent = 'Reading…';
    $('source-resolution').textContent = 'Reading…';
    $('file-count').textContent = '1';
    $('media-empty').hidden = true;
    ['media-card','source-details','media-actions'].forEach(id => $(id).hidden = false);
    $('preview-empty').hidden = true;
    $('preview-unavailable').hidden = true;
    $('preview-label').textContent = 'SOURCE';
    $('preview-note').textContent = 'Loading source preview…';
    document.body.classList.add('has-file');
    preview.hidden = false;
    preview.src = objectUrl;
    $('export-caption').textContent = 'Ready to export with your settings.';
    readyJob();
    setBusy(false);
    session('1 file ready');
  });
  preview.addEventListener('loadedmetadata', () => {
    if (!file) return;
    $('source-duration').textContent = duration(preview.duration);
    $('thumbnail-duration').textContent = duration(preview.duration);
    $('source-resolution').textContent = `${preview.videoWidth} × ${preview.videoHeight}`;
    $('preview-note').textContent = `${duration(preview.duration)} · ${preview.videoWidth} × ${preview.videoHeight} · Original source`;
  });
  preview.addEventListener('loadeddata', () => {
    if (!file || !preview.videoWidth) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = Math.round(360 * preview.videoHeight / preview.videoWidth);
      canvas.getContext('2d').drawImage(preview,0,0,canvas.width,canvas.height);
      $('thumbnail').src = canvas.toDataURL('image/jpeg',.75);
      $('thumbnail').hidden = false;
      $('thumbnail-fallback').hidden = true;
    } catch { /* The native player remains usable if frame capture is unavailable. */ }
  });
  preview.addEventListener('error', () => {
    if (!file || !objectUrl) return;
    preview.hidden = true;
    $('preview-unavailable').hidden = false;
    $('source-duration').textContent = 'Unavailable';
    $('source-resolution').textContent = 'Unavailable';
    $('preview-note').textContent = 'Preview unavailable · Conversion is still available';
    $('preview-label').textContent = 'PREVIEW UNAVAILABLE';
  });
  $('quality').addEventListener('change', () => $('quality-description').textContent = qualityDescriptions[$('quality').value]);
  $('keep-audio').addEventListener('change', () => $('audio-codec').textContent = $('keep-audio').checked ? 'AAC' : 'No audio');
  const drop = $('drop-zone');
  let dragDepth = 0;
  window.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  window.addEventListener('drop', e => { if ([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  drop.addEventListener('dragenter', e => { e.preventDefault(); if (!busy) { dragDepth++; drop.classList.add('is-dragging'); } });
  drop.addEventListener('dragover', e => e.preventDefault());
  drop.addEventListener('dragleave', () => { dragDepth--; if (dragDepth <= 0) drop.classList.remove('is-dragging'); });
  drop.addEventListener('drop', e => {
    e.preventDefault(); dragDepth = 0; drop.classList.remove('is-dragging');
    if (busy) return;
    if (e.dataTransfer.files.length !== 1) { message('Please add one MOV file at a time.'); return; }
    input.files = e.dataTransfer.files;
    input.dispatchEvent(new Event('change'));
  });
  function fail(text) {
    $('job').classList.add('is-error');
    $('job-status').textContent = 'Conversion failed';
    $('job-detail').textContent = 'Your source is still here. Check the message below and try again.';
    $('activity-label').textContent = 'NEEDS ATTENTION';
    $('progress').value = 0;
    $('convert-button').querySelector('span').textContent = 'Try again';
    $('export-caption').textContent = 'Your original file has not changed.';
    session('Conversion failed');
    message(text);
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (busy || !file) return;
    const data = new FormData(form);
    const thisGeneration = generation;
    readyJob();
    $('feedback').replaceChildren();
    preview.pause();
    setBusy(true);
    $('convert-button').querySelector('span').textContent = 'Uploading…';
    $('job-status').textContent = 'Uploading · 0%';
    $('job-detail').textContent = 'Sending your source file securely to the converter.';
    $('activity-label').textContent = 'UPLOADING';
    $('export-caption').textContent = 'Keep this tab open until conversion finishes.';
    session('Uploading your file');
    request = new XMLHttpRequest();
    request.open('POST',form.action);
    request.setRequestHeader('Accept','application/json');
    request.upload.addEventListener('progress', event => {
      if (thisGeneration !== generation) return;
      if (event.lengthComputable) {
        const percent = Math.min(100,Math.round(event.loaded / event.total * 100));
        $('progress').value = percent;
        $('job-status').textContent = `Uploading · ${percent}%`;
      }
    });
    request.upload.addEventListener('load', () => {
      $('progress').removeAttribute('value');
      $('progress').setAttribute('aria-label','Conversion in progress');
      $('job-status').textContent = 'Converting…';
      $('job-detail').textContent = 'Upload complete. Larger videos can take a few minutes.';
      $('activity-label').textContent = 'CONVERTING';
      $('convert-button').querySelector('span').textContent = 'Converting…';
      session('Converting your video');
    });
    request.addEventListener('load', () => {
      let result;
      try { result = JSON.parse(request.responseText); } catch { fail(request.status === 413 ? 'This file exceeds the upload limit. Try a smaller MOV file.' : 'The server returned an unexpected response. Please try again.'); return; }
      if (request.status < 200 || request.status >= 300 || !result.download_url) { fail(result.error || 'Conversion could not finish. Try another MOV file.'); return; }
      $('progress').value = 100;
      $('job').classList.add('is-complete');
      $('job-status').textContent = 'Ready to download';
      $('job-detail').textContent = `${result.filename} · ${size(result.size)} · MP4`;
      $('activity-label').textContent = 'COMPLETE';
      $('download-button').href = result.download_url;
      $('download-button').download = result.filename;
      $('download-button').hidden = false;
      $('convert-button').querySelector('span').textContent = 'Convert again';
      $('export-caption').textContent = 'Your MP4 is ready in the Conversion panel.';
      session('Conversion complete');
      message('Conversion complete. Your MP4 is ready to download.','success');
    });
    request.addEventListener('error', () => fail('The connection was interrupted. Check your connection and try again.'));
    request.addEventListener('abort', () => fail('The upload was interrupted. Please try again.'));
    request.addEventListener('loadend', () => { setBusy(false); request = null; });
    request.send(data);
    if (innerWidth < 621) $('job').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block:'center'});
  });
  window.addEventListener('beforeunload', e => { if (busy) { e.preventDefault(); e.returnValue = ''; } else if (objectUrl) URL.revokeObjectURL(objectUrl); });
  $('convert-button').disabled = true;
})();
