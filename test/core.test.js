'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');

let zegar = Date.parse('2026-11-06T08:00:00.000Z');
const teraz = () => new Date((zegar += 1000));

async function dodaj(lista, ev) {
  await C.zapieczetuj(ev);
  lista.push(ev);
  return ev;
}

async function baza() {
  const z = [];
  let st = C.zbudujStan(z);
  await dodaj(z, C.noweZdarzenie(st, 'UZYTK', 'u1', { userId: 'u1', imie: 'Jan', nazwisko: 'Kowalski', aktywny: true }, teraz()));
  st = C.zbudujStan(z);
  await dodaj(z, C.noweZdarzenie(st, 'MODEL', 'u1', { modelId: 'tv', producent: 'Samsung', model: 'QM55C', seryjny: true, jednostka: 'szt', kategoria: 'Wyświetlacze', stanMin: 1 }, teraz()));
  st = C.zbudujStan(z);
  await dodaj(z, C.noweZdarzenie(st, 'MODEL', 'u1', { modelId: 'cat', producent: 'Belden', model: 'Cat6 U/UTP', seryjny: false, jednostka: 'm', jednostkaZakupu: 'szpula', przelicznik: 305, kategoria: 'Okablowanie', stanMin: 500 }, teraz()));
  return z;
}

async function dokument(z, dane) {
  const st = C.zbudujStan(z);
  const bledy = C.walidujDokument(st, dane);
  if (bledy.length) return { bledy };
  const ev = C.przygotujDokument(st, 'u1', dane, teraz());
  const problemy = C.sprawdzNowe(z, ev);
  if (problemy.length) return { bledy: problemy };
  await dodaj(z, ev);
  return { ev };
}

test('pieczęć wykrywa zmianę pliku', async () => {
  const ev = await C.zapieczetuj({ id: 'a', typ: 'MODEL', ts: '2026-01-01T00:00:00.000Z', autor: 'u1', seq: 1, dane: { modelId: 'x', model: 'A' } });
  assert.equal(await C.sprawdzPieczec(ev), true);
  const zmieniony = JSON.parse(JSON.stringify(ev));
  zmieniony.dane.model = 'B';
  assert.equal(await C.sprawdzPieczec(zmieniony), false);
});

test('przyjęcie, wydanie i zwrot – stany się zgadzają', async () => {
  const z = await baza();
  let r = await dokument(z, { rodzaj: 'PZ', data: '2026-11-06', dostawca: 'ABC Dystrybucja', pozycje: [
    { modelId: 'tv', sn: 'SN001', lok: 'Regał A', ilosc: 1 },
    { modelId: 'tv', sn: 'SN002', lok: 'Regał A', ilosc: 1 },
    { modelId: 'cat', ilosc: 610, lok: 'Regał K' },
  ] });
  assert.ok(r.ev, JSON.stringify(r.bledy));
  assert.equal(r.ev.dane.numer, 'PZ/2026/0001');

  r = await dokument(z, { rodzaj: 'WZ', data: '2026-11-06', projekt: 'P-100', klientNazwa: 'Firma X', pozycje: [
    { modelId: 'tv', sn: 'SN001', ilosc: 1, lok: 'Regał A', projektZakupu: '' },
    { modelId: 'cat', ilosc: 120.5, lok: 'Regał K', projektZakupu: '' },
  ] });
  assert.ok(r.ev, JSON.stringify(r.bledy));

  let st = C.zbudujStan(z);
  const tv = C.stanyModeli(st).find((w) => w.model.modelId === 'tv');
  const cat = C.stanyModeli(st).find((w) => w.model.modelId === 'cat');
  assert.equal(tv.wolne, 1);
  assert.equal(tv.wydane, 1);
  assert.equal(cat.wolne, 489.5);
  assert.equal(cat.ponizejMin, true);
  assert.deepEqual(st.problemy, []);

  r = await dokument(z, { rodzaj: 'ZW', data: '2026-11-06', projekt: 'P-100', pozycje: [
    { modelId: 'tv', sn: 'SN001', lok: 'Regał B', stanTech: 'używany' },
    { modelId: 'cat', ilosc: 20.5, lok: 'Regał K' },
  ] });
  assert.ok(r.ev, JSON.stringify(r.bledy));
  st = C.zbudujStan(z);
  const e = st.egzemplarze.get(C.kluczEgz('tv', 'SN001'));
  assert.equal(e.status, 'magazyn');
  assert.equal(e.lok, 'Regał B');
  assert.equal(e.stanTech, 'używany');
  assert.equal(C.stanyModeli(st).find((w) => w.model.modelId === 'cat').wolne, 510);
});

