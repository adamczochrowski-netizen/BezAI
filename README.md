# Bez AI – filtr treści AI i komentarzy botów (prototyp 0.6)

Rozszerzenie do Chrome/Edge, które automatycznie **ukrywa** albo **rozmywa** posty wygenerowane przez AI na:
Instagramie, Facebooku, Threads, X (Twitterze), YouTube i Reddicie (w przeglądarce na komputerze).
Zwija też komentarze, które wyglądają na pisane przez boty.

Wszystko działa lokalnie w przeglądarce – wtyczka nie ma serwera i nie wysyła żadnych danych.
Jedyne, co pobiera, to [wspólna lista kont](lista/) z tego repozytorium.

> Prototyp – nie ma go jeszcze w Chrome Web Store. Instaluje się go ręcznie (poniżej).

## Instalacja (Chrome / Edge)

1. Na tej stronie kliknij **Code → Download ZIP** i rozpakuj plik w stałe miejsce (np. Dokumenty).
   Chrome wczytuje wtyczkę **z tego folderu** – jeśli go usuniesz, wtyczka przestanie działać.
2. Otwórz `chrome://extensions` (w Edge: `edge://extensions`).
3. Włącz **Tryb dewelopera** (przełącznik w prawym górnym rogu; w Edge – w menu po lewej).
4. Kliknij **Załaduj rozpakowane** i wskaż folder `extension` (ten, w którym jest `manifest.json`).
5. Przypnij ikonę wtyczki (puzzel na pasku → pinezka przy „Bez AI”).
6. **Odśwież** otwarte karty Instagrama/Facebooka.

**Aktualizacja:** pobierz nowy ZIP, podmień pliki w tym samym folderze, kliknij ⟳ przy wtyczce
na stronie `chrome://extensions` i odśwież karty. Ustawienia i listy zostają.

## Jak używać

Kliknij ikonę wtyczki:

