/* Batch-ready: multiple MOV → multiple MP4, full-bleed desktop, brutalist states. */
(() => {
  const $ = id => document.getElementById(id);
  const input = $('video'), preview = $('preview'), form = $('converter-form');
  input.tabIndex = -1;
  let files = [], active = 0, objectUrls = [], busy = false, generation = 0, request = null;

  const qualityDescriptions = { standard:'A balance of clarity and file size.', high:'More detail, with a larger output file.', small:'A smaller file, with more compression.' };
  const size = b => b < 1024*1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/1024/1024).toFixed(1)} MB`;
  const duration = s => { if(!Number.isFinite(s)) return 'Unavailable'; const t=Math.floor(s); return `${t>=3600?`${Math.floor(t/3600)}:`:''}${String(Math.floor(t/60)%60).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`; };

  function message(text, kind='error'){ const n=document.createElement('div'); n.className=`alert ${kind}`; n.textContent=text; if(kind==='error') n.setAttribute('role','alert'); $('feedback').replaceChildren(n); }
  function session(text){ const el=$('session-status'); if(el && el.lastChild) el.lastChild.textContent=` ${text}`; }

  function setBusy(value){
    busy=value;
    input.disabled=value;
    $('export-options').disabled=value;
    const clr=$('remove-file'); if(clr) clr.disabled=value;
    document.querySelectorAll('[data-import], #choose-file').forEach(b=>b.disabled=value);
    const btn=$('convert-button'); if(btn) btn.disabled=value || files.length===0;
    form.setAttribute('aria-busy',String(value));
    const overlay=$('upload-overlay');
    if(overlay){
      overlay.classList.toggle('is-active', value);
      overlay.classList.remove('is-converting');
      overlay.setAttribute('aria-hidden', value?'false':'true');
      if(value){ const f=$('upload-overlay-fill'),p=$('upload-overlay-pct'); if(f) f.style.width='0%'; if(p) p.textContent='0%'; }
    }
  }

  function readyJob(){
    const has = files.length>0;
    $('activity-empty').hidden = has || busy;
    $('job').hidden = !has;
    $('job').classList.remove('is-complete','is-error');
    const ji=$('job-icon'); if(ji) ji.classList.remove('is-complete','is-error');
    $('download-button').hidden=true; $('download-button').removeAttribute('href');
    $('progress').value=0; $('progress').setAttribute('aria-label','Upload progress');
    $('job-status').textContent= has ? (files.length>1 ? `Ready — ${files.length} files` : 'Ready to convert') : 'Ready to convert';
    $('job-detail').textContent= has ? (files.length>1 ? 'Batch convert will run in order.' : 'Choose your export settings, then convert.') : 'Choose your export settings, then convert.';
    $('activity-label').textContent= busy ? $('activity-label').textContent : (has ? 'READY' : 'NOT STARTED');
  }

  function renderQueue(){
    const count=files.length;
    $('file-count').textContent=String(count);
    $('media-empty').hidden = count>0;
    $('media-list').hidden = count===0;
    const showCard = count===1;
    $('media-card').hidden = count!==1;
    $('source-details').hidden = count===0;
    $('media-actions').hidden = count===0;
    const bl=$('batch-list'); if(bl){ bl.hidden = true; bl.innerHTML=''; }
    if(count===0){
      document.body.classList.remove('has-file');
      $('preview-empty').hidden=false; $('preview-unavailable').hidden=true;
      $('preview-label').textContent='NO FILE SELECTED';
      $('preview-note').textContent='A preview will appear after you add a file';
      $('source-name').textContent=''; $('source-size').textContent='';
      $('job-name').textContent='';
      $('export-caption').textContent='Add files to start converting.';
      return;
    }
    document.body.classList.add('has-file');
    // thumbnail card for single
    if(showCard){
      $('source-name').textContent=files[0].name; $('source-name').title=files[0].name;
      $('source-size').textContent=`${size(files[0].size)} · MOV`;
      $('job-name').textContent=files[0].name; $('job-name').title=files[0].name;
    } else {
      $('job-name').textContent=`${count} files queued`;
      $('job-name').title=files.map(f=>f.name).join(', ');
    }
    // list
    const list=$('media-list');
    list.innerHTML='';
    list.style.display='grid'; list.style.gap='8px';
    files.forEach((f,i)=>{
      const row=document.createElement('div');
      const isActive = i===active;
      row.style.cssText=`display:flex;gap:10px;align-items:center;padding:10px;border:${isActive?'2.5px':'2px'} solid #111;border-radius:10px;background:${isActive?'#FFF4A9':'#fff'};box-shadow:2px 2px 0 #111;cursor:pointer`;
      row.innerHTML=`<span style="width:28px;height:28px;display:grid;place-items:center;background:${isActive?'#1CC9B6':'#FFD93D'};border:1.5px solid #111;border-radius:7px;flex:0 0 28px;font:700 10px ui-monospace,monospace">${String(i+1).padStart(2,'0')}</span><span style="flex:1;min-width:0"><strong style="display:block;font:700 11px/1.3 ui-sans-serif,system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name.replace(/</g,'&lt;')}</strong><span style="font:600 10px ui-sans-serif,system-ui;color:#6B6B6B">${size(f.size)} · MOV</span></span><button type="button" aria-label="Remove" data-idx="${i}" style="width:28px;height:28px;border:1.5px solid #111;border-radius:8px;background:#fff;box-shadow:1px 1px 0 #111;flex:0 0 28px">✕</button>`;
      row.addEventListener('click', (e)=>{ if(e.target.closest('button')) return; setActive(i); });
      const rm=row.querySelector('button'); rm.addEventListener('click', (e)=>{ e.stopPropagation(); removeAt(i); });
      list.appendChild(row);
    });
    // export caption
    $('export-caption').textContent = count===1 ? 'Ready to export with your settings.' : `${count} files ready — batch order is shown on the left.`;
    $('file-count').title = files.map(f=>f.name).join('\n');
    readyJob(); setBusy(busy);
    // keep preview on active
    loadActivePreview();
  }

  function setActive(idx){
    if(idx<0||idx>=files.length) return;
    active=idx;
    renderQueue();
  }
  function removeAt(idx){
    if(busy) return;
    const f=files[idx];
    if(objectUrls[idx]){ try{ URL.revokeObjectURL(objectUrls[idx]); }catch{} }
    files.splice(idx,1); objectUrls.splice(idx,1);
    if(active>=files.length) active=Math.max(0, files.length-1);
    input.value='';
    if(files.length===0){ clearSource(true); } else { renderQueue(); session(`${files.length} file${files.length>1?'s':''} ready`); }
  }
  function clearSource(skipRender){
    generation+=1;
    preview.pause(); preview.removeAttribute('src'); preview.load();
    objectUrls.forEach(u=>{ try{ URL.revokeObjectURL(u);}catch{} });
    objectUrls=[]; files=[]; active=0;
    preview.hidden=true;
    $('thumbnail').hidden=true; $('thumbnail').removeAttribute('src'); $('thumbnail-fallback').hidden=false; $('thumbnail-duration').textContent='';
    $('preview-empty').hidden=false; $('preview-unavailable').hidden=true;
    $('preview-label').textContent='NO FILE SELECTED'; $('preview-note').textContent='A preview will appear after you add a file';
    $('media-empty').hidden=false; ['media-card','source-details','media-actions'].forEach(id=>$(id).hidden=true);
    const ml=$('media-list'); if(ml) ml.hidden=true;
    const bl=$('batch-list'); if(bl){ bl.hidden=true; bl.innerHTML=''; }
    document.body.classList.remove('has-file');
    $('file-count').textContent='0';
    $('export-caption').textContent='Add files to start converting.';
    const btn=$('convert-button'); if(btn) btn.querySelector('span').textContent='Convert to MP4';
    $('feedback').replaceChildren(); readyJob(); setBusy(false); session('Ready when you are');
    input.value='';
    if(skipRender) return;
  }
  function loadActivePreview(){
    if(files.length===0) return;
    const f=files[active];
    // reuse or create object URL
    if(!objectUrls[active]){
      objectUrls[active]=URL.createObjectURL(f);
    }
    $('source-duration').textContent='Reading…'; $('source-resolution').textContent='Reading…';
    $('preview-empty').hidden=true; $('preview-unavailable').hidden=true;
    $('preview-label').textContent=`SOURCE ${files.length>1?`· ${active+1}/${files.length}`:''}`;
    $('preview-note').textContent='Loading source preview…';
    preview.hidden=false; preview.src=objectUrls[active];
    if(files.length===1){
      $('source-name').textContent=f.name; $('source-size').textContent=`${size(f.size)} · MOV`;
    }
  }
  function addFiles(fileList){
    if(busy) return;
    const incoming=[...fileList];
    if(incoming.length===0) return;
    // validate batch: allow up to 12, each MOV ≤500MB, total items reasonable
    if(files.length + incoming.length > 20){ message('You can queue up to 20 files at a time.'); return; }
    let added=0, skipped=[];
    incoming.forEach(fl=>{
      if(!/\.mov$/i.test(fl.name)){ skipped.push(`${fl.name}: not a MOV`); return; }
      if(fl.size===0){ skipped.push(`${fl.name}: empty`); return; }
      if(fl.size>500*1024*1024){ skipped.push(`${fl.name}: exceeds 500 MB`); return; }
      // dedupe by name+size
      if(files.some(f=>f.name===fl.name && f.size===fl.size)) return;
      files.push(fl); objectUrls.push(null); added++;
    });
    if(skipped.length) message(skipped.slice(0,4).join('  ·  ') + (skipped.length>4?`  ·  +${skipped.length-4} more`:''));
    if(added===0 && skipped.length===0) return;
    if(added>0){
      // if first batch, active stays 0; otherwise keep current
      renderQueue();
      session(`${files.length} file${files.length>1?'s':''} ready`);
      $('feedback').replaceChildren();
      if(files.length===1) preview.addEventListener('loadedmetadata', ()=>{}, {once:true});
    }
    input.value='';
  }

  function importSource(){ if(!busy) input.click(); }
  $('choose-file').addEventListener('click', importSource);
  document.querySelectorAll('[data-import]').forEach(b=>b.addEventListener('click', importSource));
  $('remove-file').addEventListener('click', ()=>{ if(busy) return; if(files.length===0) return; if(confirm(`Clear all ${files.length} file${files.length>1?'s':''}?`)) clearSource(); else { $('choose-file').focus(); } });

  input.addEventListener('change', ()=>{ addFiles(input.files); });

  preview.addEventListener('loadedmetadata', ()=>{
    if(files.length===0) return;
    const cur=files[active];
    if(!cur) return;
    $('source-duration').textContent=duration(preview.duration);
    $('thumbnail-duration').textContent=duration(preview.duration);
    $('source-resolution').textContent=`${preview.videoWidth} × ${preview.videoHeight}`;
    $('preview-note').textContent=`${duration(preview.duration)} · ${preview.videoWidth} × ${preview.videoHeight} · ${files.length>1?`#${active+1} · `:''}Original source`;
    // keep single-card thumbnail in sync
    if(files.length===1){
      $('thumbnail-duration').textContent=duration(preview.duration);
    }
  });
  preview.addEventListener('loadeddata', ()=>{
    if(files.length!==1 || !preview.videoWidth) return;
    try{
      const c=document.createElement('canvas'); c.width=360; c.height=Math.round(360*preview.videoHeight/preview.videoWidth);
      c.getContext('2d').drawImage(preview,0,0,c.width,c.height);
      $('thumbnail').src=c.toDataURL('image/jpeg',.75); $('thumbnail').hidden=false; $('thumbnail-fallback').hidden=true;
    }catch{}
  });
  preview.addEventListener('error', ()=>{
    if(files.length===0 || !objectUrls[active]) return;
    preview.hidden=true; $('preview-unavailable').hidden=false;
    $('source-duration').textContent='Unavailable'; $('source-resolution').textContent='Unavailable';
    $('preview-note').textContent='Preview unavailable · Conversion is still available';
    $('preview-label').textContent='PREVIEW UNAVAILABLE';
  });

  $('quality').addEventListener('change', ()=>$('quality-description').textContent=qualityDescriptions[$('quality').value]);
  $('keep-audio').addEventListener('change', ()=>$('audio-codec').textContent=$('keep-audio').checked?'AAC':'No audio');

  const drop=$('drop-zone'); let dragDepth=0;
  window.addEventListener('dragover', e=>{ if([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  window.addEventListener('drop', e=>{ if([...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  drop.addEventListener('dragenter', e=>{ e.preventDefault(); if(!busy){ dragDepth++; drop.classList.add('is-dragging'); } });
  drop.addEventListener('dragover', e=>e.preventDefault());
  drop.addEventListener('dragleave', ()=>{ dragDepth--; if(dragDepth<=0) drop.classList.remove('is-dragging'); });
  drop.addEventListener('drop', e=>{
    e.preventDefault(); dragDepth=0; drop.classList.remove('is-dragging');
    if(busy) return;
    addFiles(e.dataTransfer.files);
  });

  function failBatch(msg){
    $('job').classList.add('is-error'); const ji=$('job-icon'); if(ji) ji.classList.add('is-error');
    $('job-status').textContent='Batch issue'; $('job-detail').textContent=msg;
    $('activity-label').textContent='NEEDS ATTENTION'; $('progress').value=0;
    const btn=$('convert-button'); if(btn) btn.querySelector('span').textContent='Try again';
    $('export-caption').textContent='Your original files have not changed.';
    const ov=$('upload-overlay'); if(ov) ov.classList.remove('is-active','is-converting');
    session('Batch needs attention'); message(msg);
  }

  function renderBatchResults(results, errors){
    const bl=$('batch-list'); if(!bl) return;
    bl.hidden=false; bl.innerHTML='';
    bl.style.display='grid';
    results.forEach(r=>{
      const a=document.createElement('a');
      a.href=r.download_url; a.download=r.filename;
      a.className='button button-primary';
      a.style.cssText='width:100%;justify-content:space-between';
      a.innerHTML=`<span style="text-align:left;min-width:0"><strong style="display:block;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.filename}</strong><span style="font:600 10px ui-monospace,monospace">${(r.size/1024/1024).toFixed(1)} MB · MP4</span></span><span>Download →</span>`;
      const wrap=document.createElement('div'); wrap.style.cssText='background:#fff;border:2px solid #111;border-radius:10px;box-shadow:2px 2px 0 #111;padding:8px;display:grid;gap:6px';
      wrap.innerHTML=`<span style="font:700 11px ui-sans-serif,system-ui">${r.source} → ${r.filename}</span>`;
      wrap.appendChild(a); bl.appendChild(wrap);
    });
    errors.forEach(e=>{
      const d=document.createElement('div'); d.className='alert error'; d.style.margin='0'; d.textContent=`${e.filename||'File'}: ${e.error}`;
      bl.appendChild(d);
    });
  }

  form.addEventListener('submit', async e=>{
    e.preventDefault();
    if(busy || files.length===0) return;
    const baseQuality=$('quality').value, baseRes=$('resolution').value, keepAudio=$('keep-audio').checked;
    generation+=1; const thisGen=generation;
    $('feedback').replaceChildren();
    const bl=$('batch-list'); if(bl){ bl.hidden=true; bl.innerHTML=''; }
    readyJob();
    // hide empty, show job as batch header
    $('job').hidden=false; $('job').classList.remove('is-complete','is-error');
    const ji=$('job-icon'); if(ji) ji.classList.remove('is-complete','is-error');
    $('activity-empty').hidden=true;
    preview.pause(); setBusy(true);
    $('convert-button').querySelector('span').textContent = files.length>1 ? `Converting ${files.length} files…` : 'Uploading…';
    $('job-status').textContent = files.length>1 ? `Batch 0/${files.length}` : 'Uploading · 0%';
    $('job-detail').textContent = files.length>1 ? 'Starting batch…' : 'Sending your source file securely to the converter.';
    $('activity-label').textContent='UPLOADING'; $('export-caption').textContent='Keep this tab open until conversion finishes.'; session(files.length>1?`Batch: 0/${files.length}`:'Uploading your file');

    let results=[], errors=[], completed=0;
    const total=files.length;
    const overlayTitle=$('upload-overlay-title'), overlaySub=$('upload-overlay-sub'), overlayFill=$('upload-overlay-fill'), overlayPct=$('upload-overlay-pct'), overlayDetail=$('upload-overlay-detail'), overlay=$('upload-overlay');

    // Sequential: one XHR at a time keeps progress honest and respects 500MB limit per file
    for(let idx=0; idx<total; idx++){
      if(thisGen!==generation) break;
      const f=files[idx];
      // overlay for this item
      if(overlayTitle) overlayTitle.textContent = total>1 ? `Uploading ${idx+1}/${total}` : 'Uploading your video…';
      if(overlaySub) overlaySub.textContent = f.name;
      if(overlayDetail) overlayDetail.textContent = total>1 ? `Batch ${completed}/${total} · ${size(f.size)}` : 'Sending your source file securely to the converter.';
      if(overlayFill) overlayFill.style.width='0%'; if(overlayPct) overlayPct.textContent='0%';
      if(overlay) overlay.classList.remove('is-converting');

      $('job-status').textContent = total>1 ? `Uploading ${idx+1}/${total} · 0%` : 'Uploading · 0%';
      $('job-detail').textContent = f.name;
      $('job-name').textContent = total>1 ? `Batch ${idx+1}/${total}: ${f.name}` : f.name;
      setActive(idx);

      const fd=new FormData();
      fd.append('video', f, f.name);
      fd.append('quality', baseQuality); fd.append('resolution', baseRes);
      if(keepAudio) fd.append('keep_audio','yes');

      try{
        const res = await new Promise((resolve,reject)=>{
          const xhr=new XMLHttpRequest(); request=xhr;
          xhr.open('POST', form.action);
          xhr.setRequestHeader('Accept','application/json');
          xhr.upload.addEventListener('progress', ev=>{
            if(thisGen!==generation) return;
            if(ev.lengthComputable){
              const pct=Math.min(100,Math.round(ev.loaded/ev.total*100));
              $('progress').value=pct;
              $('job-status').textContent = total>1 ? `Uploading ${idx+1}/${total} · ${pct}%` : `Uploading · ${pct}%`;
              if(overlayFill) overlayFill.style.width=pct+'%';
              if(overlayPct) overlayPct.textContent=pct+'%';
              if(overlayDetail) overlayDetail.textContent = total>1 ? `Batch ${completed}/${total} · Uploading ${idx+1}/${total} ${pct}%` : `Uploading · ${pct}% — sending your source file`;
            }
          });
          xhr.upload.addEventListener('load', ()=>{
            $('progress').removeAttribute('value'); $('progress').setAttribute('aria-label','Conversion in progress');
            $('job-status').textContent = total>1 ? `Converting ${idx+1}/${total}…` : 'Converting…';
            $('job-detail').textContent='Upload complete. Converting…';
            $('activity-label').textContent='CONVERTING';
            $('convert-button').querySelector('span').textContent = total>1 ? `Converting ${idx+1}/${total}…` : 'Converting…';
            if(overlayTitle) overlayTitle.textContent = total>1 ? `Converting ${idx+1}/${total}` : 'Converting your video…';
            if(overlaySub) overlaySub.textContent = f.name;
            if(overlayDetail) overlayDetail.textContent = 'Upload complete. Building MP4…';
            if(overlayPct) overlayPct.textContent='Converting…';
            if(overlay) overlay.classList.add('is-converting');
            session(total>1?`Converting ${idx+1}/${total}`:'Converting your video');
          });
          xhr.addEventListener('load', ()=>{
            let data; try{ data=JSON.parse(xhr.responseText);}catch{
              const raw=xhr.responseText||''; const m=raw.match(/<div class="alert[^"]*">([^<]+)<\/div>/)||raw.match(/<title[^>]*>([^<]+)<\/title>/);
              const msg=(m?m[1].trim():'')||`Server returned ${xhr.status||'an unexpected'} response.`;
              reject(new Error(msg.slice(0,300)));
              return;
            }
            // Backend batch vs single shapes
            if(data.results || data.errors){
              if(data.results && data.results.length){ // batch endpoint case — shouldn't happen per-file but handle
                // pick the one matching this filename
                const r=data.results.find(r=>r.source===f.name) || data.results[0];
                if(r) resolve(r); else reject(new Error((data.errors&&data.errors[0]&&data.errors[0].error)||'Conversion failed'));
              } else {
                reject(new Error((data.errors&&data.errors[0]&&data.errors[0].error)||data.error||'Conversion failed'));
              }
            } else if(data.download_url){
              resolve(data);
            } else if(xhr.status<200 || xhr.status>=300){
              reject(new Error(data.error||'Conversion could not finish.'));
            } else {
              reject(new Error('Unexpected server response.'));
            }
          });
          xhr.addEventListener('error', ()=>reject(new Error('The connection was interrupted. Check your connection and try again.')));
          xhr.addEventListener('abort', ()=>reject(new Error('The upload was interrupted. Please try again.')));
          xhr.send(fd);
        });
        results.push(res);
        completed++;
        $('job-detail').textContent = total>1 ? `Finished ${completed}/${total}: ${res.filename}` : `${res.filename} · ${size(res.size)} · MP4`;
        $('activity-label').textContent = completed===total?'COMPLETE':`BATCH ${completed}/${total}`;
        if(overlay) { overlayFill && (overlayFill.style.width='100%'); if(overlayPct) overlayPct.textContent='100%'; }
      }catch(err){
        errors.push({filename:f.name, error:err.message||'Failed'});
        $('job-detail').textContent = `${f.name}: ${err.message}`;
        // keep going to next file
      }
      // per-item progress reset
      $('progress').value = Math.round(completed/total*100);
      if(thisGen!==generation) break;
    }

    // finalize
    setBusy(false); request=null;
    if(thisGen!==generation) return;
    const ov2=$('upload-overlay'); if(ov2) ov2.classList.remove('is-active','is-converting');
    if(errors.length===0){
      $('job').classList.add('is-complete'); const ji2=$('job-icon'); if(ji2) ji2.classList.add('is-complete');
      $('job-status').textContent = total>1 ? `Batch complete · ${total}/${total}` : 'Ready to download';
      $('job-detail').textContent = total>1 ? `${total} MP4s ready` : `${results[0].filename} · ${size(results[0].size)} · MP4`;
      $('activity-label').textContent='COMPLETE';
      // primary download is first; batch list shows all
      if(results[0]){ $('download-button').href=results[0].download_url; $('download-button').download=results[0].filename; $('download-button').hidden=false; }
      $('convert-button').querySelector('span').textContent='Convert again';
      $('export-caption').textContent = total>1 ? `${total} MP4s ready — see batch downloads below.` : 'Your MP4 is ready in the Conversion panel.';
      session(total>1?`Batch complete: ${total} files`:'Conversion complete');
      message(total>1?`Batch complete: ${total} converted.`:'Conversion complete. Your MP4 is ready to download.','success');
    } else if(results.length>0){
      // partial success
      $('job').classList.add('is-complete'); const ji3=$('job-icon'); if(ji3) ji3.classList.add('is-complete');
      $('job-status').textContent=`Partial · ${results.length}/${total}`;
      $('job-detail').textContent=`${results.length} succeeded, ${errors.length} failed`;
      $('activity-label').textContent='PARTIAL';
      if(results[0]){ $('download-button').href=results[0].download_url; $('download-button').download=results[0].filename; $('download-button').hidden=false; }
      $('convert-button').querySelector('span').textContent='Try again';
      $('export-caption').textContent='Some files failed — check the list below.';
      session(`Batch partial: ${results.length}/${total}`);
      const firstErr=errors[0]; message(`${firstErr.filename}: ${firstErr.error}  ·  ${results.length} succeeded.`,'error');
    } else {
      failBatch(errors[0]?`${errors[0].filename}: ${errors[0].error}` : 'Batch conversion failed.');
    }
    renderBatchResults(results, errors);
    $('progress').value = results.length?100:0;
    if(results.length) $('progress').value=100;
  });

  window.addEventListener('beforeunload', e=>{ if(busy){ e.preventDefault(); e.returnValue=''; } else { objectUrls.forEach(u=>{ try{ URL.revokeObjectURL(u);}catch{} }); } });
  $('convert-button').disabled=true;
})();