test('nie da się wydać więcej, niż jest, ani tego samego SN dwa razy', async () => {
  const z = await baza();
  await dokument(z, { rodzaj: 'BO', data: '2026-11-06', pozycje: [{ modelId: 'tv', sn: 'A1', lok: 'R1' }, { modelId: 'cat', ilosc: 100, lok: 'R2' }] });
  let r = await dokument(z, { rodzaj: 'WZ', data: '2026-11-06', projekt: 'P1', klientNazwa: 'K', pozycje: [{ modelId: 'cat', ilosc: 150, lok: 'R2', projektZakupu: '' }] });
  assert.ok(r.bledy && r.bledy.some((b) => b.includes('brak 150')));
  r = await dokument(z, { rodzaj: 'WZ', data: '2026-11-06', projekt: 'P1', klientNazwa: 'K', pozycje: [{ modelId: 'tv', sn: 'A1', lok: 'R1', projektZakupu: '' }] });
  assert.ok(r.ev);
  r = await dokument(z, { rodzaj: 'WZ', data: '2026-11-06', projekt: 'P2', klientNazwa: 'K', pozycje: [{ modelId: 'tv', sn: 'A1', lok: 'R1', projektZakupu: '' }] });
  assert.ok(r.bledy && r.bledy.some((b) => b.includes('nie jest na stanie')));
});

test('sprzęt kupiony pod projekt: WZ blokowane, WZZ tworzy pozycję do uzupełnienia', async () => {
  const z = await baza();
  await dokument(z, { rodzaj: 'PZ', data: '2026-11-06', dostawca: 'D', projekt: 'P-A', pozycje: [{ modelId: 'tv', sn: 'X1', lok: 'R1', projekt: 'P-A' }, { modelId: 'cat', ilosc: 305, lok: 'R2', projekt: 'P-A' }] });
  let st = C.zbudujStan(z);
  const tv = C.stanyModeli(st).find((w) => w.model.modelId === 'tv');
  assert.equal(tv.wolne, 0);
  assert.equal(tv.podProjekt, 1);

  let r = await dokument(z, { rodzaj: 'WZ', data: '2026-11-06', projekt: 'P-B', klientNazwa: 'K', pozycje: [{ modelId: 'tv', sn: 'X1', lok: 'R1', projektZakupu: 'P-A' }] });
  assert.ok(r.bledy && r.bledy.some((b) => b.includes('WZZ')));

  r = await dokument(z, { rodzaj: 'WZZ', data: '2026-11-06', projekt: 'P-B', klientNazwa: 'K', pozycje: [{ modelId: 'tv', sn: 'X1', lok: 'R1', projektZakupu: 'P-A' }] });
  assert.ok(r.bledy && r.bledy.some((b) => b.includes('powodu')));

  r = await dokument(z, { rodzaj: 'WZZ', data: '2026-11-06', projekt: 'P-B', klientNazwa: 'K', powod: 'Awaria u klienta B', pozycje: [
    { modelId: 'tv', sn: 'X1', lok: 'R1', projektZakupu: 'P-A' },
    { modelId: 'cat', ilosc: 50, lok: 'R2', projektZakupu: 'P-A' },
  ] });
  assert.ok(r.ev, JSON.stringify(r.bledy));
  assert.equal(r.ev.dane.numer, 'WZZ/2026/0001');

  st = C.zbudujStan(z);
  assert.equal(st.uzupelnienia.length, 2);
  assert.equal(st.uzupelnienia[0].projektZakupu, 'P-A');

  // własny projekt – zwykłe WZ
  r = await dokument(z, { rodzaj: 'WZ', data: '2026-11-06', projekt: 'P-A', klientNazwa: 'K', pozycje: [{ modelId: 'cat', ilosc: 100, lok: 'R2', projektZakupu: 'P-A' }] });
  assert.ok(r.ev, JSON.stringify(r.bledy));

  // oznaczenie uzupełnienia
  st = C.zbudujStan(z);
  const u = st.uzupelnienia[0];
  await dodaj(z, C.noweZdarzenie(st, 'UZUP', 'u1', { docId: u.docId, numer: u.numer, idx: u.idx, uwagi: 'PZ/2026/0002' }, teraz()));
  st = C.zbudujStan(z);
  assert.equal(st.uzupelnienia.filter((x) => !x.zamkniete).length, 1);
});

