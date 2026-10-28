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
  const REF = D.baseline;

  // The five choices
  const AGES = [{ v: "u25", label: "Under 25", f: 1.8, min: 17 }, { v: "25", label: "25–29", f: 1.2, min: 25 }, { v: "30", label: "30–49", f: 0.98, min: 30 }, { v: "50", label: "50+", f: 0.9, min: 50 }];
  const EXCESSES = [500, 1000, 1500, 2000];
  // must-have choices: four cover items plus agreed value (derived from the policy's value basis)
  const MUSTS = [
    { k: "newCarReplacement", label: "New car if it's written off", short: "new-car replacement", hint: "A brand-new EX5 if it's totalled in the first couple of years." },
    { k: "hireCarAccident", label: "Hire car after an accident", short: "hire car", hint: "Geely parts can take weeks; this keeps you driving." },
    { k: "agreedValue", label: "Agreed value", short: "agreed value", hint: "A fixed payout, so falling used EX5 prices don't cut it." },
    { k: "choiceOfRepairer", label: "Choose your own repairer", short: "own repairer", hint: "Send it to an EV-capable shop, not the insurer's pick." },
    { k: "evCharger", label: "Charging cable covered", short: "charger cover", hint: "Portable cable stolen or damaged." },
  ];
  const MUST = Object.fromEntries(MUSTS.map(m => [m.k, m]));
  const statusOf = (p, k) => k === "agreedValue"
    ? { s: { agreed: "yes", choice: "yes", market: "no" }[p.valueBasis] || "unknown", d: { agreed: "Agreed value", choice: "Choose agreed or market value", market: "Market value only" }[p.valueBasis] || "Not confirmed" }
    : p.f[k] || { s: "unknown" };
  const BASE_F = 0.92; // clean record, garaged, ~12,000 km a year: the typical case

  // ---------- state ----------
  const LS = "fender-bender-v2", LSQ = "fender-bender-quotes-v1";
  const DEFAULTS = () => ({ variant: D.car.variants[0].name, age: "30", excess: 1000, must: ["newCarReplacement", "hireCarAccident"], pay: "annual" });
  const state = Object.assign({ view: "grid", showMore: false }, DEFAULTS(), JSON.parse(localStorage.getItem(LS) || "{}"));
  if (!AGES.some(a => a.v === state.age)) state.age = "30";
  state.must = state.must.filter(k => MUST[k]);
  let quotes = JSON.parse(localStorage.getItem(LSQ) || "[]");
  const persist = () => localStorage.setItem(LS, JSON.stringify(state));
  const persistQ = () => localStorage.setItem(LSQ, JSON.stringify(quotes));
  const quoteFor = id => quotes.filter(q => q.id === id).sort((a, b) => a.total - b.total)[0];
  const variant = () => D.car.variants.find(v => v.name === state.variant) || D.car.variants[0];
  const age = () => AGES.find(a => a.v === state.age);

  // ---------- engine ----------
  function estimate(p, renewal = false) {
    let premium = REF.premium * BASE_F * age().f * Math.pow(variant().value / REF.carValue, 0.75)
      * Math.min(1.3, Math.max(0.72, 1 - 0.07 * (state.excess - REF.excess) / 500)) * (p.priceIndex || 1);
    const lines = [{ k: "Base premium", v: premium, sub: `EX5 ${state.variant}, age ${age().label}, ${fmt$(state.excess)} excess${p.priceIndex !== 1 ? `, brand price index ×${p.priceIndex.toFixed(2)}` : ""}` }];
    if (!renewal && p.onlineDiscount) { const d = premium * p.onlineDiscount; premium -= d; lines.push({ k: `Buy-online discount (first year, ${pct(p.onlineDiscount)})`, v: -d }); }
    if (!renewal && p.onlineFlat) { premium -= p.onlineFlat; lines.push({ k: "Buy-online discount (first year)", v: -p.onlineFlat }); }
    if (state.pay === "monthly" && p.monthlyLoading) { const d = premium * p.monthlyLoading; premium += d; lines.push({ k: `Paying monthly (+${pct(p.monthlyLoading)})`, v: d }); }
    return { premium, lines };
  }

  function evaluate(p) {
    const est = estimate(p), addons = [], missing = [];
    for (const k of state.must) {
      const x = statusOf(p, k);
      if (x.s === "addon") addons.push({ k, cost: typeof x.cost === "number" ? x.cost : FEAT[k].addon, published: typeof x.cost === "number" });
      else if (x.s === "no" || x.s === "unknown") missing.push({ k, s: x.s });
    }
    const addonTotal = addons.reduce((s, a) => s + a.cost, 0);
    const q = quoteFor(p.id);
    const estTotal = est.premium + addonTotal;
    const renewEst = estimate(p, true).premium + addonTotal;
    const total = q ? q.total : estTotal;
    const renewal = q ? q.total * (p.onlineDiscount ? 1 / (1 - p.onlineDiscount) : 1) + (p.onlineFlat || 0) : renewEst;
    return { est, addons, addonTotal, missing, q, total, estTotal, renewal, low: estTotal * 0.78, high: estTotal * 1.25 };
  }

  // one card per brand: the cheapest tier that ticks every must-have, else the cheapest tier
  function brandRows() {
    const byBrand = {};
    for (const p of D.products) {
      if (p.minAge && age().min < p.minAge) continue;
      (byBrand[p.brand] ||= []).push({ p, v: evaluate(p) });
    }
    const pick = list => list.sort((a, b) => (a.v.missing.length > 0) - (b.v.missing.length > 0) || (!!b.v.q - !!a.v.q) || a.v.total - b.v.total)[0];
    return Object.values(byBrand).map(list => ({ ...pick(list), tiers: list.length })).sort((a, b) => a.v.total - b.v.total);
  }

  // ---------- sidebar ----------
  const chipGroup = (sel, key, after) => {
    const sync = () => $$(sel + " button").forEach(b => b.classList.toggle("on", String(state[key]) === b.dataset.v));
    $$(sel + " button").forEach(b => b.onclick = () => { state[key] = isNaN(+b.dataset.v) || key === "age" ? b.dataset.v : +b.dataset.v; sync(); after && after(); update(); });
    sync(); return sync;
  };
  const syncers = [];
  function renderMust() {
    $("#mustList").innerHTML = MUSTS.map(m => `<label class="must ${state.must.includes(m.k) ? "on" : ""}"><input type="checkbox" data-k="${m.k}" ${state.must.includes(m.k) ? "checked" : ""}><span><b>${esc(m.label)}</b><small>${esc(m.hint)}</small></span></label>`).join("");
    $$("#mustList input").forEach(i => i.onchange = () => { const k = i.dataset.k; state.must = i.checked ? [...state.must, k] : state.must.filter(x => x !== k); i.closest(".must").classList.toggle("on", i.checked); update(); });
  }
  function initSidebar() {
    $("#variantChips").innerHTML = D.car.variants.map(v => `<button data-v="${esc(v.name)}">${esc(v.name)} <small>${fmt$(v.rrp)}</small></button>`).join("");
    $("#ageChips").innerHTML = AGES.map(a => `<button data-v="${a.v}">${a.label}</button>`).join("");
    $("#excessChips").innerHTML = EXCESSES.map(x => `<button data-v="${x}">${fmt$(x)}</button>`).join("");
    syncers.push(chipGroup("#variantChips", "variant"), chipGroup("#ageChips", "age"), chipGroup("#excessChips", "excess"), chipGroup("#payChips", "pay"));
    renderMust();
    $$("#viewMode button").forEach(b => b.onclick = () => setView(b.dataset.view));
    $("#resetAll").onclick = () => { Object.assign(state, DEFAULTS()); syncers.forEach(s => s()); renderMust(); update(); };
    $("#disclaimer").textContent = D.disclaimer;
    $("#filtersDone").onclick = () => $("#filtersToggle").click();
    $("#filtersToggle").onclick = () => { const f = $("#filters"); f.classList.toggle("collapsed"); $("#filtersToggle i").textContent = f.classList.contains("collapsed") ? "Edit" : "Done"; if (f.classList.contains("collapsed")) $("#resultsHead").scrollIntoView(); };
  }
  function setView(v) { state.view = v; $$("#viewMode button").forEach(x => x.classList.toggle("on", x.dataset.view === v)); update(); window.scrollTo({ top: 0 }); }

  // ---------- render ----------
  let rows = [];
  function update() {
    persist();
    $("#variantHint").textContent = `Insured for about ${fmt$(variant().value)}.`;
    $("#filtersSummary").textContent = `${state.variant}, age ${age().label}, ${fmt$(state.excess)} excess, ${state.pay === "annual" ? "yearly" : "monthly"} · ${state.must.map(k => MUST[k].short).join(", ") || "no must-haves"}`;
    rows = brandRows();
    const ok = rows.filter(r => !r.v.missing.length && !r.p.avoid && r.p.openToNew !== false);
    const rest = rows.filter(r => !ok.includes(r));
    $("#quoteCount").textContent = quotes.length || "";
    const list = state.view === "grid";
    $("#resultsHead").classList.toggle("hidden", !list);
    $("#best").classList.toggle("hidden", !list);
    $("#grid").classList.toggle("hidden", !list);
    $("#more").classList.toggle("hidden", !list);
    $("#quotesView").classList.toggle("hidden", state.view !== "quotes");
    $("#tipsView").classList.toggle("hidden", state.view !== "tips");
    if (list) {
      $("#resultCount").textContent = `${ok.length} insurers tick all your must-haves`;
      $("#resultSub").textContent = `${ok.length > 6 ? "The cheapest 6, " : "Cheapest first, "}${state.pay === "annual" ? "per year" : "paid monthly, per year"}. Prices are estimates until you log a real quote.`;
      renderBest(ok);
      const SHOW = 6, extra = ok.slice(SHOW);
      $("#grid").innerHTML = ok.length ? ok.slice(0, SHOW).map((r, i) => card(r, i === 0)).join("") : `<div class="empty">No insurer ticks every must-have. Untick one to see options.</div>`;
      const hiddenN = extra.length + rest.length;
      $("#more").innerHTML = hiddenN ? `<button class="ghost more-toggle" id="moreToggle">${state.showMore ? "Show fewer" : `Show the other ${hiddenN} insurers`}</button>
        ${state.showMore ? `${extra.length ? `<div class="grid">${extra.map(r => card(r, false)).join("")}</div>` : ""}${rest.length ? `<h3 class="more-h">Miss a must-have, or not recommended</h3><div class="grid dim">${rest.map(r => card(r, false)).join("")}</div>` : ""}` : ""}` : "";
      if (hiddenN) $("#moreToggle").onclick = () => { state.showMore = !state.showMore; update(); };
      $$(".card").forEach(c => c.onclick = e => { if (e.target.closest("button,a")) return; openDetail(c.dataset.id); });
      bindLinks($("#grid")); bindLinks($("#more"));
    } else if (state.view === "quotes") renderQuotes();
    else renderTips();
  }

  const S_ICON = { yes: "✓", addon: "+", partial: "◐", no: "✕", unknown: "?" };
  const S_LABEL = { yes: "Included", addon: "Optional extra", partial: "Limited", no: "Not offered", unknown: "Not confirmed" };
  const sBadge = (x, k) => { const s = x?.s || "unknown"; const cost = s === "addon" ? (typeof x.cost === "number" ? fmt$(x.cost) : `≈${fmt$(FEAT[k]?.addon || 0)}`) : ""; return `<span class="st st-${s}" title="${esc(S_LABEL[s])}${x?.d ? ": " + esc(x.d) : ""}">${S_ICON[s]}${cost ? `<small>${cost}</small>` : ""}</span>`; };

  function card(r, top) {
    const { p, v } = r;
    const price = v.q ? `<div class="value">${fmt$(v.total)}<small class="real">your quote</small></div>`
      : `<div class="value est"><span class="approx">≈</span>${fmt$(v.estTotal)}<small>a year, estimate</small></div>`;
    const why = v.missing.length ? `<div class="miss">${v.missing.map(m => `${m.s === "no" ? "No" : "Unconfirmed:"} ${esc(MUST[m.k].short)}`).join(" · ")}</div>`
      : p.avoid ? `<div class="miss">${esc(p.avoid)}</div>` : "";
    return `<article class="card simple ${top ? "top" : ""} ${v.q ? "quoted" : ""}" data-id="${p.id}">
      ${top ? `<span class="rank">${v.q ? "CHEAPEST REAL QUOTE" : "CHEAPEST ESTIMATE"}</span>` : ""}
      <div class="strip" style="background:${p.color}"><span class="issuer">${esc(p.brand)}</span><span class="cname">${esc(p.product)}</span></div>
      <div class="value-row">${price}${Math.round(v.renewal) > Math.round(v.total) + 5 ? `<div class="fee"><b>${fmt$(v.renewal)}</b><span>${v.q ? "" : "≈ "}at renewal</span></div>` : ""}</div>
      ${state.must.length ? `<ul class="ticks">${state.must.map(k => { const x = statusOf(p, k); return `<li>${sBadge(x, k)}<span>${esc(MUST[k].short)}</span></li>`; }).join("")}</ul>` : ""}
      ${why}
      ${p.award ? `<div class="award">★ ${esc(p.award)}</div>` : ""}
      <div class="card-actions"><button class="ghost small" data-addq="${p.id}">${v.q ? "Edit quote" : "Log my quote"}</button>${p.url ? `<a class="small" href="${esc(p.quoteUrl || p.url)}" target="_blank" rel="noopener">Get quote ↗</a>` : ""}</div>
    </article>`;
  }

  function renderBest(ok) {
    const el = $("#best");
    const quotedRows = rows.filter(r => r.v.q).sort((a, b) => a.v.total - b.v.total);
    if (!quotedRows.length) {
      const next = ok.slice(0, 4);
      el.innerHTML = `<div class="best-body"><span class="mine-label">Start here</span><h2>Get real quotes from these ${next.length}</h2>
        <p class="sub">The cheapest estimates that tick your must-haves. Each takes about 5 minutes online. Have your rego, VIN and licence handy (<a href="#" data-view="quotes">checklist</a>).</p></div>
        <ol class="next">${next.map(r => `<li><a href="#" data-open="${r.p.id}">${esc(r.p.brand)}</a><span>≈${fmt$(r.v.estTotal)}</span>${r.p.url ? `<a class="go" href="${esc(r.p.quoteUrl || r.p.url)}" target="_blank" rel="noopener">Get quote ↗</a>` : ""}<button class="link small" data-addq="${r.p.id}">Log quote</button></li>`).join("")}</ol>`;
    } else {
      const b = quotedRows[0];
      const cheaper = ok.filter(r => !r.v.q && r.v.low < b.v.total).slice(0, 3);
      el.innerHTML = `<div class="best-body"><span class="mine-label">Best real quote</span><h2><a href="#" data-open="${b.p.id}">${esc(b.p.brand)} ${esc(b.p.product)}</a> at ${fmt$(b.v.total)}/yr</h2>
        <p class="sub">${b.v.missing.length ? `Missing: ${b.v.missing.map(m => esc(MUST[m.k].short)).join(", ")}. ` : "Ticks every must-have. "}${quotedRows.length > 1 ? `${quotedRows.length} quotes logged.` : "Only one quote so far."}</p></div>
        <div class="best-verdict">${cheaper.length ? `<div class="mine-on">Worth quoting too, could come in lower:</div><ol class="next">${cheaper.map(r => `<li><a href="#" data-open="${r.p.id}">${esc(r.p.brand)}</a><span>≈${fmt$(r.v.estTotal)}</span><button class="link small" data-addq="${r.p.id}">Log quote</button></li>`).join("")}</ol>` : `<div class="mine-on">Nothing unquoted is likely to beat it. Ring ${esc(b.p.brand)} and ask for a better price, or try a higher excess.</div>`}</div>`;
    }
    bindLinks(el);
  }

  function bindLinks(root) {
    root.querySelectorAll("[data-open]").forEach(a => a.onclick = e => { e.preventDefault(); openDetail(a.dataset.open); });
    root.querySelectorAll("[data-addq]").forEach(a => a.onclick = e => { e.preventDefault(); e.stopPropagation(); openQuoteForm(a.dataset.addq); });
    root.querySelectorAll("[data-view]").forEach(a => a.onclick = e => { e.preventDefault(); setView(a.dataset.view); });
  }

  const basisLabel = p => ({ agreed: "Agreed value", market: "Market value", choice: "Agreed or market value" })[p.valueBasis] || "Value basis not confirmed";

  // ---------- detail ----------
  function openDetail(id) {
    const p = byId[id], v = evaluate(p);
    const siblings = D.products.filter(x => x.brand === p.brand && x.id !== p.id && !(x.minAge && age().min < x.minAge));
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
            ${v.q ? `<div class="value big">${fmt$(v.total)}<small class="real">your quote</small></div>` : `<div class="value big"><span class="approx">≈</span>${fmt$(v.estTotal)}<small>estimate ${fmt$(v.low)}–${fmt$(v.high)}/yr</small></div>`}
            <table>${costRows}<tr class="total"><td>First year</td><td>${fmt$(v.total)}</td></tr>
              <tr><td>At renewal<span class="sub">once first-year discounts drop off</span></td><td>${fmt$(v.renewal)}</td></tr></table>
            <div class="foot">${v.q ? `Quoted ${esc(v.q.date || "")}${v.q.ref ? ` · ref ${esc(v.q.ref)}` : ""}${v.q.expires ? ` · valid until ${esc(v.q.expires)}` : ""}. Estimate for comparison: ≈${fmt$(v.estTotal)}.` : `Estimate only, ${esc(REF.note)}${p.priceWhy ? ` <b>This brand:</b> ${esc(p.priceWhy)}` : ""}`}</div>
          </div>
          <div class="d-actions"><button class="primary" data-addq="${p.id}">${v.q ? "Edit my quote" : "Log my quote"}</button>${p.url ? `<a class="ghost btn" href="${esc(p.quoteUrl || p.url)}" target="_blank" rel="noopener">Get a quote ↗</a>` : ""}${p.pdsUrl ? `<a class="ghost btn" href="${esc(p.pdsUrl)}" target="_blank" rel="noopener">Policy document ↗</a>` : ""}</div>
          ${siblings.length ? `<p class="note tip">${esc(p.brand)} also sells: ${siblings.map(x => `<a href="#" data-open="${x.id}">${esc(x.product)}</a>`).join(", ")}.</p>` : ""}
          ${p.avoid ? `<p class="avoid">${esc(p.avoid)}</p>` : ""}
          ${(p.pros?.length || p.cons?.length) ? `<div class="pc"><div><h3>Good</h3><ul>${(p.pros || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div><div><h3>Watch out</h3><ul>${(p.cons || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></div>` : ""}
          ${p.evNotes ? `<div><h3>EV notes</h3><p class="note tip">${esc(p.evNotes)}</p></div>` : ""}
        </div>
        <div class="d-config">
          <div><h3>What's covered</h3><table class="earn-table feat-table">${D.features.map(f => { const x = p.f[f.k] || { s: "unknown" }; return `<tr class="${state.must.includes(f.k) ? "must-row" : ""}"><td>${sBadge(x, f.k)}</td><td><b>${esc(f.label)}</b><span class="sub">${esc(x.d || S_LABEL[x.s])}</span></td></tr>`; }).join("")}</table></div>
          ${p.claims?.accept != null ? `<div><h3>Claims</h3><p class="note tip"><b>${pct(p.claims.accept)}</b> of ${esc(p.brand)} claimants rated their claim above average or excellent (CHOICE survey, 2025).</p></div>` : ""}
          <div class="src">Sources: ${(p.sources || []).slice(0, 8).map((s, i) => `<a href="${esc(s)}" target="_blank" rel="noopener">${i + 1}</a>`).join(" · ")} · checked ${esc(p.asOf || D.asOf)}</div>
        </div>
      </div>`;
    showModal("#detailModal");
    bindLinks($("#detailPanel"));
  }

  function showModal(sel) {
    const m = $(sel); m.classList.remove("hidden"); document.body.style.overflow = "hidden";
    m.querySelectorAll("[data-close]").forEach(x => x.onclick = () => closeModal(sel));
  }
  function closeModal(sel) { $(sel).classList.add("hidden"); document.body.style.overflow = ""; }
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal("#detailModal"); });

  // ---------- quotes ----------
  function openQuoteForm(id, qid) {
    const existing = qid ? quotes.find(q => q.qid === qid) : quoteFor(id);
    const q = existing || { id, freq: "annual", excess: state.excess, date: new Date().toISOString().slice(0, 10) };
    $("#detailPanel").innerHTML = `<button class="close" data-close aria-label="Close">×</button>
      <form class="qform" id="qform">
        <h2>${existing ? "Edit" : "Log"} a real quote</h2>
        <label>Policy<select name="id">${D.products.map(x => `<option value="${x.id}" ${x.id === q.id ? "selected" : ""}>${esc(x.brand)} ${esc(x.product)}</option>`).join("")}</select></label>
        <div class="qrow"><label>Price, including any extras<span class="money"><span>$</span><input name="premium" type="number" step="0.01" min="0" required value="${q.premium ?? ""}" autofocus></span></label>
          <label>Per<select name="freq"><option value="annual" ${q.freq === "annual" ? "selected" : ""}>year</option><option value="monthly" ${q.freq === "monthly" ? "selected" : ""}>month</option></select></label>
          <label>Excess<span class="money"><span>$</span><input name="excess" type="number" min="0" value="${q.excess ?? ""}"></span></label></div>
        <div class="qrow"><label>Quote reference<input name="ref" value="${esc(q.ref || "")}" placeholder="e.g. Q-123456"></label>
          <label>Valid until<input name="expires" type="date" value="${esc(q.expires || "")}"></label></div>
        <label>Notes<textarea name="notes" rows="2" placeholder="Discounts applied, what they said on the phone…">${esc(q.notes || "")}</textarea></label>
        <div class="d-actions"><button class="primary" type="submit">Save quote</button>${existing ? `<button class="ghost danger" type="button" id="qdel">Delete</button>` : ""}<button class="ghost" type="button" data-close>Cancel</button></div>
      </form>`;
    showModal("#detailModal");
    const form = $("#qform");
    form.onsubmit = e => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(form));
      const premium = parseFloat(fd.premium);
      if (!(premium > 0)) return;
      const rec = { ...(existing || {}), qid: existing?.qid || Math.random().toString(36).slice(2, 9), id: fd.id, premium, freq: fd.freq, excess: fd.excess === "" ? null : +fd.excess, ref: fd.ref.trim(), date: existing?.date || q.date, expires: fd.expires, notes: fd.notes.trim(), extras: true };
      rec.total = rec.freq === "monthly" ? premium * 12 : premium;
      quotes = quotes.filter(x => x.qid !== rec.qid).concat(rec);
      persistQ(); closeModal("#detailModal"); update();
    };
    if (existing) $("#qdel").onclick = () => { quotes = quotes.filter(x => x.qid !== existing.qid); persistQ(); closeModal("#detailModal"); update(); };
  }

  function renderQuotes() {
    const list = quotes.slice().sort((a, b) => a.total - b.total);
    const today = new Date().toISOString().slice(0, 10);
    const table = list.length ? `<table class="qtable"><thead><tr><th>Policy</th><th>Per year</th><th>Excess</th><th>Valid until</th><th>Ref</th><th></th></tr></thead><tbody>
      ${list.map((q, i) => { const p = byId[q.id]; const v = evaluate(p); return `<tr class="${i === 0 ? "best" : ""}"><td><a href="#" data-open="${p.id}"><b>${esc(p.brand)}</b> ${esc(p.product)}</a>${v.missing.length ? `<span class="sub bad">missing ${v.missing.map(m => esc(MUST[m.k].short)).join(", ")}</span>` : ""}${q.notes ? `<span class="sub">${esc(q.notes)}</span>` : ""}</td>
        <td><b>${fmt$(q.total)}</b>${q.freq === "monthly" ? `<span class="sub">${fmt$(q.premium)}/mo</span>` : ""}</td>
        <td>${q.excess != null ? fmt$(q.excess) : "–"}</td>
        <td class="${q.expires && q.expires < today ? "bad" : ""}">${esc(q.expires || "–")}${q.expires && q.expires < today ? " (expired)" : ""}</td><td>${esc(q.ref || "")}</td>
        <td><button class="link small" data-edit="${q.qid}">Edit</button></td></tr>`; }).join("")}</tbody></table>`
      : `<div class="empty small">No quotes logged yet. Use <b>Log my quote</b> on any insurer, or the button above.</div>`;
    $("#quotesView").innerHTML = `<div class="qhead"><div><h1>My quotes</h1><p class="sub">Saved on this device only. Cheapest first; monthly quotes are shown as a yearly total.</p></div>
        <div class="d-actions"><button class="primary" id="newQuote">+ Log a quote</button>${list.length ? `<button class="ghost" id="copyQuotes">Copy as text</button>` : ""}</div></div>
      ${table}
      <div class="two-col">
        <section class="panel"><h2>Have this ready</h2><ul class="checklist">${D.checklist.map(x => `<li><label><input type="checkbox"> <span>${x}</span></label></li>`).join("")}</ul></section>
        <section class="panel"><h2>Ask every insurer</h2><ol class="asklist">${D.questions.map(x => `<li>${x}</li>`).join("")}</ol></section>
      </div>`;
    $("#newQuote").onclick = () => openQuoteForm(rows[0]?.p.id || D.products[0].id, null);
    $$("#quotesView [data-edit]").forEach(b => b.onclick = () => { const q = quotes.find(x => x.qid === b.dataset.edit); openQuoteForm(q.id, q.qid); });
    const cp = $("#copyQuotes");
    if (cp) cp.onclick = () => { navigator.clipboard.writeText(list.map(q => `${byId[q.id].brand} ${byId[q.id].product}: ${fmt$(q.total)}/yr, excess ${q.excess != null ? fmt$(q.excess) : "?"}${q.ref ? ", ref " + q.ref : ""}${q.expires ? ", valid to " + q.expires : ""}`).join("\n")); cp.textContent = "Copied"; };
    bindLinks($("#quotesView"));
  }

  function renderTips() {
    $("#tipsView").innerHTML = `<h1>Insuring an EX5: what matters</h1><p class="sub">Pulled together in October 2026 from insurer sites, policy documents, ASIC and CHOICE. Sources are linked.</p>
      <div class="tips-grid">${D.tips.map(t => `<section class="panel tip-card"><h2>${esc(t.h)}</h2>${t.html}${t.src?.length ? `<div class="src">Sources: ${t.src.map((s, i) => `<a href="${esc(s)}" target="_blank" rel="noopener">${i + 1}</a>`).join(" · ")}</div>` : ""}</section>`).join("")}</div>`;
  }

  initSidebar();
  if (state.view !== "grid") setView(state.view); else update();
})();
