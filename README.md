# Magazyn · MAASCK

Ewidencja urządzeń i materiałów instalacyjnych dla integratora AV. Aplikacja to **jeden plik HTML**, a dane są zwykłymi plikami JSON we wspólnym folderze na firmowym OneDrive. Nie ma serwera ani abonamentu.

Założenia projektu: [dokument założeń](https://claude.ai/artifact/3E8dQqWGbmGHtiTSnKwZqG).

## Jak zacząć

1. Załóż na firmowym OneDrive folder **Magazyn AV** i udostępnij go do edycji wszystkim użytkownikom.
2. Każdy użytkownik synchronizuje ten folder na swój komputer (aplikacja OneDrive → „Dodaj skrót do Moich plików” albo „Synchronizuj”). Najlepiej ustawić dla niego opcję **„Zawsze zachowuj na tym urządzeniu”**.
3. Skopiuj [`dist/Magazyn.html`](dist/Magazyn.html) do folderu **Magazyn AV**.
4. Otwórz `Magazyn.html` w **Microsoft Edge** albo **Google Chrome**, kliknij „Wybierz folder Magazyn AV” i wskaż ten folder. Przeglądarka zapyta o zgodę na zapis, trzeba się zgodzić.
5. Dodaj pierwszego użytkownika (imię, nazwisko, PIN) i zrób **bilans otwarcia (BO)** podczas inwentaryzacji.

Przy kolejnym uruchomieniu wystarczy przycisk „Połącz ponownie”. Przycisk „Wypróbuj na danych przykładowych” uruchamia tryb demonstracyjny, który niczego nie zapisuje (PIN 1234).

## Co jest w środku

| Dokument | Kiedy |
| --- | --- |
| **BO** – bilans otwarcia | jednorazowa inwentaryzacja startowa |
| **PZ** – przyjęcie | dostawa; można zaznaczyć, że sprzęt jest kupiony **pod projekt** |
| **WZ** – wydanie na projekt | sprzęt jedzie do klienta |
| **WZZ** – wydanie zastępcze | sprzęt kupiony pod inny projekt; czerwone ostrzeżenie, obowiązkowy powód, ramka na wydruku, wpis na listę „Do uzupełnienia” |
| **ZW** – zwrot | nadwyżki i niewykorzystany sprzęt z budowy |

W aplikacji jest wbudowana **pomoc**: znak **?** przy każdym widoku i polu (dymek po najechaniu), przycisk **Pomoc** z pełną instrukcją oraz klawisz **F1**. Do każdego modelu można dodać **kartę katalogową**: link do strony producenta albo plik PDF zapisany w folderze `karty/`. Kartę otwierasz potem jednym kliknięciem z kartoteki, stanu magazynu i dokumentów.

**Projekty** mają numer i nazwę (np. „P-2026-014 – Kancelaria Beta”), klienta i adres obiektu. W formularzach projekt wybiera się z listy, szukając po kawałku numeru albo nazwy. Przy wydaniu klient i adres wpisują się same. Nowy numer wpisany w dokumencie wywołuje przy zapisie pytanie o nazwę projektu.

**Dostawcy** to biblioteka z danymi z rejestrów KRS i REGON: pełna nazwa, NIP, REGON, KRS i adres. Na start są w niej Aplauz Audio, Polsound, Suprema Polska, Konsbud Audio, Sony i Samsung, wszyscy ze sprawdzoną sumą kontrolną NIP i REGON. Przy przyjęciu dostawcę wybiera się z listy, a jego dane trafiają na formularz PZ. W oknie dostawcy i klienta przycisk **Pobierz z rejestru** uzupełnia dane po NIP z publicznego wykazu podatników VAT Ministerstwa Finansów (potrzebny internet).

**Listy rozwijane** zastępują wpisywanie: projekt, dostawca, klient, model, lokalizacja, adres i osoba. Kliknij pole albo zacznij pisać, wybierz strzałkami i zatwierdź Enterem. Obok pól projektu, dostawcy, klienta i modelu jest przycisk **Nowy**.

**Sortowanie**: kliknięcie nagłówka kolumny w każdej tabeli sortuje rosnąco, drugie malejąco, trzecie przywraca zwykłą kolejność. Daty i ilości sortują się jak liczby, wybór jest zapamiętywany, a eksport do Excela ma tę samą kolejność.

Do tego są: stan magazynu (wolne / pod projekty / u klientów), lokalizacje z akcją „Przenieś”, urządzenia z historią po numerze seryjnym, raporty, kartoteka modeli, klienci, dziennik zmian, kontrola spójności i eksport każdej listy do Excela. Każdy dokument zapisuje się po potwierdzeniu PIN-em i drukuje jako formularz do podpisu z nagłówkiem firmy i kodem QR.

## Zasady przechowywania danych

- Każda operacja to **osobny, niezmienny plik**: `dokumenty/2026/WZ-2026-0001.json` albo `zdarzenia/2026-11/…json`. Dzięki temu dwie osoby zapisujące jednocześnie nie nadpisują sobie danych.
- **Stan magazynu nie jest nigdzie zapisany.** Aplikacja wylicza go za każdym razem ze wszystkich dokumentów.
- **Nic nie jest kasowane.** Błędny dokument się anuluje z podaniem powodu.
- Każdy plik ma **sumę kontrolną**. Ekran „Kontrola spójności” pokaże pliki zmienione lub usunięte poza aplikacją, luki w numeracji i kopie konfliktowe OneDrive.
- **Kopia zapasowa** całej bazy zapisuje się sama raz w tygodniu do `kopie/`. Można też pobrać całą bazę jako JSON z ustawień.

```
Magazyn AV/
├── Magazyn.html
├── dokumenty/2026/     BO, PZ, WZ, WZZ, ZW – jeden plik na dokument
├── zdarzenia/2026-11/  kartoteka, projekty, klienci, dostawcy, użytkownicy, przeniesienia, anulowania, skany
├── podpisane/2026/     skany podpisanych formularzy
├── karty/              karty katalogowe (PDF) dołączone do modeli
├── eksporty/           kopie eksportów do Excela
└── kopie/              kopie tygodniowe
```

## Ograniczenia

- Aplikacja działa w Edge i Chrome na komputerze. Na telefonie zostaje podgląd PDF-ów i Exceli w aplikacji OneDrive.
- Synchronizacja OneDrive trwa od kilku sekund do kilku minut. Przed każdym zapisem dokumentu aplikacja ponownie czyta folder. Przycisk „Odśwież” wczytuje zmiany innych osób.
- Ról nie ma – w magazynie każdy może to samo. Każdy loguje się swoim PIN-em, a ekran blokuje się sam po bezczynności (domyślnie 15 minut). Swój profil i PIN zmienia tylko właściciel. Reset PIN-u albo wyłączenie cudzego konta trzeba potwierdzić własnym PIN-em; zostaje to w dzienniku, a osoba po resecie widzi przy logowaniu, kto go zrobił, i musi ustawić własny PIN.
- PIN chroni przed korzystaniem z cudzego konta przy komputerze. Nie jest zabezpieczeniem przed kimś, kto ma dostęp do plików na OneDrive i wiedzę techniczną (PIN-y są zapisane jako skróty PBKDF2, ale 4–6 cyfr da się w końcu odgadnąć). Ręczne zmiany plików wychwyci Kontrola spójności.

## Rozwój

```
npm test              # testy logiki magazynu (Node 18+)
npm run build         # buduje dist/Magazyn.html
python3 test/e2e.py   # test w przeglądarce (Playwright + Chrome)
```

- `src/core.js`: logika bez interfejsu (zdarzenia, stany, walidacja, kontrola spójności, rejestr projektów, wbudowana biblioteka dostawców, sprawdzanie NIP i REGON).
- `src/storage.js`: zapis do folderu (File System Access API) i do pamięci (tryb demo).
- `src/xlsx.js`: eksport do Excela bez bibliotek.
- `src/app.js` i `src/styles.css`: interfejs.
- `src/pomoc.js`: teksty dymków i instrukcji.
- `assets/`: logo i ikona (kolory marki: granat #020195, żółty #f8c032).
- `vendor/qrcode.js`: generator kodów QR (Kazuhiko Arase, licencja MIT).
