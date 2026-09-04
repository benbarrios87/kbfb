-- Årshjul for Pedagogisk leder - importert fra to nettverksbarnehage-maler
-- ("Årshjul for pedledere redigert aug 24" fra Oddenskogen barnehage, og
-- "Årshjul for pedagogisk leder" fra Epleskogen barnehage), slått sammen
-- og rensket for duplikater. Kan kjøres direkte, ingen skjemaendring
-- nødvendig først.
--
-- To deler:
-- 1) kbfb_arshjul_routines - ting som gikk igjen i så godt som hver eneste
--    måned i begge kildedokumentene (månedsbrev, ukeplaner, aktivitetsplikten,
--    fraværsregistrering, evaluering...) - trukket ut ÉN gang hver i stedet
--    for å gjenta dem i alle 12 månedene.
-- 2) kbfb_arshjul_items - det som faktisk er måned-spesifikt, august-juli.
--
-- Alt er lagt inn per instruks ("legg inn alt") - fjern det som ikke
-- passer KBFB direkte i Årshjul-siden (Rediger-knapp per punkt) etterpå.

-- =========================================================
-- 1) FASTE RUTINER
-- =========================================================

INSERT INTO public.kbfb_arshjul_routines (variant, frequency, title, notat) VALUES
  ('Pedagogisk leder', 'Månedlig', 'Månedsplan og månedsbrev', 'Publisere månedsplan på hjemmesiden (innen den 1. i måneden) og sende månedsbrev til foreldrene med oppsummering av forrige måned og tema for denne måneden'),
  ('Pedagogisk leder', 'Månedlig', 'Ukeplaner', 'Lage og publisere ukeplaner'),
  ('Pedagogisk leder', 'Månedlig', 'Aktivitetsplikten', 'Det psykososiale miljøet: følge med, melde ifra, undersøke, sette inn tiltak'),
  ('Pedagogisk leder', 'Månedlig', 'Registrere fravær, overtid og avspasering', 'For personalet på avdelingen'),
  ('Pedagogisk leder', 'Månedlig', 'Evaluering', 'Evaluere måneden som har gått'),
  ('Pedagogisk leder', 'Månedlig', 'Korte samtaler med barneveilederne', '3–10 minutters samtaler, ca. en gang i måneden'),
  ('Pedagogisk leder', 'Månedlig', 'Møter med samarbeidspartnere', 'F.eks. PPT, BUP, barnevernet'),
  ('Pedagogisk leder', 'Månedlig', 'Skrive søknader og pedagogiske rapporter', NULL),
  ('Pedagogisk leder', 'Månedlig', 'Lage timeplaner for barn med timer/spesielle behov', NULL),
  ('Pedagogisk leder', 'Månedlig', 'Sette mål og fokus fremover for hvert enkelt barn', NULL),
  ('Pedagogisk leder', 'Ukentlig', 'Vaktlister', 'Lage vaktlister og gjøre endringer som trengs'),
  ('Pedagogisk leder', 'Ukentlig', 'Avdelingsmøter', 'Forberede og lede avdelingsmøter'),
  ('Pedagogisk leder', 'Ukentlig', 'Ledermøter, personalmøter og plandager', 'Forberede'),
  ('Pedagogisk leder', 'Ukentlig', 'Samarbeide med de andre lederne på huset', NULL),
  ('Pedagogisk leder', 'Ukentlig', 'Informere foreldre', 'Informere foreldrene om tanker vi har rundt barna deres'),
  ('Pedagogisk leder', 'Daglig', 'Følge opp personalet', 'Følge opp hver enkelt i det daglige - småprater, tilbakemeldinger, spørsmål, informasjon og veiledning'),
  ('Pedagogisk leder', 'Daglig', 'Se og følge opp alle barna', NULL),
  ('Pedagogisk leder', 'Daglig', 'Notere psykososialt miljø', 'Notere små og store ting gjennom året i forhold til det psykososiale miljøet'),
  ('Pedagogisk leder', 'Daglig', 'Møte foreldre', 'Møte foreldrene når det er noe de har på hjertet');

-- =========================================================
-- 2) MÅNEDSPUNKTER (august - juli)
-- =========================================================

