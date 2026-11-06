/*
 * Magazyn AV – zapis i odczyt plików.
 * FolderStore: wskazany folder (np. zsynchronizowany OneDrive) przez File System Access API (Edge, Chrome).
 * MemoryStore: dane w pamięci (tryb demonstracyjny, testy).
 */
(function (root) {
  'use strict';
  const C = root.MagazynCore;

  function podziel(sciezka) {
    const cz = sciezka.split('/').filter(Boolean);
    return { katalog: cz.slice(0, -1), nazwa: cz[cz.length - 1] };
  }

  async function poKolei(elementy, ile, fn) {
    const wynik = [];
    for (let i = 0; i < elementy.length; i += ile) {
      wynik.push(...(await Promise.all(elementy.slice(i, i + ile).map(fn))));
    }
    return wynik;
  }

  async function przetworzPliki(pliki) {
    // pliki: [{sciezka, tekst}]
    const zdarzenia = [];
    const dziwne = [];
    for (const p of pliki) {
      if (!C.czyPoprawnaNazwaPliku(p.sciezka)) dziwne.push(p.sciezka);
      let ev;
      try {
        ev = JSON.parse(p.tekst);
      } catch (e) {
        zdarzenia.push({ _plik: p.sciezka, _uszkodzony: true });
        continue;
      }
      ev._plik = p.sciezka;
      ev._pieczecOk = await C.sprawdzPieczec(ev);
      zdarzenia.push(ev);
    }
    return { zdarzenia, dziwne };
  }

  class FolderStore {
    constructor(uchwyt) {
      this.uchwyt = uchwyt;
      this.nazwa = uchwyt.name || 'folder';
      this.rodzaj = 'folder';
    }

    async maUprawnienia(zapytaj) {
      if (typeof this.uchwyt.queryPermission !== 'function') return true;
      const opcje = { mode: 'readwrite' };
      if ((await this.uchwyt.queryPermission(opcje)) === 'granted') return true;
      if (!zapytaj) return false;
      return (await this.uchwyt.requestPermission(opcje)) === 'granted';
    }

    async _katalog(czesci, utworz) {
      let d = this.uchwyt;
      for (const c of czesci) d = await d.getDirectoryHandle(c, { create: !!utworz });
      return d;
    }

    async _przejdz(katalog, prefiks, wynik) {
      for await (const [nazwa, h] of katalog.entries()) {
        if (h.kind === 'directory') await this._przejdz(h, prefiks + nazwa + '/', wynik);
        else if (nazwa.toLowerCase().endsWith('.json')) wynik.push({ sciezka: prefiks + nazwa, h });
      }
    }

    async wczytajWszystko() {
      const lista = [];
      for (const gl of ['dokumenty', 'zdarzenia']) {
        let k;
        try {
          k = await this.uchwyt.getDirectoryHandle(gl);
        } catch (e) {
          continue;
        }
        await this._przejdz(k, gl + '/', lista);
      }
      const pliki = await poKolei(lista, 40, async (p) => ({ sciezka: p.sciezka, tekst: await (await p.h.getFile()).text() }));
      return przetworzPliki(pliki);
    }

    async istnieje(sciezka) {
      const { katalog, nazwa } = podziel(sciezka);
      try {
        const d = await this._katalog(katalog, false);
        await d.getFileHandle(nazwa);
        return true;
      } catch (e) {
        return false;
      }
    }

    async zapisz(sciezka, tresc, opcje = {}) {
      const { katalog, nazwa } = podziel(sciezka);
      const d = await this._katalog(katalog, true);
      if (opcje.nieNadpisuj) {
        let jest = false;
        try {
          await d.getFileHandle(nazwa);
          jest = true;
        } catch (e) { /* brak pliku – dobrze */ }
        if (jest) {
          const err = new Error('Plik już istnieje: ' + sciezka);
          err.kod = 'ISTNIEJE';
          throw err;
        }
      }
      const fh = await d.getFileHandle(nazwa, { create: true });
      const w = await fh.createWritable();
      await w.write(tresc);
      await w.close();
    }

    async czytaj(sciezka) {
      const { katalog, nazwa } = podziel(sciezka);
      const d = await this._katalog(katalog, false);
      return (await d.getFileHandle(nazwa)).getFile();
    }

    async lista(sciezka) {
      try {
        const d = await this._katalog(sciezka.split('/').filter(Boolean), false);
        const nazwy = [];
        for await (const [n] of d.entries()) nazwy.push(n);
        return nazwy;
      } catch (e) {
        return [];
      }
    }
  }

  class MemoryStore {
    constructor(nazwa) {
      this.pliki = new Map();
      this.nazwa = nazwa || 'pamięć';
      this.rodzaj = 'pamiec';
    }
    async maUprawnienia() { return true; }
    async wczytajWszystko() {
      const pliki = [];
      for (const [sciezka, tresc] of this.pliki) {
        if ((sciezka.startsWith('dokumenty/') || sciezka.startsWith('zdarzenia/')) && sciezka.endsWith('.json')) pliki.push({ sciezka, tekst: tresc });
      }
      return przetworzPliki(pliki);
    }
    async istnieje(sciezka) { return this.pliki.has(sciezka); }
    async zapisz(sciezka, tresc, opcje = {}) {
      if (opcje.nieNadpisuj && this.pliki.has(sciezka)) {
        const err = new Error('Plik już istnieje: ' + sciezka);
        err.kod = 'ISTNIEJE';
        throw err;
      }
      this.pliki.set(sciezka, tresc);
    }
    async czytaj(sciezka) {
      const t = this.pliki.get(sciezka);
      if (t === undefined) throw new Error('Brak pliku ' + sciezka);
      return t instanceof Blob ? t : new Blob([t]);
    }
    async lista(sciezka) {
      const pref = sciezka.replace(/\/?$/, '/');
      const nazwy = new Set();
      for (const k of this.pliki.keys()) if (k.startsWith(pref)) nazwy.add(k.slice(pref.length).split('/')[0]);
      return Array.from(nazwy);
    }
  }

  // ------------------------------------------------ zapamiętanie folderu (IndexedDB)

  function idb() {
    return new Promise((ok, zle) => {
      const r = indexedDB.open('magazyn-av', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('ustawienia');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => zle(r.error);
    });
  }

  async function zapamietaj(klucz, wartosc) {
    try {
      const db = await idb();
      await new Promise((ok, zle) => {
        const tx = db.transaction('ustawienia', 'readwrite');
        tx.objectStore('ustawienia').put(wartosc, klucz);
        tx.oncomplete = ok;
        tx.onerror = () => zle(tx.error);
      });
    } catch (e) { /* brak IndexedDB – trudno */ }
  }

  async function przypomnij(klucz) {
    try {
      const db = await idb();
      return await new Promise((ok, zle) => {
        const tx = db.transaction('ustawienia', 'readonly');
        const r = tx.objectStore('ustawienia').get(klucz);
        r.onsuccess = () => ok(r.result);
        r.onerror = () => zle(r.error);
      });
    } catch (e) {
      return undefined;
    }
  }

  root.MagazynStorage = { FolderStore, MemoryStore, zapamietaj, przypomnij };
})(typeof self !== 'undefined' ? self : this);
