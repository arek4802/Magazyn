/*
 * Dane przykładowe do trybu demonstracyjnego (nic nie jest zapisywane na dysku).
 */
(function (root) {
  'use strict';
  const C = root.MagazynCore;

  async function przygotujDemo(store) {
    const zdarzenia = [];
    let zegar = Date.now() - 1000 * 60 * 60 * 24 * 20; // 20 dni temu
    const krok = (godzin) => new Date((zegar += godzin * 3600 * 1000));
    const stan = () => C.zbudujStan(zdarzenia);

    async function dodaj(ev) {
      await C.zapieczetuj(ev);
      await store.zapisz(C.sciezkaZdarzenia(ev), JSON.stringify(ev, null, 2));
      zdarzenia.push(ev);
      return ev;
    }

    async function uzytkownik(userId, imie, nazwisko, email) {
      const pin = await C.noweDanePinu('1234');
      return dodaj(C.noweZdarzenie(stan(), 'UZYTK', userId, Object.assign({ userId, imie, nazwisko, email, tel: '', aktywny: true }, pin), krok(0.1)));
    }

    await uzytkownik('jkowalski', 'Jan', 'Kowalski', 'jan.kowalski@example.com');
    await uzytkownik('anowak', 'Anna', 'Nowak', 'anna.nowak@example.com');

    const modele = [
      { modelId: 'm-qm55', kategoria: 'Wyświetlacze', producent: 'Samsung', model: 'QM55C', pn: 'LH55QMCEBGCXEN', seryjny: true, jednostka: 'szt', stanMin: 1, status: 'aktywny' },
      { modelId: 'm-qm75', kategoria: 'Wyświetlacze', producent: 'Samsung', model: 'QM75B', pn: 'LH75QMBEBGCXEN', seryjny: true, jednostka: 'szt', stanMin: 0, status: 'EOL' },
      { modelId: 'm-mxa', kategoria: 'Mikrofony', producent: 'Shure', model: 'MXA920', pn: 'MXA920W-S', seryjny: true, jednostka: 'szt', stanMin: 0, status: 'aktywny', link: 'https://www.shure.com/' },
      { modelId: 'm-tesira', kategoria: 'DSP i sterowanie', producent: 'Biamp', model: 'TesiraFORTÉ X 400', pn: '911.0400.900', seryjny: true, jednostka: 'szt', stanMin: 1, status: 'aktywny', link: 'https://www.biamp.com/' },
      { modelId: 'm-a40', kategoria: 'Wideokonferencje', producent: 'Yealink', model: 'MeetingBar A40', pn: 'A40-020', seryjny: true, jednostka: 'szt', stanMin: 1, status: 'aktywny' },
      { modelId: 'm-cat6', kategoria: 'Okablowanie', producent: 'Belden', model: 'Kabel Cat6 U/UTP LSZH', pn: '7965ELS', seryjny: false, jednostka: 'm', jednostkaZakupu: 'szpula', przelicznik: 305, stanMin: 305, status: 'aktywny' },
      { modelId: 'm-hdmi3', kategoria: 'Okablowanie', producent: 'Kramer', model: 'Kabel HDMI 2.1 3 m', pn: 'C-HM/HM/A-3', seryjny: false, jednostka: 'szt', stanMin: 10, status: 'aktywny' },
      { modelId: 'm-kor40', kategoria: 'Korytka i osłony kabli', producent: 'Kopos', model: 'Korytko PVC 40×40', pn: 'LV 40X40', seryjny: false, jednostka: 'm', stanMin: 20, status: 'aktywny' },
      { modelId: 'm-uchwyt', kategoria: 'Uchwyty i montaż', producent: "Vogel's", model: 'Uchwyt ścienny WALL 3345', pn: '8343450', seryjny: false, jednostka: 'szt', stanMin: 2, status: 'aktywny' },
    ];
    for (const m of modele) await dodaj(C.noweZdarzenie(stan(), 'MODEL', 'jkowalski', m, krok(0.05)));

    await dodaj(C.noweZdarzenie(stan(), 'KLIENT', 'jkowalski', { klientId: 'k-alfa', nazwa: 'Alfa Nieruchomości Sp. z o.o.', nip: '5250000000', adres: 'ul. Przykładowa 1, 00-001 Warszawa', kontakt: 'Piotr Zieliński', tel: '600 000 000', email: '' }, krok(0.1)));
    await dodaj(C.noweZdarzenie(stan(), 'KLIENT', 'jkowalski', { klientId: 'k-szkola', nazwa: 'Szkoła Podstawowa nr 100', nip: '', adres: 'ul. Szkolna 5, 00-002 Warszawa', kontakt: '', tel: '', email: '' }, krok(0.1)));

    const projekty = [
      { projektId: 'pr-011', numer: 'P-2026-011', nazwa: 'SP 100 – modernizacja sal lekcyjnych', klientNazwa: 'Szkoła Podstawowa nr 100', adres: 'ul. Szkolna 5, 00-002 Warszawa', status: 'w toku', uwagi: '' },
      { projektId: 'pr-012', numer: 'P-2026-012', nazwa: 'Alfa – biuro na 4. piętrze', klientNazwa: 'Alfa Nieruchomości Sp. z o.o.', adres: 'ul. Przykładowa 1, piętro 4', status: 'w toku', uwagi: '' },
      { projektId: 'pr-014', numer: 'P-2026-014', nazwa: 'Kancelaria Beta – sale konferencyjne', klientNazwa: 'Alfa Nieruchomości Sp. z o.o.', adres: 'ul. Przykładowa 1, sale 2.10–2.12', status: 'w toku', uwagi: 'Sala zarządu + dwie sale spotkań' },
      { projektId: 'pr-007', numer: 'P-2026-007', nazwa: 'Hotel Gamma – sala balowa', klientNazwa: '', adres: '', status: 'zakończony', uwagi: '' },
    ];
    for (const pr of projekty) await dodaj(C.noweZdarzenie(stan(), 'PROJEKT', 'jkowalski', pr, krok(0.05)));

    async function dok(autor, dane, godzin) {
      const st = stan();
      const ev = C.przygotujDokument(st, autor, dane, krok(godzin));
      ev.seq = (st.seqMax.get(autor) || 0) + 1;
      return dodaj(ev);
    }

    const dzien = () => new Date(zegar).toISOString().slice(0, 10);

    await dok('jkowalski', { rodzaj: 'BO', data: dzien(), osoba: 'Jan Kowalski', uwagi: 'Inwentaryzacja startowa', pozycje: [
      { modelId: 'm-qm55', sn: '0PYK3HBW500123', lok: 'Regał A, półka 1', stanTech: 'nowy' },
      { modelId: 'm-qm75', sn: '0QLN3HAR300045', lok: 'Regał A, półka 2', stanTech: 'używany' },
      { modelId: 'm-tesira', sn: 'TFX4-22-01987', lok: 'Regał B, półka 1', stanTech: 'nowy' },
      { modelId: 'm-cat6', ilosc: 450, lok: 'Regał K (kable)' },
      { modelId: 'm-hdmi3', ilosc: 14, lok: 'Regał K (kable)' },
      { modelId: 'm-kor40', ilosc: 36, lok: 'Antresola' },
      { modelId: 'm-uchwyt', ilosc: 3, lok: 'Regał C' },
    ] }, 24);

    await dok('anowak', { rodzaj: 'PZ', data: dzien(), dostawca: 'Polsound', dostawcaId: 'wb-polsound', dostawcaDane: { pelnaNazwa: 'POLSOUND SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', nip: '5260307175', adres: 'ul. Graniczna 17, 05-092 Łomianki' }, nrFaktury: 'FV/2026/11/0815', projekt: 'P-2026-014', projektNazwa: 'Kancelaria Beta – sale konferencyjne', osoba: 'Anna Nowak', pozycje: [
      { modelId: 'm-qm55', sn: '0PYK3HBW500201', lok: 'Regał A, półka 1', projekt: 'P-2026-014', stanTech: 'nowy' },
      { modelId: 'm-qm55', sn: '0PYK3HBW500202', lok: 'Regał A, półka 1', projekt: 'P-2026-014', stanTech: 'nowy' },
      { modelId: 'm-mxa', sn: 'MXA9-4410337', lok: 'Regał B, półka 2', projekt: 'P-2026-014', stanTech: 'nowy' },
      { modelId: 'm-a40', sn: '8040A0217AB1', lok: 'Regał B, półka 2', projekt: 'P-2026-014', stanTech: 'nowy' },
      { modelId: 'm-cat6', ilosc: 610, lok: 'Regał K (kable)', projekt: 'P-2026-014' },
    ] }, 48);

    await dok('jkowalski', { rodzaj: 'WZ', data: dzien(), projekt: 'P-2026-011', projektNazwa: 'SP 100 – modernizacja sal lekcyjnych', klientNazwa: 'Szkoła Podstawowa nr 100', klientAdres: 'ul. Szkolna 5, 00-002 Warszawa', adres: 'ul. Szkolna 5, sala A01.01', osoba: 'Marek Wiśniewski (technik)', pozycje: [
      { modelId: 'm-tesira', sn: 'TFX4-22-01987', ilosc: 1, lok: 'Regał B, półka 1', projektZakupu: '' },
      { modelId: 'm-cat6', ilosc: 180, lok: 'Regał K (kable)', projektZakupu: '' },
      { modelId: 'm-hdmi3', ilosc: 6, lok: 'Regał K (kable)', projektZakupu: '' },
      { modelId: 'm-kor40', ilosc: 24, lok: 'Antresola', projektZakupu: '' },
    ] }, 30);

    await dok('anowak', { rodzaj: 'WZZ', data: dzien(), projekt: 'P-2026-012', projektNazwa: 'Alfa – biuro na 4. piętrze', klientNazwa: 'Alfa Nieruchomości Sp. z o.o.', klientNip: '5250000000', klientAdres: 'ul. Przykładowa 1, 00-001 Warszawa', adres: 'ul. Przykładowa 1, piętro 4', osoba: 'Marek Wiśniewski (technik)', powod: 'Uszkodzony ekran u klienta, wymiana od ręki', pozycje: [
      { modelId: 'm-qm55', sn: '0PYK3HBW500202', ilosc: 1, lok: 'Regał A, półka 1', projektZakupu: 'P-2026-014' },
    ] }, 20);

    const wz = zdarzenia.find((e) => e.typ === 'DOK' && e.dane.rodzaj === 'WZ');
    await dodaj(C.noweZdarzenie(stan(), 'SKAN', 'jkowalski', { docId: wz.id, numer: wz.dane.numer, plik: 'podpisane/demo/WZ-skan.pdf' }, krok(2)));
    await store.zapisz('podpisane/demo/WZ-skan.pdf', new Blob(['Przykładowy skan (tryb demo)'], { type: 'text/plain' }));

    await dok('jkowalski', { rodzaj: 'ZW', data: dzien(), projekt: 'P-2026-011', projektNazwa: 'SP 100 – modernizacja sal lekcyjnych', osoba: 'Marek Wiśniewski (technik)', uwagi: 'Nadwyżka kabla po montażu', pozycje: [
      { modelId: 'm-cat6', ilosc: 42.5, lok: 'Regał K (kable)' },
    ] }, 26);

    await dodaj(C.noweZdarzenie(stan(), 'PRZENIES', 'anowak', { modelId: 'm-uchwyt', ilosc: 1, z: 'Regał C', do: 'Regał C, dół', projekt: '' }, krok(3)));
    return zdarzenia;
  }

  root.MagazynDemo = { przygotujDemo };
})(typeof self !== 'undefined' ? self : this);
