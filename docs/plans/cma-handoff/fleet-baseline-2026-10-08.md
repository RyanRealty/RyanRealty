# CMA fleet dry run 2026-10-08T18-10-39.169Z

```
CMA fleet dry run 2026-10-08T18-10-39.169Z
git 95af9d7bdbc0b70157204b8fe2c136c7de780650 on HEAD
baseline 2026-10-08T13-55-32.376Z @ 31382ad9ee09c589eb06c04871d1d77e61228f90 (/tmp/claude-0/-home-user-RyanRealty/22836b4c-98ba-5bdb-a5f1-615225570f2c/scratchpad/fleet/final2/latest.json)
engine: deterministic-half (LLM judge and adversarial audit skipped; a build here is a ceiling on a real build)
source: queue
config: city bend · states failed,flagged,ready,audit-failed,unvetted · kind expired · since none · limit none · slugs none · concurrency 5 · timeout 600s · retries 1 · threshold 1% · baseline /tmp/claude-0/-home-user-RyanRealty/22836b4c-98ba-5bdb-a5f1-615225570f2c/scratchpad/fleet/final2/latest.json · raw true · latest true
selection: queue rows 469 (truncated false) · cma 466 · kind 408 · states 387 · since 387 · with coordinates 386 · inside 139 · outside 247 · name fallback 1 · selected 140 · boundary city/bend (1 rings)
WARNING: the dry-run harness itself changed between runs

FAIL     cma-1015-4th               comps    The search in Larkspur found no price-setting sales; 5 are needed. It st   stored failed         20s
FAIL     cma-1027-albany            comps    The search in River West found 2 price-setting sales (1405 Davenport, 16   stored flagged        163s
FAIL     cma-111-hawthorne          comps    The search in River West found no price-setting sales; 5 are needed. It    stored failed         34s
FAIL     cma-115-mount-washington   comps    The search in Century West found 1 price-setting sale (133 Mt Washington   stored audit-failed   193s
FAIL     cma-120-sisemore           comps    The search in Old Bend found no price-setting sales; 5 are needed. It st   stored flagged        222s
FAIL     cma-139-roosevelt          comps    The search in Larkspur found no price-setting sales; 5 are needed. It st   stored failed         201s
FAIL     cma-1913-monterey-mews     comps    The search in Summit West found no price-setting sales; 5 are needed. It   stored failed         17s
FAIL     cma-19318-marshmallow      comps    The search in Century West found 3 price-setting sales (61197 Beverly, 1   stored audit-failed   149s
FAIL     cma-19358-laurelhurst      comps    The search in Century West found 1 price-setting sale (61329 Big Eddy);    stored failed         40s
FAIL     cma-1940-monterey-pines    comps    The search in Summit West found 3 price-setting sales (1940 Monterey Pin   stored failed         17s
FAIL     cma-19479-campbell         comps    The search in Century West found no price-setting sales; 5 are needed. I   stored flagged        181s
FAIL     cma-19635-clear-night      comps    The search in Century West found 3 price-setting sales (19700 Sunshine,    stored audit-failed   114s
FAIL     cma-19717-mt-bachelor      comps    The search in Century West found 1 price-setting sale (19717 Mount Bache   stored failed         37s
FAIL     cma-1975-harriman          comps    value-has-a-basis: No price tier could be resolved for this home, and th   stored failed         228s
FAIL     cma-20-mccann              comps    The search in Old Bend found no price-setting sales; 5 are needed. It st   stored failed         9s
FAIL     cma-20090-mount-faith      comps    The search in Southwest Bend found no price-setting sales; 5 are needed.   stored failed         262s
FAIL     cma-20184-merriewood       comps    The search in Southern Crossing found 3 price-setting sales (61406 Dunca   stored flagged        237s
FAIL     cma-23-benaiah             comps    The search in Larkspur found 2 price-setting sales (31 Benaiah, 1111 Pal   stored flagged        112s
FAIL     cma-2339-labiche           comps    The search in Summit West found 4 price-setting sales (1649 William Clar   stored flagged        16s
FAIL     cma-24-roosevelt           comps    The search in Southern Crossing found no price-setting sales; 5 are need   stored failed         166s
FAIL     cma-2545-awbrey            comps    The search in Awbrey Butte found 3 price-setting sales (2539 Awbrey, 259   stored ready          200s
FAIL     cma-2745-ordway            comps    The search in Summit West found no price-setting sales; 5 are needed. It   stored failed         6s
FAIL     cma-3266-celilo            comps    The search in Summit West found 3 price-setting sales (3274 Celilo, 3292   stored flagged        121s
FAIL     cma-506-14th               comps    The search in River West found no price-setting sales; 5 are needed. It    stored audit-failed   240s
FAIL     cma-61084-parrell          comps    The search in Southeast Bend found 1 price-setting sale (20270 Fairway);   stored flagged        175s
FAIL     cma-61251-grotto           comps    The search found no price-setting sales; 5 are needed. It stopped becaus   stored failed         43s
FAIL     cma-63385-omer             comps    The search in Boyd Acres found 2 price-setting sales (20805 Morningstar,   stored failed         121s
FAIL     cma-641-marshall           comps    The search in Orchard District found 4 price-setting sales (637 Marshall   stored flagged        63s
FAIL     cma-65-bond                comps    The search in Southern Crossing found no price-setting sales; 5 are need   stored failed         19s
FAIL     cma-714-10th               comps    The search in Orchard District found 1 price-setting sale (975 Norton);    stored flagged        173s
FAIL     cma-970-norton             comps    The search in Orchard District found 1 price-setting sale (910 Norton);    stored failed         14s
HOLD     cma-1122-foxwood           comps 5  rec $2,000,000  ask $2,757,000  -27.5% UNDER            stored failed         61s
HOLD     cma-1235-hartford          comps 7  rec $884,000    ask $1,750,000  -49.5% UNDER            stored failed         113s
HOLD     cma-1265-remarkable        comps 7  rec $1,281,000  ask $1,845,000  -30.6% UNDER            stored flagged        151s
HOLD     cma-140-4th                comps 5  rec $435,000    ask $519,000    -16.2% UNDER            stored failed         39s
HOLD     cma-1975-butler-market     comps 5  rec $487,000    ask $624,500    -22.0% UNDER            stored flagged        125s
HOLD     cma-19920-ponderosa        comps 5  rec $547,000    ask $749,950    -27.1% UNDER            stored flagged        124s
HOLD     cma-2083-lemhi-pass        comps 5  rec $1,735,000  ask $2,095,000  -17.2% UNDER            stored flagged        172s
HOLD     cma-21315-livingston       comps 7  rec $492,000    ask $599,000    -17.9% UNDER            stored failed         158s
HOLD     cma-21380-oakview          comps 5  rec $562,000    ask $679,900    -17.3% UNDER            stored flagged        160s
HOLD     cma-2667-jones             comps 5  rec $503,000    ask $600,000    -16.2% UNDER            stored ready          33s
HOLD     cma-3153-cromwell          comps 5  rec $609,000    ask $725,000    -16.0% UNDER            stored ready          178s
HOLD     cma-454-burnside           comps 5  rec $610,000    ask $1,075,000  -43.3% UNDER   FLAGGED  stored flagged        246s
HOLD     cma-69-piper               comps 6  rec $433,000    ask $524,000    -17.4% UNDER            stored failed         66s
BUILD    cma-1117-milwaukee         comps 5  rec $637,000    ask $650,000    -2.0%          FLAGGED  stored audit-failed   61s
BUILD    cma-1355-jacksonville      comps 5  rec $732,000    ask $734,999    -0.4%                   stored ready          65s
BUILD    cma-1517-mt-washington     comps 5  rec $876,000    ask $889,000    -1.5%          FLAGGED  stored flagged        115s
BUILD    cma-1617-8th               comps 5  rec $592,000    ask $599,000    -1.2%          FLAGGED  stored flagged        119s
BUILD    cma-1624-overlook          comps 7  rec $2,216,000  ask $2,475,000  -10.5%         FLAGGED  stored failed         84s
BUILD    cma-1648-pheasant          comps 5  rec $560,000    ask $599,900    -6.7%                   stored flagged        84s
BUILD    cma-1805-diablo            comps 6  rec $553,000    ask $559,900    -1.2%          FLAGGED  stored failed         157s
BUILD    cma-19658-harvard          comps 5  rec $721,000    ask $729,900    -1.2%          FLAGGED  stored flagged        173s
BUILD    cma-19717-mount-bachelor   comps 7  rec $602,000    ask $640,000    -5.9%                   stored failed         22s
BUILD    cma-19737-aspen-meadows    comps 5  rec $627,000    ask $639,000    -1.9%          FLAGGED  stored flagged        190s
BUILD    cma-19815-nugget           comps 5  rec $715,000    ask $725,000    -1.4%          FLAGGED  stored flagged        173s
BUILD    cma-19827-powers           comps 5  rec $591,000    ask $599,000    -1.3%          FLAGGED  stored flagged        191s
BUILD    cma-19877-mahogany         comps 5  rec $414,000    ask $464,999    -11.0%                  stored failed         47s
BUILD    cma-19985-voltera          comps 5  rec $805,000    ask $869,000    -7.4%                   stored failed         182s
BUILD    cma-20165-stonegate        comps 6  rec $877,000    ask $890,000    -1.5%          FLAGGED  stored ready          196s
BUILD    cma-20435-powder-mountain  comps 7  rec $866,000    ask $889,900    -2.7%          FLAGGED  stored flagged        212s
BUILD    cma-20506-murphy           comps 5  rec $718,000    ask $729,000    -1.5%          FLAGGED  stored flagged        266s
BUILD    cma-20513-byron            comps 7  rec $610,000    ask $619,999    -1.6%          FLAGGED  stored flagged        292s
BUILD    cma-20594-slate            comps 7  rec $581,000    ask $589,900    -1.5%          FLAGGED  stored ready          263s
BUILD    cma-20606-daisy            comps 7  rec $494,000    ask $499,000    -1.0%          FLAGGED  stored flagged        123s
BUILD    cma-20607-boer             comps 7  rec $817,000    ask $827,900    -1.3%          FLAGGED  stored ready          221s
BUILD    cma-20653-foxborough       comps 5  rec $571,000    ask $579,000    -1.4%                   stored failed         171s
BUILD    cma-20665-tango-creek      comps 5  rec $610,000    ask $619,000    -1.5%          FLAGGED  stored ready          193s
BUILD    cma-20676-wild-rose        comps 5  rec $593,000    ask $599,900    -1.2%          FLAGGED  stored flagged        187s
BUILD    cma-20705-snow-peaks       comps 5  rec $561,000    ask $569,000    -1.4%          FLAGGED  stored failed         163s
BUILD    cma-20726-russell          comps 5  rec $523,000    ask $565,000    -7.4%                   stored flagged        132s
BUILD    cma-20850-delta            comps 7  rec $804,000    ask $814,900    -1.3%          FLAGGED  stored flagged        183s
BUILD    cma-20867-caldera          comps 7  rec $675,000    ask $685,000    -1.5%          FLAGGED  stored ready          182s
BUILD    cma-209-soft-tail          comps 7  rec $711,000    ask $729,000    -2.5%          FLAGGED  stored flagged        194s
BUILD    cma-2106-black-pines       comps 7  rec $852,000    ask $889,000    -4.2%          FLAGGED  stored flagged        160s
BUILD    cma-21154-darnel           comps 5  rec $551,000    ask $559,000    -1.4%          FLAGGED  stored ready          173s
BUILD    cma-21190-darnel           comps 5  rec $492,000    ask $499,900    -1.6%          FLAGGED  stored flagged        165s
BUILD    cma-21245-golden-market    comps 5  rec $633,000    ask $640,000    -1.1%          FLAGGED  stored flagged        162s
BUILD    cma-21512-etna             comps 7  rec $625,000    ask $649,999    -3.8%          FLAGGED  stored flagged        168s
BUILD    cma-2293-lynda             comps 5  rec $650,000    ask $660,000    -1.5%          FLAGGED  stored failed         169s
BUILD    cma-2375-majestic-ridge    comps 7  rec $856,000    ask $895,000    -4.4%          FLAGGED  stored flagged        228s
BUILD    cma-2382-jackson           comps 5  rec $625,000    ask $639,000    -2.2%                   stored flagged        174s
BUILD    cma-2394-crocus            comps 5  rec $552,000    ask $559,000    -1.3%          FLAGGED  stored flagged        25s
BUILD    cma-2462-lynda             comps 5  rec $548,000    ask $619,000    -11.5%                  stored flagged        150s
BUILD    cma-2531-locke             comps 7  rec $687,000    ask $698,000    -1.6%          FLAGGED  stored flagged        55s
BUILD    cma-2533-monterey-pines    comps 5  rec $634,000    ask $642,000    -1.2%          FLAGGED  stored failed         112s
BUILD    cma-2543-marken            comps 5  rec $1,235,000  ask $1,250,000  -1.2%          FLAGGED  stored flagged        177s
BUILD    cma-2681-moonlight         comps 5  rec $499,000    ask $575,000    -13.2%                  stored failed         124s
BUILD    cma-2745-aldrich           comps 5  rec $479,000    ask $495,000    -3.2%                   stored ready          99s
BUILD    cma-2781-spring-water      comps 5  rec $541,000    ask $549,900    -1.6%          FLAGGED  stored failed         183s
BUILD    cma-2849-lotno             comps 5  rec $490,000    ask $545,000    -10.1%                  stored flagged        106s
BUILD    cma-2902-pinnacle          comps 5  rec $528,000    ask $585,000    -9.7%                   stored ready          139s
BUILD    cma-2923-deborah           comps 7  rec $553,000    ask $575,000    -3.8%                   stored flagged        108s
BUILD    cma-2949-flagstone         comps 5  rec $550,000    ask $568,900    -3.3%                   stored flagged        162s
BUILD    cma-2980-lucus             comps 7  rec $1,058,000  ask $1,075,000  -1.6%          FLAGGED  stored ready          172s
BUILD    cma-3026-red-jasper        comps 5  rec $827,000    ask $835,000    -1.0%          FLAGGED  stored flagged        182s
BUILD    cma-3037-purcell           comps 5  rec $555,000    ask $565,000    -1.8%          FLAGGED  stored flagged        173s
BUILD    cma-3063-brownstone        comps 7  rec $642,000    ask $669,900    -4.2%                   stored flagged        195s
BUILD    cma-3118-mayer             comps 7  rec $1,546,000  ask $1,570,000  -1.5%          FLAGGED  stored ready          197s
BUILD    cma-3120-marea             comps 7  rec $586,000    ask $594,900    -1.5%          FLAGGED  stored flagged        156s
BUILD    cma-3177-coho              comps 5  rec $551,000    ask $569,000    -3.2%                   stored ready          135s
BUILD    cma-3190-delmas            comps 5  rec $690,000    ask $699,000    -1.3%          FLAGGED  stored flagged        156s
BUILD    cma-3202-strickland        comps 7  rec $1,651,000  ask $1,750,000  -5.7%                   stored flagged        235s
BUILD    cma-3334-braid             comps 7  rec $1,353,000  ask $1,395,000  -3.0%          FLAGGED  stored flagged        197s
BUILD    cma-3340-stonebrook        comps 5  rec $921,000    ask $925,000    -0.4%          FLAGGED  stored failed         198s
BUILD    cma-3353-collier           comps 5  rec $545,000    ask $560,000    -2.7%                   stored failed         192s
BUILD    cma-3415-marys-grace       comps 7  rec $601,000    ask $629,000    -4.5%          FLAGGED  stored flagged        152s
BUILD    cma-3446-jackwood          comps 7  rec $1,529,000  ask $1,549,000  -1.3%          FLAGGED  stored flagged        169s
BUILD    cma-3560-braid             comps 7  rec $1,576,000  ask $1,649,000  -4.4%          FLAGGED  stored flagged        117s
BUILD    cma-3711-purcell           comps 7  rec $601,000    ask $609,000    -1.3%          FLAGGED  stored audit-failed   186s
BUILD    cma-3726-petrosa           comps 7  rec $599,000    ask $599,900    -0.2%          FLAGGED  stored flagged        167s
BUILD    cma-3734-petrosa           comps 7  rec $661,000    ask $669,500    -1.3%          FLAGGED  stored ready          168s
BUILD    cma-3802-petrosa           comps 7  rec $704,000    ask $774,900    -9.1%                   stored flagged        174s
BUILD    cma-429-irving             comps 5  rec $787,000    ask $799,900    -1.6%          FLAGGED  stored flagged        229s
BUILD    cma-466-flagline           comps 7  rec $1,235,000  ask $1,299,900  -5.0%          FLAGGED  stored flagged        155s
BUILD    cma-60320-sage-stone       comps 7  rec $904,000    ask $920,000    -1.7%          FLAGGED  stored failed         150s
BUILD    cma-60733-breckenridge     comps 5  rec $690,000    ask $699,000    -1.3%          FLAGGED  stored flagged        141s
BUILD    cma-60785-willow-creek     comps 7  rec $630,000    ask $639,900    -1.5%          FLAGGED  stored flagged        183s
BUILD    cma-60865-sweet-pea        comps 5  rec $624,000    ask $660,000    -5.5%                   stored ready          163s
BUILD    cma-60903-epic             comps 7  rec $607,000    ask $633,000    -4.1%          FLAGGED  stored flagged        110s
BUILD    cma-60933-sydney-harbor    comps 7  rec $728,000    ask $765,000    -4.8%                   stored ready          188s
BUILD    cma-61057-ruby-peak        comps 6  rec $641,000    ask $649,000    -1.2%          FLAGGED  stored flagged        155s
BUILD    cma-61132-ambassador       comps 7  rec $745,000    ask $779,900    -4.5%          FLAGGED  stored flagged        146s
BUILD    cma-61209-snow-owl         comps 7  rec $720,000    ask $729,900    -1.4%          FLAGGED  stored flagged        153s
BUILD    cma-61370-fairfield        comps 5  rec $510,000    ask $539,900    -5.5%                   stored flagged        98s
BUILD    cma-61433-linton           comps 6  rec $945,000    ask $979,995    -3.6%                   stored failed         169s
BUILD    cma-61574-devils-lake      comps 5  rec $794,000    ask $849,900    -6.6%                   stored flagged        120s
BUILD    cma-61578-devils-lake      comps 5  rec $780,000    ask $825,000    -5.5%                   stored flagged        124s
BUILD    cma-61579-lucia            comps 5  rec $505,000    ask $565,000    -10.6%                  stored ready          128s
BUILD    cma-62475-woodsman         comps 7  rec $1,576,000  ask $1,600,000  -1.5%          FLAGGED  stored flagged        163s
BUILD    cma-62619-lawler           comps 7  rec $414,000    ask $419,995    -1.4%          FLAGGED  stored failed         37s
BUILD    cma-62665-big-sage         comps 5  rec $2,360,000  ask $2,750,000  -14.2%                  stored failed         166s
BUILD    cma-62856-nolan            comps 5  rec $527,000    ask $540,000    -2.4%                   stored ready          100s
BUILD    cma-63106-sophwith         comps 7  rec $484,000    ask $510,000    -5.1%                   stored failed         53s
BUILD    cma-63264-rossby           comps 5  rec $701,000    ask $709,000    -1.1%          FLAGGED  stored flagged        182s
BUILD    cma-636-portland           comps 5  rec $1,093,000  ask $1,165,000  -6.2%                   stored failed         192s
BUILD    cma-683-providence         comps 6  rec $566,000    ask $574,500    -1.5%          FLAGGED  stored flagged        175s
BUILD    cma-711-georgia            comps 5  rec $855,000    ask $949,000    -9.9%                   stored failed         182s
BUILD    cma-915-saginaw            comps 5  rec $911,000    ask $925,000    -1.5%          FLAGGED  stored flagged        182s
BUILD    cma-922-ogden              comps 5  rec $690,000    ask $699,000    -1.3%          FLAGGED  stored flagged        174s
BUILD    cma-940-purcell            comps 5  rec $601,000    ask $619,900    -3.0%          FLAGGED  stored flagged        123s

109 of 140 build (was 108); +1 build, -0 fail; 9 prices moved, median |delta| 7.6%
vs stored rows: +25 now build (were failed), -15 now fail (were built), 48 prices moved vs stored, median |delta| 4.7%

newlyBuilding (1):
  cma-711-georgia            {"outcome":"fail","stage":"comps","reason":"The search in Old Bend found 4 price-setting sales (266 Riverside, 342 Florida, 232 Congress, 240 Georgia); 5 are needed. Not enough comparable sales in Bend, sold within 24 months: of the 148 sales s"} -> {"outcome":"build","recommended":855000,"comps":5}

pricesMoved (9):
  cma-429-irving             {"recommended":665000} -> {"recommended":787000} +18.3% ($122,000) (comps changed: data drift suspected)
  cma-62665-big-sage         {"recommended":1999000} -> {"recommended":2360000} +18.1% ($361,000) (comps changed: data drift suspected)
  cma-915-saginaw            {"recommended":800000} -> {"recommended":911000} +13.9% ($111,000)
  cma-60933-sydney-harbor    {"recommended":670000} -> {"recommended":728000} +8.7% ($58,000)
  cma-3340-stonebrook        {"recommended":856000} -> {"recommended":921000} +7.6% ($65,000) (comps changed: data drift suspected)
  cma-2849-lotno             {"recommended":520000} -> {"recommended":490000} -5.8% ($-30,000) (comps changed: data drift suspected)
  cma-60865-sweet-pea        {"recommended":590000} -> {"recommended":624000} +5.8% ($34,000)
  cma-140-4th                {"recommended":420000} -> {"recommended":435000} +3.6% ($15,000) (comps changed: data drift suspected)
  cma-2375-majestic-ridge    {"recommended":845000} -> {"recommended":856000} +1.3% ($11,000)

holdCleared (2):
  cma-429-irving             {"hold":true,"holdReason":"under-ask-15","ask":799900,"rec":665000} -> {"hold":false,"holdReason":null,"ask":799900,"rec":787000}
  cma-62665-big-sage         {"hold":true,"holdReason":"under-ask-15","ask":2750000,"rec":1999000} -> {"hold":false,"holdReason":null,"ask":2750000,"rec":2360000}

compsChanged (11):
  cma-1117-milwaukee         {"comps":5,"compKeys":["20250903183811138318000000","20260308194704016180000000","20260327230112376556000000","20260501173151449638000000","20260615134243952998000000"]} -> {"comps":5,"compKeys":["20260308194704016180000000","20260327230112376556000000","20260408201858585977000000","20260501173151449638000000","20260615134243952998000000"]} added [20260408201858585977000000] removed [20250903183811138318000000]
  cma-140-4th                {"comps":5,"compKeys":["20241003223037006635000000","20250305224355282649000000","20250522202417706662000000","20250715225630521476000000","20260128181939717024000000"]} -> {"comps":5,"compKeys":["20241003223037006635000000","20250305224355282649000000","20250522202417706662000000","20260128181939717024000000","20260328234720220317000000"]} added [20260328234720220317000000] removed [20250715225630521476000000]
  cma-1517-mt-washington     {"comps":5,"compKeys":["20250227202258121567000000","20250804181806190057000000","20260408212207170638000000","20260521205524966260000000","20260723161419692302000000"]} -> {"comps":5,"compKeys":["20250227202258121567000000","20250516220331634128000000","20250804181806190057000000","20260521205524966260000000","20260723161419692302000000"]} added [20250516220331634128000000] removed [20260408212207170638000000]
  cma-1617-8th               {"comps":5,"compKeys":["20250523174231664260000000","20250711161212249523000000","20250820205149271514000000","20250829235512257244000000","20260914171811587859000000"]} -> {"comps":5,"compKeys":["20250711161212249523000000","20250820205149271514000000","20250829235512257244000000","20260408201858585977000000","20260914171811587859000000"]} added [20260408201858585977000000] removed [20250523174231664260000000]
  cma-19658-harvard          {"comps":5,"compKeys":["20250904215922688031000000","20250916203628016318000000","20260309155930195015000000","20260401171806152606000000","20260408193331562319000000"]} -> {"comps":5,"compKeys":["20250904215922688031000000","20250916203628016318000000","20260401171806152606000000","20260408193331562319000000","20260501171026634390000000"]} added [20260501171026634390000000] removed [20260309155930195015000000]
  cma-2382-jackson           {"comps":5,"compKeys":["20240918220027154082000000","20250203205452082673000000","20250610221614696874000000","20250714223341743203000000","20251128163027974447000000"]} -> {"comps":5,"compKeys":["20240918220027154082000000","20250203205452082673000000","20250418221257556699000000","20250714223341743203000000","20251128163027974447000000"]} added [20250418221257556699000000] removed [20250610221614696874000000]
  cma-2533-monterey-pines    {"comps":5,"compKeys":["20250127190225845842000000","20250211191629916596000000","20250616164840599073000000","20260309121340673417000000","20260323211804680641000000"]} -> {"comps":5,"compKeys":["20250127190225845842000000","20250211191629916596000000","20250616164840599073000000","20251120050500734991000000","20260309121340673417000000"]} added [20251120050500734991000000] removed [20260323211804680641000000]
  cma-2849-lotno             {"comps":5,"compKeys":["20251007154345646116000000","20260401170125085128000000","20260409154457976959000000","20260417190045022351000000","20260702174518892587000000"]} -> {"comps":5,"compKeys":["20251007154345646116000000","20260401170125085128000000","20260417190045022351000000","20260604190414818220000000","20260702174518892587000000"]} added [20260604190414818220000000] removed [20260409154457976959000000]
  cma-3340-stonebrook        {"comps":5,"compKeys":["20250310160558943534000000","20250512183351606320000000","20260303174443140809000000","20260727210646211936000000","20260807210953216792000000"]} -> {"comps":5,"compKeys":["20250310160558943534000000","20260303174443140809000000","20260727210646211936000000","20260807210953216792000000","20260818033330976145000000"]} added [20260818033330976145000000] removed [20250512183351606320000000]
  cma-429-irving             {"comps":5,"compKeys":["20250106150252784014000000","20250129174453660597000000","20250506182411843141000000","20251107021431966626000000","20260513182149869923000000"]} -> {"comps":5,"compKeys":["20250506182411843141000000","20251017230339989276000000","20260312203811202314000000","20260501003341404784000000","20260707192958750100000000"]} added [20251017230339989276000000, 20260312203811202314000000, 20260501003341404784000000, 20260707192958750100000000] removed [20250106150252784014000000, 20250129174453660597000000, 20251107021431966626000000, 20260513182149869923000000]
  cma-62665-big-sage         {"comps":5,"compKeys":["20250404193629440578000000","20250717171336487140000000","20250805235215546044000000","20260108175755512042000000","20260601174245132706000000"]} -> {"comps":5,"compKeys":["20250805235215546044000000","20260227234315101795000000","20260422225126505280000000","20260601174245132706000000","20260820202639303464000000"]} added [20260227234315101795000000, 20260422225126505280000000, 20260820202639303464000000] removed [20250404193629440578000000, 20250717171336487140000000, 20260108175755512042000000]

flaggedChanged (6):
  cma-2382-jackson           {"flagged":true,"reviewReason":"to sell. The recommendation is under that ask. Comp evidence supported $649,000 against the $639,000 asking that just failed. The recommendation is under that ask. The last ask of $639,000 sits inside the sales range of $598,000 to $649,000 the recommendation reads from. The home did not sell at a price the sales support, so the letter's reason that the ask was too high does not hold. It stays with you. It was not queued and it was not sent."} -> {"flagged":false,"reviewReason":null}
  cma-3340-stonebrook        {"flagged":false,"reviewReason":null} -> {"flagged":true,"reviewReason":"Comp evidence supported $928,000 against the $925,000 asking that failed to sell. The recommendation is under that ask. The last ask of $925,000 sits inside the sales range of $851,000 to $928,000 the recommendation reads from. The home did not sell at a price the sales support, so the letter's reason that the ask was too high does not hold. It stays with you. It was not queued and it was not sent."}
  cma-60865-sweet-pea        {"flagged":true,"reviewReason":null} -> {"flagged":false,"reviewReason":null}
  cma-60933-sydney-harbor    {"flagged":true,"reviewReason":null} -> {"flagged":false,"reviewReason":null}
  cma-62665-big-sage         {"flagged":true,"reviewReason":"Comparable sales span a wide price-per-square-foot range ($552 to $855/sqft, 20% variation). The set mixes different quality or location tiers, so a broker should confirm the comp selection before this goes to a client."} -> {"flagged":false,"reviewReason":null}
  cma-63106-sophwith         {"flagged":true,"reviewReason":null} -> {"flagged":false,"reviewReason":null}

sourceChanged (1):
  cma-429-irving             {"pricingSource":"facts"} -> {"pricingSource":"listings"}

unchanged: 123 of 140 common homes

totals: 140 homes · build 109 · fail 31 · harness 0 · hold 14 · flagged 65 · under rule 8 30
by stage: subject 0 · comps 30 · pricing 0 · contract 1 · complete 109 · harness 0
by pricingSource: facts 114 · listings 26

wrote /tmp/claude-0/-home-user-RyanRealty/22836b4c-98ba-5bdb-a5f1-615225570f2c/scratchpad/fleet/final3/2026-10-08T18-10-39.169Z.json
wrote /tmp/claude-0/-home-user-RyanRealty/22836b4c-98ba-5bdb-a5f1-615225570f2c/scratchpad/fleet/final3/latest.json
raw directory: 4.4 MB
every number above is a field of 2026-10-08T18-10-39.169Z.json (CLAUDE.md §0 trace); engine = deterministic half, a build here is a ceiling on a real build
```
