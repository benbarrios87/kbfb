# Vaktbytte fase 2: ekte push-varsler - oppsett (gjøres én gang)

Alt av kode er ferdig og ligger i repoet. Det som gjenstår er tre
manuelle steg i Supabase Studio - ingen kommandolinje/CLI nødvendig,
samme fremgangsmåte som ble brukt for `create-employee-login`.

## 1. Kjør SQL-en for den nye tabellen

Åpne `supabase-auth-setup.sql`, finn **STEP 26: kbfb_push_subscriptions**
helt nederst, og kjør bare den blokken i Supabase Studio → SQL Editor →
New query. (Trygt å kjøre hele fila på nytt også, som vanlig.)

## 2. Deploy Edge-funksjonen `send-push-notification`

1. Supabase Studio → Edge Functions → Create a new function
2. Navngi den nøyaktig `send-push-notification`
3. Lim inn hele innholdet i `supabase/functions/send-push-notification/index.ts`
4. Deploy

## 3. Sett de tre hemmelighetene (secrets) på funksjonen

Supabase Studio → Edge Functions → `send-push-notification` → Secrets,
legg til:

| Navn | Verdi |
|---|---|
| `VAPID_PUBLIC_KEY` | `BB92MHo91AseC98rWXwcVt-ZoV5ZWHTIJe7ILE7oomXPR11GxfaajTGZG9IlJ9gt_JvhuzBT6VtVo10CXVE-Shk` |
| `VAPID_PRIVATE_KEY` | `q9Bi7OkIy6cvthjv-AHB3TPHuWdA1-34a7iMCZGXBz8` |
| `VAPID_SUBJECT` | `mailto:benbarrios87@gmail.com` |

Den offentlige nøkkelen er allerede lagt inn i `app.js`
(`VAPID_PUBLIC_KEY`-konstanten) - de to må matche hverandre, så ikke
regenerer et nytt nøkkelpar uten å oppdatere begge steder.

`VAPID_SUBJECT` skal være en mailto:-adresse push-tjenestene (Google,
Apple, Mozilla) kan kontakte hvis noe går galt med varslene deres -
den vises aldri for ansatte. Bytt den til en annen adresse hvis du
heller vil bruke en annen.

`SUPABASE_URL` og `SUPABASE_SERVICE_ROLE_KEY` trenger IKKE settes -
Supabase gir funksjonen disse automatisk, akkurat som for
`create-employee-login`.

## Ferdig - hvordan det virker for ansatte

- På Dashboard → "Min konto" er det nå en "🔔 Skru på varsler på denne
  enheten"-knapp. Hver ansatt må trykke denne selv, på hver enhet de
  vil ha varsler på (telefon og PC regnes som to enheter).
- Når noen sender en byttforespørsel, får mottakeren et ekte
  push-varsel - virker selv om appen/nettleseren ikke er åpen.
- Når et bytte godtas, varsles avdelingsleder(ne) for de(t) berørte
  avdelingene.
- Trykk på et varsel åpner/fokuserer `vakter.html`.

## Om noe ikke virker

- Sjekk at alle tre secrets faktisk er lagret (de vises ikke igjen
  etter lagring, kun navnene) - vanligste feil er en skrivefeil i en
  av verdiene over.
- Browser-konsollen på `send-push-notification`-siden i Supabase
  Studio (Logs-fanen) viser feilmeldinger fra selve sendingen.
- iPhone/iPad krever at siden er lagt til på Hjem-skjermen ("Legg til
  på Hjem-skjerm" fra Safari) for at push skal virke i det hele tatt -
  ren nettleser-fane støtter ikke push på iOS.
