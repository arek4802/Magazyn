"""
Test przeglądarkowy: tryb demo + pełny scenariusz na prawdziwym zapisie plików (prywatny folder przeglądarki, OPFS).
Uruchomienie: python3 test/e2e.py   (wymaga: pip install playwright, Chrome/Chromium)
"""
import http.server, threading, functools, os, sys, pathlib, json
from playwright.sync_api import sync_playwright

KAT = pathlib.Path(__file__).resolve().parent.parent
ZRZUTY = pathlib.Path(os.environ.get('ZRZUTY', '/tmp/magazyn-zrzuty'))
ZRZUTY.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get('CHROME', '/usr/bin/google-chrome')

handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=str(KAT / 'dist'))
http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f'http://127.0.0.1:{srv.server_port}/Magazyn.html'

bledy = []


def nowa_strona(b):
    ctx = b.new_context(viewport={'width': 1400, 'height': 900}, accept_downloads=True)
    p = ctx.new_page()
    p.add_init_script('window.__druk = 0; window.print = () => { window.__druk++; };')
    p.on('pageerror', lambda e: bledy.append('pageerror: ' + str(e)))
    p.on('console', lambda m: bledy.append('console: ' + m.text) if m.type == 'error' else None)
    # natywne okienka (confirm/alert) są blokowane w podglądach plików – aplikacja nie może z nich korzystać
    p.on('dialog', lambda d: (bledy.append('natywne okno: ' + d.message), d.dismiss()))
    return ctx, p


def okno_przycisk(p, tekst):
    p.locator('#modal .okno-stopka button', has_text=tekst).click()


def zapisz_z_pinem(p, pin='1234'):
    p.locator('.stopka-formularza button.glowny').click()
    # ewentualne potwierdzenia (nowe wartości, WZZ)
    for _ in range(3):
        p.wait_for_selector('#modal .okno')
        if p.locator('#modal input[name=pin]').count():
            break
        p.locator('#modal .okno-stopka button.glowny, #modal .okno-stopka button.czerwony').last.click()
    p.fill('#modal input[name=pin]', pin)
    okno_przycisk(p, 'Potwierdź')


