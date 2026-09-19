# Moto Świry Toruń 🏍️

Społecznościowy planer tras motocyklowych: mapy, planowanie trasy po prawdziwych drogach,
propozycje wyjazdów, ranking, odznaki i katalog motocykli z cenami.

**Strona na żywo:** <https://kotixeszkere93-commits.github.io/motocykle-torun/>

> ℹ️ GitHub Pages publikuje katalog główny repozytorium, dlatego `index.html` leży teraz w
> katalogu głównym. Stary adres `/moto-swiry-torun/` przekierowuje na nowy.

---

## Co potrafi aplikacja

### Planer tras (`#/planer`)
- Klikasz punkty na mapie (start, przystanki, meta) — maks. 12 punktów, przeciąganie markerów.
- Trasa liczona po **prawdziwych drogach** (OSRM): dystans, czas jazdy, średnia prędkość.
- Przełącznik **„Preferuj drogi lokalne”** (omijanie autostrad), tryb **pętli**, odwracanie trasy.
- **Koszt paliwa i zasięg** liczone z Twojego motocykla (spalanie, bak, cena paliwa z garażu).
- **Pogoda na 4 dni** dla punktu startu (Open-Meteo) z oceną „czy warto jechać”.
- **Warstwy mapy**: mapa / teren / satelita, geolokalizacja, pełny ekran.
- **Warstwa punktów** (POI): widoki, paliwo, jedzenie, noclegi, warsztaty, atrakcje —
  jednym kliknięciem dodajesz punkt do trasy.
- **Eksport GPX**, otwarcie w Google Maps, link do trasy do skopiowania (`?planer=lat,lng;…`).
- Skróty: `Backspace`/`Ctrl+Z` cofa punkt, `Esc` zamyka okna, `/` szuka.

### Trasy społeczności (`#/trasy`, `#/trasa/<id>`)
- Karty tras z miniaturą przebiegu, dystansem, czasem, ekipą i komentarzami.
- Filtry: szukajka, region, trudność, nawierzchnia + 5 sposobów sortowania.
- Widok szczegółów: mapa trasy, lista punktów ze wskazaniem najbliższej miejscowości,
  komentarze, propozycje zmian, „biorę udział”, polubienia, GPX, Google Maps, WhatsApp.
- Autor może usunąć swoją trasę.

### Ranking (`#/ranking`)
- Podium + tabela z pozycją, trasami, wyjazdami, punktami i odznakami.
- Twoja pozycja, punkty i **ile brakuje do awansu**.
- Statystyki miesiąca (nowe trasy, zaplanowane km, aktywni motocykliści).
- Punktacja: trasa **+10**, udział w wyjeździe **+2**, propozycja zmiany **+3**, komentarz **+1**.
- 9 odznak (pierwsza trasa, organizator, szutrowy wariat, maratoner, legenda Świrów…).

### Garaż (`#/garaz`)
- Katalog **65 modeli** (adventure, turystyczne, naked, dual sport, klasyki, 125, skutery, elektryk).
- Każdy model: moc, masa, spalanie, bak, zasięg, widełki cenowe i komentarz „o czym pamiętać”.
- Filtry: szukajka, kategoria, uprawnienia (A1/A2/A), 6 sposobów sortowania.
- **Porównywarka** do 3 modeli (15 kryteriów, w tym koszt przejechania 100 i 300 km).
- **„Mój motocykl”** — dane trafiają do kalkulatora paliwa w planerze i do rankingu.

### Konta i dane
- Rejestracja / logowanie / reset hasła (Firebase Auth, e-mail + hasło).
- Profil: statystyki, odznaki, lista własnych tras, edycja danych.
- **Tryb lokalny**: gdy Firebase jest niedostępny (brak sieci, zablokowane reguły),
  aplikacja automatycznie przechodzi na dane w `localStorage` i pokazuje o tym pasek —
  planer, katalog i kalkulatory działają dalej.
- **Offline**: service worker (`sw.js`) trzyma powłokę aplikacji, więc po pierwszej wizycie
  strona i ostatnio pobrane trasy działają bez internetu. Aplikację można „zainstalować”
  (PWA: manifest + ikony).

### Dostępność i UX
- Pełna obsługa klawiatury, `aria-*`, focus trap w oknach, `prefers-reduced-motion`.
- Motyw ciemny/jasny (zapamiętywany), responsywność od 320 px, druk widoków.
- Komunikaty po polsku zamiast kodów błędów Firebase.

---

## Struktura projektu

