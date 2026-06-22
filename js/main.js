/* ========================================================================
   BELORA MOBILITY — interaction layer
   Lenis smooth scroll · GSAP / ScrollTrigger · Three.js hero field
   ===================================================================== */
(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.matchMedia('(max-width:900px)').matches;

  /* ------------------------------------------------------------------ */
  /*  THREE.JS — undulating particle terrain (site coverage + movement) */
  /* ------------------------------------------------------------------ */
  function initThree() {
    if (!window.THREE) return;
    const canvas = document.getElementById('webgl');
    if (!canvas) return;

    const LIME = 0x00d865;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf2f3ee, 0.011);   // gently melt distant elements into the bg

    /* ---- orthographic iso camera (soft 3D, vectr-style) ---- */
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
    camera.position.set(13, 12, 17);
    const VIEW = isMobile ? 8.5 : 16;       // smaller = zoomed in; mobile zoomed in more (bigger scene)
    function setFrustum() {
      const a = (canvas.clientWidth || 1) / (canvas.clientHeight || 1);
      camera.left = -VIEW * a; camera.right = VIEW * a;
      camera.top = VIEW; camera.bottom = -VIEW;
      camera.updateProjectionMatrix();
    }

    /* ---- soft lighting + contact shadows ---- */
    scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe4da, 0.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.15);
    sun.position.set(-7, 12, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.radius = 7;
    sun.shadow.bias = -0.0006;
    const sc = sun.shadow.camera;
    sc.near = 1; sc.far = 140; sc.left = -44; sc.right = 44; sc.top = 44; sc.bottom = -44;
    sc.updateProjectionMatrix();
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.22);
    fill.position.set(9, 6, -6);
    scene.add(fill);

    const site = new THREE.Group();
    site.position.x = isMobile ? 0 : 6.0;
    scene.add(site);

    // invisible ground that only catches soft shadows (objects float on the page bg)
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.ShadowMaterial({ opacity: 0.3 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    site.add(ground);

    /* ---- materials: near-bg tones, readable through shading ---- */
    const M = (hex, extra) => new THREE.MeshStandardMaterial(
      Object.assign({ color: hex, roughness: 0.95, metalness: 0.0 }, extra || {}));
    const matWall  = M(0xe2e6dd);
    const matWall2 = M(0xd8ddd1);
    const matRoof  = M(0xeef1ea);
    const matLeaf  = M(0xcdded0);
    const matTrunk = M(0xd6d8cf);
    const matWater = M(0x9fe3c4, { roughness: 0.4, emissive: 0x0f3d28, emissiveIntensity: 0.18 });
    const matLime  = new THREE.MeshBasicMaterial({ color: LIME });

    // soft rounded box (centred like BoxGeometry) — premium, low-poly-free silhouette
    const _boxCache = {};
    function box(w, h, d, mat) {
      const r = Math.max(0.04, Math.min(0.16, w * 0.26, d * 0.26, h * 0.4));
      const bev = Math.min(0.07, h * 0.22, w * 0.22, d * 0.22);
      const key = [w, h, d].map((n) => n.toFixed(2)).join('_');
      let geo = _boxCache[key];
      if (!geo) {
        const x = -w / 2, y = -d / 2, s = new THREE.Shape();
        s.moveTo(x + r, y);
        s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
        s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
        s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
        s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
        geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(h - bev * 2, 0.01),
          bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 5 });
        geo.rotateX(-Math.PI / 2);
        geo.translate(0, bev - h / 2, 0);   // re-centre on origin
        _boxCache[key] = geo;
      }
      const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m;
    }

    /* ---- builders (all soft, rounded volumes) ---- */
    function hotel(h) {                       // tiered tower with rounded rooftop unit
      const g = new THREE.Group();
      const b = box(1.7, h, 1.7, matWall); b.position.y = h / 2; g.add(b);
      const u = box(1.15, h * 0.45, 1.15, matWall2); u.position.y = h + h * 0.225; g.add(u);
      const cap = box(0.7, 0.26, 0.7, matRoof); cap.position.y = h + h * 0.45 + 0.13; g.add(cap);
      const lip = box(1.82, 0.16, 1.82, matRoof); lip.position.y = h + 0.08; g.add(lip);
      return g;
    }
    function pavilion() {                      // restaurant — low block, soft overhang roof
      const g = new THREE.Group();
      const base = box(2.6, 0.62, 1.7, matWall); base.position.y = 0.31; g.add(base);
      const roof = box(3.0, 0.2, 2.1, matRoof); roof.position.y = 0.74; g.add(roof);
      return g;
    }
    function cabin() {                         // small soft hut + rounded roof
      const g = new THREE.Group();
      const b = box(0.95, 0.5, 0.85, matWall); b.position.y = 0.25; g.add(b);
      const r = box(1.05, 0.34, 0.95, matRoof); r.position.y = 0.62; g.add(r);
      return g;
    }
    function pool(w, d) {                       // soft deck + water
      const g = new THREE.Group();
      const deck = box(w + 0.6, 0.16, d + 0.6, matWall2); deck.position.y = 0.08; g.add(deck);
      const water = box(w, 0.12, d, matWater); water.position.y = 0.16; g.add(water);
      return g;
    }
    function tree() {
      const g = new THREE.Group();
      const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.34, 10), matTrunk);
      tr.position.y = 0.17; tr.castShadow = true; g.add(tr);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 14), matLeaf);
      f.position.y = 0.62; f.scale.y = 1.12; f.castShadow = true; g.add(f);
      return g;
    }
    function containers() {                    // industrial nod — soft stacked units
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const c = box(0.52, 0.36, 0.78, i % 2 ? matWall2 : matWall);
        c.position.set(i * 0.62, 0.18 + (j ? 0.4 : 0), j * 0.9); g.add(c);
      }
      return g;
    }
    function tower() {                          // tall slim signature tower
      const g = new THREE.Group();
      const h = 4.6;
      const b = box(1.1, h, 1.1, matWall); b.position.y = h / 2; g.add(b);
      const mid = box(1.18, 0.16, 1.18, matRoof); mid.position.y = h * 0.62; g.add(mid);
      const crown = box(1.22, 0.2, 1.22, matRoof); crown.position.y = h - 0.05; g.add(crown);
      const cap = box(0.5, 0.55, 0.5, matWall2); cap.position.y = h + 0.28; g.add(cap);
      return g;
    }
    function villa() {                          // wide low resort villa / suite block
      const g = new THREE.Group();
      const b = box(2.2, 0.72, 1.4, matWall); b.position.y = 0.36; g.add(b);
      const wing = box(1.1, 0.58, 1.0, matWall2); wing.position.set(1.35, 0.29, 0.32); g.add(wing);
      const roof = box(2.4, 0.16, 1.6, matRoof); roof.position.y = 0.78; g.add(roof);
      return g;
    }
    function roundhouse() {                      // spa / circular pavilion with soft dome
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.98, 0.95, 30), matWall);
      body.position.y = 0.48; body.castShadow = true; body.receiveShadow = true; g.add(body);
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.92, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), matRoof);
      dome.position.y = 0.95; dome.scale.y = 0.55; dome.castShadow = true; g.add(dome);
      return g;
    }
    function warehouse() {                       // logistics / industrial shed with roof vents
      const g = new THREE.Group();
      const b = box(3.4, 1.0, 1.9, matWall2); b.position.y = 0.5; g.add(b);
      const roof = box(3.5, 0.14, 2.0, matRoof); roof.position.y = 1.06; g.add(roof);
      for (let i = -1; i <= 1; i++) { const v = box(0.32, 0.2, 0.5, matWall); v.position.set(i * 1.0, 1.2, 0); g.add(v); }
      return g;
    }
    function silo() {                            // industrial tank
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.7, 22), matWall2);
      body.position.y = 0.85; body.castShadow = true; body.receiveShadow = true; g.add(body);
      const top = new THREE.Mesh(
        new THREE.SphereGeometry(0.52, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), matRoof);
      top.position.y = 1.7; top.castShadow = true; g.add(top);
      return g;
    }
    function place(obj, x, z, ry) {
      obj.position.x = x; obj.position.z = z;
      if (ry) obj.rotation.y = ry;
      site.add(obj); return obj;
    }

    /* ---- compose the resort + a touch of industrial ---- */
    const SP = 2.7;             // spacing multiplier — keep the site airy, well separated
    const hubs = [];           // ground nodes for the mobility network
    const HUB_TYPES = { hotel: 1, tower: 1, pavilion: 1, pool: 1, warehouse: 1, containers: 1 };
    const layout = [
      // resort (left / centre)
      ['hotel', -1.3, -1.0, 3.2], ['tower', 1.5, -1.9],
      ['villa', -3.4, -0.3], ['roundhouse', 0.5, 0.3],
      ['hotel', 2.9, -0.5, 2.7], ['pavilion', -1.7, 1.7],
      ['pool', 0.1, 2.8, 1.8, 1.1], ['villa', 3.6, 1.9],
      ['cabin', -3.2, 2.3], ['cabin', 1.9, 3.6], ['pavilion', -3.8, -2.6],
      // industrial (right)
      ['warehouse', 6.0, -1.5], ['silo', 5.2, 1.1],
      ['containers', 6.8, 2.7], ['cabin', 4.6, -3.0],
    ];
    layout.forEach((it) => {
      const t = it[0], x = it[1] * SP, z = it[2] * SP;
      let obj;
      if (t === 'hotel') obj = hotel(it[3]);
      else if (t === 'tower') obj = tower();
      else if (t === 'villa') obj = villa();
      else if (t === 'roundhouse') obj = roundhouse();
      else if (t === 'warehouse') obj = warehouse();
      else if (t === 'silo') obj = silo();
      else if (t === 'pavilion') obj = pavilion();
      else if (t === 'cabin') obj = cabin();
      else if (t === 'pool') obj = pool(it[3], it[4]);
      else if (t === 'containers') obj = containers();
      place(obj, x, z, (Math.floor(x * 7 + z * 13) % 4) * 0.18);
      if (HUB_TYPES[t]) hubs.push({ x, z });
    });

    // scattered trees (avoid overlapping the structures)
    const treeSpots = [
      [-2.2, 0.5], [-0.4, 1.5], [1.0, -2.4], [-4.2, -1.2], [3.4, 0.6],
      [-2.8, 2.9], [4.8, 0.0], [0.4, -3.0], [2.2, 2.6], [-0.6, -1.5],
      [4.0, -1.0], [-3.6, 1.2], [5.6, -2.4], [2.7, -0.9], [-1.1, 3.2],
    ];
    treeSpots.forEach((p) => { const tr = tree(); tr.scale.setScalar(0.85 + (Math.abs(p[0] * p[1]) % 1) * 0.5); place(tr, p[0] * SP, p[1] * SP); });

    /* ---- mobility network across the hubs (lime routes + pulses) ---- */
    const edges = [], edgeSet = new Set(), adj = hubs.map(() => []);
    hubs.forEach((_, i) => {
      const d = hubs.map((h, j) => [(_.x - h.x) ** 2 + (_.z - h.z) ** 2, j])
        .filter((e) => e[1] !== i).sort((a, b) => a[0] - b[0]);
      for (let k = 0; k < Math.min(2, d.length); k++) {
        const j = d[k][1], key = i < j ? i + '-' + j : j + '-' + i;
        if (edgeSet.has(key)) continue;
        edgeSet.add(key);
        const ei = edges.length; edges.push([i, j]);
        adj[i].push(ei); adj[j].push(ei);
      }
    });
    // each route is a gently winding curved path; pulses ride these same curves
    const routeMat = new THREE.MeshBasicMaterial({ color: LIME });
    const edgeCurves = edges.map(([a, b], idx) => {
      const A = hubs[a], B = hubs[b];
      const dx = B.x - A.x, dz = B.z - A.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len, pz = dx / len;                  // perpendicular in XZ
      const sign = ((a * 7 + b * 13 + idx) % 2) ? 1 : -1;
      const bow = Math.min(2.4, Math.max(0.8, len * 0.32)) * sign;
      // two offset control points → an S-like winding path that "follows" a route
      const p1 = new THREE.Vector3(A.x + dx * 0.33 + px * bow * 0.6, 0.07, A.z + dz * 0.33 + pz * bow * 0.6);
      const p2 = new THREE.Vector3(A.x + dx * 0.66 + px * bow, 0.07, A.z + dz * 0.66 + pz * bow);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(A.x, 0.07, A.z), p1, p2, new THREE.Vector3(B.x, 0.07, B.z),
      ], false, 'catmullrom', 0.5);
      site.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.075, 8, false), routeMat));
      return curve;
    });

    // lime "station" rings where routes meet each building
    const ringGeo = new THREE.TorusGeometry(0.26, 0.05, 10, 26);
    hubs.forEach((h) => {
      const r = new THREE.Mesh(ringGeo, routeMat);
      r.rotation.x = -Math.PI / 2; r.position.set(h.x, 0.05, h.z); site.add(r);
    });

    // travelling pulses follow the curves, routing building → building
    const PULSES = isMobile ? 8 : 14;
    const pulses = [], pulseMeshes = [];
    const pulseGeo = new THREE.SphereGeometry(0.18, 14, 14);
    for (let i = 0; i < PULSES; i++) {
      const e = Math.floor(Math.random() * Math.max(edges.length, 1));
      pulses.push({ e, dir: Math.random() < 0.5 ? 1 : -1, t: Math.random(), spd: 0.004 + Math.random() * 0.0045 });
      const m = new THREE.Mesh(pulseGeo, matLime); site.add(m); pulseMeshes.push(m);
    }
    const _pv = new THREE.Vector3();
    function stepPulse(p, m) {
      p.t += p.spd;
      if (p.t >= 1) {
        p.t -= 1;
        const arrived = p.dir > 0 ? edges[p.e][1] : edges[p.e][0];
        const opts = adj[arrived];
        if (opts && opts.length) {
          const ne = opts[Math.floor(Math.random() * opts.length)];
          p.e = ne; p.dir = (edges[ne][0] === arrived) ? 1 : -1;
        } else { p.dir *= -1; }
      }
      edgeCurves[p.e].getPoint(p.dir > 0 ? p.t : 1 - p.t, _pv);
      m.position.set(_pv.x, 0.16, _pv.z);
    }

    const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    window.addEventListener('pointermove', (e) => {
      mouse.tx = (e.clientX / window.innerWidth - 0.5);
      mouse.ty = (e.clientY / window.innerHeight - 0.5);
    });

    function resize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        renderer.setSize(w, h, false);
        setFrustum();
      }
    }

    const target = new THREE.Vector3(isMobile ? 0 : 1.2, 0.2, -0.5);
    let t = 0;
    function render() {
      resize();
      t += 0.01;
      mouse.x += (mouse.tx - mouse.x) * 0.05;
      mouse.y += (mouse.ty - mouse.y) * 0.05;
      for (let i = 0; i < PULSES; i++) stepPulse(pulses[i], pulseMeshes[i]);
      site.rotation.y = Math.sin(t * 0.06) * 0.06 + mouse.x * 0.12;
      camera.lookAt(target);
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    }
    setFrustum();
    if (!prefersReduced) render();
    else { resize(); camera.lookAt(target); renderer.render(scene, camera); }
  }

  /* ------------------------------------------------------------------ */
  /*  Background images (Unsplash, graceful — solid colour fallback)    */
  /* ------------------------------------------------------------------ */
  function initImages() {
    const map = {
      resort:     'assets/img/hospitality.jpg',   // Hospitality segment
      industrial: 'assets/img/industrial.jpg',    // Industrial segment (MB92 drydock)
      campus:     'assets/img/campus.jpg',         // Campus segment
      fleet:      'assets/img/ikos.jpg',           // Solution — fleet at a client site
      ikos:       'assets/img/story-ikos.jpg',     // Ikos customer story
      port:       'assets/img/port.jpg',           // MB92 customer story
      ikosthumb:  'assets/img/hospitality.jpg',    // proof bar thumbnail
      mb92thumb:  'assets/img/port.jpg',           // proof bar thumbnail
    };
    document.querySelectorAll('[data-img]').forEach((el) => {
      const key = el.getAttribute('data-img');
      if (map[key]) {
        const img = new Image();
        img.onload = () => { el.style.backgroundImage = `url(${map[key]})`; };
        img.src = map[key];
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Custom cursor                                                     */
  /* ------------------------------------------------------------------ */
  function initCursor() {
    if (isMobile) return;
    const cur = document.getElementById('cursor');
    const dot = document.getElementById('cursorDot');
    if (!cur || !dot) return;
    let mx = 0, my = 0, cx = 0, cy = 0;
    window.addEventListener('pointermove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
    });
    (function loop() {
      cx += (mx - cx) * 0.18; cy += (my - cy) * 0.18;
      cur.style.transform = `translate(${cx}px,${cy}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();
    document.querySelectorAll('[data-cursor="hover"]').forEach((el) => {
      el.addEventListener('mouseenter', () => cur.classList.add('is-hover'));
      el.addEventListener('mouseleave', () => cur.classList.remove('is-hover'));
    });
  }


  /* ------------------------------------------------------------------ */
  /*  Loader → hero intro                                               */
  /* ------------------------------------------------------------------ */
  function runLoader(done) {
    const loader = document.getElementById('loader');
    const countEl = document.getElementById('loaderCount');
    const fill = document.getElementById('loaderFill');
    if (!loader) { done(); return; }

    let finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      countEl.textContent = '100';
      fill.style.width = '100%';
      if (window.gsap) {
        gsap.to(loader, { yPercent: -100, duration: 0.9, ease: 'power4.inOut', delay: 0.1,
          onComplete: () => { loader.style.display = 'none'; } });
      } else { loader.style.display = 'none'; }
      // hard fallback: timers keep running even when rAF (gsap) is paused
      // (e.g. tab hidden during load), so the loader can never trap the page.
      setTimeout(() => { loader.style.display = 'none'; }, 1300);
      done();
    }

    let n = 0;
    const dur = prefersReduced ? 1 : 1100;
    const start = performance.now();
    (function tick(now) {
      const p = Math.min((now - start) / dur, 1);
      n = Math.round(p * 100);
      countEl.textContent = String(n).padStart(2, '0');
      fill.style.width = p * 100 + '%';
      if (p < 1) requestAnimationFrame(tick);
      else finish();
    })(start);

    // safety net: never let the loader trap the page if rAF stalls
    setTimeout(finish, prefersReduced ? 400 : 2600);
  }

  /* ------------------------------------------------------------------ */
  /*  Hero intro animation                                              */
  /* ------------------------------------------------------------------ */
  function heroIntro() {
    if (!window.gsap) return;
    const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tl.to('.hero__title .line > span', { yPercent: 0, duration: 1.15, stagger: 0.11 }, 0)
      .from('.hero__eyebrow', { y: 20, opacity: 0, duration: 0.8 }, 0.2)
      .from('.hero__sub', { y: 24, opacity: 0, duration: 0.9 }, 0.55)
      .from('.hero__actions', { y: 24, opacity: 0, duration: 0.9 }, 0.7)
      .from('.hero__scroll, .hero__meta', { opacity: 0, duration: 1 }, 0.9)
      .from('.nav', { y: -30, opacity: 0, duration: 0.9 }, 0.3);
  }

  /* ------------------------------------------------------------------ */
  /*  Lenis + ScrollTrigger choreography                                */
  /* ------------------------------------------------------------------ */
  function initScroll() {
    if (!window.gsap || !window.ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);

    let lenis;
    if (window.Lenis && !prefersReduced) {
      lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
      window.__lenis = lenis;     // exposed so the video modal can lock scroll
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((time) => lenis.raf(time * 1000));
      gsap.ticker.lagSmoothing(0);
      document.documentElement.classList.add('lenis');
      // anchor links via lenis
      document.querySelectorAll('a[href^="#"]').forEach((a) => {
        a.addEventListener('click', (e) => {
          const id = a.getAttribute('href');
          if (id.length > 1) { e.preventDefault(); lenis.scrollTo(id, { offset: 0, duration: 1.4 }); }
        });
      });
    }

    /* generic reveal-up */
    gsap.utils.toArray('.reveal-up').forEach((el) => {
      gsap.from(el, {
        y: 40, opacity: 0, duration: 1, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%' },
      });
    });

    /* section labels wipe */
    gsap.utils.toArray('.section-label span').forEach((el) => {
      gsap.from(el, {
        x: -20, opacity: 0, duration: 0.8, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%' },
      });
    });

    /* problem headline word-by-word */
    gsap.from('.problem__title .word', {
      opacity: 0.14, duration: 1, ease: 'none', stagger: 0.06,
      scrollTrigger: { trigger: '.problem__title', start: 'top 80%', end: 'bottom 62%', scrub: 1 },
    });

    /* customer story cards */
    gsap.from('.dcard', {
      y: 60, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.15,
      scrollTrigger: { trigger: '.proven__grid', start: 'top 84%' },
    });

    /* ---- horizontal pinned "Who we serve" ---- */
    if (!isMobile) {
      const track = document.getElementById('serveTrack');
      const pin = document.getElementById('servePin');
      if (track && pin) {
        const getScroll = () => track.scrollWidth - window.innerWidth + (window.innerWidth * 0.1);
        gsap.to(track, {
          x: () => -getScroll(),
          ease: 'none',
          scrollTrigger: {
            trigger: pin,
            start: 'top top',
            end: () => '+=' + getScroll(),
            pin: true,
            scrub: 1,
            invalidateOnRefresh: true,
            anticipatePin: 1,
          },
        });
        // panel parallax on media
        gsap.utils.toArray('.panel__media').forEach((m) => {
          gsap.fromTo(m, { x: -30 }, {
            x: 30, ease: 'none',
            scrollTrigger: { trigger: pin, start: 'top top', end: () => '+=' + getScroll(), scrub: 1 },
          });
        });
      }
    }

    setTimeout(() => ScrollTrigger.refresh(), 400);
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  /* ------------------------------------------------------------------ */
  /*  Contact form (front-end only)                                     */
  /* ------------------------------------------------------------------ */
  function initForm() {
    const form = document.getElementById('contactForm');
    const note = document.getElementById('formNote');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      if (!data.get('company') || !data.get('firstname') || !data.get('email') || !data.get('reason')) {
        note.style.color = '#ff6b6b';
        note.textContent = 'Please complete every field.';
        return;
      }
      note.style.color = 'var(--lime)';
      note.textContent = 'Thank you — we’ll be in touch shortly.';
      form.reset();
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Mobile burger -> simple anchor scroll list (reuse nav links)      */
  /* ------------------------------------------------------------------ */
  function initBurger() {
    const burger = document.getElementById('burger');
    const menu = document.getElementById('navMenu');
    if (!burger || !menu) return;

    function setOpen(open) {
      burger.classList.toggle('is-open', open);
      menu.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      document.documentElement.style.overflow = open ? 'hidden' : '';
      if (window.__lenis) { open ? window.__lenis.stop() : window.__lenis.start(); }
    }
    burger.addEventListener('click', () => setOpen(!menu.classList.contains('is-open')));
    // close the menu when a link is tapped (the anchor handler still scrolls)
    menu.querySelectorAll('[data-navlink]').forEach((a) => {
      a.addEventListener('click', () => setOpen(false));
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  /* ------------------------------------------------------------------ */
  /*  Testimonial video modal                                           */
  /* ------------------------------------------------------------------ */
  function initVideo() {
    const modal = document.getElementById('videoModal');
    const video = document.getElementById('testimonialVideo');
    if (!modal || !video) return;

    function open(src) {
      if (src && video.getAttribute('src') !== src) video.setAttribute('src', src);
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      document.documentElement.style.overflow = 'hidden';
      if (window.__lenis && window.__lenis.stop) window.__lenis.stop();
      try { video.currentTime = 0; } catch (e) {}
      const p = video.play();
      if (p && p.catch) p.catch(() => {});
    }
    function close() {
      if (!modal.classList.contains('is-open')) return;
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
      document.documentElement.style.overflow = '';
      if (window.__lenis && window.__lenis.start) window.__lenis.start();
      video.pause();
    }

    document.querySelectorAll('[data-video]').forEach((btn) => {
      btn.addEventListener('click', () => open(btn.getAttribute('data-video')));
    });
    modal.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  }

  /* ------------------------------------------------------------------ */
  /*  Stat count-up                                                     */
  /* ------------------------------------------------------------------ */
  function initStats() {
    const els = document.querySelectorAll('.count');
    if (!els.length) return;
    function run(el) {
      const target = parseInt(el.getAttribute('data-count'), 10) || 0;
      const dur = 1700, start = performance.now();
      (function tick(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString('en-US');
        if (p < 1) requestAnimationFrame(tick);
      })(start);
    }
    els.forEach((el) => {
      if (window.ScrollTrigger) ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => run(el) });
      else run(el);
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Nav — glass background after leaving the hero                     */
  /* ------------------------------------------------------------------ */
  function initNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ------------------------------------------------------------------ */
  /*  Boot                                                              */
  /* ------------------------------------------------------------------ */
  function boot() {
    // Let GSAP own the hero-title transform from the start (avoids a CSS
    // translateY conflicting with gsap's yPercent channel). Title stays
    // visible by default, so it still shows if JS/GSAP never loads.
    if (window.gsap) gsap.set('.hero__title .line > span', { yPercent: 115 });
    initThree();
    initImages();
    initCursor();
    initForm();
    initBurger();
    initVideo();
    initNav();
    initScroll();
    initStats();
    runLoader(() => { heroIntro(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else { boot(); }
})();
