/*
 * Magazyn AV – logika magazynu (bez interfejsu).
 *
 * Zasada: wszystko, co się wydarzyło, jest zapisane jako niezmienne zdarzenie
 * (osobny plik JSON). Stan magazynu, kartoteki i raporty są zawsze wyliczane
 * od nowa z listy zdarzeń. Nic nie jest nadpisywane ani kasowane.
 *
 * Działa w przeglądarce (window.MagazynCore) i w Node (require).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MagazynCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const WERSJA = 1;

  const RODZAJE = {
    BO: { nazwa: 'Bilans otwarcia', kierunek: 'przyjecie' },
    PZ: { nazwa: 'Przyjęcie zewnętrzne', kierunek: 'przyjecie' },
    WZ: { nazwa: 'Wydanie na projekt', kierunek: 'wydanie' },
    WZZ: { nazwa: 'Wydanie zastępcze pod inny projekt', kierunek: 'wydanie' },
    ZW: { nazwa: 'Zwrot z projektu', kierunek: 'zwrot' },
  };

  const KATEGORIE = [
    'Wyświetlacze', 'Projekcja', 'Audio', 'Mikrofony', 'DSP i sterowanie',
    'Wideokonferencje', 'Sieć', 'Okablowanie', 'Korytka i osłony kabli',
    'Złącza i osprzęt', 'Uchwyty i montaż', 'Inne',
  ];

  const STANY_TECHNICZNE = ['nowy', 'używany', 'uszkodzony'];

  // ---------------------------------------------------------------- narzędzia

  function canonical(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
    return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }

  async function sha256hex(text) {
    const data = new TextEncoder().encode(text);
    const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function trescDoPodpisu(ev) {
    const kopia = Object.assign({}, ev);
    delete kopia.hash;
    for (const k of Object.keys(kopia)) if (k.startsWith('_')) delete kopia[k];
    return canonical(kopia);
  }

  async function zapieczetuj(ev) {
    ev.hash = await sha256hex(trescDoPodpisu(ev));
    return ev;
  }

  async function sprawdzPieczec(ev) {
    return typeof ev.hash === 'string' && ev.hash === (await sha256hex(trescDoPodpisu(ev)));
  }

  function noweId(dl = 10) {
    const znaki = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const bajty = new Uint8Array(dl);
    globalThis.crypto.getRandomValues(bajty);
    let s = '';
    for (const b of bajty) s += znaki[b % znaki.length];
    return s;
  }

  function zaokr(x) {
    return Math.round((Number(x) || 0) * 1000) / 1000;
  }

  function norm(s) {
    return (s == null ? '' : String(s)).trim();
  }

  function normKlucz(s) {
    return norm(s).toLowerCase().replace(/\s+/g, ' ');
  }

  async function hashPin(salt, pin) {
    return sha256hex('magazyn-pin|' + salt + '|' + String(pin));
  }

  function formatNumer(rodzaj, rok, nr) {
    return rodzaj + '/' + rok + '/' + String(nr).padStart(4, '0');
  }

  function nazwaPlikuDokumentu(rodzaj, rok, nr) {
    return rodzaj + '-' + rok + '-' + String(nr).padStart(4, '0') + '.json';
  }

  function sciezkaZdarzenia(ev) {
    if (ev.typ === 'DOK') {
      const d = ev.dane;
      return 'dokumenty/' + d.rok + '/' + nazwaPlikuDokumentu(d.rodzaj, d.rok, d.nr);
    }
    const t = ev.ts.replace(/[-:.Z]/g, '').replace('T', 'T'); // 20261106T115800123
    return 'zdarzenia/' + ev.ts.slice(0, 7) + '/' + t + '_' + ev.typ + '_' + ev.id + '.json';
  }

  const WZOR_DOKUMENTU = /^(BO|PZ|WZ|WZZ|ZW)-\d{4}-\d{4}\.json$/;
  const WZOR_ZDARZENIA = /^\d{8}T\d{9}_[A-Z]+_[a-z0-9]+\.json$/;

  function czyPoprawnaNazwaPliku(sciezka) {
    const nazwa = sciezka.split('/').pop();
    if (sciezka.startsWith('dokumenty/')) return WZOR_DOKUMENTU.test(nazwa);
    if (sciezka.startsWith('zdarzenia/')) return WZOR_ZDARZENIA.test(nazwa);
    return false;
  }

  // ---------------------------------------------------------------- stan

  function pustyStan() {
    return {
      uzytkownicy: new Map(), // userId -> {...}
      modele: new Map(), // modelId -> {...}
      klienci: new Map(), // klientId -> {...}
      dokumenty: new Map(), // eventId -> {ev, anulowany, anulowanie, skany:[]}
      wgNumeru: new Map(), // numer -> [eventId]
      egzemplarze: new Map(), // modelId|sn -> {...}
      partie: new Map(), // modelId|lok|projekt -> ilość (materiały bez numeru)
      wydane: new Map(), // projekt|modelId -> ilość (materiały bez numeru)
      wydaneKlient: new Map(), // projekt|modelId -> klient (ostatni)
      uzupelnienia: [], // pozycje z WZZ do uzupełnienia
      zdarzenia: [], // posortowane zdarzenia
      problemy: [], // {kod, opis, evId}
      seqMax: new Map(), // autor -> max seq
      lokalizacje: new Set(),
      projekty: new Set(),
    };
  }

  function kluczEgz(modelId, sn) {
    return modelId + '|' + normKlucz(sn);
  }
  function kluczPartii(modelId, lok, projekt) {
    return modelId + '|' + norm(lok) + '|' + norm(projekt);
  }
  function kluczWydania(projekt, modelId) {
    return norm(projekt) + '|' + modelId;
  }

  function problem(st, kod, opis, evId) {
    st.problemy.push({ kod, opis, evId: evId || null });
  }

  function opisModelu(st, modelId) {
    const m = st.modele.get(modelId);
    return m ? (m.producent ? m.producent + ' ' : '') + m.model : 'nieznany model (' + modelId + ')';
  }

  function sortujZdarzenia(lista) {
    return lista.slice().sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }

  /**
   * Wylicza pełny stan z listy zdarzeń.
   * Każde zdarzenie może mieć pole _pieczecOk (false = plik zmieniony ręcznie)
   * oraz _plik (ścieżka), ustawiane przez warstwę odczytu.
   */
  function zbudujStan(listaZdarzen, opcje = {}) {
    const st = pustyStan();
    const widziane = new Map();
    const unikalne = [];
    for (const ev of listaZdarzen) {
      if (!ev || typeof ev !== 'object' || !ev.id || !ev.typ || !ev.ts) {
        problem(st, 'USZKODZONY', 'Nieczytelny plik zdarzenia' + (ev && ev._plik ? ': ' + ev._plik : ''));
        continue;
      }
      if (widziane.has(ev.id)) {
        const pierwszy = widziane.get(ev.id);
        if (pierwszy.hash !== ev.hash) problem(st, 'KONFLIKT', 'Dwie różne wersje tego samego zdarzenia (' + (ev._plik || ev.id) + ')', ev.id);
        continue; // kopia tego samego zdarzenia – pomijamy
      }
      widziane.set(ev.id, ev);
      unikalne.push(ev);
    }
    st.zdarzenia = sortujZdarzenia(unikalne);

    for (const ev of st.zdarzenia) {
      if (ev._pieczecOk === false) problem(st, 'ZMIENIONY', 'Plik zmieniony poza aplikacją: ' + (ev._plik || ev.id), ev.id);
      const s = Number(ev.seq) || 0;
      if (s > (st.seqMax.get(ev.autor) || 0)) st.seqMax.set(ev.autor, s);
    }

    // anulowania obowiązują niezależnie od kolejności
    const anulowane = new Map();
    for (const ev of st.zdarzenia) if (ev.typ === 'ANUL' && ev.dane && ev.dane.docId) anulowane.set(ev.dane.docId, ev);

    for (const ev of st.zdarzenia) {
      try {
        zastosuj(st, ev, anulowane);
      } catch (e) {
        problem(st, 'BLAD', 'Nie udało się przetworzyć zdarzenia ' + ev.id + ': ' + e.message, ev.id);
      }
    }

    if (!opcje.bezKontroli) kontrolaSpojnosci(st);
    return st;
  }

  function zastosuj(st, ev, anulowane) {
    const d = ev.dane || {};
    switch (ev.typ) {
      case 'UZYTK': {
        const stary = st.uzytkownicy.get(d.userId) || {};
        st.uzytkownicy.set(d.userId, Object.assign({}, stary, d, { utworzono: stary.utworzono || ev.ts }));
        break;
      }
      case 'MODEL': {
        const stary = st.modele.get(d.modelId) || {};
        st.modele.set(d.modelId, Object.assign({}, stary, d, { utworzono: stary.utworzono || ev.ts }));
        break;
      }
      case 'KLIENT': {
        const stary = st.klienci.get(d.klientId) || {};
        st.klienci.set(d.klientId, Object.assign({}, stary, d, { utworzono: stary.utworzono || ev.ts }));
        break;
      }
      case 'DOK': {
        const anul = anulowane.get(ev.id);
        const wpis = { ev, anulowany: !!anul, anulowanie: anul || null, skany: [] };
        st.dokumenty.set(ev.id, wpis);
        const lista = st.wgNumeru.get(d.numer) || [];
        lista.push(ev.id);
        st.wgNumeru.set(d.numer, lista);
        if (lista.length > 1) problem(st, 'DUPLIKAT', 'Numer ' + d.numer + ' występuje więcej niż raz (zapis w tej samej chwili na dwóch komputerach?)', ev.id);
        if (d.projekt) st.projekty.add(norm(d.projekt));
        if (anul) break;
        zastosujDokument(st, ev);
        break;
      }
      case 'ANUL': {
        if (!st.dokumenty.has(d.docId)) problem(st, 'ANUL', 'Anulowanie dotyczy nieznanego dokumentu ' + (d.numer || d.docId), ev.id);
        break;
      }
      case 'PRZENIES': {
        przenies(st, ev);
        break;
      }
      case 'SKAN': {
        const doc = st.dokumenty.get(d.docId);
        if (doc) doc.skany.push({ plik: d.plik, ts: ev.ts, autor: ev.autor });
        else problem(st, 'SKAN', 'Skan dotyczy nieznanego dokumentu ' + (d.numer || d.docId), ev.id);
        break;
      }
      case 'UZUP': {
        const poz = st.uzupelnienia.find((u) => u.docId === d.docId && u.idx === d.idx);
        if (poz) {
          poz.zamkniete = true;
          poz.zamknieto = { ts: ev.ts, autor: ev.autor, uwagi: d.uwagi || '' };
        } else if (!(st.dokumenty.get(d.docId) || {}).anulowany) problem(st, 'UZUP', 'Uzupełnienie dotyczy nieznanej pozycji', ev.id);
        break;
      }
      default:
        problem(st, 'TYP', 'Nieznany typ zdarzenia: ' + ev.typ, ev.id);
    }
  }

  function zastosujDokument(st, ev) {
    const d = ev.dane;
    const kier = (RODZAJE[d.rodzaj] || {}).kierunek;
    (d.pozycje || []).forEach((p, idx) => {
      const model = st.modele.get(p.modelId);
      if (!model) {
        problem(st, 'MODEL', d.numer + ': pozycja ' + (idx + 1) + ' wskazuje nieznany model', ev.id);
        return;
      }
      const seryjny = !!p.sn;
      if (p.lok) st.lokalizacje.add(norm(p.lok));
      if (p.projekt) st.projekty.add(norm(p.projekt));
      const hist = { numer: d.numer, docId: ev.id, ts: ev.ts, rodzaj: d.rodzaj };

      if (kier === 'przyjecie') {
        if (seryjny) {
          const k = kluczEgz(p.modelId, p.sn);
          const e = st.egzemplarze.get(k);
          if (e && e.status === 'magazyn') {
            problem(st, 'SN', d.numer + ': ' + opisModelu(st, p.modelId) + ' SN ' + p.sn + ' jest już na stanie', ev.id);
            return;
          }
          st.egzemplarze.set(k, {
            modelId: p.modelId, sn: norm(p.sn), status: 'magazyn', lok: norm(p.lok),
            projektZakupu: norm(p.projekt), stanTech: p.stanTech || 'nowy', klient: '', projekt: '',
            przyjeto: { numer: d.numer, ts: ev.ts },
            gwarancjaDo: p.gwarancjaDo || (e && e.gwarancjaDo) || '',
            historia: (e ? e.historia : []).concat([Object.assign(hist, { opis: 'Przyjęto na ' + norm(p.lok) + (p.projekt ? ' (pod projekt ' + norm(p.projekt) + ')' : '') })]),
          });
        } else {
          const k = kluczPartii(p.modelId, p.lok, p.projekt);
          st.partie.set(k, zaokr((st.partie.get(k) || 0) + zaokr(p.ilosc)));
        }
      } else if (kier === 'wydanie') {
        if (seryjny) {
          const k = kluczEgz(p.modelId, p.sn);
          const e = st.egzemplarze.get(k);
          if (!e || e.status !== 'magazyn') {
            problem(st, 'SN', d.numer + ': ' + opisModelu(st, p.modelId) + ' SN ' + p.sn + ' nie jest na stanie', ev.id);
            return;
          }
          e.status = 'wydany';
          e.historia.push(Object.assign(hist, { opis: 'Wydano z ' + e.lok + ' na projekt ' + norm(d.projekt) + (d.klientNazwa ? ' (' + d.klientNazwa + ')' : '') }));
          const zrodloProj = e.projektZakupu;
          e.lok = '';
          e.klient = d.klientNazwa || '';
          e.projekt = norm(d.projekt);
          e.wydanie = { numer: d.numer, ts: ev.ts };
          if (d.rodzaj === 'WZZ' && zrodloProj && normKlucz(zrodloProj) !== normKlucz(d.projekt)) {
            st.uzupelnienia.push({ docId: ev.id, numer: d.numer, idx, modelId: p.modelId, sn: e.sn, ilosc: 1, projektZakupu: zrodloProj, projektDocelowy: norm(d.projekt), powod: d.powod || '', ts: ev.ts, zamkniete: false });
          }
        } else {
          const k = kluczPartii(p.modelId, p.lok, p.projektZakupu);
          const jest = st.partie.get(k) || 0;
          const ile = zaokr(p.ilosc);
          if (jest + 1e-9 < ile) {
            problem(st, 'ILOSC', d.numer + ': ' + opisModelu(st, p.modelId) + ' – brak ' + ile + ' w lokalizacji ' + norm(p.lok) + (p.projektZakupu ? ' (pod projekt ' + p.projektZakupu + ')' : '') + ', jest ' + jest, ev.id);
          }
          st.partie.set(k, zaokr(jest - ile));
          const kw = kluczWydania(d.projekt, p.modelId);
          st.wydane.set(kw, zaokr((st.wydane.get(kw) || 0) + ile));
          st.wydaneKlient.set(kw, d.klientNazwa || '');
          if (d.rodzaj === 'WZZ' && p.projektZakupu && normKlucz(p.projektZakupu) !== normKlucz(d.projekt)) {
            st.uzupelnienia.push({ docId: ev.id, numer: d.numer, idx, modelId: p.modelId, sn: '', ilosc: ile, projektZakupu: norm(p.projektZakupu), projektDocelowy: norm(d.projekt), powod: d.powod || '', ts: ev.ts, zamkniete: false });
          }
        }
      } else if (kier === 'zwrot') {
        if (seryjny) {
          const k = kluczEgz(p.modelId, p.sn);
          const e = st.egzemplarze.get(k);
          if (!e || e.status !== 'wydany') {
            problem(st, 'SN', d.numer + ': ' + opisModelu(st, p.modelId) + ' SN ' + p.sn + ' nie był wydany', ev.id);
            return;
          }
          if (normKlucz(e.projekt) !== normKlucz(d.projekt)) {
            problem(st, 'ZW', d.numer + ': SN ' + p.sn + ' był wydany na projekt ' + e.projekt + ', a nie ' + norm(d.projekt), ev.id);
          }
          e.status = 'magazyn';
          e.lok = norm(p.lok);
          e.stanTech = p.stanTech || e.stanTech;
          e.historia.push(Object.assign(hist, { opis: 'Zwrot z projektu ' + e.projekt + ' na ' + norm(p.lok) + ' (' + e.stanTech + ')' }));
          e.klient = '';
          e.projekt = '';
          e.projektZakupu = '';
          e.wydanie = null;
        } else {
          const kw = kluczWydania(d.projekt, p.modelId);
          const wyd = st.wydane.get(kw) || 0;
          const ile = zaokr(p.ilosc);
          if (wyd + 1e-9 < ile) problem(st, 'ILOSC', d.numer + ': zwrot ' + ile + ' ' + opisModelu(st, p.modelId) + ' większy niż wydano na projekt ' + d.projekt + ' (' + wyd + ')', ev.id);
          st.wydane.set(kw, zaokr(wyd - ile));
          const k = kluczPartii(p.modelId, p.lok, '');
          st.partie.set(k, zaokr((st.partie.get(k) || 0) + ile));
        }
      }
    });
  }

  function przenies(st, ev) {
    const d = ev.dane;
    if (d.do) st.lokalizacje.add(norm(d.do));
    if (d.sn) {
      const e = st.egzemplarze.get(kluczEgz(d.modelId, d.sn));
      if (!e || e.status !== 'magazyn') {
        problem(st, 'SN', 'Przeniesienie: ' + opisModelu(st, d.modelId) + ' SN ' + d.sn + ' nie jest na stanie', ev.id);
        return;
      }
      e.historia.push({ ts: ev.ts, rodzaj: 'PRZENIES', opis: 'Przeniesiono z ' + e.lok + ' na ' + norm(d.do) });
      e.lok = norm(d.do);
    } else {
      const kz = kluczPartii(d.modelId, d.z, d.projekt);
      const jest = st.partie.get(kz) || 0;
      const ile = zaokr(d.ilosc);
      if (jest + 1e-9 < ile) problem(st, 'ILOSC', 'Przeniesienie: brak ' + ile + ' ' + opisModelu(st, d.modelId) + ' w ' + d.z + ', jest ' + jest, ev.id);
      st.partie.set(kz, zaokr(jest - ile));
      const kd = kluczPartii(d.modelId, d.do, d.projekt);
      st.partie.set(kd, zaokr((st.partie.get(kd) || 0) + ile));
    }
  }

  function kontrolaSpojnosci(st) {
    // luki w numeracji dokumentów
    const maks = new Map();
    const sa = new Set();
    for (const { ev } of st.dokumenty.values()) {
      const k = ev.dane.rodzaj + '/' + ev.dane.rok;
      maks.set(k, Math.max(maks.get(k) || 0, ev.dane.nr));
      sa.add(k + '/' + ev.dane.nr);
    }
    for (const [k, m] of maks) {
      for (let i = 1; i < m; i++) {
        if (!sa.has(k + '/' + i)) {
          const [rodzaj, rok] = k.split('/');
          problem(st, 'LUKA', 'Brakuje dokumentu ' + formatNumer(rodzaj, rok, i) + ' (plik usunięty lub jeszcze się synchronizuje)');
        }
      }
    }
    // luki w numeracji zdarzeń użytkownika
    const wgAutora = new Map();
    for (const ev of st.zdarzenia) {
      if (!wgAutora.has(ev.autor)) wgAutora.set(ev.autor, new Set());
      wgAutora.get(ev.autor).add(Number(ev.seq) || 0);
    }
    for (const [autor, zbior] of wgAutora) {
      const m = Math.max(...zbior);
      const brak = [];
      for (let i = 1; i <= m; i++) if (!zbior.has(i)) brak.push(i);
      if (brak.length) {
        const u = st.uzytkownicy.get(autor);
        problem(st, 'LUKA', 'Brakuje ' + brak.length + ' zdarzeń użytkownika ' + (u ? u.imie + ' ' + u.nazwisko : autor) + ' (nr ' + brak.slice(0, 5).join(', ') + (brak.length > 5 ? '…' : '') + ')');
      }
    }
  }

  // ---------------------------------------------------------------- tworzenie zdarzeń

  function noweZdarzenie(st, typ, autor, dane, teraz) {
    const ts = (teraz || new Date()).toISOString();
    return { v: WERSJA, id: noweId(), typ, ts, autor, seq: (st.seqMax.get(autor) || 0) + 1, dane };
  }

  function nastepnyNumer(st, rodzaj, rok) {
    let m = 0;
    for (const { ev } of st.dokumenty.values()) if (ev.dane.rodzaj === rodzaj && ev.dane.rok === rok) m = Math.max(m, ev.dane.nr);
    return m + 1;
  }

  /** Czy wydanie z danej partii/egzemplarza na projekt docelowy jest wydaniem zastępczym. */
  function czyZastepcze(projektZakupu, projektDocelowy) {
    return !!norm(projektZakupu) && normKlucz(projektZakupu) !== normKlucz(projektDocelowy);
  }

  /**
   * Przygotowuje zdarzenie dokumentu z nadanym numerem.
   * dane: {rodzaj, data, projekt, klientId, klientNazwa, adres, dostawca, nrFaktury, osoba, uwagi, powod, pozycje}
   */
  function przygotujDokument(st, autor, dane, teraz) {
    const t = teraz || new Date();
    const rok = Number((dane.data || t.toISOString()).slice(0, 4));
    const rodzaj = dane.rodzaj;
    const nr = nastepnyNumer(st, rodzaj, rok);
    const tresc = Object.assign({}, dane, { rodzaj, rok, nr, numer: formatNumer(rodzaj, rok, nr) });
    return noweZdarzenie(st, 'DOK', autor, tresc, t);
  }

  /** Zwraca listę problemów, które spowodowałoby dodanie zdarzenia (pusta lista = OK). */
  function sprawdzNowe(zdarzenia, ev) {
    const przed = zbudujStan(zdarzenia, { bezKontroli: true });
    const po = zbudujStan(zdarzenia.concat([ev]), { bezKontroli: true });
    const klucz = (p) => p.kod + '|' + p.opis;
    const bylo = new Set(przed.problemy.map(klucz));
    return po.problemy.filter((p) => !bylo.has(klucz(p))).map((p) => p.opis);
  }

  function walidujDokument(st, d) {
    const bledy = [];
    const r = RODZAJE[d.rodzaj];
    if (!r) bledy.push('Nieznany rodzaj dokumentu');
    if (!d.pozycje || !d.pozycje.length) bledy.push('Dokument nie ma żadnej pozycji');
    if (r && r.kierunek === 'wydanie' && !norm(d.projekt)) bledy.push('Podaj numer projektu, na który wydajesz sprzęt');
    if (r && r.kierunek === 'wydanie' && !norm(d.klientNazwa)) bledy.push('Podaj klienta');
    if (r && r.kierunek === 'zwrot' && !norm(d.projekt)) bledy.push('Podaj numer projektu, z którego wraca sprzęt');
    if (d.rodzaj === 'PZ' && !norm(d.dostawca)) bledy.push('Podaj dostawcę');
    if (d.rodzaj === 'WZZ' && !norm(d.powod)) bledy.push('Wydanie zastępcze wymaga powodu');
    (d.pozycje || []).forEach((p, i) => {
      const m = st.modele.get(p.modelId);
      const n = 'Pozycja ' + (i + 1) + ': ';
      if (!m) { bledy.push(n + 'wybierz model'); return; }
      if (m.seryjny && !norm(p.sn)) bledy.push(n + 'podaj numer seryjny');
      if (!m.seryjny && !(Number(p.ilosc) > 0)) bledy.push(n + 'ilość musi być większa od zera');
      if (r && (r.kierunek === 'przyjecie' || r.kierunek === 'zwrot') && !norm(p.lok)) bledy.push(n + 'podaj lokalizację');
    });
    // powtórzone numery seryjne w jednym dokumencie
    const sn = new Set();
    for (const p of d.pozycje || []) {
      if (!p.sn) continue;
      const k = kluczEgz(p.modelId, p.sn);
      if (sn.has(k)) bledy.push('Numer seryjny ' + p.sn + ' występuje w dokumencie dwa razy');
      sn.add(k);
    }
    // wydanie zastępcze musi być oznaczone jako WZZ
    if (r && r.kierunek === 'wydanie') {
      const zast = (d.pozycje || []).some((p) => czyZastepcze(p.projektZakupu, d.projekt));
      if (zast && d.rodzaj !== 'WZZ') bledy.push('Dokument zawiera sprzęt kupiony pod inny projekt – musi to być wydanie zastępcze (WZZ)');
      if (!zast && d.rodzaj === 'WZZ') bledy.push('Wydanie zastępcze bez sprzętu z innego projektu – użyj zwykłego WZ');
    }
    return bledy;
  }

  // ---------------------------------------------------------------- zestawienia

  function stanyModeli(st) {
    const wynik = new Map();
    for (const [id, m] of st.modele) wynik.set(id, { model: m, wolne: 0, podProjekt: 0, projekty: new Map(), wydane: 0 });
    for (const [k, ilosc] of st.partie) {
      if (Math.abs(ilosc) < 1e-9) continue;
      const [modelId, , projekt] = k.split('|');
      const w = wynik.get(modelId);
      if (!w) continue;
      if (projekt) {
        w.podProjekt = zaokr(w.podProjekt + ilosc);
        w.projekty.set(projekt, zaokr((w.projekty.get(projekt) || 0) + ilosc));
      } else w.wolne = zaokr(w.wolne + ilosc);
    }
    for (const e of st.egzemplarze.values()) {
      const w = wynik.get(e.modelId);
      if (!w) continue;
      if (e.status === 'magazyn') {
        if (e.projektZakupu) {
          w.podProjekt += 1;
          w.projekty.set(e.projektZakupu, (w.projekty.get(e.projektZakupu) || 0) + 1);
        } else w.wolne += 1;
      } else if (e.status === 'wydany') w.wydane += 1;
    }
    for (const [k, ilosc] of st.wydane) {
      const modelId = k.split('|').pop();
      const w = wynik.get(modelId);
      if (w) w.wydane = zaokr(w.wydane + ilosc);
    }
    return Array.from(wynik.values()).map((w) => Object.assign(w, {
      razem: zaokr(w.wolne + w.podProjekt),
      ponizejMin: Number(w.model.stanMin) > 0 && w.wolne + w.podProjekt < Number(w.model.stanMin),
    }));
  }

  /** Wiersze: co leży w magazynie, w podziale na lokalizacje (do wydania, przeniesienia, raportów). */
  function wierszeMagazynu(st) {
    const w = [];
    for (const [k, ilosc] of st.partie) {
      if (Math.abs(ilosc) < 1e-9) continue;
      const [modelId, lok, projekt] = k.split('|');
      w.push({ modelId, lok, projekt, ilosc, sn: '' });
    }
    for (const e of st.egzemplarze.values()) {
      if (e.status !== 'magazyn') continue;
      w.push({ modelId: e.modelId, lok: e.lok, projekt: e.projektZakupu, ilosc: 1, sn: e.sn, stanTech: e.stanTech });
    }
    return w;
  }

  /** Co jest wydane na dany projekt (do zwrotów i raportów). */
  function wydaneNaProjekt(st, projekt) {
    const p = normKlucz(projekt);
    const w = [];
    for (const e of st.egzemplarze.values()) {
      if (e.status === 'wydany' && (!p || normKlucz(e.projekt) === p)) w.push({ modelId: e.modelId, sn: e.sn, ilosc: 1, projekt: e.projekt, klient: e.klient, numer: e.wydanie && e.wydanie.numer });
    }
    for (const [k, ilosc] of st.wydane) {
      if (ilosc < 1e-9) continue;
      const i = k.lastIndexOf('|');
      const proj = k.slice(0, i);
      const modelId = k.slice(i + 1);
      if (!p || normKlucz(proj) === p) w.push({ modelId, sn: '', ilosc, projekt: proj, klient: st.wydaneKlient.get(k) || '' });
    }
    return w;
  }

  function dokumentyLista(st) {
    return Array.from(st.dokumenty.values()).sort((a, b) => (a.ev.ts < b.ev.ts ? 1 : -1));
  }

  function podpowiedzi(st) {
    const klienci = new Set();
    for (const k of st.klienci.values()) if (k.nazwa) klienci.add(k.nazwa);
    for (const { ev } of st.dokumenty.values()) if (ev.dane.klientNazwa) klienci.add(ev.dane.klientNazwa);
    const dostawcy = new Set();
    for (const { ev } of st.dokumenty.values()) if (ev.dane.dostawca) dostawcy.add(ev.dane.dostawca);
    const producenci = new Set();
    for (const m of st.modele.values()) if (m.producent) producenci.add(m.producent);
    const sortuj = (s) => Array.from(s).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pl'));
    return { lokalizacje: sortuj(st.lokalizacje), projekty: sortuj(st.projekty), klienci: sortuj(klienci), dostawcy: sortuj(dostawcy), producenci: sortuj(producenci) };
  }

  /** Czy wartość jest nowa (nie występowała) – do potwierdzania nowych lokalizacji/projektów. */
  function czyNowaWartosc(lista, wartosc) {
    const k = normKlucz(wartosc);
    return !!k && !lista.some((x) => normKlucz(x) === k);
  }

  function opisZdarzenia(st, ev) {
    const d = ev.dane || {};
    switch (ev.typ) {
      case 'DOK': return (RODZAJE[d.rodzaj] || {}).nazwa + ' ' + d.numer + (d.projekt ? ' · projekt ' + d.projekt : '') + ' · ' + (d.pozycje || []).length + ' poz.';
      case 'ANUL': return 'Anulowano ' + (d.numer || '') + ' · powód: ' + (d.powod || '');
      case 'PRZENIES': return 'Przeniesiono ' + opisModelu(st, d.modelId) + (d.sn ? ' SN ' + d.sn : ' ' + d.ilosc) + ' z ' + d.z + ' na ' + d.do;
      case 'SKAN': return 'Dołączono skan do ' + (d.numer || '') + ': ' + d.plik;
      case 'UZUP': return 'Oznaczono jako uzupełnione: ' + (d.numer || '') + ' poz. ' + (Number(d.idx) + 1) + (d.uwagi ? ' · ' + d.uwagi : '');
      case 'MODEL': return 'Kartoteka: ' + (d.producent ? d.producent + ' ' : '') + (d.model || opisModelu(st, d.modelId));
      case 'KLIENT': return 'Klient: ' + (d.nazwa || d.klientId);
      case 'UZYTK': return 'Użytkownik: ' + (d.imie || '') + ' ' + (d.nazwisko || '') + (d.aktywny === false ? ' (dezaktywowany)' : '');
      default: return ev.typ;
    }
  }

  return {
    WERSJA, RODZAJE, KATEGORIE, STANY_TECHNICZNE,
    canonical, sha256hex, zapieczetuj, sprawdzPieczec, noweId, zaokr, norm, normKlucz, hashPin,
    formatNumer, nazwaPlikuDokumentu, sciezkaZdarzenia, czyPoprawnaNazwaPliku,
    zbudujStan, noweZdarzenie, nastepnyNumer, przygotujDokument, sprawdzNowe, walidujDokument, czyZastepcze,
    stanyModeli, wierszeMagazynu, wydaneNaProjekt, dokumentyLista, podpowiedzi, czyNowaWartosc, opisZdarzenia, opisModelu,
    kluczEgz,
  };
});
