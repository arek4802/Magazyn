/*
 * Magazyn AV – interfejs aplikacji.
 */
(function () {
  'use strict';
  const C = window.MagazynCore;
  const S = window.MagazynStorage;
  const X = window.MagazynXlsx;
  const P = window.MagazynPomoc || { TIPY: {}, INSTRUKCJA: [] };

  const FIRMA = {
    nazwa: 'MAASCK SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
    adres: 'Piękna 24/26A, 00-549 Warszawa',
    nip: '7011115199',
    regon: '523695017',
    krs: '0001002721',
    email: 'office@maasck.com',
    www: 'maasck.com',
  };
  const LOGO = window.MAGAZYN_LOGO || {};
  const WERSJA = window.MAGAZYN_WERSJA || '';

  const app = {
    store: null,
    demo: false,
    zdarzenia: [],
    dziwne: [],
    st: C.zbudujStan([]),
    user: null,
    widok: 'pulpit',
    param: {},
    szkic: null,
    filtr: {},
    ostatniOdczyt: null,
    zapamietanyFolder: null,
    zajety: false,
  };

  // ------------------------------------------------------------ narzędzia

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));
  const dzis = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const fmtData = (iso) => {
    if (!iso) return '';
    const s = String(iso);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(8, 10) + '.' + s.slice(5, 7) + '.' + s.slice(0, 4);
    const d = new Date(s);
    return String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  };
  const fmtCzas = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return fmtData(iso) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };
  const fmtL = (x) => (Number(x) || 0).toLocaleString('pl-PL', { maximumFractionDigits: 3 });
  const model = (id) => app.st.modele.get(id) || { modelId: id, model: '(nieznany model)', producent: '', jednostka: 'szt' };
  const nazwaModelu = (id) => {
    const m = model(id);
    return (m.producent ? m.producent + ' ' : '') + m.model;
  };
  const jmw = (j) => (!j || j === 'szt' ? 'szt.' : j);
  const jedn = (id) => jmw(model(id).jednostka);
  /** Odmiana rzeczownika po liczebniku: 1 model, 2 modele, 5 modeli. */
  const odm = (n, jeden, kilka, wiele) => {
    n = Math.abs(Math.round(Number(n) || 0));
    if (n === 1) return jeden;
    const d = n % 10, s = n % 100;
    return d >= 2 && d <= 4 && !(s >= 12 && s <= 14) ? kilka : wiele;
  };
  /** Znak zapytania z dymkiem pomocy. */
  const pomoc = (klucz, strona) => '<span class="pomoc" tabindex="0" role="note" aria-label="Pomoc: ' + esc(P.TIPY[klucz] || klucz) + '" data-tip="' + esc(P.TIPY[klucz] || klucz) + '"' + (strona ? ' data-tip-strona="' + strona + '"' : '') + '>?</span>';
  const fmtIl = (id, x) => {
    const m = model(id);
    let s = fmtL(x) + ' ' + jmw(m.jednostka);
    if (m.jednostkaZakupu && Number(m.przelicznik) > 0 && Math.abs(x) >= Number(m.przelicznik)) s += '<small class="przelicz">≈ ' + fmtL(Math.round((x / m.przelicznik) * 10) / 10) + ' × ' + esc(m.jednostkaZakupu) + '</small>';
    return s;
  };
  /** Nazwa projektu (z rejestru albo z dokumentów). */
  const projNazwa = (numer) => C.nazwaProjektu(app.st, numer);
  const projTekst = (numer) => C.opisProjektu(app.st, numer);
  /** Numer projektu z nazwą pod spodem – do tabel. */
  const projHtml = (numer) => {
    if (!C.norm(numer)) return '';
    const n = projNazwa(numer);
    return '<span class="proj"><span class="nowrap">' + esc(numer) + '</span>' + (n ? '<small>' + esc(n) + '</small>' : '') + '</span>';
  };
  /** Znaczek projektu z nazwą obok. */
  const znaczekProj = (numer, klasa) => {
    if (!C.norm(numer)) return '';
    const n = projNazwa(numer);
    return '<span class="znaczek ' + (klasa || 'projekt') + '">' + esc(numer) + '</span>' + (n ? ' <small class="nazwa-proj">' + esc(n) + '</small>' : '');
  };
  const osoba = (userId) => {
    const u = app.st.uzytkownicy.get(userId);
    return u ? u.imie + ' ' + u.nazwisko : userId || '';
  };
  const bezPodkreslnikow = (ev) => {
    const k = {};
    for (const [a, b] of Object.entries(ev)) if (!a.startsWith('_')) k[a] = b;
    return k;
  };

  class BladUzytkownika extends Error {
    constructor(lista) {
      super(Array.isArray(lista) ? lista.join('\n') : lista);
      this.lista = Array.isArray(lista) ? lista : [lista];
    }
  }

  function toast(tekst, rodzaj) {
    const el = document.createElement('div');
    el.className = 'toast ' + (rodzaj || '');
    el.textContent = tekst;
    $('#toasty').appendChild(el);
    setTimeout(() => el.classList.add('znika'), 3500);
    setTimeout(() => el.remove(), 4200);
  }

  // ------------------------------------------------------------ ikony

  const IK = {
    pulpit: '<path d="M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z"/>',
    stan: '<path d="M21 8l-9-5-9 5 9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
    lok: '<path d="M4 4h16v16H4z"/><path d="M4 10h16M4 15h16M12 4v16"/>',
    urz: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    dok: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    uzup: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    rap: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    kart: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    kli: '<path d="M3 21V7l9-4 9 4v14"/><path d="M9 21v-6h6v6"/>',
    dz: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    prob: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>',
    ust: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    przyj: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
    wyd: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 3h16"/>',
    zwrot: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
    bo: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
    odsw: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    xls: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M9 13l4 5M13 13l-4 5"/>',
    druk: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    szuk: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    karta: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h2.5a1.5 1.5 0 0 1 0 3H9v-5"/>',
    pomoc: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 17h.01"/>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    proj: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h3"/>',
    dost: '<path d="M2 6h12v10H2z"/><path d="M14 9h4l3 3.5V16h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    dol: '<path d="M6 9l6 6 6-6"/>',
    klodka: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    wyloguj: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
    pobierz: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  };
  const ikona = (n, kl) => '<svg class="ik ' + (kl || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (IK[n] || '') + '</svg>';

  // ------------------------------------------------------------ dane

  async function wczytaj() {
    const { zdarzenia, dziwne } = await app.store.wczytajWszystko();
    app.zdarzenia = zdarzenia;
    app.dziwne = dziwne;
    przelicz();
    app.ostatniOdczyt = new Date();
  }

  function przelicz() {
    app.st = C.zbudujStan(app.zdarzenia);
    for (const p of app.dziwne) app.st.problemy.push({ kod: 'PLIK', opis: 'Nietypowa nazwa pliku – możliwa kopia konfliktowa OneDrive: ' + p });
    if (app.user && app.st.uzytkownicy.has(app.user.userId)) app.user = app.st.uzytkownicy.get(app.user.userId);
    if (app.user && app.user.aktywny === false) {
      app.user = null;
      app.szkic = null;
      app.zablokowany = false;
      setTimeout(() => toast('Twoje konto zostało dezaktywowane – wylogowano', 'blad'), 0);
    }
  }

  async function zapiszZdarzenie(ev) {
    await C.zapieczetuj(ev);
    const sciezka = C.sciezkaZdarzenia(ev);
    await app.store.zapisz(sciezka, JSON.stringify(bezPodkreslnikow(ev), null, 2), { nieNadpisuj: true });
    ev._plik = sciezka;
    ev._pieczecOk = true;
    app.zdarzenia.push(ev);
    przelicz();
    return ev;
  }

  async function utworzZdarzenie(typ, dane) {
    const ev = C.noweZdarzenie(app.st, typ, app.user.userId, dane);
    const problemy = ['MODEL', 'KLIENT', 'UZYTK', 'PROJEKT', 'DOSTAWCA'].includes(typ) ? [] : C.sprawdzNowe(app.zdarzenia, ev);
    if (problemy.length) throw new BladUzytkownika(problemy);
    return zapiszZdarzenie(ev);
  }

  async function zapiszDokument(dane) {
    await wczytaj(); // świeży odczyt folderu tuż przed zapisem
    const bledy = C.walidujDokument(app.st, dane);
    if (bledy.length) throw new BladUzytkownika(bledy);
    for (let proba = 0; proba < 6; proba++) {
      const ev = C.przygotujDokument(app.st, app.user.userId, dane);
      const problemy = C.sprawdzNowe(app.zdarzenia, ev);
      if (problemy.length) throw new BladUzytkownika(problemy);
      try {
        return await zapiszZdarzenie(ev);
      } catch (e) {
        if (e.kod === 'ISTNIEJE') {
          await wczytaj();
          continue;
        }
        throw e;
      }
    }
    throw new Error('Nie udało się nadać numeru dokumentu. Odśwież i spróbuj ponownie.');
  }

  async function kopiaTygodniowa(wymus) {
    if (!app.store || app.store.rodzaj !== 'folder' || !app.user) return;
    const nazwy = await app.store.lista('kopie');
    const daty = nazwy.map((n) => (n.match(/^kopia-(\d{4}-\d{2}-\d{2})\.json$/) || [])[1]).filter(Boolean).sort();
    const ostatnia = daty[daty.length - 1];
    const dni = ostatnia ? (Date.now() - Date.parse(ostatnia)) / 86400000 : Infinity;
    if (!wymus && dni < 7) return;
    const tresc = { utworzono: new Date().toISOString(), przez: osoba(app.user.userId), liczbaZdarzen: app.zdarzenia.length, zdarzenia: app.zdarzenia.filter((e) => e.id).map(bezPodkreslnikow) };
    await app.store.zapisz('kopie/kopia-' + dzis() + '.json', JSON.stringify(tresc));
    toast('Zapisano kopię zapasową: kopie/kopia-' + dzis() + '.json', 'ok');
  }

  // ------------------------------------------------------------ okna dialogowe

  let otwartyDialog = null;

  function dialog({ tytul, tresc, przyciski, szeroki, przyOtwarciu, przyWyslaniu, fokus }) {
    return new Promise((ok) => {
      const m = $('#modal');
      m.innerHTML = '<div class="tlo-modal"><form class="okno ' + (szeroki ? 'szerokie' : '') + '" novalidate>' +
        '<div class="okno-naglowek"><h2>' + tytul + '</h2><button type="button" class="ikonowy" data-dialog="__anuluj" aria-label="Zamknij">' + ikona('x') + '</button></div>' +
        '<div class="okno-tresc">' + tresc + '<div class="bledy-okna"></div></div>' +
        '<div class="okno-stopka">' + (przyciski || [{ wartosc: 'ok', etykieta: 'OK', klasa: 'glowny' }]).map((p) =>
          '<button type="' + (p.submit ? 'submit' : 'button') + '" class="przycisk ' + (p.klasa || '') + '" data-dialog="' + esc(p.wartosc) + '">' + p.etykieta + '</button>').join('') + '</div>' +
        '</form></div>';
      const form = $('form', m);
      const zamknij = (w) => {
        if (wyb.pole && m.contains(wyb.pole)) zamknijListe();
        m.innerHTML = '';
        otwartyDialog = null;
        ok(w);
      };
      otwartyDialog = { zamknij };
      let zajety = false;
      const obsluz = async (wartosc) => {
        if (wartosc === '__anuluj' || wartosc === 'anuluj') return zamknij(null);
        if (zajety) return; // np. sprawdzanie PIN-u jeszcze trwa – drugi klik nic nie robi
        if (przyWyslaniu) {
          zajety = true;
          const przyciski = $$('.okno-stopka button', form).filter((x) => x.dataset.dialog !== 'anuluj');
          przyciski.forEach((x) => { x.disabled = true; });
          form.setAttribute('aria-busy', 'true');
          $('.bledy-okna', form).innerHTML = '';
          try {
            const w = await przyWyslaniu(form, wartosc);
            if (w === false) return;
            zamknij(w === undefined ? wartosc : w);
          } catch (e) {
            $('.bledy-okna', form).innerHTML = '<div class="alert blad">' + (e.lista ? e.lista.map(esc).join('<br>') : esc(e.message)) + '</div>';
          } finally {
            zajety = false;
            form.removeAttribute('aria-busy');
            przyciski.forEach((x) => { x.disabled = false; });
          }
        } else zamknij(wartosc);
      };
      form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-dialog]');
        if (b && b.type !== 'submit') {
          e.preventDefault();
          obsluz(b.dataset.dialog);
        }
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const b = e.submitter && e.submitter.dataset.dialog;
        obsluz(b || (przyciski || []).find((p) => p.submit)?.wartosc || 'ok');
      });
      if (przyOtwarciu) przyOtwarciu(form);
      const pierwszy = (fokus && $('[name="' + fokus + '"]', form)) || $('input:not([type=hidden]):not([readonly]), select, textarea', form);
      // nie zabieraj kursora, jeśli ktoś już zaczął pisać w innym polu
      if (pierwszy) setTimeout(() => { if (!form.contains(document.activeElement) && form.isConnected) pierwszy.focus(); }, 30);
    });
  }

  const potwierdz = (tytul, tresc, etykieta, klasa) => dialog({ tytul, tresc: '<p>' + tresc + '</p>', przyciski: [{ wartosc: 'anuluj', etykieta: 'Wróć' }, { wartosc: 'tak', etykieta: etykieta || 'Tak', klasa: klasa || 'glowny', submit: true }] }).then((w) => w === 'tak');

  async function pytajPin(cel) {
    const u = app.st.uzytkownicy.get(app.user.userId);
    const w = await dialog({
      tytul: 'Potwierdź swoim PIN-em',
      tresc: '<p>' + esc(cel) + '</p><p class="szary">Potwierdzasz jako <b>' + esc(u.imie + ' ' + u.nazwisko) + '</b>.</p>' +
        '<label class="pole"><span>PIN ' + pomoc('pin') + '</span><input name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" class="pin"></label>',
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Wróć' }, { wartosc: 'ok', etykieta: 'Potwierdź', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        const pin = f.pin.value.trim();
        if (!pin) throw new Error('Wpisz PIN');
        if (!(await C.sprawdzPin(u, pin))) {
          f.pin.value = '';
          throw new Error('Nieprawidłowy PIN');
        }
        return 'ok';
      },
    });
    return w === 'ok';
  }

  function bladDoOkna(e) {
    const lista = e.lista || [e.message];
    return dialog({ tytul: 'Nie można zapisać', tresc: '<div class="alert blad">' + lista.map(esc).join('<br>') + '</div>' });
  }

  // ------------------------------------------------------------ eksport do Excela

  function pobierz(nazwa, dane, typ) {
    const blob = dane instanceof Blob ? dane : new Blob([dane], { type: typ || 'application/octet-stream' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nazwa;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  async function eksport(nazwa, naglowki, wiersze) {
    const teraz = new Date();
    const tytul = 'MAASCK · ' + nazwa + ' · stan na ' + fmtCzas(teraz.toISOString()) + ' · eksport: ' + osoba(app.user.userId);
    const bajty = X.utworz(nazwa, naglowki, wiersze, tytul);
    const plik = nazwa.replace(/[^\p{L}\p{N}]+/gu, '_') + '_' + dzis() + '.xlsx';
    pobierz(plik, bajty, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    if (app.store.rodzaj === 'folder') {
      try {
        await app.store.zapisz('eksporty/' + plik, new Blob([bajty]));
      } catch (e) { /* zapis kopii eksportu nie jest konieczny */ }
    }
    toast('Wyeksportowano: ' + plik, 'ok');
  }

  const tabele = {}; // id -> {nazwa, naglowki, wiersze}

  // ------------------------------------------------------------ sortowanie tabel
  // Klik w nagłówek kolumny: rosnąco → malejąco → kolejność domyślna. Wybór jest zapamiętywany
  // w przeglądarce (osobno dla każdej tabeli, po nazwie kolumny), a eksport do Excela ma tę samą kolejność.

  app.sortowanie = (() => {
    try { return JSON.parse(localStorage.getItem('magazyn-sortowanie') || '{}') || {}; } catch (e) { return {}; }
  })();
  const kolator = new Intl.Collator('pl', { numeric: true, sensitivity: 'base' });
  const ENCJE = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

  /** Tekst komórki bez znaczników HTML (to, co widać na ekranie). */
  function tekstKomorki(html) {
    return String(html == null ? '' : html).replace(/<[^>]*>/g, ' ').replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENCJE[m]).replace(/\s+/g, ' ').trim();
  }

  /** Klucz sortowania: data (dd.mm.rrrr [gg:mm]), liczba (także „312,5 m”, „4 pozycje”) albo tekst. Puste i „–” → null. */
  function kluczSortowania(wartosc) {
    if (typeof wartosc === 'number') return Number.isFinite(wartosc) ? { typ: 'n', v: wartosc, t: String(wartosc) } : null;
    const t = String(wartosc == null ? '' : wartosc).trim();
    if (/^[-–—]?$/.test(t)) return null;
    let m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:,?\s+(\d{1,2}):(\d{2}))?/);
    if (m) return { typ: 'd', v: ((Number(m[3]) * 100 + Number(m[2])) * 100 + Number(m[1])) * 10000 + Number(m[4] || 0) * 100 + Number(m[5] || 0), t };
    m = t.match(/^(-?\d[\d\s\u00a0]*(?:[,.]\d+)?)(?:\s+\S.*)?$/);
    if (m) return { typ: 'n', v: Number(m[1].replace(/[\s\u00a0]/g, '').replace(',', '.')), t };
    return { typ: 't', v: t, t };
  }

  /** Zwraca wiersze w kolejności wybranej dla tabeli (albo bez zmian). */
  function posortuj(id, naglowki, wiersze) {
    const s = app.sortowanie[id];
    const k = s ? naglowki.indexOf(s.kol) : -1;
    if (k < 0 || wiersze.length < 2) return wiersze;
    const klucze = wiersze.map((w) => kluczSortowania(w.sort && w.sort[k] !== undefined ? w.sort[k] : tekstKomorki(w.komorki[k])));
    const typy = new Set(klucze.filter(Boolean).map((x) => x.typ));
    const liczbowo = typy.size === 1 && !typy.has('t');
    const kier = s.mal ? -1 : 1;
    const kolejnosc = wiersze.map((w, i) => i).sort((a, b) => {
      const x = klucze[a];
      const y = klucze[b];
      if (!x || !y) return x === y ? a - b : x ? -1 : 1; // puste zawsze na końcu
      const wynik = liczbowo ? x.v - y.v : kolator.compare(x.t, y.t);
      return wynik * kier || a - b;
    });
    return kolejnosc.map((i) => wiersze[i]);
  }

  const strzalkaSort = (kier) => '<svg class="strzalka-sort" viewBox="0 0 10 14" aria-hidden="true">' +
    (kier !== 'mal' ? '<path d="M5 1 9 5.5H1z" class="' + (kier === 'ros' ? 'wl' : '') + '"/>' : '') +
    (kier !== 'ros' ? '<path d="M5 13 1 8.5h8z" class="' + (kier === 'mal' ? 'wl' : '') + '"/>' : '') + '</svg>';

  function tabela(id, nazwa, naglowki, wiersze, opcje = {}) {
    // wiersze: [{komorki:[html...], dane:[surowe do Excela], sort?:[klucze], klasa, akcja, akcjeHtml}]
    const posortowane = posortuj(id, naglowki, wiersze);
    tabele[id] = { nazwa, naglowki: opcje.naglowkiXls || naglowki, wiersze: posortowane.map((w) => w.dane) };
    if (!wiersze.length) return '<div class="pusto">' + (opcje.pusto || 'Brak pozycji') + '</div>';
    const liczbowe = opcje.liczbowe || [];
    const s = app.sortowanie[id];
    const pokazane = opcje.limit ? posortowane.slice(0, opcje.limit) : posortowane;
    const th = naglowki.map((h, i) => {
      const akt = !!s && s.kol === h;
      const kl = liczbowe.includes(i) ? 'l' : '';
      if (!h || (opcje.bezSortowania || []).includes(i)) return '<th class="' + kl + '">' + esc(h) + '</th>';
      return '<th class="' + kl + '"' + (akt ? ' aria-sort="' + (s.mal ? 'descending' : 'ascending') + '"' : '') + '><button type="button" class="sortuj' + (akt ? ' aktywna' : '') + '" data-a="sortuj" data-t="' + esc(id) + '" data-k="' + esc(h) + '" aria-label="' + esc(h) + ': ' + (akt ? (s.mal ? 'sortowanie malejące – kliknij, żeby wrócić do domyślnej kolejności' : 'sortowanie rosnące – kliknij, żeby posortować malejąco') : 'kliknij, żeby posortować rosnąco') + '"><span>' + esc(h) + '</span>' + strzalkaSort(akt ? (s.mal ? 'mal' : 'ros') : '') + '</button></th>';
    }).join('');
    return '<div class="tabela-owijka' + (opcje.owijka ? ' ' + opcje.owijka : '') + '"><table class="tabela"><thead><tr>' + th + (opcje.akcje ? '<th></th>' : '') + '</tr></thead><tbody>' +
      pokazane.map((w) => '<tr class="' + (w.klasa || '') + '"' + (w.akcja ? ' data-a="' + w.akcja + '" tabindex="0"' : '') + '>' + w.komorki.map((k, i) => '<td class="' + (liczbowe.includes(i) ? 'l' : '') + (opcje.klasyKolumn && opcje.klasyKolumn[i] ? ' ' + opcje.klasyKolumn[i] : '') + '">' + k + '</td>').join('') + (opcje.akcje ? '<td class="akcje-wiersza">' + (w.akcjeHtml || '') + '</td>' : '') + '</tr>').join('') +
      '</tbody></table></div>' +
      (pokazane.length < posortowane.length ? '<p class="szary maly">Pokazano ' + fmtL(pokazane.length) + ' z ' + fmtL(posortowane.length) + ' – zawęź wyszukiwanie.' + (opcje.eksportWszystkich ? ' Eksport do Excela zawiera wszystkie.' : '') + '</p>' : '');
  }

  const przyciskEksportu = (id) => '<button class="przycisk" data-a="eksport" data-t="' + id + '" data-tip="' + esc(P.TIPY.eksport) + '">' + ikona('xls') + 'Eksport do Excela</button>';
  const maKarte = (m) => !!(m && (m.link || m.kartaPlik));
  const przyciskKarty = (modelId, z_tekstem) => {
    const m = app.st.modele.get(modelId);
    if (!maKarte(m)) return '';
    return '<button class="karta-btn' + (z_tekstem ? ' z-tekstem' : '') + '" data-a="karta" data-m="' + esc(modelId) + '" data-tip="Otwórz kartę katalogową' + (m.kartaPlik ? ' (plik PDF w folderze)' : '') + '" aria-label="Karta katalogowa">' + ikona('karta') + (z_tekstem ? 'Karta katalogowa' : '') + '</button>';
  };

  // ------------------------------------------------------------ ekrany wejściowe

  function ekranStartowy() {
    const wspiera = 'showDirectoryPicker' in window;
    return '<div class="start"><div class="karta-startowa">' +
      '<img src="' + (LOGO.jasne || '') + '" alt="maasck" class="logo-start">' +
      '<h1>Magazyn</h1><p class="szary">Ewidencja urządzeń i materiałów instalacyjnych</p>' +
      (wspiera
        ? '<button class="przycisk glowny duzy" data-a="wybierzFolder">' + ikona('folder') + 'Wybierz folder „Magazyn AV”</button>' +
          (app.zapamietanyFolder ? '<button class="przycisk duzy" data-a="polaczPonownie">' + ikona('odsw') + 'Połącz ponownie z „' + esc(app.zapamietanyFolder.name) + '”</button>' : '') +
          '<p class="maly szary">Wskaż folder na firmowym OneDrive (zsynchronizowany na tym komputerze). Pusty folder zostanie przygotowany automatycznie.</p>'
        : '<div class="alert ostrz">Ta przeglądarka nie potrafi zapisywać plików w folderze. Otwórz plik <b>Magazyn.html</b> w <b>Microsoft Edge</b> lub <b>Google Chrome</b> na komputerze.</div>') +
      '<div class="separator"><span>albo</span></div>' +
      '<button class="przycisk duzy" data-a="demo">Wypróbuj na danych przykładowych</button>' +
      '<p class="maly szary">Tryb demonstracyjny nic nie zapisuje. PIN użytkowników przykładowych: 1234.</p>' +
      '<button class="przycisk tekstowy" data-a="pomocStart">' + ikona('pomoc') + 'Jak to działa?</button>' +
      '</div><p class="stopka-start">MAASCK · ' + FIRMA.www + ' · wersja ' + esc(WERSJA) + '</p></div>';
  }

  const inicjaly = (u) => esc((u.imie[0] || '') + (u.nazwisko[0] || ''));

  function ekranUzytkownika() {
    const ostatni = app.ostatniUzytkownik;
    const aktywni = Array.from(app.st.uzytkownicy.values()).filter((u) => u.aktywny !== false)
      .sort((a, b) => (b.userId === ostatni) - (a.userId === ostatni) || (a.nazwisko + a.imie).localeCompare(b.nazwisko + b.imie, 'pl'));
    const wszyscy = app.st.uzytkownicy.size;
    return '<div class="start"><div class="karta-startowa">' +
      '<img src="' + (LOGO.jasne || '') + '" alt="maasck" class="logo-start">' +
      '<h1>Zaloguj się</h1>' +
      '<p class="szary">Folder: <b>' + esc(app.store.nazwa) + '</b>' + (app.demo ? ' · tryb demonstracyjny (PIN 1234)' : '') + '</p>' +
      (aktywni.length
        ? '<p class="maly szary">Wybierz siebie i wpisz swój PIN.</p><div class="lista-osob">' + aktywni.map((u) => '<button class="osoba" data-a="wybierzOsobe" data-id="' + esc(u.userId) + '"><span class="awatar">' + inicjaly(u) + '</span><span>' + esc(u.imie + ' ' + u.nazwisko) + '</span>' + (u.userId === ostatni ? '<span class="znaczek">ostatnio</span>' : '') + ikona('klodka') + '</button>').join('') + '</div>'
        : '<div class="alert info">To nowy, pusty folder. Dodaj pierwszego użytkownika – wpiszesz imię, nazwisko i własny PIN.</div>') +
      (wszyscy
        ? '<p class="maly szary">Nie ma Cię na liście? Poproś kogoś z zespołu, żeby dodał Cię w <b>Ustawieniach</b>. Przy pierwszym logowaniu ustawisz własny PIN.</p>'
        : '<button class="przycisk glowny" data-a="nowyUzytkownik">' + ikona('plus') + 'Dodaj pierwszego użytkownika</button>') +
      '<button class="przycisk tekstowy" data-a="zmienFolder">Inny folder</button>' +
      '</div></div>';
  }

  function ekranBlokady() {
    const u = app.user;
    const blok = sekundyBlokady(u.userId);
    return '<div class="start"><form class="karta-startowa blokada" data-formularz="odblokuj" autocomplete="off">' +
      '<img src="' + (LOGO.jasne || '') + '" alt="maasck" class="logo-start">' +
      '<div class="kto-blokada"><span class="awatar duzy">' + inicjaly(u) + '</span><div><h1>' + esc(u.imie + ' ' + u.nazwisko) + '</h1><p class="szary">' + ikona('klodka') + ' Ekran zablokowany. Wpisz PIN, żeby wrócić – niezapisana praca czeka.</p></div></div>' +
      '<label class="pole"><span>PIN</span><input name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" class="pin" autofocus' + (blok ? ' disabled' : '') + '></label>' +
      '<div class="alert blad"' + (blok ? '' : ' hidden') + ' data-blad-blokady>' + (blok ? 'Za dużo błędnych prób. Spróbuj za ' + blok + ' s.' : '') + '</div>' +
      '<button class="przycisk glowny" type="submit">' + ikona('klodka') + 'Odblokuj</button>' +
      '<button class="przycisk tekstowy" type="button" data-a="wyloguj">To nie ja – zmień osobę</button>' +
      '</form></div>';
  }

  // ------------------------------------------------------------ układ

  const MENU = [
    ['pulpit', 'Pulpit', 'pulpit'],
    ['stan', 'Stan magazynu', 'stan'],
    ['lokalizacje', 'Lokalizacje', 'lok'],
    ['urzadzenia', 'Urządzenia', 'urz'],
    ['dokumenty', 'Dokumenty', 'dok'],
    ['uzupelnienia', 'Do uzupełnienia', 'uzup'],
    ['raporty', 'Raporty', 'rap'],
    ['-'],
    ['projekty', 'Projekty', 'proj'],
    ['kartoteka', 'Kartoteka modeli', 'kart'],
    ['klienci', 'Klienci', 'kli'],
    ['dostawcy', 'Dostawcy', 'dost'],
    ['dziennik', 'Dziennik zmian', 'dz'],
    ['problemy', 'Kontrola spójności', 'prob'],
    ['ustawienia', 'Ustawienia', 'ust'],
    ['pomoc', 'Pomoc i instrukcja', 'pomoc'],
  ];

  function liczniki() {
    return {
      uzupelnienia: app.st.uzupelnienia.filter((u) => !u.zamkniete).length,
      problemy: app.st.problemy.length,
    };
  }

  function uklad(tresc) {
    const l = liczniki();
    const u = app.user;
    return '<div class="uklad">' +
      '<aside class="boczny">' +
        '<div class="marka"><img src="' + (LOGO.ciemne || '') + '" alt="maasck"><span>Magazyn</span></div>' +
        '<div class="szybkie">' +
          '<button class="przycisk akcent" data-a="nowyDok" data-r="PZ" data-tip="' + esc(P.TIPY.PZ) + '" data-tip-strona="prawo">' + ikona('przyj') + 'Przyjęcie</button>' +
          '<button class="przycisk akcent" data-a="nowyDok" data-r="WZ" data-tip="' + esc(P.TIPY.WZ) + '" data-tip-strona="prawo">' + ikona('wyd') + 'Wydanie</button>' +
          '<button class="przycisk" data-a="nowyDok" data-r="ZW" data-tip="' + esc(P.TIPY.ZW) + '" data-tip-strona="prawo">' + ikona('zwrot') + 'Zwrot</button>' +
        '</div>' +
        '<nav>' + MENU.map((m) => {
          if (m[0] === '-') return '<hr>';
          const licznik = m[0] === 'uzupelnienia' && l.uzupelnienia ? '<span class="licznik czerwony">' + l.uzupelnienia + '</span>' : m[0] === 'problemy' && l.problemy ? '<span class="licznik">' + l.problemy + '</span>' : '';
          return '<a href="#' + m[0] + '" class="' + (app.widok === m[0] ? 'aktywny' : '') + '" data-a="idz" data-w="' + m[0] + '" data-tip="' + esc(P.TIPY[m[0]] || '') + '" data-tip-strona="prawo">' + ikona(m[2]) + '<span>' + m[1] + '</span>' + licznik + '</a>';
        }).join('') + '</nav>' +
        '<div class="wersja">wersja ' + esc(WERSJA) + '</div>' +
      '</aside>' +
      '<main class="glowna">' +
        '<header class="gora">' +
          (app.demo ? '<span class="znaczek demo">Tryb demonstracyjny – nic nie jest zapisywane</span>' : '<span class="szary maly">' + ikona('folder') + ' ' + esc(app.store.nazwa) + ' · odczyt ' + (app.ostatniOdczyt ? fmtCzas(app.ostatniOdczyt.toISOString()).slice(11) : '') + '</span>') +
          '<span class="odstep"></span>' +
          '<button class="przycisk tekstowy" data-a="odswiez" data-tip="' + esc(P.TIPY.odswiez) + '">' + ikona('odsw') + 'Odśwież</button>' +
          '<button class="przycisk tekstowy" data-a="idz" data-w="pomoc" data-tip="Instrukcja obsługi (F1)">' + ikona('pomoc') + 'Pomoc</button>' +
          '<button class="przycisk tekstowy" data-a="zablokuj" data-tip="Zablokuj ekran, gdy odchodzisz od komputera. Wrócisz PIN-em, a niezapisana praca zostanie.">' + ikona('klodka') + 'Zablokuj</button>' +
          '<button class="uzytkownik" data-a="konto" data-tip="Twoje konto: profil, zmiana PIN-u, wylogowanie."><span class="awatar">' + inicjaly(u) + '</span>' + esc(u.imie + ' ' + u.nazwisko) + '</button>' +
        '</header>' +
        '<div class="zawartosc">' + tresc + '</div>' +
      '</main></div>';
  }

  function naglowekWidoku(tytul, podtytul, przyciski, tip) {
    return '<div class="naglowek-widoku"><div><h1>' + tytul + (tip ? ' ' + pomoc(tip) : '') + '</h1>' + (podtytul ? '<p class="szary">' + podtytul + '</p>' : '') + '</div><div class="przyciski">' + (przyciski || '') + '</div></div>';
  }

  // ------------------------------------------------------------ widoki

  const WIDOKI = {};

  WIDOKI.pulpit = () => {
    const stany = C.stanyModeli(app.st);
    const naStanie = stany.reduce((s, w) => s + (w.model.seryjny ? w.razem : 0), 0);
    const ponizej = stany.filter((w) => w.ponizejMin);
    const docs = C.dokumentyLista(app.st);
    const bezSkanu = docs.filter((d) => !d.anulowany && !d.skany.length);
    const otwarte = app.st.uzupelnienia.filter((u) => !u.zamkniete);
    const miesiac = dzis().slice(0, 7);
    const wydaniaMiesiac = docs.filter((d) => !d.anulowany && (d.ev.dane.rodzaj === 'WZ' || d.ev.dane.rodzaj === 'WZZ') && String(d.ev.dane.data || d.ev.ts).slice(0, 7) === miesiac).length;
    const bezBo = !docs.some((d) => d.ev.dane.rodzaj === 'BO');
    const kafel = (ik, n, opis, akcja, klasa) => '<button class="kafel ' + (klasa || '') + '" ' + akcja + '><span class="kafel-ik">' + ikona(ik) + '</span><b>' + fmtL(n) + '</b><span>' + opis + '</span></button>';
    const idz = (w) => 'data-a="idz" data-w="' + w + '"';
    const raport = (r) => 'data-a="idzRaport" data-r="' + r + '"';
    const godzina = new Date().getHours();
    const powitanie = godzina < 18 ? 'Dzień dobry' : 'Dobry wieczór';
    return naglowekWidoku(powitanie + '!', esc(app.user.imie + ' ' + app.user.nazwisko) + ' · stan na ' + fmtCzas(new Date().toISOString()), '', 'pulpit') +
      (bezBo ? '<section class="karta pierwsze-kroki"><h2>Pierwsze kroki</h2><ol>' +
        '<li><b>Inwentaryzacja.</b> Spiszcie wszystko, co leży w magazynie, dokumentem <b>Bilans otwarcia (BO)</b> – miejsce po miejscu. Modele dodasz do kartoteki w trakcie wpisywania.</li>' +
        '<li><b>Codzienna praca.</b> Dostawy wpisuj przyjęciem (PZ), wydania na budowę wydaniem (WZ), a nadwyżki wracające z budowy zwrotem (ZW).</li>' +
        '<li><b>Podpisy.</b> Każdy dokument wydrukuj, daj do podpisu i dołącz zdjęcie lub skan.</li></ol>' +
        '<div class="przyciski"><button class="przycisk glowny" data-a="nowyDok" data-r="BO">' + ikona('bo') + 'Rozpocznij bilans otwarcia</button><button class="przycisk" data-a="idz" data-w="pomoc">' + ikona('pomoc') + 'Instrukcja</button></div></section>' : '') +
      '<div class="kafle">' +
        kafel('kart', app.st.modele.size, odm(app.st.modele.size, 'model w kartotece', 'modele w kartotece', 'modeli w kartotece'), idz('kartoteka')) +
        kafel('urz', naStanie, odm(naStanie, 'urządzenie w magazynie', 'urządzenia w magazynie', 'urządzeń w magazynie'), idz('urzadzenia')) +
        kafel('wyd', wydaniaMiesiac, odm(wydaniaMiesiac, 'wydanie w tym miesiącu', 'wydania w tym miesiącu', 'wydań w tym miesiącu'), idz('dokumenty')) +
        kafel('uzup', otwarte.length, odm(otwarte.length, 'pozycja do uzupełnienia', 'pozycje do uzupełnienia', 'pozycji do uzupełnienia') + ' po WZZ', idz('uzupelnienia'), otwarte.length ? 'czerwony' : '') +
        kafel('dok', bezSkanu.length, odm(bezSkanu.length, 'dokument bez podpisu', 'dokumenty bez podpisu', 'dokumentów bez podpisu'), raport('podpis'), bezSkanu.length ? 'pomaranczowy' : '') +
        kafel('rap', ponizej.length, odm(ponizej.length, 'model poniżej minimum', 'modele poniżej minimum', 'modeli poniżej minimum'), raport('minimum'), ponizej.length ? 'pomaranczowy' : '') +
        (app.st.problemy.length ? kafel('prob', app.st.problemy.length, odm(app.st.problemy.length, 'uwaga kontroli spójności', 'uwagi kontroli spójności', 'uwag kontroli spójności'), idz('problemy'), 'pomaranczowy') : '') +
      '</div>' +
      '<div class="dwie-kolumny"><section class="karta"><div class="karta-naglowek"><h2>Ostatnie dokumenty</h2><a href="#dokumenty" data-a="idz" data-w="dokumenty">Wszystkie dokumenty →</a></div>' + listaDokumentow(docs.slice(0, 8), 'pulpitDok', true) + '</section>' +
      '<section class="karta"><h2>Szybkie akcje</h2><div class="szybkie-duze">' +
        '<button class="akcja-duza" data-a="nowyDok" data-r="PZ">' + ikona('przyj') + '<b>Przyjęcie (PZ)</b><span>Dostawa od dostawcy, także pod projekt</span></button>' +
        '<button class="akcja-duza" data-a="nowyDok" data-r="WZ">' + ikona('wyd') + '<b>Wydanie (WZ / WZZ)</b><span>Sprzęt jedzie do klienta na projekt</span></button>' +
        '<button class="akcja-duza" data-a="nowyDok" data-r="ZW">' + ikona('zwrot') + '<b>Zwrot (ZW)</b><span>Nadwyżki i niewykorzystany sprzęt z budowy</span></button>' +
        '<button class="akcja-duza" data-a="nowyDok" data-r="BO">' + ikona('bo') + '<b>Bilans otwarcia (BO)</b><span>Inwentaryzacja startowa</span></button>' +
      '</div></section></div>';
  };

  function znacznikDok(d) {
    const r = d.ev.dane.rodzaj;
    let s = '<span class="znaczek r-' + r + '">' + r + '</span>';
    if (d.anulowany) s += ' <span class="znaczek anul">anulowany</span>';
    else if (!d.skany.length) s += ' <span class="znaczek brak">brak podpisu</span>';
    return s;
  }

  function listaDokumentow(docs, id, kompakt) {
    const wiersze = docs.map((d) => {
      const x = d.ev.dane;
      const komorki = ['<b class="nowrap">' + esc(x.numer) + '</b>', znacznikDok(d), '<span class="nowrap">' + fmtData(x.data || d.ev.ts) + '</span>', projHtml(x.projekt), esc(x.klientNazwa || x.dostawca || '')];
      const dane = [x.numer, C.RODZAJE[x.rodzaj].nazwa + (d.anulowany ? ' (anulowany)' : ''), fmtData(x.data || d.ev.ts), x.projekt || '', projNazwa(x.projekt), x.klientNazwa || x.dostawca || ''];
      if (!kompakt) {
        komorki.push((x.pozycje || []).length, esc(osoba(d.ev.autor)));
        dane.push((x.pozycje || []).length, osoba(d.ev.autor));
      }
      return { klasa: (d.anulowany ? 'anulowany ' : '') + (x.rodzaj === 'WZZ' ? 'wzz' : ''), akcja: 'pokazDok" data-id="' + d.ev.id, komorki, dane };
    });
    const nagl = ['Numer', 'Rodzaj', 'Data', 'Projekt', 'Klient / dostawca'].concat(kompakt ? [] : ['Pozycje', 'Wystawił']);
    const naglXls = ['Numer', 'Rodzaj', 'Data', 'Projekt', 'Nazwa projektu', 'Klient / dostawca'].concat(kompakt ? [] : ['Pozycje', 'Wystawił']);
    return tabela(id, 'Dokumenty', nagl, wiersze, { pusto: 'Nie ma jeszcze dokumentów', liczbowe: kompakt ? [] : [5], naglowkiXls: naglXls });
  }

  function poleSzukaj(klucz, placeholder) {
    return '<label class="szukaj">' + ikona('szuk') + '<input type="search" placeholder="' + esc(placeholder || 'Szukaj…') + '" value="' + esc(app.filtr[klucz] || '') + '" data-filtr="' + klucz + '"></label>';
  }
  const pasuje = (klucz, ...teksty) => C.pasujeDo(app.filtr[klucz] || '', ...teksty);

  WIDOKI.stan = () => {
    const kat = app.filtr.stanKat || '';
    const tylkoMin = !!app.filtr.stanMin;
    const stany = C.stanyModeli(app.st)
      .filter((w) => (!kat || w.model.kategoria === kat) && (!tylkoMin || w.ponizejMin) && pasuje('stan', w.model.producent, w.model.model, w.model.pn, w.model.kategoria))
      .sort((a, b) => (a.model.kategoria + a.model.producent + a.model.model).localeCompare(b.model.kategoria + b.model.producent + b.model.model, 'pl'));
    const wiersze = stany.map((w) => {
      const m = w.model;
      return {
        klasa: w.ponizejMin ? 'ostrz' : '',
        akcja: 'pokazModel" data-id="' + m.modelId,
        komorki: [esc(m.kategoria || ''), '<b>' + esc((m.producent ? m.producent + ' ' : '') + m.model) + '</b>' + (m.status === 'EOL' ? ' <span class="znaczek eol">EOL</span>' : m.status === 'wycofany' ? ' <span class="znaczek anul">wycofany</span>' : '') + przyciskKarty(m.modelId), esc(m.pn || ''), fmtIl(m.modelId, w.wolne), w.podProjekt ? fmtIl(m.modelId, w.podProjekt) : '<span class="szary">–</span>', '<b>' + fmtIl(m.modelId, w.razem) + '</b>', w.wydane ? fmtIl(m.modelId, w.wydane) : '<span class="szary">–</span>', m.stanMin ? fmtL(m.stanMin) : ''],
        dane: [m.kategoria || '', (m.producent ? m.producent + ' ' : '') + m.model, m.pn || '', w.wolne, w.podProjekt, w.razem, w.wydane, Number(m.stanMin) || null, jmw(m.jednostka), m.status || 'aktywny'],
      };
    });
    const html = tabela('stan', 'Stan magazynu', ['Kategoria', 'Model', 'Kod producenta', 'Wolne', 'Pod projekty', 'Razem', 'U klientów', 'Min.'], wiersze, {
      liczbowe: [3, 4, 5, 6, 7],
      naglowkiXls: ['Kategoria', 'Model', 'Kod producenta', 'Wolne', 'Pod projekty', 'Razem w magazynie', 'Wydane do klientów', 'Stan minimalny', 'Jednostka', 'Status'],
      pusto: app.st.modele.size ? 'Nic nie pasuje do filtra' : 'Kartoteka jest pusta. Dodaj modele w kartotece albo od razu w dokumencie przyjęcia.',
    });
    return naglowekWidoku('Stan magazynu', 'Wolne + kupione pod projekty = razem w magazynie. Kliknij wiersz, aby zobaczyć szczegóły.', przyciskEksportu('stan'), 'stan') +
      '<div class="filtry">' + poleSzukaj('stan', 'Szukaj modelu, producenta, kodu…') +
        '<select data-filtr="stanKat"><option value="">Wszystkie kategorie</option>' + C.KATEGORIE.map((k) => '<option ' + (k === kat ? 'selected' : '') + '>' + esc(k) + '</option>').join('') + '</select>' +
        '<label class="przelacznik"><input type="checkbox" data-filtr="stanMin" ' + (tylkoMin ? 'checked' : '') + '> tylko poniżej minimum</label>' +
      '</div>' + html;
  };

  WIDOKI.lokalizacje = () => {
    const wiersze = C.wierszeMagazynu(app.st)
      .filter((w) => pasuje('lok', w.lok, nazwaModelu(w.modelId), w.sn, w.projekt, projNazwa(w.projekt), model(w.modelId).pn))
      .sort((a, b) => (a.lok + nazwaModelu(a.modelId) + a.sn).localeCompare(b.lok + nazwaModelu(b.modelId) + b.sn, 'pl'));
    const html = tabela('lokalizacje', 'Lokalizacje', ['Lokalizacja', 'Model', 'Nr seryjny', 'Ilość', 'Pod projekt', 'Stan techniczny'], wiersze.map((w) => ({
      komorki: ['<b>' + esc(w.lok) + '</b>', esc(nazwaModelu(w.modelId)), esc(w.sn || ''), fmtIl(w.modelId, w.ilosc), znaczekProj(w.projekt), esc(w.stanTech || '')],
      dane: [w.lok, nazwaModelu(w.modelId), w.sn || '', w.ilosc, w.projekt || '', projNazwa(w.projekt), w.stanTech || ''],
      akcjeHtml: '<button class="przycisk maly" data-tip="' + esc(P.TIPY.przenies) + '" data-a="przenies" data-m="' + esc(w.modelId) + '" data-sn="' + esc(w.sn) + '" data-lok="' + esc(w.lok) + '" data-p="' + esc(w.projekt) + '" data-il="' + w.ilosc + '">Przenieś</button>',
    })), { akcje: true, liczbowe: [3], pusto: 'Magazyn jest pusty', naglowkiXls: ['Lokalizacja', 'Model', 'Nr seryjny', 'Ilość', 'Pod projekt', 'Nazwa projektu', 'Stan techniczny'] });
    return naglowekWidoku('Lokalizacje', 'Co leży w którym miejscu. „Przenieś” zmienia półkę bez formularza – zmiana trafia do dziennika.', przyciskEksportu('lokalizacje'), 'lokalizacje') +
      '<div class="filtry">' + poleSzukaj('lok', 'Szukaj: lokalizacja, model, nr seryjny, projekt (numer lub nazwa)…') + '</div>' + html;
  };

  WIDOKI.urzadzenia = () => {
    const status = app.filtr.urzStatus || '';
    const lista = Array.from(app.st.egzemplarze.values())
      .filter((e) => (!status || e.status === status) && pasuje('urz', e.sn, nazwaModelu(e.modelId), e.lok, e.projekt, projNazwa(e.projekt), e.klient, e.projektZakupu, projNazwa(e.projektZakupu), model(e.modelId).pn))
      .sort((a, b) => (nazwaModelu(a.modelId) + a.sn).localeCompare(nazwaModelu(b.modelId) + b.sn, 'pl'));
    const html = tabela('urzadzenia', 'Urządzenia', ['Model', 'Nr seryjny', 'Status', 'Gdzie', 'Pod projekt', 'Stan techniczny', 'Przyjęto'], lista.map((e) => ({
      akcja: 'historia" data-m="' + esc(e.modelId) + '" data-sn="' + esc(e.sn),
      komorki: [esc(nazwaModelu(e.modelId)), '<b class="mono">' + esc(e.sn) + '</b>', e.status === 'magazyn' ? '<span class="znaczek ok">w magazynie</span>' : '<span class="znaczek wyd">u klienta</span>', e.status === 'magazyn' ? esc(e.lok) : projHtml(e.projekt) + (e.klient ? '<small class="szary blok">' + esc(e.klient) + '</small>' : ''), znaczekProj(e.projektZakupu), esc(e.stanTech || ''), esc(e.przyjeto ? e.przyjeto.numer : '')],
      dane: [nazwaModelu(e.modelId), e.sn, e.status === 'magazyn' ? 'w magazynie' : 'u klienta', e.status === 'magazyn' ? e.lok : projTekst(e.projekt) + (e.klient ? ' · ' + e.klient : ''), e.projektZakupu ? projTekst(e.projektZakupu) : '', e.stanTech || '', e.przyjeto ? e.przyjeto.numer : ''],
    })), { pusto: 'Brak urządzeń z numerami seryjnymi' });
    return naglowekWidoku('Urządzenia', 'Każde urządzenie śledzone po numerze seryjnym. Kliknij, aby zobaczyć historię.', przyciskEksportu('urzadzenia'), 'urzadzenia') +
      '<div class="filtry">' + poleSzukaj('urz', 'Szukaj: nr seryjny, model, projekt (numer lub nazwa), klient…') +
      '<select data-filtr="urzStatus"><option value="">Wszystkie</option><option value="magazyn" ' + (status === 'magazyn' ? 'selected' : '') + '>W magazynie</option><option value="wydany" ' + (status === 'wydany' ? 'selected' : '') + '>U klienta</option></select></div>' + html;
  };

  WIDOKI.dokumenty = () => {
    const rodzaj = app.filtr.dokRodzaj || '';
    const docs = C.dokumentyLista(app.st).filter((d) => {
      const x = d.ev.dane;
      if (rodzaj === 'bezpodpisu') { if (d.anulowany || d.skany.length) return false; }
      else if (rodzaj && x.rodzaj !== rodzaj) return false;
      return pasuje('dok', x.numer, x.projekt, projNazwa(x.projekt), x.klientNazwa, x.dostawca, x.nrFaktury, x.osoba, x.uwagi, (x.pozycje || []).map((p) => nazwaModelu(p.modelId) + ' ' + (p.sn || '') + ' ' + (p.projekt ? projTekst(p.projekt) : '')).join(' '));
    });
    return naglowekWidoku('Dokumenty', 'Kliknij dokument, aby go wydrukować, dołączyć skan podpisu albo anulować.', przyciskEksportu('dokumenty'), 'dokumenty') +
      '<div class="filtry">' + poleSzukaj('dok', 'Szukaj: numer, projekt (numer lub nazwa), klient, dostawca, nr seryjny…') +
      '<select data-filtr="dokRodzaj"><option value="">Wszystkie rodzaje</option>' + Object.entries(C.RODZAJE).map(([k, v]) => '<option value="' + k + '" ' + (rodzaj === k ? 'selected' : '') + '>' + k + ' – ' + v.nazwa + '</option>').join('') + '<option value="bezpodpisu" ' + (rodzaj === 'bezpodpisu' ? 'selected' : '') + '>Bez dołączonego podpisu</option></select></div>' +
      listaDokumentow(docs, 'dokumenty');
  };

  WIDOKI.uzupelnienia = () => {
    const pokazZamkniete = !!app.filtr.uzupWszystkie;
    const lista = app.st.uzupelnienia.filter((u) => pokazZamkniete || !u.zamkniete).slice().reverse();
    const html = tabela('uzupelnienia', 'Do uzupełnienia', ['Projekt zakupu (brakuje)', 'Model', 'Nr seryjny / ilość', 'Wydano na projekt', 'Dokument', 'Data', 'Powód', 'Status'], lista.map((u) => ({
      klasa: u.zamkniete ? 'zamkniete' : 'wzz',
      komorki: ['<b>' + projHtml(u.projektZakupu) + '</b>', esc(nazwaModelu(u.modelId)), u.sn ? '<span class="mono">' + esc(u.sn) + '</span>' : fmtIl(u.modelId, u.ilosc), projHtml(u.projektDocelowy), '<a href="#" data-a="pokazDok" data-id="' + esc(u.docId) + '">' + esc(u.numer) + '</a>', fmtData(u.ts), esc(u.powod), u.zamkniete ? '<span class="znaczek ok">uzupełnione</span><div class="maly szary">' + esc(u.zamknieto.uwagi || '') + '</div>' : '<span class="znaczek brak">do uzupełnienia</span>'],
      dane: [projTekst(u.projektZakupu), nazwaModelu(u.modelId), u.sn || u.ilosc + ' ' + jedn(u.modelId), projTekst(u.projektDocelowy), u.numer, fmtData(u.ts), u.powod, u.zamkniete ? 'uzupełnione: ' + (u.zamknieto.uwagi || '') : 'do uzupełnienia'],
      akcjeHtml: u.zamkniete ? '' : '<button class="przycisk maly" data-a="uzupelnij" data-id="' + esc(u.docId) + '" data-idx="' + u.idx + '">Uzupełnione…</button>',
    })), { akcje: true, pusto: pokazZamkniete ? 'Brak wydań zastępczych' : 'Nic nie czeka na uzupełnienie' });
    return naglowekWidoku('Do uzupełnienia', 'Sprzęt kupiony pod projekt, który poszedł wydaniem zastępczym (WZZ) na inny projekt. Trzeba go dokupić pod projekt zakupu.', przyciskEksportu('uzupelnienia'), 'uzupelnienia') +
      '<div class="filtry"><label class="przelacznik"><input type="checkbox" data-filtr="uzupWszystkie" ' + (pokazZamkniete ? 'checked' : '') + '> pokaż także uzupełnione</label></div>' + html;
  };

  WIDOKI.raporty = () => {
    const rap = app.filtr.raport || 'projekt';
    const zakladki = [['projekt', 'Wydane na projekt'], ['klient', 'Wydane do klienta'], ['podprojekt', 'Pod projekt w magazynie'], ['minimum', 'Poniżej minimum'], ['eol', 'EOL na stanie'], ['podpis', 'Bez podpisu'], ['historia', 'Historia urządzenia']];
    let tresc = '';
    if (rap === 'projekt' || rap === 'klient') {
      const wartosc = app.filtr['rap_' + rap] || '';
      const dokladny = rap === 'projekt' && C.projektWgNumeru(app.st, wartosc) || rap === 'projekt' && C.podpowiedzi(app.st).projekty.some((x) => C.normKlucz(x) === C.normKlucz(wartosc));
      let w = C.wydaneNaProjekt(app.st, dokladny ? wartosc : '');
      if (!dokladny && wartosc) w = w.filter((x) => rap === 'projekt' ? C.pasujeDo(wartosc, x.projekt, projNazwa(x.projekt)) : C.pasujeDo(wartosc, x.klient));
      const tytul = rap === 'projekt' ? 'Wydane na projekt ' + (wartosc ? (dokladny ? projTekst(wartosc) : '„' + wartosc + '”') : '(wszystkie)') : 'Wydane do klienta ' + (wartosc || '(wszyscy)');
      tresc = '<div class="filtry">' + pole(rap === 'projekt' ? 'Projekt' : 'Klient', wybierak(rap === 'projekt' ? 'projekty' : 'klienci', 'filtr:rap_' + rap, wartosc, { placeholder: rap === 'projekt' ? 'wszystkie – wpisz numer albo nazwę' : 'wszyscy – wpisz nazwę' }), 'wiersz filtr-wyboru') + '</div>' +
        tabela('raport', tytul, ['Projekt', 'Klient', 'Model', 'Nr seryjny', 'Ilość', 'Dokument'], w.sort((a, b) => (a.projekt + nazwaModelu(a.modelId)).localeCompare(b.projekt + nazwaModelu(b.modelId), 'pl')).map((x) => ({
          komorki: [projHtml(x.projekt), esc(x.klient), esc(nazwaModelu(x.modelId)), '<span class="mono">' + esc(x.sn) + '</span>', fmtIl(x.modelId, x.ilosc), esc(x.numer || '')],
          dane: [x.projekt, projNazwa(x.projekt), x.klient, nazwaModelu(x.modelId), x.sn, x.ilosc, x.numer || ''],
        })), { liczbowe: [4], pusto: 'Nic nie zostało wydane', naglowkiXls: ['Projekt', 'Nazwa projektu', 'Klient', 'Model', 'Nr seryjny', 'Ilość', 'Dokument'] });
    } else if (rap === 'podprojekt') {
      const w = C.wierszeMagazynu(app.st).filter((x) => x.projekt).sort((a, b) => (a.projekt + nazwaModelu(a.modelId)).localeCompare(b.projekt + nazwaModelu(b.modelId), 'pl'));
      tresc = tabela('raport', 'Kupione pod projekt – w magazynie', ['Projekt', 'Model', 'Nr seryjny', 'Ilość', 'Lokalizacja'], w.map((x) => ({
        komorki: ['<b>' + projHtml(x.projekt) + '</b>', esc(nazwaModelu(x.modelId)), '<span class="mono">' + esc(x.sn) + '</span>', fmtIl(x.modelId, x.ilosc), esc(x.lok)],
        dane: [x.projekt, projNazwa(x.projekt), nazwaModelu(x.modelId), x.sn, x.ilosc, x.lok],
      })), { liczbowe: [3], pusto: 'Nic nie czeka w magazynie pod projekty', naglowkiXls: ['Projekt', 'Nazwa projektu', 'Model', 'Nr seryjny', 'Ilość', 'Lokalizacja'] });
    } else if (rap === 'minimum' || rap === 'eol') {
      const w = C.stanyModeli(app.st).filter((x) => (rap === 'minimum' ? x.ponizejMin : x.model.status === 'EOL' && x.razem > 0));
      tresc = tabela('raport', rap === 'minimum' ? 'Poniżej stanu minimalnego' : 'Modele EOL na stanie', ['Kategoria', 'Model', 'Kod producenta', 'W magazynie', 'Stan minimalny', 'Status'], w.map((x) => ({
        komorki: [esc(x.model.kategoria || ''), esc(nazwaModelu(x.model.modelId)), esc(x.model.pn || ''), fmtIl(x.model.modelId, x.razem), x.model.stanMin ? fmtIl(x.model.modelId, Number(x.model.stanMin)) : '', esc(x.model.status || 'aktywny')],
        dane: [x.model.kategoria || '', nazwaModelu(x.model.modelId), x.model.pn || '', x.razem, Number(x.model.stanMin) || null, x.model.status || 'aktywny'],
      })), { liczbowe: [3, 4], pusto: 'Brak pozycji' });
    } else if (rap === 'podpis') {
      tresc = listaDokumentow(C.dokumentyLista(app.st).filter((d) => !d.anulowany && !d.skany.length), 'raport');
    } else if (rap === 'historia') {
      const sn = app.filtr.rap_sn || '';
      const e = Array.from(app.st.egzemplarze.values()).filter((x) => sn && C.normKlucz(x.sn).includes(C.normKlucz(sn)));
      tresc = '<div class="filtry"><label class="pole wiersz"><span>Numer seryjny</span><input value="' + esc(sn) + '" data-filtr="rap_sn" data-natychmiast="1" placeholder="wpisz lub wklej"></label></div>' +
        (sn ? (e.length ? e.map((x) => historiaHtml(x)).join('') : '<div class="pusto">Nie znaleziono urządzenia</div>') : '<div class="pusto">Wpisz numer seryjny</div>');
      tabele.raport = { nazwa: 'Historia urządzenia', naglowki: ['Model', 'Nr seryjny', 'Data', 'Dokument', 'Opis'], wiersze: e.flatMap((x) => x.historia.map((h) => [nazwaModelu(x.modelId), x.sn, fmtCzas(h.ts), h.numer || '', h.opis])) };
    }
    return naglowekWidoku('Raporty', 'Każdy raport można wyeksportować do Excela.', przyciskEksportu('raport'), 'raporty') +
      '<div class="zakladki">' + zakladki.map(([k, n]) => '<button class="' + (rap === k ? 'aktywna' : '') + '" data-a="raport" data-r="' + k + '">' + n + '</button>').join('') + '</div>' + tresc;
  };

  function historiaHtml(e) {
    return '<section class="karta"><h3>' + esc(nazwaModelu(e.modelId)) + ' · SN <span class="mono">' + esc(e.sn) + '</span></h3>' +
      '<p>' + (e.status === 'magazyn' ? 'W magazynie: <b>' + esc(e.lok) + '</b>' : 'U klienta: <b>' + esc(e.klient) + '</b>, projekt <b>' + esc(projTekst(e.projekt)) + '</b>') + ' · stan: ' + esc(e.stanTech) + (e.projektZakupu ? ' · kupione pod projekt <b>' + esc(projTekst(e.projektZakupu)) + '</b>' : '') + '</p>' +
      '<ol class="os-czasu">' + e.historia.slice().reverse().map((h) => '<li><span class="szary">' + fmtCzas(h.ts) + '</span> ' + (h.docId ? '<a href="#" data-a="pokazDok" data-id="' + esc(h.docId) + '">' + esc(h.numer) + '</a> · ' : '') + esc(h.opis) + '</li>').join('') + '</ol></section>';
  }

  WIDOKI.kartoteka = () => {
    const lista = Array.from(app.st.modele.values()).filter((m) => pasuje('kart', m.producent, m.model, m.pn, m.ean, m.kategoria)).sort((a, b) => (a.kategoria + a.producent + a.model).localeCompare(b.kategoria + b.producent + b.model, 'pl'));
    const html = tabela('kartoteka', 'Kartoteka modeli', ['Kategoria', 'Producent', 'Model', 'Kod producenta', 'EAN', 'Nr seryjny', 'Jednostka', 'Stan min.', 'Status', 'Karta katalogowa'], lista.map((m) => ({
      akcja: 'edytujModel" data-id="' + esc(m.modelId),
      komorki: [esc(m.kategoria || ''), esc(m.producent || ''), '<b>' + esc(m.model) + '</b>', esc(m.pn || ''), esc(m.ean || ''), m.seryjny ? 'tak' : 'nie', esc(jmw(m.jednostka)) + (m.jednostkaZakupu ? ' <span class="szary">· ' + esc(m.jednostkaZakupu) + ' = ' + fmtL(m.przelicznik) + ' ' + esc(jmw(m.jednostka)) + '</span>' : ''), m.stanMin ? fmtL(m.stanMin) : '', m.status === 'EOL' ? '<span class="znaczek eol">EOL</span>' : m.status === 'wycofany' ? '<span class="znaczek anul">wycofany</span>' : '<span class="szary">aktywny</span>', maKarte(m) ? przyciskKarty(m.modelId, true) : '<span class="szary maly">brak</span>'],
      dane: [m.kategoria || '', m.producent || '', m.model, m.pn || '', m.ean || '', m.seryjny ? 'tak' : 'nie', jmw(m.jednostka), Number(m.stanMin) || null, m.status || 'aktywny', m.link || (m.kartaPlik ? 'plik: ' + m.kartaPlik : '')],
    })), { pusto: 'Kartoteka jest pusta. Dodaj pierwszy model przyciskiem „Nowy model” albo od razu w bilansie otwarcia.' });
    return naglowekWidoku('Kartoteka modeli', 'Urządzenia z gwarancją, które trafiają do klienta, śledź po numerze seryjnym. Materiały (kable, korytka) liczone są w metrach lub sztukach.', '<button class="przycisk glowny" data-a="edytujModel">' + ikona('plus') + 'Nowy model</button>' + przyciskEksportu('kartoteka'), 'kartoteka') +
      '<div class="filtry">' + poleSzukaj('kart', 'Szukaj w kartotece…') + '</div>' + html;
  };

  WIDOKI.klienci = () => {
    const lista = Array.from(app.st.klienci.values()).filter((k) => pasuje('kli', k.nazwa, k.nip, k.adres, k.kontakt)).sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'));
    const html = tabela('klienci', 'Klienci', ['Nazwa', 'NIP', 'Adres', 'Osoba kontaktowa', 'Telefon', 'E-mail'], lista.map((k) => ({
      akcja: 'edytujKlienta" data-id="' + esc(k.klientId),
      komorki: ['<b>' + esc(k.nazwa) + '</b>', esc(k.nip || ''), esc(k.adres || ''), esc(k.kontakt || ''), esc(k.tel || ''), esc(k.email || '')],
      dane: [k.nazwa, k.nip || '', k.adres || '', k.kontakt || '', k.tel || '', k.email || ''],
    })), { pusto: 'Lista klientów jest pusta. Klienta możesz też wpisać ręcznie przy wydaniu.' });
    return naglowekWidoku('Klienci', 'Lista jest pomocą, nie obowiązkiem – przy wydaniu można wpisać dowolnego klienta.', '<button class="przycisk glowny" data-a="edytujKlienta">' + ikona('plus') + 'Nowy klient</button>' + przyciskEksportu('klienci'), 'klienci') +
      '<div class="filtry">' + poleSzukaj('kli', 'Szukaj klienta…') + '</div>' + html;
  };

  WIDOKI.projekty = () => {
    const pokazZak = !!app.filtr.projZak;
    const wMag = new Map();
    for (const w of C.wierszeMagazynu(app.st)) if (w.projekt) { const k = C.normKlucz(w.projekt); wMag.set(k, (wMag.get(k) || 0) + 1); }
    const wyd = new Map();
    for (const w of C.wydaneNaProjekt(app.st, '')) { const k = C.normKlucz(w.projekt); wyd.set(k, (wyd.get(k) || 0) + 1); }
    const wszystkie = C.listaProjektow(app.st);
    const lista = wszystkie.filter((p) => (pokazZak || p.status !== 'zakończony') && pasuje('proj', p.numer, p.nazwa, p.klientNazwa, p.adres, p.uwagi));
    const bezNazwy = wszystkie.filter((p) => !p.nazwa).length;
    const brak = '<span class="szary">–</span>';
    const html = tabela('projekty', 'Projekty', ['Numer', 'Nazwa', 'Klient', 'Adres obiektu', 'Status', 'Pod projekt w magazynie', 'Wydane', 'Ostatni dokument'], lista.map((p) => {
      const k = C.normKlucz(p.numer);
      return {
        klasa: p.status === 'zakończony' ? 'zamkniete' : '',
        akcja: 'pokazProjekt" data-numer="' + esc(p.numer),
        komorki: ['<b class="nowrap">' + esc(p.numer) + '</b>', p.nazwa ? '<b>' + esc(p.nazwa) + '</b>' : '<span class="ostrz-tekst maly">bez nazwy – kliknij, żeby uzupełnić</span>', esc(p.klientNazwa || ''), esc(p.adres || ''), p.status === 'zakończony' ? '<span class="znaczek anul">zakończony</span>' : '<span class="znaczek ok">w toku</span>', wMag.get(k) ? fmtL(wMag.get(k)) + ' ' + odm(wMag.get(k), 'pozycja', 'pozycje', 'pozycji') : brak, wyd.get(k) ? fmtL(wyd.get(k)) + ' ' + odm(wyd.get(k), 'pozycja', 'pozycje', 'pozycji') : brak, p.ostatni ? '<span class="nowrap">' + fmtData(p.ostatni) + '</span>' : brak],
        dane: [p.numer, p.nazwa || '', p.klientNazwa || '', p.adres || '', p.status || 'w toku', wMag.get(k) || 0, wyd.get(k) || 0, p.ostatni ? fmtData(p.ostatni) : '', p.uwagi || ''],
      };
    }), { pusto: wszystkie.length ? 'Nic nie pasuje do wyszukiwania' : 'Nie ma jeszcze projektów. Dodaj pierwszy przyciskiem „Nowy projekt” albo wpisz numer w dokumencie – aplikacja zapyta o nazwę.', liczbowe: [5, 6], naglowkiXls: ['Numer', 'Nazwa', 'Klient', 'Adres obiektu', 'Status', 'Pozycje pod projekt w magazynie', 'Pozycje wydane', 'Ostatni dokument', 'Uwagi'] });
    return naglowekWidoku('Projekty', 'Numer i nazwa projektu, klient i adres obiektu. Kliknij projekt, żeby zobaczyć jego dokumenty i sprzęt.', '<button class="przycisk glowny" data-a="edytujProjekt">' + ikona('plus') + 'Nowy projekt</button>' + przyciskEksportu('projekty'), 'projekty') +
      (bezNazwy ? '<div class="alert info">' + bezNazwy + ' ' + odm(bezNazwy, 'projekt nie ma', 'projekty nie mają', 'projektów nie ma') + ' jeszcze nazwy. Uzupełnij ją – łatwiej będzie je znaleźć na listach.</div>' : '') +
      '<div class="filtry">' + poleSzukaj('proj', 'Szukaj: numer, nazwa, klient, adres…') + '<label class="przelacznik"><input type="checkbox" data-filtr="projZak" ' + (pokazZak ? 'checked' : '') + '> pokaż także zakończone</label></div>' + html;
  };

  WIDOKI.dostawcy = () => {
    const ukryci = !!app.filtr.dostUkryci;
    const przyjecia = new Map();
    for (const { ev, anulowany } of app.st.dokumenty.values()) {
      if (anulowany || ev.dane.rodzaj !== 'PZ') continue;
      const d = ev.dane.dostawcaId ? app.st.dostawcy.get(ev.dane.dostawcaId) : C.dostawcaWgNazwy(app.st, ev.dane.dostawca);
      if (d) przyjecia.set(d.dostawcaId, (przyjecia.get(d.dostawcaId) || 0) + 1);
    }
    const lista = Array.from(app.st.dostawcy.values()).filter((d) => (ukryci || d.aktywny !== false) && pasuje('dost', d.nazwa, d.pelnaNazwa, d.nip, d.krs, d.regon, d.adres, d.adresBiura, d.marki, d.uwagi, d.email, d.www)).sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'));
    const html = tabela('dostawcy', 'Dostawcy', ['Dostawca', 'Pełna nazwa', 'NIP', 'KRS', 'Adres', 'Marki', 'Kontakt', 'Przyjęcia'], lista.map((d) => ({
      klasa: d.aktywny === false ? 'zamkniete' : '',
      akcja: 'edytujDostawce" data-id="' + esc(d.dostawcaId),
      komorki: ['<b>' + esc(d.nazwa) + '</b>' + (d.aktywny === false ? ' <span class="znaczek anul">ukryty</span>' : '') + (d.uwagi ? '<small class="szary blok">' + esc(d.uwagi) + '</small>' : ''), '<small>' + esc(d.pelnaNazwa || '') + '</small>', '<span class="mono nowrap">' + esc(d.nip || '') + '</span>', '<span class="mono">' + esc(d.krs || '') + '</span>', esc(d.adres || '') + (d.adresBiura ? '<small class="szary blok">biuro: ' + esc(d.adresBiura) + '</small>' : ''), esc(d.marki || ''), [d.tel, d.email, d.www].filter(Boolean).map((x) => '<span class="nowrap">' + esc(x) + '</span>').join('<br>'), przyjecia.get(d.dostawcaId) || '<span class="szary">–</span>'],
      dane: [d.nazwa, d.pelnaNazwa || '', d.nip || '', d.regon || '', d.krs || '', d.adres || '', d.adresBiura || '', d.marki || '', d.tel || '', d.email || '', d.www || '', przyjecia.get(d.dostawcaId) || 0, d.zrodlo || '', d.uwagi || ''],
    })), { liczbowe: [7], pusto: 'Nic nie pasuje do wyszukiwania', naglowkiXls: ['Dostawca', 'Pełna nazwa', 'NIP', 'REGON', 'KRS', 'Adres siedziby', 'Adres biura', 'Marki', 'Telefon', 'E-mail', 'WWW', 'Przyjęcia', 'Źródło danych', 'Uwagi'] });
    return naglowekWidoku('Dostawcy', 'Biblioteka dostawców z danymi z rejestrów KRS i REGON. Przy przyjęciu wybierasz dostawcę z listy, a jego pełne dane trafiają na formularz.', '<button class="przycisk glowny" data-a="edytujDostawce">' + ikona('plus') + 'Nowy dostawca</button>' + przyciskEksportu('dostawcy'), 'dostawcy') +
      '<div class="filtry">' + poleSzukaj('dost', 'Szukaj: nazwa, NIP, marka (np. shure), miasto…') + '<label class="przelacznik"><input type="checkbox" data-filtr="dostUkryci" ' + (ukryci ? 'checked' : '') + '> pokaż ukrytych</label></div>' + html;
  };

  WIDOKI.dziennik = () => {
    const lista = app.st.zdarzenia.slice().reverse().filter((ev) => pasuje('dz', C.opisZdarzenia(app.st, ev), osoba(ev.autor), ev.typ));
    const html = tabela('dziennik', 'Dziennik zmian', ['Data i godzina', 'Kto', 'Rodzaj', 'Opis'], lista.map((ev) => {
      const opis = C.opisZdarzenia(app.st, ev);
      return {
        komorki: [fmtCzas(ev.ts), esc(osoba(ev.autor)), '<span class="znaczek">' + esc(ev.typ) + '</span>', esc(opis)],
        dane: [fmtCzas(ev.ts), osoba(ev.autor), ev.typ, opis],
        sort: [ev.ts],
      };
    }), { pusto: 'Dziennik jest pusty', limit: 500, eksportWszystkich: true });
    return naglowekWidoku('Dziennik zmian', 'Każda operacja z autorem i godziną. Nic nie jest kasowane.', przyciskEksportu('dziennik'), 'dziennik') +
      '<div class="filtry">' + poleSzukaj('dz', 'Szukaj w dzienniku…') + '</div>' + html;
  };

  WIDOKI.problemy = () => {
    const p = app.st.problemy;
    return naglowekWidoku('Kontrola spójności', 'Aplikacja sprawdza przy każdym odczycie, czy nikt nie zmienił ani nie usunął plików poza nią i czy synchronizacja nie utworzyła kopii.', '', 'problemy') +
      (p.length ? '<section class="karta"><ul class="problemy">' + p.map((x) => '<li><span class="znaczek">' + esc(x.kod) + '</span> ' + esc(x.opis) + '</li>').join('') + '</ul></section>' +
        '<div class="alert info">Najczęstsza przyczyna: OneDrive jeszcze synchronizuje pliki z innego komputera albo utworzył kopię konfliktową. Poczekaj chwilę i kliknij „Odśwież”. Jeśli uwaga zostaje, sprawdź historię wersji pliku w OneDrive.</div>'
        : '<div class="alert ok">Wszystko w porządku: ' + app.zdarzenia.length + ' plików, bez luk, zmian i konfliktów.</div>');
  };

  WIDOKI.ustawienia = () => {
    const uzytkownicy = Array.from(app.st.uzytkownicy.values()).sort((a, b) => (a.nazwisko + a.imie).localeCompare(b.nazwisko + b.imie, 'pl'));
    return naglowekWidoku('Ustawienia', 'Użytkownicy, PIN, kopie zapasowe i folder z danymi.', '', 'ustawienia') +
      '<div class="dwie-kolumny"><section class="karta"><h2>Użytkownicy</h2><p class="szary">Ról nie ma – w magazynie każdy może to samo. Każdy loguje się swoim PIN-em i tylko on zmienia swój profil. Kliknij osobę, żeby zresetować jej PIN albo wyłączyć konto.</p>' +
      tabela('uzytkownicy', 'Użytkownicy', ['Imię i nazwisko', 'E-mail', 'Telefon', 'Status'], uzytkownicy.map((u) => ({
        akcja: 'edytujUzytkownika" data-id="' + esc(u.userId),
        komorki: ['<b>' + esc(u.imie + ' ' + u.nazwisko) + '</b>' + (u.userId === app.user.userId ? ' <span class="znaczek projekt">to Ty</span>' : ''), esc(u.email || ''), esc(u.tel || ''), (u.aktywny === false ? '<span class="znaczek anul">wyłączone</span>' : '<span class="znaczek ok">aktywne</span>') + (u.pinDoZmiany && u.aktywny !== false ? ' <span class="znaczek">PIN tymczasowy</span>' : '')],
        dane: [u.imie + ' ' + u.nazwisko, u.email || '', u.tel || '', (u.aktywny === false ? 'wyłączone' : 'aktywne') + (u.pinDoZmiany ? ', PIN tymczasowy' : '')],
      }))) +
      '<div class="rzad-przyciskow"><button class="przycisk" data-a="nowyUzytkownik">' + ikona('plus') + 'Dodaj użytkownika</button><button class="przycisk" data-a="edytujUzytkownika" data-id="' + esc(app.user.userId) + '">Mój profil</button><button class="przycisk" data-a="zmienPin">Zmień mój PIN</button></div></section>' +
      '<section class="karta"><h2>Logowanie i blokada ekranu</h2>' +
        '<p class="szary">Ekran blokuje się sam, gdy nikt nie używa aplikacji. Odblokowujesz go swoim PIN-em, a niezapisany dokument czeka. Po ' + MAKS_PROB + ' błędnych PIN-ach logowanie na tę osobę wstrzymuje się na minutę.</p>' +
        '<label class="pole wiersz"><span>Blokuj ekran po</span><select data-ustawienie="blokada">' + [5, 10, 15, 30, 60, 0].map((m) => '<option value="' + m + '"' + (m === minutyBlokady() ? ' selected' : '') + '>' + (m ? m + ' min bezczynności' : 'nigdy (niezalecane)') + '</option>').join('') + '</select></label>' +
        '<p class="szary maly">To ustawienie dotyczy tylko tego komputera.</p>' +
        '<p><button class="przycisk" data-a="zablokuj">' + ikona('klodka') + 'Zablokuj teraz</button></p></section>' +
      '<section class="karta"><h2>Dane</h2>' +
        '<p>Folder: <b>' + esc(app.store.nazwa) + '</b>' + (app.demo ? ' (tryb demonstracyjny)' : '') + '<br>Plików zdarzeń: ' + app.zdarzenia.length + '<br>Ostatni odczyt: ' + (app.ostatniOdczyt ? fmtCzas(app.ostatniOdczyt.toISOString()) : '') + '</p>' +
        '<p><button class="przycisk" data-a="kopiaTeraz" ' + (app.demo ? 'disabled' : '') + '>Zrób kopię zapasową teraz</button> <button class="przycisk" data-a="pobierzBaze">Pobierz całą bazę (JSON)</button></p>' +
        '<p class="szary maly">Kopia tygodniowa zapisuje się sama do podfolderu <b>kopie</b> przy pierwszym uruchomieniu w danym tygodniu.</p>' +
        '<p><button class="przycisk tekstowy" data-a="zmienFolder">Zamknij folder i wybierz inny</button></p>' +
      '</section></div>' +
      '<section class="karta"><h2>Nagłówek formularzy</h2><div class="naglowek-firmy"><img src="' + (LOGO.jasne || '') + '" alt="maasck"><div><b>' + esc(FIRMA.nazwa) + '</b><br>' + esc(FIRMA.adres) + '<br>NIP ' + FIRMA.nip + ' · REGON ' + FIRMA.regon + ' · KRS ' + FIRMA.krs + '<br>' + FIRMA.email + ' · ' + FIRMA.www + '</div></div><p class="szary maly odstep-gora">Wersja aplikacji ' + esc(WERSJA) + '</p></section>';
  };

  function instrukcjaHtml(wybrane) {
    const sekcje = P.INSTRUKCJA.filter((x) => !wybrane || wybrane.includes(x.id));
    return sekcje.map((x) => '<section class="karta instrukcja" id="pomoc-' + x.id + '"><h2>' + esc(x.tytul) + '</h2>' + x.html + '</section>').join('');
  }

  WIDOKI.pomoc = () => {
    const rodzaje = Object.entries(C.RODZAJE).map(([k, v]) => '<tr><td><span class="znaczek r-' + k + '">' + k + '</span></td><td><b>' + esc(v.nazwa) + '</b></td><td>' + esc(P.TIPY[k] || '') + '</td></tr>').join('');
    return naglowekWidoku('Pomoc i instrukcja', 'Wszystko, co trzeba wiedzieć o pracy z magazynem. Przy każdym polu i widoku jest też znak ' + pomoc('Najedź kursorem na taki znak, żeby zobaczyć krótką podpowiedź.') + ' z krótką podpowiedzią.', '', '') +
      '<div class="uklad-pomocy"><nav class="spis" aria-label="Spis treści"><b>Spis treści</b>' + P.INSTRUKCJA.map((x) => '<a href="#pomoc-' + x.id + '" data-a="doSekcji" data-s="' + x.id + '">' + esc(x.tytul) + '</a>').join('') + '<a href="#pomoc-rodzaje" data-a="doSekcji" data-s="rodzaje">Rodzaje dokumentów</a></nav>' +
      '<div class="tresc-pomocy">' + instrukcjaHtml() +
      '<section class="karta instrukcja" id="pomoc-rodzaje"><h2>Rodzaje dokumentów</h2><div class="tabela-owijka"><table class="tabela"><tbody>' + rodzaje + '</tbody></table></div></section>' +
      '<section class="karta instrukcja"><h2>Kontakt</h2><p>' + esc(FIRMA.nazwa) + '<br>' + esc(FIRMA.adres) + '<br><a href="mailto:' + FIRMA.email + '">' + FIRMA.email + '</a> · <a href="https://' + FIRMA.www + '" target="_blank" rel="noopener">' + FIRMA.www + '</a></p><p class="szary maly">Magazyn, wersja ' + esc(WERSJA) + '</p></section>' +
      '</div></div>';
  };

  // ------------------------------------------------------------ pola wyboru z listy
  //
  // Pole tekstowe z rozwijaną listą zapisanych wartości: klik albo pisanie pokazuje listę,
  // szukanie działa po kawałku numeru, nazwy, NIP-u itd. (bez względu na ogonki),
  // strzałki + Enter wybierają. Obok – osobny przycisk „Nowy”.
  // cel: 'f:pole' (nagłówek dokumentu), 'p:nr:pole' (pozycja), 'n:nazwa' (pole w oknie), 'filtr:klucz'.

  function atrybutyCelu(cel) {
    const [typ, ...r] = cel.split(':');
    if (typ === 'f') return 'data-f="' + esc(r[0]) + '"';
    if (typ === 'p') return 'data-p="' + esc(r.join(':')) + '"';
    if (typ === 'filtr') return 'data-filtr="' + esc(r[0]) + '" data-natychmiast="1"';
    return 'name="' + esc(r[0]) + '"';
  }

  function celPola(el) {
    if (el.dataset.f) return 'f:' + el.dataset.f;
    if (el.dataset.p) return 'p:' + el.dataset.p;
    if (el.dataset.filtr) return 'filtr:' + el.dataset.filtr;
    return el.name ? 'n:' + el.name : '';
  }

  const NOWY_ETYKIETA = { projekty: 'Nowy projekt', dostawcy: 'Nowy dostawca', klienci: 'Nowy klient', modele: 'Nowy model w kartotece' };

  function wybierak(zrodlo, cel, wartosc, o = {}) {
    const pole = '<div class="wybierak"><input ' + atrybutyCelu(cel) + ' ' + (o.atr || '') + ' value="' + esc(wartosc) + '" data-wybierak="' + zrodlo + '"' + (o.nowy ? ' data-nowy="1"' : '') +
      ' autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" placeholder="' + esc(o.placeholder || '') + '">' +
      '<button type="button" class="wybierak-rozwin" data-rozwin tabindex="-1" aria-label="Pokaż listę">' + ikona('dol') + '</button></div>';
    const przycisk = o.nowy ? '<button type="button" class="przycisk maly nowy-obok" data-a="dodajDoWybieraka" data-zrodlo="' + zrodlo + '" data-cel="' + esc(cel) + '" data-tip="' + esc(o.nowyTip || NOWY_ETYKIETA[zrodlo] || 'Dodaj nowy') + '">' + ikona('plus') + 'Nowy</button>' : '';
    const opis = o.opis ? '<small class="opis-wyboru">' + opisWyboru(zrodlo, wartosc, cel) + '</small>' : '';
    return (przycisk ? '<div class="wiersz-wyboru">' + pole + przycisk + '</div>' : pole) + opis;
  }

  // źródła list – liczone raz na stan magazynu
  let pamiecZrodel = { st: null, dane: {} };
  function opcjeZrodla(nazwa) {
    if (pamiecZrodel.st !== app.st) pamiecZrodel = { st: app.st, dane: {} };
    if (!pamiecZrodel.dane[nazwa]) pamiecZrodel.dane[nazwa] = (ZRODLA[nazwa] || (() => []))();
    return pamiecZrodel.dane[nazwa];
  }

  const ZRODLA = {
    projekty() {
      return C.listaProjektow(app.st)
        .sort((a, b) => (a.status === 'zakończony') - (b.status === 'zakończony'))
        .map((p) => ({ w: p.numer, t: p.numer, o: [p.nazwa || 'bez nazwy', p.klientNazwa].filter(Boolean).join(' · ') + (p.status === 'zakończony' ? ' · zakończony' : ''), s: [p.numer, p.nazwa, p.klientNazwa, p.adres].join(' '), kl: p.status === 'zakończony' ? 'wyszarzona' : '' }));
    },
    klienci() {
      const m = new Map();
      for (const k of app.st.klienci.values()) m.set(C.normKlucz(k.nazwa), { w: k.nazwa, t: k.nazwa, o: [k.nip ? 'NIP ' + k.nip : '', k.adres].filter(Boolean).join(' · '), s: [k.nazwa, k.nip, k.adres, k.kontakt].join(' ') });
      for (const n of C.podpowiedzi(app.st).klienci) if (!m.has(C.normKlucz(n))) m.set(C.normKlucz(n), { w: n, t: n, o: 'wpisany w dokumentach', s: n });
      return Array.from(m.values()).sort((a, b) => a.t.localeCompare(b.t, 'pl'));
    },
    dostawcy() {
      const m = new Map();
      for (const d of app.st.dostawcy.values()) {
        if (d.aktywny === false) continue;
        const miasto = (String(d.adres || '').match(/\d{2}-\d{3}\s+(.+)$/) || [])[1] || '';
        m.set(C.normKlucz(d.nazwa), { w: d.nazwa, t: d.nazwa, o: [d.marki, d.nip ? 'NIP ' + d.nip : '', miasto].filter(Boolean).join(' · '), s: [d.nazwa, d.pelnaNazwa, d.nip, d.marki, d.adres, d.uwagi].join(' ') });
      }
      for (const n of C.podpowiedzi(app.st).dostawcy) if (!m.has(C.normKlucz(n))) m.set(C.normKlucz(n), { w: n, t: n, o: 'spoza biblioteki – wpisany w przyjęciach', s: n });
      return Array.from(m.values()).sort((a, b) => a.t.localeCompare(b.t, 'pl'));
    },
    lokalizacje() {
      const ile = new Map();
      for (const w of C.wierszeMagazynu(app.st)) ile.set(w.lok, (ile.get(w.lok) || 0) + 1);
      return C.podpowiedzi(app.st).lokalizacje.map((l) => ({ w: l, t: l, o: ile.get(l) ? ile.get(l) + ' ' + odm(ile.get(l), 'pozycja', 'pozycje', 'pozycji') : 'pusta', s: l }));
    },
    modele() {
      return Array.from(app.st.modele.values()).filter((m) => m.status !== 'wycofany')
        .sort((a, b) => etykietaModelu(a).localeCompare(etykietaModelu(b), 'pl'))
        .map((m) => ({ w: etykietaModelu(m), t: (m.producent ? m.producent + ' ' : '') + m.model, o: [m.kategoria, m.pn, m.seryjny ? 'po numerze seryjnym' : m.jednostka === 'm' ? 'w metrach' : 'w sztukach', m.status === 'EOL' ? 'EOL' : ''].filter(Boolean).join(' · '), s: [m.producent, m.model, m.pn, m.ean, m.kategoria].join(' ') }));
    },
    producenci: () => C.podpowiedzi(app.st).producenci.map((x) => ({ w: x, t: x, s: x })),
    osoby: () => C.podpowiedzi(app.st).osoby.map((x) => ({ w: x, t: x, s: x })),
    adresy() {
      const m = new Map();
      for (const a of C.podpowiedzi(app.st).adresy) m.set(C.normKlucz(a), { w: a, t: a, s: a });
      for (const k of app.st.klienci.values()) if (k.adres && !m.has(C.normKlucz(k.adres))) m.set(C.normKlucz(k.adres), { w: k.adres, t: k.adres, o: k.nazwa, s: k.adres + ' ' + k.nazwa });
      return Array.from(m.values()).sort((a, b) => a.t.localeCompare(b.t, 'pl'));
    },
  };

  const linkDodaj = (zrodlo, cel, tekst, etykieta) => '<a href="#" data-a="dodajDoWybieraka" data-zrodlo="' + zrodlo + '" data-cel="' + esc(cel) + '" data-tekst="' + esc(tekst) + '">' + etykieta + '</a>';

  /** Krótka informacja pod polem: co zostało wybrane (np. nazwa projektu, NIP dostawcy) albo że wartość jest nowa. */
  function opisWyboru(zrodlo, wartosc, cel) {
    const v = C.norm(wartosc);
    if (!v) return '';
    if (zrodlo === 'projekty') {
      const n = projNazwa(v);
      const p = C.projektWgNumeru(app.st, v);
      if (n) return ikona('proj') + '<b>' + esc(n) + '</b>' + (p && p.klientNazwa ? ' · ' + esc(p.klientNazwa) : '') + (p && p.status === 'zakończony' ? ' · <span class="ostrz-tekst">projekt zakończony</span>' : '');
      if (!C.czyNowaWartosc(C.podpowiedzi(app.st).projekty, v)) return 'Projekt bez nazwy – <a href="#" data-a="edytujProjekt" data-numer="' + esc(v) + '">dodaj nazwę</a>';
      return '<span class="ostrz-tekst">Nowy projekt.</span> Przy zapisie zapytam o nazwę albo ' + linkDodaj('projekty', cel, v, 'dodaj go teraz') + '.';
    }
    if (zrodlo === 'dostawcy') {
      const d = C.dostawcaWgNazwy(app.st, v);
      if (d) return [d.pelnaNazwa && d.pelnaNazwa !== d.nazwa ? esc(d.pelnaNazwa) : '', d.nip ? 'NIP ' + esc(d.nip) : '', esc(d.adres || '')].filter(Boolean).join(' · ');
      return '<span class="ostrz-tekst">Spoza biblioteki dostawców.</span> ' + linkDodaj('dostawcy', cel, v, 'Dodaj do biblioteki') + ', żeby na formularzu był NIP i adres.';
    }
    if (zrodlo === 'klienci') {
      const k = Array.from(app.st.klienci.values()).find((x) => C.normKlucz(x.nazwa) === C.normKlucz(v));
      if (k) return [k.nip ? 'NIP ' + esc(k.nip) : '', esc(k.adres || '')].filter(Boolean).join(' · ') || 'z listy klientów';
      return 'Spoza listy klientów – wpisze się tylko w dokument. ' + linkDodaj('klienci', cel, v, 'Dodaj do listy');
    }
    if (zrodlo === 'lokalizacje') return C.czyNowaWartosc(C.podpowiedzi(app.st).lokalizacje, v) ? '<span class="ostrz-tekst">Nowa lokalizacja</span> – sprawdź pisownię.' : '';
    return '';
  }

  const listaWyboru = document.createElement('div');
  listaWyboru.className = 'lista-wyboru';
  listaWyboru.setAttribute('role', 'listbox');
  listaWyboru.hidden = true;
  document.body.appendChild(listaWyboru);
  const wyb = { pole: null, opcje: [], aktywna: -1, ustawiam: false };

  /** Pogrubia w tekście fragmenty pasujące do wpisanych słów (bez względu na ogonki). */
  function podswietl(tekst, zapytanie) {
    const slowa = C.kluczSzukania(zapytanie).split(' ').filter(Boolean);
    const t = String(tekst || '');
    if (!slowa.length) return esc(t);
    const znaki = Array.from(t);
    const klucz = znaki.map((z) => C.kluczSzukania(z).charAt(0) || z.toLowerCase()).join('');
    const zazn = new Array(znaki.length).fill(false);
    for (const sl of slowa) {
      let i = klucz.indexOf(sl);
      while (i >= 0) { for (let j = i; j < i + sl.length && j < zazn.length; j++) zazn[j] = true; i = klucz.indexOf(sl, i + sl.length); }
    }
    let wynik = '';
    let otwarte = false;
    znaki.forEach((z, i) => {
      if (zazn[i] && !otwarte) { wynik += '<mark>'; otwarte = true; }
      if (!zazn[i] && otwarte) { wynik += '</mark>'; otwarte = false; }
      wynik += esc(z);
    });
    return wynik + (otwarte ? '</mark>' : '');
  }

  function otworzListe(pole, filtruj) {
    const zrodlo = pole.dataset.wybierak;
    const wszystkie = opcjeZrodla(zrodlo);
    const zapytanie = filtruj ? pole.value : '';
    const pasujace = wszystkie.filter((o) => C.pasujeDo(zapytanie, o.s || o.t, o.t));
    if (zapytanie) {
      // najpierw te, które zaczynają się od wpisanego tekstu
      const z = C.kluczSzukania(zapytanie);
      pasujace.sort((a, b) => (C.kluczSzukania(b.t).startsWith(z) ? 1 : 0) - (C.kluczSzukania(a.t).startsWith(z) ? 1 : 0));
    }
    const opcje = pasujace.slice(0, 80);
    wyb.pole = pole;
    wyb.opcje = opcje;
    const biezaca = C.normKlucz(pole.value);
    wyb.aktywna = filtruj ? (opcje.length ? 0 : -1) : opcje.findIndex((o) => C.normKlucz(o.w) === biezaca);
    const nowy = pole.dataset.nowy && NOWY_ETYKIETA[zrodlo];
    listaWyboru.innerHTML = opcje.map((o, i) => '<div class="opcja ' + (o.kl || '') + (i === wyb.aktywna ? ' aktywna' : '') + '" role="option" data-i="' + i + '"><span class="opcja-t">' + podswietl(o.t, zapytanie) + '</span>' + (o.o ? '<small>' + podswietl(o.o, zapytanie) + '</small>' : '') + '</div>').join('') +
      (pasujace.length > opcje.length ? '<div class="opcja-info">…i jeszcze ' + (pasujace.length - opcje.length) + ' – wpisz więcej, żeby zawęzić</div>' : '') +
      (!opcje.length ? '<div class="opcja-info">' + (wszystkie.length ? 'Nic nie pasuje do „' + esc(zapytanie) + '”.' : 'Lista jest jeszcze pusta.') + (nowy ? '' : ' Możesz wpisać nową wartość.') + '</div>' : '') +
      (nowy ? '<div class="opcja dodaj" data-dodaj>' + ikona('plus') + '<span>' + nowy + (zapytanie ? ' „' + esc(zapytanie) + '”' : '') + '…</span></div>' : '');
    listaWyboru.hidden = false;
    pole.setAttribute('aria-expanded', 'true');
    ustawListe();
    const akt = $('.opcja.aktywna', listaWyboru);
    if (akt) akt.scrollIntoView({ block: 'nearest' });
  }

  function ustawListe() {
    if (!wyb.pole || !wyb.pole.isConnected) return zamknijListe();
    const r = (wyb.pole.closest('.wybierak') || wyb.pole).getBoundingClientRect();
    const szer = Math.max(r.width, 300);
    listaWyboru.style.width = szer + 'px';
    listaWyboru.style.left = Math.max(8, Math.min(innerWidth - szer - 8, r.left)) + 'px';
    const wys = Math.min(listaWyboru.scrollHeight, 320);
    const podSpodem = innerHeight - r.bottom - 8;
    if (podSpodem < Math.min(wys, 200) && r.top > podSpodem) {
      listaWyboru.style.top = Math.max(8, r.top - Math.min(wys, r.top - 16) - 4) + 'px';
      listaWyboru.style.maxHeight = Math.min(320, r.top - 16) + 'px';
    } else {
      listaWyboru.style.top = r.bottom + 4 + 'px';
      listaWyboru.style.maxHeight = Math.max(120, Math.min(320, podSpodem - 4)) + 'px';
    }
  }

  function zamknijListe() {
    if (wyb.pole) wyb.pole.setAttribute('aria-expanded', 'false');
    listaWyboru.hidden = true;
    listaWyboru.innerHTML = '';
    wyb.pole = null;
    wyb.opcje = [];
    wyb.aktywna = -1;
  }

  function aktualizujOpis(pole) {
    const opis = pole.closest('.pole') && $('.opis-wyboru', pole.closest('.pole'));
    if (opis) opis.innerHTML = opisWyboru(pole.dataset.wybierak, pole.value, celPola(pole));
  }

  /** Wstawia wartość do pola tak, jakby wpisał ją użytkownik (zdarzenia input i change). */
  function ustawPole(pole, wartosc) {
    pole.value = wartosc;
    aktualizujOpis(pole);
    wyb.ustawiam = true;
    try {
      pole.dispatchEvent(new Event('input', { bubbles: true }));
      pole.dispatchEvent(new Event('change', { bubbles: true }));
    } finally {
      wyb.ustawiam = false;
    }
  }

  function wybierzOpcje(i) {
    const pole = wyb.pole;
    const o = wyb.opcje[i];
    zamknijListe();
    if (!pole || !o) return;
    const cel = celPola(pole);
    const model = !!pole.dataset.model;
    ustawPole(pole, o.w);
    if (model) {
      // po wyborze modelu od razu do następnego pola: lokalizacja (jeśli pusta), potem numery seryjne albo ilość
      setTimeout(() => {
        const nr = cel.split(':')[1];
        const lok = $('[data-p="' + nr + ':lok"]');
        const dalej = lok && !lok.value ? lok : $('[data-p="' + nr + ':snTekst"]') || $('[data-p="' + nr + ':ilosc"]');
        if (dalej) dalej.focus();
      }, 20);
    }
  }

  function przesunAktywna(o) {
    const n = wyb.opcje.length;
    if (!n) return;
    wyb.aktywna = (wyb.aktywna + o + n) % n;
    $$('.opcja[data-i]', listaWyboru).forEach((el) => el.classList.toggle('aktywna', Number(el.dataset.i) === wyb.aktywna));
    const akt = $('.opcja.aktywna', listaWyboru);
    if (akt) akt.scrollIntoView({ block: 'nearest' });
  }

  function dodajZListy() {
    const pole = wyb.pole;
    if (!pole) return;
    const dane = { zrodlo: pole.dataset.wybierak, cel: celPola(pole), tekst: pole.value };
    zamknijListe();
    AKCJE.dodajDoWybieraka({ dataset: dane }).catch((e) => toast(e.message, 'blad'));
  }

  listaWyboru.addEventListener('mousedown', (e) => {
    e.preventDefault(); // pole zostaje aktywne
    const o = e.target.closest('.opcja');
    if (!o) return;
    if (o.hasAttribute('data-dodaj')) return dodajZListy();
    if (o.dataset.i !== undefined) wybierzOpcje(Number(o.dataset.i));
  });
  document.addEventListener('mousedown', (e) => {
    const b = e.target.closest('[data-rozwin]');
    if (!b) return;
    e.preventDefault();
    const pole = $('input', b.parentElement);
    if (wyb.pole === pole) return zamknijListe();
    pole.focus();
    otworzListe(pole, false);
  });
  document.addEventListener('click', (e) => {
    const pole = e.target.closest && e.target.closest('input[data-wybierak]');
    if (pole && wyb.pole !== pole) otworzListe(pole, false);
  });
  document.addEventListener('input', (e) => {
    const pole = e.target;
    if (!pole.dataset || !pole.dataset.wybierak || wyb.ustawiam) return;
    pole.dataset.pisze = '1';
    otworzListe(pole, true);
    aktualizujOpis(pole);
  }, true);
  document.addEventListener('keydown', (e) => {
    const pole = e.target;
    if (!pole.dataset || !pole.dataset.wybierak) return;
    const otwarta = wyb.pole === pole;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!otwarta) otworzListe(pole, false);
      else przesunAktywna(e.key === 'ArrowDown' ? 1 : -1);
    } else if (e.key === 'Enter' && otwarta) {
      if (wyb.aktywna >= 0) {
        e.preventDefault();
        e.stopPropagation();
        wybierzOpcje(wyb.aktywna);
      } else if (!wyb.opcje.length && $('[data-dodaj]', listaWyboru)) {
        e.preventDefault();
        e.stopPropagation();
        dodajZListy();
      } else zamknijListe();
    } else if (e.key === 'Escape' && otwarta) {
      e.preventDefault();
      e.stopPropagation(); // nie zamykaj okna dialogowego
      zamknijListe();
    } else if (e.key === 'Tab' && otwarta) zamknijListe();
  }, true);
  document.addEventListener('focusout', (e) => {
    if (e.target === wyb.pole) setTimeout(() => { if (document.activeElement !== wyb.pole) zamknijListe(); }, 0);
  });
  document.addEventListener('scroll', (e) => { if (wyb.pole && !listaWyboru.contains(e.target)) ustawListe(); }, true);
  window.addEventListener('resize', () => { if (wyb.pole) ustawListe(); });

  /** Dodawanie nowej pozycji do listy (przycisk „Nowy” albo ostatni wiersz listy). Zwraca wartość do wstawienia w pole. */
  const DODAJ = {
    projekty: (t) => edytujProjekt(null, Object.assign(app.szkic && app.widok === 'dokument' ? { klientNazwa: app.szkic.klientNazwa || '', adres: app.szkic.adres || '' } : {}, /\d/.test(t) ? { numer: t } : { nazwa: t })),
    dostawcy: (t) => edytujDostawce(null, { nazwa: t }),
    klienci: (t) => edytujKlienta(null, { nazwa: t }),
    modele: (t, cel) => edytujModel(null, cel.split(':')[1], { model: t }).then(() => null),
  };

  function ustawCel(cel, wartosc) {
    const [typ, ...r] = cel.split(':');
    if (typ === 'f' && app.szkic) {
      app.szkic[r[0]] = wartosc;
      if (r[0] === 'projekt') uzupelnijZProjektu();
    } else if (typ === 'p' && app.szkic) {
      const p = app.szkic.pozycje[Number(r[0])];
      if (p) p[r[1]] = wartosc;
    } else if (typ === 'filtr') app.filtr[r[0]] = wartosc;
    else {
      const el = $('#modal [name="' + r[0] + '"]');
      if (el) ustawPole(el, wartosc);
    }
  }

  /** Po wyborze projektu w wydaniu: klient i adres obiektu z rejestru projektów (jeśli pola są puste albo wypełnione automatycznie). */
  function uzupelnijZProjektu() {
    const s = app.szkic;
    if (!s || s.rodzaj !== 'WZ') return;
    const p = C.projektWgNumeru(app.st, s.projekt);
    if (!p) return;
    if (p.klientNazwa && (!C.norm(s.klientNazwa) || s.klientNazwa === s.autoKlient)) s.klientNazwa = s.autoKlient = p.klientNazwa;
    if (p.adres && (!C.norm(s.adres) || s.adres === s.autoAdres)) s.adres = s.autoAdres = p.adres;
  }

  // Przerysowanie po zmianie pola dopiero po zakończeniu kliknięcia (żeby nie zgubić klikniętego przycisku).
  let wcisniety = false;
  let czekaRysowanie = false;
  document.addEventListener('pointerdown', () => { wcisniety = true; }, true);
  document.addEventListener('pointerup', () => {
    wcisniety = false;
    if (czekaRysowanie) { czekaRysowanie = false; setTimeout(render, 0); }
  }, true);
  function przerysujBezpiecznie() {
    if (wcisniety) czekaRysowanie = true;
    else setTimeout(render, 0);
  }

  // ------------------------------------------------------------ formularze dokumentów

  function nowySzkic(rodzaj) {
    return { rodzaj, data: dzis(), projekt: '', klientNazwa: '', adres: '', osoba: '', dostawca: '', nrFaktury: '', podProjekt: false, uwagi: '', powod: '', pozycje: [], szukaj: '' };
  }

  function etykietaModelu(m) {
    return (m.producent ? m.producent + ' ' : '') + m.model + (m.pn ? ' · ' + m.pn : '');
  }

  function modelZEtykiety(tekst) {
    const t = C.normKlucz(tekst);
    for (const m of app.st.modele.values()) if (C.normKlucz(etykietaModelu(m)) === t) return m;
    return null;
  }

  const pole = (etykieta, html, kl, tip) => '<label class="pole ' + (kl || '') + '"><span>' + etykieta + (tip ? ' ' + pomoc(tip) : '') + '</span>' + html + '</label>';
  const wejscie = (nazwa, wartosc, atr) => '<input data-f="' + nazwa + '" value="' + esc(wartosc) + '" ' + (atr || '') + '>';

  WIDOKI.dokument = () => {
    const s = app.szkic;
    if (!s) return WIDOKI.pulpit();
    const r = s.rodzaj;
    let naglowek = '';
    let pozycje = '';
    const wyborStanu = (i, wartosc) => '<select data-p="' + i + ':stanTech">' + C.STANY_TECHNICZNE.map((x) => '<option ' + (wartosc === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select>';
    if (r === 'PZ' || r === 'BO') {
      naglowek = '<div class="siatka">' +
        pole('Data', wejscie('data', s.data, 'type="date"')) +
        (r === 'PZ'
          ? pole('Dostawca *', wybierak('dostawcy', 'f:dostawca', s.dostawca, { nowy: true, opis: true, placeholder: 'wybierz z listy – nazwa, NIP albo marka' }), 'szerokie-2', 'dostawca') +
            pole('Nr faktury lub WZ dostawcy', wejscie('nrFaktury', s.nrFaktury, 'placeholder="np. FV/2026/11/0815"'), '', 'nrFaktury') +
            '<div class="pole pole-projekt"><span>Kupione pod projekt ' + pomoc('podProjekt') + '</span>' +
              '<div class="wiersz-projekt"><label class="przelacznik"><input type="checkbox" data-f="podProjekt" data-przerysuj="1" ' + (s.podProjekt ? 'checked' : '') + '><span>tak</span></label>' +
              (s.podProjekt ? '<div class="wejscie-projekt">' + wybierak('projekty', 'f:projekt', s.projekt, { nowy: true, opis: true, placeholder: 'numer albo nazwa projektu' }) + '</div>' : '<span class="szary maly">nie – towar trafi na wolny stan</span>') + '</div></div>'
          : pole('Spisujący', wybierak('osoby', 'f:osoba', s.osoba || osoba(app.user.userId), { placeholder: 'imię i nazwisko' }))) +
        pole('Uwagi', wejscie('uwagi', s.uwagi), 'szerokie') +
        '</div>';
      pozycje = s.pozycje.map((p, i) => {
        const m = p.modelId ? app.st.modele.get(p.modelId) : null;
        let szczeg = '';
        if (m && m.seryjny) {
          const sn = (p.snTekst || '').split(/[\n,;\t]+/).map((x) => x.trim()).filter(Boolean);
          szczeg = pole('Numery seryjne – jeden w linii · <b data-licznik="' + i + '">' + sn.length + '</b> szt.', '<textarea data-p="' + i + ':snTekst" rows="' + Math.max(2, Math.min(8, sn.length + 1)) + '" placeholder="wpisz, wklej lub zeskanuj numery">' + esc(p.snTekst || '') + '</textarea>', 'szerokie', 'numerySeryjne') +
            pole('Stan', wyborStanu(i, p.stanTech), '', 'stanTech') +
            pole('Gwarancja do', '<input type="date" data-p="' + i + ':gwarancjaDo" value="' + esc(p.gwarancjaDo || '') + '">', '', 'gwarancja');
        } else if (m) {
          const opcje = '<option value="baza">' + esc(jmw(m.jednostka)) + '</option>' + (m.jednostkaZakupu ? '<option value="zakup" ' + (p.jedn === 'zakup' ? 'selected' : '') + '>' + esc(m.jednostkaZakupu) + ' (' + fmtL(m.przelicznik) + ' ' + esc(jmw(m.jednostka)) + ')</option>' : '');
          const przeliczone = p.jedn === 'zakup' ? (Number(String(p.ilosc).replace(',', '.')) || 0) * Number(m.przelicznik) : null;
          szczeg = pole('Ilość', '<div class="ilosc"><input data-p="' + i + ':ilosc" value="' + esc(p.ilosc || '') + '" inputmode="decimal" placeholder="0"><select data-p="' + i + ':jedn" data-przerysuj="1">' + opcje + '</select></div>' + (przeliczone !== null ? '<small class="szary" data-przel="' + i + '" data-mn="' + Number(m.przelicznik) + '" data-j="' + esc(jmw(m.jednostka)) + '">= ' + fmtL(przeliczone) + ' ' + esc(jmw(m.jednostka)) + '</small>' : ''), '', 'ilosc');
        }
        return '<div class="pozycja">' +
          '<div class="pozycja-nr">' + (i + 1) + '</div>' +
          '<div class="siatka">' +
            pole('Model *', '<div class="wiersz-modelu">' + wybierak('modele', 'p:' + i + ':modelLabel', p.modelLabel || '', { nowy: true, atr: 'data-model="1"', placeholder: 'zacznij pisać: producent, model albo kod', nowyTip: 'Dodaj nowy model do kartoteki' }) + (m ? przyciskKarty(m.modelId) : '') + '</div><small class="blad-tekst" data-podp="' + i + '"' + (C.norm(p.modelLabel) && !m ? '' : ' hidden') + '>Nie ma takiego modelu w kartotece. <a href="#" data-a="edytujModel" data-poz="' + i + '">Dodaj go</a></small>', 'szerokie') +
            pole('Lokalizacja *', wybierak('lokalizacje', 'p:' + i + ':lok', p.lok || '', { opis: true, placeholder: 'np. Regał A, półka 2' }), '', 'lokalizacja') +
            (r === 'BO' ? pole('Kupione pod projekt', wybierak('projekty', 'p:' + i + ':projekt', p.projekt || '', { opis: true, placeholder: 'puste = wolny stan' }), '', 'podProjekt') : '') +
            szczeg +
          '</div>' +
          '<button class="ikonowy" data-a="usunPoz" data-i="' + i + '" data-tip="Usuń pozycję" aria-label="Usuń pozycję">' + ikona('x') + '</button>' +
        '</div>';
      }).join('');
      pozycje += '<div class="przyciski-pozycji"><button class="przycisk" data-a="dodajPoz">' + ikona('plus') + 'Dodaj pozycję</button> <button class="przycisk tekstowy" data-a="edytujModel" data-poz="nowa">' + ikona('kart') + 'Nowy model w kartotece</button></div>';
    } else if (r === 'WZ') {
      const zast = s.pozycje.some((p) => C.czyZastepcze(p.projektZakupu, s.projekt));
      naglowek = '<div class="siatka">' +
        pole('Data', wejscie('data', s.data, 'type="date"')) +
        pole('Projekt *', wybierak('projekty', 'f:projekt', s.projekt, { nowy: true, opis: true, atr: 'data-przerysuj-po="1"', placeholder: 'wpisz numer albo nazwę projektu' }), 'szerokie-2', 'projektNumer') +
        pole('Klient *', wybierak('klienci', 'f:klientNazwa', s.klientNazwa, { nowy: true, opis: true, placeholder: 'wybierz z listy albo wpisz' }), 'szerokie-2', 'klient') +
        pole('Adres obiektu', wybierak('adresy', 'f:adres', s.adres, { placeholder: 'dokąd jedzie sprzęt' }), 'szerokie-2', 'adresObiektu') +
        pole('Pobierający', wybierak('osoby', 'f:osoba', s.osoba, { placeholder: 'imię i nazwisko' }), '', 'pobierajacy') +
        pole('Uwagi', wejscie('uwagi', s.uwagi)) +
        '</div>' +
        (zast ? '<div class="alert wzz-alert"><b>WYDANIE ZASTĘPCZE (WZZ)</b><br>Część sprzętu kupiono pod inny projekt. Dokument zostanie zapisany jako WZZ, na wydruku pojawi się czerwona ramka, a sprzęt trafi na listę „Do uzupełnienia”.' + pole('Powód wydania zastępczego *', '<textarea data-f="powod" rows="2" placeholder="dlaczego wydajesz sprzęt z innego projektu?">' + esc(s.powod) + '</textarea>', 'szerokie', 'powodWzz') + '</div>' : '');
      pozycje = (s.pozycje.length ? '<div class="tabela-owijka"><table class="tabela"><thead><tr><th>Model</th><th>Nr seryjny</th><th>Z lokalizacji</th><th>Kupione pod</th><th class="l">Ilość</th><th></th></tr></thead><tbody>' +
        s.pozycje.map((p, i) => '<tr class="' + (C.czyZastepcze(p.projektZakupu, s.projekt) ? 'wzz' : '') + '"><td>' + esc(nazwaModelu(p.modelId)) + przyciskKarty(p.modelId) + '</td><td class="mono">' + esc(p.sn || '') + '</td><td>' + esc(p.lok) + '</td><td>' + (p.projektZakupu ? znaczekProj(p.projektZakupu, C.czyZastepcze(p.projektZakupu, s.projekt) ? 'brak' : 'projekt') : '<span class="szary">wolny stan</span>') + '</td><td class="l">' + (p.sn ? '1 szt.' : '<input class="w-ilosc" data-p="' + i + ':ilosc" value="' + esc(p.ilosc) + '" inputmode="decimal" placeholder="0"> ' + esc(jedn(p.modelId)) + ' <small class="szary">z ' + fmtL(p.max) + '</small>') + '</td><td><button class="ikonowy" data-a="usunPoz" data-i="' + i + '" data-tip="Usuń z dokumentu" aria-label="Usuń">' + ikona('x') + '</button></td></tr>').join('') +
        '</tbody></table></div>' : '<div class="pusto">Wybierz sprzęt z magazynu poniżej</div>') + wyborZMagazynu(s);
    } else if (r === 'ZW') {
      naglowek = '<div class="siatka">' +
        pole('Data', wejscie('data', s.data, 'type="date"')) +
        pole('Projekt *', wybierak('projekty', 'f:projekt', s.projekt, { opis: true, atr: 'data-przerysuj-po="1"', placeholder: 'z jakiego projektu wraca sprzęt – numer albo nazwa' }), 'szerokie-2', 'projektNumer') +
        pole('Zwracający', wybierak('osoby', 'f:osoba', s.osoba, { placeholder: 'imię i nazwisko' })) +
        pole('Uwagi', wejscie('uwagi', s.uwagi)) +
        '</div>';
      pozycje = (s.pozycje.length ? s.pozycje.map((p, i) => '<div class="pozycja"><div class="pozycja-nr">' + (i + 1) + '</div><div class="siatka">' +
        '<div class="pole szerokie"><span>Model</span><div><b>' + esc(nazwaModelu(p.modelId)) + '</b>' + (p.sn ? ' · nr seryjny <span class="mono">' + esc(p.sn) + '</span>' : '') + '</div></div>' +
        (p.sn ? pole('Stan po zwrocie', wyborStanu(i, p.stanTech), '', 'stanTech') : pole('Ilość (wydano ' + fmtL(p.max) + ' ' + esc(jedn(p.modelId)) + ')', '<input data-p="' + i + ':ilosc" value="' + esc(p.ilosc) + '" inputmode="decimal" placeholder="0">')) +
        pole('Lokalizacja *', wybierak('lokalizacje', 'p:' + i + ':lok', p.lok || '', { opis: true, placeholder: 'gdzie odkładasz' }), '', 'lokalizacja') +
        '</div><button class="ikonowy" data-a="usunPoz" data-i="' + i + '" data-tip="Usuń pozycję" aria-label="Usuń">' + ikona('x') + '</button></div>').join('') : '<div class="pusto">Wybierz poniżej, co wraca z projektu</div>') + wyborZwrotu(s);
    }
    const tytuly = { PZ: 'Przyjęcie zewnętrzne (PZ)', BO: 'Bilans otwarcia (BO)', WZ: 'Wydanie na projekt (WZ / WZZ)', ZW: 'Zwrot z projektu (ZW)' };
    const podt = { PZ: 'Dostawa od dostawcy. Zaznacz projekt, jeśli towar kupiono pod konkretny projekt.', BO: 'Inwentaryzacja startowa: wpisz wszystko, co fizycznie leży w magazynie, miejsce po miejscu.', WZ: 'Sprzęt jedzie do klienta. Jeśli wybierzesz sprzęt kupiony pod inny projekt, powstanie wydanie zastępcze (WZZ).', ZW: 'Nadwyżki materiału i niewykorzystane urządzenia wracające z projektu.' };
    return '<button class="przycisk tekstowy wstecz" data-a="wstecz">← Wróć</button>' + naglowekWidoku(tytuly[r], podt[r], '<button class="przycisk" data-a="anulujSzkic">Porzuć</button><button class="przycisk glowny" data-a="zapiszSzkic">Zapisz i drukuj</button>', r) +
      '<section class="karta"><h2>Dane dokumentu</h2>' + naglowek + '</section>' +
      '<section class="karta"><h2>Pozycje' + (s.pozycje.length ? ' <span class="licznik-pozycji">' + s.pozycje.length + '</span>' : '') + '</h2>' + pozycje + '</section>' +
      '<div class="stopka-formularza"><button class="przycisk" data-a="anulujSzkic">Porzuć</button><button class="przycisk glowny duzy" data-a="zapiszSzkic">Zapisz dokument (PIN) i drukuj</button></div>';
  };

  function wyborZMagazynu(s) {
    const wybrane = new Set(s.pozycje.filter((p) => p.sn).map((p) => C.kluczEgz(p.modelId, p.sn)));
    const wykorzystane = new Map();
    for (const p of s.pozycje) if (!p.sn) wykorzystane.set(p.modelId + '|' + p.lok + '|' + (p.projektZakupu || ''), Number(String(p.ilosc).replace(',', '.')) || 0);
    const proj = C.normKlucz(s.projekt);
    const ranga = (w) => (!w.projekt ? 1 : C.normKlucz(w.projekt) === proj ? 0 : 2);
    const lista = C.wierszeMagazynu(app.st)
      .filter((w) => !(w.sn && wybrane.has(C.kluczEgz(w.modelId, w.sn))))
      .filter((w) => pasuje('wybor', nazwaModelu(w.modelId), model(w.modelId).pn, w.sn, w.lok, w.projekt, projNazwa(w.projekt)))
      .sort((a, b) => ranga(a) - ranga(b) || (nazwaModelu(a.modelId) + a.lok + a.sn).localeCompare(nazwaModelu(b.modelId) + b.lok + b.sn, 'pl'));
    return '<h3 class="odstep-gora">Dostępne w magazynie ' + pomoc('wyborZMagazynu') + '</h3><div class="filtry">' + poleSzukaj('wybor', 'Szukaj: model, kod, numer seryjny, lokalizacja…') + '</div>' +
      tabela('wybor', 'Dostępne w magazynie', ['Model', 'Nr seryjny', 'Lokalizacja', 'Kupione pod', 'Dostępne'], lista.map((w) => {
        const juz = wykorzystane.get(w.modelId + '|' + w.lok + '|' + (w.projekt || '')) || 0;
        const zast = C.czyZastepcze(w.projekt, s.projekt);
        return {
          klasa: zast ? 'inny-projekt' : '',
          komorki: [esc(nazwaModelu(w.modelId)) + przyciskKarty(w.modelId), esc(w.sn), esc(w.lok), w.projekt ? znaczekProj(w.projekt, zast ? 'brak' : 'projekt') : '<span class="szary">wolny stan</span>', fmtIl(w.modelId, w.ilosc - juz)],
          sort: [undefined, undefined, undefined, w.projekt ? projTekst(w.projekt) : ''],
          dane: [nazwaModelu(w.modelId), w.sn, w.lok, w.projekt || '', w.ilosc - juz],
          akcjeHtml: '<button class="przycisk maly ' + (zast ? 'czerwony' : '') + '" data-a="dodajZMagazynu" data-m="' + esc(w.modelId) + '" data-sn="' + esc(w.sn) + '" data-lok="' + esc(w.lok) + '" data-p="' + esc(w.projekt) + '" data-il="' + w.ilosc + '" ' + (w.ilosc - juz <= 0 ? 'disabled' : '') + '>Dodaj</button>',
        };
      }), { akcje: true, liczbowe: [4], klasyKolumn: { 1: 'mono' }, owijka: 'wysokosc', limit: 200, pusto: 'Brak sprzętu pasującego do wyszukiwania' });
  }

  function wyborZwrotu(s) {
    if (!C.norm(s.projekt)) return '<div class="alert info odstep-gora">Wybierz projekt, a pokażę, co zostało na niego wydane.</div>';
    const wybrane = new Set(s.pozycje.map((p) => p.modelId + '|' + (p.sn || '')));
    const lista = C.wydaneNaProjekt(app.st, s.projekt).filter((w) => !wybrane.has(w.modelId + '|' + (w.sn || '')));
    return '<h3 class="odstep-gora">Wydane na projekt ' + esc(projTekst(s.projekt)) + '</h3>' +
      tabela('zwrot', 'Wydane na projekt', ['Model', 'Nr seryjny', 'Klient', 'Wydano'], lista.map((w) => ({
        komorki: [esc(nazwaModelu(w.modelId)), esc(w.sn), esc(w.klient), fmtIl(w.modelId, w.ilosc)],
        dane: [nazwaModelu(w.modelId), w.sn, w.klient, w.ilosc],
        akcjeHtml: '<button class="przycisk maly" data-a="dodajZwrot" data-m="' + esc(w.modelId) + '" data-sn="' + esc(w.sn) + '" data-il="' + w.ilosc + '">Dodaj</button>',
      })), { akcje: true, liczbowe: [3], klasyKolumn: { 1: 'mono' }, pusto: 'Nic nie zostało wydane na ten projekt (albo już wróciło)' });
  }

  function pozycjeDoZapisu(s) {
    const liczba = (x) => Number(String(x == null ? '' : x).replace(',', '.').replace(/\s/g, ''));
    if (s.rodzaj === 'PZ' || s.rodzaj === 'BO') {
      const wynik = [];
      for (const p of s.pozycje) {
        const m = p.modelId ? app.st.modele.get(p.modelId) : null;
        const projekt = s.rodzaj === 'PZ' ? (s.podProjekt ? C.norm(s.projekt) : '') : C.norm(p.projekt);
        if (!m) { wynik.push({ modelId: '', ilosc: 0, lok: p.lok }); continue; }
        if (m.seryjny) {
          const sn = (p.snTekst || '').split(/[\n,;\t]+/).map((x) => x.trim()).filter(Boolean);
          if (!sn.length) wynik.push({ modelId: m.modelId, sn: '', lok: C.norm(p.lok), projekt });
          for (const n of sn) wynik.push({ modelId: m.modelId, sn: n, ilosc: 1, lok: C.norm(p.lok), projekt, stanTech: p.stanTech || 'nowy', gwarancjaDo: p.gwarancjaDo || '' });
        } else {
          let il = liczba(p.ilosc);
          if (p.jedn === 'zakup' && Number(m.przelicznik) > 0) il = C.zaokr(il * Number(m.przelicznik));
          wynik.push({ modelId: m.modelId, ilosc: il, lok: C.norm(p.lok), projekt });
        }
      }
      return wynik;
    }
    if (s.rodzaj === 'WZ') return s.pozycje.map((p) => ({ modelId: p.modelId, sn: p.sn || undefined, ilosc: p.sn ? 1 : liczba(p.ilosc), lok: p.lok, projektZakupu: p.projektZakupu || '' }));
    if (s.rodzaj === 'ZW') return s.pozycje.map((p) => ({ modelId: p.modelId, sn: p.sn || undefined, ilosc: p.sn ? 1 : liczba(p.ilosc), lok: C.norm(p.lok), stanTech: p.sn ? p.stanTech || 'używany' : undefined }));
    return [];
  }

  async function zapiszSzkic() {
    const s = app.szkic;
    const pozycje = pozycjeDoZapisu(s);
    let rodzaj = s.rodzaj;
    if (rodzaj === 'WZ' && pozycje.some((p) => C.czyZastepcze(p.projektZakupu, s.projekt))) rodzaj = 'WZZ';
    const dane = { rodzaj, data: s.data || dzis(), uwagi: C.norm(s.uwagi), osoba: C.norm(s.osoba), pozycje };
    if (rodzaj === 'PZ') {
      Object.assign(dane, { dostawca: C.norm(s.dostawca), nrFaktury: C.norm(s.nrFaktury), projekt: s.podProjekt ? C.norm(s.projekt) : '' });
      const dost = C.dostawcaWgNazwy(app.st, dane.dostawca);
      if (dost) Object.assign(dane, { dostawca: dost.nazwa, dostawcaId: dost.dostawcaId, dostawcaDane: { pelnaNazwa: dost.pelnaNazwa || '', nip: dost.nip || '', adres: dost.adres || '' } });
    }
    if (rodzaj === 'BO') dane.osoba = dane.osoba || osoba(app.user.userId);
    if (rodzaj === 'WZ' || rodzaj === 'WZZ') {
      Object.assign(dane, { projekt: C.norm(s.projekt), klientNazwa: C.norm(s.klientNazwa), adres: C.norm(s.adres) });
      const k = Array.from(app.st.klienci.values()).find((x) => C.normKlucz(x.nazwa) === C.normKlucz(s.klientNazwa));
      if (k) Object.assign(dane, { klientId: k.klientId, klientNip: k.nip || '', klientAdres: k.adres || '' });
      if (rodzaj === 'WZZ') dane.powod = C.norm(s.powod);
    }
    if (rodzaj === 'ZW') dane.projekt = C.norm(s.projekt);

    const bledy = C.walidujDokument(app.st, dane);
    if (bledy.length) return bladDoOkna(new BladUzytkownika(bledy));

    // nowe wartości wpisane ręcznie – potwierdzenie, żeby uniknąć literówek
    const p = C.podpowiedzi(app.st);
    const nowe = [];
    const lok = new Set(pozycje.map((x) => x.lok).filter(Boolean));
    for (const l of lok) if (C.czyNowaWartosc(p.lokalizacje, l)) nowe.push('lokalizacja „' + l + '”');
    if (dane.klientNazwa && C.czyNowaWartosc(p.klienci, dane.klientNazwa)) nowe.push('klient „' + dane.klientNazwa + '”');
    if (rodzaj === 'PZ' && !dane.dostawcaId && C.czyNowaWartosc(p.dostawcy, dane.dostawca)) nowe.push('dostawca „' + dane.dostawca + '” (spoza biblioteki dostawców)');
    if (nowe.length && rodzaj !== 'BO') {
      const ok = await potwierdz('Nowe wartości', 'Te wartości pojawią się po raz pierwszy:<br><b>' + nowe.map(esc).join('<br>') + '</b><br><br>Sprawdź, czy nie ma literówki (np. „A3” i „A-3” to dwa różne miejsca).', 'Wszystko się zgadza');
      if (!ok) return;
    }
    // nowy numer projektu – od razu pytamy o nazwę
    const projekty = new Set([dane.projekt].concat(pozycje.map((x) => x.projekt)).filter(Boolean));
    for (const pr of projekty) {
      if (!C.czyNowaWartosc(p.projekty, pr)) continue;
      const w = await edytujProjekt(null, { numer: pr, klientNazwa: dane.klientNazwa || '', adres: dane.adres || '' }, { przyZapisie: true });
      if (!w) return;
    }
    if (dane.projekt && C.nazwaProjektu(app.st, dane.projekt)) dane.projektNazwa = C.nazwaProjektu(app.st, dane.projekt);
    if (rodzaj === 'WZZ') {
      const ok = await potwierdz('Wydanie zastępcze', '<span class="czerwony-tekst"><b>Ten dokument zawiera sprzęt kupiony pod inny projekt.</b></span><br>' + pozycje.filter((x) => C.czyZastepcze(x.projektZakupu, dane.projekt)).map((x) => esc(nazwaModelu(x.modelId) + (x.sn ? ' SN ' + x.sn : ' ' + x.ilosc + ' ' + jedn(x.modelId)) + ': kupione pod ' + projTekst(x.projektZakupu))).join('<br>') + '<br><br>Wydajesz go na projekt <b>' + esc(projTekst(dane.projekt)) + '</b>. Sprzęt trafi na listę „Do uzupełnienia”.', 'Rozumiem, wydaję zastępczo', 'czerwony');
      if (!ok) return;
    }
    if (!(await pytajPin('Zapisujesz dokument ' + C.RODZAJE[rodzaj].nazwa + ' (' + pozycje.length + ' poz.).'))) return;
    try {
      const ev = await zapiszDokument(dane);
      app.szkic = null;
      pokazWidok('dokumenty', { zastap: true });
      toast('Zapisano ' + ev.dane.numer, 'ok');
      const w = await dialog({ tytul: 'Zapisano ' + esc(ev.dane.numer), tresc: '<p>Wydrukuj formularz i daj go do podpisu. Skan lub zdjęcie podpisanego formularza dołączysz później w widoku dokumentu.</p>', przyciski: [{ wartosc: 'zamknij', etykieta: 'Później' }, { wartosc: 'drukuj', etykieta: ikona('druk') + 'Drukuj formularz', klasa: 'glowny', submit: true }] });
      if (w === 'drukuj') drukuj(app.st.dokumenty.get(ev.id));
    } catch (e) {
      bladDoOkna(e);
    }
  }

  // ------------------------------------------------------------ podgląd dokumentu

  async function pokazDokument(id) {
    const wpis = app.st.dokumenty.get(id);
    if (!wpis) return;
    const d = wpis.ev.dane;
    const naglowekInfo = [
      ['Data', fmtData(d.data || wpis.ev.ts)], ['Wystawił', osoba(wpis.ev.autor) + ' · ' + fmtCzas(wpis.ev.ts)],
      d.projekt ? [d.rodzaj === 'PZ' || d.rodzaj === 'BO' ? 'Pod projekt' : 'Projekt', d.projekt + ((d.projektNazwa || projNazwa(d.projekt)) ? ' – ' + (d.projektNazwa || projNazwa(d.projekt)) : '')] : null,
      d.klientNazwa ? ['Klient', d.klientNazwa + (d.klientNip ? ' · NIP ' + d.klientNip : '')] : null,
      d.adres ? ['Adres obiektu', d.adres] : null,
      d.dostawca ? ['Dostawca', d.dostawca + (d.dostawcaDane ? [d.dostawcaDane.pelnaNazwa && d.dostawcaDane.pelnaNazwa !== d.dostawca ? d.dostawcaDane.pelnaNazwa : '', d.dostawcaDane.nip ? 'NIP ' + d.dostawcaDane.nip : '', d.dostawcaDane.adres].filter(Boolean).map((x) => ' · ' + x).join('') : '')] : null,
      d.nrFaktury ? ['Faktura / WZ dostawcy', d.nrFaktury] : null,
      d.osoba ? [d.rodzaj === 'WZ' || d.rodzaj === 'WZZ' ? 'Pobierający' : d.rodzaj === 'ZW' ? 'Zwracający' : 'Osoba', d.osoba] : null, d.uwagi ? ['Uwagi', d.uwagi] : null,
    ].filter(Boolean);
    const tresc =
      (wpis.anulowany ? '<div class="alert blad"><b>Dokument anulowany</b> ' + fmtCzas(wpis.anulowanie.ts) + ' przez ' + esc(osoba(wpis.anulowanie.autor)) + '. Powód: ' + esc(wpis.anulowanie.dane.powod) + '</div>' : '') +
      (d.rodzaj === 'WZZ' ? '<div class="alert wzz-alert"><b>WYDANIE ZASTĘPCZE</b> – powód: ' + esc(d.powod) + '</div>' : '') +
      '<dl class="opis">' + naglowekInfo.map(([a, b]) => '<dt>' + a + '</dt><dd>' + esc(b) + '</dd>').join('') + '</dl>' +
      '<div class="tabela-owijka"><table class="tabela"><thead><tr><th>Lp.</th><th>Model</th><th>Nr seryjny</th><th class="l">Ilość</th><th>Lokalizacja</th><th>' + (d.rodzaj === 'WZ' || d.rodzaj === 'WZZ' ? 'Kupione pod' : 'Projekt / stan') + '</th></tr></thead><tbody>' +
      (d.pozycje || []).map((p, i) => '<tr class="' + (C.czyZastepcze(p.projektZakupu, d.projekt) ? 'wzz' : '') + '"><td>' + (i + 1) + '</td><td>' + esc(nazwaModelu(p.modelId)) + przyciskKarty(p.modelId) + '</td><td class="mono">' + esc(p.sn || '') + '</td><td class="l">' + fmtIl(p.modelId, p.ilosc || 1) + '</td><td>' + esc(p.lok || '') + '</td><td>' + esc(p.projektZakupu || p.projekt || p.stanTech || '') + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<h3>Podpisany formularz ' + pomoc('skan') + '</h3>' + (wpis.skany.length ? '<ul>' + wpis.skany.map((s) => '<li><a href="#" data-otworz="' + esc(s.plik) + '">' + esc(s.plik.split('/').pop()) + '</a> <span class="szary maly">' + fmtCzas(s.ts) + ' · ' + esc(osoba(s.autor)) + '</span></li>').join('') + '</ul>' : '<p class="szary">Nie dołączono jeszcze skanu podpisanego formularza.</p>') +
      '<input type="file" accept="image/*,application/pdf" class="ukryty" id="plik-skanu">';
    const przyciski = [{ wartosc: 'zamknij', etykieta: 'Zamknij' }];
    if (!wpis.anulowany) przyciski.unshift({ wartosc: 'anuluj-dok', etykieta: 'Anuluj dokument…', klasa: 'czerwony-tekst' });
    if (!wpis.anulowany) przyciski.push({ wartosc: 'skan', etykieta: 'Dołącz skan podpisu' });
    przyciski.push({ wartosc: 'drukuj', etykieta: ikona('druk') + 'Drukuj', klasa: 'glowny' });
    const w = await dialog({
      tytul: esc(d.numer) + ' · ' + esc(C.RODZAJE[d.rodzaj].nazwa), tresc, przyciski, szeroki: true,
      przyOtwarciu: (f) => {
        f.addEventListener('click', async (e) => {
          const k = e.target.closest('[data-a="karta"]');
          if (k) {
            e.preventDefault();
            return otworzKarte(k.dataset.m);
          }
          const a = e.target.closest('[data-otworz]');
          if (!a) return;
          e.preventDefault();
          try {
            const plik = await app.store.czytaj(a.dataset.otworz);
            window.open(URL.createObjectURL(plik), '_blank');
          } catch (err) {
            toast('Nie można otworzyć pliku: ' + err.message, 'blad');
          }
        });
      },
      przyWyslaniu: async (f, wartosc) => {
        if (wartosc === 'skan') {
          const input = $('#plik-skanu', f);
          const plik = await new Promise((ok) => {
            input.onchange = () => ok(input.files[0]);
            input.click();
          });
          if (!plik) return false;
          const rozsz = (plik.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
          const sciezka = 'podpisane/' + d.rok + '/' + d.rodzaj + '-' + d.rok + '-' + String(d.nr).padStart(4, '0') + '_skan' + (wpis.skany.length + 1) + '.' + rozsz;
          await app.store.zapisz(sciezka, plik);
          await utworzZdarzenie('SKAN', { docId: id, numer: d.numer, plik: sciezka });
          toast('Dołączono skan do ' + d.numer, 'ok');
          return 'odswiez';
        }
        return wartosc;
      },
    });
    if (w === 'drukuj') drukuj(app.st.dokumenty.get(id));
    if (w === 'anuluj-dok') await anulujDokument(id);
    if (w === 'odswiez') {
      render();
      pokazDokument(id);
    }
  }

  async function anulujDokument(id) {
    const wpis = app.st.dokumenty.get(id);
    const d = wpis.ev.dane;
    const powod = await dialog({
      tytul: 'Anuluj ' + esc(d.numer),
      tresc: '<p>Dokument nie zostanie usunięty – zostanie oznaczony jako anulowany, a jego ruchy przestaną się liczyć do stanu. Nie można anulować dokumentu, jeśli późniejsze dokumenty z niego korzystają.</p>' + pole('Powód anulowania *', '<textarea name="powod" rows="2"></textarea>', 'szerokie'),
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Wróć' }, { wartosc: 'ok', etykieta: 'Anuluj dokument', klasa: 'czerwony', submit: true }],
      przyWyslaniu: (f) => {
        const p = f.powod.value.trim();
        if (!p) throw new Error('Podaj powód');
        return p;
      },
    });
    if (!powod) return;
    if (!(await pytajPin('Anulujesz dokument ' + d.numer + '.'))) return;
    try {
      await wczytaj();
      await utworzZdarzenie('ANUL', { docId: id, numer: d.numer, powod });
      toast('Anulowano ' + d.numer, 'ok');
      render();
    } catch (e) {
      bladDoOkna(e);
    }
  }

  // ------------------------------------------------------------ wydruk

  function drukuj(wpis) {
    const ev = wpis.ev;
    const d = ev.dane;
    const r = d.rodzaj;
    let qr = '';
    try {
      const q = window.qrcode(0, 'M');
      q.addData('MAGAZYN|' + d.numer + '|' + ev.id);
      q.make();
      qr = q.createSvgTag({ cellSize: 2, margin: 0, scalable: true });
    } catch (e) { /* bez kodu QR */ }
    const podpisy = {
      BO: ['Spisujący'], PZ: ['Przyjmujący (magazyn)', 'Dostarczający'], WZ: ['Wydający', 'Pobierający'], WZZ: ['Wydający', 'Pobierający'], ZW: ['Zwracający', 'Przyjmujący (magazyn)'],
    }[r];
    const meta = [
      ['Data', fmtData(d.data || ev.ts)],
      r === 'PZ' ? ['Dostawca', d.dostawcaDane && d.dostawcaDane.pelnaNazwa ? d.dostawcaDane.pelnaNazwa + (d.dostawcaDane.nip ? ', NIP ' + d.dostawcaDane.nip : '') + (d.dostawcaDane.adres ? ', ' + d.dostawcaDane.adres : '') : d.dostawca] : null,
      r === 'PZ' && d.nrFaktury ? ['Faktura / WZ dostawcy', d.nrFaktury] : null,
      d.projekt ? [r === 'PZ' || r === 'BO' ? 'Kupione pod projekt' : r === 'ZW' ? 'Zwrot z projektu' : 'Projekt', d.projekt + ((d.projektNazwa || projNazwa(d.projekt)) ? ' – ' + (d.projektNazwa || projNazwa(d.projekt)) : '')] : null,
      d.klientNazwa ? ['Klient', d.klientNazwa + (d.klientNip ? ', NIP ' + d.klientNip : '') + (d.klientAdres ? ', ' + d.klientAdres : '')] : null,
      d.adres ? ['Adres obiektu', d.adres] : null,
      ['Wystawił', osoba(ev.autor) + ' (potwierdzone PIN-em, ' + fmtCzas(ev.ts) + ')'],
      d.osoba ? [r === 'WZ' || r === 'WZZ' ? 'Pobierający' : r === 'ZW' ? 'Zwracający' : 'Spisujący', d.osoba] : null,
    ].filter(Boolean);
    const zastPoz = (d.pozycje || []).filter((p) => C.czyZastepcze(p.projektZakupu, d.projekt));
    const kupionePod = Array.from(new Set(zastPoz.map((p) => p.projektZakupu))).join(', ');
    const html = '<div class="arkusz' + (wpis.anulowany ? ' anulowany' : '') + '">' +
      (wpis.anulowany ? '<div class="znak-wodny">ANULOWANY</div>' : '') +
      '<header class="d-naglowek"><img src="' + (LOGO.jasne || '') + '" alt="maasck" class="d-logo">' +
        '<div class="d-firma"><b>' + esc(FIRMA.nazwa) + '</b><br>' + esc(FIRMA.adres) + '<br>NIP ' + FIRMA.nip + ' · REGON ' + FIRMA.regon + ' · KRS ' + FIRMA.krs + '<br>' + FIRMA.email + ' · ' + FIRMA.www + '</div></header>' +
      '<div class="d-tytul"><div><div class="d-rodzaj">' + esc(C.RODZAJE[r].nazwa) + '</div><div class="d-numer">' + esc(d.numer) + '</div></div>' + (qr ? '<div class="d-qr">' + qr + '</div>' : '') + '</div>' +
      (r === 'WZZ' ? '<div class="d-wzz"><b>WYDANIE ZASTĘPCZE: kupione pod ' + esc(kupionePod) + ', wydane na ' + esc(d.projekt) + '</b><br>Powód: ' + esc(d.powod) + '</div>' : '') +
      '<table class="d-meta">' + meta.map(([a, b]) => '<tr><th>' + a + '</th><td>' + esc(b) + '</td></tr>').join('') + '</table>' +
      (() => {
        const dodatkowa = (d.pozycje || []).some((p) => p.projektZakupu || p.projekt || (p.sn && p.stanTech && p.stanTech !== 'nowy'));
        const tytulKol = r === 'WZ' || r === 'WZZ' ? 'Kupione pod' : r === 'ZW' ? 'Stan' : 'Pod projekt / stan';
        return '<table class="d-pozycje"><thead><tr><th class="d-lp">Lp.</th><th>Producent i model</th><th>Kod producenta</th><th>Nr seryjny</th><th class="l">Ilość</th><th>Lokalizacja</th>' + (dodatkowa ? '<th>' + tytulKol + '</th>' : '') + '</tr></thead><tbody>' +
          (d.pozycje || []).map((p, i) => {
            const m = model(p.modelId);
            return '<tr class="' + (C.czyZastepcze(p.projektZakupu, d.projekt) ? 'd-zast' : '') + '"><td class="d-lp">' + (i + 1) + '</td><td>' + esc(nazwaModelu(p.modelId)) + '</td><td>' + esc(m.pn || '') + '</td><td class="d-sn">' + esc(p.sn || '') + '</td><td class="l">' + fmtL(p.ilosc || 1) + ' ' + esc(jmw(m.jednostka)) + '</td><td>' + esc(p.lok || '') + '</td>' + (dodatkowa ? '<td>' + esc(p.projektZakupu || p.projekt || p.stanTech || '') + '</td>' : '') + '</tr>';
          }).join('') + '</tbody></table>';
      })() +
      (d.uwagi ? '<p class="d-uwagi"><b>Uwagi:</b> ' + esc(d.uwagi) + '</p>' : '') +
      '<div class="d-podpisy">' + podpisy.map((p) => '<div><div class="d-linia"></div>' + p + '<br><small>data i czytelny podpis</small></div>').join('') + '</div>' +
      '<footer class="d-stopka"><span>' + esc(FIRMA.nazwa) + ' · ' + FIRMA.email + ' · ' + FIRMA.www + '</span><span>Wygenerowano w aplikacji Magazyn · ' + esc(d.numer) + ' · id ' + esc(ev.id) + ' · suma kontrolna ' + esc((ev.hash || '').slice(0, 12)) + '</span></footer>' +
      '</div>';
    $('#druk').innerHTML = html;
    setTimeout(() => window.print(), 60);
  }

  // ------------------------------------------------------------ edycja kartotek

  function linkSzukajKarty(producent, modelNazwa, pn) {
    const q = [producent, modelNazwa, pn].map((x) => C.norm(x)).filter(Boolean).join(' ');
    return 'https://www.google.com/search?q=' + encodeURIComponent(q + ' karta katalogowa datasheet pdf');
  }

  async function edytujModel(id, poz, wstepne) {
    const p = C.podpowiedzi(app.st);
    const w0 = Object.assign({}, wstepne || {});
    if (w0.model && !w0.producent) {
      // „samsung qm55c” → producent Samsung, model QM55C
      const slowa = C.norm(w0.model).split(/\s+/);
      const prod = p.producenci.find((x) => C.normKlucz(x) === C.normKlucz(slowa[0]));
      if (prod && slowa.length > 1) Object.assign(w0, { producent: prod, model: slowa.slice(1).join(' ') });
    }
    const m = id ? app.st.modele.get(id) : Object.assign({ kategoria: '', producent: '', model: '', pn: '', ean: '', seryjny: true, jednostka: 'szt', jednostkaZakupu: '', przelicznik: '', stanMin: '', status: 'aktywny', link: '', kartaPlik: '' }, w0);
    const uzyty = id && Array.from(app.st.dokumenty.values()).some((w) => (w.ev.dane.pozycje || []).some((p) => p.modelId === id));
    let nowyPlik = null;
    let usunPlik = false;
    const wynik = await dialog({
      tytul: id ? 'Edycja modelu' : 'Nowy model w kartotece',
      szeroki: true,
      tresc: '<h3 class="sekcja">Opis</h3><div class="siatka">' +
        pole('Kategoria *', '<select name="kategoria">' + C.KATEGORIE.map((k) => '<option ' + (k === m.kategoria ? 'selected' : '') + '>' + esc(k) + '</option>').join('') + '</select>') +
        pole('Producent', wybierak('producenci', 'n:producent', m.producent, { placeholder: 'np. Samsung' })) +
        pole('Model lub nazwa *', '<input name="model" value="' + esc(m.model) + '" placeholder="np. QM55C">', 'szerokie') +
        pole('Kod producenta (P/N)', '<input name="pn" value="' + esc(m.pn) + '">') +
        pole('EAN', '<input name="ean" value="' + esc(m.ean) + '" inputmode="numeric">') +
        '</div>' +
        '<h3 class="sekcja">Ewidencja</h3><div class="siatka">' +
        '<div class="pole szerokie"><span>Sposób ewidencji ' + pomoc('seryjny') + '</span><label class="przelacznik"><input type="checkbox" name="seryjny" ' + (m.seryjny ? 'checked' : '') + (uzyty ? ' disabled' : '') + '><span>śledź każdą sztukę po numerze seryjnym</span></label>' + (uzyty ? '<small class="szary">Model występuje już w dokumentach, więc sposobu ewidencji nie można zmienić.</small>' : '') + '</div>' +
        pole('Jednostka', '<select name="jednostka"><option value="szt" ' + (m.jednostka !== 'm' ? 'selected' : '') + '>szt. (sztuki)</option><option value="m" ' + (m.jednostka === 'm' ? 'selected' : '') + '>m (metry)</option></select>', '', 'jednostka') +
        pole('Stan minimalny', '<input name="stanMin" value="' + esc(m.stanMin || '') + '" inputmode="decimal" placeholder="brak">', '', 'stanMin') +
        pole('Status', '<select name="status">' + [['aktywny', 'aktywny'], ['EOL', 'EOL – wycofany przez producenta'], ['wycofany', 'wycofany z naszej oferty']].map(([v, n]) => '<option value="' + v + '" ' + ((m.status || 'aktywny') === v ? 'selected' : '') + '>' + n + '</option>').join('') + '</select>', '', 'status') +
        '<div class="pole szerokie" data-blok-opak' + (m.seryjny ? ' hidden' : '') + '><span>Opakowanie zakupu ' + pomoc('jednostkaZakupu') + '</span><label class="przelacznik"><input type="checkbox" name="opak" ' + (m.jednostkaZakupu ? 'checked' : '') + '><span>kupujecie w opakowaniach (szpula, karton, paczka)</span></label></div>' +
        '<div class="pole" data-pola-opak' + (m.seryjny || !m.jednostkaZakupu ? ' hidden' : '') + '><span>Nazwa opakowania</span><input name="jednostkaZakupu" value="' + esc(m.jednostkaZakupu || '') + '" placeholder="np. szpula, karton"></div>' +
        '<div class="pole" data-pola-opak' + (m.seryjny || !m.jednostkaZakupu ? ' hidden' : '') + '><span data-ile-w-opak>Ile ' + esc(jmw(m.jednostka)) + ' w opakowaniu</span><input name="przelicznik" value="' + esc(m.przelicznik || '') + '" inputmode="decimal" placeholder="np. 305"></div>' +
        '</div>' +
        '<h3 class="sekcja">Karta katalogowa ' + pomoc('karta') + '</h3>' +
        '<div class="karta-katalogowa">' +
          '<label class="pole szerokie"><span>Link do karty na stronie producenta</span><div class="wiersz-linku"><input name="link" value="' + esc(m.link || '') + '" placeholder="https://…" inputmode="url">' +
          '<button type="button" class="przycisk" data-karta="szukaj">' + ikona('szuk') + 'Szukaj w internecie</button>' +
          '<button type="button" class="przycisk" data-karta="otworz">' + ikona('link') + 'Otwórz</button></div></label>' +
          '<div class="pole szerokie"><span>Plik PDF zapisany w folderze magazynu (działa także bez internetu)</span><div class="wiersz-linku">' +
            '<span class="plik-karty" data-plik-nazwa>' + (m.kartaPlik ? ikona('karta') + esc(m.kartaPlik.split('/').pop()) : '<span class="szary">brak pliku</span>') + '</span>' +
            '<button type="button" class="przycisk" data-karta="plik">' + ikona('plus') + (m.kartaPlik ? 'Zmień plik' : 'Dołącz plik PDF') + '</button>' +
            (m.kartaPlik ? '<button type="button" class="przycisk tekstowy" data-karta="usun">Odłącz</button>' : '') +
            '<input type="file" accept="application/pdf,image/*" class="ukryty" data-plik-karty></div></div>' +
        '</div>',
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: 'Zapisz model', klasa: 'glowny', submit: true }],
      przyOtwarciu: (f) => {
        const kat = f.kategoria;
        const ser = f.seryjny;
        const jd = f.jednostka;
        if (!id) {
          const ustaw = () => {
            const mat = ['Okablowanie', 'Korytka i osłony kabli', 'Złącza i osprzęt', 'Uchwyty i montaż'].includes(kat.value);
            ser.checked = !mat;
            jd.value = ['Okablowanie', 'Korytka i osłony kabli'].includes(kat.value) ? 'm' : 'szt';
          };
          kat.addEventListener('change', ustaw);
        }
        const opak = f.opak;
        const odswiezOpakowanie = () => {
          if (ser.checked) jd.value = 'szt';
          jd.disabled = ser.checked || !!uzyty;
          $('[data-blok-opak]', f).hidden = ser.checked;
          $$('[data-pola-opak]', f).forEach((el) => { el.hidden = ser.checked || !opak.checked; });
          $('[data-ile-w-opak]', f).textContent = 'Ile ' + jmw(jd.value) + ' w opakowaniu';
        };
        odswiezOpakowanie();
        ser.addEventListener('change', odswiezOpakowanie);
        kat.addEventListener('change', odswiezOpakowanie);
        jd.addEventListener('change', odswiezOpakowanie);
        opak.addEventListener('change', () => {
          odswiezOpakowanie();
          if (opak.checked) f.jednostkaZakupu.focus();
        });
        const wejsciePliku = $('[data-plik-karty]', f);
        wejsciePliku.addEventListener('change', () => {
          nowyPlik = wejsciePliku.files[0] || null;
          usunPlik = false;
          if (nowyPlik) $('[data-plik-nazwa]', f).innerHTML = ikona('karta') + esc(nowyPlik.name) + ' <span class="szary">(zapisze się po kliknięciu „Zapisz model”)</span>';
        });
        f.addEventListener('click', (e) => {
          const b = e.target.closest('[data-karta]');
          if (!b) return;
          e.preventDefault();
          const akcja = b.dataset.karta;
          if (akcja === 'szukaj') window.open(linkSzukajKarty(f.producent.value, f.model.value, f.pn.value), '_blank', 'noopener');
          if (akcja === 'otworz') {
            const l = f.link.value.trim();
            if (!l) return toast('Najpierw wklej link do karty', 'blad');
            window.open(/^https?:\/\//i.test(l) ? l : 'https://' + l, '_blank', 'noopener');
          }
          if (akcja === 'plik') wejsciePliku.click();
          if (akcja === 'usun') {
            usunPlik = true;
            nowyPlik = null;
            $('[data-plik-nazwa]', f).innerHTML = '<span class="szary">plik zostanie odłączony (zostaje w folderze „karty”)</span>';
          }
        });
      },
      przyWyslaniu: async (f) => {
        let link = f.link.value.trim();
        if (link && !/^https?:\/\//i.test(link)) link = 'https://' + link;
        const seryjny = uzyty ? !!m.seryjny : f.seryjny.checked;
        const dane = {
          modelId: id || 'm-' + C.noweId(8), kategoria: f.kategoria.value, producent: f.producent.value.trim(), model: f.model.value.trim(), pn: f.pn.value.trim(), ean: f.ean.value.trim(),
          seryjny, jednostka: seryjny ? 'szt' : uzyty ? m.jednostka || 'szt' : f.jednostka.value,
          jednostkaZakupu: !seryjny && f.opak.checked ? f.jednostkaZakupu.value.trim() : '', przelicznik: !seryjny && f.opak.checked ? Number(f.przelicznik.value.replace(',', '.')) || '' : '', stanMin: Number(f.stanMin.value.replace(',', '.')) || '', status: f.status.value, link,
          kartaPlik: usunPlik ? '' : m.kartaPlik || '',
        };
        if (!dane.model) throw new Error('Podaj nazwę modelu');
        if (!seryjny && f.opak.checked) {
          if (!dane.jednostkaZakupu) throw new Error('Podaj nazwę opakowania (np. szpula) albo odznacz „kupujecie w opakowaniach”');
          if (!(dane.przelicznik > 0)) throw new Error('Podaj, ile ' + jmw(dane.jednostka) + ' jest w opakowaniu (np. 305 m w szpuli)');
          if (C.normKlucz(dane.jednostkaZakupu).replace(/\.$/, '') === C.normKlucz(jmw(dane.jednostka)).replace(/\.$/, '')) throw new Error('Opakowanie musi być czymś innym niż jednostka (np. szpula, karton)');
        }
        const dubel = Array.from(app.st.modele.values()).find((x) => x.modelId !== dane.modelId && C.normKlucz(x.producent + ' ' + x.model) === C.normKlucz(dane.producent + ' ' + dane.model));
        if (dubel) throw new Error('Taki model już jest w kartotece');
        if (nowyPlik) {
          const rozsz = (nowyPlik.name.split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
          const nazwa = (dane.producent + '-' + dane.model).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || dane.modelId;
          dane.kartaPlik = 'karty/' + nazwa + '_' + C.noweId(4) + '.' + rozsz;
          await app.store.zapisz(dane.kartaPlik, nowyPlik);
        }
        await utworzZdarzenie('MODEL', dane);
        return dane.modelId;
      },
    });
    if (!wynik) return;
    toast('Zapisano model', 'ok');
    if (poz !== undefined && app.szkic) {
      const mm = app.st.modele.get(wynik);
      const pusta = app.szkic.pozycje.find((x) => !x.modelId && !C.norm(x.modelLabel));
      if (poz === 'nowa' && !pusta) app.szkic.pozycje.push({ modelLabel: etykietaModelu(mm), modelId: wynik, lok: '', snTekst: '', ilosc: '', jedn: 'baza', stanTech: 'nowy', projekt: '' });
      else {
        const p2 = poz === 'nowa' ? pusta : app.szkic.pozycje[Number(poz)];
        if (p2) { p2.modelId = wynik; p2.modelLabel = etykietaModelu(mm); }
      }
    }
    render();
  }

  async function otworzKarte(modelId) {
    const m = app.st.modele.get(modelId);
    if (!m) return;
    if (m.kartaPlik) {
      try {
        const plik = await app.store.czytaj(m.kartaPlik);
        const typ = /\.pdf$/i.test(m.kartaPlik) ? 'application/pdf' : plik.type;
        window.open(URL.createObjectURL(new Blob([plik], { type: typ })), '_blank');
        return;
      } catch (e) {
        if (!m.link) return toast('Nie można otworzyć pliku karty: ' + e.message, 'blad');
      }
    }
    if (m.link) window.open(m.link, '_blank', 'noopener');
    else toast('Ten model nie ma karty katalogowej – dodaj ją w kartotece', 'blad');
  }

  // ------------------------------------------------------------ dane firm z rejestru (Biała lista VAT)

  /** „UL. GRANICZNA 19, 05-092 ŁOMIANKI” → „ul. Graniczna 19, 05-092 Łomianki”. */
  function ladnyAdres(a) {
    return String(a || '').toLowerCase().replace(/(^|[\s,("\-/])(\p{L})/gu, (m, p, l) => p + l.toUpperCase())
      .replace(/(\d)(\p{Ll})(?!\p{L})/gu, (m, c, l) => c + l.toUpperCase()) // 26a → 26A
      .replace(/(^|\s)(Ul|Al|Pl|Os|Ks|Gen)\./g, (m, p, w) => p + w.toLowerCase() + '.');
  }

  /** Nazwa skrócona z pełnej nazwy rejestrowej: „„APLAUZ” SPÓŁKA Z OGRANICZONĄ…” → „Aplauz”. */
  function skrotNazwy(pelna) {
    const bez = String(pelna || '').replace(/[„”"'«»]/g, ' ')
      .replace(/\b(SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ|SP\.? Z O\.? ?O\.?|SPÓŁKA AKCYJNA|S\.A\.|SPÓŁKA KOMANDYTOWA|SP\.? K\.|SPÓŁKA JAWNA|SP\.? J\.|SPÓŁKA CYWILNA|S\.C\.)(?=\s|$)/giu, ' ')
      .replace(/\s+/g, ' ').trim();
    return bez.split(' ').map((w) => (/^[\p{Lu}\d&.-]{1,3}$/u.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join(' ');
  }

  /** NIP: polski zapisujemy jako 10 cyfr, zagraniczny (np. DE…) zostawiamy jak jest. */
  function normNip(v) {
    const t = C.norm(v).toUpperCase().replace(/[\s-]/g, '');
    if (/^(PL)?\d{10}$/.test(t)) return t.replace(/^PL/, '');
    return t;
  }

  class BladRejestru extends Error {
    constructor(tekst, html) {
      super(tekst);
      this.html = html || esc(tekst);
    }
  }

  /** Pobiera dane firmy z publicznego wykazu podatników VAT Ministerstwa Finansów. */
  async function pobierzZRejestru(nip) {
    const c = normNip(nip);
    if (!/^\d{10}$/.test(c) || !C.poprawnyNip(c)) throw new BladRejestru('Wpisz poprawny polski NIP (10 cyfr).');
    let odp;
    try {
      odp = await fetch('https://wl-api.mf.gov.pl/api/search/nip/' + c + '?date=' + dzis(), { headers: { Accept: 'application/json' } });
    } catch (e) {
      throw new BladRejestru('Brak połączenia z wykazem podatników VAT.', 'Nie udało się połączyć z wykazem podatników VAT (brak internetu albo połączenie zablokowała sieć firmowa). Dane sprawdzisz ręcznie w <a href="https://www.podatki.gov.pl/wykaz-podatnikow-vat-wyszukiwarka" target="_blank" rel="noopener">wyszukiwarce Ministerstwa Finansów</a>.');
    }
    let j = null;
    try { j = await odp.json(); } catch (e) { /* pusta odpowiedź */ }
    if (!odp.ok) throw new BladRejestru('Wykaz podatników VAT odpowiedział błędem' + (j && j.message ? ': ' + j.message : ' (' + odp.status + ')') + '. Spróbuj za chwilę.');
    const s = j && j.result && j.result.subject;
    if (!s) throw new BladRejestru('Nie znaleziono firmy o NIP ' + c + ' w wykazie podatników VAT (może nie być czynnym podatnikiem VAT). Wpisz dane ręcznie.');
    return { pelnaNazwa: C.norm(s.name), nip: C.norm(s.nip) || c, regon: C.norm(s.regon), krs: C.norm(s.krs), adres: ladnyAdres(s.workingAddress || s.residenceAddress || ''), statusVat: C.norm(s.statusVat) };
  }

  const poleNip = (wartosc) => pole('NIP', '<div class="wiersz-linku"><input name="nip" value="' + esc(wartosc || '') + '" inputmode="numeric" placeholder="10 cyfr" autocomplete="off"><button type="button" class="przycisk" data-rejestr data-tip="' + esc(P.TIPY.bialaLista) + '">' + ikona('pobierz') + 'Pobierz z rejestru</button></div><small class="info-nip" data-nip-info></small>', 'szerokie', 'nip');

  /** Sprawdzanie NIP w trakcie pisania i przycisk „Pobierz z rejestru” w oknie klienta lub dostawcy. */
  function podlaczRejestr(f, naPobrane) {
    const info = $('[data-nip-info]', f);
    const sprawdz = () => {
      const v = C.norm(f.nip.value);
      if (!v) info.innerHTML = '';
      else if (/^(PL)?[\d\s-]+$/i.test(v)) info.innerHTML = C.poprawnyNip(v) ? '<span class="ok-tekst">✓ poprawny NIP</span> – kliknij „Pobierz z rejestru”, żeby uzupełnić nazwę i adres.' : '<span class="blad-tekst" style="display:inline">nieprawidłowy NIP – sprawdź cyfry</span>';
      else info.textContent = 'NIP zagraniczny – bez sprawdzania sumy kontrolnej.';
    };
    f.nip.addEventListener('input', sprawdz);
    sprawdz();
    f.addEventListener('click', async (e) => {
      const krs = e.target.closest('[data-krs]');
      if (krs) {
        e.preventDefault();
        const k = C.cyfry(f.krs.value);
        if (!k) return toast('Najpierw wpisz numer KRS', 'blad');
        window.open('https://rejestr.io/krs/' + Number(k), '_blank', 'noopener');
        return;
      }
      const b = e.target.closest('[data-rejestr]');
      if (!b) return;
      e.preventDefault();
      const etykieta = b.innerHTML;
      b.disabled = true;
      b.textContent = 'Pobieram…';
      try {
        const d = await pobierzZRejestru(f.nip.value);
        f.nip.value = d.nip;
        naPobrane(d);
        info.innerHTML = '<span class="ok-tekst">✓ Pobrano z wykazu podatników VAT</span>' + (d.statusVat ? ' · status VAT: ' + esc(d.statusVat.toLowerCase()) : '') + ' · sprawdź i zapisz.';
      } catch (err) {
        info.innerHTML = '<span class="blad-tekst" style="display:inline">' + (err.html || esc(err.message)) + '</span>';
      } finally {
        b.disabled = false;
        b.innerHTML = etykieta;
      }
    });
  }

  async function edytujKlienta(id, wstepne) {
    const k = id ? app.st.klienci.get(id) : Object.assign({ nazwa: '', nip: '', adres: '', kontakt: '', tel: '', email: '' }, wstepne || {});
    const w = await dialog({
      tytul: id ? 'Edycja klienta' : 'Nowy klient', szeroki: true,
      tresc: '<div class="siatka">' + poleNip(k.nip) + pole('Nazwa firmy *', '<input name="nazwa" value="' + esc(k.nazwa) + '">', 'szerokie') + pole('Adres', '<input name="adres" value="' + esc(k.adres) + '">', 'szerokie') + pole('Osoba kontaktowa', '<input name="kontakt" value="' + esc(k.kontakt) + '">') + pole('Telefon', '<input name="tel" value="' + esc(k.tel) + '">') + pole('E-mail', '<input name="email" value="' + esc(k.email) + '">') + '</div>',
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: 'Zapisz klienta', klasa: 'glowny', submit: true }],
      przyOtwarciu: (f) => podlaczRejestr(f, (d) => {
        if (!C.norm(f.nazwa.value)) f.nazwa.value = d.pelnaNazwa;
        if (d.adres) f.adres.value = d.adres;
      }),
      przyWyslaniu: async (f) => {
        const dane = { klientId: id || 'k-' + C.noweId(8), nazwa: f.nazwa.value.trim(), nip: normNip(f.nip.value), adres: f.adres.value.trim(), kontakt: f.kontakt.value.trim(), tel: f.tel.value.trim(), email: f.email.value.trim() };
        if (!dane.nazwa) throw new Error('Podaj nazwę firmy');
        if (/^\d+$/.test(dane.nip) && !C.poprawnyNip(dane.nip)) throw new Error('Nieprawidłowy NIP – sprawdź cyfry (nie zgadza się suma kontrolna)');
        const dubel = Array.from(app.st.klienci.values()).find((x) => x.klientId !== dane.klientId && C.normKlucz(x.nazwa) === C.normKlucz(dane.nazwa));
        if (dubel) throw new Error('Klient o tej nazwie już jest na liście');
        await utworzZdarzenie('KLIENT', dane);
        return dane.nazwa;
      },
    });
    if (w) { toast('Zapisano klienta', 'ok'); render(); }
    return w;
  }

  async function edytujDostawce(id, wstepne) {
    const d = id ? app.st.dostawcy.get(id) : Object.assign({ nazwa: '', pelnaNazwa: '', nip: '', regon: '', krs: '', adres: '', adresBiura: '', tel: '', email: '', www: '', marki: '', uwagi: '', aktywny: true }, wstepne || {});
    if (!d) return null;
    let pobrano = '';
    const wej = (nazwa, atr) => '<input name="' + nazwa + '" value="' + esc(d[nazwa] || '') + '" ' + (atr || '') + '>';
    const w = await dialog({
      tytul: id ? 'Dostawca: ' + esc(d.nazwa) : 'Nowy dostawca', szeroki: true,
      tresc: (d.wbudowany ? '<div class="alert info maly">Dostawca z wbudowanej biblioteki – ' + esc(d.zrodlo || '') + '. Dane możesz poprawić; zmiana zapisze się w dzienniku.</div>' : '') +
        '<div class="siatka">' + poleNip(d.nip) +
        pole('Nazwa skrócona *', wej('nazwa', 'placeholder="np. Polsound"'), '', 'dostawca') +
        pole('Marki / co u nich kupujemy', wej('marki', 'placeholder="np. Shure, Sony"')) +
        pole('Pełna nazwa (z rejestru)', wej('pelnaNazwa'), 'szerokie') +
        pole('REGON', wej('regon', 'inputmode="numeric"')) +
        pole('KRS', '<div class="wiersz-linku">' + wej('krs', 'inputmode="numeric"') + '<button type="button" class="przycisk" data-krs data-tip="Otwiera dane spółki w serwisie rejestr.io">' + ikona('link') + 'Sprawdź</button></div>') +
        pole('Adres siedziby', wej('adres'), 'szerokie') +
        pole('Adres biura lub magazynu', wej('adresBiura', 'placeholder="jeśli inny niż siedziba"'), 'szerokie') +
        pole('Telefon', wej('tel')) + pole('E-mail', wej('email', 'inputmode="email"')) + pole('Strona www', wej('www', 'placeholder="np. polsound.pl"')) +
        pole('Uwagi', wej('uwagi'), 'szerokie') +
        '<div class="pole szerokie"><span>Na listach</span><label class="przelacznik"><input type="checkbox" name="aktywny" ' + (d.aktywny !== false ? 'checked' : '') + '><span>pokazuj tego dostawcę przy przyjęciu</span></label></div>' +
        '</div><p class="szary maly odstep-gora" data-zrodlo-info>' + (d.zrodlo ? 'Źródło danych: ' + esc(d.zrodlo) : '') + '</p>',
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: 'Zapisz dostawcę', klasa: 'glowny', submit: true }],
      przyOtwarciu: (f) => podlaczRejestr(f, (r) => {
        f.pelnaNazwa.value = r.pelnaNazwa;
        if (!C.norm(f.nazwa.value)) f.nazwa.value = skrotNazwy(r.pelnaNazwa);
        if (r.regon) f.regon.value = r.regon;
        if (r.krs) f.krs.value = r.krs;
        if (r.adres) f.adres.value = r.adres;
        pobrano = 'Biała lista VAT (Ministerstwo Finansów), pobrano ' + fmtData(dzis());
        $('[data-zrodlo-info]', f).textContent = 'Źródło danych: ' + pobrano;
      }),
      przyWyslaniu: async (f) => {
        const t = (n) => f[n].value.trim();
        const dane = { dostawcaId: (id && d.dostawcaId) || 'd-' + C.noweId(8), nazwa: t('nazwa'), pelnaNazwa: t('pelnaNazwa'), nip: normNip(t('nip')), regon: C.cyfry(t('regon')), krs: C.cyfry(t('krs')) ? C.cyfry(t('krs')).padStart(10, '0') : '', adres: t('adres'), adresBiura: t('adresBiura'), tel: t('tel'), email: t('email'), www: t('www').replace(/^https?:\/\//i, '').replace(/\/$/, ''), marki: t('marki'), uwagi: t('uwagi'), aktywny: f.aktywny.checked };
        if (pobrano) dane.zrodlo = pobrano;
        else if (!id) dane.zrodlo = 'wpisane ręcznie ' + fmtData(dzis());
        if (!dane.nazwa) throw new Error('Podaj nazwę skróconą dostawcy (tak będzie widoczny na listach)');
        if (/^\d+$/.test(dane.nip) && !C.poprawnyNip(dane.nip)) throw new Error('Nieprawidłowy NIP – sprawdź cyfry (nie zgadza się suma kontrolna)');
        if (dane.regon && !C.poprawnyRegon(dane.regon)) throw new Error('Nieprawidłowy REGON – sprawdź cyfry');
        for (const x of app.st.dostawcy.values()) {
          if (x.dostawcaId === dane.dostawcaId) continue;
          if (C.normKlucz(x.nazwa) === C.normKlucz(dane.nazwa)) throw new Error('Dostawca o nazwie „' + x.nazwa + '” już jest w bibliotece');
          if (dane.nip && x.nip && normNip(x.nip) === dane.nip) throw new Error('Ten NIP ma już dostawca „' + x.nazwa + '”');
        }
        await utworzZdarzenie('DOSTAWCA', dane);
        return dane.nazwa;
      },
    });
    if (w) { toast('Zapisano dostawcę', 'ok'); render(); }
    return w;
  }

  // ------------------------------------------------------------ projekty

  function czyProjektUzyty(numer) {
    const k = C.normKlucz(numer);
    if (!k) return false;
    for (const { ev } of app.st.dokumenty.values()) {
      const d = ev.dane;
      if (C.normKlucz(d.projekt) === k || (d.pozycje || []).some((p) => C.normKlucz(p.projekt) === k || C.normKlucz(p.projektZakupu) === k)) return true;
    }
    return false;
  }

  /**
   * Okno projektu. Zwraca numer zapisanego projektu, 'pomin' (przy zapisie dokumentu: dalej bez nazwy) albo null.
   * opcje.przyZapisie – okno wywołane z zapisu dokumentu, gdy numer pojawia się po raz pierwszy.
   */
  async function edytujProjekt(id, wstepne, opcje = {}) {
    let p = id ? app.st.rejestrProjektow.get(id) : null;
    if (!p && wstepne && wstepne.numer) p = C.projektWgNumeru(app.st, wstepne.numer);
    const nowy = !p;
    const d = Object.assign({ numer: '', nazwa: '', klientNazwa: '', adres: '', status: 'w toku', uwagi: '' }, p || {}, nowy ? wstepne || {} : {});
    if (nowy && !d.nazwa) d.nazwa = C.nazwaProjektu(app.st, d.numer);
    const zablokowany = !!d.numer && czyProjektUzyty(d.numer);
    const w = await dialog({
      tytul: opcje.przyZapisie ? 'Nowy projekt ' + esc(d.numer) : nowy ? 'Nowy projekt' : 'Projekt ' + esc(d.numer), szeroki: true,
      tresc: (opcje.przyZapisie ? '<p>Projekt <b>' + esc(d.numer) + '</b> pojawia się po raz pierwszy. Podaj jego nazwę – będzie widoczna obok numeru na listach, w raportach i na wydruku, a projekt znajdziesz potem także po nazwie.</p>' : '') +
        '<div class="siatka">' +
        pole('Numer projektu *', '<input name="numer" value="' + esc(d.numer) + '" placeholder="np. P-2026-014"' + (zablokowany ? ' readonly' : '') + '>' + (zablokowany ? '<small class="szary">Numer jest już użyty w dokumentach, więc nie można go zmienić.</small>' : ''), '', 'projektNumer') +
        pole('Nazwa projektu *', '<input name="nazwa" value="' + esc(d.nazwa) + '" placeholder="np. Kancelaria Beta – sale konferencyjne">', 'szerokie-2', 'projektNazwa') +
        pole('Klient', wybierak('klienci', 'n:klientNazwa', d.klientNazwa, { placeholder: 'wybierz z listy albo wpisz' }), 'szerokie-2', 'klient') +
        pole('Adres obiektu', wybierak('adresy', 'n:adres', d.adres, { placeholder: 'gdzie jest realizowany projekt' }), 'szerokie-2', 'adresObiektu') +
        pole('Status', '<select name="status"><option value="w toku"' + (d.status !== 'zakończony' ? ' selected' : '') + '>w toku</option><option value="zakończony"' + (d.status === 'zakończony' ? ' selected' : '') + '>zakończony</option></select>', '', 'projektStatus') +
        pole('Uwagi', '<input name="uwagi" value="' + esc(d.uwagi || '') + '">', 'szerokie') +
        '</div>',
      przyciski: opcje.przyZapisie
        ? [{ wartosc: 'anuluj', etykieta: 'Wróć do dokumentu' }, { wartosc: 'pomin', etykieta: 'Dalej bez nazwy' }, { wartosc: 'ok', etykieta: 'Zapisz projekt', klasa: 'glowny', submit: true }]
        : [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: 'Zapisz projekt', klasa: 'glowny', submit: true }],
      fokus: d.numer ? 'nazwa' : 'numer',
      przyWyslaniu: async (f, wartosc) => {
        if (wartosc === 'pomin') return 'pomin';
        const dane = { projektId: (p && p.projektId) || 'pr-' + C.noweId(8), numer: C.norm(f.numer.value), nazwa: C.norm(f.nazwa.value), klientNazwa: C.norm(f.klientNazwa.value), adres: C.norm(f.adres.value), status: f.status.value, uwagi: C.norm(f.uwagi.value) };
        if (!dane.numer) throw new Error('Podaj numer projektu');
        if (!dane.nazwa) throw new Error('Podaj nazwę projektu' + (opcje.przyZapisie ? ' albo kliknij „Dalej bez nazwy”' : ''));
        const inny = C.projektWgNumeru(app.st, dane.numer);
        if (inny && inny.projektId !== dane.projektId) throw new Error('Projekt ' + inny.numer + ' już jest w rejestrze („' + inny.nazwa + '”)');
        await utworzZdarzenie('PROJEKT', dane);
        return dane.numer;
      },
    });
    if (w && w !== 'pomin' && !opcje.przyZapisie) { toast('Zapisano projekt ' + w, 'ok'); render(); }
    return w;
  }

  async function pokazProjekt(numer) {
    const k = C.normKlucz(numer);
    const p = C.listaProjektow(app.st).find((x) => C.normKlucz(x.numer) === k) || { numer, nazwa: '', status: 'w toku' };
    const docs = C.dokumentyLista(app.st).filter((d) => C.normKlucz(d.ev.dane.projekt) === k || (d.ev.dane.pozycje || []).some((x) => C.normKlucz(x.projekt) === k));
    const wMag = C.wierszeMagazynu(app.st).filter((x) => C.normKlucz(x.projekt) === k);
    const wyd = C.wydaneNaProjekt(app.st, numer);
    const doUzup = app.st.uzupelnienia.filter((u) => !u.zamkniete && C.normKlucz(u.projektZakupu) === k);
    const tab = (naglowki, wiersze, pusto) => wiersze.length ? '<div class="tabela-owijka"><table class="tabela"><thead><tr>' + naglowki.map((h) => '<th>' + h + '</th>').join('') + '</tr></thead><tbody>' + wiersze.join('') + '</tbody></table></div>' : '<p class="szary">' + pusto + '</p>';
    const tresc = '<dl class="opis"><dt>Numer</dt><dd><b>' + esc(p.numer) + '</b></dd><dt>Nazwa</dt><dd>' + (p.nazwa ? esc(p.nazwa) : '<span class="ostrz-tekst">bez nazwy</span>') + '</dd>' +
      (p.klientNazwa ? '<dt>Klient</dt><dd>' + esc(p.klientNazwa) + '</dd>' : '') + (p.adres ? '<dt>Adres obiektu</dt><dd>' + esc(p.adres) + '</dd>' : '') +
      '<dt>Status</dt><dd>' + (p.status === 'zakończony' ? '<span class="znaczek anul">zakończony</span>' : '<span class="znaczek ok">w toku</span>') + '</dd>' + (p.uwagi ? '<dt>Uwagi</dt><dd>' + esc(p.uwagi) + '</dd>' : '') + '</dl>' +
      (doUzup.length ? '<div class="alert wzz-alert"><b>' + doUzup.length + ' ' + odm(doUzup.length, 'pozycja kupiona', 'pozycje kupione', 'pozycji kupionych') + ' pod ten projekt</b> poszło wydaniem zastępczym na inny projekt – trzeba je dokupić (lista „Do uzupełnienia”).</div>' : '') +
      '<h3>W magazynie pod ten projekt</h3>' + tab(['Model', 'Nr seryjny', 'Ilość', 'Lokalizacja'], wMag.map((x) => '<tr><td>' + esc(nazwaModelu(x.modelId)) + '</td><td class="mono">' + esc(x.sn) + '</td><td class="l">' + fmtIl(x.modelId, x.ilosc) + '</td><td>' + esc(x.lok) + '</td></tr>'), 'Nic nie czeka w magazynie.') +
      '<h3>Wydane na projekt</h3>' + tab(['Model', 'Nr seryjny', 'Ilość', 'Klient', 'Dokument'], wyd.map((x) => '<tr><td>' + esc(nazwaModelu(x.modelId)) + '</td><td class="mono">' + esc(x.sn) + '</td><td class="l">' + fmtIl(x.modelId, x.ilosc) + '</td><td>' + esc(x.klient) + '</td><td>' + esc(x.numer || '') + '</td></tr>'), 'Nic nie zostało wydane.') +
      '<h3>Dokumenty</h3>' + tab(['Numer', 'Rodzaj', 'Data', 'Pozycje', 'Wystawił'], docs.map((d) => '<tr data-dok="' + esc(d.ev.id) + '" tabindex="0" class="klikalny' + (d.anulowany ? ' anulowany' : '') + '"><td><b class="nowrap">' + esc(d.ev.dane.numer) + '</b></td><td>' + znacznikDok(d) + '</td><td class="nowrap">' + fmtData(d.ev.dane.data || d.ev.ts) + '</td><td class="l">' + (d.ev.dane.pozycje || []).length + '</td><td>' + esc(osoba(d.ev.autor)) + '</td></tr>'), 'Brak dokumentów.');
    const przyciski = [{ wartosc: 'edytuj', etykieta: p.nazwa ? 'Edytuj projekt' : 'Uzupełnij nazwę' }];
    if (wyd.length) przyciski.push({ wartosc: 'zwrot', etykieta: ikona('zwrot') + 'Zwrot z projektu' });
    przyciski.push({ wartosc: 'wydaj', etykieta: ikona('wyd') + 'Wydaj na ten projekt' }, { wartosc: 'ok', etykieta: 'Zamknij', klasa: 'glowny' });
    const w = await dialog({
      tytul: esc(p.numer) + (p.nazwa ? ' · ' + esc(p.nazwa) : ''), szeroki: true, tresc, przyciski,
      przyOtwarciu: (f) => {
        f.addEventListener('click', (e) => {
          const t = e.target.closest('[data-dok]');
          if (t) { e.preventDefault(); otwartyDialog.zamknij('dok:' + t.dataset.dok); }
        });
        f.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-dok]')) { e.preventDefault(); otwartyDialog.zamknij('dok:' + e.target.dataset.dok); } });
      },
    });
    if (!w) return;
    if (w.startsWith('dok:')) return pokazDokument(w.slice(4));
    if (w === 'edytuj') return edytujProjekt(p.projektId || null, { numer: p.numer });
    if (w === 'wydaj') return AKCJE.nowyDok({ dataset: { r: 'WZ', projekt: p.numer } });
    if (w === 'zwrot') return AKCJE.nowyDok({ dataset: { r: 'ZW', projekt: p.numer } });
  }

  // ------------------------------------------------------------ użytkownicy, logowanie i blokada ekranu
  //
  // Każdy loguje się swoim PIN-em. Swój profil i PIN zmienia tylko właściciel. Reset PIN-u i wyłączenie
  // cudzego konta trzeba potwierdzić własnym PIN-em – zostają w dzienniku, a osoba po resecie musi
  // przy logowaniu ustawić własny PIN i widzi, kto zrobił reset.

  const MAKS_PROB = 5;
  const PAUZA_S = 60;
  const BLOKADA_MIN = 15;
  const pamiecProb = {};
  function proby() {
    try { return JSON.parse(localStorage.getItem('magazyn-proby') || '{}') || {}; } catch (e) { return pamiecProb; }
  }
  function zapiszProby(x) {
    try { localStorage.setItem('magazyn-proby', JSON.stringify(x)); } catch (e) { Object.assign(pamiecProb, x); }
  }
  /** Ile sekund zostało do końca pauzy po zbyt wielu błędnych PIN-ach (0 = można próbować). */
  function sekundyBlokady(userId) {
    const x = proby()[userId];
    const s = x && x.do ? Math.ceil((x.do - Date.now()) / 1000) : 0;
    return s > 0 ? s : 0;
  }
  function zlaProba(userId) {
    const wszystkie = proby();
    const x = wszystkie[userId] || { n: 0 };
    x.n = (x.n || 0) + 1;
    if (x.n >= MAKS_PROB) { x.do = Date.now() + PAUZA_S * 1000; x.n = 0; }
    wszystkie[userId] = x;
    zapiszProby(wszystkie);
    return sekundyBlokady(userId);
  }
  function dobraProba(userId) {
    const wszystkie = proby();
    delete wszystkie[userId];
    zapiszProby(wszystkie);
  }
  const komunikatPauzy = (s) => 'Za dużo błędnych prób. Logowanie wstrzymane na ' + s + ' s.';

  function sprawdzNowyPin(pin, pin2) {
    if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN musi mieć od 4 do 8 cyfr');
    if (pin !== pin2) throw new Error('PIN-y się różnią');
    if (C.slabyPin(pin)) throw new Error('Ten PIN jest zbyt prosty (same takie same albo kolejne cyfry). Wybierz inny.');
  }
  const polePin = (nazwa, etykieta, auto) => pole(etykieta, '<input name="' + nazwa + '" type="password" inputmode="numeric" maxlength="8" autocomplete="' + (auto || 'off') + '" class="pin">');

  const minutyBlokady = () => {
    try { const v = localStorage.getItem('magazyn-blokada-min'); return v === null ? BLOKADA_MIN : Number(v) || 0; } catch (e) { return BLOKADA_MIN; }
  };
  const opisMinut = (m) => m + ' ' + odm(m, 'minucie', 'minutach', 'minutach');

  async function zaloguj(userId) {
    const u = app.st.uzytkownicy.get(userId);
    if (!u || u.aktywny === false) return;
    const w = await dialog({
      tytul: 'Zaloguj się',
      tresc: '<div class="kto-blokada"><span class="awatar duzy">' + inicjaly(u) + '</span><div><b>' + esc(u.imie + ' ' + u.nazwisko) + '</b><p class="szary maly">Wpisz swój PIN.' + (app.demo ? ' W trybie demonstracyjnym: 1234.' : '') + '</p></div></div>' +
        '<label class="pole"><span>PIN ' + pomoc('pin') + '</span><input name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" class="pin"></label>',
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Wróć' }, { wartosc: 'ok', etykieta: 'Zaloguj', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        const pauza = sekundyBlokady(userId);
        if (pauza) throw new Error(komunikatPauzy(pauza));
        const pin = f.pin.value.trim();
        if (!pin) throw new Error('Wpisz PIN');
        if (!(await C.sprawdzPin(u, pin))) {
          f.pin.value = '';
          const s = zlaProba(userId);
          throw new Error(s ? komunikatPauzy(s) : 'Nieprawidłowy PIN');
        }
        dobraProba(userId);
        return 'ok';
      },
    });
    if (w === 'ok') await poZalogowaniu(u);
  }

  async function poZalogowaniu(u) {
    app.user = u;
    app.zablokowany = false;
    app.aktywnosc = Date.now();
    app.ostatniUzytkownik = u.userId;
    try { localStorage.setItem('magazyn-ostatni-uzytkownik', u.userId); } catch (e) { /* */ }
    pokazWidok('pulpit', { zastap: true });
    if (u.pinDoZmiany && !(await ustawWlasnyPin(u))) return wyloguj(true);
    try { await kopiaTygodniowa(false); } catch (e) { toast('Nie udało się zapisać kopii tygodniowej: ' + e.message, 'blad'); }
  }

  /** Po resecie albo przy pierwszym logowaniu: trzeba ustawić PIN, którego nikt inny nie zna. */
  async function ustawWlasnyPin(u) {
    const kto = u.pinResetPrzez ? osoba(u.pinResetPrzez) : '';
    const w = await dialog({
      tytul: 'Ustaw własny PIN',
      tresc: (u.pinResetPrzez
        ? '<div class="alert ostrz">Twój PIN zresetował(a) <b>' + esc(kto) + '</b>' + (u.pinResetKiedy ? ' (' + fmtCzas(u.pinResetKiedy) + ')' : '') + '. Jeśli nie prosiłeś o reset, zgłoś to od razu.</div>'
        : '<p>To Twoje pierwsze logowanie. PIN startowy zna osoba, która zakładała konto – ustaw teraz własny.</p>') +
        '<div class="siatka">' + polePin('pin', 'Nowy PIN (4–8 cyfr)', 'new-password') + polePin('pin2', 'Powtórz nowy PIN', 'new-password') + '</div>' +
        '<p class="szary maly">Nie używaj prostych PIN-ów (1111, 1234). Sześć cyfr jest bezpieczniejsze niż cztery.</p>',
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Wyloguj' }, { wartosc: 'ok', etykieta: 'Ustaw PIN', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        const pin = f.pin.value.trim();
        sprawdzNowyPin(pin, f.pin2.value.trim());
        if (await C.sprawdzPin(u, pin)) throw new Error('Nowy PIN musi być inny niż ten, który dostałeś');
        await utworzZdarzenie('UZYTK', Object.assign({ userId: u.userId, pinDoZmiany: false, pinResetPrzez: '', pinResetKiedy: '' }, await C.noweDanePinu(pin)));
        return 'ok';
      },
    });
    if (w === 'ok') toast('Ustawiono nowy PIN', 'ok');
    return w === 'ok';
  }

  async function wyloguj(bezPytania) {
    if (!bezPytania && !(await moznaOpuscic())) return;
    const porzucono = bezPytania && app.szkic && czySzkicZmieniony();
    app.szkic = null;
    app.user = null;
    app.zablokowany = false;
    zamknijListe();
    render();
    if (porzucono) toast('Niezapisany dokument poprzedniej osoby został porzucony', 'blad');
  }

  function zablokuj() {
    if (!app.user || app.zablokowany) return;
    if (otwartyDialog) otwartyDialog.zamknij(null);
    zamknijListe();
    ukryjDymek();
    app.zablokowany = true;
    render();
  }

  function sprawdzBezczynnosc() {
    const min = minutyBlokady();
    if (app.user && !app.zablokowany && min > 0 && Date.now() - app.aktywnosc > min * 60000) zablokuj();
  }

  app.aktywnosc = Date.now();
  let ostatniRuch = 0;
  const ruch = () => {
    const t = Date.now();
    if (t - ostatniRuch < 1000) return;
    ostatniRuch = t;
    if (!app.zablokowany) app.aktywnosc = t;
  };
  ['pointerdown', 'keydown', 'wheel', 'mousemove', 'touchstart'].forEach((n) => document.addEventListener(n, ruch, { capture: true, passive: true }));
  setInterval(sprawdzBezczynnosc, 15000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') sprawdzBezczynnosc(); });

  // odblokowanie ekranu
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest && e.target.closest('[data-formularz="odblokuj"]');
    if (!f) return;
    e.preventDefault();
    const u = app.user;
    const blad = $('[data-blad-blokady]', f);
    const pokaz = (t) => { blad.textContent = t; blad.hidden = false; };
    const pauza = sekundyBlokady(u.userId);
    if (pauza) return pokaz(komunikatPauzy(pauza));
    const pin = f.pin.value.trim();
    if (!pin) return pokaz('Wpisz PIN');
    if (!(await C.sprawdzPin(u, pin))) {
      f.pin.value = '';
      const s = zlaProba(u.userId);
      if (s) {
        f.pin.disabled = true;
        setTimeout(() => { if (app.zablokowany) render(); }, s * 1000);
      }
      return pokaz(s ? komunikatPauzy(s) : 'Nieprawidłowy PIN');
    }
    dobraProba(u.userId);
    app.zablokowany = false;
    app.aktywnosc = Date.now();
    render();
  });

  async function konto() {
    const u = app.user;
    const min = minutyBlokady();
    const w = await dialog({
      tytul: 'Twoje konto',
      tresc: '<div class="kto-blokada"><span class="awatar duzy">' + inicjaly(u) + '</span><div><b>' + esc(u.imie + ' ' + u.nazwisko) + '</b><p class="szary maly">' + esc([u.email, u.tel].filter(Boolean).join(' · ') || 'bez e-maila i telefonu') + '</p></div></div>' +
        '<p class="szary maly">' + (min ? 'Ekran zablokuje się sam po ' + opisMinut(min) + ' bezczynności.' : 'Automatyczna blokada ekranu jest wyłączona na tym komputerze.') + ' Zmienisz to w Ustawieniach.</p>',
      przyciski: [{ wartosc: 'profil', etykieta: 'Mój profil' }, { wartosc: 'pin', etykieta: 'Zmień PIN' }, { wartosc: 'wyloguj', etykieta: ikona('wyloguj') + 'Wyloguj' }, { wartosc: 'zablokuj', etykieta: ikona('klodka') + 'Zablokuj ekran', klasa: 'glowny' }],
    });
    if (w === 'profil') return edytujUzytkownika(u.userId);
    if (w === 'pin') return zmienPin();
    if (w === 'wyloguj') return wyloguj();
    if (w === 'zablokuj') return zablokuj();
  }

  /** Nowe konto albo edycja WŁASNEGO profilu. Cudze konto: pokazUzytkownika. */
  async function edytujUzytkownika(id) {
    if (id && app.user && id !== app.user.userId) return pokazUzytkownika(id);
    const nowy = !id;
    const pierwszy = nowy && !app.user;
    const u = id ? app.st.uzytkownicy.get(id) : { imie: '', nazwisko: '', email: '', tel: '' };
    const w = await dialog({
      tytul: pierwszy ? 'Pierwszy użytkownik' : nowy ? 'Nowy użytkownik' : 'Mój profil', szeroki: true,
      tresc: (nowy && !pierwszy ? '<p class="szary">Wpisz PIN startowy i przekaż go tej osobie. Przy pierwszym logowaniu ustawi własny PIN, którego nikt inny nie zna.</p>' : '') +
        '<div class="siatka">' + pole('Imię *', '<input name="imie" value="' + esc(u.imie) + '">') + pole('Nazwisko *', '<input name="nazwisko" value="' + esc(u.nazwisko) + '">') + pole('E-mail', '<input name="email" value="' + esc(u.email) + '">') + pole('Telefon', '<input name="tel" value="' + esc(u.tel) + '">') +
        (nowy ? polePin('pin', pierwszy ? 'Twój PIN (4–8 cyfr) *' : 'PIN startowy (4–8 cyfr) *', 'new-password') + polePin('pin2', 'Powtórz PIN *', 'new-password') : '') + '</div>',
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: nowy ? 'Dodaj użytkownika' : 'Zapisz', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        const dane = { userId: id || C.noweId(8), imie: f.imie.value.trim(), nazwisko: f.nazwisko.value.trim(), email: f.email.value.trim(), tel: f.tel.value.trim() };
        if (!dane.imie || !dane.nazwisko) throw new Error('Podaj imię i nazwisko');
        const dubel = Array.from(app.st.uzytkownicy.values()).find((x) => x.userId !== dane.userId && x.aktywny !== false && C.normKlucz(x.imie + ' ' + x.nazwisko) === C.normKlucz(dane.imie + ' ' + dane.nazwisko));
        if (dubel) throw new Error('Jest już aktywne konto „' + dubel.imie + ' ' + dubel.nazwisko + '”');
        if (nowy) {
          const pin = f.pin.value.trim();
          sprawdzNowyPin(pin, f.pin2.value.trim());
          Object.assign(dane, await C.noweDanePinu(pin), { aktywny: true, pinDoZmiany: !pierwszy });
        }
        const ev = C.noweZdarzenie(app.st, 'UZYTK', app.user ? app.user.userId : dane.userId, dane);
        await zapiszZdarzenie(ev);
        return dane.userId;
      },
    });
    if (!w) return;
    if (pierwszy) {
      toast('Witaj! Konto założone', 'ok');
      return poZalogowaniu(app.st.uzytkownicy.get(w));
    }
    toast(nowy ? 'Dodano użytkownika – przekaż mu PIN startowy' : 'Zapisano profil', 'ok');
    render();
  }

  /** Cudze konto: podgląd, reset PIN-u, wyłączenie albo przywrócenie (z potwierdzeniem własnym PIN-em). */
  async function pokazUzytkownika(id) {
    const u = app.st.uzytkownicy.get(id);
    if (!u) return;
    const aktywny = u.aktywny !== false;
    const dokumentow = Array.from(app.st.dokumenty.values()).filter((d) => d.ev.autor === id).length;
    const w = await dialog({
      tytul: esc(u.imie + ' ' + u.nazwisko),
      tresc: '<dl class="opis"><dt>E-mail</dt><dd>' + esc(u.email || '–') + '</dd><dt>Telefon</dt><dd>' + esc(u.tel || '–') + '</dd>' +
        '<dt>Konto</dt><dd>' + (aktywny ? '<span class="znaczek ok">aktywne</span>' : '<span class="znaczek anul">wyłączone</span>') + (u.pinDoZmiany ? ' <span class="znaczek">PIN tymczasowy</span>' : '') + '</dd>' +
        '<dt>Założone</dt><dd>' + (u.utworzono ? fmtData(u.utworzono) : '–') + '</dd><dt>Wystawione dokumenty</dt><dd>' + dokumentow + '</dd></dl>' +
        '<p class="szary maly">Profil i PIN zmienia tylko właściciel konta. Gdy ktoś zapomni PIN-u, możesz go zresetować; gdy ktoś odchodzi z firmy – wyłączyć konto. Obie operacje potwierdzasz swoim PIN-em i zostają w dzienniku. Dokumenty tej osoby zostają bez zmian.</p>',
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Zamknij' }].concat(aktywny
        ? [{ wartosc: 'dezaktywuj', etykieta: 'Wyłącz konto', klasa: 'czerwony' }, { wartosc: 'reset', etykieta: 'Resetuj PIN', klasa: 'glowny' }]
        : [{ wartosc: 'przywroc', etykieta: 'Przywróć konto', klasa: 'glowny' }]),
    });
    if (w === 'reset') return resetujPin(u);
    if (w === 'dezaktywuj' || w === 'przywroc') {
      if (w === 'dezaktywuj' && Array.from(app.st.uzytkownicy.values()).filter((x) => x.aktywny !== false).length <= 1) return toast('Nie można wyłączyć ostatniego aktywnego konta', 'blad');
      const ok = await pytajPin(w === 'dezaktywuj' ? 'Wyłączenie konta: ' + u.imie + ' ' + u.nazwisko + '. Ta osoba nie będzie mogła się zalogować; jej dokumenty zostają.' : 'Przywrócenie konta: ' + u.imie + ' ' + u.nazwisko + '.');
      if (!ok) return;
      await utworzZdarzenie('UZYTK', { userId: u.userId, aktywny: w === 'przywroc' });
      toast(w === 'dezaktywuj' ? 'Konto wyłączone' : 'Konto przywrócone', 'ok');
      render();
    }
  }

  async function resetujPin(u) {
    const w = await dialog({
      tytul: 'Reset PIN-u: ' + esc(u.imie + ' ' + u.nazwisko),
      tresc: '<p>Wpisz PIN tymczasowy i przekaż go tej osobie osobiście. Przy logowaniu będzie musiała ustawić własny PIN i zobaczy, kto zrobił reset.</p>' +
        '<div class="siatka">' + polePin('pin', 'PIN tymczasowy (4–8 cyfr)', 'new-password') + polePin('pin2', 'Powtórz PIN tymczasowy', 'new-password') + '</div>' +
        polePin('moj', 'Twój PIN – potwierdzenie (' + esc(app.user.imie + ' ' + app.user.nazwisko) + ')'),
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: 'Resetuj PIN', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        const pauza = sekundyBlokady(app.user.userId);
        if (pauza) throw new Error(komunikatPauzy(pauza));
        if (!(await C.sprawdzPin(app.user, f.moj.value.trim()))) {
          f.moj.value = '';
          const s = zlaProba(app.user.userId);
          throw new Error(s ? komunikatPauzy(s) : 'Twój PIN jest nieprawidłowy');
        }
        dobraProba(app.user.userId);
        const pin = f.pin.value.trim();
        if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN tymczasowy musi mieć od 4 do 8 cyfr');
        if (pin !== f.pin2.value.trim()) throw new Error('PIN-y tymczasowe się różnią');
        await utworzZdarzenie('UZYTK', Object.assign({ userId: u.userId, pinDoZmiany: true, pinResetPrzez: app.user.userId, pinResetKiedy: new Date().toISOString() }, await C.noweDanePinu(pin)));
        return 'ok';
      },
    });
    if (w) { toast('Zresetowano PIN – przekaż PIN tymczasowy osobiście', 'ok'); render(); }
  }

  async function zmienPin() {
    const u = app.st.uzytkownicy.get(app.user.userId);
    const w = await dialog({
      tytul: 'Zmiana PIN-u',
      tresc: polePin('stary', 'Obecny PIN') + '<div class="siatka">' + polePin('pin', 'Nowy PIN (4–8 cyfr)', 'new-password') + polePin('pin2', 'Powtórz nowy PIN', 'new-password') + '</div>' +
        '<p class="szary maly">Nie używaj prostych PIN-ów (1111, 1234). Sześć cyfr jest bezpieczniejsze niż cztery.</p>',
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: 'Zmień PIN', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        const pauza = sekundyBlokady(u.userId);
        if (pauza) throw new Error(komunikatPauzy(pauza));
        if (!(await C.sprawdzPin(u, f.stary.value.trim()))) {
          f.stary.value = '';
          const s = zlaProba(u.userId);
          throw new Error(s ? komunikatPauzy(s) : 'Obecny PIN jest nieprawidłowy');
        }
        dobraProba(u.userId);
        const pin = f.pin.value.trim();
        sprawdzNowyPin(pin, f.pin2.value.trim());
        await utworzZdarzenie('UZYTK', Object.assign({ userId: u.userId, pinDoZmiany: false, pinResetPrzez: '', pinResetKiedy: '' }, await C.noweDanePinu(pin)));
        return 'ok';
      },
    });
    if (w) toast('Zmieniono PIN', 'ok');
  }

  async function przenies(el) {
    const { m, sn, lok, p, il } = el.dataset;
    const w = await dialog({
      tytul: 'Przenieś: ' + esc(nazwaModelu(m)),
      tresc: '<p>Z: <b>' + esc(lok) + '</b>' + (sn ? ' · SN <span class="mono">' + esc(sn) + '</span>' : '') + (p ? ' · pod projekt ' + esc(projTekst(p)) : '') + '</p>' +
        pole('Nowa lokalizacja *', wybierak('lokalizacje', 'n:do', '', { opis: true, placeholder: 'wybierz z listy albo wpisz nowe miejsce' })) + (sn ? '' : pole('Ilość (max ' + fmtL(il) + ' ' + esc(jedn(m)) + ')', '<input name="ilosc" value="' + esc(il) + '" inputmode="decimal">')),
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: 'Przenieś', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        const doL = f.do.value.trim();
        if (!doL) throw new Error('Podaj nową lokalizację');
        if (C.normKlucz(doL) === C.normKlucz(lok)) throw new Error('To ta sama lokalizacja');
        const ilosc = sn ? 1 : Number(f.ilosc.value.replace(',', '.'));
        if (!(ilosc > 0) || ilosc > Number(il) + 1e-9) throw new Error('Nieprawidłowa ilość');
        if (C.czyNowaWartosc(C.podpowiedzi(app.st).lokalizacje, doL) && f.dataset.potwierdzono !== C.normKlucz(doL)) {
          f.dataset.potwierdzono = C.normKlucz(doL);
          throw new Error('Lokalizacja „' + doL + '” pojawi się po raz pierwszy. Sprawdź pisownię i kliknij „Przenieś” jeszcze raz, żeby potwierdzić.');
        }
        await wczytaj();
        await utworzZdarzenie('PRZENIES', { modelId: m, sn: sn || undefined, ilosc, z: lok, do: doL, projekt: p || '' });
        return 'ok';
      },
    });
    if (w) { toast('Przeniesiono', 'ok'); render(); }
  }

  async function uzupelnij(el) {
    const u = app.st.uzupelnienia.find((x) => x.docId === el.dataset.id && x.idx === Number(el.dataset.idx));
    if (!u) return;
    const w = await dialog({
      tytul: 'Oznacz jako uzupełnione',
      tresc: '<p>' + esc(nazwaModelu(u.modelId)) + (u.sn ? ' SN ' + esc(u.sn) : ' · ' + fmtIl(u.modelId, u.ilosc)) + '<br>Brakowało pod projekt <b>' + esc(u.projektZakupu) + '</b> po ' + esc(u.numer) + '.</p>' + pole('Jak uzupełniono (np. numer PZ)', '<input name="uwagi" placeholder="np. PZ/2026/0042">'),
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: 'Oznacz', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        await utworzZdarzenie('UZUP', { docId: u.docId, numer: u.numer, idx: u.idx, uwagi: f.uwagi.value.trim() });
        return 'ok';
      },
    });
    if (w) { toast('Oznaczono jako uzupełnione', 'ok'); render(); }
  }

  function pokazModel(id) {
    const m = app.st.modele.get(id);
    const w = C.stanyModeli(app.st).find((x) => x.model.modelId === id);
    const miejsca = C.wierszeMagazynu(app.st).filter((x) => x.modelId === id);
    const wydane = C.wydaneNaProjekt(app.st, '').filter((x) => x.modelId === id);
    dialog({
      tytul: esc(nazwaModelu(id)), szeroki: true,
      tresc: '<dl class="opis"><dt>Kategoria</dt><dd>' + esc(m.kategoria || '') + '</dd><dt>Kod producenta</dt><dd>' + esc(m.pn || '') + '</dd><dt>W magazynie</dt><dd><b>' + fmtIl(id, w.razem) + '</b> (wolne ' + fmtIl(id, w.wolne) + ', pod projekty ' + fmtIl(id, w.podProjekt) + ')</dd><dt>U klientów</dt><dd>' + fmtIl(id, w.wydane) + '</dd>' + '<dt>Karta katalogowa</dt><dd>' + (maKarte(m) ? (m.kartaPlik ? 'plik w folderze' : '') + (m.kartaPlik && m.link ? ' i ' : '') + (m.link ? 'link do strony producenta' : '') : '<span class="szary">brak – dodasz ją w edycji modelu</span>') + '</dd>' + '</dl>' +
        '<h3>W magazynie</h3>' + (miejsca.length ? '<div class="tabela-owijka"><table class="tabela"><thead><tr><th>Lokalizacja</th><th>Nr seryjny</th><th class="l">Ilość</th><th>Pod projekt</th></tr></thead><tbody>' + miejsca.map((x) => '<tr><td>' + esc(x.lok) + '</td><td class="mono">' + esc(x.sn) + '</td><td class="l">' + fmtIl(id, x.ilosc) + '</td><td>' + esc(x.projekt || '') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="szary">Brak</p>') +
        '<h3>U klientów</h3>' + (wydane.length ? '<div class="tabela-owijka"><table class="tabela"><thead><tr><th>Projekt</th><th>Klient</th><th>Nr seryjny</th><th class="l">Ilość</th></tr></thead><tbody>' + wydane.map((x) => '<tr><td>' + esc(x.projekt) + '</td><td>' + esc(x.klient) + '</td><td class="mono">' + esc(x.sn) + '</td><td class="l">' + fmtIl(id, x.ilosc) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="szary">Brak</p>'),
      przyciski: (maKarte(m) ? [{ wartosc: 'karta', etykieta: ikona('karta') + 'Karta katalogowa' }] : []).concat([{ wartosc: 'edytuj', etykieta: 'Edytuj model' }, { wartosc: 'ok', etykieta: 'Zamknij', klasa: 'glowny' }]),
    }).then((w) => {
      if (w === 'karta') otworzKarte(id);
      if (w === 'edytuj') edytujModel(id);
    });
  }

  // ------------------------------------------------------------ render

  function render() {
    const root = $('#app');
    let html;
    if (!app.store) html = ekranStartowy();
    else if (!app.user) html = ekranUzytkownika();
    else if (app.zablokowany) html = ekranBlokady();
    else html = uklad((WIDOKI[app.widok] || WIDOKI.pulpit)());
    const przewiniecie = $('.zawartosc') ? $('.zawartosc').scrollTop : 0;
    const aktywny = document.activeElement;
    const klucz = aktywny && (aktywny.dataset.filtr || aktywny.dataset.f || aktywny.dataset.p);
    const kursor = aktywny && typeof aktywny.selectionStart === 'number' ? aktywny.selectionStart : null;
    const lista = wyb.pole && !listaWyboru.hidden && !wyb.pole.closest('#modal') ? { filtr: wyb.pole.dataset.pisze === '1' } : null;
    if (dymekDla && !dymekDla.closest('#modal')) ukryjDymek(); // dymek przycisku, który za chwilę zniknie
    root.innerHTML = html;
    if (app.zablokowany && app.user) { const pin = $('[data-formularz="odblokuj"] input[name=pin]'); if (pin && !pin.disabled) pin.focus(); return; }
    if ($('.zawartosc')) $('.zawartosc').scrollTop = przewiniecie;
    if (klucz) {
      const el = $('[data-filtr="' + klucz + '"], [data-f="' + klucz + '"], [data-p="' + klucz + '"]');
      if (el) {
        el.focus();
        if (kursor !== null && typeof el.setSelectionRange === 'function') try { el.setSelectionRange(kursor, kursor); } catch (e) { /* */ }
      }
    }
    if (wyb.pole && !wyb.pole.isConnected) zamknijListe();
    const a = document.activeElement;
    if (lista && a && a.dataset && a.dataset.wybierak && !a.closest('#modal')) {
      if (lista.filtr) a.dataset.pisze = '1';
      otworzListe(a, lista.filtr);
    }
  }

  // ------------------------------------------------------------ nawigacja

  function czySzkicZmieniony(s) {
    if (!s) return false;
    const pusty = Object.assign(nowySzkic(s.rodzaj), s.poczatek || {});
    for (const k of ['projekt', 'klientNazwa', 'adres', 'osoba', 'dostawca', 'nrFaktury', 'uwagi', 'powod']) if (C.norm(s[k]) !== C.norm(pusty[k])) return true;
    if (!!s.podProjekt !== !!pusty.podProjekt) return true;
    return s.pozycje.some((p) => p.modelId || p.sn || C.norm(p.modelLabel) || C.norm(p.snTekst) || C.norm(p.ilosc) || (s.rodzaj !== 'WZ' && s.rodzaj !== 'ZW' && C.norm(p.lok)));
  }

  /** Zwraca true, jeśli można opuścić bieżący formularz (pyta tylko, gdy coś wpisano). */
  async function moznaOpuscic() {
    if (!app.szkic || app.widok !== 'dokument') return true;
    if (czySzkicZmieniony(app.szkic)) {
      const ok = await potwierdz('Porzucić dokument?', 'Masz niezapisany dokument. Jeśli wyjdziesz, wpisane dane przepadną.', 'Porzuć dokument', 'czerwony');
      if (!ok) return false;
    }
    app.szkic = null;
    return true;
  }

  function historia(widok, zastap) {
    try {
      const stan = { widok };
      if (zastap) history.replaceState(stan, '', '#' + widok);
      else if (!history.state || history.state.widok !== widok) history.pushState(stan, '', '#' + widok);
    } catch (e) { /* podgląd bez historii – trudno */ }
  }

  function pokazWidok(widok, opcje = {}) {
    app.widok = widok;
    if (!opcje.bezHistorii) historia(widok, opcje.zastap);
    render();
    if ($('.zawartosc')) $('.zawartosc').scrollTop = 0;
  }

  window.addEventListener('popstate', async (e) => {
    if (!app.store || !app.user) return;
    if (otwartyDialog) otwartyDialog.zamknij(null);
    const cel = (e.state && e.state.widok) || (location.hash || '#pulpit').slice(1);
    if (cel === app.widok) return;
    if (cel === 'dokument' && !app.szkic) {
      // wpis po porzuconym lub zapisanym formularzu – przeskakujemy go
      try { history.back(); } catch (err) { pokazWidok('pulpit', { zastap: true }); }
      return;
    }
    if (!(await moznaOpuscic())) {
      historia(app.widok); // zostajemy w formularzu
      return;
    }
    pokazWidok(WIDOKI[cel] ? cel : 'pulpit', { bezHistorii: true });
  });

  // ------------------------------------------------------------ obsługa zdarzeń

  async function otworzFolder(uchwyt, zapytaj) {
    const store = new S.FolderStore(uchwyt);
    if (!(await store.maUprawnienia(zapytaj))) {
      toast('Brak zgody na dostęp do folderu', 'blad');
      return;
    }
    app.store = store;
    app.demo = false;
    await S.zapamietaj('folder', uchwyt);
    await wczytaj();
    let ostatni = null;
    try { ostatni = localStorage.getItem('magazyn-ostatni-uzytkownik'); } catch (e) { /* */ }
    app.user = null;
    app.ostatniUzytkownik = ostatni;
    render();
  }

  const AKCJE = {
    async wybierzFolder() {
      try {
        const h = await window.showDirectoryPicker({ id: 'magazyn-av', mode: 'readwrite' });
        await otworzFolder(h, true);
      } catch (e) {
        if (e.name !== 'AbortError') toast('Nie udało się otworzyć folderu: ' + e.message, 'blad');
      }
    },
    async polaczPonownie() {
      try { await otworzFolder(app.zapamietanyFolder, true); } catch (e) { toast('Nie udało się połączyć: ' + e.message, 'blad'); }
    },
    async demo() {
      const store = new S.MemoryStore('dane przykładowe');
      await window.MagazynDemo.przygotujDemo(store);
      app.store = store;
      app.demo = true;
      await wczytaj();
      render();
    },
    zmienFolder() {
      app.store = null;
      app.user = null;
      app.szkic = null;
      render();
    },
    wybierzOsobe(el) { return zaloguj(el.dataset.id); },
    zmienOsobe() { return wyloguj(); },
    wyloguj() { return wyloguj(app.zablokowany); },
    zablokuj() { zablokuj(); },
    konto() { return konto(); },
    nowyUzytkownik() { edytujUzytkownika(null); },
    edytujUzytkownika(el) { edytujUzytkownika(el.dataset.id); },
    zmienPin() { zmienPin(); },
    async idz(el) {
      if (!(await moznaOpuscic())) return;
      pokazWidok(el.dataset.w);
    },
    async wstecz() {
      if (!(await moznaOpuscic())) return;
      const poprzedni = app.poprzedniWidok && app.poprzedniWidok !== 'dokument' ? app.poprzedniWidok : 'pulpit';
      pokazWidok(poprzedni);
    },
    async odswiez() {
      await wczytaj();
      render();
      toast('Wczytano aktualne dane', 'ok');
    },
    async nowyDok(el) {
      if (app.widok !== 'dokument') app.poprzedniWidok = app.widok;
      if (!(await moznaOpuscic())) return;
      app.szkic = nowySzkic(el.dataset.r);
      if (el.dataset.r === 'PZ' || el.dataset.r === 'BO') app.szkic.pozycje.push({ modelLabel: '', modelId: '', lok: '', snTekst: '', ilosc: '', jedn: 'baza', stanTech: 'nowy', projekt: '' });
      if (el.dataset.projekt) {
        app.szkic.projekt = el.dataset.projekt;
        uzupelnijZProjektu();
        app.szkic.poczatek = { projekt: app.szkic.projekt, klientNazwa: app.szkic.klientNazwa, adres: app.szkic.adres };
      }
      app.filtr.wybor = '';
      if (app.widok === 'dokument') render();
      else pokazWidok('dokument');
    },
    async anulujSzkic() {
      if (!(await moznaOpuscic())) return;
      AKCJE.wstecz();
    },
    zapiszSzkic() { zapiszSzkic(); },
    dodajPoz() {
      const ost = app.szkic.pozycje[app.szkic.pozycje.length - 1];
      app.szkic.pozycje.push({ modelLabel: '', modelId: '', lok: ost ? ost.lok : '', snTekst: '', ilosc: '', jedn: 'baza', stanTech: 'nowy', projekt: ost ? ost.projekt : '' });
      render();
      const pola = $$('[data-model]');
      if (pola.length) pola[pola.length - 1].focus();
    },
    usunPoz(el) {
      app.szkic.pozycje.splice(Number(el.dataset.i), 1);
      render();
    },
    dodajZMagazynu(el) {
      const { m, sn, lok, p, il } = el.dataset;
      const s = app.szkic;
      if (sn) s.pozycje.push({ modelId: m, sn, ilosc: 1, lok, projektZakupu: p, max: 1 });
      else {
        const jest = s.pozycje.find((x) => !x.sn && x.modelId === m && x.lok === lok && (x.projektZakupu || '') === p);
        if (jest) return;
        s.pozycje.push({ modelId: m, sn: '', ilosc: '', lok, projektZakupu: p, max: Number(il) });
      }
      render();
      if (!sn) {
        const pola = $$('.w-ilosc');
        if (pola.length) pola[pola.length - 1].focus();
      }
    },
    dodajZwrot(el) {
      const { m, sn, il } = el.dataset;
      app.szkic.pozycje.push({ modelId: m, sn, ilosc: sn ? 1 : '', max: Number(il), lok: '', stanTech: 'używany' });
      render();
    },
    pokazDok(el) { pokazDokument(el.dataset.id); },
    karta(el) { otworzKarte(el.dataset.m); },
    idzRaport(el) {
      app.filtr.raport = el.dataset.r;
      AKCJE.idz({ dataset: { w: 'raporty' } });
    },
    doSekcji(el) {
      const cel = document.getElementById('pomoc-' + el.dataset.s);
      if (cel) cel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    pomocStart() {
      dialog({ tytul: 'Jak to działa?', szeroki: true, tresc: instrukcjaHtml(['start', 'onedrive']), przyciski: [{ wartosc: 'ok', etykieta: 'Rozumiem', klasa: 'glowny' }] });
    },
    pokazModel(el) { pokazModel(el.dataset.id); },
    historia(el) {
      const e = app.st.egzemplarze.get(C.kluczEgz(el.dataset.m, el.dataset.sn));
      if (e) dialog({ tytul: 'Historia urządzenia', tresc: historiaHtml(e), szeroki: true, przyciski: [{ wartosc: 'ok', etykieta: 'Zamknij', klasa: 'glowny' }] });
    },
    edytujModel(el) { edytujModel(el.dataset.id || null, el.dataset.poz); },
    edytujKlienta(el) { edytujKlienta(el.dataset.id || null); },
    edytujDostawce(el) { edytujDostawce(el.dataset.id || null); },
    sortuj(el) {
      const id = el.dataset.t;
      const kol = el.dataset.k;
      const s = app.sortowanie[id];
      if (!s || s.kol !== kol) app.sortowanie[id] = { kol, mal: false };
      else if (!s.mal) s.mal = true;
      else delete app.sortowanie[id];
      try { localStorage.setItem('magazyn-sortowanie', JSON.stringify(app.sortowanie)); } catch (e) { /* tryb prywatny – bez zapamiętywania */ }
      render();
      const b = $$('button.sortuj').find((x) => x.dataset.t === id && x.dataset.k === kol);
      if (b) b.focus({ preventScroll: true });
    },
    edytujProjekt(el) { edytujProjekt(el.dataset.id || null, el.dataset.numer ? { numer: el.dataset.numer } : null); },
    pokazProjekt(el) { pokazProjekt(el.dataset.numer); },
    async dodajDoWybieraka(el) {
      const { zrodlo, cel } = el.dataset;
      let tekst = el.dataset.tekst;
      if (tekst === undefined) {
        const pole = $$('input[data-wybierak]').find((x) => celPola(x) === cel);
        tekst = pole ? pole.value : '';
      }
      if (!DODAJ[zrodlo]) return;
      const w = await DODAJ[zrodlo](C.norm(tekst), cel);
      if (w == null || w === 'pomin') return;
      ustawCel(cel, w);
      render();
    },
    przenies(el) { przenies(el); },
    uzupelnij(el) { uzupelnij(el); },
    raport(el) { app.filtr.raport = el.dataset.r; render(); },
    eksport(el) {
      const t = tabele[el.dataset.t];
      if (!t || !t.wiersze.length) return toast('Brak danych do eksportu', 'blad');
      eksport(t.nazwa, t.naglowki, t.wiersze);
    },
    async kopiaTeraz() {
      try { await kopiaTygodniowa(true); } catch (e) { toast('Nie udało się: ' + e.message, 'blad'); }
    },
    pobierzBaze() {
      const tresc = { utworzono: new Date().toISOString(), przez: osoba(app.user.userId), zdarzenia: app.zdarzenia.filter((e) => e.id).map(bezPodkreslnikow) };
      pobierz('magazyn-baza-' + dzis() + '.json', JSON.stringify(tresc, null, 1), 'application/json');
    },
  };

  document.addEventListener('click', (e) => {
    if (e.target.closest('#modal')) return;
    const el = e.target.closest('[data-a]');
    if (!el) return;
    e.preventDefault();
    const f = AKCJE[el.dataset.a];
    if (f) Promise.resolve(f(el, e)).catch((err) => { console.error(err); toast(err.message, 'blad'); });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && otwartyDialog) otwartyDialog.zamknij(null);
    if (e.key === 'Enter' && e.target.matches('tr[data-a]')) e.target.click();
  });

  // ------------------------------------------------------------ dymki pomocy

  const dymek = document.createElement('div');
  dymek.className = 'dymek';
  dymek.setAttribute('role', 'tooltip');
  document.body.appendChild(dymek);
  let dymekCzasomierz = null;
  let dymekDla = null;

  function pokazDymek(el) {
    const tekst = el.dataset.tip;
    if (!tekst) return;
    dymekDla = el;
    dymek.textContent = tekst;
    dymek.className = 'dymek widoczny';
    const r = el.getBoundingClientRect();
    const w = dymek.offsetWidth;
    const h = dymek.offsetHeight;
    let x, y;
    if (el.dataset.tipStrona === 'prawo' && r.right + 12 + w < innerWidth) {
      x = r.right + 12;
      y = r.top + r.height / 2 - h / 2;
    } else {
      x = r.left + r.width / 2 - w / 2;
      y = r.bottom + 8;
      if (y + h > innerHeight - 8) y = r.top - h - 8;
    }
    dymek.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px';
    dymek.style.top = Math.max(8, y) + 'px';
  }
  function ukryjDymek() {
    clearTimeout(dymekCzasomierz);
    dymekDla = null;
    dymek.className = 'dymek';
  }
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el === dymekDla) return;
    ukryjDymek();
    if (!el || !el.dataset.tip) return;
    dymekCzasomierz = setTimeout(() => pokazDymek(el), el.classList.contains('pomoc') ? 60 : 450);
  });
  document.addEventListener('focusin', (e) => {
    const el = e.target.closest && e.target.closest('.pomoc');
    if (el) pokazDymek(el);
  });
  document.addEventListener('focusout', ukryjDymek);
  document.addEventListener('scroll', ukryjDymek, true);
  document.addEventListener('click', (e) => {
    const el = e.target.closest('.pomoc');
    if (!el) return;
    e.preventDefault(); // nie zaznaczaj pola ani pola wyboru
    e.stopPropagation();
    if (dymekDla === el) ukryjDymek();
    else pokazDymek(el);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'F1') {
      e.preventDefault();
      if (app.store && app.user) AKCJE.idz({ dataset: { w: 'pomoc' } });
      else AKCJE.pomocStart();
    }
  });

  let opoznienie = null;
  // Zasada: pola tekstowe nigdy nie przerysowują ekranu przy utracie fokusu (to gubiłoby kliknięcia).
  // Przerysowanie: listy rozwijane i pola wyboru od razu, wybrane pola tekstowe z opóźnieniem w trakcie pisania.
  function zmianaPola(e, natychmiast) {
    const el = e.target;
    if (el.closest('#modal')) return;
    const wybor = el.tagName === 'SELECT' || el.type === 'checkbox';
    if (el.dataset.filtr) {
      app.filtr[el.dataset.filtr] = el.type === 'checkbox' ? el.checked : el.value;
      clearTimeout(opoznienie);
      if (wybor) { if (natychmiast) render(); }
      else if (!natychmiast) opoznienie = setTimeout(render, el.dataset.natychmiast ? 350 : 180);
      return;
    }
    if (!app.szkic) return;
    if (el.dataset.f) {
      app.szkic[el.dataset.f] = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.f === 'projekt' && natychmiast) uzupelnijZProjektu();
      if (wybor && el.dataset.przerysuj && natychmiast) render();
      else if (!wybor && el.dataset.przerysujPo) {
        if (el.dataset.wybierak) {
          // pole z listą: przerysowanie po wyborze albo po wyjściu z pola, nie w trakcie szukania
          if (natychmiast) przerysujBezpiecznie();
        } else if (!natychmiast) {
          clearTimeout(opoznienie);
          opoznienie = setTimeout(render, 400);
        }
      }
      return;
    }
    if (el.dataset.p) {
      const [i, pole2] = el.dataset.p.split(':');
      const p = app.szkic.pozycje[Number(i)];
      if (!p) return;
      p[pole2] = el.value;
      if (el.dataset.model) {
        if (natychmiast) return;
        const m = modelZEtykiety(el.value);
        const zmiana = (m ? m.modelId : '') !== p.modelId;
        p.modelId = m ? m.modelId : '';
        if (zmiana) return render();
        const podp = $('[data-podp="' + i + '"]');
        if (podp) podp.hidden = !(C.norm(el.value) && !m);
        return;
      }
      if (pole2 === 'snTekst') {
        const l = $('[data-licznik="' + i + '"]');
        if (l) l.textContent = el.value.split(/[\n,;\t]+/).map((x) => x.trim()).filter(Boolean).length;
        return;
      }
      if (pole2 === 'ilosc') {
        const pr = $('[data-przel="' + i + '"]');
        if (pr) pr.textContent = '= ' + fmtL((Number(el.value.replace(',', '.')) || 0) * Number(pr.dataset.mn)) + ' ' + pr.dataset.j;
      }
      if (wybor && el.dataset.przerysuj && natychmiast) render();
    }
  }
  document.addEventListener('input', (e) => zmianaPola(e, false));
  document.addEventListener('change', (e) => zmianaPola(e, true));
  document.addEventListener('change', (e) => {
    if (!e.target.matches || !e.target.matches('[data-ustawienie="blokada"]')) return;
    try { localStorage.setItem('magazyn-blokada-min', e.target.value); } catch (err) { /* */ }
    const m = Number(e.target.value);
    toast(m ? 'Ekran zablokuje się po ' + opisMinut(m) + ' bezczynności' : 'Automatyczna blokada wyłączona na tym komputerze', m ? 'ok' : 'blad');
  });

  window.addEventListener('beforeunload', (e) => {
    if (app.szkic && app.widok === 'dokument' && czySzkicZmieniony(app.szkic)) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  // ------------------------------------------------------------ start

  async function start() {
    app.zapamietanyFolder = await S.przypomnij('folder');
    const param = new URLSearchParams(location.search);
    if (param.get('demo') === '1') return AKCJE.demo();
    if (param.get('opfs') === '1' && navigator.storage && navigator.storage.getDirectory) {
      // tryb testowy: prywatny folder przeglądarki zamiast OneDrive
      const h = await navigator.storage.getDirectory();
      const store = new S.FolderStore(h);
      store.nazwa = 'folder testowy przeglądarki';
      app.store = store;
      await wczytaj();
      return render();
    }
    render();
  }

  window.MagazynApp = { app, render, AKCJE, sprawdzBezczynnosc };
  start();
})();
