# Bez AI – wspólna lista kont AI i botów

Lista kont, które publikują treści wygenerowane przez AI albo zachowują się jak boty (spam, oszustwa,
zalewanie komentarzami). Korzysta z niej wtyczka do przeglądarki **Bez AI** – działa jak listy filtrów
w uBlocku: wtyczka sama pobiera ten plik co 12 godzin i ukrywa posty oraz zwija komentarze z tych kont.

## Jak subskrybować

Wtyczka [Bez AI](../README.md) (od wersji 0.5.2) **subskrybuje tę listę domyślnie** – nic nie trzeba robić.

Jeśli usuniesz ją z subskrypcji i zechcesz wrócić:

1. Otwórz ustawienia wtyczki Bez AI → sekcja **„Wspólne listy kont”**.
2. Wklej adres:

   ```
   https://raw.githubusercontent.com/adamczochrowski-netizen/BezAI/main/lista/lista.txt
   ```

   (zwykły link do pliku na GitHubie też zadziała – wtyczka sama zamieni go na „Raw”).
3. Kliknij **„Subskrybuj”** i zgódź się, gdy Chrome zapyta o pobieranie z tego serwera.

Jeśli ktoś z Twoich znajomych trafił na listę przez pomyłkę, dodaj go w ustawieniach wtyczki do
**„Zaufanych kont”** – one zawsze wygrywają z listami.

## Format

```
[ai]
instagram nazwa.konta
facebook nazwa.strony
https://www.instagram.com/inne.konto/
nazwa.na.wszystkich.platformach

[bot]
instagram konto.spamujace
```

- `[ai]` – konta publikujące treści generowane przez AI (posty są ukrywane),
- `[bot]` – konta piszące komentarze jak boty (komentarze są zwijane),
- platformy: `instagram` (`ig`), `facebook` (`fb`), `threads`, `x` (`twitter`), `youtube` (`yt`), `reddit`;
  bez platformy = wszystkie platformy,
- `!` albo `#` zaczyna komentarz (także na końcu linii).

## Zasady dodawania kont

Każde konto **tylko z dowodem**. Zgłoszenie bez dowodu nie zostanie dodane.

**[ai]** – wystarczy jedno z:
- link do posta z etykietą platformy („Treści utworzone przez SI”, „AI info”, „Made with AI” itp.),
- profil, który sam deklaruje, że publikuje treści z AI (np. w opisie konta),
- kilka postów z hashtagami typu `#aiart`, `#midjourney`, `#aigenerated`.

**[bot]** – link (albo zrzut ekranu) pokazujący np.:
- ten sam komentarz wklejany wiele razy albo pod wieloma postami,
- oszustwa („zarobiłem dzięki pani…”, „check my bio”, linki do podejrzanych stron),
- konto bez zdjęcia, z losową nazwą, piszące tylko szablonowe komentarze.

**Nie dodajemy:**
- kont prywatnych osób za ich opinie, poglądy albo to, że *rozmawiają* o AI,
- kont tylko dlatego, że się z nimi nie zgadzamy,
- niczego jako zemsty czy nękania.

## Jak zgłosić konto

- **Issue:** „Issues” → „New issue” → nazwa konta, platforma, sekcja (`[ai]` albo `[bot]`) i dowód.
- **Pull request:** dopisz konto do `lista/lista.txt` w odpowiedniej sekcji i dodaj dowód w opisie.

## Usunięcie z listy

Twoje konto jest tu przez pomyłkę? Załóż Issue z prośbą o usunięcie – pomyłki usuwamy.
