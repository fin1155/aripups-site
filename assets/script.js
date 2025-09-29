
(() => {
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const state = { cfg: null };

  async function loadConfig(){
    const res = await fetch('assets/site-config.json');
    const cfg = await res.json();
    state.cfg = cfg;
    // header/footer
    if ($('#site-logo')) $('#site-logo').src = cfg.logo;
    if ($('#site-name')) $('#site-name').textContent = cfg.siteName;
    if ($('#site-name-foot')) $('#site-name-foot').textContent = cfg.siteName;
    if ($('#quick-img')) $('#quick-img').src = cfg.quickRequestImage;
    if ($('#fab-call')) $('#fab-call').href = `tel:${cfg.phone.replace(/\s+/g,'')}`;
    if ($('#fab-call')) $('#fab-call').classList.add('show');
    if ($('#cfg-phone')) { $('#cfg-phone').textContent = cfg.phone; $('#cfg-phone').href = `tel:${cfg.phone.replace(/\s+/g,'')}`; }
    if ($('#cfg-email')) { $('#cfg-email').textContent = cfg.email; $('#cfg-email').href = `mailto:${cfg.email}`; }
    if ($('#cfg-address')) $('#cfg-address').textContent = cfg.address;
    if ($('#cfg-telegram')) { $('#cfg-telegram').textContent = cfg.telegram?.replace('https://t.me/','@') || ''; $('#cfg-telegram').href = cfg.telegram || '#'; }
    if ($('#cfg-avito')) { $('#cfg-avito').href = cfg.avito || '#'; }

    if (cfg.meta?.description) {
      const m = $('meta[name=description]'); if (m) m.setAttribute('content', cfg.meta.description);
      const ogd = $('meta[property="og:description"]'); if (ogd) ogd.setAttribute('content', cfg.meta.description);
    }
    if (cfg.meta?.og_image) {
      const ogi = $('meta[property="og:image"]'); if (ogi) ogi.setAttribute('content', cfg.meta.og_image);
    }
    if ($('#site-year')) $('#site-year').textContent = new Date().getFullYear();
  }

  function parseCSV(text){
    const rows = text.trim().split(/\r?\n/);
    const headers = rows.shift().split(',').map(h=>h.trim());
    return rows.map(line => {
      // handle commas by simple split; suited to our simple data
      const parts = line.split(',').map(s=>s.trim());
      const obj = {};
      headers.forEach((h,i)=> obj[h]=parts[i] ?? '');
      return obj;
    });
  }

  async function renderCatalog(){
    const host = $('#catalog'); if (!host) return;
    const res = await fetch('assets/programs.csv'); const text = await res.text();
    const items = parseCSV(text).filter(x => String(x.active).trim() === '1');
    host.innerHTML = items.map(x => {
      const price = x.price_from ? `от ${x.price_from} ₽` : '';
      const orderLink = (state.cfg?.avito || '#');
      return `<article class="program-card card">
        <img loading="lazy" src="${x.image}" alt="${x.title} — изображение">
        <h3>${x.title}</h3>
        <p class="muted">${x.desc||''}</p>
        <div class="price">${price}</div>
        <p><a class="btn" href="${orderLink}">Оформить заказ</a></p>
      </article>`;
    }).join('');
  }

  async function renderFeatured(){
    const host = $('#featured-programs'); if (!host) return;
    const res = await fetch('assets/programs.csv'); const text = await res.text();
    const items = parseCSV(text).filter(x => String(x.active).trim() === '1' && String(x.featured).trim() === '1');
    host.innerHTML = items.map(x => {
      const price = x.price_from ? `от ${x.price_from} ₽` : '';
      const orderLink = (state.cfg?.avito || '#');
      return `<article class="program-card card">
        <img loading="lazy" src="${x.image}" alt="${x.title} — изображение">
        <h3>${x.title}</h3>
        <p class="muted">${x.desc||''}</p>
        <div class="price">${price}</div>
        <p><a class="btn" href="${orderLink}">Оформить заказ</a></p>
      </article>`;
    }).join('');
  }

  async function renderGallery(){
    const host = $('#gallery'); if (!host) return;
    const res = await fetch('assets/gallery.txt'); const text = await res.text();
    const rows = text.trim().split(/\r?\n/).filter(Boolean).map(line => {
      const [path, title='', caption=''] = line.split('|');
      return { path: `assets/gallery/${path.trim()}`, title: title.trim(), caption: caption.trim() };
    });
    host.innerHTML = rows.map(g => {
      const base = g.path.replace(/\.(svg|png|jpe?g|webp)$/i, '');
      return `<figure>
        <img loading="lazy" data-fb-base="${base}" alt="${g.title||'Фото из галереи'}">
        <figcaption><strong>${g.title||''}</strong><br><span class="muted">${g.caption||''}</span></figcaption>
      </figure>`;
    }).join('');
    host.querySelectorAll('img[data-fb-base]').forEach(img=>{
      const base = img.getAttribute('data-fb-base'); setImgWithFallback(img, base);
    });
  }

  async function renderReviews(){
    const host = $('#reviews'); if (!host) return;
    const res = await fetch('assets/reviews.csv'); const text = await res.text();
    const items = parseCSV(text);
    host.innerHTML = items.map(r => `
      <article class="review">
        <h3>${r.name} — ${'★'.repeat(parseInt(r.rating||'0'))}</h3>
        <p class="muted">${r.city} • ${r.date}</p>
        <p>${r.text}</p>
      </article>
    `).join('');
  }

  function getQuery(){
    const q = new URLSearchParams(location.search);
    const o = {}; q.forEach((v,k) => o[k]=v);
    return o;
  }

  function setupContacts(){
    const form = $('#order-form'); if (!form) return;
    const q = getQuery();
    if (q.format && form.elements['format']) form.elements['format'].value = q.format;
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      const d = new FormData(form);
      const subj = q.subject || `Заказ: ${d.get('format')||''}`;
      const price = q.price ? `\nЦена от: ${q.price}` : '';
      const body = `Имя: ${d.get('name')}\nТелефон: ${d.get('phone')}\nФормат: ${d.get('format')}${price}\nКомментарий: ${d.get('comment')||''}`;
      window.location.href = (state.cfg?.avito || '#');
    });
  }

  // Wheel: lightweight, pauses when out of view, drag to rotate
  async function setupWheel(){
    const tracks = $$('.wheel-track'); if (!tracks.length) return;
    const res = await fetch('assets/wheel.txt'); const text = await res.text();
    const items = text.trim().split(/\r?\n/).filter(Boolean).map(p => `assets/wheel/${p.trim()}`);

    tracks.forEach(track => {
      const N = items.length;
      const radius = 120;
      const center = { x: 140, y: 140 };
      items.forEach((src, i) => {
        const angle = (i / N) * Math.PI * 2;
        const x = center.x + radius * Math.cos(angle) - 55;
        const y = center.y + radius * Math.sin(angle) - 55;
        const el = document.createElement('div');
        el.className = 'wheel-item';
        el.style.transform = `translate(${x}px, ${y}px)`;
        const img = document.createElement("img"); img.loading="lazy"; img.alt=`Аниматор ${i+1}`; setImgWithFallback(img, src); el.appendChild(img);
        track.appendChild(el);
      });

      let rot = 0, playing = true, last = performance.now();
      let dragging = false, prevX = 0;

      const step = (t) => {
        if (!playing) { requestAnimationFrame(step); return; }
        const dt = t - last; last = t;
        rot += dt * 0.00025 * 360; // degrees per ms
        track.style.transform = `rotate(${rot}deg)`;
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);

      // Pause when out of view
      const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { playing = e.isIntersecting; });
      }, { threshold: 0.15 });
      obs.observe(track.closest('[data-wheel]'));

      // Drag
      const onDown = (e) => { dragging = true; prevX = (e.touches?.[0]?.clientX ?? e.clientX); playing = false; };
      const onMove = (e) => {
        if (!dragging) return;
        const x = (e.touches?.[0]?.clientX ?? e.clientX);
        const dx = x - prevX; prevX = x;
        rot += dx * 0.6; // sensitivity
        track.style.transform = `rotate(${rot}deg)`;
      };
      const onUp = () => { dragging = false; playing = true; };
      const area = track.parentElement;
      area.addEventListener('mousedown', onDown);
      area.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
      area.addEventListener('touchstart', onDown, {passive:true});
      area.addEventListener('touchmove', onMove, {passive:true});
      window.addEventListener('touchend', onUp);
    });
  }

  function showFabOnMobile(){
    const fab = $('#fab-call'); if (!fab) return;
    if (window.matchMedia('(max-width: 800px)').matches) fab.classList.add('show');
  }

  
  // Image loader with extension fallback (jpg -> jpeg -> png -> svg)
  
  // Image loader with extension fallback (jpg -> jpeg -> png -> svg)
  