INSERT INTO public.kbfb_arshjul_items (variant, month, title, description) VALUES
  -- AUGUST (8)
  ('Pedagogisk leder', 8, 'Oppstartssamtale med nye foreldre', 'Bruk barnehagens eget skjema'),
  ('Pedagogisk leder', 8, 'Gjennomgang av COS-sirkelen med personalet', NULL),
  ('Pedagogisk leder', 8, 'Samtale med nytt personale', NULL),
  ('Pedagogisk leder', 8, 'Følge opp at alle i personalet går gjennom personalhåndboken på Mentor', NULL),
  ('Pedagogisk leder', 8, 'Tilvenning - personalet tildeles ansvarsbarn', NULL),
  ('Pedagogisk leder', 8, 'Lage mappe på alle barn', 'Legge inn alle dokumentene som skal fylles ut'),
  ('Pedagogisk leder', 8, 'Planleggingsdag', NULL),
  ('Pedagogisk leder', 8, 'Lage halvårsplan', 'Ut fra årets satsningsområde, høytider og barnehagens tradisjoner'),
  ('Pedagogisk leder', 8, 'Oppdatere adresselister for barn på hjemmesiden', 'Gamle slettes/overføres 31.07'),
  ('Pedagogisk leder', 8, 'Oppdatere avdelingsinformasjon og satsningsområde på hjemmesiden', NULL),
  ('Pedagogisk leder', 8, 'Sjekke vaktlister', NULL),
  ('Pedagogisk leder', 8, 'Dagsplan og ukeplan for barn med spesielle behov', 'Arbeidsverktøy for assistentene, utarbeides i samarbeid med spes.ped'),

  -- SEPTEMBER (9)
  ('Pedagogisk leder', 9, 'Foreldremøte', 'Forberedelse sammen med de andre lederne'),
  ('Pedagogisk leder', 9, 'Trivselssamtaler med maxi og mim', NULL),
  ('Pedagogisk leder', 9, 'Gå gjennom maxisjekklisten', NULL),
  ('Pedagogisk leder', 9, 'Gjennomføre psykososialt arbeidsmiljø-sjekkliste på Mentor', NULL),
  ('Pedagogisk leder', 9, 'Observasjoner og fargeskjema (K. Pape) av alle barn', 'Eget skjema, i samarbeid med assistentene'),
  ('Pedagogisk leder', 9, 'Nettverksmøter', NULL),
  ('Pedagogisk leder', 9, 'Oppstart aldersinndelte grupper', 'Lage planer for gruppene og legge inn på hjemmesiden'),
  ('Pedagogisk leder', 9, 'Kartlegginger på enkeltbarn som skårer dårlig på observasjon', NULL),
  ('Pedagogisk leder', 9, 'Dugnad - ønsker og innspill', NULL),

  -- OKTOBER (10)
  ('Pedagogisk leder', 10, 'Trivselssamtaler med maxi og mim', NULL),
  ('Pedagogisk leder', 10, 'Kartlegge relasjoner mellom voksne og barn', NULL),
  ('Pedagogisk leder', 10, 'Gjennomgang av «Emosjonell førstehjelp» med personalet', NULL),
  ('Pedagogisk leder', 10, 'Gjennomføre barnas psykososiale barnehagemiljø-sjekkliste på Mentor', NULL),
  ('Pedagogisk leder', 10, 'Utviklingssamtaler', 'Gå gjennom alle barna med personalet i forkant, gi personalet tilbakemelding etterpå'),
  ('Pedagogisk leder', 10, 'Maxiforeldremøte', NULL),
  ('Pedagogisk leder', 10, 'Foreldrekaffe', NULL),
  ('Pedagogisk leder', 10, 'Nettverksmøter', NULL),
  ('Pedagogisk leder', 10, 'FN-markering', 'Forberede aktiviteter sammen med de andre avdelingene'),
  ('Pedagogisk leder', 10, 'Medarbeidersamtaler med assistentene', 'Eget skjema brukes'),

  -- NOVEMBER (11)
  ('Pedagogisk leder', 11, 'Gjennomgang av «problemløsningsstrategien» med personalet', NULL),
  ('Pedagogisk leder', 11, 'Utviklingssamtaler', NULL),
  ('Pedagogisk leder', 11, 'Foreldrekaffe', NULL),
  ('Pedagogisk leder', 11, 'Følge opp personalets avspasering', 'All avspasering tas ut før jul'),
  ('Pedagogisk leder', 11, 'Observasjoner av alle barna', 'I samarbeid med personalet på avdelingen, eget skjema kan brukes'),
  ('Pedagogisk leder', 11, 'Foreldresamtaler', 'Ta utgangspunkt i observasjoner og evalueringer fra avdelingsmøter'),
  ('Pedagogisk leder', 11, 'Planlegge juleaktiviteter', 'På avdeling og fellesaktiviteter på tvers av avdelinger'),

  -- DESEMBER (12)
  ('Pedagogisk leder', 12, 'Juleforberedelser', 'Lage julestemning og juleaktiviteter for barn og voksne'),
  ('Pedagogisk leder', 12, 'Vaktliste for neste halvår', NULL),
  ('Pedagogisk leder', 12, 'Evaluering av halvåret', NULL),
  ('Pedagogisk leder', 12, 'Planlegge ferie til personalet/barna i dagene før juleferie', NULL),

  -- JANUAR (1)
  ('Pedagogisk leder', 1, 'Relasjonskartlegging mellom barn og voksne', NULL),
  ('Pedagogisk leder', 1, 'Samtaler med barna om mobbing i små grupper', NULL),
  ('Pedagogisk leder', 1, 'Skrive nye pedagogiske rapporter?', NULL),
  ('Pedagogisk leder', 1, 'Planleggingsdag', NULL),
  ('Pedagogisk leder', 1, 'Halvårsplan/oversikt frem til sommeren', 'Ut fra årets satsningsområde, høytider og barnehagens tradisjoner'),

  -- FEBRUAR (2)
  ('Pedagogisk leder', 2, 'Foreldremøte', NULL),
  ('Pedagogisk leder', 2, 'Opptak', 'Delta sammen med styrer, med tanke på nye barnegrupper til høsten'),

  -- MARS (3)
  ('Pedagogisk leder', 3, 'Kartlegge relasjoner mellom barn og voksne', NULL),
  ('Pedagogisk leder', 3, 'Trivselssamtaler med maxi og mim', NULL),
  ('Pedagogisk leder', 3, 'Skrive søknader §37', NULL),
  ('Pedagogisk leder', 3, 'Koordinere ferie for voksne/barn på avdelingen i påskedagene', NULL),
  ('Pedagogisk leder', 3, 'Samarbeid mellom avdelingene', 'Felles påskeaktiviteter'),

  -- APRIL (4)
  ('Pedagogisk leder', 4, 'Utviklingssamtaler', NULL),
  ('Pedagogisk leder', 4, 'Gå gjennom maxisjekklisten med «midt-i-mellom»-barna', NULL),
  ('Pedagogisk leder', 4, 'Lage tilvenningsplan for oppstart av nye barn til høsten', NULL),
  ('Pedagogisk leder', 4, 'Fagdag med foreldre', 'Forberede aktiviteter på avdelingene'),
  ('Pedagogisk leder', 4, 'Observasjoner og fargeskjema (K. Pape) av alle barn', 'Eget skjema, i samarbeid med assistentene'),
  ('Pedagogisk leder', 4, 'Samle inn sommerferie for barn og personale', 'Før 1. mai'),
  ('Pedagogisk leder', 4, 'Koordinere sommerferie for personalet på avdelingen', 'Slik at det alltid er kjente voksne på jobb med barna - spesielt barn med spesielle behov'),
  ('Pedagogisk leder', 4, 'Ønsker og innspill til dugnad', NULL),

  -- MAI (5)
  ('Pedagogisk leder', 5, 'Overgangsskjema til skolen', 'Eventuelle overføringsmøter med skolen'),
  ('Pedagogisk leder', 5, 'Utviklingssamtaler', NULL),
  ('Pedagogisk leder', 5, 'Rammetekster og bilder til maxibarna', 'Og eventuelt andre barn som slutter'),
  ('Pedagogisk leder', 5, 'Foreldremøte med nye foreldre', NULL),
  ('Pedagogisk leder', 5, 'Skrive velkomstbrev med oppstartsdato til nye barn', NULL),
  ('Pedagogisk leder', 5, 'Foreldresamtaler', 'Ta utgangspunkt i observasjoner og evalueringer fra avdelingsmøter'),
  ('Pedagogisk leder', 5, 'Planleggingsdag', 'Oppsummering av årstema på avdelingen'),
  ('Pedagogisk leder', 5, 'Opptak/informasjonsmøte for nye foreldre', 'Sammen med de andre avdelingene'),
  ('Pedagogisk leder', 5, 'Besøksdag for nye barn', 'Lage velkomstbrev og sette oppstartsdato'),
  ('Pedagogisk leder', 5, 'Utarbeide ny årsplan i samarbeid med lederne', NULL),

  -- JUNI (6)
  ('Pedagogisk leder', 6, 'Besøk av nye barn og foreldre', NULL),
  ('Pedagogisk leder', 6, 'Evaluering av halvåret', NULL),
  ('Pedagogisk leder', 6, 'Tale til maxibarna', NULL),
  ('Pedagogisk leder', 6, 'Sommerbrev', NULL),
  ('Pedagogisk leder', 6, 'Ny vaktliste fra august', NULL),
  ('Pedagogisk leder', 6, 'Sommerfest for personalet', NULL),
  ('Pedagogisk leder', 6, 'Sommeravslutning for barn og foreldre', NULL),
  ('Pedagogisk leder', 6, 'Lage avskjedsgave/kort til barna som slutter i barnehagen', NULL),
  ('Pedagogisk leder', 6, 'Forberede oppstart til høsten', 'Få alle nye barn på plass på hjemmesiden'),
  ('Pedagogisk leder', 6, 'Barnehagen er stengt uke 27-30', 'God ferie!'),

  -- JULI (7)
  ('Pedagogisk leder', 7, 'Velfortjent ferie', 'Koble av og lade opp til nytt barnehageår 😊');