```
index.html                 # aplikacja (GitHub Pages serwuje ten plik)
css/style.css              # design system: tokeny, komponenty, widoki
js/
  config.js                # konfiguracja, regiony, POI, punktacja, odznaki, kafelki
  ui.js                    # ikony SVG, modale, toasty, formatowanie, motyw
  store.js                 # warstwa danych: Firestore + fallback localStorage
  map.js                   # Leaflet, routing OSRM, GPX, pogoda, POI
  planner.js               # logika planera trasy
  routes.js                # katalog tras, szczegóły, komentarze, udostępnianie
  ranking.js               # agregacje i tabela rankingu
  garage.js                # katalog motocykli, porównywarka, „mój motocykl”
  auth.js                  # logowanie, rejestracja, profil, menu użytkownika
  app.js                   # router (hash), start, pasek stanu, PWA
data/motorcycles.json      # katalog marek, modeli i cen
vendor/                    # Leaflet + Firebase (lokalnie, bez CDN)
assets/img/                # zdjęcia, logo, favicony, OG image
sw.js                      # service worker (offline)
manifest.webmanifest       # manifest PWA
firestore.rules            # zasady bezpieczeństwa Firestore
firebase.json              # konfiguracja Firebase (reguły + hosting)
moto-swiry-torun/index.html# przekierowanie ze starego adresu
```

Wszystkie zasoby (Leaflet, Firebase SDK) są w `vendor/` — aplikacja nie zależy od CDN,
więc nie zepsuje się po zmianie zewnętrznego linku.

---

## Konfiguracja Firebase (jeśli chcesz pełną bazę społeczności)

Projekt: `motoswiry-torun` (konfiguracja w `js/config.js`).

1. **Authentication → Sign-in method** → włącz **E-mail/Password**.
2. **Authentication → Settings → Authorized domains** → dodaj
   `kotixeszkere93-commits.github.io` (bez tego logowanie na GitHub Pages jest blokowane!).
3. **Firestore Database** → utwórz bazę (tryb produkcyjny).
4. Wdróż reguły z tego repozytorium:
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase use motoswiry-torun
   firebase deploy --only firestore:rules
   ```
5. (Opcjonalnie) hosting Firebase:
   ```bash
   firebase deploy --only hosting
   ```

Bez tych kroków aplikacja **nie wywala się** — automatycznie pracuje w trybie lokalnym
i pokazuje o tym informację u góry strony.

---

## Praca lokalna

```bash
# dowolny serwer statyczny, np.
python3 -m http.server 8000
# → http://localhost:8000
```

Otwieranie przez `file://` też zadziała dla planera i katalogu, ale `fetch` pliku JSON
oraz service worker wymagają serwera HTTP.

Testy dymne (jsdom) wykonujemy poza repozytorium — aplikacja nie ma zależności budowania,
nie ma `npm install` ani kroku kompilacji. Zmieniasz plik → odświeżasz stronę.

---

## Format danych katalogu motocykli

`data/motorcycles.json`:

```json
{
  "meta": { "updated": "2026-09", "currency": "PLN", "note": "…" },
  "bikes": [
    {
      "brand": "Honda",
      "model": "Africa Twin CRF1000L",
      "category": "adventure",
      "license": "A",
      "cc": 998, "power": 95, "weight": 232,
      "consumption": 5.4, "tank": 18.8,
      "years": "2016–2019",
      "price": { "min": 42000, "max": 62000 },
      "desc": "Krótki komentarz dla kupującego."
    }
  ]
}
```

Obsługiwany jest też stary format (`{ "Yamaha": { "2018": [ { "model": …, "price": … } ] } }`) —
aplikacja sama go spłaszczy.

Ceny to **widełki orientacyjne** dla polskiego rynku wtórnego. Aktualizuj je raz na kwartał.

---

## Bezpieczeństwo i zasady

Trasy w serwisie to propozycje użytkowników. Mogą prowadzić drogami gruntowymi,
przez tereny prywatne albo odcinki w remoncie — przed wyjazdem sprawdź stan drogi,
oznakowanie i pogodę. Jedziesz na własną odpowiedzialność, w pełnym wyposażeniu.

`firestore.rules` pozwala każdemu czytać trasy i ranking (także bez logowania),
ale zapisywać może tylko zalogowany użytkownik: własny profil oraz — w cudzych trasach —
tablice `participants`, `likes`, `comments`, `suggestions`.

---

## Źródła danych i technologie

- [Leaflet](https://leafletjs.com/) 1.9.4 — mapy
- [OpenStreetMap](https://www.openstreetmap.org/copyright), [OpenTopoMap](https://opentopomap.org) (CC-BY-SA),
  [Esri World Imagery](https://www.arcgis.com/) — kafelki
- [OSRM](http://project-osrm.org/) (serwer demo) — wyznaczanie tras po drogach
- [Open-Meteo](https://open-meteo.com/) — pogoda (bez klucza API)
- [Firebase](https://firebase.google.com/) 10.x (compat) — logowanie i baza tras
- Ikona i zdjęcia wygenerowane na potrzeby projektu

---

## Plan rozwoju (pomysły)

- [ ] Edycja opublikowanej trasy przez autora
- [ ] Kalendarz wyjazdów i przypomnienia e-mail
- [ ] Trasy prywatne / tylko dla ekipy (link z tokenem)
- [ ] Import GPX (odwrotnie do eksportu)
- [ ] Profile publiczne (`#/profil/<uid>`) z historią tras
- [ ] Tryb „nawiguj po trasie” z ekranem skrętu
- [ ] Kafelki offline w service workerze dla tras zapisanych wcześniej