function setImgWithFallback(img, base, order){
  // Normalize base: allow passing with or without extension
  const match = String(base).match(/\.(svg|png|jpe?g|webp)$/i);
  const baseNoExt = match ? base.replace(/\.(svg|png|jpe?g|webp)$/i,'') : base;

  // Preferred order (lowercase)
  const preferred = (order && order.length ? order.slice() : ['jpg','jpeg','png','webp','svg']).map(e=>String(e).toLowerCase());

  // Build a case-robust list: lower + UPPER (for case-sensitive hosts)
  const exts = [];
  // If user passed explicit extension, start with it first
  if (match) {
    const startExt = match[1];
    exts.push(startExt);
    preferred.filter(e => e.toLowerCase() !== startExt.toLowerCase()).forEach(e=>exts.push(e));
  } else {
    preferred.forEach(e=>exts.push(e));
  }
  // Add uppercase variants after lowercase to hit files like .JPG on Linux hosting
  const upperExtras = exts.map(e=>e.toUpperCase()).filter(e=>!exts.includes(e));
  exts.push(...upperExtras);

  let idx = 0;
  function tryNext(){
    if (idx >= exts.length) { return; }
    const ext = exts[idx++];
    img.src = baseNoExt + '.' + ext;
  }
  img.onerror = tryNext;
  tryNext();
}
}

