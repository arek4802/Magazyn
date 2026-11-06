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

  /**
   * Wbudowana biblioteka dostawców – dane z rejestrów (KRS / REGON / Biała lista VAT),
   * sprawdzone 06.11.2026. Użytkownik może je poprawić: jego zmiana (zdarzenie DOSTAWCA
   * z tym samym dostawcaId) nadpisuje wartości wbudowane.
   */
  const ZRODLO_WBUDOWANE = 'dane z rejestru KRS i REGON, sprawdzone 06.11.2026';
  const DOSTAWCY_WBUDOWANI = [
    {
      dostawcaId: 'wb-aplauz', nazwa: 'Aplauz Audio',
      pelnaNazwa: '„APLAUZ” SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      nip: '1181710940', regon: '015566419', krs: '0000179872',
      adres: 'ul. Graniczna 19, 05-092 Łomianki', adresBiura: '', tel: '', email: '', www: 'aplauzaudio.pl',
      marki: '', uwagi: 'Dystrybutor sprzętu audio',
    },
    {
      dostawcaId: 'wb-polsound', nazwa: 'Polsound',
      pelnaNazwa: 'POLSOUND SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      nip: '5260307175', regon: '010538252', krs: '0000121965',
      adres: 'ul. Graniczna 17, 05-092 Łomianki', adresBiura: 'ul. Brukowa 29, 05-092 Łomianki',
      tel: '+48 22 204 11 00', email: 'biuro@polsound.pl', www: 'polsound.pl',
      marki: 'Shure, Sony (wyświetlacze profesjonalne)', uwagi: 'Oficjalny dystrybutor Shure w Polsce',
    },
    {
      dostawcaId: 'wb-suprema', nazwa: 'Suprema Polska',
      pelnaNazwa: 'SUPREMA POLSKA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      nip: '5222498486', regon: '016123115', krs: '0000315683',
      adres: 'ul. Atlasowa 19, 02-437 Warszawa', adresBiura: 'ul. Jaworskiego 6/2, 05-090 Raszyn',
      tel: '', email: 'info@supremapolska.pl', www: 'supremapolska.pl',
      marki: 'Suprema (ekrany projekcyjne)', uwagi: 'Ekrany projekcyjne, monitory, projektory',
    },
    {
      dostawcaId: 'wb-sony', nazwa: 'Sony',
      pelnaNazwa: 'SONY EUROPE B.V. (SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ) ODDZIAŁ W POLSCE',
      nip: '1080022836', regon: '382193856', krs: '0000763518',
      adres: 'ul. Ogrodowa 58, 00-876 Warszawa', adresBiura: '', tel: '', email: '', www: 'sony.pl',
      marki: 'Sony', uwagi: 'Polski oddział producenta',
    },
    {
      dostawcaId: 'wb-samsung', nazwa: 'Samsung',
      pelnaNazwa: 'SAMSUNG ELECTRONICS POLSKA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      nip: '5261044039', regon: '011612810', krs: '0000128080',
      adres: 'ul. Postępu 14, 02-676 Warszawa', adresBiura: '', tel: '', email: '', www: 'samsung.com/pl',
      marki: 'Samsung', uwagi: 'Polska spółka producenta',
    },
    {
      dostawcaId: 'wb-konsbud', nazwa: 'Konsbud Audio',
      pelnaNazwa: 'KONSBUD AUDIO SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
      nip: '5260202855', regon: '012064999', krs: '0000073444',
      adres: 'ul. Gajdy 24, 02-878 Warszawa', adresBiura: '', tel: '', email: '', www: 'konsbud-audio.pl',
      marki: 'Biamp, Audio-Technica', uwagi: 'Dystrybutor i integrator systemów audio',
    },
  ].map((d) => Object.assign(d, { zrodlo: ZRODLO_WBUDOWANE }));

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

  /** Klucz do wyszukiwania: małe litery, bez polskich znaków i nadmiarowych spacji. */
  function kluczSzukania(s) {
    return normKlucz(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
  }

  /** Czy każdy wyraz z zapytania występuje w tekście (bez względu na wielkość liter i ogonki). */
  function pasujeDo(zapytanie, ...teksty) {
    const z = kluczSzukania(zapytanie);
    if (!z) return true;
    const t = kluczSzukania(teksty.join(' '));
    return z.split(' ').every((cz) => t.includes(cz));
  }

  function cyfry(s) {
    return norm(s).replace(/\D/g, '');
  }

  /** Suma kontrolna NIP (10 cyfr, wagi 6-5-7-2-3-4-5-6-7). Przyjmuje też „PL” i kreski. */
  function poprawnyNip(nip) {
    const c = cyfry(nip);
    if (c.length !== 10) return false;
    const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
    let s = 0;
    for (let i = 0; i < 9; i++) s += Number(c[i]) * w[i];
    const k = s % 11;
    return k !== 10 && k === Number(c[9]);
  }

  /** Suma kontrolna REGON (9 albo 14 cyfr). */
  function poprawnyRegon(regon) {
    const c = cyfry(regon);
    const licz = (n, w) => {
      let s = 0;
      for (let i = 0; i < w.length; i++) s += Number(n[i]) * w[i];
      return (s % 11) % 10;
    };
    if (c.length === 9) return licz(c, [8, 9, 2, 3, 4, 5, 6, 7]) === Number(c[8]);
    if (c.length === 14) return poprawnyRegon(c.slice(0, 9)) && licz(c, [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8]) === Number(c[13]);
    return false;
  }

  async function hashPin(salt, pin) {
    return sha256hex('magazyn-pin|' + salt + '|' + String(pin));
  }

  /**
   * PIN-y zapisujemy jako PBKDF2-SHA256 (150 000 powtórzeń) – sprawdzenie jednego PIN-u trwa ułamek sekundy,
   * ale odgadywanie wszystkich kombinacji z pliku jest tysiące razy wolniejsze niż przy zwykłym skrócie.
   * Starsze konta (pinAlg pusty) mają zwykły SHA-256 – działają dalej, a przy zmianie PIN-u przechodzą na PBKDF2.
   */
  const PIN_ALG = 'pbkdf2-sha256-150k';
  async function hashPinMocny(salt, pin) {
    const enc = new TextEncoder();
    const klucz = await globalThis.crypto.subtle.importKey('raw', enc.encode(String(pin)), 'PBKDF2', false, ['deriveBits']);
    const bity = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('magazyn-pin|' + salt), iterations: 150000 }, klucz, 256);
    return Array.from(new Uint8Array(bity)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /** Dane do zapisania w profilu po ustawieniu PIN-u. */
  async function noweDanePinu(pin) {
    const pinSalt = noweId(16);
    return { pinSalt, pinHash: await hashPinMocny(pinSalt, pin), pinAlg: PIN_ALG };
  }

  async function sprawdzPin(uzytkownik, pin) {
    if (!uzytkownik || !uzytkownik.pinHash || !/^\d{4,8}$/.test(String(pin || ''))) return false;
    const h = uzytkownik.pinAlg === PIN_ALG ? await hashPinMocny(uzytkownik.pinSalt, pin) : await hashPin(uzytkownik.pinSalt, pin);
    return h === uzytkownik.pinHash;
  }

  /** Zbyt proste PIN-y: same takie same cyfry albo kolejne cyfry (1234, 4321…). */
  function slabyPin(pin) {
    const p = String(pin || '');
    if (/^(\d)\1+$/.test(p)) return true;
    const rosn = '01234567890123456789';
    const mal = '98765432109876543210';
    return rosn.includes(p) || mal.includes(p);
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
    const dostawcy = new Map(); // dostawcaId -> {...}; zaczynamy od biblioteki wbudowanej
    for (const d of DOSTAWCY_WBUDOWANI) dostawcy.set(d.dostawcaId, Object.assign({}, d, { wbudowany: true }));
    return {
      uzytkownicy: new Map(), // userId -> {...}
      modele: new Map(), // modelId -> {...}
      klienci: new Map(), // klientId -> {...}
      dostawcy,
      rejestrProjektow: new Map(), // projektId -> {numer, nazwa, klientNazwa, adres, status, uwagi}
      projektyWgNumeru: new Map(), // normKlucz(numer) -> wpis z rejestru
      nazwyZDokumentow: new Map(), // normKlucz(numer) -> nazwa zapisana w dokumencie
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

  function jm(st, modelId) {
    const m = st.modele.get(modelId);
    return m && m.jednostka === 'm' ? 'm' : 'szt.';
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

    for (const p of st.rejestrProjektow.values()) {
      if (!norm(p.numer)) continue;
      st.projektyWgNumeru.set(normKlucz(p.numer), p);
      st.projekty.add(norm(p.numer));
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
      case 'PROJEKT': {
        const stary = st.rejestrProjektow.get(d.projektId) || {};
        st.rejestrProjektow.set(d.projektId, Object.assign({}, stary, d, { utworzono: stary.utworzono || ev.ts }));
        break;
      }
      case 'DOSTAWCA': {
        const stary = st.dostawcy.get(d.dostawcaId) || {};
        st.dostawcy.set(d.dostawcaId, Object.assign({}, stary, d, { utworzono: stary.utworzono || ev.ts, zmieniono: ev.ts }));
        break;
      }
      case 'DOK': {
        const anul = anulowane.get(ev.id);
        if (d.projekt && norm(d.projektNazwa)) st.nazwyZDokumentow.set(normKlucz(d.projekt), norm(d.projektNazwa));
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
            problem(st, 'ILOSC', d.numer + ': ' + opisModelu(st, p.modelId) + ' – brak ' + ile + ' ' + jm(st, p.modelId) + ' w lokalizacji ' + norm(p.lok) + (p.projektZakupu ? ' (pod projekt ' + p.projektZakupu + ')' : '') + ', jest ' + jest + ' ' + jm(st, p.modelId), ev.id);
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
          if (wyd + 1e-9 < ile) problem(st, 'ILOSC', d.numer + ': zwrot ' + ile + ' ' + jm(st, p.modelId) + ' ' + opisModelu(st, p.modelId) + ' to więcej, niż wydano na projekt ' + d.projekt + ' (' + wyd + ' ' + jm(st, p.modelId) + ')', ev.id);
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
      e.historia.push({ ts: ev.ts, rodzaj: 'PRZENIES', opis: 'Przeniesiono z „' + e.lok + '” do „' + norm(d.do) + '”' });
      e.lok = norm(d.do);
    } else {
      const kz = kluczPartii(d.modelId, d.z, d.projekt);
      const jest = st.partie.get(kz) || 0;
      const ile = zaokr(d.ilosc);
      if (jest + 1e-9 < ile) problem(st, 'ILOSC', 'Przeniesienie: brak ' + ile + ' ' + jm(st, d.modelId) + ' ' + opisModelu(st, d.modelId) + ' w lokalizacji ' + d.z + ', jest ' + jest + ' ' + jm(st, d.modelId), ev.id);
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

  // ---------------------------------------------------------------- projekty i dostawcy

  /** Wpis z rejestru projektów dla numeru (albo null, gdy projekt ma tylko numer). */
  function projektWgNumeru(st, numer) {
    return st.projektyWgNumeru.get(normKlucz(numer)) || null;
  }

  /** Nazwa projektu: z rejestru, a gdy jej tam nie ma – zapamiętana w dokumentach. */
  function nazwaProjektu(st, numer) {
    if (!norm(numer)) return '';
    const p = projektWgNumeru(st, numer);
    return (p && norm(p.nazwa)) || st.nazwyZDokumentow.get(normKlucz(numer)) || '';
  }

  /** „P-2026-014 – Biuro Alfa” albo sam numer. */
  function opisProjektu(st, numer) {
    const n = nazwaProjektu(st, numer);
    return norm(numer) + (n ? ' – ' + n : '');
  }

  /** Wszystkie projekty: z rejestru i te, które występują tylko w dokumentach (bez nazwy). */
  function listaProjektow(st) {
    const wynik = new Map();
    for (const p of st.rejestrProjektow.values()) {
      if (!norm(p.numer)) continue;
      wynik.set(normKlucz(p.numer), Object.assign({ status: 'w toku' }, p, { numer: norm(p.numer), wRejestrze: true }));
    }
    for (const numer of st.projekty) {
      const k = normKlucz(numer);
      if (!wynik.has(k)) wynik.set(k, { projektId: '', numer, nazwa: st.nazwyZDokumentow.get(k) || '', klientNazwa: '', adres: '', status: 'w toku', wRejestrze: false });
    }
    // klient i ostatnia data z dokumentów
    for (const { ev, anulowany } of st.dokumenty.values()) {
      const d = ev.dane;
      if (!d.projekt || anulowany) continue;
      const p = wynik.get(normKlucz(d.projekt));
      if (!p) continue;
      if (!p.klientNazwa && d.klientNazwa) p.klientNazwa = d.klientNazwa;
      if (!p.adres && d.adres) p.adres = d.adres;
      if (!p.ostatni || p.ostatni < ev.ts) p.ostatni = ev.ts;
      p.dokumenty = (p.dokumenty || 0) + 1;
    }
    return Array.from(wynik.values()).sort((a, b) => b.numer.localeCompare(a.numer, 'pl', { numeric: true }));
  }

  /** Dostawca z biblioteki po nazwie skróconej albo pełnej (bez względu na wielkość liter). */
  function dostawcaWgNazwy(st, nazwa) {
    const k = normKlucz(nazwa);
    if (!k) return null;
    for (const d of st.dostawcy.values()) if (normKlucz(d.nazwa) === k || normKlucz(d.pelnaNazwa) === k) return d;
    return null;
  }

  function podpowiedzi(st) {
    const klienci = new Set();
    for (const k of st.klienci.values()) if (k.nazwa) klienci.add(k.nazwa);
    for (const { ev } of st.dokumenty.values()) if (ev.dane.klientNazwa) klienci.add(ev.dane.klientNazwa);
    for (const p of st.rejestrProjektow.values()) if (p.klientNazwa) klienci.add(p.klientNazwa);
    const dostawcy = new Set();
    for (const d of st.dostawcy.values()) if (d.aktywny !== false && d.nazwa) dostawcy.add(d.nazwa);
    for (const { ev } of st.dokumenty.values()) if (ev.dane.dostawca) dostawcy.add(ev.dane.dostawca);
    const producenci = new Set();
    for (const m of st.modele.values()) if (m.producent) producenci.add(m.producent);
    const osoby = new Set();
    for (const u of st.uzytkownicy.values()) if (u.aktywny !== false && u.imie) osoby.add(u.imie + ' ' + u.nazwisko);
    for (const { ev } of st.dokumenty.values()) if (ev.dane.osoba) osoby.add(ev.dane.osoba);
    const adresy = new Set();
    for (const p of st.rejestrProjektow.values()) if (p.adres) adresy.add(p.adres);
    for (const { ev } of st.dokumenty.values()) if (ev.dane.adres) adresy.add(ev.dane.adres);
    const sortuj = (s) => Array.from(s).filter(Boolean).sort((a, b) => a.localeCompare(b, 'pl'));
    return { lokalizacje: sortuj(st.lokalizacje), projekty: sortuj(st.projekty), klienci: sortuj(klienci), dostawcy: sortuj(dostawcy), producenci: sortuj(producenci), osoby: sortuj(osoby), adresy: sortuj(adresy) };
  }

  /** Czy wartość jest nowa (nie występowała) – do potwierdzania nowych lokalizacji/projektów. */
  function czyNowaWartosc(lista, wartosc) {
    const k = normKlucz(wartosc);
    return !!k && !lista.some((x) => normKlucz(x) === k);
  }

  function opisZdarzenia(st, ev) {
    const d = ev.dane || {};
    switch (ev.typ) {
      case 'DOK': return (RODZAJE[d.rodzaj] || {}).nazwa + ' ' + d.numer + (d.projekt ? ' · projekt ' + opisProjektu(st, d.projekt) : '') + (d.dostawca ? ' · ' + d.dostawca : '') + ' · ' + (d.pozycje || []).length + ' poz.';
      case 'PROJEKT': return 'Projekt: ' + (d.numer || '') + (d.nazwa ? ' – ' + d.nazwa : '') + (d.status === 'zakończony' ? ' (zakończony)' : '');
      case 'DOSTAWCA': return 'Dostawca: ' + (d.nazwa || d.dostawcaId) + (d.aktywny === false ? ' (ukryty na listach)' : '');
      case 'ANUL': return 'Anulowano ' + (d.numer || '') + ' · powód: ' + (d.powod || '');
      case 'PRZENIES': return 'Przeniesiono ' + opisModelu(st, d.modelId) + (d.sn ? ' SN ' + d.sn : ' · ' + d.ilosc + ' ' + jm(st, d.modelId)) + ' z „' + d.z + '” do „' + d.do + '”';
      case 'SKAN': return 'Dołączono skan do ' + (d.numer || '') + ': ' + d.plik;
      case 'UZUP': return 'Oznaczono jako uzupełnione: ' + (d.numer || '') + ' poz. ' + (Number(d.idx) + 1) + (d.uwagi ? ' · ' + d.uwagi : '');
      case 'MODEL': return 'Kartoteka: ' + (d.producent ? d.producent + ' ' : '') + (d.model || opisModelu(st, d.modelId)) + (d.kartaPlik || d.link ? ' (z kartą katalogową)' : '');
      case 'KLIENT': return 'Klient: ' + (d.nazwa || d.klientId);
      case 'UZYTK': {
        const u = st.uzytkownicy.get(d.userId) || {};
        const kto = ((d.imie || u.imie || '') + ' ' + (d.nazwisko || u.nazwisko || '')).trim();
        if (d.pinResetPrzez) return 'Reset PIN-u: ' + kto + ' (do zmiany przy logowaniu)';
        if (d.pinHash && !d.imie) return 'Zmiana PIN-u: ' + kto;
        if (!d.imie && d.aktywny !== undefined) return (d.aktywny === false ? 'Dezaktywowano konto: ' : 'Przywrócono konto: ') + kto;
        return 'Użytkownik: ' + kto + (d.aktywny === false ? ' (dezaktywowany)' : '');
      }
      default: return ev.typ;
    }
  }

  return {
    WERSJA, RODZAJE, KATEGORIE, STANY_TECHNICZNE, DOSTAWCY_WBUDOWANI,
    canonical, sha256hex, zapieczetuj, sprawdzPieczec, noweId, zaokr, norm, normKlucz, hashPin,
    PIN_ALG, noweDanePinu, sprawdzPin, slabyPin,
    kluczSzukania, pasujeDo, cyfry, poprawnyNip, poprawnyRegon,
    projektWgNumeru, nazwaProjektu, opisProjektu, listaProjektow, dostawcaWgNazwy,
    formatNumer, nazwaPlikuDokumentu, sciezkaZdarzenia, czyPoprawnaNazwaPliku,
    zbudujStan, noweZdarzenie, nastepnyNumer, przygotujDokument, sprawdzNowe, walidujDokument, czyZastepcze,
    stanyModeli, wierszeMagazynu, wydaneNaProjekt, dokumentyLista, podpowiedzi, czyNowaWartosc, opisZdarzenia, opisModelu,
    kluczEgz,
  };
});
