/* Fender Bender Chooser: comprehensive car insurance for a Geely EX5 in NSW */
(function () {
  const D = window.FB;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt$ = n => (n < 0 ? "−" : "") + "$" + Math.round(Math.abs(n)).toLocaleString("en-AU");
  const pct = n => Math.round(n * 100) + "%";
  const byId = Object.fromEntries(D.products.map(p => [p.id, p]));
  const FEAT = Object.fromEntries(D.features.map(f => [f.k, f]));

  const AGES = [
    { v: "u21", label: "Under 21", f: 2.3 }, { v: "21", label: "21–24", f: 1.6 }, { v: "25", label: "25–29", f: 1.2 },
    { v: "30", label: "30–39", f: 1.0 }, { v: "40", label: "40–49", f: 0.95 }, { v: "50", label: "50–64", f: 0.88 }, { v: "65", label: "65+", f: 0.92 },
  ];
  const CLAIMS_F = { 0: 1, 1: 1.3, 2: 1.65 };
  const PARK_F = { garage: 0.95, driveway: 1, street: 1.08 };
  const kmF = km => km <= 7000 ? 0.92 : km <= 12000 ? 0.97 : km <= 18000 ? 1.02 : km <= 25000 ? 1.07 : 1.12;
  const REF = D.baseline;
  const ageMin = () => ({ u21: 17, 21: 21, 25: 25, 30: 30, 40: 40, 50: 50, 65: 65 })[state.age];

  // ---------- state ----------
  const LS = "fender-bender-v1", LSQ = "fender-bender-quotes-v1";
  const defaultMust = () => D.features.filter(f => f.defaultMust).map(f => f.k);
  const DEFAULT_PROFILE = { variant: D.car.variants[0].name, carValue: D.car.defaultValue, age: "30", claims: "0", youngDriver: false, park: "garage", km: 12000, excess: 1000, pay: "annual", multi: "" };
  const DEFAULT_FILTERS = { q: "", basis: [], brandsOff: [], hideMissing: false };
  const saved = JSON.parse(localStorage.getItem(LS) || "{}");
  const state = Object.assign({ horizon: "y1", view: "grid", sort: "cost", compare: [], must: defaultMust() }, DEFAULT_PROFILE, DEFAULT_FILTERS, saved);
  state.compare = state.compare.filter(id => byId[id]);
  let quotes = JSON.parse(localStorage.getItem(LSQ) || "[]");
  const persist = () => localStorage.setItem(LS, JSON.stringify(state));
  const persistQ = () => localStorage.setItem(LSQ, JSON.stringify(quotes));
  const quoteFor = id => quotes.filter(q => q.id === id).sort((a, b) => a.total - b.total)[0];

  // ---------- engine ----------
  function profileFactor() {
    const age = AGES.find(a => a.v === state.age)?.f || 1;
    return age * CLAIMS_F[state.claims] * (state.youngDriver ? 1.35 : 1) * PARK_F[state.park] * kmF(state.km)
      * Math.pow(state.carValue / REF.carValue, 0.75);
  }
  const excessF = ex => Math.min(1.3, Math.max(0.72, 1 - 0.07 * (ex - REF.excess) / 500));

  function estimate(p) {
    const f = profileFactor() * excessF(state.excess) * (p.priceIndex || 1);
    let premium = REF.premium * f;
    const lines = [{ k: "Base premium", v: premium, sub: `${D.car.name} ${state.variant}, your profile${p.priceIndex && p.priceIndex !== 1 ? `, brand price index ×${p.priceIndex.toFixed(2)}` : ""}` }];
    if (state.horizon === "y1" && p.onlineDiscount) { const d = premium * p.onlineDiscount; premium -= d; lines.push({ k: `Buy-online discount (first year, ${pct(p.onlineDiscount)})`, v: -d }); }
    if (state.horizon === "y1" && p.onlineFlat) { premium -= p.onlineFlat; lines.push({ k: `Buy-online discount (first year)`, v: -p.onlineFlat }); }
    if (state.multi && (state.multi === p.brand) && p.multiDiscount) { const d = premium * p.multiDiscount; premium -= d; lines.push({ k: `Multi-policy discount (${pct(p.multiDiscount)})`, v: -d }); }
    if (state.pay === "monthly" && p.monthlyLoading) { const d = premium * p.monthlyLoading; premium += d; lines.push({ k: `Paying monthly (+${pct(p.monthlyLoading)})`, v: d }); }
    return { premium, lines };
  }

  function evaluate(p) {
    const est = estimate(p);
    const addons = [], missing = [];
    for (const k of state.must) {
      const x = p.f[k] || { s: "unknown" };
      if (x.s === "addon") addons.push({ k, cost: typeof x.cost === "number" ? x.cost : FEAT[k].addon, published: typeof x.cost === "number" });
      else if (x.s === "no" || x.s === "unknown") missing.push({ k, s: x.s });
    }
    const addonTotal = addons.reduce((s, a) => s + a.cost, 0);
    const q = quoteFor(p.id);
    const estTotal = est.premium + addonTotal;
    // at renewal the one-off buy-online discount drops off, so gross the quote back up
    const renewUp = q && state.horizon === "renew" && p.onlineDiscount ? 1 / (1 - p.onlineDiscount) : 1;
    const total = q ? q.total * renewUp + (q && state.horizon === "renew" ? p.onlineFlat || 0 : 0) : estTotal;
    // cover fit: must-haves count triple
    let got = 0, max = 0;
    for (const f of D.features) {
      const w = (f.weight || 1) * (state.must.includes(f.k) ? 3 : 1);
      const s = p.f[f.k]?.s;
      got += w * (s === "yes" ? 1 : s === "addon" ? 0.8 : s === "partial" ? 0.5 : 0); max += w;
    }
    const excess = q?.excess ?? Math.max(state.excess, p.excessRange ? p.excessRange[0] : 0);
    const youngEx = state.youngDriver || ["u21", "21"].includes(state.age) ? (p.youngExcessAmt || 0) : 0;
    return { est, addons, addonTotal, missing, q, renewUp, total, estTotal, low: estTotal * 0.78, high: estTotal * 1.25, fit: got / max, excess, badYear: total + excess + youngEx, youngEx };
  }

  function passes(p) {
    if (state.q && !(`${p.brand} ${p.product} ${p.group}`.toLowerCase().includes(state.q.toLowerCase()))) return false;
    if (state.brandsOff.includes(p.brand)) return false;
    if (p.minAge && ageMin() < p.minAge) return false;
    if (state.basis.length && !state.basis.some(b => p.valueBasis === b || p.valueBasis === "choice")) return false;
    if (state.hideMissing && evaluate(p).missing.length) return false;
    return true;
  }

  const SORTS = {
    cost: (a, b) => (a.v.missing.length > 0) - (b.v.missing.length > 0) || a.v.total - b.v.total,
    fit: (a, b) => b.v.fit - a.v.fit || a.v.total - b.v.total,
    claims: (a, b) => (b.p.claims?.accept ?? -1) - (a.p.claims?.accept ?? -1) || a.v.total - b.v.total,
    excess: (a, b) => (a.p.basicExcess ?? 9e9) - (b.p.basicExcess ?? 9e9),
    brand: (a, b) => (a.p.brand + a.p.product).localeCompare(b.p.brand + b.p.product),
  };

  // ---------- sidebar ----------
  function bindRange(id, get, set) {
    const el = $(id), num = $(id + "Num");
    const show = () => { const v = get(); el.value = Math.min(+el.max, Math.max(+el.min, v)); num.value = v; };
    show();
    el.oninput = () => { set(+el.value); show(); update(); };
    num.onchange = () => { const v = parseFloat(num.value); set(isNaN(v) ? 0 : Math.max(0, v)); show(); update(); };
    num.onkeydown = e => { if (e.key === "Enter") num.blur(); };
    return show;
  }
  const showers = [];
  const chipGroup = (sel, key, multi = false, after) => {
    const sync = () => $$(sel + " button").forEach(b => b.classList.toggle("on", multi ? state[key].includes(b.dataset.v) : String(state[key]) === b.dataset.v));
    $$(sel + " button").forEach(b => b.onclick = () => {
      if (multi) { const i = state[key].indexOf(b.dataset.v); i >= 0 ? state[key].splice(i, 1) : state[key].push(b.dataset.v); }
      else state[key] = b.dataset.v;
      sync(); after && after(b.dataset.v); update();
    });
    sync(); return sync;
  };
  const syncers = [];
  function initSidebar() {
    $("#variantChips").innerHTML = D.car.variants.map(v => `<button data-v="${esc(v.name)}">${esc(v.name)} <small>${fmt$(v.rrp)}</small></button>`).join("");
    syncers.push(chipGroup("#variantChips", "variant", false, v => { const x = D.car.variants.find(a => a.name === v); state.carValue = x.value; showers.forEach(s => s()); }));
    $("#ageChips").innerHTML = AGES.map(a => `<button data-v="${a.v}">${a.label}</button>`).join("");
    syncers.push(chipGroup("#ageChips", "age"));
    syncers.push(chipGroup("#claimsChips", "claims"));
    syncers.push(chipGroup("#parkChips", "park"));
    syncers.push(chipGroup("#payChips", "pay"));
    syncers.push(chipGroup("#basisChips", "basis", true));
    showers.push(bindRange("#carValue", () => state.carValue, v => state.carValue = v));
    showers.push(bindRange("#km", () => state.km, v => state.km = v));
    showers.push(bindRange("#excess", () => state.excess, v => state.excess = v));
    $("#carValueHint").innerHTML = esc(D.car.valueHint || "");

    const brands = [...new Set(D.products.map(p => p.brand))].sort();
    $("#multiSel").innerHTML = `<option value="">Nobody / not bundling</option>` + brands.map(b => `<option>${esc(b)}</option>`).join("");
    $("#multiSel").value = state.multi; $("#multiSel").onchange = e => { state.multi = e.target.value; update(); };

    const check = (id, key) => { const el = $(id); el.checked = !!state[key]; el.onchange = () => { state[key] = el.checked; update(); }; return () => el.checked = !!state[key]; };
    syncers.push(check("#youngDriver", "youngDriver"), check("#hideMissing", "hideMissing"));

    const renderMust = () => {
      $("#mustList").innerHTML = D.features.filter(f => !f.hideInMust).map(f => `<label class="must ${state.must.includes(f.k) ? "on" : ""}"><input type="checkbox" data-k="${f.k}" ${state.must.includes(f.k) ? "checked" : ""}><span><b>${esc(f.label)}</b><small>${esc(f.hint || "")}</small></span></label>`).join("");
      $$("#mustList input").forEach(i => i.onchange = () => { const k = i.dataset.k; state.must = i.checked ? [...state.must, k] : state.must.filter(x => x !== k); i.closest(".must").classList.toggle("on", i.checked); update(); });
    };
    renderMust();

    const renderBrands = () => {
      $("#brandList").innerHTML = brands.map(b => `<label class="${state.brandsOff.includes(b) ? "off" : ""}"><input type="checkbox" data-b="${esc(b)}" ${state.brandsOff.includes(b) ? "" : "checked"}>${esc(b)}<span class="n">${D.products.filter(p => p.brand === b).length}</span></label>`).join("");
      $$("#brandList input").forEach(i => i.onchange = () => { const b = i.dataset.b; state.brandsOff = i.checked ? state.brandsOff.filter(x => x !== b) : [...state.brandsOff, b]; renderBrands(); update(); });
    };
    renderBrands();
    $("#brandAll").onclick = () => { state.brandsOff = []; renderBrands(); update(); };
    $("#brandNone").onclick = () => { state.brandsOff = [...brands]; renderBrands(); update(); };

    const search = $("#search"); search.value = state.q; search.oninput = () => { state.q = search.value; update(); };
    $("#sortSel").value = state.sort; $("#sortSel").onchange = e => { state.sort = e.target.value; update(); };
    const seg = (sel, key, attr) => $$(sel + " button").forEach(b => { b.classList.toggle("on", b.dataset[attr] === state[key]); b.onclick = () => { state[key] = b.dataset[attr]; $$(sel + " button").forEach(x => x.classList.toggle("on", x === b)); update(); window.scrollTo({ top: 0 }); }; });
    seg("#horizon", "horizon", "h"); seg("#viewMode", "view", "view");

    $("#resetProfile").onclick = () => { Object.assign(state, DEFAULT_PROFILE); $("#multiSel").value = ""; showers.forEach(s => s()); syncers.forEach(s => s()); update(); };
    $("#resetMust").onclick = () => { state.must = defaultMust(); renderMust(); update(); };
    $("#resetFilters").onclick = () => { Object.assign(state, DEFAULT_FILTERS, { basis: [], brandsOff: [] }); search.value = ""; renderBrands(); syncers.forEach(s => s()); update(); };
    $("#disclaimer").textContent = D.disclaimer;
    $("#filtersDone").onclick = () => $("#filtersToggle").click();
    $("#filtersToggle").onclick = () => { const f = $("#filters"); f.classList.toggle("collapsed"); $("#filtersToggle i").textContent = f.classList.contains("collapsed") ? "Edit" : "Done"; if (f.classList.contains("collapsed")) $("#resultsHead").scrollIntoView(); };
  }

  // ---------- render ----------
  let rows = [];
  function update() {
    persist();
    $("#filtersSummary").textContent = `${state.variant}, ${fmt$(state.carValue)}, age ${AGES.find(a => a.v === state.age).label}, ${fmt$(state.excess)} excess · ${state.must.map(k => FEAT[k].short).join(", ") || "no must-haves"}`;
    rows = D.products.filter(passes).map(p => ({ p, v: evaluate(p) })).sort(SORTS[state.sort]);
    const quoted = D.products.filter(p => quoteFor(p.id)).length;
    $("#quoteCount").textContent = quotes.length ? quotes.length : "";
    const isList = state.view === "grid" || state.view === "table";
    $("#resultsHead").classList.toggle("hidden", !isList);
    $("#sortCtl").classList.toggle("hidden", state.view !== "grid");
    const best = rows.find(r => !r.v.missing.length) || rows[0];
    const ageHidden = D.products.filter(p => p.minAge && ageMin() < p.minAge).map(p => p.brand);
    $("#resultCount").textContent = `${rows.length} of ${D.products.length} comprehensive policies`;
    $("#resultSub").innerHTML = best ? `${state.horizon === "y1" ? "First-year" : "Renewal-year"} cost for a ${esc(D.car.name)} ${esc(state.variant)} insured for ${fmt$(state.carValue)}, ${fmt$(state.excess)} excess, ${state.must.length} must-have${state.must.length === 1 ? "" : "s"}. ${quoted ? `<b>${quoted}</b> with your real quotes.` : "All prices are estimates until you add real quotes."}${ageHidden.length ? ` ${[...new Set(ageHidden)].join(", ")} hidden (over-50s only).` : ""}` : "Nothing matches these filters.";
    $("#best").classList.toggle("hidden", !isList);
    if (isList) renderBest();
    for (const v of ["grid", "table", "quotes", "tips"]) $(v === "grid" ? "#grid" : `#${v}View`).classList.toggle("hidden", state.view !== v);
    if (state.view === "grid") renderGrid();
    else if (state.view === "table") renderTable();
    else if (state.view === "quotes") renderQuotes();
    else renderTips();
    renderTray();
  }

  const S_ICON = { yes: "✓", addon: "+", partial: "◐", no: "✕", unknown: "?" };
  const S_LABEL = { yes: "Included", addon: "Optional extra", partial: "Limited", no: "Not offered", unknown: "Not confirmed" };
  const sBadge = (x, k) => { const s = x?.s || "unknown"; const cost = s === "addon" ? (typeof x.cost === "number" ? fmt$(x.cost) : `≈${fmt$(FEAT[k]?.addon || 0)}`) : ""; return `<span class="st st-${s}" title="${esc(S_LABEL[s])}${x?.d ? ": " + esc(x.d) : ""}">${S_ICON[s]}${cost ? `<small>${cost}</small>` : ""}</span>`; };

  function priceBlock(v, big = false) {
    if (v.q) return `<div class="value ${big ? "big" : ""}">${fmt$(v.total)}<small class="real">${v.renewUp > 1 ? "your quote, without the first-year discount" : `your quote${v.q.freq === "monthly" ? ` (${fmt$(v.q.premium)}/mo)` : ""}`}</small></div>`;
    return `<div class="value est ${big ? "big" : ""}"><span class="approx">≈</span>${fmt$(v.estTotal)}<small>estimate ${fmt$(v.low)}–${fmt$(v.high)}/yr</small></div>`;
  }

  function tagsFor(p, v) {
    const t = [];
    t.push(`<span class="tag">${basisLabel(p)}</span>`);
    if (p.avoid) t.push(`<span class="tag bad" title="${esc(p.avoid)}">CHOICE: avoid</span>`);
    if (p.f.evCharger?.s === "yes") t.push(`<span class="tag offer">EV charger covered</span>`);
    if (p.f.newCarReplacement?.s === "yes") t.push(`<span class="tag offer">New car replacement${p.ncrLabel ? ` ${esc(p.ncrLabel)}` : ""}</span>`);
    if (state.horizon === "y1" && p.onlineDiscount) t.push(`<span class="tag offer">${pct(p.onlineDiscount)} off online</span>`);
    if (p.award) t.push(`<span class="tag gold" title="${esc(p.award)}">★ ${esc(p.awardShort || "Award")}</span>`);
    for (const m of v.missing) t.push(`<span class="tag ${m.s === "no" ? "bad" : "warn"}">${m.s === "no" ? "No" : "Unconfirmed:"} ${esc(FEAT[m.k].short)}</span>`);
    if (p.minAge) t.push(`<span class="tag warn">Over-${p.minAge}s only</span>`);
    if (state.horizon === "y1" && p.onlineFlat) t.push(`<span class="tag offer">${fmt$(p.onlineFlat)} off online</span>`);
    if (p.openToNew === false) t.push(`<span class="tag bad">Closed to new customers</span>`);
    return t.join("");
  }

  function renderBest() {
    const el = $("#best");
    const quotedRows = rows.filter(r => r.v.q).sort((a, b) => a.v.total - b.v.total);
    const ok = rows.filter(r => !r.v.missing.length && r.p.openToNew !== false);
    if (!quotedRows.length) {
      const next = ok.filter(r => !r.v.q).slice(0, 4);
      el.innerHTML = `<div class="best-body"><span class="mine-label">Start here</span><h2>No real quotes yet. ${next.length === 1 ? "Get this one first." : `Get these ${next.length} first.`}</h2>
        <p class="sub">They're the cheapest estimates that tick all your must-haves. Each takes about 5 minutes online; have your rego, VIN and licence handy (see <a href="#" data-view="quotes">checklist</a>).</p></div>
        <ol class="next">${next.map(r => `<li><a href="#" data-open="${r.p.id}">${esc(r.p.brand)} ${esc(r.p.product)}</a><span>≈${fmt$(r.v.estTotal)}</span>${r.p.url ? `<a class="go" href="${esc(r.p.quoteUrl || r.p.url)}" target="_blank" rel="noopener">Get quote ↗</a>` : ""}<button class="link small" data-addq="${r.p.id}">Log quote</button></li>`).join("")}</ol>`;
    } else {
      const b = quotedRows[0];
      const cheaper = ok.filter(r => !r.v.q && r.v.low < b.v.total).slice(0, 3);
      el.innerHTML = `<div class="best-body"><span class="mine-label">Best real quote</span><h2><a href="#" data-open="${b.p.id}">${esc(b.p.brand)} ${esc(b.p.product)}</a> at ${fmt$(b.v.total)}/yr</h2>
        <p class="sub">${b.v.missing.length ? `Missing: ${b.v.missing.map(m => esc(FEAT[m.k].short)).join(", ")}. ` : "Ticks every must-have. "}Excess ${fmt$(b.v.excess)}. ${quotedRows.length > 1 ? `${quotedRows.length} quotes logged, spread ${fmt$(quotedRows[quotedRows.length - 1].v.total - b.v.total)}.` : "Only one quote so far."}</p></div>
        <div class="best-verdict">${cheaper.length ? `<div class="mine-on">Could still beat it (estimate range dips below):</div><ol class="next">${cheaper.map(r => `<li><a href="#" data-open="${r.p.id}">${esc(r.p.brand)} ${esc(r.p.product)}</a><span>${fmt$(r.v.low)}–${fmt$(r.v.high)}</span><button class="link small" data-addq="${r.p.id}">Log quote</button></li>`).join("")}</ol>` : `<div class="mine-on">No unquoted policy is likely to beat this. Try ringing ${esc(b.p.brand)} and asking for a better price, or quoting a higher excess.</div>`}</div>`;
    }
    bindLinks(el);
  }

  function bindLinks(root) {
    root.querySelectorAll("[data-open]").forEach(a => a.onclick = e => { e.preventDefault(); openDetail(a.dataset.open); });
    root.querySelectorAll("[data-addq]").forEach(a => a.onclick = e => { e.preventDefault(); e.stopPropagation(); openQuoteForm(a.dataset.addq); });
    root.querySelectorAll("[data-view]").forEach(a => a.onclick = e => { e.preventDefault(); setView(a.dataset.view); });
  }
  function setView(v) { state.view = v; $$("#viewMode button").forEach(x => x.classList.toggle("on", x.dataset.view === v)); update(); window.scrollTo({ top: 0 }); }

  const basisLabel = p => ({ agreed: "Agreed value", market: "Market value", choice: "Agreed or market" })[p.valueBasis] || "Value basis unconfirmed";
  const k$ = n => n >= 1000 ? "$" + (n / 1000).toFixed(n % 1000 ? 1 : 0).replace(/\.0$/, "") + "k" : fmt$(n);
  const excessCell = p => p.basicExcess != null ? `<b>${fmt$(p.basicExcess)}</b>basic excess` : p.excessRange ? `<b>${k$(p.excessRange[0])}–${k$(p.excessRange[1])}</b>excess you pick` : `<b>–</b>excess not published`;
  function fitMeter(fit) { return `<div class="fit" title="Cover fit: how much of the cover list this policy has, with your must-haves counted triple"><i style="width:${Math.round(fit * 100)}%"></i></div>`; }

  function renderGrid() {
    const cheapest = rows.find(r => !r.v.missing.length);
    $("#grid").innerHTML = rows.length ? rows.map((r, i) => {
      const { p, v } = r;
      const cmp = state.compare.includes(p.id);
      return `<article class="card ${cmp ? "compared" : ""} ${r === cheapest && state.sort === "cost" ? "top" : ""} ${v.q ? "quoted" : ""}" data-id="${p.id}">
        ${r === cheapest && state.sort === "cost" ? `<span class="rank">${v.q ? "CHEAPEST REAL QUOTE" : "CHEAPEST ESTIMATE WITH YOUR MUST-HAVES"}</span>` : ""}
        <div class="plastic" style="background:${p.color}">
          <div class="issuer">${esc(p.brand)}</div>
          <div class="cname">${esc(p.product)}</div>
          <div class="uw">${esc(p.group)}</div>
          <button class="cmp" data-cmp="${p.id}" title="${cmp ? "Remove from compare" : "Add to compare"}">${cmp ? "✓" : "+"}</button>
        </div>
        <div class="tags">${tagsFor(p, v)}</div>
        <div class="value-row">
          ${priceBlock(v)}
          <div class="fee"><b>${fmt$(v.badYear)}</b><span>in a year you claim</span></div>
        </div>
        ${v.addons.length ? `<div class="addons">Includes extras: ${v.addons.map(a => `${esc(FEAT[a.k].short)} ${a.published ? "" : "≈"}${fmt$(a.cost)}`).join(" · ")}</div>` : ""}
        <div class="fit-row"><span>Cover fit</span>${fitMeter(v.fit)}<b>${pct(v.fit)}</b></div>
        <div class="dims">
          <div>${excessCell(p)}</div>
          <div title="CHOICE 2025 survey: share of claimants who rated the claim above average or excellent"><b>${p.claims?.accept != null ? pct(p.claims.accept) : "–"}</b>happy claimants</div>
          <div><b>${p.f.choiceOfRepairer?.s === "yes" ? "Yes" : p.f.choiceOfRepairer?.s === "addon" ? "Extra" : "No"}</b>own repairer</div>
        </div>
        <div class="card-actions"><button class="ghost small" data-addq="${p.id}">${v.q ? "Edit quote" : "Log my quote"}</button>${p.url ? `<a class="small" href="${esc(p.quoteUrl || p.url)}" target="_blank" rel="noopener">Get quote ↗</a>` : ""}</div>
      </article>`;
    }).join("") : `<div class="empty">No policies match. Loosen a filter or untick “hide missing”.</div>`;
    $$("#grid .card").forEach(c => c.onclick = e => { if (e.target.closest("button,a")) return; openDetail(c.dataset.id); });
    $$("#grid [data-cmp]").forEach(b => b.onclick = e => { e.stopPropagation(); toggleCompare(b.dataset.cmp); });
    bindLinks($("#grid"));
  }

  function renderTable() {
    const cols = rows;
    const head = `<tr><th class="corner">Cover</th>${cols.map(r => `<th><a href="#" data-open="${r.p.id}" class="mini" style="background:${r.p.color}"><small>${esc(r.p.brand)}</small>${esc(r.p.product)}</a></th>`).join("")}</tr>`;
    const priceRow = `<tr class="price"><td>${state.horizon === "y1" ? "First-year cost" : "Renewal cost"}</td>${cols.map(r => `<td>${r.v.q ? `<b>${fmt$(r.v.total)}</b><span class="sub">your quote</span>` : `<b class="est">≈${fmt$(r.v.estTotal)}</b>`}</td>`).join("")}</tr>`;
    const misc = [
      ["Car value basis", r => basisLabel(r.p)],
      ["Basic excess", r => r.p.basicExcess != null ? fmt$(r.p.basicExcess) : r.p.excessRange ? `${fmt$(r.p.excessRange[0])}–${fmt$(r.p.excessRange[1])}` : "?"],
      ["Happy claimants (CHOICE)", r => r.p.claims?.accept != null ? pct(r.p.claims.accept) : "–"],
      ["ProductReview", r => r.p.productReview != null ? r.p.productReview.toFixed(1) + " ★" : "–"],
    ].map(([k, fn]) => `<tr><td>${k}</td>${cols.map(r => `<td>${fn(r)}</td>`).join("")}</tr>`).join("");
    const feats = D.features.map(f => `<tr class="${state.must.includes(f.k) ? "must-row" : ""}"><td>${esc(f.label)}${state.must.includes(f.k) ? ` <span class="pill">must</span>` : ""}</td>${cols.map(r => `<td class="c">${sBadge(r.p.f[f.k], f.k)}</td>`).join("")}</tr>`).join("");
    $("#tableView").innerHTML = cols.length ? `<div class="legend">${Object.keys(S_ICON).map(s => `<span>${sBadge({ s, cost: s === "addon" ? 0 : null }, "x").replace(/<small>.*<\/small>/, "")} ${S_LABEL[s]}</span>`).join("")}<span class="muted">Hover any mark for the fine print. “≈” extras are typical prices, not published ones.</span></div>
      <div class="tscroll"><table class="cover-table"><thead>${head}</thead><tbody>${priceRow}${misc}${feats}</tbody></table></div>` : `<div class="empty">No policies match.</div>`;
    bindLinks($("#tableView"));
  }

  // ---------- detail ----------
  function openDetail(id) {
    const p = byId[id], v = evaluate(p);
    const costRows = v.q
      ? `<tr><td>Your quote${v.q.freq === "monthly" ? `<span class="sub">${fmt$(v.q.premium)} a month × 12</span>` : ""}</td><td>${fmt$(v.q.total)}</td></tr>`
      : v.est.lines.map(l => `<tr><td>${esc(l.k)}${l.sub ? `<span class="sub">${esc(l.sub)}</span>` : ""}</td><td class="${l.v < 0 ? "pos" : ""}">${fmt$(l.v)}</td></tr>`).join("")
        + v.addons.map(a => `<tr><td>${esc(FEAT[a.k].label)} (extra)<span class="sub">${a.published ? "published price" : "typical price, not published"}</span></td><td>${fmt$(a.cost)}</td></tr>`).join("");
    $("#detailPanel").innerHTML = `<button class="close" data-close aria-label="Close">×</button>
      <div class="detail">
        <div class="d-stage">
          <div class="d-title"><div class="b">${esc(p.group)}${p.underwriter ? " · " + esc(p.underwriter) : ""}</div><h2>${esc(p.brand)} ${esc(p.product)}</h2>
            <div class="meta">${basisLabel(p)} · basic excess ${p.basicExcess != null ? fmt$(p.basicExcess) : "not published"}${p.excessRange ? ` (choose ${fmt$(p.excessRange[0])}–${fmt$(p.excessRange[1])})` : ""}</div></div>
          <div class="value-box">
            ${priceBlock(v, true)}
            <table>${costRows}<tr class="total"><td>${state.horizon === "y1" ? "First year" : "At renewal"}</td><td>${fmt$(v.total)}</td></tr>
              <tr><td>Plus excess if you make an at-fault claim${v.youngEx ? `<span class="sub">includes young-driver excess ${fmt$(v.youngEx)}</span>` : ""}</td><td>${fmt$(v.excess + v.youngEx)}</td></tr></table>
            <div class="foot">${v.q ? `Quoted ${esc(v.q.date || "")}${v.q.ref ? ` · ref ${esc(v.q.ref)}` : ""}${v.q.expires ? ` · valid until ${esc(v.q.expires)}` : ""}. Estimate for comparison: ≈${fmt$(v.estTotal)}.` : `Estimate only, ${esc(REF.note)}${p.priceWhy ? ` <b>This brand:</b> ${esc(p.priceWhy)}` : ""}`}</div>
          </div>
          <div class="d-actions"><button class="primary" data-addq="${p.id}">${v.q ? "Edit my quote" : "Log my quote"}</button>${p.url ? `<a class="ghost btn" href="${esc(p.quoteUrl || p.url)}" target="_blank" rel="noopener">Get a quote ↗</a>` : ""}${p.pdsUrl ? `<a class="ghost btn" href="${esc(p.pdsUrl)}" target="_blank" rel="noopener">PDS${p.pdsDate ? " (" + esc(p.pdsDate) + ")" : ""} ↗</a>` : ""}<button class="ghost" data-cmp="${p.id}">${state.compare.includes(p.id) ? "Remove from compare" : "Add to compare"}</button></div>
          ${p.avoid ? `<p class="avoid">${esc(p.avoid)}</p>` : ""}
          ${p.evNotes || p.geelyEx5 ? `<div><h3>EV &amp; EX5 notes</h3>${p.evNotes ? `<p class="note tip">${esc(p.evNotes)}</p>` : ""}${p.geelyEx5 ? `<p class="note tip"><b>EX5:</b> ${esc(p.geelyEx5)}</p>` : ""}</div>` : ""}
          ${(p.pros?.length || p.cons?.length) ? `<div class="pc"><div><h3>Good</h3><ul>${(p.pros || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div><div><h3>Watch out</h3><ul>${(p.cons || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>` : ""}
        </div>
        <div class="d-config">
          <div><h3>What's covered</h3><table class="earn-table feat-table">${D.features.map(f => { const x = p.f[f.k] || { s: "unknown" }; return `<tr class="${state.must.includes(f.k) ? "must-row" : ""}"><td>${sBadge(x, f.k)}</td><td><b>${esc(f.label)}</b>${state.must.includes(f.k) ? ` <span class="pill">must</span>` : ""}<span class="sub">${esc(x.d || S_LABEL[x.s])}</span></td></tr>`; }).join("")}</table></div>
          ${p.youngDriverExcess ? `<div><h3>Extra excesses</h3><p class="note tip">${esc(p.youngDriverExcess)}</p></div>` : ""}
          ${p.discounts?.length ? `<div><h3>Discounts</h3><ul class="perk-list">${p.discounts.map(d => `<li>${esc(d)}</li>`).join("")}</ul></div>` : ""}
          ${p.claims ? `<div><h3>Claims record</h3>${p.claims.accept != null ? `<p class="note tip"><b>${pct(p.claims.accept)}</b> of ${esc(p.claimsBrand || p.brand)} claimants rated their claim above average or excellent (CHOICE survey, 2025).${p.productReview != null ? ` ProductReview: <b>${p.productReview.toFixed(1)}/5</b>.` : ""}</p>` : ""}${p.claims.text ? `<p class="note tip">${esc(p.claims.text)}</p>` : ""}</div>` : ""}
          ${p.ratings?.length ? `<div><h3>Awards &amp; ratings</h3><ul class="perk-list">${p.ratings.map(r => `<li><span>${esc(r.what)}</span><span class="muted">${esc(r.date || "")}</span></li>`).join("")}</ul></div>` : ""}
          ${p.priceEvidence?.length ? `<div><h3>Price evidence we found</h3><ul class="perk-list">${p.priceEvidence.map(r => `<li><span>${esc(r.what)}</span>${r.amount ? `<b>${fmt$(r.amount)}</b>` : ""}</li>`).join("")}</ul></div>` : ""}
          <div class="src">Sources: ${(p.sources || []).slice(0, 8).map((s, i) => `<a href="${esc(s)}" target="_blank" rel="noopener">${i + 1}</a>`).join(" · ")} · checked ${esc(p.asOf || D.asOf)}</div>
        </div>
      </div>`;
    showModal("#detailModal");
    bindLinks($("#detailPanel"));
    $$("#detailPanel [data-cmp]").forEach(b => b.onclick = () => { toggleCompare(b.dataset.cmp); openDetail(id); });
  }

  function showModal(sel) {
    const m = $(sel); m.classList.remove("hidden"); document.body.style.overflow = "hidden";
    m.querySelectorAll("[data-close]").forEach(x => x.onclick = () => closeModal(sel));
  }
  function closeModal(sel) { $(sel).classList.add("hidden"); if ($$(".modal:not(.hidden)").length === 0) document.body.style.overflow = ""; }
  document.addEventListener("keydown", e => { if (e.key === "Escape") $$(".modal:not(.hidden)").forEach(m => closeModal("#" + m.id)); });

  // ---------- compare ----------
  function toggleCompare(id) {
    state.compare = state.compare.includes(id) ? state.compare.filter(x => x !== id) : [...state.compare, id].slice(-4);
    update();
  }
  function renderTray() {
    $("#compareTray").classList.toggle("hidden", !state.compare.length);
    $("#trayItems").innerHTML = state.compare.map(id => `<span>${esc(byId[id].brand)} ${esc(byId[id].product)}<button data-x="${id}" aria-label="Remove">×</button></span>`).join("");
    $$("#trayItems [data-x]").forEach(b => b.onclick = () => toggleCompare(b.dataset.x));
    $("#openCompare").onclick = openCompare;
    $("#clearCompare").onclick = () => { state.compare = []; update(); };
  }
  function openCompare() {
    const cols = state.compare.map(id => ({ p: byId[id], v: evaluate(byId[id]) }));
    const minTotal = Math.min(...cols.map(c => c.v.total));
    const row = (k, fn, bestFn) => `<tr><td>${k}</td>${cols.map(c => `<td class="${bestFn && bestFn(c) ? "best" : ""}">${fn(c)}</td>`).join("")}</tr>`;
    $("#comparePanel").innerHTML = `<button class="close" data-close aria-label="Close">×</button><div class="compare"><h2>Side by side</h2><table>
      <tr><th></th>${cols.map(c => `<th><div class="mini" style="background:${c.p.color}"><small>${esc(c.p.brand)}</small>${esc(c.p.product)}</div></th>`).join("")}</tr>
      ${row(state.horizon === "y1" ? "First-year cost" : "Renewal cost", c => `<b>${fmt$(c.v.total)}</b><div class="sub">${c.v.q ? "your quote" : "estimate"}</div>`, c => c.v.total === minTotal)}
      ${row("In a year you claim", c => fmt$(c.v.badYear))}
      ${row("Cover fit", c => pct(c.v.fit))}
      ${row("Missing must-haves", c => c.v.missing.length ? c.v.missing.map(m => esc(FEAT[m.k].short)).join(", ") : "None")}
      ${row("Value basis", c => basisLabel(c.p))}
      ${row("Basic excess", c => c.p.basicExcess != null ? fmt$(c.p.basicExcess) : c.p.excessRange ? `${fmt$(c.p.excessRange[0])}–${fmt$(c.p.excessRange[1])}` : "?")}
      ${row("Happy claimants (CHOICE)", c => c.p.claims?.accept != null ? pct(c.p.claims.accept) : "–")}
      ${row("ProductReview rating", c => c.p.productReview != null ? c.p.productReview.toFixed(1) + " ★" : "–")}
      ${D.features.map(f => row(esc(f.label), c => `${sBadge(c.p.f[f.k], f.k)} <span class="sub">${esc(c.p.f[f.k]?.d || "")}</span>`)).join("")}
    </table></div>`;
    showModal("#compareModal");
  }

  // ---------- quotes ----------
  function openQuoteForm(id, qid) {
    const existing = qid ? quotes.find(q => q.qid === qid) : quoteFor(id);
    const p = byId[id || existing?.id];
    const q = existing || { id: p.id, freq: "annual", excess: state.excess, value: state.carValue, basis: p.valueBasis === "market" ? "market" : "agreed", date: new Date().toISOString().slice(0, 10), extras: true };
    $("#detailPanel").innerHTML = `<button class="close" data-close aria-label="Close">×</button>
      <form class="qform" id="qform">
        <h2>${existing ? "Edit" : "Log"} a real quote</h2>
        <label>Policy<select name="id">${D.products.map(x => `<option value="${x.id}" ${x.id === q.id ? "selected" : ""}>${esc(x.brand)} ${esc(x.product)}</option>`).join("")}</select></label>
        <div class="qrow"><label>Premium<span class="money"><span>$</span><input name="premium" type="number" step="0.01" min="0" required value="${q.premium ?? ""}" autofocus></span></label>
          <label>Per<select name="freq"><option value="annual" ${q.freq === "annual" ? "selected" : ""}>year</option><option value="monthly" ${q.freq === "monthly" ? "selected" : ""}>month</option></select></label></div>
        <div class="qrow"><label>Basic excess<span class="money"><span>$</span><input name="excess" type="number" min="0" value="${q.excess ?? ""}"></span></label>
          <label>Car insured for<span class="money"><span>$</span><input name="value" type="number" min="0" value="${q.value ?? ""}"></span></label>
          <label>Basis<select name="basis"><option value="agreed" ${q.basis === "agreed" ? "selected" : ""}>Agreed</option><option value="market" ${q.basis === "market" ? "selected" : ""}>Market</option></select></label></div>
        <label class="check"><input type="checkbox" name="extras" ${q.extras ? "checked" : ""}> Price already includes the extras I need (${state.must.map(k => esc(FEAT[k].short)).join(", ") || "none"})</label>
        <div class="qrow"><label>Quote reference<input name="ref" value="${esc(q.ref || "")}" placeholder="e.g. Q-123456"></label>
          <label>Quoted on<input name="date" type="date" value="${esc(q.date || "")}"></label>
          <label>Valid until<input name="expires" type="date" value="${esc(q.expires || "")}"></label></div>
        <label>Notes<textarea name="notes" rows="2" placeholder="What the person on the phone said, discounts applied, add-ons chosen…">${esc(q.notes || "")}</textarea></label>
        <div class="d-actions"><button class="primary" type="submit">Save quote</button>${existing ? `<button class="ghost danger" type="button" id="qdel">Delete</button>` : ""}<button class="ghost" type="button" data-close>Cancel</button></div>
      </form>`;
    showModal("#detailModal");
    const form = $("#qform");
    form.onsubmit = e => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(form));
      const premium = parseFloat(fd.premium);
      if (!(premium > 0)) return;
      const rec = { qid: existing?.qid || Math.random().toString(36).slice(2, 9), id: fd.id, premium, freq: fd.freq, excess: fd.excess === "" ? null : +fd.excess, value: fd.value === "" ? null : +fd.value, basis: fd.basis, extras: !!fd.extras, ref: fd.ref.trim(), date: fd.date, expires: fd.expires, notes: fd.notes.trim() };
      rec.total = (rec.freq === "monthly" ? premium * 12 : premium) + (rec.extras ? 0 : evaluate({ ...byId[rec.id] }).addonTotal);
      quotes = quotes.filter(x => x.qid !== rec.qid).concat(rec);
      persistQ(); closeModal("#detailModal"); update();
    };
    if (existing) $("#qdel").onclick = () => { quotes = quotes.filter(x => x.qid !== existing.qid); persistQ(); closeModal("#detailModal"); update(); };
  }

  function renderQuotes() {
    const list = quotes.slice().sort((a, b) => a.total - b.total);
    const today = new Date().toISOString().slice(0, 10);
    const table = list.length ? `<table class="qtable"><thead><tr><th>Policy</th><th>Per year</th><th>Excess</th><th>Insured for</th><th>Quoted</th><th>Valid until</th><th>Ref</th><th></th></tr></thead><tbody>
      ${list.map((q, i) => { const p = byId[q.id]; const v = evaluate(p); return `<tr class="${i === 0 ? "best" : ""}"><td><a href="#" data-open="${p.id}"><b>${esc(p.brand)}</b> ${esc(p.product)}</a>${v.missing.length ? `<span class="sub bad">missing ${v.missing.map(m => esc(FEAT[m.k].short)).join(", ")}</span>` : ""}${q.notes ? `<span class="sub">${esc(q.notes)}</span>` : ""}</td>
        <td><b>${fmt$(q.total)}</b>${q.freq === "monthly" ? `<span class="sub">${fmt$(q.premium)}/mo</span>` : ""}${!q.extras ? `<span class="sub">incl. ≈${fmt$(q.total - q.premium * (q.freq === "monthly" ? 12 : 1))} extras</span>` : ""}</td>
        <td>${q.excess != null ? fmt$(q.excess) : "–"}</td><td>${q.value ? fmt$(q.value) + " " + esc(q.basis) : "–"}</td><td>${esc(q.date || "")}</td>
        <td class="${q.expires && q.expires < today ? "bad" : ""}">${esc(q.expires || "–")}${q.expires && q.expires < today ? " (expired)" : ""}</td><td>${esc(q.ref || "")}</td>
        <td><button class="link small" data-edit="${q.qid}">Edit</button></td></tr>`; }).join("")}</tbody></table>`
      : `<div class="empty small">No quotes logged yet. Use <b>Log my quote</b> on any insurer, or the button above.</div>`;
    $("#quotesView").innerHTML = `<div class="qhead"><div><h1>My quotes</h1><p class="sub">Saved on this device only. Cheapest first, monthly quotes converted to a yearly total.</p></div>
        <div class="d-actions"><button class="primary" id="newQuote">+ Log a quote</button>${list.length ? `<button class="ghost" id="copyQuotes">Copy as text</button>` : ""}</div></div>
      ${table}
      <div class="two-col">
        <section class="panel"><h2>Have this ready before you start</h2><ul class="checklist">${D.checklist.map(x => `<li><label><input type="checkbox"> <span>${x}</span></label></li>`).join("")}</ul></section>
        <section class="panel"><h2>Ask every insurer</h2><ol class="asklist">${D.questions.map(x => `<li>${x}</li>`).join("")}</ol></section>
      </div>`;
    $("#newQuote").onclick = () => openQuoteForm(rows[0]?.p.id || D.products[0].id, null);
    $$("#quotesView [data-edit]").forEach(b => b.onclick = () => { const q = quotes.find(x => x.qid === b.dataset.edit); openQuoteForm(q.id, q.qid); });
    const cp = $("#copyQuotes");
    if (cp) cp.onclick = () => { navigator.clipboard.writeText(list.map(q => `${byId[q.id].brand} ${byId[q.id].product}: ${fmt$(q.total)}/yr, excess ${q.excess != null ? fmt$(q.excess) : "?"}${q.ref ? ", ref " + q.ref : ""}${q.expires ? ", valid to " + q.expires : ""}`).join("\n")); cp.textContent = "Copied"; };
    bindLinks($("#quotesView"));
  }

  function renderTips() {
    $("#tipsView").innerHTML = `<h1>Insuring an EX5: what's worth knowing</h1><p class="sub">Pulled together in October 2026 from insurer sites, PDSs, ASIC data and owner reports. Sources are linked.</p>
      <div class="tips-grid">${D.tips.map(t => `<section class="panel tip-card ${t.wide ? "wide" : ""}"><h2>${esc(t.h)}</h2>${t.html}${t.src?.length ? `<div class="src">Sources: ${t.src.map((s, i) => `<a href="${esc(s)}" target="_blank" rel="noopener">${i + 1}</a>`).join(" · ")}</div>` : ""}</section>`).join("")}</div>`;
  }

  initSidebar();
  update();
})();
