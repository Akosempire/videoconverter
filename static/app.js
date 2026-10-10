(() => {
  const $ = id => document.getElementById(id);
  const all = selector => [...document.querySelectorAll(selector)];
  const on = (id, fn) => $(id).addEventListener('click', fn);
  const video = $('preview');
  const input = $('video');
  const dialog = $('export-dialog');
  let sourceUrl = null, busy = false, scene = 'lounge', look = 'cine', snap = false;
  const sampleDuration = 5711;
  const clock = seconds => {
    seconds = Number.isFinite(seconds) ? Math.max(seconds, 0) : 0;
    return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, Math.floor(seconds) % 60, Math.floor(seconds % 1 * 30)].map(n => String(n).padStart(2, '0')).join(':');
  };
  function message(text, kind = 'info') {
    const node = document.createElement('div');
    node.className = `alert ${kind}`;
    node.textContent = text;
    if (kind === 'error') node.setAttribute('role', 'alert');
    $('feedback').replaceChildren(node);
    $('export-feedback').replaceChildren(node.cloneNode(true));
  }
  function inspect(tab) {
    all('[data-inspector]').forEach(button => {
      const selected = button.dataset.inspector === tab;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-selected', selected);
    });
    ['color', 'properties', 'effects'].forEach(name => $(`${name}-content`).hidden = name !== tab);
  }
  function selectScene(name) {
    scene = name;
    if (sourceUrl && name === 'imported') {
      video.hidden = false;
      $('reference-preview').hidden = true;
    } else {
      video.pause();
      video.hidden = true;
      $('reference-preview').hidden = false;
      $('reference-preview').className = `reference-preview scene-${name}`;
      $('reference-preview').setAttribute('aria-label', `Reference sample: ${name}`);
    }
    all('.asset').forEach(asset => asset.classList.toggle('selected', asset.dataset.scene === name));
  }
  function openExport() { if (!dialog.open) dialog.showModal(); }
  function importFile() { if (!busy) input.click(); }
  ['import-button', 'folder-import', 'add-file', 'monitor-import', 'properties-import', 'track-import'].forEach(id => on(id, importFile));
  ['export-button', 'share-button', 'cut-tool'].forEach(id => on(id, openExport));
  on('close-export', () => { if (!busy) dialog.close(); });
  on('edit-button', () => { inspect('color'); dialog.close(); });
  on('home', () => { resetSource(); resetColor(); $('media-search').value = ''; filterAssets(); });
  all('[data-inspector]').forEach(button => button.addEventListener('click', () => inspect(button.dataset.inspector)));
  on('source-properties', () => inspect('properties'));
  on('media-details', () => inspect('properties'));
  $('assets').addEventListener('click', e => {
    const asset = e.target.closest('.asset');
    if (asset) selectScene(asset.dataset.scene);
  });
  all('.timeline-clip').forEach(clip => clip.addEventListener('click', () => selectScene(clip.dataset.scene)));
  on('reference-scene', () => selectScene('lounge'));
  function resetSource() {
    video.pause();
    video.removeAttribute('src');
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    sourceUrl = null;
    video.load();
    input.value = '';
    $('imported-asset')?.remove();
    $('file-count').textContent = `${all('.asset').length} items`;
    $('source-name').textContent = 'Reference sample';
    $('source-size').textContent = 'Visual reference — import MOV to convert';
    $('source-resolution').textContent = '—';
    $('export-source').textContent = 'Choose your MOV file. Maximum 500 MB.';
    $('duration').textContent = '01:35:11:26';
    const clip = document.querySelector('.clip-blue');
    clip.dataset.scene = 'lounge';
    clip.querySelector('.clip-title').textContent = 'Assetname here';
    selectScene('lounge');
  }
  on('remove-file', () => { if (!busy) resetSource(); });
  on('clear-panel', () => { if (!busy) { resetSource(); $('feedback').replaceChildren(); } });
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (!/\.mov$/i.test(file.name) || file.size === 0 || file.size > 500 * 1024 * 1024) {
      resetSource();
      message('Choose a non-empty MOV file no larger than 500 MB.', 'error');
      return;
    }
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    $('imported-asset')?.remove();
    sourceUrl = URL.createObjectURL(file);
    video.src = sourceUrl;
    video.volume = Number($('volume').value);
    $('source-name').textContent = file.name;
    $('source-size').textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB · QuickTime`;
    $('export-source').textContent = file.name;
    const asset = document.querySelector('.asset').cloneNode(true);
    asset.id = 'imported-asset';
    asset.dataset.scene = 'imported';
    asset.dataset.name = file.name;
    asset.title = file.name;
    asset.querySelector('.asset-name').textContent = file.name;
    asset.querySelector('.asset-time').textContent = 'Imported MOV';
    asset.querySelector('.asset-image').className = 'asset-image scene-audio';
    $('assets').prepend(asset);
    const clip = document.querySelector('.clip-blue');
    clip.dataset.scene = 'imported';
    clip.querySelector('.clip-title').textContent = file.name;
    $('file-count').textContent = `${all('.asset').length} items`;
    $('feedback').replaceChildren();
    $('export-feedback').replaceChildren();
    selectScene('imported');
    if (dialog.open) dialog.close();
  });
  video.addEventListener('loadedmetadata', () => {
    $('source-resolution').textContent = `${video.videoWidth} × ${video.videoHeight}`;
    $('duration').textContent = clock(video.duration);
    all('.timeline-ruler span').forEach((label, i) => label.textContent = clock(video.duration * i / 6));
  });
  video.addEventListener('error', () => {
    if (sourceUrl) message('This MOV codec cannot be previewed by your browser. Export can still convert it to MP4.');
  });
  video.addEventListener('timeupdate', () => {
    $('timecode').textContent = clock(video.currentTime);
    const ratio = video.duration ? video.currentTime / video.duration : 0;
    $('scrubber').value = ratio * 1000;
    $('playhead').style.left = `${ratio * 100}%`;
  });
  video.addEventListener('play', () => { $('play-button').textContent = 'Ⅱ'; $('play-button').setAttribute('aria-label', 'Pause preview'); });
  video.addEventListener('pause', () => { $('play-button').textContent = '▶'; $('play-button').setAttribute('aria-label', 'Play preview'); });
  on('play-button', async () => {
    if (!sourceUrl || scene !== 'imported') { message('The reference scene is a still image. Import a MOV file to play your footage.'); return; }
    try { if (video.paused) await video.play(); else video.pause(); } catch { message('This codec cannot play in this browser. You can still export the MOV to MP4.'); }
  });
  function seek(ratio) {
    if (sourceUrl && Number.isFinite(video.duration)) video.currentTime = snap ? Math.round(ratio * video.duration * 30) / 30 : ratio * video.duration;
    else { $('playhead').style.left = `${ratio * 100}%`; $('scrubber').value = ratio * 1000; $('timecode').textContent = clock(ratio * sampleDuration); }
  }
  $('scrubber').addEventListener('input', e => seek(e.target.value / 1000));
  $('timeline-ruler').addEventListener('click', e => { const bounds = e.currentTarget.getBoundingClientRect(); seek(Math.max(0, Math.min(1, (e.clientX - bounds.left) / bounds.width))); });
  on('previous-frame', () => seek(sourceUrl && video.duration ? Math.max(0, video.currentTime - 1 / 30) / video.duration : Math.max(0, Number($('scrubber').value) - 1) / 1000));
  on('next-frame', () => seek(sourceUrl && video.duration ? Math.min(video.duration, video.currentTime + 1 / 30) / video.duration : Math.min(1000, Number($('scrubber').value) + 1) / 1000));
  on('jump-playhead', () => seek(Number($('scrubber').value) / 1000));
  on('pen-tool', () => seek(0));
  $('volume').addEventListener('input', e => video.volume = Number(e.target.value));
  on('mute-button', () => { video.muted = !video.muted; $('mute-button').classList.toggle('active', video.muted); });
  $('playback-rate').addEventListener('change', e => video.playbackRate = Number(e.target.value));
  function fit() { video.style.objectFit = $('preview-fit').value; }
  $('preview-fit').addEventListener('change', fit);
  on('fit-toggle', () => { $('preview-fit').value = $('preview-fit').value === 'contain' ? 'cover' : 'contain'; fit(); });
  on('show-video', () => { if (sourceUrl) selectScene('imported'); else selectScene('lounge'); });
  on('snapshot', () => {
    if (!sourceUrl || video.readyState < 2) { message('Import a playable video to save a frame.'); return; }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = 'video-frame.png'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  });
  const adjustmentIds = ['exposure', 'contrast', 'fade', 'sharpen', 'vibrance', 'saturation', 'tint'];
  function applyColor() {
    adjustmentIds.forEach(id => $(`${id}-value`).value = Number($(id).value).toFixed(1));
    const enabled = $('creative-enabled').checked, basic = $('basic-enabled').checked;
    const faded = enabled ? Math.max(0, Number($('fade').value) - 100) / 1000 : 0;
    let brightness = basic ? Number($('exposure').value) / 100 : 1;
    let contrast = basic ? Number($('contrast').value) / 100 : 1;
    let saturation = enabled ? Number($('saturation').value) / 100 * Number($('vibrance').value) / 100 : 1;
    let sepia = 0;
    if (enabled && look === 'fuji') { brightness *= 1.15; saturation *= 1.25; }
    if (enabled && look === 'warm') { sepia = .3; saturation *= 1.2; }
    if ($('curves-enabled').checked) contrast *= 1.15;
    if (enabled) contrast *= 1 + (Number($('sharpen').value) - 100) / 1000;
    const filter = `brightness(${brightness + faded}) contrast(${contrast - faded}) saturate(${saturation}) sepia(${sepia})`;
    video.style.filter = filter;
    $('reference-preview').style.filter = filter;
    const tint = enabled ? Math.max(0, Number($('tint').value) - 100) / 1200 : 0;
    $('monitor').style.boxShadow = `inset 0 0 150px ${tint * 200}px ${$('shadow-tint').value}`;
    $('monitor').style.backgroundColor = $('highlight-tint').value;
    $('reference-preview').style.opacity = 1 - tint;
  }
  function resetColor() {
    adjustmentIds.forEach(id => $(id).value = 100);
    $('basic-enabled').checked = true; $('creative-enabled').checked = true; $('curves-enabled').checked = false;
    $('shadow-tint').value = '#808080'; $('highlight-tint').value = '#ffffff';
    look = 'cine'; all('.look').forEach(button => button.classList.toggle('selected', button.dataset.look === look)); applyColor();
  }
  adjustmentIds.forEach(id => $(id).addEventListener('input', applyColor));
  ['basic-enabled', 'creative-enabled', 'curves-enabled', 'shadow-tint', 'highlight-tint'].forEach(id => $(id).addEventListener('input', applyColor));
  $('color-space').addEventListener('change', e => { $('contrast').value = e.target.selectedIndex ? 110 : 100; applyColor(); });
  all('.look').forEach(button => button.addEventListener('click', () => { look = button.dataset.look; all('.look').forEach(b => b.classList.toggle('selected', b === button)); applyColor(); }));
  on('reset-color', resetColor); on('effects-reset', resetColor);
  on('save-preset', () => {
    try { localStorage.setItem('video-preview-preset', JSON.stringify({look, values: Object.fromEntries(adjustmentIds.map(id => [id, $(id).value]))})); message('Preview preset saved in this browser.'); } catch { message('Browser storage is unavailable.', 'error'); }
  });
  on('load-preset', () => {
    try { const preset = JSON.parse(localStorage.getItem('video-preview-preset')); if (!preset) { message('Save a preview preset first.'); return; } adjustmentIds.forEach(id => $(id).value = preset.values[id] ?? 100); look = preset.look || 'cine'; all('.look').forEach(button => button.classList.toggle('selected', button.dataset.look === look)); applyColor(); } catch { message('The saved preset could not be loaded.', 'error'); }
  });
  function filterAssets() { const query = $('media-search').value.toLowerCase(); all('.asset').forEach(asset => asset.hidden = !asset.dataset.name.toLowerCase().includes(query)); }
  $('media-search').addEventListener('input', filterAssets);
  on('search-button', () => $('media-search').focus());
  on('sort-media', () => all('.asset').sort((a,b) => a.dataset.name.localeCompare(b.dataset.name)).forEach(asset => $('assets').append(asset)));
  on('list-view', () => { $('assets').classList.add('list-view'); $('list-view').classList.add('active'); $('grid-view').classList.remove('active'); });
  on('grid-view', () => { $('assets').classList.remove('list-view'); $('grid-view').classList.add('active'); $('list-view').classList.remove('active'); });
  $('thumbnail-size').addEventListener('input', e => { $('assets').style.gridTemplateColumns = `repeat(auto-fit,minmax(${e.target.value}px,1fr))`; });
  all('[data-library]').forEach(button => button.addEventListener('click', () => {
    all('[data-library]').forEach(b => { b.classList.toggle('selected', b === button); b.setAttribute('aria-selected', b === button); });
    const tab = button.dataset.library;
    $('assets').hidden = tab === 'presets' || tab === 'templates';
    $('library-message').hidden = !$('assets').hidden;
    $('library-message').textContent = tab === 'presets' ? 'Use New Preset in the color panel to save your current preview look, and Custom Preset to restore it.' : 'The reference project is loaded. Import your own MOV to begin a conversion.';
  }));
  on('layout-button', () => { if (innerWidth > 900) document.querySelector('.editor').classList.toggle('library-hidden'); else $('library').scrollIntoView({behavior:'smooth'}); });
  on('color-panel-button', () => { if (innerWidth > 900) document.querySelector('.editor').classList.toggle('inspector-hidden'); else $('inspector').scrollIntoView({behavior:'smooth'}); });
  on('fullscreen-button', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.querySelector('.editor').requestFullscreen(); } catch { message('Full screen is unavailable in this browser.'); } });
  $('timeline-zoom').addEventListener('input', e => document.querySelector('.timeline-content').style.width = `${e.target.value}%`);
  on('timeline-fit', () => { $('timeline-zoom').value = 100; document.querySelector('.timeline-content').style.width = '100%'; });
  on('snap-tool', () => { snap = !snap; $('snap-tool').classList.toggle('active', snap); });
  on('selection-tool', () => $('timeline-scroll').style.cursor = 'default');
  on('hand-tool', () => { $('timeline-scroll').scrollLeft += 100; $('timeline-scroll').style.cursor = 'grab'; });
  on('layers-tool', () => { all('.timeline-track').forEach(track => track.style.visibility = 'visible'); all('.track-header button').forEach(button => button.classList.remove('active')); });
  all('.track-header').forEach((header, index) => {
    const track = all('.timeline-track')[index];
    header.querySelector('[aria-label^="Lock"]').addEventListener('click', e => { const button = e.currentTarget; button.classList.toggle('active'); track.querySelector('button').disabled = button.classList.contains('active'); });
    header.querySelector('[aria-label^="Toggle"]').addEventListener('click', e => { e.currentTarget.classList.toggle('active'); track.style.visibility = e.currentTarget.classList.contains('active') ? 'hidden' : 'visible'; });
    header.querySelector('.track-mute').addEventListener('click', e => { e.currentTarget.classList.toggle('active'); video.muted = all('.track-mute').some(button => button.classList.contains('active')); });
    header.querySelector('.track-solo').addEventListener('click', e => { e.currentTarget.classList.toggle('active'); all('.timeline-track').forEach((row, i) => row.style.opacity = e.currentTarget.classList.contains('active') && i !== index ? '.2' : '1'); });
  });
  const drop = $('drop-zone');
  ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, e => { e.preventDefault(); if (!busy) drop.classList.add('is-dragging'); }));
  ['dragleave', 'drop'].forEach(name => drop.addEventListener(name, () => drop.classList.remove('is-dragging')));
  drop.addEventListener('drop', e => { e.preventDefault(); if (busy) return; if (e.dataTransfer.files.length !== 1) { message('Import one MOV file at a time.', 'error'); return; } input.files = e.dataTransfer.files; input.dispatchEvent(new Event('change')); });
  $('converter-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (busy || !input.files.length) return;
    const data = new FormData(e.currentTarget), action = e.currentTarget.action;
    busy = true; input.disabled = true; $('convert-button').disabled = true; $('close-export').disabled = true;
    $('convert-button').textContent = 'Converting…';
    message('Converting your footage. Keep this tab open.');
    try {
      const response = await fetch(action, {method:'POST', body:data});
      const documentResult = new DOMParser().parseFromString(await response.text(), 'text/html');
      const result = documentResult.querySelector('#feedback');
      if (!result?.textContent.trim()) throw new Error('Conversion could not finish. Please try again.');
      $('feedback').replaceChildren(...[...result.childNodes].map(node => document.importNode(node, true)));
      $('export-feedback').replaceChildren(...[...result.childNodes].map(node => document.importNode(node, true)));
    } catch (error) { message(error.message || 'Connection interrupted. Please try again.', 'error'); }
    finally { busy = false; input.disabled = false; $('convert-button').disabled = false; $('close-export').disabled = false; $('convert-button').textContent = 'Convert to MP4'; }
  });
  dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
  window.addEventListener('beforeunload', () => { if (sourceUrl) URL.revokeObjectURL(sourceUrl); });
})();