with sync_playwright() as pw:
  b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
  try:

      # ---------------------------------------------------------- tryb demo
      ctx, p = nowa_strona(b)
      p.goto(URL)
      p.screenshot(path=ZRZUTY / '00-start.png')
      p.click('text=Wypróbuj na danych przykładowych')
      p.click('.osoba >> text=Jan Kowalski')
      p.wait_for_selector('.kafle')
      p.screenshot(path=ZRZUTY / '01-pulpit.png')
      # wyjście z formularza: pusty – bez pytania, przyciskiem Wróć i przyciskiem przeglądarki
      p.click('nav a[data-w=stan]')
      p.click('.szybkie button:has-text("Przyjęcie")')
      p.wait_for_selector('text=Przyjęcie zewnętrzne (PZ)')
      p.click('text=← Wróć')
      p.wait_for_selector('h1:has-text("Stan magazynu")')
      p.click('.szybkie button:has-text("Przyjęcie")')
      p.go_back()
      p.wait_for_selector('h1:has-text("Stan magazynu")')
      # wypełniony – pyta własnym oknem
      p.click('.szybkie button:has-text("Wydanie")')
      p.fill('[data-f=projekt]', 'P-1')
      p.click('nav a[data-w=dokumenty]')
      p.wait_for_selector('#modal >> text=Porzucić dokument?')
      okno_przycisk(p, 'Wróć')
      assert p.locator('h1:has-text("Wydanie na projekt")').count() == 1
      p.click('nav a[data-w=dokumenty]')
      okno_przycisk(p, 'Porzuć dokument')
      p.wait_for_selector('h1:has-text("Dokumenty")')
      p.go_back()
      p.wait_for_selector('h1:has-text("Stan magazynu")')
      p.click('nav a[data-w=pulpit]')
      for i, w in enumerate(['stan', 'lokalizacje', 'urzadzenia', 'dokumenty', 'uzupelnienia', 'raporty', 'kartoteka', 'klienci', 'dziennik', 'problemy', 'ustawienia', 'pomoc']):
          p.click(f'nav a[data-w={w}]')
          p.wait_for_timeout(150)
          p.screenshot(path=ZRZUTY / f'02-{i:02d}-{w}.png', full_page=False)
      # dymek pomocy po najechaniu na znak zapytania
      p.click('nav a[data-w=stan]')
      p.hover('h1 .pomoc')
      p.wait_for_selector('.dymek.widoczny')
      p.screenshot(path=ZRZUTY / '05-dymek.png')
      p.mouse.move(5, 5)
      # F1 otwiera instrukcję
      p.keyboard.press('F1')
      p.wait_for_selector('.spis')
      # problemy w danych demo powinny być puste
      p.click('nav a[data-w=problemy]')
      assert p.locator('.alert.ok').count() == 1, 'dane demo mają uwagi spójności: ' + p.inner_text('.zawartosc')
      # podgląd WZZ i wydruk
      p.click('nav a[data-w=dokumenty]')
      p.locator('tr.wzz').first.click()
      p.wait_for_selector('#modal .okno')
      p.wait_for_timeout(300)
      p.screenshot(path=ZRZUTY / '03-dokument-wzz.png')
      okno_przycisk(p, 'Drukuj')
      p.wait_for_timeout(200)
      assert p.evaluate('window.__druk') == 1
      p.emulate_media(media='print')
      p.screenshot(path=ZRZUTY / '04-wydruk-wzz.png', full_page=True)
      p.emulate_media(media='screen')
      # eksport do Excela
      p.click('nav a[data-w=stan]')
      with p.expect_download() as dl:
          p.click('text=Eksport do Excela')
      dl.value.save_as(ZRZUTY / 'stan.xlsx')
      ctx.close()

      # ---------------------------------------------------------- prawdziwy zapis (OPFS)
      ctx, p = nowa_strona(b)
      p.goto(URL + '?opfs=1')
      p.wait_for_selector('text=To nowy, pusty folder')
      p.click('text=Dodaj użytkownika')
      p.fill('#modal input[name=imie]', 'Arek')
      p.fill('#modal input[name=nazwisko]', 'Testowy')
      p.fill('#modal input[name=pin]', '4321')
      p.fill('#modal input[name=pin2]', '4321')
      okno_przycisk(p, 'Zapisz')
      p.wait_for_selector('.kafle')

      # bilans otwarcia z nowymi modelami
      p.click('button:has-text("Rozpocznij bilans otwarcia")')
      p.click('text=Nowy model w kartotece')
      p.select_option('#modal select[name=kategoria]', 'Wyświetlacze')
      p.fill('#modal input[name=producent]', 'LG')
      p.fill('#modal input[name=model]', '55UH5N')
      p.fill('#modal input[name=pn]', '55UH5N-E')
      p.fill('#modal input[name=link]', 'www.lg.com/karta-55uh5n.pdf')
      p.screenshot(path=ZRZUTY / '09-nowy-model.png')
      okno_przycisk(p, 'Zapisz model')
      p.wait_for_timeout(100)
      # pierwsza (pusta) pozycja dodana na starcie BO – usuń ją, jeśli jest pusta
      pozycje = p.locator('.pozycja')
      if pozycje.count() > 1:
          p.locator('.pozycja').first.locator('[data-a=usunPoz]').click()
      sn = p.locator('textarea[data-p$=":snTekst"]').first
      sn.fill('LGSN-001\nLGSN-002\nLGSN-003')
      lok = p.locator('[data-p$=":lok"]').first
      lok.fill('Regał A')
      # materiał w metrach ze szpulą
      p.click('text=Nowy model w kartotece')
      p.select_option('#modal select[name=kategoria]', 'Okablowanie')
      p.fill('#modal input[name=producent]', 'Belden')
      p.fill('#modal input[name=model]', 'Cat6A F/UTP')
      p.fill('#modal input[name=jednostkaZakupu]', 'szpula')
      p.fill('#modal input[name=przelicznik]', '500')
      okno_przycisk(p, 'Zapisz model')
      p.wait_for_timeout(100)
      il = p.locator('[data-p$=":ilosc"]').last
      il.fill('2')
      p.locator('select[data-p$=":jedn"]').last.select_option('zakup')
      l2 = p.locator('[data-p$=":lok"]').last
      l2.fill('Regał K')
      p.screenshot(path=ZRZUTY / '10-bo-formularz.png', full_page=True)
      zapisz_z_pinem(p, '4321')
      p.wait_for_selector('text=Zapisano BO/')
      okno_przycisk(p, 'Drukuj formularz')

      # przyjęcie pod projekt
      p.click('.szybkie button:has-text("Przyjęcie")')
      p.fill('[data-f=dostawca]', 'Dystrybutor X')
      p.check('[data-f=podProjekt]')
      p.fill('[data-f=projekt]', 'P-500')
      m = p.locator('[data-model]').first
      m.fill('LG 55UH5N · 55UH5N-E')
      p.wait_for_timeout(100)
      sn = p.locator('textarea[data-p$=":snTekst"]').first
      sn.fill('LGSN-100')
      p.locator('[data-p$=":lok"]').first.fill('Regał B')
      zapisz_z_pinem(p, '4321')
      p.wait_for_selector('text=Zapisano PZ/2026/0001')
      okno_przycisk(p, 'Później')

      # wydanie zastępcze: sprzęt z P-500 na P-600
      p.click('.szybkie button:has-text("Wydanie")')
      p.fill('[data-f=projekt]', 'P-600')
      p.wait_for_timeout(600)
      p.fill('[data-f=klientNazwa]', 'Klient Testowy Sp. z o.o.')
      p.locator('tr:has-text("LGSN-100") button:has-text("Dodaj")').click()
      p.locator('tr:has-text("LGSN-001") button:has-text("Dodaj")').click()
      p.locator('tr:has-text("Cat6A") button:has-text("Dodaj")').click()
      p.locator('.w-ilosc').fill('120')
      assert p.locator('.wzz-alert').count() == 1, 'brak ostrzeżenia WZZ'
      p.fill('[data-f=powod]', 'Pilna wymiana u klienta')
      p.screenshot(path=ZRZUTY / '11-wzz-formularz.png', full_page=True)
      zapisz_z_pinem(p, '4321')
      p.wait_for_selector('text=Zapisano WZZ/2026/0001')
      okno_przycisk(p, 'Drukuj formularz')
      p.emulate_media(media='print')
      p.screenshot(path=ZRZUTY / '12-wydruk-wzz.png', full_page=True)
      p.emulate_media(media='screen')

      # do uzupełnienia
      p.click('nav a[data-w=uzupelnienia]')
      assert p.locator('text=do uzupełnienia').count() >= 1
      p.screenshot(path=ZRZUTY / '13-uzupelnienia.png')

      # zwrot kabla
      p.click('.szybkie button:has-text("Zwrot")')
      p.fill('[data-f=projekt]', 'P-600')
      p.wait_for_timeout(600)
      p.locator('tr:has-text("Cat6A") button:has-text("Dodaj")').click()
      p.locator('[data-p="0:ilosc"]').fill('20')
      p.locator('[data-p="0:lok"]').fill('Regał K')
      zapisz_z_pinem(p, '4321')
      p.wait_for_selector('text=Zapisano ZW/2026/0001')
      okno_przycisk(p, 'Później')

      # zły PIN jest odrzucany
      p.click('.szybkie button:has-text("Zwrot")')
      p.fill('[data-f=projekt]', 'P-600')
      p.wait_for_timeout(600)
      p.locator('tr:has-text("LGSN-001") button:has-text("Dodaj")').click()
      p.locator('[data-p="0:lok"]').fill('Regał A')
      p.locator('.stopka-formularza button.glowny').click()
      p.fill('#modal input[name=pin]', '0000')
      okno_przycisk(p, 'Potwierdź')
      assert p.locator('text=Nieprawidłowy PIN').count() == 1
      okno_przycisk(p, 'Wróć')
      p.click('.stopka-formularza >> text=Porzuć')
      okno_przycisk(p, 'Porzuć dokument')
      p.wait_for_selector('.kafle, h1')

      # stan po operacjach
      stan = p.evaluate('''() => { const A = window.MagazynApp.app, C = window.MagazynCore;
        return { problemy: A.st.problemy, stany: C.stanyModeli(A.st).map(w => [w.model.model, w.wolne, w.podProjekt, w.wydane]), pliki: A.zdarzenia.map(e => e._plik) }; }''')
      print(json.dumps(stan, ensure_ascii=False, indent=1))
      assert stan['problemy'] == [], stan['problemy']
      st = {m: (w, pp, wy) for m, w, pp, wy in stan['stany']}
      assert st['55UH5N'] == (2, 0, 2), st
      assert st['Cat6A F/UTP'] == (900, 0, 100), st

      # odświeżenie strony = ponowny odczyt plików z folderu
      p.goto(URL + '?opfs=1')
      p.click('.osoba >> text=Arek Testowy')
      p.wait_for_selector('.kafle')
      p.screenshot(path=ZRZUTY / '14-pulpit-po-odczycie.png')
      p.click('nav a[data-w=problemy]')
      assert p.locator('.alert.ok').count() == 1, p.inner_text('.zawartosc')
      p.click('nav a[data-w=kartoteka]')
      assert p.locator('.karta-btn.z-tekstem').count() == 1, 'brak przycisku karty katalogowej'
      ctx.route('https://www.lg.com/**', lambda r: r.fulfill(body='karta', content_type='text/plain'))
      with p.expect_popup() as okno:
          p.locator('.karta-btn.z-tekstem').click()
      assert okno.value.url.startswith('https://www.lg.com/'), okno.value.url
      okno.value.close()
      p.click('nav a[data-w=dziennik]')
      p.screenshot(path=ZRZUTY / '15-dziennik.png')
      with p.expect_download() as dl:
          p.click('text=Eksport do Excela')
      dl.value.save_as(ZRZUTY / 'dziennik.xlsx')
      ctx.close()
      b.close()

  except Exception:
    import traceback; traceback.print_exc()
    for pg in [c for c in b.contexts for c in c.pages]:
      pg.screenshot(path=ZRZUTY / 'BLAD.png', full_page=True)
      print('BLEDY', bledy)
    sys.exit(2)

srv.shutdown()
krytyczne = [x for x in bledy if 'favicon' not in x]
print('BŁĘDY KONSOLI:', krytyczne if krytyczne else 'brak')
sys.exit(1 if krytyczne else 0)
