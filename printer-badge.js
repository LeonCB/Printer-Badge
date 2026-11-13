/* ==========================================================================
   Printer Badge — one Home Assistant dashboard badge for a printer:
   status, page counter and ink levels, with a details pop-up on tap.

   Install via the Home Assistant Marketplace (custom repository, category
   Dashboard), or copy this file to <config>/www/ and add it as a
   JavaScript module resource.
   ========================================================================== */
(function () {
  'use strict';

  // Replaced with the tag by the release workflow.
  const CARD_VERSION = 'dev';

  const DEFAULT_LOW = 20;

  // Ink colour from the entity id / name. Works for English, Dutch, German,
  // French and the usual C/M/Y/K abbreviations. Override per ink in YAML.
  const INK_COLORS = [
    { re: /(^|[_\s-])(photo[_\s-]?black|pbk|foto[_\s-]?zwart)/i, color: 'var(--black-color, #000)' },
    { re: /(cyan|cyaan|(^|[_\s-])c$)/i, color: 'var(--cyan-color, #00bcd4)' },
    { re: /(magenta|(^|[_\s-])m$)/i, color: 'var(--magenta-color, #ff00ff)' },
    { re: /(yellow|geel|gelb|jaune|(^|[_\s-])y$)/i, color: 'var(--yellow-color, #ffeb3b)' },
    { re: /(black|zwart|schwarz|noir|(^|[_\s-])k$|(^|[_\s-])bk$)/i, color: 'var(--black-color, #000)' }
  ];
  function inkColor(text){
    const hit = INK_COLORS.find(c => c.re.test(text || ''));
    return hit ? hit.color : 'var(--primary-text-color)';
  }
  function inkRank(text){
    const t = (text || '').toLowerCase();
    if (/cyan|cyaan/.test(t)) return 0;
    if (/magenta/.test(t)) return 1;
    if (/yellow|geel|gelb|jaune/.test(t)) return 2;
    if (/black|zwart|schwarz|noir/.test(t)) return 3;
    return 4;
  }

  /* ---------- auto-detection from the status entity's device ---------- */
  // Ink sensors: % sensors on the same device. Page counter: a sensor on the
  // same device whose id/name mentions total pages.
  function detect(hass, statusEntity){
    const reg = hass.entities || {};
    const deviceId = reg[statusEntity] && reg[statusEntity].device_id;
    if (!deviceId) return { inks: [], pages: undefined };
    const siblings = Object.values(reg)
      .filter(e => e.device_id === deviceId && e.entity_id !== statusEntity && e.entity_id.startsWith('sensor.'))
      .map(e => e.entity_id)
      .filter(id => hass.states[id]);
    const inks = siblings
      .filter(id => hass.states[id].attributes.unit_of_measurement === '%' &&
        INK_COLORS.some(c => c.re.test(id + ' ' + (hass.states[id].attributes.friendly_name || ''))))
      .sort((a, b) => inkRank(a + ' ' + hass.states[a].attributes.friendly_name) - inkRank(b + ' ' + hass.states[b].attributes.friendly_name));
    const pages = siblings.find(id => /(total|totaal|gesamt).*(page|pagina|seite)|(page|pagina|seite).*(total|totaal|gesamt)/i
      .test(id + ' ' + (hass.states[id].attributes.friendly_name || '')));
    return { inks, pages };
  }

  // detect() walks the whole entity registry, so its result is cached until
  // the registry object itself is replaced (Home Assistant does that only when
  // the registry changes, not on every state update).
  const detectCache = new Map();
  function detected(hass, entity){
    const hit = detectCache.get(entity);
    if (hit && hit.registry === hass.entities) return hit.result;
    const result = detect(hass, entity);
    detectCache.set(entity, { registry: hass.entities, result });
    return result;
  }

  // Normalised inks: [{ entity, color }]
  function inkList(config, hass){
    const raw = (config.inks && config.inks.length) ? config.inks : detected(hass, config.entity).inks;
    return raw.map(i => typeof i === 'string' ? { entity: i } : i)
      .filter(i => i && i.entity)
      .map(i => {
        const st = hass.states[i.entity];
        const name = st ? st.attributes.friendly_name : '';
        return { entity: i.entity, color: i.color || inkColor(i.entity + ' ' + name) };
      });
  }
  function pagesEntity(config, hass){
    if (config.pages === false || config.pages === null) return undefined;
    return config.pages || detected(hass, config.entity).pages;
  }

  // Friendly name without the device name in front of it
  // ("Epson EcoTank ET-2870 Afgedrukte pagina's kleur" -> "Afgedrukte pagina's kleur").
  function shortName(hass, entityId){
    const s = hass.states[entityId];
    const full = (s && s.attributes.friendly_name) || entityId;
    const reg = hass.entities && hass.entities[entityId];
    const dev = reg && reg.device_id && hass.devices && hass.devices[reg.device_id];
    const devName = dev && (dev.name_by_user || dev.name);
    if (devName && full.toLowerCase().startsWith(devName.toLowerCase() + ' ')) {
      const rest = full.slice(devName.length + 1);
      return rest.charAt(0).toUpperCase() + rest.slice(1);
    }
    return full;
  }

  function fmtState(hass, stateObj){
    if (!stateObj) return '—';
    try { if (hass.formatEntityState) return hass.formatEntityState(stateObj); } catch (e) { /* older HA */ }
    return stateObj.state;
  }
  function stateClass(state){
    if (state === 'printing' || state === 'processing') return 'printing';
    if (state === 'stopped' || state === 'error' || state === 'unavailable' || state === 'offline') return 'error';
    return 'idle';
  }

  const STYLE = `
    :host { display: block; }
    /* Theme variables (all optional):
         --printer-badge-icon-color      printer icon while idle
         --printer-badge-printing-color  printer icon while printing (pulses)
         --printer-badge-error-color     printer icon when stopped/unavailable
         --printer-badge-low-color       percentage and glow of an ink below the threshold */
    ha-icon.printer { color: var(--printer-badge-icon-color, var(--primary-color)); }
    ha-icon.printer.printing {
      color: var(--printer-badge-printing-color, var(--yellow-color));
      animation: pb-pulse 2.4s ease-in-out infinite;
    }
    ha-icon.printer.error { color: var(--printer-badge-error-color, var(--red-color)); }
    @keyframes pb-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
    @media (prefers-reduced-motion: reduce) { ha-icon.printer.printing { animation: none; } }
    .row { display: flex; align-items: center; gap: 12px; white-space: nowrap; }
    .sep { width: 1px; height: 16px; background: color-mix(in srgb, var(--primary-text-color) 25%, transparent); }
    .ink { display: inline-flex; align-items: center; gap: 4px; }
    /* Thin white outline so every ink colour (black too) stands out on a dark badge */
    .ink ha-icon, .drop {
      --mdc-icon-size: 18px;
      filter: drop-shadow(0 0 0.6px #fff) drop-shadow(0 0 0.6px #fff);
    }
    .low { color: var(--printer-badge-low-color, var(--red-color)); }
    /* Ink below the threshold: the outline glows red */
    .ink.low ha-icon, .drop.low { animation: pb-glow 1.6s ease-in-out infinite; }
    @keyframes pb-glow {
      0%, 100% { filter: drop-shadow(0 0 0.6px #fff) drop-shadow(0 0 0.6px #fff); }
      50% {
        filter: drop-shadow(0 0 1px var(--printer-badge-low-color, var(--red-color)))
          drop-shadow(0 0 3px var(--printer-badge-low-color, var(--red-color)))
          drop-shadow(0 0 5px var(--printer-badge-low-color, var(--red-color)));
      }
    }
    @media (prefers-reduced-motion: reduce) { .ink.low ha-icon, .drop.low { animation: none; } }

    /* details pop-up */
    dialog {
      border: none; padding: 0; min-width: min(360px, 92vw); max-width: 92vw;
      border-radius: var(--ha-dialog-border-radius, 24px);
      background: var(--ha-dialog-surface-background, var(--card-background-color, #1c1c1e));
      color: var(--primary-text-color);
      box-shadow: var(--ha-card-box-shadow, 0 8px 24px rgba(0,0,0,.4));
      font-family: var(--ha-font-family-body, inherit);
    }
    dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
    .dlg { padding: 20px 24px 12px; }
    .dlg-head { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .dlg-head ha-icon { --mdc-icon-size: 28px; }
    .dlg-title { font-size: var(--ha-font-size-xl, 20px); font-weight: 500; flex: 1; }
    .dlg-sub { color: var(--secondary-text-color); font-size: var(--ha-font-size-m, 14px); }
    .line { display: grid; grid-template-columns: 24px 1fr auto; align-items: center; gap: 12px; padding: 8px 0; }
    .line + .line { border-top: 1px solid var(--divider-color, rgba(127,127,127,.2)); }
    .meter { grid-column: 2 / 4; height: 6px; border-radius: 3px; margin-top: 6px;
      background: color-mix(in srgb, var(--primary-text-color) 12%, transparent); overflow: hidden; }
    .meter i { display: block; height: 100%; border-radius: 3px; }
    .val { font-variant-numeric: tabular-nums; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; padding: 8px 16px 16px; }
    .actions button {
      font: inherit; border: none; background: none; cursor: pointer; padding: 8px 12px; border-radius: 18px;
      color: var(--primary-color); font-weight: 500;
    }
    .actions button:hover { background: color-mix(in srgb, var(--primary-color) 12%, transparent); }
    .actions button:focus { outline: none; }
    .actions button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; }
    .dlg:focus { outline: none; }
  `;

  /* ============================== BADGE ============================== */
  class PrinterBadge extends HTMLElement {
    static getConfigElement(){ return document.createElement('printer-badge-editor'); }
    static getStubConfig(hass){
      const candidates = Object.keys(hass.states).filter(id => id.startsWith('sensor.') &&
        ['idle', 'printing', 'processing', 'stopped'].includes(hass.states[id].state));
      const status = candidates.find(id => detected(hass, id).inks.length >= 2);
      return { entity: status || '' };
    }

    setConfig(config){
      if (!config || !config.entity) throw new Error('Kies de status-entiteit van de printer (entity)');
      this._config = Object.assign({ low_threshold: DEFAULT_LOW }, config);
      this._sig = null;
      this._render();
    }

    set hass(hass){
      this._hass = hass;
      this._render();
    }

    // Only re-render when one of the used entities changed.
    _signature(){
      const h = this._hass, c = this._config;
      const ids = [c.entity, pagesEntity(c, h), ...inkList(c, h).map(i => i.entity), ...(c.details || [])];
      return ids.map(id => { const s = id && h.states[id]; return s ? s.state + '|' + s.last_changed : '-'; }).join(';')
        + '#' + JSON.stringify(c);
    }

    _render(){
      if (!this._hass || !this._config) return;
      const sig = this._signature();
      if (sig === this._sig) return;
      this._sig = sig;

      const h = this._hass, c = this._config;
      const status = h.states[c.entity];
      const cls = stateClass(status ? status.state : 'unavailable');
      const inks = inkList(c, h);
      const pagesId = pagesEntity(c, h);
      const pages = pagesId && h.states[pagesId] ? h.states[pagesId].state : null;
      const low = Number(c.low_threshold);

      if (!this.shadowRoot) {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `<style>${STYLE}</style><ha-badge type="badge"></ha-badge><dialog></dialog>`;
        this._badge = this.shadowRoot.querySelector('ha-badge');
        this._dialog = this.shadowRoot.querySelector('dialog');
        this._badge.addEventListener('click', () => this._open());
        this._badge.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._open(); } });
        this._dialog.addEventListener('click', e => { if (e.target === this._dialog) this._dialog.close(); });
      }

      const inkHtml = inks.map(i => {
        const s = h.states[i.entity];
        const v = s ? Math.round(Number(s.state)) : NaN;
        const isLow = !isNaN(v) && v < low;
        return `<span class="ink${isLow ? ' low' : ''}"><ha-icon icon="mdi:water" style="color:${i.color}"></ha-icon><span>${isNaN(v) ? '—' : v + '%'}</span></span>`;
      }).join('');
      this._badge.innerHTML =
        `<ha-icon slot="icon" class="printer ${cls}" icon="${c.icon || 'mdi:printer'}"></ha-icon>` +
        `<span class="row">${pages !== null ? `<span class="val">${pages}</span>` : ''}` +
        `${pages !== null && inks.length ? '<span class="sep"></span>' : ''}${inkHtml}</span>`;

      const label = [
        this._title(),
        fmtState(h, status),
        pages !== null ? `${pages} pagina's` : '',
        ...inks.map(i => { const s = h.states[i.entity]; return s ? `${s.attributes.friendly_name || i.entity} ${s.state}%` : ''; })
      ].filter(Boolean).join(', ');
      this._badge.setAttribute('aria-label', label);
      this._badge.setAttribute('title', label);

      if (this._dialog.open) this._fillDialog();
    }

    _title(){
      const h = this._hass, c = this._config;
      if (c.name) return c.name;
      const reg = h.entities && h.entities[c.entity];
      const dev = reg && reg.device_id && h.devices && h.devices[reg.device_id];
      if (dev) return dev.name_by_user || dev.name;
      const s = h.states[c.entity];
      return s ? s.attributes.friendly_name : c.entity;
    }

    _fillDialog(){
      const h = this._hass, c = this._config;
      const status = h.states[c.entity];
      const cls = stateClass(status ? status.state : 'unavailable');
      const low = Number(c.low_threshold);
      const pagesId = pagesEntity(c, h);
      const rows = inkList(c, h).map(i => {
        const s = h.states[i.entity];
        const v = s ? Math.round(Number(s.state)) : NaN;
        const isLow = !isNaN(v) && v < low;
        return `<div class="line">
          <ha-icon class="drop${isLow ? ' low' : ''}" icon="mdi:water" style="color:${i.color}"></ha-icon>
          <span>${shortName(h, i.entity)}</span>
          <span class="val ${isLow ? 'low' : ''}">${isNaN(v) ? '—' : v + '%'}</span>
          <div class="meter"><i style="width:${isNaN(v) ? 0 : Math.max(0, Math.min(100, v))}%;background:${i.color}"></i></div>
        </div>`;
      }).join('');
      const extra = [pagesId, ...(c.details || [])].filter(id => id && h.states[id]).map(id => {
        const s = h.states[id];
        return `<div class="line"><ha-icon icon="${s.attributes.icon || 'mdi:file-document-outline'}"></ha-icon>
          <span>${shortName(h, id)}</span><span class="val">${fmtState(h, s)}</span></div>`;
      }).join('');
      this._dialog.innerHTML = `
        <div class="dlg" tabindex="-1" autofocus>
          <div class="dlg-head">
            <ha-icon class="printer ${cls}" icon="${c.icon || 'mdi:printer'}"></ha-icon>
            <div style="flex:1"><div class="dlg-title">${this._title()}</div><div class="dlg-sub">${fmtState(h, status)}</div></div>
          </div>
          ${rows}${extra}
        </div>
        <div class="actions">
          <button data-act="close">Sluiten</button>
        </div>`;
      this._dialog.querySelector('[data-act=close]').addEventListener('click', () => this._dialog.close());
    }

    _open(){
      // In the dashboard editor a tap opens the badge editor instead.
      if (this.closest && this.closest('[preview]')) return;
      this._fillDialog();
      this._dialog.showModal();
    }
  }

  /* ============================== EDITOR ============================== */
  const LABELS = {
    entity: 'Status van de printer',
    pages: 'Pagina-teller',
    inks: 'Inktniveaus',
    low_threshold: 'Bijna leeg onder (%)',
    name: 'Naam in de pop-up',
    icon: 'Icoon',
    details: 'Extra in de pop-up'
  };
  const HELPERS = {
    pages: 'Leeg laten: wordt automatisch gezocht op hetzelfde apparaat.',
    inks: 'Leeg laten: de inktsensoren van hetzelfde apparaat worden automatisch gevonden. De kleur volgt uit de naam (cyaan, magenta, geel, zwart).',
    details: 'Sensoren die alleen in de pop-up staan, bijvoorbeeld pagina\'s in kleur en zwart-wit.'
  };
  const SCHEMA = [
    { name: 'entity', required: true, selector: { entity: { domain: 'sensor' } } },
    { name: 'pages', selector: { entity: { domain: 'sensor' } } },
    { name: 'inks', selector: { entity: { domain: 'sensor', multiple: true } } },
    { type: 'grid', name: '', schema: [
      { name: 'low_threshold', selector: { number: { min: 0, max: 100, step: 1, mode: 'box', unit_of_measurement: '%' } } },
      { name: 'icon', selector: { icon: {} } }
    ] },
    { name: 'details', selector: { entity: { multiple: true } } },
    { name: 'name', selector: { text: {} } }
  ];

  class PrinterBadgeEditor extends HTMLElement {
    setConfig(config){ this._config = Object.assign({}, config); this._render(); }
    set hass(hass){ this._hass = hass; if (this._form) this._form.hass = hass; else this._render(); }

    _render(){
      if (!this._config || !this._hass) return;
      if (!this._form) {
        this._form = document.createElement('ha-form');
        this._form.computeLabel = s => LABELS[s.name] || s.name;
        this._form.computeHelper = s => HELPERS[s.name];
        this._form.schema = SCHEMA;
        this._form.addEventListener('value-changed', e => this._changed(e));
        this.appendChild(this._form);
      }
      this._form.hass = this._hass;
      const data = Object.assign({ low_threshold: DEFAULT_LOW }, this._config);
      // The entity selector wants plain ids; YAML may hold {entity, color}
      if (Array.isArray(data.inks)) data.inks = data.inks.map(i => typeof i === 'string' ? i : i.entity);
      this._form.data = data;
    }

    _changed(ev){
      ev.stopPropagation();
      const v = Object.assign({}, ev.detail.value);
      // Keep a colour set in YAML for inks that are still selected
      if (Array.isArray(v.inks)) {
        const old = Array.isArray(this._config.inks) ? this._config.inks : [];
        v.inks = v.inks.map(id => old.find(o => typeof o === 'object' && o.entity === id) || id);
        if (!v.inks.length) delete v.inks;
      }
      if (Array.isArray(v.details) && !v.details.length) delete v.details;
      for (const k of ['pages', 'name', 'icon']) if (v[k] === '' || v[k] === undefined) delete v[k];
      if (Number(v.low_threshold) === DEFAULT_LOW) delete v.low_threshold;
      this._config = v;
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: v }, bubbles: true, composed: true }));
    }
  }

  if (customElements.get('printer-badge')) return;
  customElements.define('printer-badge', PrinterBadge);
  customElements.define('printer-badge-editor', PrinterBadgeEditor);

  window.customBadges = window.customBadges || [];
  window.customBadges.push({
    type: 'printer-badge',
    name: 'Printer Badge',
    description: 'Printerstatus, pagina-teller en inktniveaus in één badge, met details in een pop-up',
    preview: true
  });

  console.info(
    `%c PRINTER-BADGE %c ${CARD_VERSION} `,
    'color: white; font-weight: bold; background: #2581ab',
    'color: #2581ab; font-weight: bold; background: #e0e0e0'
  );
})();
