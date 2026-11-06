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


def zapisz_z_pinem(p, pin='1234', nazwa_projektu='Projekt testowy'):
    p.locator('.stopka-formularza button.glowny').click()
    # ewentualne potwierdzenia (nowe wartości, nowy projekt, WZZ)
    for _ in range(4):
        p.wait_for_selector('#modal .okno')
        if p.locator('#modal input[name=pin]').count():
            break
        if p.locator('#modal input[name=nazwa]').count():  # nowy projekt – podaj nazwę
            p.fill('#modal input[name=nazwa]', nazwa_projektu)
            okno_przycisk(p, 'Zapisz projekt')
            p.wait_for_timeout(100)
            continue
        p.locator('#modal .okno-stopka button.glowny, #modal .okno-stopka button.czerwony').last.click()
        p.wait_for_timeout(100)
    p.fill('#modal input[name=pin]', pin)
    okno_przycisk(p, 'Potwierdź')


def zaloguj(p, kto, pin):
    p.click(f'.osoba >> text={kto}')
    p.wait_for_selector('#modal input[name=pin]')
    p.fill('#modal input[name=pin]', pin)
    okno_przycisk(p, 'Zaloguj')


def wybierz(p, selektor, tekst):
    """Pisze w polu z listą i zatwierdza pierwszą pasującą pozycję Enterem."""
    pole = p.locator(selektor)
    pole.click()
    pole.fill('')
    pole.type(tekst, delay=10)
    p.wait_for_selector('.lista-wyboru:not([hidden])')
    p.keyboard.press('Enter')
    p.wait_for_timeout(150)