test('anulowanie: nie można anulować przyjęcia, z którego już wydano', async () => {
  const z = await baza();
  const pz = (await dokument(z, { rodzaj: 'PZ', data: '2026-11-06', dostawca: 'D', pozycje: [{ modelId: 'tv', sn: 'Z9', lok: 'R1' }] })).ev;
  await dokument(z, { rodzaj: 'WZ', data: '2026-11-06', projekt: 'P', klientNazwa: 'K', pozycje: [{ modelId: 'tv', sn: 'Z9', lok: 'R1', projektZakupu: '' }] });
  let st = C.zbudujStan(z);
  const anul = C.noweZdarzenie(st, 'ANUL', 'u1', { docId: pz.id, numer: pz.dane.numer, powod: 'pomyłka' }, teraz());
  assert.ok(C.sprawdzNowe(z, anul).length > 0);

  // anulowanie wydania jest możliwe i przywraca stan
  const wz = C.dokumentyLista(st).find((d) => d.ev.dane.rodzaj === 'WZ').ev;
  const anulWz = C.noweZdarzenie(st, 'ANUL', 'u1', { docId: wz.id, numer: wz.dane.numer, powod: 'zły projekt' }, teraz());
  assert.deepEqual(C.sprawdzNowe(z, anulWz), []);
  await dodaj(z, anulWz);
  st = C.zbudujStan(z);
  assert.equal(st.egzemplarze.get(C.kluczEgz('tv', 'Z9')).status, 'magazyn');
  assert.equal(st.dokumenty.get(wz.id).anulowany, true);
});

test('przeniesienie zmienia lokalizację', async () => {
  const z = await baza();
  await dokument(z, { rodzaj: 'BO', data: '2026-11-06', pozycje: [{ modelId: 'cat', ilosc: 300, lok: 'R1' }, { modelId: 'tv', sn: 'Q1', lok: 'R1' }] });
  let st = C.zbudujStan(z);
  await dodaj(z, C.noweZdarzenie(st, 'PRZENIES', 'u1', { modelId: 'cat', ilosc: 100, z: 'R1', do: 'R3', projekt: '' }, teraz()));
  st = C.zbudujStan(z);
  await dodaj(z, C.noweZdarzenie(st, 'PRZENIES', 'u1', { modelId: 'tv', sn: 'Q1', z: 'R1', do: 'R9' }, teraz()));
  st = C.zbudujStan(z);
  const w = C.wierszeMagazynu(st);
  assert.equal(w.find((x) => x.modelId === 'cat' && x.lok === 'R3').ilosc, 100);
  assert.equal(w.find((x) => x.modelId === 'cat' && x.lok === 'R1').ilosc, 200);
  assert.equal(st.egzemplarze.get(C.kluczEgz('tv', 'Q1')).lok, 'R9');
  assert.deepEqual(st.problemy, []);
});

