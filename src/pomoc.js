/*
 * Magazyn – teksty pomocy: krótkie dymki (znak zapytania) i pełna instrukcja.
 */
(function (root) {
  'use strict';

  const TIPY = {
    // widoki
    pulpit: 'Podsumowanie magazynu: najważniejsze liczby, ostatnie dokumenty i szybkie akcje. Kliknij kafelek, żeby przejść do szczegółów.',
    stan: 'Ile czego jest. „Wolne” można wydać na dowolny projekt. „Pod projekty” to sprzęt kupiony dla konkretnego projektu. „U klientów” to sprzęt już wydany.',
    lokalizacje: 'Co leży w którym miejscu magazynu. „Przenieś” zmienia półkę bez formularza do podpisu – zmiana trafia do dziennika.',
    urzadzenia: 'Urządzenia śledzone po numerze seryjnym. Kliknij wiersz, żeby zobaczyć pełną historię: kiedy przyjęte, komu wydane, kiedy wróciło.',
    dokumenty: 'Wszystkie dokumenty magazynowe. Kliknij dokument, żeby go wydrukować, dołączyć skan podpisu albo anulować.',
    uzupelnienia: 'Sprzęt kupiony pod projekt, który poszedł wydaniem zastępczym (WZZ) na inny projekt. Pozycja zostaje na liście, dopóki ktoś nie oznaczy jej jako uzupełnionej.',
    raporty: 'Gotowe zestawienia. Każde można wyeksportować do Excela przyciskiem w prawym górnym rogu.',
    kartoteka: 'Lista modeli, które mogą leżeć w magazynie. Model dodajesz raz, potem wybierasz go w dokumentach.',
    klienci: 'Lista firm, do których wydajecie sprzęt. Nie jest obowiązkowa – przy wydaniu można wpisać dowolną nazwę.',
    dziennik: 'Każda operacja z autorem, datą i godziną. Niczego nie da się z niego usunąć.',
    problemy: 'Aplikacja przy każdym odczycie sprawdza, czy pliki w folderze nie zostały zmienione, usunięte albo zdublowane przez OneDrive.',
    ustawienia: 'Użytkownicy, zmiana PIN-u, kopia zapasowa i informacje o folderze.',
    pomoc: 'Pełna instrukcja obsługi.',
    // dokumenty
    BO: 'Bilans otwarcia: jednorazowy spis wszystkiego, co fizycznie leży w magazynie. Od tego dokumentu zaczyna się ewidencja.',
    PZ: 'Przyjęcie zewnętrzne: towar przyjechał od dostawcy. Jeśli kupiliście go pod konkretny projekt, zaznacz to – wtedy nie będzie liczony do wolnego stanu.',
    WZ: 'Wydanie na projekt: sprzęt jedzie do klienta i tam zostaje. Jeśli wybierzesz sprzęt kupiony pod inny projekt, dokument zmieni się w wydanie zastępcze (WZZ).',
    WZZ: 'Wydanie zastępcze: sprzęt kupiony pod jeden projekt poszedł na inny. Wymaga powodu, na wydruku ma czerwoną ramkę i trafia na listę „Do uzupełnienia”.',
    ZW: 'Zwrot z projektu: nadwyżki materiału albo niewykorzystane urządzenia wracają do magazynu.',
    // pola
    podProjekt: 'Zaznacz, jeśli towar był zamówiony pod konkretny projekt. Taki sprzęt jest zarezerwowany: zwykłe wydanie na inny projekt będzie wymagało wydania zastępczego (WZZ).',
    projektNumer: 'Numer projektu wpisujesz ręcznie. Aplikacja podpowiada numery, które już były użyte – wybierz z listy, żeby uniknąć literówek.',
    lokalizacja: 'Miejsce w magazynie, np. „Regał A, półka 2”. Podpowiadane są lokalizacje już używane. Nowa lokalizacja wymaga potwierdzenia przy zapisie.',
    numerySeryjne: 'Jeden numer w linii. Możesz wkleić całą kolumnę z Excela albo listy przewozowej – liczba sztuk policzy się sama.',
    ilosc: 'Ilość w jednostce modelu (szt. albo metry). Jeśli model ma jednostkę zakupu, np. szpulę, możesz ją wybrać – aplikacja przeliczy na metry.',
    stanTech: 'Stan urządzenia: nowe, używane (np. po zwrocie z budowy) albo uszkodzone.',
    gwarancja: 'Data końca gwarancji, jeśli jest znana. Pole nieobowiązkowe.',
    klient: 'Wybierz firmę z listy klientów albo wpisz dowolną nazwę. Jeśli firma jest na liście, na formularzu pojawi się jej NIP i adres.',
    adresObiektu: 'Gdzie fizycznie jedzie sprzęt, np. adres budowy i sala.',
    pobierajacy: 'Kto odbiera sprzęt z magazynu (np. technik). Ta osoba podpisuje formularz.',
    powodWzz: 'Napisz krótko, dlaczego sprzęt z innego projektu idzie tutaj, np. „pilna wymiana u klienta”. Powód będzie na wydruku i w raporcie.',
    wyborZMagazynu: 'Na górze listy jest sprzęt kupiony pod ten projekt, potem wolny. Sprzęt z innych projektów jest na czerwono – jego wydanie będzie zastępcze.',
    dostawca: 'Nazwa dostawcy. Podpowiadani są dostawcy z wcześniejszych przyjęć.',
    nrFaktury: 'Numer faktury albo dokumentu WZ dostawcy – ułatwia późniejsze odszukanie dostawy.',
    seryjny: 'Zaznacz dla urządzeń z gwarancją, które trafiają do klienta – każda sztuka będzie śledzona osobno. Materiałów (kable, korytka, złącza) nie śledzi się po numerze.',
    jednostka: 'Sztuki albo metry. Kable i korytka liczymy w metrach.',
    jednostkaZakupu: 'Jeśli kupujecie np. kabel w szpulach po 305 m, wpisz „szpula” i 305. Przy przyjęciu wpiszesz „2 szpule”, a aplikacja zapisze 610 m.',
    stanMin: 'Gdy stan w magazynie spadnie poniżej tej wartości, model pojawi się w raporcie „Poniżej minimum” i na pulpicie.',
    status: '„EOL” oznacza model wycofany przez producenta – pojawi się w raporcie „EOL na stanie”. „Wycofany” chowa model z podpowiedzi w nowych dokumentach.',
    karta: 'Link do karty katalogowej na stronie producenta albo plik PDF zapisany w folderze magazynu. Przycisk „Szukaj” otwiera wyszukiwarkę z nazwą modelu.',
    pin: 'PIN potwierdza, kto wystawił dokument. Każdy użytkownik ma własny PIN – nie podawaj go innym.',
    przenies: 'Zmienia miejsce sprzętu w magazynie (np. z regału na antresolę). Nie tworzy formularza do podpisu, ale zostaje zapisane w dzienniku.',
    eksport: 'Zapisuje to, co widzisz na ekranie (z filtrami), jako plik Excel. Kopia trafia też do folderu „eksporty”.',
    odswiez: 'Wczytuje zmiany zapisane przez inne osoby. OneDrive potrzebuje od kilku sekund do kilku minut, żeby je przesłać.',
    skan: 'Po podpisaniu formularza zrób zdjęcie telefonem albo skan i dołącz go tutaj. Dokumenty bez skanu są na liście „Bez podpisu”.',
    anuluj: 'Dokumentu nie da się usunąć. Anulowanie oznacza go jako nieważny i cofa jego wpływ na stan. Wymaga powodu i PIN-u.',
    zakupPodProjektWStanie: 'Sprzęt kupiony pod konkretny projekt, który jeszcze leży w magazynie.',
  };

  const INSTRUKCJA = [
    { id: 'start', tytul: 'Na start', html: `
      <ol>
        <li><b>Folder.</b> Na firmowym OneDrive jest folder <b>Magazyn AV</b>, udostępniony do edycji wszystkim użytkownikom. Każdy synchronizuje go na swój komputer. Najlepiej kliknąć folder prawym przyciskiem i wybrać „Zawsze zachowuj na tym urządzeniu”.</li>
        <li><b>Aplikacja.</b> Plik <b>Magazyn.html</b> leży w tym folderze. Otwórz go w <b>Microsoft Edge</b> albo <b>Google Chrome</b> (inne przeglądarki nie potrafią zapisywać plików w folderze).</li>
        <li><b>Połączenie z folderem.</b> Za pierwszym razem kliknij „Wybierz folder Magazyn AV”, wskaż folder i zgódź się na zapis. Przy kolejnych uruchomieniach wystarczy „Połącz ponownie”.</li>
        <li><b>Użytkownik.</b> Wybierz siebie z listy. Nowa osoba dodaje się przyciskiem „Dodaj użytkownika” i ustala własny PIN (4–8 cyfr).</li>
        <li><b>Bilans otwarcia.</b> Przy pierwszym uruchomieniu zróbcie inwentaryzację: wszystko, co leży w magazynie, wpisujecie dokumentem <b>BO</b>, miejsce po miejscu.</li>
      </ol>` },
    { id: 'przyjecie', tytul: 'Przyjęcie towaru (PZ)', html: `
      <p>Gdy przyjedzie dostawa, kliknij <b>Przyjęcie</b>.</p>
      <ol>
        <li>Wpisz dostawcę i numer faktury albo WZ dostawcy.</li>
        <li>Jeśli towar jest zamówiony pod konkretny projekt, zaznacz <b>Kupione pod projekt</b> i wpisz jego numer. Ten sprzęt będzie zarezerwowany dla projektu.</li>
        <li>Dla każdej pozycji wybierz model (zacznij pisać nazwę), wpisz lokalizację i numery seryjne (jeden w linii, można wkleić) albo ilość.</li>
        <li>Brakuje modelu? Kliknij „Dodaj do kartoteki” – model zapisze się i od razu wskoczy do pozycji.</li>
        <li>Kliknij <b>Zapisz dokument</b>, potwierdź PIN-em, wydrukuj formularz i daj do podpisu.</li>
      </ol>` },
    { id: 'wydanie', tytul: 'Wydanie na projekt (WZ)', html: `
      <p>Gdy sprzęt jedzie do klienta, kliknij <b>Wydanie</b>.</p>
      <ol>
        <li>Wpisz numer projektu i klienta (z listy albo dowolną nazwę), adres obiektu i osobę, która odbiera sprzęt.</li>
        <li>W tabeli „Dostępne w magazynie” kliknij <b>Dodaj</b> przy potrzebnym sprzęcie. Sprzęt kupiony pod ten projekt jest na górze listy.</li>
        <li>Przy materiałach (kable, korytka) wpisz wydawaną ilość.</li>
        <li>Zapisz, potwierdź PIN-em i wydrukuj formularz do podpisu.</li>
      </ol>` },
    { id: 'wzz', tytul: 'Wydanie zastępcze (WZZ)', html: `
      <p>Czasem trzeba wydać sprzęt kupiony pod inny projekt – np. przy pilnej wymianie. Wtedy w formularzu wydania wybierasz pozycję oznaczoną na czerwono.</p>
      <ul>
        <li>Aplikacja pokaże czerwone ostrzeżenie i zmieni dokument na <b>WZZ</b>.</li>
        <li>Trzeba wpisać <b>powód</b> – będzie widoczny na wydruku i w raportach.</li>
        <li>Na wydruku pojawi się czerwona ramka „Wydanie zastępcze: kupione pod X, wydane na Y”.</li>
        <li>Sprzęt trafi na listę <b>Do uzupełnienia</b>. Gdy dokupicie go pod projekt X, kliknij tam „Uzupełnione…” i wpisz np. numer nowego PZ.</li>
      </ul>` },
    { id: 'zwrot', tytul: 'Zwrot z projektu (ZW)', html: `
      <p>Gdy z budowy wraca nadwyżka materiału albo niewykorzystane urządzenie, kliknij <b>Zwrot</b>, wpisz numer projektu i wybierz z listy, co wraca. Przy urządzeniach zaznacz stan (np. używany), przy materiałach wpisz ilość. Każdej pozycji podaj lokalizację, w której ją odkładasz.</p>` },
    { id: 'przenies', tytul: 'Przenoszenie w magazynie', html: `
      <p>W widoku <b>Lokalizacje</b> kliknij <b>Przenieś</b> przy pozycji i wpisz nową lokalizację. To nie jest dokument do podpisu – zmiana zapisuje się w dzienniku z Twoim nazwiskiem.</p>` },
    { id: 'podpisy', tytul: 'Wydruki i podpisy', html: `
      <ul>
        <li>Po zapisaniu dokumentu aplikacja proponuje wydruk. W oknie drukowania możesz też wybrać „Zapisz jako PDF”.</li>
        <li>Formularz ma nagłówek firmy, numer dokumentu, kod QR, listę pozycji i miejsca na podpisy.</li>
        <li>Podpisany formularz sfotografuj albo zeskanuj, otwórz dokument (widok <b>Dokumenty</b>) i kliknij <b>Dołącz skan podpisu</b>. Plik zapisze się w folderze „podpisane”.</li>
        <li>Dokumenty bez skanu widać w raporcie <b>Bez podpisu</b> i na pulpicie.</li>
      </ul>` },
    { id: 'kartoteka', tytul: 'Kartoteka modeli i karty katalogowe', html: `
      <ul>
        <li>Model dodajesz raz: kategoria, producent, model, kod producenta (P/N), opcjonalnie EAN.</li>
        <li><b>Śledź po numerze seryjnym</b> zaznacz dla urządzeń z gwarancją, które trafiają do klienta. Materiały liczone są na sztuki albo metry.</li>
        <li><b>Jednostka zakupu</b> pozwala przyjmować np. kabel w szpulach – wpisz „szpula” i 305, a aplikacja przeliczy na metry.</li>
        <li><b>Karta katalogowa:</b> wklej link ze strony producenta albo dołącz plik PDF. Przycisk „Szukaj w internecie” otworzy wyszukiwarkę z nazwą modelu. Kartę otworzysz potem jednym kliknięciem w kartotece, stanie magazynu i dokumentach (ikona <b>karty</b>).</li>
        <li>Status <b>EOL</b> oznacza model wycofany przez producenta – zobaczysz go w raporcie „EOL na stanie”.</li>
      </ul>` },
    { id: 'raporty', tytul: 'Wyszukiwanie, raporty i Excel', html: `
      <ul>
        <li>Każda lista ma pole wyszukiwania – możesz wpisać kilka słów, np. „samsung 55”.</li>
        <li>Przycisk <b>Eksport do Excela</b> zapisuje to, co widać na ekranie (z filtrami). Plik pobiera się na komputer, a kopia trafia do folderu „eksporty”.</li>
        <li>Raporty: wydane na projekt, wydane do klienta, kupione pod projekt w magazynie, poniżej minimum, EOL na stanie, bez podpisu, historia urządzenia po numerze seryjnym.</li>
      </ul>` },
    { id: 'pomylki', tytul: 'Pomyłki i anulowanie', html: `
      <p>Dokumentów nie da się usunąć ani poprawić po zapisie – tak, żeby historia była zawsze wiarygodna. Jeśli coś jest źle, otwórz dokument, kliknij <b>Anuluj dokument</b>, wpisz powód i potwierdź PIN-em, a potem wystaw nowy, poprawny dokument.</p>
      <p>Aplikacja nie pozwoli anulować dokumentu, z którego korzystają późniejsze dokumenty (np. przyjęcia, z którego sprzęt już wydano). Najpierw trzeba anulować te późniejsze.</p>` },
    { id: 'onedrive', tytul: 'Praca kilku osób i OneDrive', html: `
      <ul>
        <li>Każdy dokument to osobny plik, więc dwie osoby mogą pracować w tym samym czasie.</li>
        <li>OneDrive przesyła zmiany od kilku sekund do kilku minut. Kliknij <b>Odśwież</b>, żeby zobaczyć to, co zapisali inni. Przed każdym zapisem dokumentu aplikacja i tak czyta folder od nowa.</li>
        <li><b>Kontrola spójności</b> pokaże, jeśli ktoś zmienił albo usunął plik poza aplikacją, jeśli w numeracji jest luka albo jeśli OneDrive utworzył kopię konfliktową. Zwykle wystarczy chwilę poczekać i kliknąć Odśwież.</li>
        <li>Nie zmieniaj i nie usuwaj ręcznie plików w folderach „dokumenty” i „zdarzenia”.</li>
      </ul>` },
    { id: 'kopie', tytul: 'Kopie zapasowe', html: `
      <p>Raz w tygodniu aplikacja sama zapisuje kopię całej bazy w folderze „kopie”. Dodatkowo OneDrive przechowuje historię wersji i kosz. W <b>Ustawieniach</b> możesz zrobić kopię ręcznie albo pobrać całą bazę jako jeden plik.</p>` },
    { id: 'faq', tytul: 'Najczęstsze pytania', html: `
      <dl class="faq">
        <dt>Zapomniałem PIN-u.</dt><dd>Ktoś inny może dodać Cię jako nowego użytkownika w Ustawieniach, a stare konto oznaczyć jako nieaktywne. Historia Twoich dokumentów zostaje.</dd>
        <dt>Nowy komputer.</dt><dd>Zsynchronizuj folder Magazyn AV, otwórz Magazyn.html w Edge albo Chrome i wybierz folder. Dane są w folderze, nie w komputerze.</dd>
        <dt>Nie widzę dokumentu kolegi.</dt><dd>Poczekaj chwilę, aż OneDrive go prześle, i kliknij Odśwież.</dd>
        <dt>Czy mogę używać na telefonie?</dt><dd>Zapisywać można tylko na komputerze. Na telefonie zobaczysz wyeksportowane Excele i PDF-y w aplikacji OneDrive.</dd>
        <dt>Skróty klawiszowe</dt><dd><b>F1</b> – pomoc, <b>Esc</b> – zamknięcie okna, <b>Enter</b> na wierszu tabeli – otwarcie szczegółów.</dd>
      </dl>` },
  ];

  root.MagazynPomoc = { TIPY, INSTRUKCJA };
})(typeof self !== 'undefined' ? self : this);
