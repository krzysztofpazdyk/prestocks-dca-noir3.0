> **noir 3.0** — kopia UI pod program **predca 3.0** (priced buys v2). `basePath` `/prestocks-dca-noir3.0`. Deploy Pages ręcznie, po review — sam PR nie publikuje strony. Ta kopia nie zawiera workflow Pages.

# PreStocks UI — noir 3.0

Interfejs **PreStocks Weekly DCA** w stylu trading desk: głęboki charcoal, neonowy teal/violet, liczby monospace. Wersja UI **v5.0.0**.

Podłączony do programu Anchor **predca 3.0** (custody USDC + config + RunRecord + PriceFeed). Zakup ręczny woła `simulate_buy_v2`: ilość tokena to `floor(usdc / price)` w jednostkach bazowych (6 decimals), nie 1 token za 1 USD. Sieć: **Solana localnet lub devnet** (wybierana przez `NEXT_PUBLIC_RPC_URL`) — bez seedów / kluczy prywatnych w repo.

## Wymagania

- Node.js 20+
- npm
- `solana-test-validator` (CLI Solana) — do transakcji on-chain
- Program **predca 3.0** (`Eb3TFLeYi3dHZwoKCBvvUpx3gMnP2XdmMXX3rstUpdwC`)

## Instalacja

```bash
cd ~/prestocks-dca-noir3.0
cp .env.example .env.local
npm install
```

## Localnet + Predca

1. Uruchom validator:

```bash
solana-test-validator
```

2. Ustaw CLI na localnet i upewnij się, że **predca** jest zdeployowany (z katalogu `/workspace/predca`):

```bash
solana config set --url http://127.0.0.1:8899
anchor deploy   # lub równoważny deploy programu predca
```

3. Utwórz lokalny mock mint USDC (6 decimals) i wpisz pubkey do env:

```bash
spl-token create-token --decimals 6
# skopiuj mint → NEXT_PUBLIC_USDC_MINT w .env.local
```

Mint **nie jest zahardcodowany** w programie — to konto w instrukcjach. Bez `NEXT_PUBLIC_USDC_MINT` UI pokaże ostrzeżenie i zablokuje init/deposit/withdraw.

4. Dev UI:

```bash
cd ~/prestocks-dca-noir3.0
npm run dev
```

