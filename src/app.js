/*
 * Magazyn AV – interfejs aplikacji.
 */
(function () {
  'use strict';
  const C = window.MagazynCore;
  const S = window.MagazynStorage;
  const X = window.MagazynXlsx;

  const FIRMA = {
    nazwa: 'MAASCK SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
    adres: 'Piękna 24/26A, 00-549 Warszawa',
    nip: '7011115199',
    regon: '523695017',
    krs: '0001002721',
  };
  const LOGO = window.MAGAZYN_LOGO || '';

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
  const jedn = (id) => model(id).jednostka || 'szt';
  const fmtIl = (id, x) => {
    const m = model(id);
    let s = fmtL(x) + ' ' + (m.jednostka || 'szt');
    if (m.jednostkaZakupu && Number(m.przelicznik) > 0 && Math.abs(x) >= Number(m.przelicznik)) s += ' <span class="szary">(≈ ' + fmtL(Math.round((x / m.przelicznik) * 10) / 10) + ' × ' + esc(m.jednostkaZakupu) + ')</span>';
    return s;
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
    const problemy = typ === 'MODEL' || typ === 'KLIENT' || typ === 'UZYTK' ? [] : C.sprawdzNowe(app.zdarzenia, ev);
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

  function dialog({ tytul, tresc, przyciski, szeroki, przyOtwarciu, przyWyslaniu }) {
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
        m.innerHTML = '';
        otwartyDialog = null;
        ok(w);
      };
      otwartyDialog = { zamknij };
      const obsluz = async (wartosc) => {
        if (wartosc === '__anuluj' || wartosc === 'anuluj') return zamknij(null);
        if (przyWyslaniu) {
          try {
            const w = await przyWyslaniu(form, wartosc);
            if (w === false) return;
            zamknij(w === undefined ? wartosc : w);
          } catch (e) {
            $('.bledy-okna', form).innerHTML = '<div class="alert blad">' + (e.lista ? e.lista.map(esc).join('<br>') : esc(e.message)) + '</div>';
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
      const pierwszy = $('input:not([type=hidden]):not([readonly]), select, textarea', form);
      if (pierwszy) setTimeout(() => pierwszy.focus(), 30);
    });
  }

  const potwierdz = (tytul, tresc, etykieta, klasa) => dialog({ tytul, tresc: '<p>' + tresc + '</p>', przyciski: [{ wartosc: 'anuluj', etykieta: 'Wróć' }, { wartosc: 'tak', etykieta: etykieta || 'Tak', klasa: klasa || 'glowny', submit: true }] }).then((w) => w === 'tak');

  async function pytajPin(cel) {
    const u = app.st.uzytkownicy.get(app.user.userId);
    const w = await dialog({
      tytul: 'Potwierdź PIN-em',
      tresc: '<p>' + esc(cel) + '</p><p class="szary">Potwierdzasz jako <b>' + esc(u.imie + ' ' + u.nazwisko) + '</b>.</p>' +
        '<label class="pole"><span>PIN</span><input name="pin" type="password" inputmode="numeric" autocomplete="off" maxlength="8" class="pin"></label>',
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Wróć' }, { wartosc: 'ok', etykieta: 'Potwierdź', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        const pin = f.pin.value.trim();
        if (!pin) throw new Error('Wpisz PIN');
        if ((await C.hashPin(u.pinSalt, pin)) !== u.pinHash) {
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

  function tabela(id, nazwa, naglowki, wiersze, opcje = {}) {
    // wiersze: [{komorki:[html...], dane:[surowe do Excela], klasa, akcja}]
    tabele[id] = { nazwa, naglowki, wiersze: wiersze.map((w) => w.dane) };
    if (!wiersze.length) return '<div class="pusto">' + (opcje.pusto || 'Brak pozycji') + '</div>';
    return '<div class="tabela-owijka"><table class="tabela"><thead><tr>' + naglowki.map((h, i) => '<th class="' + ((opcje.liczbowe || []).includes(i) ? 'l' : '') + '">' + esc(h) + '</th>').join('') + (opcje.akcje ? '<th></th>' : '') + '</tr></thead><tbody>' +
      wiersze.map((w) => '<tr class="' + (w.klasa || '') + '"' + (w.akcja ? ' data-a="' + w.akcja + '" tabindex="0"' : '') + '>' + w.komorki.map((k, i) => '<td class="' + ((opcje.liczbowe || []).includes(i) ? 'l' : '') + '">' + k + '</td>').join('') + (opcje.akcje ? '<td class="akcje-wiersza">' + (w.akcjeHtml || '') + '</td>' : '') + '</tr>').join('') +
      '</tbody></table></div>';
  }

  const przyciskEksportu = (id) => '<button class="przycisk" data-a="eksport" data-t="' + id + '">' + ikona('xls') + 'Eksport do Excela</button>';

  // ------------------------------------------------------------ ekrany wejściowe

  function ekranStartowy() {
    const wspiera = 'showDirectoryPicker' in window;
    return '<div class="start"><div class="karta-startowa">' +
      (LOGO ? '<img src="' + LOGO + '" alt="maasck" class="logo-start">' : '') +
      '<h1>Magazyn</h1><p class="szary">Ewidencja urządzeń i materiałów instalacyjnych</p>' +
      (wspiera
        ? '<button class="przycisk glowny duzy" data-a="wybierzFolder">' + ikona('folder') + 'Wybierz folder „Magazyn AV”</button>' +
          (app.zapamietanyFolder ? '<button class="przycisk duzy" data-a="polaczPonownie">' + ikona('odsw') + 'Połącz ponownie z „' + esc(app.zapamietanyFolder.name) + '”</button>' : '') +
          '<p class="maly szary">Wskaż folder na firmowym OneDrive (zsynchronizowany na tym komputerze). Pusty folder zostanie przygotowany automatycznie.</p>'
        : '<div class="alert ostrz">Ta przeglądarka nie potrafi zapisywać plików w folderze. Otwórz plik <b>Magazyn.html</b> w <b>Microsoft Edge</b> lub <b>Google Chrome</b> na komputerze.</div>') +
      '<div class="separator"><span>albo</span></div>' +
      '<button class="przycisk duzy" data-a="demo">Wypróbuj na danych przykładowych</button>' +
      '<p class="maly szary">Tryb demonstracyjny nic nie zapisuje. PIN użytkowników przykładowych: 1234.</p>' +
      '</div></div>';
  }

  function ekranUzytkownika() {
    const aktywni = Array.from(app.st.uzytkownicy.values()).filter((u) => u.aktywny !== false).sort((a, b) => (a.nazwisko + a.imie).localeCompare(b.nazwisko + b.imie, 'pl'));
    return '<div class="start"><div class="karta-startowa">' +
      (LOGO ? '<img src="' + LOGO + '" alt="maasck" class="logo-start">' : '') +
      '<h1>Kto pracuje?</h1>' +
      '<p class="szary">Folder: <b>' + esc(app.store.nazwa) + '</b>' + (app.demo ? ' · tryb demonstracyjny' : '') + '</p>' +
      (aktywni.length
        ? '<div class="lista-osob">' + aktywni.map((u) => '<button class="osoba" data-a="wybierzOsobe" data-id="' + esc(u.userId) + '"><span class="awatar">' + esc((u.imie[0] || '') + (u.nazwisko[0] || '')) + '</span><span>' + esc(u.imie + ' ' + u.nazwisko) + '</span></button>').join('') + '</div>'
        : '<div class="alert info">To nowy folder. Dodaj pierwszego użytkownika.</div>') +
      '<button class="przycisk" data-a="nowyUzytkownik">' + ikona('plus') + 'Dodaj użytkownika</button>' +
      ' <button class="przycisk tekstowy" data-a="zmienFolder">Inny folder</button>' +
      '</div></div>';
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
    ['kartoteka', 'Kartoteka modeli', 'kart'],
    ['klienci', 'Klienci', 'kli'],
    ['dziennik', 'Dziennik zmian', 'dz'],
    ['problemy', 'Kontrola spójności', 'prob'],
    ['ustawienia', 'Ustawienia', 'ust'],
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
        '<div class="marka">' + (LOGO ? '<img src="' + LOGO + '" alt="maasck">' : '<b>MAASCK</b>') + '<span>Magazyn</span></div>' +
        '<div class="szybkie">' +
          '<button class="przycisk glowny" data-a="nowyDok" data-r="PZ">' + ikona('przyj') + 'Przyjęcie</button>' +
          '<button class="przycisk glowny" data-a="nowyDok" data-r="WZ">' + ikona('wyd') + 'Wydanie</button>' +
          '<button class="przycisk" data-a="nowyDok" data-r="ZW">' + ikona('zwrot') + 'Zwrot</button>' +
        '</div>' +
        '<nav>' + MENU.map((m) => {
          if (m[0] === '-') return '<hr>';
          const licznik = m[0] === 'uzupelnienia' && l.uzupelnienia ? '<span class="licznik czerwony">' + l.uzupelnienia + '</span>' : m[0] === 'problemy' && l.problemy ? '<span class="licznik">' + l.problemy + '</span>' : '';
          return '<a href="#" class="' + (app.widok === m[0] ? 'aktywny' : '') + '" data-a="idz" data-w="' + m[0] + '">' + ikona(m[2]) + '<span>' + m[1] + '</span>' + licznik + '</a>';
        }).join('') + '</nav>' +
      '</aside>' +
      '<main class="glowna">' +
        '<header class="gora">' +
          (app.demo ? '<span class="znaczek demo">Tryb demonstracyjny – nic nie jest zapisywane</span>' : '<span class="szary maly">' + ikona('folder') + ' ' + esc(app.store.nazwa) + ' · odczyt ' + (app.ostatniOdczyt ? fmtCzas(app.ostatniOdczyt.toISOString()).slice(11) : '') + '</span>') +
          '<span class="odstep"></span>' +
          '<button class="przycisk tekstowy" data-a="odswiez" title="Wczytaj zmiany innych osób">' + ikona('odsw') + 'Odśwież</button>' +
          '<button class="uzytkownik" data-a="zmienOsobe" title="Zmień użytkownika"><span class="awatar">' + esc((u.imie[0] || '') + (u.nazwisko[0] || '')) + '</span>' + esc(u.imie + ' ' + u.nazwisko) + '</button>' +
        '</header>' +
        '<div class="zawartosc">' + tresc + '</div>' +
      '</main></div>';
  }

  function naglowekWidoku(tytul, podtytul, przyciski) {
    return '<div class="naglowek-widoku"><div><h1>' + tytul + '</h1>' + (podtytul ? '<p class="szary">' + podtytul + '</p>' : '') + '</div><div class="przyciski">' + (przyciski || '') + '</div></div>';
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
    const kafel = (wartosc, opis, widok, klasa) => '<button class="kafel ' + (klasa || '') + '" data-a="idz" data-w="' + widok + '"><b>' + wartosc + '</b><span>' + opis + '</span></button>';
    return naglowekWidoku('Dzień dobry, ' + esc(app.user.imie), 'Stan na ' + fmtCzas(new Date().toISOString())) +
      (bezBo ? '<div class="alert info"><b>Start od zera.</b> Wprowadź stan początkowy podczas inwentaryzacji dokumentem <b>Bilans otwarcia (BO)</b>. <button class="przycisk glowny" data-a="nowyDok" data-r="BO">' + ikona('bo') + 'Rozpocznij bilans otwarcia</button></div>' : '') +
      '<div class="kafle">' +
        kafel(app.st.modele.size, 'modeli w kartotece', 'kartoteka') +
        kafel(fmtL(naStanie), 'urządzeń na stanie', 'urzadzenia') +
        kafel(wydaniaMiesiac, 'wydań w tym miesiącu', 'dokumenty') +
        kafel(otwarte.length, 'do uzupełnienia po WZZ', 'uzupelnienia', otwarte.length ? 'czerwony' : '') +
        kafel(bezSkanu.length, 'dokumentów bez podpisu', 'raporty', bezSkanu.length ? 'pomaranczowy' : '') +
        kafel(ponizej.length, 'pozycji poniżej minimum', 'raporty', ponizej.length ? 'pomaranczowy' : '') +
        (app.st.problemy.length ? kafel(app.st.problemy.length, 'uwag kontroli spójności', 'problemy', 'pomaranczowy') : '') +
      '</div>' +
      '<div class="dwie-kolumny"><section class="karta"><h2>Ostatnie dokumenty</h2>' + listaDokumentow(docs.slice(0, 8), 'pulpitDok', true) + '</section>' +
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
      const komorki = ['<b class="nowrap">' + esc(x.numer) + '</b>', znacznikDok(d), '<span class="nowrap">' + fmtData(x.data || d.ev.ts) + '</span>', '<span class="nowrap">' + esc(x.projekt || '') + '</span>', esc(x.klientNazwa || x.dostawca || '')];
      const dane = [x.numer, C.RODZAJE[x.rodzaj].nazwa + (d.anulowany ? ' (anulowany)' : ''), fmtData(x.data || d.ev.ts), x.projekt || '', x.klientNazwa || x.dostawca || ''];
      if (!kompakt) {
        komorki.push((x.pozycje || []).length, esc(osoba(d.ev.autor)));
        dane.push((x.pozycje || []).length, osoba(d.ev.autor));
      }
      return { klasa: (d.anulowany ? 'anulowany ' : '') + (x.rodzaj === 'WZZ' ? 'wzz' : ''), akcja: 'pokazDok" data-id="' + d.ev.id, komorki, dane };
    });
    const nagl = ['Numer', 'Rodzaj', 'Data', 'Projekt', 'Klient / dostawca'].concat(kompakt ? [] : ['Pozycje', 'Wystawił']);
    return tabela(id, 'Dokumenty', nagl, wiersze, { pusto: 'Nie ma jeszcze dokumentów', liczbowe: kompakt ? [] : [5] });
  }

  function poleSzukaj(klucz, placeholder) {
    return '<label class="szukaj">' + ikona('szuk') + '<input type="search" placeholder="' + esc(placeholder || 'Szukaj…') + '" value="' + esc(app.filtr[klucz] || '') + '" data-filtr="' + klucz + '"></label>';
  }
  const pasuje = (klucz, ...teksty) => {
    const f = C.normKlucz(app.filtr[klucz] || '');
    if (!f) return true;
    const t = C.normKlucz(teksty.join(' '));
    return f.split(' ').every((cz) => t.includes(cz));
  };

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
        komorki: [esc(m.kategoria || ''), '<b>' + esc((m.producent ? m.producent + ' ' : '') + m.model) + '</b>' + (m.status === 'EOL' ? ' <span class="znaczek eol">EOL</span>' : m.status === 'wycofany' ? ' <span class="znaczek anul">wycofany</span>' : ''), esc(m.pn || ''), fmtIl(m.modelId, w.wolne), w.podProjekt ? fmtIl(m.modelId, w.podProjekt) : '<span class="szary">–</span>', '<b>' + fmtIl(m.modelId, w.razem) + '</b>', w.wydane ? fmtIl(m.modelId, w.wydane) : '<span class="szary">–</span>', m.stanMin ? fmtL(m.stanMin) : ''],
        dane: [m.kategoria || '', (m.producent ? m.producent + ' ' : '') + m.model, m.pn || '', w.wolne, w.podProjekt, w.razem, w.wydane, Number(m.stanMin) || null, m.jednostka || 'szt', m.status || 'aktywny'],
      };
    });
    tabele.stan = { nazwa: 'Stan magazynu', naglowki: ['Kategoria', 'Model', 'Kod producenta', 'Wolne', 'Pod projekty', 'Razem w magazynie', 'Wydane do klientów', 'Stan minimalny', 'Jednostka', 'Status'], wiersze: wiersze.map((w) => w.dane) };
    return naglowekWidoku('Stan magazynu', 'Wolne + kupione pod projekty = razem w magazynie. Kliknij wiersz, aby zobaczyć szczegóły.', przyciskEksportu('stan')) +
      '<div class="filtry">' + poleSzukaj('stan', 'Szukaj modelu, producenta, kodu…') +
        '<select data-filtr="stanKat"><option value="">Wszystkie kategorie</option>' + C.KATEGORIE.map((k) => '<option ' + (k === kat ? 'selected' : '') + '>' + esc(k) + '</option>').join('') + '</select>' +
        '<label class="przelacznik"><input type="checkbox" data-filtr="stanMin" ' + (tylkoMin ? 'checked' : '') + '> tylko poniżej minimum</label>' +
      '</div>' +
      (wiersze.length ? '<div class="tabela-owijka"><table class="tabela"><thead><tr><th>Kategoria</th><th>Model</th><th>Kod producenta</th><th class="l">Wolne</th><th class="l">Pod projekty</th><th class="l">Razem</th><th class="l">U klientów</th><th class="l">Min.</th></tr></thead><tbody>' +
        wiersze.map((w) => '<tr class="' + w.klasa + '" data-a="' + w.akcja + '" tabindex="0">' + w.komorki.map((k, i) => '<td class="' + (i >= 3 ? 'l' : '') + '">' + k + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>'
        : '<div class="pusto">' + (app.st.modele.size ? 'Nic nie pasuje do filtra' : 'Kartoteka jest pusta. Dodaj modele w kartotece albo od razu w dokumencie przyjęcia.') + '</div>');
  };

  WIDOKI.lokalizacje = () => {
    const wiersze = C.wierszeMagazynu(app.st)
      .filter((w) => pasuje('lok', w.lok, nazwaModelu(w.modelId), w.sn, w.projekt, model(w.modelId).pn))
      .sort((a, b) => (a.lok + nazwaModelu(a.modelId) + a.sn).localeCompare(b.lok + nazwaModelu(b.modelId) + b.sn, 'pl'));
    const html = tabela('lokalizacje', 'Lokalizacje', ['Lokalizacja', 'Model', 'Nr seryjny', 'Ilość', 'Pod projekt', 'Stan techniczny'], wiersze.map((w) => ({
      komorki: ['<b>' + esc(w.lok) + '</b>', esc(nazwaModelu(w.modelId)), esc(w.sn || ''), fmtIl(w.modelId, w.ilosc), w.projekt ? '<span class="znaczek projekt">' + esc(w.projekt) + '</span>' : '', esc(w.stanTech || '')],
      dane: [w.lok, nazwaModelu(w.modelId), w.sn || '', w.ilosc, w.projekt || '', w.stanTech || ''],
      akcjeHtml: '<button class="przycisk maly" data-a="przenies" data-m="' + esc(w.modelId) + '" data-sn="' + esc(w.sn) + '" data-lok="' + esc(w.lok) + '" data-p="' + esc(w.projekt) + '" data-il="' + w.ilosc + '">Przenieś</button>',
    })), { akcje: true, liczbowe: [3], pusto: 'Magazyn jest pusty' });
    return naglowekWidoku('Lokalizacje', 'Co leży w którym miejscu. „Przenieś” zmienia półkę bez formularza – zmiana trafia do dziennika.', przyciskEksportu('lokalizacje')) +
      '<div class="filtry">' + poleSzukaj('lok', 'Szukaj lokalizacji, modelu, numeru seryjnego, projektu…') + '</div>' + html;
  };

  WIDOKI.urzadzenia = () => {
    const status = app.filtr.urzStatus || '';
    const lista = Array.from(app.st.egzemplarze.values())
      .filter((e) => (!status || e.status === status) && pasuje('urz', e.sn, nazwaModelu(e.modelId), e.lok, e.projekt, e.klient, e.projektZakupu, model(e.modelId).pn))
      .sort((a, b) => (nazwaModelu(a.modelId) + a.sn).localeCompare(nazwaModelu(b.modelId) + b.sn, 'pl'));
    const html = tabela('urzadzenia', 'Urządzenia', ['Model', 'Nr seryjny', 'Status', 'Gdzie', 'Pod projekt', 'Stan techniczny', 'Przyjęto'], lista.map((e) => ({
      akcja: 'historia" data-m="' + esc(e.modelId) + '" data-sn="' + esc(e.sn),
      komorki: [esc(nazwaModelu(e.modelId)), '<b class="mono">' + esc(e.sn) + '</b>', e.status === 'magazyn' ? '<span class="znaczek ok">w magazynie</span>' : '<span class="znaczek wyd">u klienta</span>', e.status === 'magazyn' ? esc(e.lok) : esc(e.projekt + (e.klient ? ' · ' + e.klient : '')), e.projektZakupu ? '<span class="znaczek projekt">' + esc(e.projektZakupu) + '</span>' : '', esc(e.stanTech || ''), esc(e.przyjeto ? e.przyjeto.numer : '')],
      dane: [nazwaModelu(e.modelId), e.sn, e.status === 'magazyn' ? 'w magazynie' : 'u klienta', e.status === 'magazyn' ? e.lok : e.projekt + (e.klient ? ' · ' + e.klient : ''), e.projektZakupu || '', e.stanTech || '', e.przyjeto ? e.przyjeto.numer : ''],
    })), { pusto: 'Brak urządzeń z numerami seryjnymi' });
    return naglowekWidoku('Urządzenia', 'Każde urządzenie śledzone po numerze seryjnym. Kliknij, aby zobaczyć historię.', przyciskEksportu('urzadzenia')) +
      '<div class="filtry">' + poleSzukaj('urz', 'Szukaj numeru seryjnego, modelu, projektu, klienta…') +
      '<select data-filtr="urzStatus"><option value="">Wszystkie</option><option value="magazyn" ' + (status === 'magazyn' ? 'selected' : '') + '>W magazynie</option><option value="wydany" ' + (status === 'wydany' ? 'selected' : '') + '>U klienta</option></select></div>' + html;
  };

  WIDOKI.dokumenty = () => {
    const rodzaj = app.filtr.dokRodzaj || '';
    const docs = C.dokumentyLista(app.st).filter((d) => {
      const x = d.ev.dane;
      if (rodzaj === 'bezpodpisu') { if (d.anulowany || d.skany.length) return false; }
      else if (rodzaj && x.rodzaj !== rodzaj) return false;
      return pasuje('dok', x.numer, x.projekt, x.klientNazwa, x.dostawca, x.nrFaktury, x.osoba, x.uwagi, (x.pozycje || []).map((p) => nazwaModelu(p.modelId) + ' ' + (p.sn || '')).join(' '));
    });
    return naglowekWidoku('Dokumenty', 'Kliknij dokument, aby go wydrukować, dołączyć skan podpisu albo anulować.', przyciskEksportu('dokumenty')) +
      '<div class="filtry">' + poleSzukaj('dok', 'Szukaj numeru, projektu, klienta, numeru seryjnego…') +
      '<select data-filtr="dokRodzaj"><option value="">Wszystkie rodzaje</option>' + Object.entries(C.RODZAJE).map(([k, v]) => '<option value="' + k + '" ' + (rodzaj === k ? 'selected' : '') + '>' + k + ' – ' + v.nazwa + '</option>').join('') + '<option value="bezpodpisu" ' + (rodzaj === 'bezpodpisu' ? 'selected' : '') + '>Bez dołączonego podpisu</option></select></div>' +
      listaDokumentow(docs, 'dokumenty');
  };

  WIDOKI.uzupelnienia = () => {
    const pokazZamkniete = !!app.filtr.uzupWszystkie;
    const lista = app.st.uzupelnienia.filter((u) => pokazZamkniete || !u.zamkniete).slice().reverse();
    const html = tabela('uzupelnienia', 'Do uzupełnienia', ['Projekt zakupu (brakuje)', 'Model', 'Nr seryjny / ilość', 'Wydano na projekt', 'Dokument', 'Data', 'Powód', 'Status'], lista.map((u) => ({
      klasa: u.zamkniete ? 'zamkniete' : 'wzz',
      komorki: ['<b>' + esc(u.projektZakupu) + '</b>', esc(nazwaModelu(u.modelId)), u.sn ? '<span class="mono">' + esc(u.sn) + '</span>' : fmtIl(u.modelId, u.ilosc), esc(u.projektDocelowy), '<a href="#" data-a="pokazDok" data-id="' + esc(u.docId) + '">' + esc(u.numer) + '</a>', fmtData(u.ts), esc(u.powod), u.zamkniete ? '<span class="znaczek ok">uzupełnione</span><div class="maly szary">' + esc(u.zamknieto.uwagi || '') + '</div>' : '<span class="znaczek brak">do uzupełnienia</span>'],
      dane: [u.projektZakupu, nazwaModelu(u.modelId), u.sn || u.ilosc + ' ' + jedn(u.modelId), u.projektDocelowy, u.numer, fmtData(u.ts), u.powod, u.zamkniete ? 'uzupełnione: ' + (u.zamknieto.uwagi || '') : 'do uzupełnienia'],
      akcjeHtml: u.zamkniete ? '' : '<button class="przycisk maly" data-a="uzupelnij" data-id="' + esc(u.docId) + '" data-idx="' + u.idx + '">Uzupełnione…</button>',
    })), { akcje: true, pusto: pokazZamkniete ? 'Brak wydań zastępczych' : 'Nic nie czeka na uzupełnienie' });
    return naglowekWidoku('Do uzupełnienia', 'Sprzęt kupiony pod projekt, który poszedł wydaniem zastępczym (WZZ) na inny projekt. Trzeba go dokupić pod projekt zakupu.', przyciskEksportu('uzupelnienia')) +
      '<div class="filtry"><label class="przelacznik"><input type="checkbox" data-filtr="uzupWszystkie" ' + (pokazZamkniete ? 'checked' : '') + '> pokaż także uzupełnione</label></div>' + html;
  };

  WIDOKI.raporty = () => {
    const rap = app.filtr.raport || 'projekt';
    const zakladki = [['projekt', 'Wydane na projekt'], ['klient', 'Wydane do klienta'], ['podprojekt', 'Pod projekt w magazynie'], ['minimum', 'Poniżej minimum'], ['eol', 'EOL na stanie'], ['podpis', 'Bez podpisu'], ['historia', 'Historia urządzenia']];
    let tresc = '';
    const pod = C.podpowiedzi(app.st);
    if (rap === 'projekt' || rap === 'klient') {
      const wartosc = app.filtr['rap_' + rap] || '';
      const lista = rap === 'projekt' ? pod.projekty : pod.klienci;
      let w = C.wydaneNaProjekt(app.st, rap === 'projekt' ? wartosc : '');
      if (rap === 'klient') w = w.filter((x) => !wartosc || C.normKlucz(x.klient) === C.normKlucz(wartosc));
      tresc = '<div class="filtry"><label class="pole wiersz"><span>' + (rap === 'projekt' ? 'Numer projektu' : 'Klient') + '</span><input list="dl-rap" value="' + esc(wartosc) + '" data-filtr="rap_' + rap + '" data-natychmiast="1" placeholder="wszystkie"></label><datalist id="dl-rap">' + lista.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist></div>' +
        tabela('raport', rap === 'projekt' ? 'Wydane na projekt ' + (wartosc || '(wszystkie)') : 'Wydane do klienta ' + (wartosc || '(wszyscy)'), ['Projekt', 'Klient', 'Model', 'Nr seryjny', 'Ilość', 'Dokument'], w.sort((a, b) => (a.projekt + nazwaModelu(a.modelId)).localeCompare(b.projekt + nazwaModelu(b.modelId), 'pl')).map((x) => ({
          komorki: [esc(x.projekt), esc(x.klient), esc(nazwaModelu(x.modelId)), '<span class="mono">' + esc(x.sn) + '</span>', fmtIl(x.modelId, x.ilosc), esc(x.numer || '')],
          dane: [x.projekt, x.klient, nazwaModelu(x.modelId), x.sn, x.ilosc, x.numer || ''],
        })), { liczbowe: [4], pusto: 'Nic nie zostało wydane' });
    } else if (rap === 'podprojekt') {
      const w = C.wierszeMagazynu(app.st).filter((x) => x.projekt).sort((a, b) => (a.projekt + nazwaModelu(a.modelId)).localeCompare(b.projekt + nazwaModelu(b.modelId), 'pl'));
      tresc = tabela('raport', 'Kupione pod projekt – w magazynie', ['Projekt', 'Model', 'Nr seryjny', 'Ilość', 'Lokalizacja'], w.map((x) => ({
        komorki: ['<b>' + esc(x.projekt) + '</b>', esc(nazwaModelu(x.modelId)), '<span class="mono">' + esc(x.sn) + '</span>', fmtIl(x.modelId, x.ilosc), esc(x.lok)],
        dane: [x.projekt, nazwaModelu(x.modelId), x.sn, x.ilosc, x.lok],
      })), { liczbowe: [3], pusto: 'Nic nie czeka w magazynie pod projekty' });
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
    return naglowekWidoku('Raporty', 'Każdy raport można wyeksportować do Excela.', przyciskEksportu('raport')) +
      '<div class="zakladki">' + zakladki.map(([k, n]) => '<button class="' + (rap === k ? 'aktywna' : '') + '" data-a="raport" data-r="' + k + '">' + n + '</button>').join('') + '</div>' + tresc;
  };

  function historiaHtml(e) {
    return '<section class="karta"><h3>' + esc(nazwaModelu(e.modelId)) + ' · SN <span class="mono">' + esc(e.sn) + '</span></h3>' +
      '<p>' + (e.status === 'magazyn' ? 'W magazynie: <b>' + esc(e.lok) + '</b>' : 'U klienta: <b>' + esc(e.klient) + '</b>, projekt <b>' + esc(e.projekt) + '</b>') + ' · stan: ' + esc(e.stanTech) + (e.projektZakupu ? ' · kupione pod projekt <b>' + esc(e.projektZakupu) + '</b>' : '') + '</p>' +
      '<ol class="os-czasu">' + e.historia.slice().reverse().map((h) => '<li><span class="szary">' + fmtCzas(h.ts) + '</span> ' + (h.docId ? '<a href="#" data-a="pokazDok" data-id="' + esc(h.docId) + '">' + esc(h.numer) + '</a> · ' : '') + esc(h.opis) + '</li>').join('') + '</ol></section>';
  }

  WIDOKI.kartoteka = () => {
    const lista = Array.from(app.st.modele.values()).filter((m) => pasuje('kart', m.producent, m.model, m.pn, m.ean, m.kategoria)).sort((a, b) => (a.kategoria + a.producent + a.model).localeCompare(b.kategoria + b.producent + b.model, 'pl'));
    const html = tabela('kartoteka', 'Kartoteka modeli', ['Kategoria', 'Producent', 'Model', 'Kod producenta', 'EAN', 'Nr seryjny', 'Jednostka', 'Stan min.', 'Status'], lista.map((m) => ({
      akcja: 'edytujModel" data-id="' + esc(m.modelId),
      komorki: [esc(m.kategoria || ''), esc(m.producent || ''), '<b>' + esc(m.model) + '</b>', esc(m.pn || ''), esc(m.ean || ''), m.seryjny ? 'tak' : 'nie', esc(m.jednostka || 'szt') + (m.jednostkaZakupu ? ' <span class="szary">(' + esc(m.jednostkaZakupu) + ' = ' + fmtL(m.przelicznik) + ')</span>' : ''), m.stanMin ? fmtL(m.stanMin) : '', m.status === 'EOL' ? '<span class="znaczek eol">EOL</span>' : esc(m.status || 'aktywny')],
      dane: [m.kategoria || '', m.producent || '', m.model, m.pn || '', m.ean || '', m.seryjny ? 'tak' : 'nie', m.jednostka || 'szt', Number(m.stanMin) || null, m.status || 'aktywny'],
    })), { pusto: 'Kartoteka jest pusta' });
    return naglowekWidoku('Kartoteka modeli', 'Urządzenia z gwarancją, które trafiają do klienta, śledź po numerze seryjnym. Materiały (kable, korytka) liczone są w metrach lub sztukach.', '<button class="przycisk glowny" data-a="edytujModel">' + ikona('plus') + 'Nowy model</button>' + przyciskEksportu('kartoteka')) +
      '<div class="filtry">' + poleSzukaj('kart', 'Szukaj w kartotece…') + '</div>' + html;
  };

  WIDOKI.klienci = () => {
    const lista = Array.from(app.st.klienci.values()).filter((k) => pasuje('kli', k.nazwa, k.nip, k.adres, k.kontakt)).sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'));
    const html = tabela('klienci', 'Klienci', ['Nazwa', 'NIP', 'Adres', 'Osoba kontaktowa', 'Telefon', 'E-mail'], lista.map((k) => ({
      akcja: 'edytujKlienta" data-id="' + esc(k.klientId),
      komorki: ['<b>' + esc(k.nazwa) + '</b>', esc(k.nip || ''), esc(k.adres || ''), esc(k.kontakt || ''), esc(k.tel || ''), esc(k.email || '')],
      dane: [k.nazwa, k.nip || '', k.adres || '', k.kontakt || '', k.tel || '', k.email || ''],
    })), { pusto: 'Lista klientów jest pusta. Klienta możesz też wpisać ręcznie przy wydaniu.' });
    return naglowekWidoku('Klienci', 'Lista jest pomocą, nie obowiązkiem – przy wydaniu można wpisać dowolnego klienta.', '<button class="przycisk glowny" data-a="edytujKlienta">' + ikona('plus') + 'Nowy klient</button>' + przyciskEksportu('klienci')) +
      '<div class="filtry">' + poleSzukaj('kli', 'Szukaj klienta…') + '</div>' + html;
  };

  WIDOKI.dziennik = () => {
    const lista = app.st.zdarzenia.slice().reverse().filter((ev) => pasuje('dz', C.opisZdarzenia(app.st, ev), osoba(ev.autor), ev.typ));
    const html = tabela('dziennik', 'Dziennik zmian', ['Data i godzina', 'Kto', 'Rodzaj', 'Opis'], lista.slice(0, 500).map((ev) => ({
      komorki: [fmtCzas(ev.ts), esc(osoba(ev.autor)), '<span class="znaczek">' + esc(ev.typ) + '</span>', esc(C.opisZdarzenia(app.st, ev))],
      dane: [fmtCzas(ev.ts), osoba(ev.autor), ev.typ, C.opisZdarzenia(app.st, ev)],
    })), { pusto: 'Dziennik jest pusty' });
    if (tabele.dziennik) tabele.dziennik.wiersze = lista.map((ev) => [fmtCzas(ev.ts), osoba(ev.autor), ev.typ, C.opisZdarzenia(app.st, ev)]);
    return naglowekWidoku('Dziennik zmian', 'Każda operacja z autorem i godziną. Nic nie jest kasowane.', przyciskEksportu('dziennik')) +
      '<div class="filtry">' + poleSzukaj('dz', 'Szukaj w dzienniku…') + '</div>' + html + (lista.length > 500 ? '<p class="szary maly">Pokazano 500 najnowszych wpisów; eksport zawiera wszystkie.</p>' : '');
  };

  WIDOKI.problemy = () => {
    const p = app.st.problemy;
    return naglowekWidoku('Kontrola spójności', 'Aplikacja sprawdza przy każdym odczycie, czy nikt nie zmienił ani nie usunął plików poza nią i czy synchronizacja nie utworzyła kopii.', '') +
      (p.length ? '<section class="karta"><ul class="problemy">' + p.map((x) => '<li><span class="znaczek">' + esc(x.kod) + '</span> ' + esc(x.opis) + '</li>').join('') + '</ul></section>' +
        '<div class="alert info">Najczęstsza przyczyna: OneDrive jeszcze synchronizuje pliki z innego komputera albo utworzył kopię konfliktową. Poczekaj chwilę i kliknij „Odśwież”. Jeśli uwaga zostaje, sprawdź historię wersji pliku w OneDrive.</div>'
        : '<div class="alert ok">Wszystko w porządku: ' + app.zdarzenia.length + ' plików, bez luk, zmian i konfliktów.</div>');
  };

  WIDOKI.ustawienia = () => {
    const uzytkownicy = Array.from(app.st.uzytkownicy.values()).sort((a, b) => (a.nazwisko + a.imie).localeCompare(b.nazwisko + b.imie, 'pl'));
    return naglowekWidoku('Ustawienia', '', '') +
      '<div class="dwie-kolumny"><section class="karta"><h2>Użytkownicy</h2><p class="szary">Ról nie ma – każdy może to samo. PIN potwierdza, kto wystawił dokument.</p>' +
      tabela('uzytkownicy', 'Użytkownicy', ['Imię i nazwisko', 'E-mail', 'Telefon', 'Status'], uzytkownicy.map((u) => ({
        akcja: 'edytujUzytkownika" data-id="' + esc(u.userId),
        komorki: ['<b>' + esc(u.imie + ' ' + u.nazwisko) + '</b>', esc(u.email || ''), esc(u.tel || ''), u.aktywny === false ? '<span class="znaczek anul">nieaktywny</span>' : '<span class="znaczek ok">aktywny</span>'],
        dane: [u.imie + ' ' + u.nazwisko, u.email || '', u.tel || '', u.aktywny === false ? 'nieaktywny' : 'aktywny'],
      }))) +
      '<p><button class="przycisk" data-a="nowyUzytkownik">' + ikona('plus') + 'Dodaj użytkownika</button> <button class="przycisk" data-a="zmienPin">Zmień mój PIN</button></p></section>' +
      '<section class="karta"><h2>Dane</h2>' +
        '<p>Folder: <b>' + esc(app.store.nazwa) + '</b>' + (app.demo ? ' (tryb demonstracyjny)' : '') + '<br>Plików zdarzeń: ' + app.zdarzenia.length + '<br>Ostatni odczyt: ' + (app.ostatniOdczyt ? fmtCzas(app.ostatniOdczyt.toISOString()) : '') + '</p>' +
        '<p><button class="przycisk" data-a="kopiaTeraz" ' + (app.demo ? 'disabled' : '') + '>Zrób kopię zapasową teraz</button> <button class="przycisk" data-a="pobierzBaze">Pobierz całą bazę (JSON)</button></p>' +
        '<p class="szary maly">Kopia tygodniowa zapisuje się sama do podfolderu <b>kopie</b> przy pierwszym uruchomieniu w danym tygodniu.</p>' +
        '<p><button class="przycisk tekstowy" data-a="zmienFolder">Zamknij folder i wybierz inny</button></p>' +
      '</section></div>' +
      '<section class="karta"><h2>Nagłówek formularzy</h2><div class="naglowek-firmy">' + (LOGO ? '<img src="' + LOGO + '" alt="">' : '') + '<div><b>' + esc(FIRMA.nazwa) + '</b><br>' + esc(FIRMA.adres) + '<br>NIP ' + FIRMA.nip + ' · REGON ' + FIRMA.regon + ' · KRS ' + FIRMA.krs + '</div></div></section>';
  };

  // ------------------------------------------------------------ formularze dokumentów

  function nowySzkic(rodzaj) {
    return { rodzaj, data: dzis(), projekt: '', klientNazwa: '', adres: '', osoba: '', dostawca: '', nrFaktury: '', podProjekt: false, uwagi: '', powod: '', pozycje: [], szukaj: '' };
  }

  function etykietaModelu(m) {
    return (m.producent ? m.producent + ' ' : '') + m.model + (m.pn ? ' · ' + m.pn : '');
  }

  function datalisty() {
    const p = C.podpowiedzi(app.st);
    const dl = (id, lista) => '<datalist id="' + id + '">' + lista.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist>';
    const modele = Array.from(app.st.modele.values()).filter((m) => m.status !== 'wycofany').sort((a, b) => etykietaModelu(a).localeCompare(etykietaModelu(b), 'pl'));
    return dl('dl-lok', p.lokalizacje) + dl('dl-proj', p.projekty) + dl('dl-kli', p.klienci) + dl('dl-dost', p.dostawcy) + dl('dl-prod', p.producenci) + dl('dl-model', modele.map(etykietaModelu));
  }

  function modelZEtykiety(tekst) {
    const t = C.normKlucz(tekst);
    for (const m of app.st.modele.values()) if (C.normKlucz(etykietaModelu(m)) === t) return m;
    return null;
  }

  const pole = (etykieta, html, kl) => '<label class="pole ' + (kl || '') + '"><span>' + etykieta + '</span>' + html + '</label>';
  const wejscie = (nazwa, wartosc, atr) => '<input data-f="' + nazwa + '" value="' + esc(wartosc) + '" ' + (atr || '') + '>';

  WIDOKI.dokument = () => {
    const s = app.szkic;
    if (!s) return WIDOKI.pulpit();
    const r = s.rodzaj;
    let naglowek = '';
    let pozycje = '';
    if (r === 'PZ' || r === 'BO') {
      naglowek = '<div class="siatka">' +
        pole('Data', wejscie('data', s.data, 'type="date"')) +
        (r === 'PZ' ? pole('Dostawca *', wejscie('dostawca', s.dostawca, 'list="dl-dost" placeholder="nazwa dostawcy"')) + pole('Nr faktury lub WZ dostawcy', wejscie('nrFaktury', s.nrFaktury)) : pole('Spisujący', wejscie('osoba', s.osoba || osoba(app.user.userId)))) +
        (r === 'PZ' ? '<div class="pole"><span>Kupione pod projekt?</span><label class="przelacznik"><input type="checkbox" data-f="podProjekt" data-przerysuj="1" ' + (s.podProjekt ? 'checked' : '') + '> tak, pod projekt</label>' + (s.podProjekt ? wejscie('projekt', s.projekt, 'list="dl-proj" placeholder="numer projektu"') : '') + '</div>' : '') +
        pole('Uwagi', wejscie('uwagi', s.uwagi), 'szerokie') +
        '</div>';
      pozycje = s.pozycje.map((p, i) => {
        const m = p.modelId ? app.st.modele.get(p.modelId) : null;
        let szczeg = '';
        if (m && m.seryjny) {
          const sn = (p.snTekst || '').split(/[\n,;\t]+/).map((x) => x.trim()).filter(Boolean);
          szczeg = pole('Numery seryjne (jeden w linii) · <b data-licznik="' + i + '">' + sn.length + '</b> szt.', '<textarea data-p="' + i + ':snTekst" rows="' + Math.max(2, Math.min(8, sn.length + 1)) + '" placeholder="wklej lub zeskanuj numery">' + esc(p.snTekst || '') + '</textarea>', 'szerokie') +
            pole('Stan', '<select data-p="' + i + ':stanTech">' + C.STANY_TECHNICZNE.map((x) => '<option ' + (p.stanTech === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select>') +
            pole('Gwarancja do', '<input type="date" data-p="' + i + ':gwarancjaDo" value="' + esc(p.gwarancjaDo || '') + '">');
        } else if (m) {
          const opcje = '<option value="baza">' + esc(m.jednostka || 'szt') + '</option>' + (m.jednostkaZakupu ? '<option value="zakup" ' + (p.jedn === 'zakup' ? 'selected' : '') + '>' + esc(m.jednostkaZakupu) + ' (' + fmtL(m.przelicznik) + ' ' + esc(m.jednostka) + ')</option>' : '');
          const przeliczone = p.jedn === 'zakup' ? (Number(String(p.ilosc).replace(',', '.')) || 0) * Number(m.przelicznik) : null;
          szczeg = pole('Ilość', '<div class="ilosc"><input data-p="' + i + ':ilosc" value="' + esc(p.ilosc || '') + '" inputmode="decimal"><select data-p="' + i + ':jedn" data-przerysuj="1">' + opcje + '</select></div>' + (przeliczone !== null ? '<small class="szary" data-przel="' + i + '" data-mn="' + Number(m.przelicznik) + '" data-j="' + esc(m.jednostka) + '">= ' + fmtL(przeliczone) + ' ' + esc(m.jednostka) + '</small>' : ''));
        }
        return '<div class="pozycja">' +
          '<div class="pozycja-nr">' + (i + 1) + '</div>' +
          '<div class="siatka">' +
            pole('Model *', '<input list="dl-model" data-p="' + i + ':modelLabel" data-model="1" value="' + esc(p.modelLabel || '') + '" placeholder="zacznij pisać: producent, model, kod…"><small class="blad-tekst" data-podp="' + i + '"' + (C.norm(p.modelLabel) && !m ? '' : ' hidden') + '>Nie ma takiego modelu. <a href="#" data-a="edytujModel" data-poz="' + i + '">Dodaj do kartoteki</a></small>', 'szerokie') +
            pole('Lokalizacja *', '<input list="dl-lok" data-p="' + i + ':lok" value="' + esc(p.lok || '') + '" placeholder="np. Regał A, półka 2">') +
            (r === 'BO' ? pole('Kupione pod projekt', '<input list="dl-proj" data-p="' + i + ':projekt" value="' + esc(p.projekt || '') + '" placeholder="puste = wolny stan">') : '') +
            szczeg +
          '</div>' +
          '<button class="ikonowy" data-a="usunPoz" data-i="' + i + '" title="Usuń pozycję">' + ikona('x') + '</button>' +
        '</div>';
      }).join('');
      pozycje += '<div class="przyciski-pozycji"><button class="przycisk" data-a="dodajPoz">' + ikona('plus') + 'Dodaj pozycję</button> <button class="przycisk tekstowy" data-a="edytujModel" data-poz="nowa">Nowy model w kartotece</button></div>';
    } else if (r === 'WZ') {
      const zast = s.pozycje.some((p) => C.czyZastepcze(p.projektZakupu, s.projekt));
      naglowek = '<div class="siatka">' +
        pole('Data', wejscie('data', s.data, 'type="date"')) +
        pole('Numer projektu *', wejscie('projekt', s.projekt, 'list="dl-proj" placeholder="wpisz numer projektu" data-przerysuj-po="1"')) +
        pole('Klient *', wejscie('klientNazwa', s.klientNazwa, 'list="dl-kli" placeholder="wybierz z listy albo wpisz"')) +
        pole('Adres obiektu', wejscie('adres', s.adres, 'placeholder="gdzie jedzie sprzęt"')) +
        pole('Pobierający', wejscie('osoba', s.osoba, 'placeholder="imię i nazwisko"')) +
        pole('Uwagi', wejscie('uwagi', s.uwagi)) +
        '</div>' +
        (zast ? '<div class="alert wzz-alert"><b>WYDANIE ZASTĘPCZE (WZZ)</b><br>Część sprzętu została kupiona pod inny projekt. Dokument zostanie zapisany jako WZZ, na wydruku pojawi się czerwona ramka, a sprzęt trafi na listę „Do uzupełnienia”.' + pole('Powód wydania zastępczego *', '<textarea data-f="powod" rows="2" placeholder="dlaczego sprzęt z innego projektu?">' + esc(s.powod) + '</textarea>', 'szerokie') + '</div>' : '');
      pozycje = (s.pozycje.length ? '<div class="tabela-owijka"><table class="tabela"><thead><tr><th>Model</th><th>Nr seryjny</th><th>Z lokalizacji</th><th>Pod projekt</th><th class="l">Ilość</th><th></th></tr></thead><tbody>' +
        s.pozycje.map((p, i) => '<tr class="' + (C.czyZastepcze(p.projektZakupu, s.projekt) ? 'wzz' : '') + '"><td>' + esc(nazwaModelu(p.modelId)) + '</td><td class="mono">' + esc(p.sn || '') + '</td><td>' + esc(p.lok) + '</td><td>' + (p.projektZakupu ? '<span class="znaczek ' + (C.czyZastepcze(p.projektZakupu, s.projekt) ? 'brak' : 'projekt') + '">' + esc(p.projektZakupu) + '</span>' : '<span class="szary">wolne</span>') + '</td><td class="l">' + (p.sn ? '1 szt' : '<input class="w-ilosc" data-p="' + i + ':ilosc" value="' + esc(p.ilosc) + '" inputmode="decimal"> ' + esc(jedn(p.modelId)) + ' <small class="szary">z ' + fmtL(p.max) + '</small>') + '</td><td><button class="ikonowy" data-a="usunPoz" data-i="' + i + '">' + ikona('x') + '</button></td></tr>').join('') +
        '</tbody></table></div>' : '<div class="pusto">Wybierz sprzęt z magazynu poniżej</div>') + wyborZMagazynu(s);
    } else if (r === 'ZW') {
      naglowek = '<div class="siatka">' +
        pole('Data', wejscie('data', s.data, 'type="date"')) +
        pole('Numer projektu *', wejscie('projekt', s.projekt, 'list="dl-proj" placeholder="z jakiego projektu wraca sprzęt" data-przerysuj-po="1"')) +
        pole('Zwracający', wejscie('osoba', s.osoba, 'placeholder="imię i nazwisko"')) +
        pole('Uwagi', wejscie('uwagi', s.uwagi)) +
        '</div>';
      pozycje = (s.pozycje.length ? s.pozycje.map((p, i) => '<div class="pozycja"><div class="pozycja-nr">' + (i + 1) + '</div><div class="siatka">' +
        '<div class="pole szerokie"><span>Model</span><b>' + esc(nazwaModelu(p.modelId)) + '</b>' + (p.sn ? ' · SN <span class="mono">' + esc(p.sn) + '</span>' : '') + '</div>' +
        (p.sn ? pole('Stan po zwrocie', '<select data-p="' + i + ':stanTech">' + C.STANY_TECHNICZNE.map((x) => '<option ' + (p.stanTech === x ? 'selected' : '') + '>' + x + '</option>').join('') + '</select>') : pole('Ilość (wydano ' + fmtL(p.max) + ' ' + esc(jedn(p.modelId)) + ')', '<input data-p="' + i + ':ilosc" value="' + esc(p.ilosc) + '" inputmode="decimal">')) +
        pole('Lokalizacja *', '<input list="dl-lok" data-p="' + i + ':lok" value="' + esc(p.lok || '') + '" placeholder="gdzie odkładasz">') +
        '</div><button class="ikonowy" data-a="usunPoz" data-i="' + i + '">' + ikona('x') + '</button></div>').join('') : '<div class="pusto">Wybierz poniżej, co wraca z projektu</div>') + wyborZwrotu(s);
    }
    const tytuly = { PZ: 'Przyjęcie zewnętrzne (PZ)', BO: 'Bilans otwarcia (BO)', WZ: 'Wydanie na projekt (WZ / WZZ)', ZW: 'Zwrot z projektu (ZW)' };
    const podt = { PZ: 'Dostawa od dostawcy. Zaznacz projekt, jeśli sprzęt jest kupiony pod konkretny projekt.', BO: 'Inwentaryzacja startowa: wpisz wszystko, co fizycznie leży w magazynie, miejsce po miejscu.', WZ: 'Sprzęt jedzie do klienta. Jeśli wybierzesz sprzęt kupiony pod inny projekt, powstanie wydanie zastępcze (WZZ).', ZW: 'Nadwyżki materiału i niewykorzystane urządzenia wracające z projektu.' };
    return datalisty() + naglowekWidoku(tytuly[r], podt[r], '<button class="przycisk" data-a="anulujSzkic">Porzuć</button><button class="przycisk glowny" data-a="zapiszSzkic">Zapisz i drukuj</button>') +
      '<section class="karta">' + naglowek + '</section>' +
      '<section class="karta"><h2>Pozycje</h2>' + pozycje + '</section>' +
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
      .filter((w) => pasuje('wybor', nazwaModelu(w.modelId), model(w.modelId).pn, w.sn, w.lok, w.projekt))
      .sort((a, b) => ranga(a) - ranga(b) || (nazwaModelu(a.modelId) + a.lok + a.sn).localeCompare(nazwaModelu(b.modelId) + b.lok + b.sn, 'pl'));
    return '<h3 class="odstep-gora">Dostępne w magazynie</h3><div class="filtry">' + poleSzukaj('wybor', 'Szukaj: model, kod, numer seryjny, lokalizacja…') + '</div>' +
      (lista.length ? '<div class="tabela-owijka wysokosc"><table class="tabela"><thead><tr><th>Model</th><th>Nr seryjny</th><th>Lokalizacja</th><th>Pod projekt</th><th class="l">Dostępne</th><th></th></tr></thead><tbody>' +
        lista.slice(0, 200).map((w) => {
          const juz = wykorzystane.get(w.modelId + '|' + w.lok + '|' + (w.projekt || '')) || 0;
          const zast = C.czyZastepcze(w.projekt, s.projekt);
          return '<tr class="' + (zast ? 'inny-projekt' : '') + '"><td>' + esc(nazwaModelu(w.modelId)) + '</td><td class="mono">' + esc(w.sn) + '</td><td>' + esc(w.lok) + '</td><td>' + (w.projekt ? '<span class="znaczek ' + (zast ? 'brak' : 'projekt') + '">' + esc(w.projekt) + '</span>' : '<span class="szary">wolne</span>') + '</td><td class="l">' + fmtIl(w.modelId, w.ilosc - juz) + '</td><td class="akcje-wiersza"><button class="przycisk maly ' + (zast ? 'czerwony' : '') + '" data-a="dodajZMagazynu" data-m="' + esc(w.modelId) + '" data-sn="' + esc(w.sn) + '" data-lok="' + esc(w.lok) + '" data-p="' + esc(w.projekt) + '" data-il="' + w.ilosc + '" ' + (w.ilosc - juz <= 0 ? 'disabled' : '') + '>Dodaj</button></td></tr>';
        }).join('') + '</tbody></table></div>' : '<div class="pusto">Brak sprzętu pasującego do wyszukiwania</div>');
  }

  function wyborZwrotu(s) {
    if (!C.norm(s.projekt)) return '<div class="alert info odstep-gora">Wpisz numer projektu, a pokażę, co zostało na niego wydane.</div>';
    const wybrane = new Set(s.pozycje.map((p) => p.modelId + '|' + (p.sn || '')));
    const lista = C.wydaneNaProjekt(app.st, s.projekt).filter((w) => !wybrane.has(w.modelId + '|' + (w.sn || '')));
    return '<h3 class="odstep-gora">Wydane na projekt ' + esc(s.projekt) + '</h3>' +
      (lista.length ? '<div class="tabela-owijka"><table class="tabela"><thead><tr><th>Model</th><th>Nr seryjny</th><th>Klient</th><th class="l">Wydano</th><th></th></tr></thead><tbody>' +
        lista.map((w) => '<tr><td>' + esc(nazwaModelu(w.modelId)) + '</td><td class="mono">' + esc(w.sn) + '</td><td>' + esc(w.klient) + '</td><td class="l">' + fmtIl(w.modelId, w.ilosc) + '</td><td class="akcje-wiersza"><button class="przycisk maly" data-a="dodajZwrot" data-m="' + esc(w.modelId) + '" data-sn="' + esc(w.sn) + '" data-il="' + w.ilosc + '">Dodaj</button></td></tr>').join('') +
        '</tbody></table></div>' : '<div class="pusto">Nic nie zostało wydane na ten projekt (albo już wróciło)</div>');
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
    if (rodzaj === 'PZ') Object.assign(dane, { dostawca: C.norm(s.dostawca), nrFaktury: C.norm(s.nrFaktury), projekt: s.podProjekt ? C.norm(s.projekt) : '' });
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
    const projekty = new Set([dane.projekt].concat(pozycje.map((x) => x.projekt)).filter(Boolean));
    for (const pr of projekty) if (C.czyNowaWartosc(p.projekty, pr)) nowe.push('projekt „' + pr + '”');
    if (dane.klientNazwa && C.czyNowaWartosc(p.klienci, dane.klientNazwa)) nowe.push('klient „' + dane.klientNazwa + '”');
    if (nowe.length && rodzaj !== 'BO' || nowe.length && rodzaj === 'BO' && nowe.some((n) => n.startsWith('projekt') || n.startsWith('klient'))) {
      const ok = await potwierdz('Nowe wartości', 'Te wartości pojawią się po raz pierwszy:<br><b>' + nowe.map(esc).join('<br>') + '</b><br><br>Sprawdź, czy nie ma literówki (np. „A3” i „A-3” to dwa różne miejsca).', 'Wszystko się zgadza');
      if (!ok) return;
    }
    if (rodzaj === 'WZZ') {
      const ok = await potwierdz('Wydanie zastępcze', '<span class="czerwony-tekst"><b>Ten dokument zawiera sprzęt kupiony pod inny projekt.</b></span><br>' + pozycje.filter((x) => C.czyZastepcze(x.projektZakupu, dane.projekt)).map((x) => esc(nazwaModelu(x.modelId) + (x.sn ? ' SN ' + x.sn : ' ' + x.ilosc + ' ' + jedn(x.modelId)) + ': kupione pod ' + x.projektZakupu)).join('<br>') + '<br><br>Wydajesz go na projekt <b>' + esc(dane.projekt) + '</b>. Sprzęt trafi na listę „Do uzupełnienia”.', 'Rozumiem, wydaję zastępczo', 'czerwony');
      if (!ok) return;
    }
    if (!(await pytajPin('Zapisujesz dokument ' + C.RODZAJE[rodzaj].nazwa + ' (' + pozycje.length + ' poz.).'))) return;
    try {
      const ev = await zapiszDokument(dane);
      app.szkic = null;
      app.widok = 'dokumenty';
      render();
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
      d.projekt ? [d.rodzaj === 'PZ' || d.rodzaj === 'BO' ? 'Pod projekt' : 'Projekt', d.projekt] : null,
      d.klientNazwa ? ['Klient', d.klientNazwa + (d.klientNip ? ' · NIP ' + d.klientNip : '')] : null,
      d.adres ? ['Adres obiektu', d.adres] : null, d.dostawca ? ['Dostawca', d.dostawca] : null, d.nrFaktury ? ['Faktura / WZ dostawcy', d.nrFaktury] : null,
      d.osoba ? [d.rodzaj === 'WZ' || d.rodzaj === 'WZZ' ? 'Pobierający' : d.rodzaj === 'ZW' ? 'Zwracający' : 'Osoba', d.osoba] : null, d.uwagi ? ['Uwagi', d.uwagi] : null,
    ].filter(Boolean);
    const tresc =
      (wpis.anulowany ? '<div class="alert blad"><b>Dokument anulowany</b> ' + fmtCzas(wpis.anulowanie.ts) + ' przez ' + esc(osoba(wpis.anulowanie.autor)) + '. Powód: ' + esc(wpis.anulowanie.dane.powod) + '</div>' : '') +
      (d.rodzaj === 'WZZ' ? '<div class="alert wzz-alert"><b>WYDANIE ZASTĘPCZE</b> – powód: ' + esc(d.powod) + '</div>' : '') +
      '<dl class="opis">' + naglowekInfo.map(([a, b]) => '<dt>' + a + '</dt><dd>' + esc(b) + '</dd>').join('') + '</dl>' +
      '<div class="tabela-owijka"><table class="tabela"><thead><tr><th>Lp.</th><th>Model</th><th>Nr seryjny</th><th class="l">Ilość</th><th>Lokalizacja</th><th>' + (d.rodzaj === 'WZ' || d.rodzaj === 'WZZ' ? 'Kupione pod' : 'Projekt / stan') + '</th></tr></thead><tbody>' +
      (d.pozycje || []).map((p, i) => '<tr class="' + (C.czyZastepcze(p.projektZakupu, d.projekt) ? 'wzz' : '') + '"><td>' + (i + 1) + '</td><td>' + esc(nazwaModelu(p.modelId)) + '</td><td class="mono">' + esc(p.sn || '') + '</td><td class="l">' + fmtIl(p.modelId, p.ilosc || 1) + '</td><td>' + esc(p.lok || '') + '</td><td>' + esc(p.projektZakupu || p.projekt || p.stanTech || '') + '</td></tr>').join('') +
      '</tbody></table></div>' +
      '<h3>Podpisany formularz</h3>' + (wpis.skany.length ? '<ul>' + wpis.skany.map((s) => '<li><a href="#" data-otworz="' + esc(s.plik) + '">' + esc(s.plik.split('/').pop()) + '</a> <span class="szary maly">' + fmtCzas(s.ts) + ' · ' + esc(osoba(s.autor)) + '</span></li>').join('') + '</ul>' : '<p class="szary">Nie dołączono jeszcze skanu podpisanego formularza.</p>') +
      '<input type="file" accept="image/*,application/pdf" class="ukryty" id="plik-skanu">';
    const przyciski = [{ wartosc: 'zamknij', etykieta: 'Zamknij' }];
    if (!wpis.anulowany) przyciski.unshift({ wartosc: 'anuluj-dok', etykieta: 'Anuluj dokument', klasa: 'czerwony-tekst' });
    if (!wpis.anulowany) przyciski.push({ wartosc: 'skan', etykieta: 'Dołącz skan podpisu' });
    przyciski.push({ wartosc: 'drukuj', etykieta: ikona('druk') + 'Drukuj', klasa: 'glowny' });
    const w = await dialog({
      tytul: esc(d.numer) + ' · ' + esc(C.RODZAJE[d.rodzaj].nazwa), tresc, przyciski, szeroki: true,
      przyOtwarciu: (f) => {
        f.addEventListener('click', async (e) => {
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
      r === 'PZ' ? ['Dostawca', d.dostawca] : null, r === 'PZ' && d.nrFaktury ? ['Faktura / WZ dostawcy', d.nrFaktury] : null,
      d.projekt ? [r === 'PZ' || r === 'BO' ? 'Kupione pod projekt' : r === 'ZW' ? 'Zwrot z projektu' : 'Projekt', d.projekt] : null,
      d.klientNazwa ? ['Klient', d.klientNazwa + (d.klientNip ? ', NIP ' + d.klientNip : '') + (d.klientAdres ? ', ' + d.klientAdres : '')] : null,
      d.adres ? ['Adres obiektu', d.adres] : null,
      ['Wystawił', osoba(ev.autor) + ' (potwierdzone PIN-em, ' + fmtCzas(ev.ts) + ')'],
      d.osoba ? [r === 'WZ' || r === 'WZZ' ? 'Pobierający' : r === 'ZW' ? 'Zwracający' : 'Spisujący', d.osoba] : null,
    ].filter(Boolean);
    const zastPoz = (d.pozycje || []).filter((p) => C.czyZastepcze(p.projektZakupu, d.projekt));
    const kupionePod = Array.from(new Set(zastPoz.map((p) => p.projektZakupu))).join(', ');
    const html = '<div class="arkusz' + (wpis.anulowany ? ' anulowany' : '') + '">' +
      (wpis.anulowany ? '<div class="znak-wodny">ANULOWANY</div>' : '') +
      '<header class="d-naglowek">' + (LOGO ? '<img src="' + LOGO + '" alt="maasck" class="d-logo">' : '') +
        '<div class="d-firma"><b>' + esc(FIRMA.nazwa) + '</b><br>' + esc(FIRMA.adres) + '<br>NIP ' + FIRMA.nip + ' · REGON ' + FIRMA.regon + ' · KRS ' + FIRMA.krs + '</div></header>' +
      '<div class="d-tytul"><div><div class="d-rodzaj">' + esc(C.RODZAJE[r].nazwa) + '</div><div class="d-numer">' + esc(d.numer) + '</div></div>' + (qr ? '<div class="d-qr">' + qr + '</div>' : '') + '</div>' +
      (r === 'WZZ' ? '<div class="d-wzz"><b>WYDANIE ZASTĘPCZE: kupione pod ' + esc(kupionePod) + ', wydane na ' + esc(d.projekt) + '</b><br>Powód: ' + esc(d.powod) + '</div>' : '') +
      '<table class="d-meta">' + meta.map(([a, b]) => '<tr><th>' + a + '</th><td>' + esc(b) + '</td></tr>').join('') + '</table>' +
      '<table class="d-pozycje"><thead><tr><th>Lp.</th><th>Producent i model</th><th>Kod producenta</th><th>Nr seryjny</th><th class="l">Ilość</th><th>Lokalizacja</th><th>' + (r === 'WZ' || r === 'WZZ' ? 'Kupione pod' : 'Stan / projekt') + '</th></tr></thead><tbody>' +
      (d.pozycje || []).map((p, i) => {
        const m = model(p.modelId);
        return '<tr class="' + (C.czyZastepcze(p.projektZakupu, d.projekt) ? 'd-zast' : '') + '"><td>' + (i + 1) + '</td><td>' + esc(nazwaModelu(p.modelId)) + '</td><td>' + esc(m.pn || '') + '</td><td>' + esc(p.sn || '') + '</td><td class="l">' + fmtL(p.ilosc || 1) + ' ' + esc(m.jednostka || 'szt') + '</td><td>' + esc(p.lok || '') + '</td><td>' + esc(p.projektZakupu || p.projekt || p.stanTech || '') + '</td></tr>';
      }).join('') + '</tbody></table>' +
      (d.uwagi ? '<p class="d-uwagi"><b>Uwagi:</b> ' + esc(d.uwagi) + '</p>' : '') +
      '<div class="d-podpisy">' + podpisy.map((p) => '<div><div class="d-linia"></div>' + p + '<br><small>data i czytelny podpis</small></div>').join('') + '</div>' +
      '<footer class="d-stopka">Dokument wygenerowany w aplikacji Magazyn · ' + esc(d.numer) + ' · id ' + esc(ev.id) + ' · suma kontrolna ' + esc((ev.hash || '').slice(0, 12)) + '</footer>' +
      '</div>';
    $('#druk').innerHTML = html;
    setTimeout(() => window.print(), 60);
  }

  // ------------------------------------------------------------ edycja kartotek

  async function edytujModel(id, poz) {
    const m = id ? app.st.modele.get(id) : { kategoria: '', producent: '', model: '', pn: '', ean: '', seryjny: true, jednostka: 'szt', jednostkaZakupu: '', przelicznik: '', stanMin: '', status: 'aktywny', link: '' };
    const uzyty = id && Array.from(app.st.dokumenty.values()).some((w) => (w.ev.dane.pozycje || []).some((p) => p.modelId === id));
    const p = C.podpowiedzi(app.st);
    const wynik = await dialog({
      tytul: id ? 'Edycja modelu' : 'Nowy model',
      szeroki: true,
      tresc: '<datalist id="dl-prod2">' + p.producenci.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist><div class="siatka">' +
        pole('Kategoria *', '<select name="kategoria">' + C.KATEGORIE.map((k) => '<option ' + (k === m.kategoria ? 'selected' : '') + '>' + esc(k) + '</option>').join('') + '</select>') +
        pole('Producent', '<input name="producent" list="dl-prod2" value="' + esc(m.producent) + '">') +
        pole('Model / nazwa *', '<input name="model" value="' + esc(m.model) + '">', 'szerokie') +
        pole('Kod producenta (P/N)', '<input name="pn" value="' + esc(m.pn) + '">') +
        pole('EAN', '<input name="ean" value="' + esc(m.ean) + '">') +
        '<div class="pole szerokie"><span>Sposób ewidencji</span><label class="przelacznik"><input type="checkbox" name="seryjny" ' + (m.seryjny ? 'checked' : '') + (uzyty ? ' disabled' : '') + '> śledź po numerze seryjnym (urządzenia z gwarancją, które trafiają do klienta)</label>' + (uzyty ? '<small class="szary">Model jest już w dokumentach – sposobu ewidencji nie można zmienić.</small>' : '') + '</div>' +
        pole('Jednostka', '<select name="jednostka"><option value="szt" ' + (m.jednostka === 'szt' ? 'selected' : '') + '>szt</option><option value="m" ' + (m.jednostka === 'm' ? 'selected' : '') + '>m (metry)</option></select>') +
        pole('Jednostka zakupu (opcjonalnie)', '<input name="jednostkaZakupu" value="' + esc(m.jednostkaZakupu || '') + '" placeholder="np. szpula, karton">') +
        pole('Ile jednostek w jednostce zakupu', '<input name="przelicznik" value="' + esc(m.przelicznik || '') + '" inputmode="decimal" placeholder="np. 305">') +
        pole('Stan minimalny', '<input name="stanMin" value="' + esc(m.stanMin || '') + '" inputmode="decimal">') +
        pole('Status', '<select name="status">' + ['aktywny', 'EOL', 'wycofany'].map((s) => '<option ' + (m.status === s ? 'selected' : '') + '>' + s + '</option>').join('') + '</select>') +
        pole('Link do karty katalogowej', '<input name="link" value="' + esc(m.link || '') + '" placeholder="https://…">', 'szerokie') +
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
            if (['Okablowanie', 'Korytka i osłony kabli'].includes(kat.value)) jd.value = 'm';
            else jd.value = 'szt';
          };
          kat.addEventListener('change', ustaw);
        }
        ser.addEventListener('change', () => { if (ser.checked) jd.value = 'szt'; });
      },
      przyWyslaniu: async (f) => {
        const dane = {
          modelId: id || 'm-' + C.noweId(8), kategoria: f.kategoria.value, producent: f.producent.value.trim(), model: f.model.value.trim(), pn: f.pn.value.trim(), ean: f.ean.value.trim(),
          seryjny: uzyty ? !!m.seryjny : f.seryjny.checked, jednostka: (uzyty ? !!m.seryjny : f.seryjny.checked) ? 'szt' : f.jednostka.value,
          jednostkaZakupu: f.jednostkaZakupu.value.trim(), przelicznik: Number(f.przelicznik.value.replace(',', '.')) || '', stanMin: Number(f.stanMin.value.replace(',', '.')) || '', status: f.status.value, link: f.link.value.trim(),
        };
        if (!dane.model) throw new Error('Podaj nazwę modelu');
        if (dane.jednostkaZakupu && !(dane.przelicznik > 0)) throw new Error('Podaj, ile jednostek jest w jednostce zakupu (np. 305 m w szpuli)');
        const dubel = Array.from(app.st.modele.values()).find((x) => x.modelId !== dane.modelId && C.normKlucz(x.producent + ' ' + x.model) === C.normKlucz(dane.producent + ' ' + dane.model));
        if (dubel) throw new Error('Taki model już jest w kartotece');
        await utworzZdarzenie('MODEL', dane);
        return dane.modelId;
      },
    });
    if (!wynik) return;
    toast('Zapisano model', 'ok');
    if (poz !== undefined && app.szkic) {
      const mm = app.st.modele.get(wynik);
      if (poz === 'nowa') app.szkic.pozycje.push({ modelLabel: etykietaModelu(mm), modelId: wynik, lok: '', snTekst: '', ilosc: '', jedn: 'baza', stanTech: 'nowy', projekt: '' });
      else {
        const p2 = app.szkic.pozycje[Number(poz)];
        if (p2) { p2.modelId = wynik; p2.modelLabel = etykietaModelu(mm); }
      }
    }
    render();
  }

  async function edytujKlienta(id) {
    const k = id ? app.st.klienci.get(id) : { nazwa: '', nip: '', adres: '', kontakt: '', tel: '', email: '' };
    const w = await dialog({
      tytul: id ? 'Edycja klienta' : 'Nowy klient', szeroki: true,
      tresc: '<div class="siatka">' + pole('Nazwa firmy *', '<input name="nazwa" value="' + esc(k.nazwa) + '">', 'szerokie') + pole('NIP', '<input name="nip" value="' + esc(k.nip) + '">') + pole('Adres', '<input name="adres" value="' + esc(k.adres) + '">', 'szerokie') + pole('Osoba kontaktowa', '<input name="kontakt" value="' + esc(k.kontakt) + '">') + pole('Telefon', '<input name="tel" value="' + esc(k.tel) + '">') + pole('E-mail', '<input name="email" value="' + esc(k.email) + '">') + '</div>',
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: 'Zapisz', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        const dane = { klientId: id || 'k-' + C.noweId(8), nazwa: f.nazwa.value.trim(), nip: f.nip.value.trim(), adres: f.adres.value.trim(), kontakt: f.kontakt.value.trim(), tel: f.tel.value.trim(), email: f.email.value.trim() };
        if (!dane.nazwa) throw new Error('Podaj nazwę firmy');
        await utworzZdarzenie('KLIENT', dane);
        return 'ok';
      },
    });
    if (w) { toast('Zapisano klienta', 'ok'); render(); }
  }

  async function edytujUzytkownika(id) {
    const nowy = !id;
    const u = id ? app.st.uzytkownicy.get(id) : { imie: '', nazwisko: '', email: '', tel: '', aktywny: true };
    const w = await dialog({
      tytul: nowy ? 'Nowy użytkownik' : 'Edycja użytkownika', szeroki: true,
      tresc: '<div class="siatka">' + pole('Imię *', '<input name="imie" value="' + esc(u.imie) + '">') + pole('Nazwisko *', '<input name="nazwisko" value="' + esc(u.nazwisko) + '">') + pole('E-mail', '<input name="email" value="' + esc(u.email) + '">') + pole('Telefon', '<input name="tel" value="' + esc(u.tel) + '">') +
        (nowy ? pole('PIN (4–8 cyfr) *', '<input name="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password">') + pole('Powtórz PIN *', '<input name="pin2" type="password" inputmode="numeric" maxlength="8" autocomplete="new-password">') : '<div class="pole"><span>Status</span><label class="przelacznik"><input type="checkbox" name="aktywny" ' + (u.aktywny !== false ? 'checked' : '') + '> aktywny</label></div>') + '</div>',
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: 'Zapisz', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        const dane = { userId: id || C.noweId(8), imie: f.imie.value.trim(), nazwisko: f.nazwisko.value.trim(), email: f.email.value.trim(), tel: f.tel.value.trim() };
        if (!dane.imie || !dane.nazwisko) throw new Error('Podaj imię i nazwisko');
        if (nowy) {
          const pin = f.pin.value.trim();
          if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN musi mieć od 4 do 8 cyfr');
          if (pin !== f.pin2.value.trim()) throw new Error('PIN-y się różnią');
          dane.pinSalt = C.noweId(12);
          dane.pinHash = await C.hashPin(dane.pinSalt, pin);
          dane.aktywny = true;
        } else dane.aktywny = f.aktywny.checked;
        const autor = app.user ? app.user.userId : dane.userId;
        const ev = C.noweZdarzenie(app.st, 'UZYTK', autor, dane);
        await zapiszZdarzenie(ev);
        return dane.userId;
      },
    });
    if (!w) return;
    toast('Zapisano użytkownika', 'ok');
    if (!app.user) app.user = app.st.uzytkownicy.get(w);
    render();
  }

  async function zmienPin() {
    const u = app.st.uzytkownicy.get(app.user.userId);
    const w = await dialog({
      tytul: 'Zmiana PIN-u',
      tresc: pole('Obecny PIN', '<input name="stary" type="password" inputmode="numeric" maxlength="8">') + pole('Nowy PIN (4–8 cyfr)', '<input name="pin" type="password" inputmode="numeric" maxlength="8">') + pole('Powtórz nowy PIN', '<input name="pin2" type="password" inputmode="numeric" maxlength="8">'),
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: 'Zmień PIN', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        if ((await C.hashPin(u.pinSalt, f.stary.value.trim())) !== u.pinHash) throw new Error('Obecny PIN jest nieprawidłowy');
        const pin = f.pin.value.trim();
        if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN musi mieć od 4 do 8 cyfr');
        if (pin !== f.pin2.value.trim()) throw new Error('PIN-y się różnią');
        const salt = C.noweId(12);
        await utworzZdarzenie('UZYTK', { userId: u.userId, pinSalt: salt, pinHash: await C.hashPin(salt, pin) });
        return 'ok';
      },
    });
    if (w) toast('Zmieniono PIN', 'ok');
  }

  async function przenies(el) {
    const { m, sn, lok, p, il } = el.dataset;
    const w = await dialog({
      tytul: 'Przenieś: ' + esc(nazwaModelu(m)),
      tresc: datalisty() + '<p>Z: <b>' + esc(lok) + '</b>' + (sn ? ' · SN <span class="mono">' + esc(sn) + '</span>' : '') + (p ? ' · pod projekt ' + esc(p) : '') + '</p>' +
        pole('Nowa lokalizacja *', '<input name="do" list="dl-lok">') + (sn ? '' : pole('Ilość (max ' + fmtL(il) + ' ' + esc(jedn(m)) + ')', '<input name="ilosc" value="' + esc(il) + '" inputmode="decimal">')),
      przyciski: [{ wartosc: 'anuluj', etykieta: 'Anuluj' }, { wartosc: 'ok', etykieta: 'Przenieś', klasa: 'glowny', submit: true }],
      przyWyslaniu: async (f) => {
        const doL = f.do.value.trim();
        if (!doL) throw new Error('Podaj nową lokalizację');
        if (C.normKlucz(doL) === C.normKlucz(lok)) throw new Error('To ta sama lokalizacja');
        const ilosc = sn ? 1 : Number(f.ilosc.value.replace(',', '.'));
        if (!(ilosc > 0) || ilosc > Number(il) + 1e-9) throw new Error('Nieprawidłowa ilość');
        if (C.czyNowaWartosc(C.podpowiedzi(app.st).lokalizacje, doL) && !confirm('Lokalizacja „' + doL + '” pojawi się po raz pierwszy. Zgadza się?')) return false;
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
      tresc: '<dl class="opis"><dt>Kategoria</dt><dd>' + esc(m.kategoria || '') + '</dd><dt>Kod producenta</dt><dd>' + esc(m.pn || '') + '</dd><dt>W magazynie</dt><dd><b>' + fmtIl(id, w.razem) + '</b> (wolne ' + fmtIl(id, w.wolne) + ', pod projekty ' + fmtIl(id, w.podProjekt) + ')</dd><dt>U klientów</dt><dd>' + fmtIl(id, w.wydane) + '</dd>' + (m.link ? '<dt>Karta katalogowa</dt><dd><a href="' + esc(m.link) + '" target="_blank" rel="noopener">otwórz</a></dd>' : '') + '</dl>' +
        '<h3>W magazynie</h3>' + (miejsca.length ? '<div class="tabela-owijka"><table class="tabela"><thead><tr><th>Lokalizacja</th><th>Nr seryjny</th><th class="l">Ilość</th><th>Pod projekt</th></tr></thead><tbody>' + miejsca.map((x) => '<tr><td>' + esc(x.lok) + '</td><td class="mono">' + esc(x.sn) + '</td><td class="l">' + fmtIl(id, x.ilosc) + '</td><td>' + esc(x.projekt || '') + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="szary">Brak</p>') +
        '<h3>U klientów</h3>' + (wydane.length ? '<div class="tabela-owijka"><table class="tabela"><thead><tr><th>Projekt</th><th>Klient</th><th>Nr seryjny</th><th class="l">Ilość</th></tr></thead><tbody>' + wydane.map((x) => '<tr><td>' + esc(x.projekt) + '</td><td>' + esc(x.klient) + '</td><td class="mono">' + esc(x.sn) + '</td><td class="l">' + fmtIl(id, x.ilosc) + '</td></tr>').join('') + '</tbody></table></div>' : '<p class="szary">Brak</p>'),
      przyciski: [{ wartosc: 'ok', etykieta: 'Zamknij', klasa: 'glowny' }],
    });
  }

  // ------------------------------------------------------------ render

  function render() {
    const root = $('#app');
    let html;
    if (!app.store) html = ekranStartowy();
    else if (!app.user) html = ekranUzytkownika();
    else html = uklad((WIDOKI[app.widok] || WIDOKI.pulpit)());
    const przewiniecie = $('.zawartosc') ? $('.zawartosc').scrollTop : 0;
    const aktywny = document.activeElement;
    const klucz = aktywny && (aktywny.dataset.filtr || aktywny.dataset.f || aktywny.dataset.p);
    const kursor = aktywny && typeof aktywny.selectionStart === 'number' ? aktywny.selectionStart : null;
    root.innerHTML = html;
    if ($('.zawartosc')) $('.zawartosc').scrollTop = przewiniecie;
    if (klucz) {
      const el = $('[data-filtr="' + klucz + '"], [data-f="' + klucz + '"], [data-p="' + klucz + '"]');
      if (el) {
        el.focus();
        if (kursor !== null && typeof el.setSelectionRange === 'function') try { el.setSelectionRange(kursor, kursor); } catch (e) { /* */ }
      }
    }
  }

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
    async wybierzOsobe(el) {
      app.user = app.st.uzytkownicy.get(el.dataset.id);
      try { localStorage.setItem('magazyn-ostatni-uzytkownik', app.user.userId); } catch (e) { /* */ }
      app.widok = 'pulpit';
      render();
      try { await kopiaTygodniowa(false); } catch (e) { toast('Nie udało się zapisać kopii tygodniowej: ' + e.message, 'blad'); }
    },
    zmienOsobe() {
      if (app.szkic && !confirm('Porzucić niezapisany dokument?')) return;
      app.szkic = null;
      app.user = null;
      render();
    },
    nowyUzytkownik() { edytujUzytkownika(null); },
    edytujUzytkownika(el) { edytujUzytkownika(el.dataset.id); },
    zmienPin() { zmienPin(); },
    idz(el) {
      if (app.szkic && app.widok === 'dokument' && !confirm('Porzucić niezapisany dokument?')) return;
      if (app.widok === 'dokument') app.szkic = null;
      app.widok = el.dataset.w;
      render();
      if ($('.zawartosc')) $('.zawartosc').scrollTop = 0;
    },
    async odswiez() {
      await wczytaj();
      render();
      toast('Wczytano aktualne dane', 'ok');
    },
    nowyDok(el) {
      if (app.szkic && app.widok === 'dokument' && !confirm('Porzucić bieżący dokument?')) return;
      app.szkic = nowySzkic(el.dataset.r);
      if (el.dataset.r === 'PZ' || el.dataset.r === 'BO') app.szkic.pozycje.push({ modelLabel: '', modelId: '', lok: '', snTekst: '', ilosc: '', jedn: 'baza', stanTech: 'nowy', projekt: '' });
      app.filtr.wybor = '';
      app.widok = 'dokument';
      render();
      if ($('.zawartosc')) $('.zawartosc').scrollTop = 0;
    },
    anulujSzkic() {
      if (!confirm('Porzucić ten dokument?')) return;
      app.szkic = null;
      app.widok = 'pulpit';
      render();
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
    pokazModel(el) { pokazModel(el.dataset.id); },
    historia(el) {
      const e = app.st.egzemplarze.get(C.kluczEgz(el.dataset.m, el.dataset.sn));
      if (e) dialog({ tytul: 'Historia urządzenia', tresc: historiaHtml(e), szeroki: true, przyciski: [{ wartosc: 'ok', etykieta: 'Zamknij', klasa: 'glowny' }] });
    },
    edytujModel(el) { edytujModel(el.dataset.id || null, el.dataset.poz); },
    edytujKlienta(el) { edytujKlienta(el.dataset.id || null); },
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
      if (wybor && el.dataset.przerysuj && natychmiast) render();
      else if (!wybor && el.dataset.przerysujPo && !natychmiast) {
        clearTimeout(opoznienie);
        opoznienie = setTimeout(render, 400);
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

  window.addEventListener('beforeunload', (e) => {
    if (app.szkic && app.widok === 'dokument') {
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

  window.MagazynApp = { app, render, AKCJE };
  start();
})();
