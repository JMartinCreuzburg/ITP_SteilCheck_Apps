/* Rush-Hour an der Theke – Block 1, Phase 2.
   Ein Gerät pro Rolle: Gast (Gästekarten), Thekenkraft (App-Link bzw. Preistabelle und Strichliste),
   Beobachtung (Uhr, Preise prüfen, Zitate). Danach die Auswertung mit Usability-Karte und Export als
   Issue ins Team-Repo. Alles bleibt im Browser dieses Geräts (localStorage), es gibt keinen Server.
   Die Erwartungswerte stehen in daten.js und stammen aus der ClimbDesk-Tariflogik. */
(function () {
  'use strict';

  const D = window.RUSHHOUR;
  const KEY = 'steilcheck-rushhour';
  const RUNDENZEIT = 240; // Sekunden
  const RUNDEN = {
    A: { app: 'SteilCheck', url: '../steilcheck/' },
    B: { app: 'Papier', url: null },
    C: { app: 'ClimbDesk', url: '../climbdesk/' },
  };
  const ART = {
    gruppe: 'Gruppe',
    ermaessigt: 'mit Ausweis',
    kleinkind: 'mit Kleinkind',
    'alter-nachfrage': 'Alter erst auf Nachfrage',
    einzeln: 'Einzelgast',
  };

  // Usability-Karte: je Prinzip ein Satz und ein Beispiel, das nicht aus SteilCheck stammt.
  const PRINZIPIEN = [
    { id: 'e-effektiv', quelle: '5 E’s', name: 'effektiv (effective)', satz: 'Man erreicht sein Ziel vollständig und richtig.', bsp: 'Am Fahrkartenautomaten kommt am Ende das richtige Ticket heraus.' },
    { id: 'e-effizient', quelle: '5 E’s', name: 'effizient (efficient)', satz: 'Man erreicht das Ziel schnell und ohne unnötige Schritte.', bsp: 'Die häufigste Fahrt ist mit zwei Tipps gekauft.' },
    { id: 'e-einnehmend', quelle: '5 E’s', name: 'einnehmend (engaging)', satz: 'Die Bedienung ist angenehm, man nutzt sie gern und vertraut ihr.', bsp: 'Eine ruhige, klare Oberfläche, die nicht nervös macht.' },
    { id: 'e-fehlertolerant', quelle: '5 E’s', name: 'fehlertolerant (error tolerant)', satz: 'Fehler werden verhindert oder lassen sich leicht beheben.', bsp: 'Ein Formular markiert das falsche Feld und behält alle anderen Eingaben.' },
    { id: 'e-erlernbar', quelle: '5 E’s', name: 'leicht erlernbar (easy to learn)', satz: 'Man kommt ohne Schulung zurecht.', bsp: 'Eine Aushilfe im Café kann nach fünf Minuten kassieren.' },
    { id: 'i-aufgabe', quelle: 'ISO 9241-110', name: 'Aufgabenangemessenheit', satz: 'Die Software unterstützt die Aufgabe ohne unnötige Schritte und Felder.', bsp: 'Ein Lieferdienst fragt für eine Pizza nicht nach dem Geburtsdatum.' },
    { id: 'i-selbst', quelle: 'ISO 9241-110', name: 'Selbstbeschreibungsfähigkeit', satz: 'Man sieht jederzeit, wo man ist, was ein Element tut und was als Nächstes kommt.', bsp: 'Knöpfe sind beschriftet, oben steht „Schritt 2 von 3“.' },
    { id: 'i-erwartung', quelle: 'ISO 9241-110', name: 'Erwartungskonformität', satz: 'Die Software verhält sich so, wie man es von ähnlichen Programmen kennt.', bsp: 'Die Hauptaktion ist hervorgehoben, „Abbrechen“ ist unauffällig.' },
    { id: 'i-lern', quelle: 'ISO 9241-110', name: 'Lernförderlichkeit (seit 2020: Erlernbarkeit)', satz: 'Die Software hilft, die Bedienung schnell zu lernen.', bsp: 'Verständliche Begriffe statt Abkürzungen, ein Hinweis beim ersten Mal.' },
    { id: 'i-steuer', quelle: 'ISO 9241-110', name: 'Steuerbarkeit', satz: 'Man bestimmt Tempo und Reihenfolge selbst und kann zurück oder abbrechen.', bsp: 'Im Online-Shop führt „Zurück“ zum Warenkorb, ohne ihn zu leeren.' },
    { id: 'i-fehler', quelle: 'ISO 9241-110', name: 'Fehlertoleranz (seit 2020: Robustheit gegen Benutzungsfehler)', satz: 'Trotz falscher Eingabe kommt man mit wenig Aufwand ans Ziel. Meldungen sagen, was zu tun ist.', bsp: '„Bitte die Postleitzahl mit fünf Ziffern eingeben“ statt „Error 17“.' },
    { id: 'i-individuell', quelle: 'ISO 9241-110', name: 'Individualisierbarkeit (2020 ersetzt durch Benutzerbindung)', satz: 'Man kann die Software an die eigene Arbeitsweise anpassen.', bsp: 'Schriftgröße und häufige Funktionen lassen sich einstellen.' },
  ];

  // ---------- Zustand (nur in diesem Browser) ----------
  const leereRunde = () => ({ kassiert: ['', '', '', '', ''], zitate: [], uhr: { rest: RUNDENZEIT, start: 0, laeuft: false }, strichliste: '' });
  const neu = () => ({ v: 1, runde: 'A', repo: '', gast: { A: 0, B: 0, C: 0 }, runden: { A: leereRunde(), B: leereRunde(), C: leereRunde() }, prinzipien: {} });
  let state = (function laden() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 1) return s;
    } catch (e) { /* ohne Speicher */ }
    return neu();
  })();
  // Der Link im Auftrag B1-2 bringt die Adresse des Team-Repos mit (?repo=…)
  try {
    const ausLink = new URLSearchParams(location.search).get('repo');
    if (ausLink) { state.repo = ausLink; speichern(); }
  } catch (e) { /* ohne Parameter */ }
  function speichern() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ohne Speicher */ }
  }

  // ---------- Helfer ----------
  const $ = (sel, root) => (root || document).querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const euro = (n) => n.toFixed(2).replace('.', ',') + ' €';
  const satz = (r) => D.saetze.find((s) => s.runde === r);
  const rundenName = (r) => `Runde ${r} · ${RUNDEN[r].app}`;
  function betrag(text) {
    const t = String(text).replace(/[€\s]/g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
    return Math.round(parseFloat(t) * 100);
  }
  function urteil(r, i) {
    const soll = Math.round(satz(r).gaeste[i].erwartet * 100);
    const ist = betrag(state.runden[r].kassiert[i]);
    if (state.runden[r].kassiert[i].trim() === '') return { art: 'offen', text: '' };
    if (ist === null) return { art: 'falsch', text: 'Bitte einen Betrag wie 12,50 eingeben.', zaehlt: false };
    if (ist === soll) return { art: 'ok', text: '✓ Preis stimmt', zaehlt: true, richtig: true };
    const diff = (ist - soll) / 100;
    return { art: 'falsch', text: `✗ falscher Preis (${diff > 0 ? '+' : '−'}${euro(Math.abs(diff))})`, zaehlt: true, richtig: false };
  }
  function messwerte(r) {
    let geschafft = 0, falsch = 0;
    satz(r).gaeste.forEach((g, i) => {
      const u = urteil(r, i);
      if (u.zaehlt) { geschafft++; if (!u.richtig) falsch++; }
    });
    return { geschafft, falsch };
  }
  function personenTabelle(g, mitAlterVerdeckt) {
    const zeilen = g.personen.map((p) => {
      const alter = mitAlterVerdeckt ? `${p.alter}<br><span class="klein nachfrage">nur auf Nachfrage</span>` : p.alter;
      return `<tr><td>${esc(p.name)}</td><td>${alter}</td><td>${p.ausweis ? esc(p.ausweis) : '–'}</td><td>${p.leihschuhe ? 'ja' : '–'}</td></tr>`;
    }).join('');
    return `<div class="tabelle-wrap"><table><thead><tr><th>Name</th><th>Alter</th><th>Ausweis</th><th>Leihschuhe</th></tr></thead><tbody>${zeilen}</tbody></table></div>`;
  }

  // ---------- Ansichten ----------
  const ANSICHTEN = {
    start() {
      return `
        <h1>Rush-Hour an der Theke</h1>
        <p class="karte gelb"><strong>${esc(D.tag)}, ${esc(D.einlass)} Uhr.</strong> Fünf Gäste stehen an der Theke der Halle Fürth.
          Ihr spielt das dreimal durch: mit SteilCheck, ohne App und mit ClimbDesk. Jede Runde dauert 4 Minuten.</p>
        <h2>Welche Rolle hat dieses Gerät?</h2>
        <div class="raster">
          <a class="wahl" href="#gast"><strong>Gast</strong>1–2 Personen lesen die Gästekarten vor und drängeln freundlich.</a>
          <a class="wahl" href="#theke"><strong>Thekenkraft</strong>checkt die Gäste ein und kassiert.</a>
          <a class="wahl" href="#beobachtung"><strong>Beobachtung</strong>stoppt die Zeit, prüft die Preise und schreibt Zitate mit.</a>
        </div>
        <div class="hinweis">
          <p><strong>Die Geräte bleiben am Platz, die Personen wechseln.</strong> Nach jeder Runde rückt ihr einen Platz weiter:
            Gast wird Thekenkraft, Thekenkraft wird Beobachtung, Beobachtung wird Gast. Zu viert gibt es zwei Gäste: Wer die
            Gästekarten vorgelesen hat, wird Thekenkraft, der andere Gast liest in der nächsten Runde vor.
            So liegen am Ende alle Messwerte auf dem Gerät der Beobachtung.</p>
          <p class="klein">Die Runde stellt ihr oben ein, nach jedem Wechsel auf allen drei Geräten. Was ihr eintragt, bleibt nur in diesem Browser.</p>
        </div>
        <h2>Nach der dritten Runde</h2>
        <p>Auf dem Gerät der Beobachtung öffnet ihr die <a href="#auswertung">Auswertung</a>: Messwerte, Usability-Karte und Zitate.
          Von dort speichert ihr euer Ergebnis als Issue im Team-Repo.</p>`;
    },

    gast() {
      const r = state.runde, s = satz(r), i = state.gast[r], g = s.gaeste[i];
      const verdeckt = g.art === 'alter-nachfrage';
      return `
        <h1>Gast <span class="zaehler">${i + 1} von ${s.gaeste.length} · ${esc(rundenName(r))}</span></h1>
        <section class="karte gastkarte" aria-live="polite">
          <div class="zaehler">${esc(ART[g.art] || '')}${g.personen.length > 1 ? ` · ${g.personen.length} Personen` : ''}</div>
          <p class="sagt">„${esc(g.sagt)}“</p>
          ${personenTabelle(g, verdeckt)}
          ${g.nachfrage ? `<p class="nachfrage">${esc(g.nachfrage)}</p>` : ''}
          <p><strong>Wie habt ihr von uns erfahren?</strong> Falls gefragt: ${esc(g.wieErfahren)}</p>
          <p class="draengeln">Drängeln: ${esc(g.draengeln)}</p>
        </section>
        <div class="knopfreihe">
          <button class="knopf" data-tu="gast-zurueck" ${i === 0 ? 'disabled' : ''}>← voriger Gast</button>
          <button class="knopf haupt" data-tu="gast-weiter" ${i === s.gaeste.length - 1 ? 'disabled' : ''}>nächster Gast →</button>
        </div>
        <div class="hinweis klein">Sagt, was in der Sprechblase steht. Fragen der Thekenkraft beantwortet ihr mit den Angaben auf der Karte,
          aber nur, wenn sie gestellt werden. Sobald der Preis genannt ist, kommt der nächste Gast.</div>`;
    },

    theke() {
      const r = state.runde, run = RUNDEN[r];
      if (r === 'B') {
        return `
          <h1>Thekenkraft <span class="zaehler">${esc(rundenName(r))}</span></h1>
          <p>Diese Runde ohne App: <strong>Strichliste, Preistabelle und Taschenrechner</strong> (die Taschenrechner-App eures Smartphones).
            Nennt am Ende jedes Gastes laut den Betrag.</p>
          ${preistabelle()}
          <h2><label for="strichliste">Strichliste</label></h2>
          <p class="leise klein">Name, Personen, Betrag – so, wie es an der Theke mit Stift und Zettel gemacht wird.</p>
          <textarea id="strichliste" rows="9" data-feld="strichliste">${esc(state.runden.B.strichliste)}</textarea>`;
      }
      return `
        <h1>Thekenkraft <span class="zaehler">${esc(rundenName(r))}</span></h1>
        <div class="karte blau">
          <p><a class="knopf haupt" href="${run.url}" target="_blank" rel="noopener">${esc(run.app)} öffnen</a></p>
          <ol>
            <li>Theken-Tablet: Smartphone quer oder ein schmales Browserfenster (etwa 800 px, am Laptop auch F12 → Gerätemodus).</li>
            <li><strong>Einlass ${esc(D.einlass)} eintragen.</strong> Die App setzt sonst die aktuelle Uhrzeit.</li>
            <li>Gäste einchecken und am Ende laut den Betrag nennen, der zu zahlen ist.</li>
          </ol>
        </div>
        <p class="leise">Die Gäste stehen vor euch und lesen ihre Karten vor. Fragt nach, was ihr wissen müsst.</p>`;
    },

    beobachtung() {
      const r = state.runde, s = satz(r), run = state.runden[r];
      const zeilen = s.gaeste.map((g, i) => {
        const wer = g.personen.length > 1 ? `${esc(g.personen[0].name.split(' ')[0])} und ${g.personen.length - 1} weitere` : esc(g.personen[0].name);
        const pos = g.positionen.map((p) => `<tr><td>${esc(p.text)}</td><td class="zahl">${euro(p.betrag)}</td></tr>`).join('');
        return `
          <div class="gast-zeile" data-gast="${i}">
            <div><strong>Gast ${i + 1}:</strong> ${wer} <span class="leise klein">(${esc(ART[g.art] || '')})</span><br>
              erwartet: <span class="soll">${euro(g.erwartet)}</span></div>
            <div><label class="klein" for="k${i}">kassiert (€)</label>
              <input id="k${i}" inputmode="decimal" autocomplete="off" data-kassiert="${i}" value="${esc(run.kassiert[i])}"></div>
            <div class="urteil" data-urteil="${i}"></div>
            <details><summary>So setzt sich der Preis zusammen</summary><table><tbody>${pos}
              <tr><th>Gesamt</th><th class="zahl">${euro(g.erwartet)}</th></tr></tbody></table></details>
          </div>`;
      }).join('');
      return `
        <h1>Beobachtung <span class="zaehler">${esc(rundenName(r))}</span></h1>
        <div class="uhr" id="uhr">
          <span class="uhr-zeit" id="uhr-zeit" aria-live="off"></span>
          <button class="knopf haupt" data-tu="uhr">Start</button>
          <button class="knopf" data-tu="uhr-reset">↺ neu</button>
          <span class="leise klein">Nach 4 Minuten ist Schluss, auch mitten im Check-in. Das ist der Messwert.</span>
        </div>
        <p class="karte gelb" id="wechsel" hidden>${r === 'C'
          ? '<strong>Zeit!</strong> Das war die letzte Runde. Öffnet auf diesem Gerät die <a href="#auswertung">Auswertung</a>.'
          : `<strong>Zeit!</strong> Rückt einen Platz weiter und stellt <strong>auf allen drei Geräten</strong> oben ${esc(rundenName(r === 'A' ? 'B' : 'C'))} ein.`}</p>
        <section class="karte">
          <h2 style="margin-top:0">Preise prüfen</h2>
          <p class="leise klein">Tragt den Betrag ein, den die Thekenkraft nennt. Die Erwartungswerte sieht nur ihr.</p>
          ${zeilen}
          <p class="stand" id="stand" aria-live="polite"></p>
        </section>
        <section class="karte">
          <h2 style="margin-top:0"><label for="zitat">Wörtliche Zitate</label></h2>
          <p class="leise klein">Was sagen Thekenkraft und Gäste? Wörtlich, mit Enter speichern.</p>
          <div class="knopfreihe"><input type="text" id="zitat" placeholder="„Wo ist denn der Weiter-Knopf?“" autocomplete="off">
            <button class="knopf" data-tu="zitat">Speichern</button></div>
          <ul class="zitate">${run.zitate.map((z, i) => `<li><span class="text">${esc(z.text)}</span><button class="weg" data-weg="${i}" aria-label="Zitat löschen">✕</button></li>`).join('')}</ul>
        </section>`;
    },

    auswertung() {
      const zeilen = ['A', 'B', 'C'].map((r) => {
        const m = messwerte(r);
        return `<tr><td>${esc(rundenName(r))}</td><td class="zahl">${m.geschafft} von 5</td><td class="zahl">${m.falsch}</td></tr>`;
      }).join('');
      const zitate = alleZitate();
      const gewaehlt = PRINZIPIEN.filter((p) => (state.prinzipien[p.id] || {}).an).length;
      const prinzip = (p) => {
        const w = state.prinzipien[p.id] || {};
        return `
          <div class="prinzip">
            <label><input type="checkbox" data-prinzip="${p.id}" ${w.an ? 'checked' : ''}> <span>${esc(p.name)}</span></label>
            <p class="erkl">${esc(p.satz)} <em>Beispiel: ${esc(p.bsp)}</em></p>
            ${w.an ? `<textarea data-beleg="${p.id}" placeholder="Beleg: Was habt ihr in der Rush-Hour beobachtet?">${esc(w.beleg || '')}</textarea>` : ''}
          </div>`;
      };
      return `
        <h1>Auswertung</h1>
        <section class="karte">
          <h2 style="margin-top:0">Messwerte</h2>
          <div class="tabelle-wrap"><table><thead><tr><th>Runde</th><th class="zahl">Gäste in 4 Minuten</th><th class="zahl">falsche Preise</th></tr></thead>
            <tbody>${zeilen}</tbody></table></div>
          <p class="leise klein">Diese Zahlen nennt ihr in der Galerie.</p>
        </section>
        <section class="karte">
          <h2 style="margin-top:0">Usability-Karte</h2>
          <p>Markiert <strong>zwei Prinzipien</strong>, die SteilCheck verletzt hat, und schreibt zu jedem einen Beleg aus der Rush-Hour dazu.
            <span class="zaehlwerk ${gewaehlt >= 2 ? 'voll' : ''}">${gewaehlt} von 2 markiert</span></p>
          <h3>Die 5 E’s</h3>${PRINZIPIEN.filter((p) => p.quelle === '5 E’s').map(prinzip).join('')}
          <h3>ISO 9241-110: Grundsätze der Dialoggestaltung</h3>${PRINZIPIEN.filter((p) => p.quelle !== '5 E’s').map(prinzip).join('')}
        </section>
        <section class="karte">
          <h2 style="margin-top:0">Zitate sortieren</h2>
          <p><strong>Ging es? Wie schnell?</strong> Konnte man die Aufgabe richtig und ohne Umwege erledigen? Das ist <strong>Usability</strong>.<br>
            <strong>Wie hat es sich angefühlt?</strong> Vertrauen, Kontrolle, Stress, Ärger? Das ist <strong>User Experience (UX)</strong>.</p>
          ${zitate.length ? `<ul class="zitate">${zitate.map((z) => `
            <li><span><span class="text">${esc(z.text)}</span> <span class="leise klein">Runde ${z.runde}</span></span>
              <span class="zitat-art">
                <button data-art="usability" data-zitat="${z.runde}:${z.i}" aria-pressed="${z.art === 'usability'}">Usability</button>
                <button class="ux" data-art="ux" data-zitat="${z.runde}:${z.i}" aria-pressed="${z.art === 'ux'}">UX</button>
              </span></li>`).join('')}</ul>` : '<p class="leise">Noch keine Zitate. Die Beobachtung notiert sie während der Runden.</p>'}
        </section>
        <section class="karte gruen">
          <h2 style="margin-top:0">Ergebnis ins Team-Repo</h2>
          <p><label for="repo">Adresse eures Team-Repos</label></p>
          <input type="url" id="repo" data-feld="repo" placeholder="https://github.com/KLASSE/ITP_SteilCheck_Team" value="${esc(state.repo)}">
          <div class="knopfreihe">
            <button class="knopf haupt" data-tu="issue">Als Issue speichern</button>
            <button class="knopf" data-tu="kopieren">Ergebnis kopieren</button>
            <span id="export-meldung" class="klein" aria-live="polite"></span>
          </div>
          <p class="leise klein">„Als Issue speichern“ öffnet auf GitHub das Formular „Ergebnis Rush-Hour“, schon ausgefüllt. Ihr müsst nur noch
            auf „Create“ klicken. Klappt das nicht, kopiert das Ergebnis und fügt es in das Formular ein.</p>
        </section>
        <p class="knopfreihe"><button class="knopf" data-tu="loeschen">Alles auf diesem Gerät löschen</button></p>`;
    },
  };

  function preistabelle() {
    return `
      <section class="karte preistabelle" aria-label="Preistabelle der Theke">
        <h2>Steilwand Fürth · Tageseintritt</h2>
        <table><tbody>
          <tr><td>Kleinkinder unter 6 Jahren<br><span class="klein">nur mit zahlender erwachsener Begleitung</span></td><td>frei</td></tr>
          <tr><td>Kinder 6–13 Jahre</td><td>9,00 €</td></tr>
          <tr><td>Jugendliche 14–17 Jahre</td><td>12,00 €</td></tr>
          <tr><td>Erwachsene 18–64 Jahre</td><td>15,50 €</td></tr>
          <tr><td>Senior:innen ab 65 Jahren</td><td>12,00 €</td></tr>
          <tr><td>Ermäßigung mit Schüler-, Studierenden- oder Azubi-Ausweis<br><span class="klein">nur Jugendliche und Erwachsene</span></td><td>−15 %</td></tr>
          <tr><td>Abendtarif ab 20:00 Uhr<br><span class="klein">auf den Eintritt, auch auf den ermäßigten</span></td><td>−25 %</td></tr>
          <tr><td>Gruppen ab 5 zahlenden Personen<br><span class="klein">auf die Summe der Eintrittspreise</span></td><td>−10 %</td></tr>
          <tr><td>Leihschuhe pro Paar<br><span class="klein">kein Rabatt</span></td><td>3,50 €</td></tr>
        </tbody></table>
        <p class="klein">Jeden Eintrittspreis kaufmännisch auf volle Cent runden.</p>
      </section>`;
  }

  function alleZitate() {
    const liste = [];
    ['A', 'B', 'C'].forEach((r) => state.runden[r].zitate.forEach((z, i) => liste.push({ runde: r, i, text: z.text, art: z.art || null })));
    return liste;
  }

  // ---------- Uhr ----------
  const rest = (u) => (u.laeuft ? u.rest - (Date.now() - u.start) / 1000 : u.rest);
  function uhrZeigen() {
    const el = $('#uhr');
    if (!el) return;
    const u = state.runden[state.runde].uhr;
    let s = rest(u);
    if (u.laeuft && s <= 0) { u.laeuft = false; u.rest = 0; s = 0; speichern(); sperren(); }
    const sek = Math.max(0, Math.ceil(s));
    $('#uhr-zeit').textContent = sek === 0 ? 'Zeit!' : `${Math.floor(sek / 60)}:${String(sek % 60).padStart(2, '0')}`;
    el.classList.toggle('knapp', sek > 0 && sek <= 30);
    el.classList.toggle('vorbei', sek === 0);
    const wechsel = $('#wechsel');
    if (wechsel) wechsel.hidden = sek !== 0;
    const knopf = el.querySelector('[data-tu="uhr"]');
    knopf.textContent = u.laeuft ? 'Pause' : sek === 0 ? 'vorbei' : u.rest < RUNDENZEIT ? 'weiter' : 'Start';
    knopf.disabled = sek === 0;
  }
  // Nach Ablauf der Zeit lassen sich keine neuen Gäste mehr eintragen.
  function sperren() {
    const run = state.runden[state.runde];
    const vorbei = run.uhr.rest <= 0 && !run.uhr.laeuft;
    document.querySelectorAll('[data-kassiert]').forEach((inp) => {
      inp.disabled = vorbei && run.kassiert[+inp.dataset.kassiert].trim() === '';
    });
  }
  function urteileZeigen() {
    const r = state.runde;
    document.querySelectorAll('[data-urteil]').forEach((el) => {
      const u = urteil(r, +el.dataset.urteil);
      el.textContent = u.text;
      el.className = 'urteil ' + u.art;
    });
    const m = messwerte(r);
    const stand = $('#stand');
    if (stand) stand.textContent = `Geschafft: ${m.geschafft} von 5 · falsche Preise: ${m.falsch}`;
  }

  // ---------- Export ----------
  function ergebnis() {
    const messwerteMd = ['| Runde | Gäste in 4 Minuten | falsche Preise |', '|---|---|---|']
      .concat(['A', 'B', 'C'].map((r) => { const m = messwerte(r); return `| ${rundenName(r)} | ${m.geschafft} von 5 | ${m.falsch} |`; }))
      .join('\n');
    const prinzipienMd = PRINZIPIEN.filter((p) => (state.prinzipien[p.id] || {}).an)
      .map((p) => `- **${p.name}** (${p.quelle}): ${(state.prinzipien[p.id].beleg || '').trim() || '_Beleg fehlt_'}`)
      .join('\n') || '_keine markiert_';
    const zitate = alleZitate();
    const block = (art, titel) => {
      const z = zitate.filter((x) => x.art === art);
      return `**${titel}**\n` + (z.length ? z.map((x) => `- „${x.text}“ (Runde ${x.runde})`).join('\n') : '- _keins_');
    };
    const ohne = zitate.filter((x) => !x.art);
    const zitateMd = [block('usability', 'Usability – Ging es? Wie schnell?'), block('ux', 'UX – Wie hat es sich angefühlt?')]
      .concat(ohne.length ? ['**noch nicht sortiert**\n' + ohne.map((x) => `- „${x.text}“ (Runde ${x.runde})`).join('\n')] : [])
      .join('\n\n');
    return { messwerte: messwerteMd, prinzipien: prinzipienMd, zitate: zitateMd };
  }
  function repoAdresse() {
    const m = /^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+)/.exec((state.repo || '').trim());
    return m ? `https://github.com/${m[1]}/${m[2].replace(/\.git$/, '')}` : null;
  }
  function melden(text) { const el = $('#export-meldung'); if (el) el.textContent = text; }

  // ---------- Darstellung ----------
  function zeigen(nachOben) {
    let name = (location.hash || '#start').slice(1);
    if (!ANSICHTEN[name]) name = 'start';
    $('#inhalt').innerHTML = ANSICHTEN[name]();
    document.querySelectorAll('.rollen a').forEach((a) => {
      if (a.getAttribute('href') === '#' + name) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const runden = $('.runden');
    runden.hidden = name === 'auswertung' || name === 'start';
    runden.innerHTML = ['A', 'B', 'C'].map((r) => `<button data-runde="${r}" aria-pressed="${state.runde === r}">${esc(rundenName(r))}</button>`).join('');
    $('#kopf-zeit').textContent = `${D.tag}, ${D.einlass} Uhr`;
    if (name === 'beobachtung') { uhrZeigen(); urteileZeigen(); sperren(); }
    if (nachOben) window.scrollTo(0, 0);
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const r = state.runde, run = state.runden[r];
    if (t.dataset.runde) { state.runde = t.dataset.runde; speichern(); zeigen(); return; }
    if (t.dataset.weg !== undefined) { run.zitate.splice(+t.dataset.weg, 1); speichern(); zeigen(); return; }
    if (t.dataset.art) {
      const [zr, zi] = t.dataset.zitat.split(':');
      const z = state.runden[zr].zitate[+zi];
      z.art = z.art === t.dataset.art ? null : t.dataset.art;
      speichern(); zeigen(); return;
    }
    switch (t.dataset.tu) {
      case 'gast-zurueck': state.gast[r] = Math.max(0, state.gast[r] - 1); break;
      case 'gast-weiter': state.gast[r] = Math.min(satz(r).gaeste.length - 1, state.gast[r] + 1); break;
      case 'uhr': {
        const u = run.uhr;
        if (u.laeuft) { u.rest = rest(u); u.laeuft = false; } else if (u.rest > 0) { u.start = Date.now(); u.laeuft = true; }
        speichern(); uhrZeigen(); sperren(); return;
      }
      case 'uhr-reset':
        if (!confirm('Uhr auf 4:00 zurücksetzen?')) return;
        run.uhr = { rest: RUNDENZEIT, start: 0, laeuft: false }; speichern(); uhrZeigen(); sperren(); return;
      case 'zitat': zitatSpeichern(); return;
      case 'issue': {
        const repo = repoAdresse();
        if (!repo) { melden('Bitte zuerst die Adresse eures Team-Repos eintragen (https://github.com/…).'); $('#repo').focus(); return; }
        const e2 = ergebnis();
        // Issue-Formulare lassen sich über die id ihrer Felder vorausfüllen.
        const felder = { template: 'rushhour.yml', title: 'Rush-Hour: unser Ergebnis', messwerte: e2.messwerte, prinzipien: e2.prinzipien, zitate: e2.zitate };
        const q = Object.entries(felder).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        window.open(`${repo}/issues/new?${q}`, '_blank', 'noopener');
        melden('GitHub ist in einem neuen Tab geöffnet.');
        return;
      }
      case 'kopieren': {
        const e2 = ergebnis();
        const text = `### Messwerte\n\n${e2.messwerte}\n\n### Verletzte Prinzipien\n\n${e2.prinzipien}\n\n### Zitate\n\n${e2.zitate}\n`;
        kopieren(text);
        return;
      }
      case 'loeschen':
        if (!confirm('Alle Eintragungen auf diesem Gerät löschen? Das ist für die nächste Klasse gedacht.')) return;
        state = neu(); speichern(); location.hash = '#start'; zeigen(true); return;
      default: return;
    }
    speichern(); zeigen();
  });

  function zitatSpeichern() {
    const inp = $('#zitat');
    const text = inp.value.trim().replace(/^[„"“]+|[“"”]+$/g, '');
    if (!text) return;
    state.runden[state.runde].zitate.push({ text, art: null });
    speichern(); zeigen();
    $('#zitat').focus();
  }

  function kopieren(text) {
    const fertig = () => melden('Kopiert. Jetzt im Issue-Formular einfügen.');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(fertig, () => notfall(text));
    } else notfall(text);
    function notfall(t) {
      const ta = document.createElement('textarea');
      ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); fertig(); } catch (e) { melden('Kopieren ging nicht. Bitte von Hand markieren.'); }
      ta.remove();
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.id === 'zitat') { e.preventDefault(); zitatSpeichern(); }
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.kassiert !== undefined) {
      state.runden[state.runde].kassiert[+t.dataset.kassiert] = t.value;
      speichern(); urteileZeigen();
    } else if (t.dataset.feld === 'strichliste') {
      state.runden.B.strichliste = t.value; speichern();
    } else if (t.dataset.feld === 'repo') {
      state.repo = t.value; speichern();
    } else if (t.dataset.beleg) {
      (state.prinzipien[t.dataset.beleg] = state.prinzipien[t.dataset.beleg] || {}).beleg = t.value; speichern();
    }
  });

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.prinzip) {
      (state.prinzipien[t.dataset.prinzip] = state.prinzipien[t.dataset.prinzip] || {}).an = t.checked;
      speichern(); zeigen();
      const feld = document.querySelector(`[data-beleg="${t.dataset.prinzip}"]`);
      if (feld) feld.focus(); else { const box = document.querySelector(`[data-prinzip="${t.dataset.prinzip}"]`); if (box) box.focus(); }
    }
  });

  window.addEventListener('hashchange', () => zeigen(true));
  setInterval(uhrZeigen, 250);
  zeigen(true);
})();