window.addEventListener('DOMContentLoaded', async ()=>{
  // normalize order buttons to Avito
  setTimeout(()=> {
    $$('a.btn').forEach(a=>{
      if (/Заказать|Оформить/i.test(a.textContent)) { a.href = (state.cfg?.avito || '#'); a.setAttribute('target','_blank'); a.setAttribute('rel','noopener'); }
    });
  }, 200);

    await loadConfig();
    await Promise.all([renderCatalog(), renderFeatured(), renderGallery(), renderReviews()]);
    setupContacts();
    setupWheel();
    showFabOnMobile();
    // Add CTA button in header nav
    const nav = $('.nav');
    if (nav && !$('#nav-order-cta')) {
      const a = document.createElement('a');
      a.id = 'nav-order-cta';
      a.className = 'btn';
      a.textContent = 'Оформить заказ';
      a.href = (state.cfg?.avito || '#');
      a.setAttribute('target','_blank');
      a.setAttribute('rel','noopener');
      nav.appendChild(a);
    }

  });
})();


// Utility: bind any link with data-avito="1" to cfg.avito
document.addEventListener('DOMContentLoaded', ()=>{
  $$('a[data-avito="1"]').forEach(a=>{
    a.href = (state.cfg?.avito || '#');
    a.setAttribute('target','_blank'); a.setAttribute('rel','noopener');
  });
});
