-- Årshjul for Leder - importert fra KBFBs eget dokument
-- "ÅRSHJUL FOR LEDERGRUPPEN 2026.docx" (2026/2027). Dette er ikke en
-- generisk nettverksmal som de to pedagog-dokumentene - det er skrevet
-- for KBFB spesifikt (nevner Jenny, Bærum kommune, PBL Mentor, Mykid),
-- så innholdet er importert nokså tro mot originalen, kun den bokstavelig
-- identiske månedlige "Månedsplan/månedsbrev"-linjen er trukket ut til
-- kbfb_arshjul_routines (samme mønster som Pedagogisk leder-importen).
--
-- Merk: "Karneval fredag 13. mars" sto under Februar-avsnittet i
-- kildedokumentet (sannsynligvis planlegging i forkant av datoen) -
-- importert akkurat slik den sto. Flytt til riktig måned i appen
-- (Rediger-knapp -> flytt til måned) om det var en feil i originalen.

-- =========================================================
-- 1) FAST RUTINE
-- =========================================================

INSERT INTO public.kbfb_arshjul_routines (variant, frequency, title, notat) VALUES
  ('Leder', 'Månedlig', 'Månedsplan og månedsbrev', 'Publisere månedsplan på hjemmesiden (innen den 1. i måneden) og sende månedsbrev til foreldrene med oppsummering av forrige måned og tema for denne måneden');

-- =========================================================
-- 2) MÅNEDSPUNKTER (august - juni)
-- =========================================================