test('kontrola spójności: luki, duplikaty, zmienione pliki, kopie zdarzeń', async () => {
  const z = await baza();
  const a = (await dokument(z, { rodzaj: 'BO', data: '2026-11-06', pozycje: [{ modelId: 'cat', ilosc: 1, lok: 'R1' }] })).ev;
  await dokument(z, { rodzaj: 'BO', data: '2026-11-06', pozycje: [{ modelId: 'cat', ilosc: 1, lok: 'R1' }] });
  await dokument(z, { rodzaj: 'BO', data: '2026-11-06', pozycje: [{ modelId: 'cat', ilosc: 1, lok: 'R1' }] });
  // usuwamy drugi dokument (jakby ktoś skasował plik)
  const bez = z.filter((e) => !(e.typ === 'DOK' && e.dane.nr === 2));
  let st = C.zbudujStan(bez);
  assert.ok(st.problemy.some((p) => p.kod === 'LUKA' && p.opis.includes('BO/2026/0002')));
  // kopia konfliktowa tego samego zdarzenia jest ignorowana
  st = C.zbudujStan(z.concat([Object.assign({}, a)]));
  assert.ok(!st.problemy.some((p) => p.kod === 'KONFLIKT'));
  // plik zmieniony ręcznie
  const zm = z.map((e) => (e === a ? Object.assign({}, e, { _pieczecOk: false }) : e));
  st = C.zbudujStan(zm);
  assert.ok(st.problemy.some((p) => p.kod === 'ZMIENIONY'));
});

test('ścieżki plików i ich rozpoznawanie', async () => {
  const z = await baza();
  const r = await dokument(z, { rodzaj: 'BO', data: '2026-11-06', pozycje: [{ modelId: 'cat', ilosc: 1, lok: 'R1' }] });
  assert.equal(C.sciezkaZdarzenia(r.ev), 'dokumenty/2026/BO-2026-0001.json');
  const p = C.sciezkaZdarzenia(z[0]);
  assert.ok(C.czyPoprawnaNazwaPliku(p), p);
  assert.equal(C.czyPoprawnaNazwaPliku('dokumenty/2026/BO-2026-0001 (1).json'), false);
  assert.equal(C.czyPoprawnaNazwaPliku('dokumenty/2026/BO-2026-0001-LAPTOP.json'), false);
});

test('podpowiedzi i nowe wartości', async () => {
  const z = await baza();
  await dokument(z, { rodzaj: 'BO', data: '2026-11-06', pozycje: [{ modelId: 'cat', ilosc: 1, lok: 'Regał A, półka 2', projekt: 'P-7' }] });
  const st = C.zbudujStan(z);
  const p = C.podpowiedzi(st);
  assert.deepEqual(p.lokalizacje, ['Regał A, półka 2']);
  assert.equal(C.czyNowaWartosc(p.lokalizacje, 'regał a,  półka 2'), false);
  assert.equal(C.czyNowaWartosc(p.lokalizacje, 'Regał B'), true);
});

test('wbudowana biblioteka dostawców: poprawne NIP i REGON, unikalne identyfikatory', () => {
  const id = new Set();
  for (const d of C.DOSTAWCY_WBUDOWANI) {
    assert.ok(C.poprawnyNip(d.nip), d.nazwa + ': NIP ' + d.nip);
    assert.ok(C.poprawnyRegon(d.regon), d.nazwa + ': REGON ' + d.regon);
    assert.match(d.krs, /^\d{10}$/, d.nazwa + ': KRS');
    assert.ok(!id.has(d.dostawcaId));
    id.add(d.dostawcaId);
  }
  assert.ok(C.poprawnyNip('PL 701-111-51-99')); // MAASCK
  assert.ok(!C.poprawnyNip('7011115198'));
  assert.ok(C.poprawnyRegon('523695017'));
  assert.ok(!C.poprawnyRegon('523695018'));
});