- **Przełącznik** w rogu – włącz/wyłącz wszystko.
- **Ukryj / Rozmyj** – posty AI znikają całkiem albo są rozmyte z napisem
  „Treść AI ukryta (#aiart) · kliknij, aby pokazać”.
- **Wykrywaj po** – które sposoby wykrywania mają działać.
- **Zablokuj konto** – wpisz `@nazwa` albo wklej link do profilu.
- **Działaj na stronach** – wyłącz wtyczkę na wybranych serwisach.
- Liczba na ikonie = ile postów ukryto na bieżącej karcie.
- **Edytuj listy…** – pełna edycja hashtagów, fraz, etykiet i kont.

## Jak wykrywa treści AI

| Sposób | Przykład | Pewność |
|---|---|---|
| Dane posta na Instagramie (pole `ai_label_info` + pełny opis) | etykieta AI nawet wtedy, gdy nie widać jej w feedzie; hashtagi schowane za „więcej” | najwyższa |
| Etykieta platformy | „Treści utworzone przez SI”, „Profil wygenerowany przez SI”, „AI info” | wysoka |
| Hashtag | `#aiart`, `#midjourney`, `#stablediffusion` (≈70 domyślnych) | wysoka |
| Konto z Twojej listy | `@ai.art.daily` (też gdy ktoś je oznaczy) | wysoka |
| Fraza w opisie / tekście alternatywnym zdjęcia | „made with AI”, „wygenerowane przez AI” | średnia |

Celowo **nie** ma na liście samego `#ai` – oznaczałby też posty *o* AI (newsy, artykuły).
Tekst wpisywany przez Ciebie (np. komentarz w trakcie pisania) jest pomijany.

### Treści *z* AI czy *o* AI? (od 0.6)

Fraza nie wystarcza – liczy się zdanie, w którym stoi:

| Tekst | Wynik |
|---|---|
| „Made with AI: cyberpunk city 4K”, „Wygenerowane przez AI – widoki Polski” | ukryte (przyznanie się twórcy) |
| „AI Generated Viking Music”, „World's First Fully AI Generated Feature Film” | ukryte |
| „Is AI-Generated Art Original?”, „Czy grafika AI to sztuka?” | **nietknięte** (pytanie) |
| „Court releases DUI suspect after AI-generated police report”, „Midjourney V7 review” | **nietknięte** (news, recenzja, poradnik, dyskusja) |
| „How to tell if a photo was made with AI” | rozmyte (przyznanie w pytaniu – nie wiadomo) |
| YouTube/X/Reddit: „AI art” i nazwy narzędzi („Midjourney v7 portraits”) w treści | rozmyte |
| X: konto „Miku｜AI Art” – nazwa konta to deklaracja | ukryte |

„Ten obraz został wygenerowany przez AI, co myślicie?” nadal jest ukrywany – pytanie do fanów to osobna część zdania.
Przełącznik w okienku: **„Rozmywaj treści tylko o AI”** – wyłączony = takie treści zostają w ogóle nietknięte.

Wtyczka pomija też elementy samej platformy: „Podsumowanie filmu wygenerowane przez AI” na YouTube
to streszczenie robione przez YouTube, a pogrubiona szukana fraza w opisie nie jest etykietą.

Wtyczka **nie wysyła żadnych danych** – działa w całości w Twojej przeglądarce, nie ma serwera ani API.
Pobiera tylko subskrybowane listy kont (zwykłe pliki tekstowe, bez ciasteczek i bez informacji o Tobie).

## Komentarze botów

Każdy komentarz dostaje punkty. Zwijany jest dopiero po przekroczeniu progu
(łagodnie 6, średnio 4 – domyślnie, ostro 3). Zwinięty komentarz to szary pasek z powodem –
kliknięcie go rozwija. Można też wybrać „Ukryj” (znika całkiem).

| Sygnał | Punkty |
|---|---|
| Fraza prawie zawsze spamowa: „check my bio”, „promote it on”, „zapraszam na priv”… (lista edytowalna) | +4 |
| To samo konto wkleja ten sam komentarz 3+ razy (2 razy: +3) – „zalew” | +4 |
| Ten sam dłuższy tekst u 3+ kont (u 2 kont: +3) – także pod różnymi postami (pamięć) | +4 |
| To samo konto, ten sam komentarz pod 3+ różnymi postami w ciągu 7 dni (pod 2: +2) | +4 |
| Konto wcześniej oznaczone jako bot (pod innym postem) | +2 |
| Podejrzany zwrot: „DM me”, „zarobiłem”, „dzięki pani…”, „made $”, krypto… (do 2 zwrotów) | +2 / +4 |
| Link albo numer telefonu w komentarzu | +2 |
| Ogólnik „od zasięgów”: „Nice pic”, „Great content”, „Keep it up” | +2 |
| Masowe oznaczanie (3+ kont) | +2 |
| Instagram: brak zdjęcia profilowego | +2 |
| Instagram: komentarz w pierwszej minucie po publikacji | +2 |
| Dziwna nazwa konta (np. `anna83920`, `xjxjxjxjxj9`; rok urodzenia i imiona typu „barbara” się nie liczą) | +1 |
| Same emoji / pusty ogólnik („Fajne”, „Wow 🔥”) / styl komentarza AI | +1 |
| Instagram: konto zweryfikowane | −6 |
| Instagram: dużo polubień komentarza (20+ / 100+) | −1 / −3 |

**„Ten sam tekst” znaczy też „podobny”:** przed porównaniem tekst jest ujednolicany – bez polskich znaków
i akcentów, emoji, interpunkcji i wielkości liter, a oznaczenia @, linki i liczby są zamieniane na zaślepki.
Dzięki temu „Come to Fenerbahçe 💛💙”, „come to fenerbahce!!” i „COME TO FENERBAHCE 💛” to ten sam tekst,
a „Zarobiłem 3000 zł dzięki @ewa” i „zarobilem 5000 zl dzieki @anna” – ten sam szablon oszustwa.

**Pamięć między postami (7 dni):** wtyczka pamięta, kto co pisał pod oglądanymi postami, żeby wyłapać
komentarze wklejane pod różnymi postami i farmy kont. Zapisuje wyłącznie skróty (hasze) – bez nazw kont,
treści i adresów – tylko w tej przeglądarce. Wyłączysz ją w okienku wtyczki, wyczyścisz w ustawieniach.

Zabezpieczenia przed pomyłkami:
- opis autora posta nigdy nie jest oceniany (twórcy często piszą „link w bio”),
- życzenia, gratulacje i kondolencje powtarzane przez wielu znajomych nie liczą się jako kopiuj-wklej
  (także gdy ta sama osoba składa życzenia pod kilkoma postami),
- krótkie teksty i ogólniki („Piękne 😍”) powtarzane pod różnymi postami dają najwyżej +1,
- czat Messengera nie jest oceniany,
- lista „To nie boty” (np. znajomi) i lista „Konta botów” w ustawieniach.

Gdzie działa: Instagram (strona posta, wiersze komentarzy + dane komentarzy), Facebook (komentarze
w feedzie i w oknie komentarzy), YouTube i Reddit (eksperymentalnie, bez sprawdzenia na żywo).

## Wspólne listy kont

Jak listy filtrów w uBlocku: ktoś prowadzi plik z kontami AI i botów, a wtyczka go subskrybuje
i sama pobiera zmiany co 12 godzin (oraz po starcie przeglądarki).

- **Lista projektu:** [`lista/lista.txt`](lista/lista.txt) w tym repozytorium – subskrybowana domyślnie
  (od 0.5.2). Zasady dodawania i usuwania kont: [lista/README.md](lista/README.md).
- **Inne listy:** ustawienia → „Wspólne listy kont” → wklej adres → „Subskrybuj”. Chrome zapyta
  o zgodę na pobieranie z tego serwera. Działa zwykły link do pliku na GitHubie (zamieniany na „Raw”).
- **Pierwszeństwo:** „Zaufane konta” (np. znajomi) wygrywają z każdą listą – tak naprawisz pomyłkę na cudzej liście.
- **Udostępnianie swojej listy:** „Pobierz moje konta jako listę (.txt)” → wrzuć plik na GitHub/Gist → daj link znajomym.
- Lista to tylko dane: nic z niej nie jest wykonywane, tytuł jest wstawiany jako zwykły tekst,
  linie z nieznaną platformą albo dziwnymi znakami są pomijane, limit 3 MB / 50 000 kont.

Format pliku:

```
! Title: Konta AI – Polska
! Updated: 2026-11-12
[ai]
instagram ai.art.daily
facebook jakas.strona.ai
https://www.instagram.com/inne.konto/
nazwa.na.wszystkich.platformach
[bot]
instagram xjxjxjxjxj9
```

Platformy: `instagram` (`ig`), `facebook` (`fb`), `threads`, `x` (`twitter`), `youtube` (`yt`), `reddit`;
bez platformy = wszystkie. `!` albo `#` zaczyna komentarz.

## Sprawdzone na prawdziwych stronach (12–13.11.2026)

- **YouTube, wyszukiwanie „ai generated” (34 filmy):** wersja 0.5 zakrywała 26, w tym
  newsy, quizy („Can you spot AI-generated political ads?”) i zwykłe filmy, przy których YouTube dokleił
  „Podsumowanie filmu wygenerowane przez AI” albo pogrubił szukaną frazę w opisie. Wersja 0.6 (liczone po tytułach) ukrywa 19 –
  filmy AI – a pytania, newsy i streszczenia YouTube zostawia.
- **X, wyszukiwanie „ai art”:** większość trafień to konta z „AI Art” w nazwie (np. „…｜AI Art”) – ich wpisy
  są ukrywane, nawet „Thank you”. Same opinie o AI („AI art is never more perfect”) – od 0.6 tylko rozmyte.
- **Threads:** tekst posta jest na stronie ~4 s wcześniej niż atrybut `data-pressable-container`,
  po którym wtyczka rozpoznaje post – posty z #aiart nie były ukrywane. Od 0.5.1 sygnały bez posta
  czekają w „poczekalni” (do 30 s), a wtyczka śledzi doklejanie atrybutów posta.
- **X:** 20/20 tweetów z #aiart ukrytych. **YouTube:** strona główna, wyniki, shorts i komentarze działają.
- **Reddit:** jeszcze nie sprawdzony na żywo.

- **Wtyczka zainstalowana w Chrome, feed Instagrama:** ukryła 2 z 17 postów – oba z prawdziwą etykietą
  „Treści utworzone przez SI”; reszta nietknięta.
- **Komentarze pod popularnym postem (sortowanie „Najnowsze”):** jedno konto z pustym awatarem
  i nazwą z przypadkowych liter wklejało ~25 razy „Come to Fenerbahçe 💛💙”. Wersja 0.3 tego nie łapała (liczyła tylko ten sam tekst
  od różnych kont, a adres pustego awatara był nieaktualny) – stąd reguła „zalewu” i nowy adres awatara.

- Instagram – dane komentarza: `text`, `created_at`, `comment_like_count`, `child_comment_count`,
  `user.username`, `user.is_verified`, `user.profile_pic_url`. Wiersze komentarzy nie mają znaczników.
  Rozpoznawane jako element listy z awatarem i linkiem do profilu.
- Facebook – komentarze to `role="article"` z opisem „Komentarz Imię Nazwisko 9 godz. temu”. Po kliknięciu
  „N komentarzy” otwierają się w oknie `role="dialog"`. Szare `role="article"` bez opisu to tylko zaślepki ładowania.

- **Instagram po polsku pisze „SI”, nie „AI”** – etykiety to m.in. „Treści utworzone przez SI”,
  „Profil wygenerowany przez SI”, „Prawdopodobnie utworzone przy użyciu SI”.
- Feed Instagrama: posty to `<article>`, opisy są ucięte w kodzie strony („…więcej”), ale pełny opis
  i pole `ai_label_info` są w danych, które strona pobiera (`/graphql/query` i dane w HTML).
  W jednej porcji feedu 3 posty miały etykietę AI w danych, a tylko 1 pokazywał ją w feedzie.
- Strona posta (`/p/…`) i Reels (`/reels/…`) nie mają `<article>` – wtyczka rozmywa wtedy blok
  z dużym zdjęciem/wideo (zawsze rozmycie, także w trybie „Ukryj”).
- Facebook: nie ma `role="feed"`; posty to `div[aria-posinset]`, komentarze `role="article"` z opisem.
  Wiadomości czatu Messengera też mają `role="article"`, ale leżą poza `role="main"` – wtyczka ich nie rusza.

## Ograniczenia (ważne)

- Ukrywa tylko treści, które **da się rozpoznać** (etykieta, hashtag, fraza, konto).
  Nieoznaczone, dobrze zrobione treści AI przejdą.
- Działa tylko w **przeglądarce**. W aplikacjach Instagrama/Facebooka na telefonie – nie.
- Facebook skraca długie opisy („Wyświetl więcej”) – hashtag schowany za tym zostanie wykryty
  dopiero po rozwinięciu. (Na Instagramie ten problem rozwiązuje odczyt danych posta.)
- Facebook: strona pojedynczego posta i przeglądarka zdjęć (okno) nie są jeszcze obsługiwane.
- Reels: rozmywany jest film, którego kod jest w adresie strony – czyli ten aktualnie oglądany.
- Boty: to ocena punktowa, nie pewność. Sprytny bot piszący naturalnie przejdzie, a człowiek piszący
  „DM me, link w bio” może zostać zwinięty. Dlatego domyślnie „Zwiń”, a nie „Ukryj”.
- Puste zdjęcie profilowe na Instagramie rozpoznawane jest po nazwie pliku obrazka
  (`573323465_…n.png`, sprawdzone na żywo 12.11.2026). Jeśli Instagram ją zmieni, trzeba ją
  zaktualizować w `shared/bot-score.js` i `content/page-hook.js`.
- YouTube: ukrywa miniatury na listach (po tytule, hashtagu, kanale), ale nie samą stronę oglądania.
- Threads, X, YouTube i Reddit są **eksperymentalne** – Threads, X i YouTube sprawdzone na żywo tylko
  częściowo, Reddit wcale. Na X i Threads nie ma jeszcze oceny botów w odpowiedziach.
- Meta i inne serwisy często zmieniają kod stron. Jeśli coś przestanie działać, trzeba poprawić
  selektory w `extension/shared/defaults.js` (sekcja `SITES`).
- „Ukryto łącznie” liczy też ponownie te same posty po odświeżeniu strony.

## Testy

Wszystkie makiety naraz (107 przypadków na 11 makietach): uruchom serwer jak niżej i otwórz
http://localhost:8791/test/index.html → „Uruchom wszystkie”.

Makiety z automatycznym sprawdzaniem (pasek u góry pokazuje „OK x/y”). Serwer uruchom w głównym folderze repozytorium:

```bash
python -m http.server 8791
```

Potem otwórz:
- http://localhost:8791/test/instagram.html – 22 przypadki (etykieta „…przez SI”, hashtag, fraza, konto,
  dane posta z HTML i z XHR w obu kolejnościach, posty doczytywane, zmiana tekstu,
  brak fałszywych alarmów: `#ai`, „airport”, szkic komentarza)