with sync_playwright() as pw:
  b = pw.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
  try:

      # ---------------------------------------------------------- tryb demo
      ctx, p = nowa_strona(b)
      p.goto(URL)
      p.screenshot(path=ZRZUTY / '00-start.png')
      p.click('text=Wypróbuj na danych przykładowych')
      # logowanie wymaga PIN-u
      p.click('.osoba >> text=Jan Kowalski')
      p.fill('#modal input[name=pin]', '9999')
      okno_przycisk(p, 'Zaloguj')
      p.wait_for_selector('#modal >> text=Nieprawidłowy PIN')
      assert p.locator('.kafle').count() == 0
      p.fill('#modal input[name=pin]', '1234')
      okno_przycisk(p, 'Zaloguj')
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
      for i, w in enumerate(['stan', 'lokalizacje', 'urzadzenia', 'dokumenty', 'uzupelnienia', 'raporty', 'projekty', 'kartoteka', 'klienci', 'dostawcy', 'dziennik', 'problemy', 'ustawienia', 'pomoc']):
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
      # projekt po nazwie: w dokumentach, w rejestrze i w raporcie
      p.click('nav a[data-w=dokumenty]')
      p.fill('[data-filtr=dok]', 'modernizacja sal')
      p.wait_for_timeout(400)
      assert p.locator('.zawartosc tbody tr').count() == 2, p.inner_text('.zawartosc')
      p.fill('[data-filtr=dok]', '')
      p.wait_for_timeout(400)
      # sortowanie po kliknięciu w nagłówek: rosnąco → malejąco → domyślnie, zapamiętane po przeładowaniu
      kol = lambda n: p.eval_on_selector_all('.zawartosc table.tabela tbody tr', f'rs => rs.map(r => r.cells[{n}].innerText.trim())')
      domyslnie = kol(0)
      p.click('th button:has-text("Data")')
      daty = kol(2)
      assert [d[6:] + d[3:5] + d[:2] for d in daty] == sorted(d[6:] + d[3:5] + d[:2] for d in daty), daty
      assert p.get_attribute('th[aria-sort]', 'aria-sort') == 'ascending'
      p.click('th button:has-text("Data")')
      assert kol(2) == daty[::-1]
      p.click('nav a[data-w=stan]')
      p.click('th button:has-text("Wolne")')
      wolne = [float(x.split()[0].replace(',', '.')) for x in kol(3)]
      assert wolne == sorted(wolne), wolne
      p.click('nav a[data-w=dokumenty]')
      assert kol(2) == daty[::-1], 'sortowanie powinno zostać zapamiętane'
      p.click('th button:has-text("Data")')
      assert kol(0) == domyslnie and p.locator('th[aria-sort]').count() == 0
      p.click('nav a[data-w=stan]')
      p.click('th button:has-text("Wolne")')
      p.click('th button:has-text("Wolne")')
      p.click('nav a[data-w=projekty]')
      assert p.locator('text=Hotel Gamma').count() == 0, 'zakończony projekt powinien być schowany'
      p.locator('tr:has-text("P-2026-014")').click()
      p.wait_for_selector('#modal >> text=Kancelaria Beta – sale konferencyjne')
      p.screenshot(path=ZRZUTY / '06-projekt.png')
      okno_przycisk(p, 'Wydaj na ten projekt')
      p.wait_for_selector('h1:has-text("Wydanie na projekt")')
      assert p.locator('[data-f=projekt]').input_value() == 'P-2026-014'
      assert p.locator('[data-f=klientNazwa]').input_value() == 'Alfa Nieruchomości Sp. z o.o.'
      p.click('text=← Wróć')  # nic nie zmieniono – bez pytania
      p.wait_for_selector('h1:has-text("Projekty")')
      p.click('nav a[data-w=raporty]')
      wybierz(p, '[data-filtr=rap_projekt]', 'sal lek')
      p.wait_for_timeout(500)
      assert p.locator('[data-filtr=rap_projekt]').input_value() == 'P-2026-011'
      assert 'SP 100 – modernizacja sal lekcyjnych' in p.inner_text('.zawartosc')
      # wydanie: projekt wybrany po nazwie, klient i adres z rejestru
      p.click('.szybkie button:has-text("Wydanie")')
      wybierz(p, '[data-f=projekt]', 'kancel')
      assert p.locator('[data-f=projekt]').input_value() == 'P-2026-014'
      assert p.locator('[data-f=adres]').input_value().startswith('ul. Przykładowa 1')
      assert 'Kancelaria Beta' in p.inner_text('.opis-wyboru >> nth=0')
      p.screenshot(path=ZRZUTY / '07-wydanie-projekt.png')
      p.click('.stopka-formularza >> text=Porzuć')
      okno_przycisk(p, 'Porzuć dokument')
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
      p.click('button:has-text("Dodaj pierwszego użytkownika")')
      p.fill('#modal input[name=imie]', 'Arek')
      p.fill('#modal input[name=nazwisko]', 'Testowy')
      p.fill('#modal input[name=pin]', '4321')
      p.fill('#modal input[name=pin2]', '4321')
      okno_przycisk(p, 'Dodaj użytkownika')
      p.wait_for_selector('#modal >> text=zbyt prosty')  # kolejne cyfry
      p.fill('#modal input[name=pin]', '4826')
      p.fill('#modal input[name=pin2]', '4826')
      okno_przycisk(p, 'Dodaj użytkownika')
      p.wait_for_selector('.kafle')

      # bilans otwarcia z nowymi modelami
      p.click('button:has-text("Rozpocznij bilans otwarcia")')
      p.click('button:has-text("Nowe urządzenie w bibliotece")')
      p.select_option('#modal select[name=kategoria]', 'Wyświetlacze')
      p.fill('#modal input[name=producent]', 'LG')
      p.fill('#modal input[name=model]', '55UH5N')
      p.fill('#modal input[name=pn]', '55UH5N-E')
      p.fill('#modal input[name=link]', 'www.lg.com/pl/monitory-55uh5n')
      p.fill('#modal input[name=kartaLink]', 'www.lg.com/karta-55uh5n.pdf')
      p.screenshot(path=ZRZUTY / '09-nowy-model.png')
      okno_przycisk(p, 'Zapisz')
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
      p.click('button:has-text("Nowe urządzenie w bibliotece")')
      p.select_option('#modal select[name=kategoria]', 'Okablowanie')
      p.fill('#modal input[name=producent]', 'Belden')
      p.fill('#modal input[name=model]', 'Cat6A F/UTP')
      p.check('#modal input[name=opak]')
      p.fill('#modal input[name=jednostkaZakupu]', 'szpula')
      p.fill('#modal input[name=przelicznik]', '500')
      p.fill('#modal input[name=link]', 'www.belden.com/datasheet-cat6a.pdf')  # PDF wklejony jako strona → zapisze się jako karta
      okno_przycisk(p, 'Zapisz')
      p.wait_for_timeout(100)
      il = p.locator('[data-p$=":ilosc"]').last
      il.fill('2')
      p.locator('select[data-p$=":jedn"]').last.select_option('zakup')
      l2 = p.locator('[data-p$=":lok"]').last
      l2.fill('Regał K')
      p.screenshot(path=ZRZUTY / '10-bo-formularz.png', full_page=True)
      zapisz_z_pinem(p, '4826')
      p.wait_for_selector('text=Zapisano BO/')
      okno_przycisk(p, 'Drukuj formularz')

      # przyjęcie pod projekt
      p.click('.szybkie button:has-text("Przyjęcie")')
      wybierz(p, '[data-f=dostawca]', 'shure')  # po marce
      assert p.locator('[data-f=dostawca]').input_value() == 'Polsound'
      assert '5260307175' in p.inner_text('.opis-wyboru >> nth=0')
      p.check('[data-f=podProjekt]')
      p.locator('.pole-projekt button:has-text("Nowy")').click()
      p.fill('#modal input[name=numer]', 'P-500')
      p.fill('#modal input[name=nazwa]', 'Biuro testowe – sala A')
      okno_przycisk(p, 'Zapisz projekt')
      p.wait_for_timeout(150)
      assert p.locator('[data-f=projekt]').input_value() == 'P-500'
      wybierz(p, '[data-model]', 'uh5n')
      assert p.locator('[data-model]').first.input_value().startswith('LG 55UH5N')
      assert p.evaluate('document.activeElement.dataset.p') == '0:lok', 'po wyborze modelu kursor powinien przejść do lokalizacji'
      sn = p.locator('textarea[data-p$=":snTekst"]').first
      sn.fill('LGSN-100')
      p.locator('[data-p$=":lok"]').first.fill('Regał B')
      zapisz_z_pinem(p, '4826')
      p.wait_for_selector('text=Zapisano PZ/2026/0001')
      okno_przycisk(p, 'Później')

      # wydanie zastępcze: sprzęt z P-500 na P-600
      p.click('.szybkie button:has-text("Wydanie")')
      wybierz(p, '[data-f=projekt]', 'P-600')  # nie ma na liście → okno nowego projektu
      p.wait_for_selector('#modal input[name=nazwa]')
      assert p.locator('#modal input[name=numer]').input_value() == 'P-600'
      p.fill('#modal input[name=nazwa]', 'Klient Testowy – serwerownia')
      p.fill('#modal input[name=klientNazwa]', 'Klient Testowy Sp. z o.o.')
      p.keyboard.press('Escape')  # zamyka listę, nie okno
      assert p.locator('#modal .okno').count() == 1
      p.fill('#modal input[name=adres]', 'ul. Testowa 1, Warszawa')
      p.keyboard.press('Escape')
      okno_przycisk(p, 'Zapisz projekt')
      p.wait_for_timeout(200)
      assert p.locator('[data-f=projekt]').input_value() == 'P-600'
      assert p.locator('[data-f=klientNazwa]').input_value() == 'Klient Testowy Sp. z o.o.'
      assert p.locator('[data-f=adres]').input_value() == 'ul. Testowa 1, Warszawa'
      p.locator('tr:has-text("LGSN-100") button:has-text("Dodaj")').click()
      p.locator('tr:has-text("LGSN-001") button:has-text("Dodaj")').click()
      p.locator('tr:has-text("Cat6A") button:has-text("Dodaj")').click()
      p.locator('.w-ilosc').fill('120')
      assert p.locator('.wzz-alert').count() == 1, 'brak ostrzeżenia WZZ'
      p.fill('[data-f=powod]', 'Pilna wymiana u klienta')
      p.screenshot(path=ZRZUTY / '11-wzz-formularz.png', full_page=True)
      zapisz_z_pinem(p, '4826')
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
      wybierz(p, '[data-f=projekt]', 'serwerow')
      p.wait_for_selector('h3:has-text("Wydane na projekt P-600 – Klient Testowy – serwerownia")')
      p.locator('tr:has-text("Cat6A") button:has-text("Dodaj")').click()
      p.locator('[data-p="0:ilosc"]').fill('20')
      p.locator('[data-p="0:lok"]').fill('Regał K')
      zapisz_z_pinem(p, '4826')
      p.wait_for_selector('text=Zapisano ZW/2026/0001')
      okno_przycisk(p, 'Później')

      # zły PIN jest odrzucany
      p.click('.szybkie button:has-text("Zwrot")')
      p.fill('[data-f=projekt]', 'P-600')
      p.keyboard.press('Tab')  # wyjście z pola też pokazuje listę wydanego sprzętu
      p.wait_for_selector('tr:has-text("LGSN-001") button:has-text("Dodaj")')
      p.locator('tr:has-text("LGSN-001") button:has-text("Dodaj")').click()
      p.locator('[data-p="0:lok"]').fill('Regał A')
      p.locator('.stopka-formularza button.glowny').click()
      p.fill('#modal input[name=pin]', '0000')
      okno_przycisk(p, 'Potwierdź')
      p.wait_for_selector('#modal >> text=Nieprawidłowy PIN')
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
      projekty = p.evaluate('() => window.MagazynCore.listaProjektow(window.MagazynApp.app.st).map(x => [x.numer, x.nazwa, x.klientNazwa])')
      assert ['P-600', 'Klient Testowy – serwerownia', 'Klient Testowy Sp. z o.o.'] in projekty, projekty
      assert ['P-500', 'Biuro testowe – sala A', ''] in projekty, projekty
      pz = p.evaluate('() => [...window.MagazynApp.app.st.dokumenty.values()].map(d => d.ev.dane).find(d => d.rodzaj === "PZ")')
      assert pz['dostawcaId'] == 'wb-polsound' and pz['dostawcaDane']['nip'] == '5260307175' and pz['projektNazwa'] == 'Biuro testowe – sala A', pz

      # blokada ekranu ręczna: szkic czeka, zły PIN odrzucony
      p.click('.szybkie button:has-text("Wydanie")')
      wybierz(p, '[data-f=projekt]', 'serwerow')
      p.click('header button:has-text("Zablokuj")')
      p.wait_for_selector('text=Ekran zablokowany')
      assert p.locator('nav').count() == 0
      p.fill('form.blokada input[name=pin]', '1111')
      p.keyboard.press('Enter')
      p.wait_for_selector('text=Nieprawidłowy PIN')
      p.screenshot(path=ZRZUTY / '17-blokada.png')
      p.fill('form.blokada input[name=pin]', '4826')
      p.keyboard.press('Enter')
      p.wait_for_selector('h1:has-text("Wydanie na projekt")')
      assert p.locator('[data-f=projekt]').input_value() == 'P-600', 'szkic powinien przetrwać blokadę'
      # blokada automatyczna po bezczynności
      p.evaluate('() => { localStorage.setItem("magazyn-blokada-min", "5"); window.MagazynApp.app.aktywnosc = Date.now() - 6 * 60000; window.MagazynApp.sprawdzBezczynnosc(); }')
      p.wait_for_selector('text=Ekran zablokowany')
      p.fill('form.blokada input[name=pin]', '4826')
      p.keyboard.press('Enter')
      p.wait_for_selector('h1:has-text("Wydanie na projekt")')
      p.click('.stopka-formularza >> text=Porzuć')
      okno_przycisk(p, 'Porzuć dokument')

      # drugi użytkownik: PIN startowy → własny PIN przy pierwszym logowaniu
      p.click('nav a[data-w=ustawienia]')
      p.click('button:has-text("Dodaj użytkownika")')
      p.fill('#modal input[name=imie]', 'Ewa')
      p.fill('#modal input[name=nazwisko]', 'Nowa')
      p.fill('#modal input[name=pin]', '5937')
      p.fill('#modal input[name=pin2]', '5937')
      okno_przycisk(p, 'Dodaj użytkownika')
      p.wait_for_selector('td:has-text("Ewa Nowa")')
      p.click('header .uzytkownik')
      okno_przycisk(p, 'Wyloguj')
      p.wait_for_selector('h1:has-text("Zaloguj się")')
      assert p.locator('text=Dodaj pierwszego użytkownika').count() == 0, 'bez logowania nie można zakładać kont'
      zaloguj(p, 'Ewa Nowa', '5937')
      p.wait_for_selector('#modal >> text=Ustaw własny PIN')
      p.fill('#modal input[name=pin]', '5937')
      p.fill('#modal input[name=pin2]', '5937')
      okno_przycisk(p, 'Ustaw PIN')
      p.wait_for_selector('#modal >> text=musi być inny')
      p.fill('#modal input[name=pin]', '7140')
      p.fill('#modal input[name=pin2]', '7140')
      okno_przycisk(p, 'Ustaw PIN')
      p.wait_for_selector('.kafle')
      # cudzy profil: tylko podgląd, reset PIN-u i wyłączenie konta
      p.click('nav a[data-w=ustawienia]')
      p.locator('tr[data-a]:has-text("Arek Testowy")').click()
      p.wait_for_selector('#modal button:has-text("Resetuj PIN")')
      assert p.locator('#modal input[name=imie]').count() == 0, 'cudzego profilu nie można edytować'
      okno_przycisk(p, 'Resetuj PIN')
      p.fill('#modal input[name=pin]', '2580')
      p.fill('#modal input[name=pin2]', '2580')
      p.fill('#modal input[name=moj]', '0000')
      okno_przycisk(p, 'Resetuj PIN')
      p.wait_for_selector('#modal >> text=Twój PIN jest nieprawidłowy')
      p.fill('#modal input[name=moj]', '7140')
      okno_przycisk(p, 'Resetuj PIN')
      p.wait_for_selector('td:has-text("PIN tymczasowy")')
      p.click('header .uzytkownik')
      okno_przycisk(p, 'Wyloguj')
      # Arek: stary PIN już nie działa, po resecie widzi, kto go zrobił
      p.click('.osoba >> text=Arek Testowy')
      p.fill('#modal input[name=pin]', '4826')
      okno_przycisk(p, 'Zaloguj')
      p.wait_for_selector('#modal >> text=Nieprawidłowy PIN')
      p.fill('#modal input[name=pin]', '2580')
      okno_przycisk(p, 'Zaloguj')
      p.wait_for_selector('#modal >> text=zresetował(a) Ewa Nowa')
      p.screenshot(path=ZRZUTY / '18-po-resecie.png')
      p.fill('#modal input[name=pin]', '4826')
      p.fill('#modal input[name=pin2]', '4826')
      okno_przycisk(p, 'Ustaw PIN')
      p.wait_for_selector('.kafle')
      opisy = p.evaluate('() => window.MagazynApp.app.st.zdarzenia.filter(e => e.typ === "UZYTK").map(e => window.MagazynCore.opisZdarzenia(window.MagazynApp.app.st, e))')
      assert any(o.startswith('Reset PIN-u: Arek Testowy') for o in opisy), opisy
      # pięć błędnych PIN-ów = minuta przerwy
      p.click('header .uzytkownik')
      okno_przycisk(p, 'Wyloguj')
      p.click('.osoba >> text=Ewa Nowa')
      for _ in range(5):
          p.fill('#modal input[name=pin]', '1357')
          okno_przycisk(p, 'Zaloguj')
          p.wait_for_timeout(250)
      p.wait_for_selector('#modal >> text=Za dużo błędnych prób')
      p.fill('#modal input[name=pin]', '7140')
      okno_przycisk(p, 'Zaloguj')
      p.wait_for_timeout(300)
      assert p.locator('.kafle').count() == 0, 'w czasie przerwy nawet dobry PIN nie loguje'
      okno_przycisk(p, 'Wróć')

      # odświeżenie strony = ponowny odczyt plików z folderu
      p.goto(URL + '?opfs=1')
      zaloguj(p, 'Arek Testowy', '4826')
      p.wait_for_selector('.kafle')
      p.screenshot(path=ZRZUTY / '14-pulpit-po-odczycie.png')
      p.click('nav a[data-w=problemy]')
      assert p.locator('.alert.ok').count() == 1, p.inner_text('.zawartosc')
      p.click('nav a[data-w=kartoteka]')
      p.wait_for_selector('h1:has-text("Biblioteka urządzeń")')
      lg = p.locator('tr:has-text("55UH5N")')
      assert lg.locator('.karta-btn:has-text("Strona produktu")').count() == 1, 'brak przycisku strony produktu'
      assert lg.locator('.karta-btn:has-text("Karta katalogowa")').count() == 1, 'brak przycisku karty katalogowej'
      belden = p.locator('tr:has-text("Cat6A F/UTP")')
      assert belden.locator('.karta-btn:has-text("Karta katalogowa")').count() == 1 and belden.locator('.karta-btn:has-text("Strona produktu")').count() == 0
      ctx.route('https://www.lg.com/**', lambda r: r.fulfill(body='karta', content_type='text/plain'))
      with p.expect_popup() as okno:
          lg.locator('.karta-btn:has-text("Strona produktu")').click()
      assert okno.value.url == 'https://www.lg.com/pl/monitory-55uh5n', okno.value.url
      okno.value.close()
      with p.expect_popup() as okno:
          lg.locator('.karta-btn:has-text("Karta katalogowa")').click()
      assert okno.value.url == 'https://www.lg.com/karta-55uh5n.pdf', okno.value.url
      okno.value.close()
      p.screenshot(path=ZRZUTY / '19-biblioteka.png')
      zapytania = []
      def bialа_lista(route):
          zapytania.append(route.request.url)
          route.fulfill(status=200, content_type='application/json', headers={'Access-Control-Allow-Origin': '*'},
                        body=json.dumps({'result': {'subject': {'name': 'MAASCK SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ', 'nip': '7011115199', 'statusVat': 'Czynny', 'regon': '523695017', 'krs': '0001002721', 'workingAddress': 'PIĘKNA 24/26A, 00-549 WARSZAWA', 'residenceAddress': None}}}))
      ctx.route('https://wl-api.mf.gov.pl/**', bialа_lista)
      p.click('nav a[data-w=dostawcy]')
      p.click('button:has-text("Nowy dostawca")')
      p.fill('#modal input[name=nip]', '701-111-51-98')
      assert p.locator('#modal >> text=nieprawidłowy NIP').count() == 1
      p.fill('#modal input[name=nip]', '701-111-51-99')
      p.click('#modal button:has-text("Pobierz z rejestru")')
      p.wait_for_selector('#modal >> text=Pobrano z wykazu podatników VAT')
      assert '/api/search/nip/7011115199?date=' in zapytania[0], zapytania
      assert p.locator('#modal input[name=nazwa]').input_value() == 'Maasck'
      assert p.locator('#modal input[name=adres]').input_value() == 'Piękna 24/26A, 00-549 Warszawa'
      assert p.locator('#modal input[name=krs]').input_value() == '0001002721'
      p.screenshot(path=ZRZUTY / '16-nowy-dostawca.png')
      okno_przycisk(p, 'Zapisz dostawcę')
      p.wait_for_selector('td:has-text("Maasck")')
      # duplikat NIP-u w bibliotece jest blokowany
      p.click('button:has-text("Nowy dostawca")')
      p.fill('#modal input[name=nazwa]', 'Aplauz drugi raz')
      p.fill('#modal input[name=nip]', '1181710940')
      okno_przycisk(p, 'Zapisz dostawcę')
      p.wait_for_selector('#modal >> text=Ten NIP ma już dostawca')
      okno_przycisk(p, 'Anuluj')
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