INSERT INTO public.kbfb_arshjul_items (variant, month, title, description) VALUES
  -- AUGUST (8)
  ('Leder', 8, 'Årets visjon, verdier og fokus 2026/2027', 'Visjon: Alle blir møtt med kjærlighet og opplever tilhørighet. Verdier: Ivaretakelse, Undring, Anerkjennelse og Ansvarliggjøring. Hovedfokus: Språk, Norge rundt, Tett på, lederskap. Mål: Alle barna skal oppleve seg elsket og ønsket'),
  ('Leder', 8, 'Tilvenning - personalet tildeles ansvarsbarn', NULL),
  ('Leder', 8, 'Oppstartssamtaler med de nye foreldrene', 'Bruk barnehagens eget skjema'),
  ('Leder', 8, 'Forventningsavklaring med dine ansatte', 'Hva forventer du av dem, hva forventer de av deg - alle skal ha hatt sin før september'),
  ('Leder', 8, 'Planleggingsdag', 'Pedagogene forbereder avdelingstiden'),
  ('Leder', 8, 'Lage halvårsplan (årshjul)', 'Ut fra årets satsningsområde, høytider og barnehagens tradisjoner'),
  ('Leder', 8, 'Skriv ditt fokus for barnehageåret', 'Noen setninger om hva du som leder vil fastholde og ha fokus på i ditt lederskap - send til Jenny innen 31.8'),
  ('Leder', 8, 'Oppdatere telefonlister', 'Fjern barn som har sluttet, legg inn nye foreldres telefonnummer'),
  ('Leder', 8, 'Sjekke og legge turnusen', NULL),
  ('Leder', 8, 'Oppdatere branninstruksen for avdelingen', NULL),
  ('Leder', 8, 'Sjekke at alle ansatte kan gjøre utesjekken på PBL Mentor', NULL),
  ('Leder', 8, 'Dagsplan og ukeplan for barn med spesielle behov', 'Arbeidsverktøy for assistentene, i samarbeid med spes.ped'),
  ('Leder', 8, 'Begynne å forberede foreldremøtet', 'Hva er viktig å få drøftet på møtet?'),
  ('Leder', 8, 'Tett på: forbered tema for september', NULL),
  ('Leder', 8, 'Beredskapsplanen til Bærum kommune', 'Alle på avdelingen har lest den og levert lesebekreftelse til Jenny, frist 27.8'),
  ('Leder', 8, 'Legg en plan for ubunden tid', 'Hvordan du skal ta ut din ubundne tid - husk å skrive det opp på turnusen, og lag gjerne en struktur for hva du skal gjøre når'),
  ('Leder', 8, 'Tett på: Produktivitet', 'Vi kan starte fra start igjen (positivt klima)'),

  -- SEPTEMBER (9)
  ('Leder', 9, 'Foreldremøte', 'Forberedelse sammen med de andre lederne'),
  ('Leder', 9, 'Observasjoner (røde, grønne barn) av alle barn', 'I samarbeid med assistentene'),
  ('Leder', 9, 'Hvordan går det med barnegruppa?', 'Er det barn som trenger at vi tilrettelegger?'),
  ('Leder', 9, 'Dugnad - ønsker og innspill', 'Sendes til Jenny senest 19. september'),
  ('Leder', 9, 'Gå gjennom ROS-analyser i PBL Mentor', 'Trenger noen oppdatering? Trenger du lage nye for din avdeling?'),
  ('Leder', 9, 'Forberede foreldresamtaler', 'Hvilken avdeling?'),
  ('Leder', 9, 'Tett på: forbered tema for oktober', NULL),
  ('Leder', 9, 'Rømningsøvelse for hele huset', '16. september'),

  -- OKTOBER (10)
  ('Leder', 10, 'FN-markering', 'Forberede aktiviteter sammen med de andre avdelingene'),
  ('Leder', 10, 'Pedagogene har medarbeidersamtaler med sine pedagogiske medarbeidere', NULL),
  ('Leder', 10, 'Kveldsledermøte med tema for alle ledere', '17. oktober'),
  ('Leder', 10, 'Planlegge juleaktiviteter', 'På avdeling og fellesaktiviteter på tvers av avdelinger'),
  ('Leder', 10, 'Agenda for avdelingstiden på planleggingsdagen i oktober', NULL),
  ('Leder', 10, 'Foreldresamtaler', 'Ta utgangspunkt i observasjoner og evalueringer fra avdelingsmøter'),
  ('Leder', 10, 'Hvordan jobber vi med lek på vår avdeling?', 'Hvordan merkes det i rommet, i dokumentasjonen til foreldre, og for barna?'),
  ('Leder', 10, 'Tett på: ta barnets perspektiv', 'Hvordan gjør dere det på deres avdeling? Hva trenger dere å øve på?'),
  ('Leder', 10, 'Tett på: forbered tema for november', NULL),
  ('Leder', 10, 'Planleggingsdag', '31. oktober'),
  ('Leder', 10, 'Send liste til Jenny', 'Hva dere trenger til juleverksted'),

  -- NOVEMBER (11)
  ('Leder', 11, 'Foreldresamtaler', 'Ta utgangspunkt i observasjoner og evalueringer fra avdelingsmøter - skriv hvilke avdelinger som har samtaler'),
  ('Leder', 11, 'Planlegge uttak av avspasering for personalet', 'Maks 7,5 timer kan overføres'),
  ('Leder', 11, 'Planlegge ferie til personalet/barna i dagene før juleferie', NULL),
  ('Leder', 11, 'Hvordan får språket ta plass hos oss?', 'Hvor bevisst er vi på hvordan vi bruker det i hverdagen?'),
  ('Leder', 11, 'Tett på: forbered tema for desember', NULL),

  -- DESEMBER (12)
  ('Leder', 12, 'Lage julestemning og juleaktiviteter for barn og voksne', NULL),
  ('Leder', 12, 'Skrive evaluering for halvåret', 'Ledere: gikk det som du tenkte i august?'),
  ('Leder', 12, 'Evaluere med avdelingen på avdelingsmøte', NULL),
  ('Leder', 12, 'Forberede planleggingsdagen', 'Hva er viktig å få drøftet på avdelingsmøtet?'),
  ('Leder', 12, 'Tett på: forbered tema for januar', NULL),
  ('Leder', 12, 'Tett på: veiledning og reguleringsstøtte', NULL),
  ('Leder', 12, 'Luciafeiring', 'Fredag 12. desember'),
  ('Leder', 12, 'Rød dag', 'Fredag 19. desember'),

  -- JANUAR (1)
  ('Leder', 1, 'Planleggingsdag', 'Fredag 2. januar'),
  ('Leder', 1, 'Halvårsplan/oversikt frem til sommeren', 'Ut fra årets satsningsområde, høytider og barnehagens tradisjoner'),
  ('Leder', 1, 'Foreldremøte for 5-års-foreldre om overgangen til skolen', 'Rikke og Jenny'),
  ('Leder', 1, 'Tett på: forbered deg og avdelingen på tema for februar', NULL),
  ('Leder', 1, 'Tett på: tilrettelegging for læring og utvikling', NULL),

  -- FEBRUAR (2)
  ('Leder', 2, 'Koordinere ferie for voksne/barn på avdelingen i påskedagene', NULL),
  ('Leder', 2, 'Send liste til Jenny', 'Hvis dere ønsker noe til påskeverksted'),
  ('Leder', 2, 'Tett på: forbered deg og avdelingen på tema for mars', NULL),
  ('Leder', 2, 'Tett på: utvikling av tenkning og forståelse', NULL),
  ('Leder', 2, 'Karneval', 'Fredag 13. mars'),

  -- MARS (3)
  ('Leder', 3, 'Frist for å søke om barnehageplass', '1. mars'),
  ('Leder', 3, 'Samarbeid mellom avdelingene - felles påskeaktiviteter?', NULL),
  ('Leder', 3, 'Ønsker og innspill til dugnad', NULL),
  ('Leder', 3, 'Foreldremøte?', NULL),
  ('Leder', 3, 'Barnehagedagen', '10. mars'),
  ('Leder', 3, 'Kveldsledermøte for alle ledere', NULL),
  ('Leder', 3, 'Tett på: forbered deg og avdelingen på tema for april', NULL),
  ('Leder', 3, 'Tett på: språkstøtte', NULL),
  ('Leder', 3, 'Gul dag', 'Fredag 27. mars'),
  ('Leder', 3, 'Påskeferien starter', 'Mandag 30. mars'),

  -- APRIL (4)
  ('Leder', 4, 'Observasjoner og fargeskjema (K. Pape) av alle barn', 'Eget skjema, i samarbeid med assistentene'),
  ('Leder', 4, 'Samle inn sommerferie for barn og personale', 'Før 1. mai'),
  ('Leder', 4, 'Koordinere sommerferie for personalet på avdelingen', 'Slik at det alltid er kjente voksne på jobb med barna - spesielt barn med spesielle behov'),
  ('Leder', 4, 'Tett på: forbered deg og avdelingen på tema for mai', NULL),
  ('Leder', 4, 'Tett på: hva trenger dere å jobbe mer med?', NULL),

  -- MAI (5)
  ('Leder', 5, 'Foreldresamtaler', 'Ta utgangspunkt i observasjoner og evalueringer fra avdelingsmøter'),
  ('Leder', 5, 'Utarbeide ny årsplan i samarbeid med lederne', NULL),
  ('Leder', 5, 'Plan for uttak av avspasering for personalet', 'All avspasering skal være tatt ut til starten av juni'),
  ('Leder', 5, 'Lage velkomstbrev og sette oppstartsdato for nye barn', 'Sammen med Jenny'),
  ('Leder', 5, 'Forberede sommerfesten for barna', 'Noe som skal utstilles?'),
  ('Leder', 5, 'Fotografering', '7. mai'),

  -- JUNI (6)
  ('Leder', 6, 'Informasjonsmøte for nye foreldre', 'Sammen med de andre lederne'),
  ('Leder', 6, 'Besøksdag for nye barn', '3 stk'),
  ('Leder', 6, 'Sommerfest for personalet', '19. juni'),
  ('Leder', 6, 'Sommeravslutning for barn og foreldre', '17. juni'),
  ('Leder', 6, 'Lage avskjedsgave/kort til barna som slutter i barnehagen', NULL),
  ('Leder', 6, 'Sommerhilsen til foreldrene', NULL),
  ('Leder', 6, 'Evaluere året med lederteamet', NULL),
  ('Leder', 6, 'Evaluere året med avdelingen din', NULL),
  ('Leder', 6, 'Sette sluttdato på alle som slutter på din avdeling', 'Mykid'),
  ('Leder', 6, 'Sette flyttedato på alle barn som bytter avdeling', 'Mykid'),
  ('Leder', 6, 'Legge inn alle nye barn', 'Mykid'),
  ('Leder', 6, 'Alle garderober skal vaskes', NULL),
  ('Leder', 6, 'Alle kjøleskap skal vaskes', NULL),
  ('Leder', 6, 'Forberede oppstart til høsten', 'Få alle nye barns navn på plass i garderobene');