- http://localhost:8791/test/p/POST999/ – strona posta + siatka „Więcej postów” (4 przypadki)
- http://localhost:8791/test/p/POST777/ – komentarze na Instagramie (7 przypadków: spam, dane komentarza,
  konto zweryfikowane, opis autora z „link w bio”)
- http://localhost:8791/test/facebook.html – 24 przypadki (m.in. ukrywa tylko komentarz AI, a nie cały
  post; boty w oknie komentarzy; kopiuj-wklej u 3 kont; życzenia urodzinowe nietknięte; czat Messengera nietknięty)

- http://localhost:8791/test/p/MEM1/ → MEM2/ → MEM3/ (odwiedzane po kolei, po ~4 s na stronie) – pamięć
  między postami: ten sam komentarz jednego konta i farma 3 kont zwinięte dopiero pod 3. postem,
  życzenia od cioci pod każdym postem nietknięte
- http://localhost:8791/test/shared-lists.html – wspólne listy (9 przypadków: konto z listy, link do profilu,
  „wszystkie platformy”, konto tylko z Facebooka, zaufane konto mimo listy, bot ze wspólnej listy)

Testy samej oceny botów (35 przypadków + 6 testów podobieństwa tekstów, m.in. prawdziwy zalew
„Come to Fenerbahçe”, życzenia pod wieloma postami, pytania, oznaczenia znajomych) i parsera wspólnych list (13 sprawdzeń):