test('dostawcy: biblioteka + własne zmiany i nowi dostawcy', async () => {
  const z = await baza();
  let st = C.zbudujStan(z);
  assert.ok(st.dostawcy.get('wb-polsound').wbudowany);
  assert.equal(C.dostawcaWgNazwy(st, 'polsound').nip, '5260307175');
  assert.equal(C.dostawcaWgNazwy(st, 'POLSOUND SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ').dostawcaId, 'wb-polsound');
  await dodaj(z, C.noweZdarzenie(st, 'DOSTAWCA', 'u1', { dostawcaId: 'wb-polsound', tel: '22 000 00 00' }, teraz()));
  st = C.zbudujStan(z);
  await dodaj(z, C.noweZdarzenie(st, 'DOSTAWCA', 'u1', { dostawcaId: 'd-1', nazwa: 'Hurtownia Kabli', nip: '1234563218' }, teraz()));
  await dodaj(z, C.noweZdarzenie(C.zbudujStan(z), 'DOSTAWCA', 'u1', { dostawcaId: 'wb-sony', aktywny: false }, teraz()));
  st = C.zbudujStan(z);
  const p = st.dostawcy.get('wb-polsound');
  assert.equal(p.tel, '22 000 00 00');
  assert.equal(p.nip, '5260307175'); // pozostałe dane z biblioteki zostają
  const pod = C.podpowiedzi(st);
  assert.ok(pod.dostawcy.includes('Hurtownia Kabli'));
  assert.ok(pod.dostawcy.includes('Polsound'));
  assert.ok(!pod.dostawcy.includes('Sony')); // ukryty
  assert.equal(st.problemy.length, 0);
});

test('projekty: numer + nazwa, wyszukiwanie po nazwie, nazwa z dokumentu', async () => {
  const z = await baza();
  let st = C.zbudujStan(z);
  await dodaj(z, C.noweZdarzenie(st, 'PROJEKT', 'u1', { projektId: 'pr1', numer: 'P-2026-014', nazwa: 'Kancelaria Beta – sale konferencyjne', klientNazwa: 'Beta Sp. z o.o.', adres: 'ul. Prosta 2' }, teraz()));
  st = C.zbudujStan(z);
  assert.equal(C.nazwaProjektu(st, ' p-2026-014 '), 'Kancelaria Beta – sale konferencyjne');
  assert.equal(C.opisProjektu(st, 'P-2026-014'), 'P-2026-014 – Kancelaria Beta – sale konferencyjne');
  assert.ok(C.podpowiedzi(st).projekty.includes('P-2026-014'));
  assert.ok(!C.czyNowaWartosc(C.podpowiedzi(st).projekty, 'P-2026-014'));
  // dokument z nazwą projektu spoza rejestru
  const r = await dokument(z, { rodzaj: 'PZ', data: '2026-11-06', dostawca: 'Polsound', projekt: 'P-2026-020', projektNazwa: 'Hotel Gamma', pozycje: [{ modelId: 'tv', sn: 'X1', lok: 'A', projekt: 'P-2026-020' }] });
  assert.ok(r.ev, JSON.stringify(r.bledy));
  st = C.zbudujStan(z);
  assert.equal(C.nazwaProjektu(st, 'P-2026-020'), 'Hotel Gamma');
  const lista = C.listaProjektow(st);
  assert.deepEqual(lista.map((p) => p.numer), ['P-2026-020', 'P-2026-014']);
  assert.equal(lista[0].wRejestrze, false);
  assert.equal(lista[1].klientNazwa, 'Beta Sp. z o.o.');
  // zmiana nazwy w rejestrze wygrywa z nazwą z dokumentu
  await dodaj(z, C.noweZdarzenie(st, 'PROJEKT', 'u1', { projektId: 'pr2', numer: 'P-2026-020', nazwa: 'Hotel Gamma – sala balowa' }, teraz()));
  st = C.zbudujStan(z);
  assert.equal(C.nazwaProjektu(st, 'P-2026-020'), 'Hotel Gamma – sala balowa');
  assert.match(C.opisZdarzenia(st, r.ev), /Hotel Gamma – sala balowa/);
  // wyszukiwanie bez ogonków
  assert.ok(C.pasujeDo('sala bal', C.opisProjektu(st, 'P-2026-020')));
  assert.ok(C.pasujeDo('lomianki', 'ul. Graniczna 19, 05-092 Łomianki'));
  assert.ok(!C.pasujeDo('hotel delta', 'Hotel Gamma'));
  assert.equal(st.problemy.length, 0);
});