Aplikacja: [http://localhost:3000/prestocks-dca-noir3.0](http://localhost:3000/prestocks-dca-noir3.0) (`basePath`).

Zmienne (patrz `.env.example`):

| Zmienna | Domyślnie |
|---------|-----------|
| `NEXT_PUBLIC_RPC_URL` | `http://127.0.0.1:8899` |
| `NEXT_PUBLIC_PREDCA_PROGRAM_ID` | `Eb3TFLeYi3dHZwoKCBvvUpx3gMnP2XdmMXX3rstUpdwC` |
| `NEXT_PUBLIC_USDC_MINT` | `3xtTBfHRf8AKEmhbFYqRoXfi9RaxxiqG9YfifjCjD4qm` (mock devnet) |
| `NEXT_PUBLIC_DCA_API_URL` | *(puste — fallback z buildu; w runtime wygrywa `config.json`)* |
| `NEXT_PUBLIC_KEEPER_URL` | *(puste — fallback z buildu; w runtime wygrywa `config.json`)* |
| `NEXT_PUBLIC_BASE_PATH` | `/prestocks-dca-noir3.0` |

Adres API i keepera nie musi być wbudowany w JS. Przy starcie strona pobiera `${basePath}/config.json` (szablon: `public/config.json`) i używa go przed zmiennymi z buildu.

Priorytet API: niepuste `dcaApiUrl` z `config.json`, potem `NEXT_PUBLIC_DCA_API_URL`, potem pusto (klient nie woła API).

Priorytet keepera: `keeperUrl` z `config.json`, potem `dcaApiUrl` z `config.json` + `/keeper`, potem `NEXT_PUBLIC_KEEPER_URL`, potem `NEXT_PUBLIC_DCA_API_URL` + `/keeper`, potem `http://127.0.0.1:8792`.

```json
{
  "dcaApiUrl": "",
  "keeperUrl": "",
  "updatedAt": ""
}
```

Tylko publiczne adresy `https` (w dev także `http` dla `localhost` i `127.0.0.1`) oraz opcjonalny `updatedAt`. Puste pole oznacza fallback do zmiennej z buildu. **Nie wolno** wpisywać tu kluczy, tokenów, Privy ID, klucza TypeSafe ani adresu RPC z kluczem. Nie commituj prawdziwego adresu tunelu — w repo zostaje pusty szablon.

IDL jest skopiowane do `idl/predca.json` (aplikacja self-contained — bez runtime importu z `/workspace/predca`).

## Build

```bash
npm run build
npm start
```

Build **nie wymaga** żywego validatora (tylko typy + IDL).

## Ekrany

1. **Overview** — salda Predca on-chain (budżet, vault USDC, ostatni RunRecord), Initialize / Deposit / Withdraw, mock holdings pie (off-chain), connect wallet
2. **Ustawienia** — budżet → `set_weekly_budget` / `initialize_user` gdy portfel + mint; BYOK w localStorage
3. **Historia** — RunRecord on-chain (skan `run_index` 0…), inaczej mock z adnotacją

`record_run` **nie** jest akcją użytkownika w UI — zapisuje go job off-chain; UI tylko czyta RunRecord.

## Portfel podłączony vs odłączony

| Stan | Zachowanie |
|------|------------|
| Odłączony | Mock salda/holdings/historia; brak tx Predca |
| Podłączony, brak mint | Ostrzeżenie o `NEXT_PUBLIC_USDC_MINT` |
| Podłączony, brak UserConfig | Przycisk **Initialize** |
| Podłączony + config | Deposit / Withdraw / zapis budżetu; Historia z chain jeśli są RunRecord |

## BYOK (Bring Your Own Key)

W **Ustawieniach** pole TypeSafe może być już wypełnione kluczem demo. Wklejasz własny, żeby go zastąpić. Zapis w **localStorage** (`noir3.prestocks.TYPESAFE_API_KEY`) — klient nadal wysyła ten klucz do `/rank`. Serwer nie dostaje osobnego fallbacku.

Build z `NEXT_PUBLIC_TYPESAFE_DEFAULT_KEY` wpisuje tę wartość do localStorage **tylko przy pierwszej wizycie** (klucza jeszcze nie ma). Zapis własnego klucza zostaje. Wyczyszczenie pola i zapis zostawia pusty string — Jev nie wraca, dopóki znowu nie zapiszesz klucza. Build bez tej zmiennej zachowuje się jak wcześniej: puste Ustawienia, brak Jev.

`NEXT_PUBLIC_*` trafia do bundla przeglądarki. Klucz demo da się odczytać z JS na Pages. To świadomy kompromis playgroundu, nie sekret serwera. Prawdziwej wartości nie commituj: CI / lokalny `.env.local` (gitignore).

| Klucz | Opis |
|-------|------|
| `TYPESAFE_API_KEY` | Jev — demo albo własny klucz w `noir3.prestocks.TYPESAFE_API_KEY`. Jest → etykieta źródła „BYOK · Jev”. Pusto → ranking metryczny. |
| `XAI_API_KEY` | Grok — **opcjonalny**; pusty = metrics→Jev bez LLM (`noir3.prestocks.XAI_API_KEY`) |

## GitHub Pages (static / DEVNET)

Docelowy adres (osobny od noir / noir 2.0 na tym samym originie):
**https://krzysztofpazdyk.github.io/prestocks-dca-noir3.0/**

- Build uses `output: 'export'` with `basePath` / `assetPrefix` `/prestocks-dca-noir3.0`.
- Production env (`.env.production`) points at **Solana DEVNET** and predca 3.0. `NEXT_PUBLIC_DCA_API_URL` i `NEXT_PUBLIC_KEEPER_URL` są puste w repo i są tylko fallbackiem z buildu. Działający adres jest w `config.json` obok strony. Puste oba źródła są poprawne: klient nie woła API; keeper zostaje przy `http://127.0.0.1:8792`.
- Po restarcie tunelu Cloudflare (adres się zmienia) nie rób `npm ci` ani buildu. (a) Odczytaj nowy adres. (b) Zapisz jeden plik w katalogu głównym gałęzi `gh-pages`, obok `index.html` (na Pages jest to `/prestocks-dca-noir3.0/config.json`):

  ```bash
  node scripts/write-runtime-config.mjs "https://<tunel>.trycloudflare.com" /ścieżka/do/gh-pages/config.json
  ```

  (c) Jeden commit na `gh-pages` i push fast-forward. Następne załadowanie strony bierze nowy adres (żądanie ma `cache: no-store` i parametr `?t=`).
- Przy pełnym deployu `public/config.json` trafia do eksportu (`out/config.json`). Deploy musi zapisać aktualny adres: uruchom skrypt przed buildem na `public/config.json` albo podmień plik po skopiowaniu `out/`. Nie nadpisuj szablonu w tym repo prawdziwym adresem tunelu. W pliku nie ma sekretów.
- `NEXT_PUBLIC_TYPESAFE_DEFAULT_KEY` zostaw puste w repozytorium. Przed buildem Pages ustaw tę zmienną w środowisku builda. Bez niej demo nie wpisuje klucza. Wartość i tak widać w JS strony.
- Ta kopia nie ma `.github/workflows/pages.yml`. Deploy jest ręczny.

## Klucze storage (`noir3.`)

localStorage, sessionStorage i cache na `krzysztofpazdyk.github.io` są wspólne dla noir, noir 2.0 i noir 3.0. Ta aplikacja **nie czyta** starych kluczy (bez migracji). Każdy własny klucz ma prefiks `noir3.`:

| Klucz | Gdzie |
|-------|--------|
| `noir3.prestocks.TYPESAFE_API_KEY` | localStorage, BYOK Jev |
| `noir3.prestocks.XAI_API_KEY` | localStorage, BYOK Grok |
| `noir3.prestocks.session.products` | sessionStorage, katalog produktów |
| `noir3.prestocks.session.rank` | sessionStorage, ostatni ranking |
| `noir3.prestocks.deadlineInvalid` | localStorage |
| `noir3.prestocks.ipoPremiumMatters` | localStorage |
| `noir3.prestocks.buyDespiteIpo` | localStorage |
| `noir3.prestocks.exclusions` | localStorage |
| `noir3.prestocks.companyData.v1` | localStorage |
| `noir3.prestocks.autoWeeklyBuy` | localStorage (`.{owner}` gdy jest portfel) |
| `noir3.prestocks.autoWeeklyBuy.meta` | localStorage (`.{owner}`) |
| `noir3.predca_weekly_budget_usd` | localStorage (`.{owner}`) |
| `noir3.predca_weekly_budget_usd.__migrated` | localStorage, znacznik odrzucenia niescopowanego budżetu |
| `noir3.predca_weekly_budget_usd.__draft` | sessionStorage |
| `noir3.predca_mock_portfolio_v1` | localStorage |
| `noir3.predca.pendingTx.v1.{owner}` | localStorage |
| `noir3.predca.jupPrices.v1` | localStorage |
| `noir3.predca_locale` | localStorage, PL/EN |
| `noir3.predca.keeper.session.{owner}` | localStorage (sesja keepera) |

Brak IndexedDB, ciasteczek aplikacji i service workera. Klucze Privy (`privy-*`, ciasteczka SDK) należą do SDK i nie dostają prefiksu `noir3.`.

## Changelog

- noir 3.0 = predca 3.0 (priced buys v2), first version

## Phantom / Solflare / Privy

W Phantom lub Solflare ustaw sieć na **Devnet** przed łączeniem. UI Pages jest na `https://api.devnet.solana.com` — Mainnet nie zadziała z tym deployem.

Jeden przycisk **Select Wallet** otwiera listę: Phantom, Solflare i — gdy ustawione jest `NEXT_PUBLIC_PRIVY_APP_ID` — Privy. Puste App ID zostawia tylko Phantom i Solflare.

**Privy** jest opcjonalnym trzecim portfelem (e-mail lub Google + wbudowany portfel Solana). To **osobny adres** niż Phantom i Solflare, więc vault Predca jest pusty, dopóki nie użyjesz faucetu Devnet i wpłaty (init + deposit). Przełączenie portfela przełącza właściciela on-chain, vault i keepera. Auto-buy (keeper) układa własny ranking; ręczny zakup na Overview używa listy metryk z UI — to celowo różne ścieżki.

Publiczny identyfikator (bez App Secret):

```
NEXT_PUBLIC_PRIVY_APP_ID=
```

W dashboardzie Privy: **Solana Devnet**, embedded wallets włączone, login email + Google, allowed origins `https://krzysztofpazdyk.github.io` i `http://localhost:3000`. Puste `NEXT_PUBLIC_PRIVY_APP_ID` w `.env.production` jest OK, dopóki App ID nie zostanie wpisane przed buildem Pages. App Secret nie trafia do repo.