```bash
node test/bot-score.test.js
```

```bash
node test/lists.test.js
```

Testy rozróżniania „z AI” i „o AI” (38 przypadków, w tym prawdziwe tytuły z YouTube i wpisy z X):

```bash
node test/keywords.test.js
```

Podgląd interfejsu bez instalowania wtyczki:
- http://localhost:8791/test/popup.html – okienko wtyczki
- http://localhost:8791/test/popup.html?page=options – strona list

## Struktura

```
extension/
  manifest.json        – opis wtyczki (Manifest V3)
  shared/defaults.js   – listy domyślne, selektory stron, funkcje pomocnicze
  shared/bot-score.js  – ocena punktowa komentarzy botów (czysta funkcja, testy w node)
  shared/lists.js      – wspólne listy: format, pobieranie, eksport
  content/content.js   – wykrywanie i ukrywanie na stronie
  content/page-hook.js – (Instagram/Threads) odczyt danych postów, które strona i tak pobiera
  content/content.css  – wygląd trybów „ukryj” i „rozmyj”
  background.js        – licznik na ikonie i suma „łącznie”
  popup/               – okienko po kliknięciu ikony
  options/             – edycja list
  icons/
lista/                 – wspólna lista kont AI i botów (lista.txt) i zasady jej prowadzenia
test/                  – makiety stron i atrapa API chrome.* do testów
```

## Pomysły na dalej

- Przyciski przy poście i komentarzu: „zablokuj konto”, „to nie AI”, „to nie bot”.
- Ocena botów w odpowiedziach na X i Threads.
- Wersja dla Firefoksa (również na Androida).
- Opcjonalny lokalny detektor obrazów jako tryb „tylko rozmyj podejrzane”.
