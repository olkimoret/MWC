# MWC Form — Checklist Step Spec

## What to Build
Add a new Step 2 to the existing 3-step form. Push current Step 2 → Step 3, Step 3 → Step 4. Update progress bar to 4 dots.

The new Step 2 shows job checklists based on the job types selected in Step 1.

## Checklist Order
Always: **Arrival** → job-specific checklists (one per job type) → **Departure**

## Styling
Match existing form exactly: same toggle switches, card layouts, section labels, brand red color scheme.

## Airtable Storage
On submit, PATCH each job record with two new fields:
- `Checklist Completed` (boolean) — true if ALL toggles in that job's checklists are checked
- `Checklist Missing` (text) — comma-separated list of unchecked items. Empty if all checked.

Arrival and Departure apply to all jobs but are not counted per-job for Checklist Completed/Missing — only the job-specific checklists count per job record.

---

## Checklist Mapping
Job type string from Airtable → which checklist to show

| Job Type | Checklist |
|---|---|
| All jobs | Arrival (always first) |
| House Wash | House Wash |
| SILVER Window Cleaning, GOLD Window Cleaning, BRONZE Window Cleaning | Window Cleaning |
| Residential Gutter Cleaning | Residential Gutter Cleaning |
| Residential Gutter Cleaning, Commercial Gutter Cleaning, Skylight Cleaning, Roof Cleaning, Partial Roof Cleaning | Rooftop Safety Assessment |
| Roof Cleaning, Partial Roof Cleaning | Roof Cleaning with Bleach |
| Roof Cleaning, Partial Roof Cleaning | Roof Cleaning Without Bleach |
| Slimguard | Slimguard |
| Weekly Pool Cleaning Service | Weekly Pool Cleaning |
| Seam Repair | Seam Repair |
| Solar Panel Cleaning | Solar Panel Cleaning |
| Driveway Pressure Cleaning, Residential Pressure Washing | Driveway/Pressure Washing |
| Skylight Cleaning | Skylight Cleaning |
| Hard Water Removal | Hard Water Removal |
| Commercial WC - Exterior Only | Storefront Window Cleaning |
| All jobs | Departure (always last) |

Note: For Roof Cleaning jobs show BOTH bleach and without bleach checklists. Tech completes whichever applies.

Note: Rooftop Safety Assessment is NOT toggles — it's 3 text input fields (see below).

---

## Checklist Items

### Arrival (all jobs)
1. Call or Text Customer when on way
2. Determine accurate prices for the job
3. Go over prices, disclaimers, and get customer signature on Invoice before begin work. If customer not comfortable signing your device, ask if can put an "X" for their signature
4. Let customer know have 1 Goal today: do such good job that earn 5-Star Google or Yelp Review
5. Take "Before" photos on the Customer Factor app
6. Do a hazard assessment: Identify exposed electrical wires, potential slip areas, electrical outlets without covers, electrical panels, and any other potential hazards
7. Set up barriers for hazards

### House Wash
1. Tape over key hole, put tape over electrical outlets, put plastic over speakers, lights, etc.
2. Do NOT put bleach on painted doors. Just use water on them
3. Rinse all surrounding vegetation before and after you apply bleach
4. Mix 3 gallons bleach, 2 gallons water, and 5 oz. Gain or other soap in 5 gallon bucket on truck
5. Apply solution onto house from bottom up, using proper spray tips
6. Let solution dwell 5-10 minutes on surface of house, but don't let it dry. If starts to dry, mist it to keep wet
7. Change tips to rinse solution off house. Make sure to get all spider webs. Use only WATER around painted wood
8. Move all pet bowls far away from house
9. Rinse off all vegetation again
10. If customer is happy, roll up hoses, and put tools away
11. Drop siphon hose in bucket of clear water. Put soap nozzle on gun, and spray 2-3 minutes to rinse out injector and hose
12. Turn Gas Lever OFF on Pressure Washer

### Window Cleaning
1. If you notice any damaged property (frayed screens, bent screen frames, cracked windows, hard water, etc) bring to customer's attention ASAP
2. Put large towel down as drop cloth for squeegee drips
3. If this is a Bronze WC, clean exterior tracks
4. If doing Gold WC, make sure all tracks are cleaned. Use screwdriver & towel to get dirt out of corners
5. Vacuum out tracks, unless there is not much in them
6. Wear booties or remove shoes inside home
7. Secure towels to ends of ladders when resting them on inside walls
8. Use steel or bronze wool or mini-scraper to remove any debris from glass scrubber doesn't remove
9. Ask permission before using customer's bathroom and only use the one they suggest
10. Make sure all smudges, streaks, lines, and edges are detailed
11. Clean screens with soap and water
12. Use WFP only on maintenance cleans which have been cleaned less than 2 years before. Use scrubber and squeegee on all others

### Residential Gutter Cleaning
1. Remove all debris from gutters and flush all downspouts
2. If gutters are dry, you can blow out gutters, but you MUST clean up all debris
3. Take Before and After photos, and show to customer
4. Deposit all debris in Green Waste container. If it is already full, put debris in bags
5. Use stabilizer bars on ladder, so that ladder does not lean on and damage gutters
6. Flush every downspout with water to make sure they are not clogged
7. If gutters are wet, or there is a pool, or they have manicured yard DO NOT blow out gutters
8. If you discover broken tiles on roof, notify customer ASAP
9. Be sure that there is absolutely no mess when you leave job site

### Rooftop Safety Assessment (text inputs, not toggles)
- What was the weather like?
- What "Other Tripping Hazards" were present?
- What precautions were taken for each hazard that was present?

### Roof Cleaning with Bleach
1. Have Ground Helper, start watering surrounding vegetation 5 minutes before apply bleach to roof
2. Only Treat portion of Roof with Moss or Lichen
3. If treating roof with bleach, brush off all moss with brush or push broom first
4. Mix a batch of bleach/water at 50% bleach to 50% water, and at least 1 oz. of Gain for each gallon of solution
5. Bag the downspouts which will pour out into vegetation. Zip tie them closed
6. 1 Man applies solution from roof or ladder, while other man wets down surrounding vegetation
7. Take bags off of downspouts, and either pour out into rocky/dirt area or put into bucket and dispose of off site
8. Rinse out pump by running at least 10 gallons of clear water through it
9. Roll up all hoses
10. Rinse out gutters at end of job to dilute any leftover bleach

### Roof Cleaning Without Bleach
1. Use this method only when roof is not steep
2. Get up on roof with pressure washer and remove lichen and moss with surface cleaner or green tip
3. Clean up mess on ground
4. Be sure to turn gas lever off on PW
5. Roll up hoses

### Slimguard
1. Pick up Slimguard material before job
2. Call or text customer when on way
3. Greet customer. Ask customer if have any special concerns about job. Have them sign invoice
4. Let customer know if there are any broken tiles immediately when you discover them
5. Before installing Slimguard, make sure gutters are clean and downspouts flow freely
6. Make sure you install Slimguard, rough side up
7. Make an end cap on gutter ends so leaves can not blow in the gutters
8. Overlap each Slimguard section by at least 2 inches
9. Take pictures of finished installation to show to customer
10. Clean up all Slimguard remnant pieces and put in trash
11. Show customer photos and make sure they are happy with job

### Weekly Pool Cleaning
1. SAFETY & ACCESS: Access confirmed (gate unlocked), Pets secured, Equipment area safe, No visible electrical hazards, PPE used as needed
2. PRE-SERVICE VISUAL CHECK: Water level normal, Pool surface OK, Pump running, Filter pressure normal, No visible leaks
3. CLEANING TASKS COMPLETED: Skimmed surface, Skimmer baskets emptied, Pump basket emptied, Walls brushed, Steps brushed, Tile line brushed if needed
4. WATER TESTING & CHEMICALS
5. EQUIPMENT CHECK: Pump basket clean, Filter condition OK, Valves normal, No unusual noises, No leaks observed

### Seam Repair
1. Make sure gutter to be repaired is clean and dry
2. Spray Flexseal onto seam until you know all cracks and pinholes have been thoroughly covered

### Solar Panel Cleaning
1. Scrub the solar panel with WFP brush
2. Rinse solar panel after scrubbing with WFP

### Driveway/Pressure Washing
1. Rinse off any surrounding grass or vegetation that bleach may contact before start
2. Pre-treat surface with bleach & soap. (Downstream straight 12.5% SH; or 1 gallon water to 3 gallons SH with X-Jet)
3. Pre-treat surface with degreaser in X-Jet. 1 Gallon Totally Awesome to 2 Gallons Water. This is when there are grease/oil stains
4. Clean with surface cleaner
5. Rinse with white or green tip
6. Use white or green tip to clean anything surface cleaner left behind
7. If you use bleach, Put water dam over gutter to block water from going down drain. Hook up sump pump, and pump water to gravel, rocks, dirt, or grass
8. Post treat with straight SH downstream or 25% SH X-JET & soap. Do not rinse off. This will brighten concrete & keep algae from growing back
9. Rinse all surrounding vegetation
10. Let customer know not to walk on driveway until dry, or let pets off leash
11. Remove X-Jet & drop nozzle in bucket of clear water to rinse
12. Turn Gas lever OFF on Pressure Washer
13. Roll up hoses and pack up tools. Walk around job site to make sure have all tools

### Skylight Cleaning
1. Scrub Skylight with WFP
2. Rinse skylight with WFP

### Hard Water Removal
1. Use Bioclean or Sorbo hard water remover
2. Wet window. Then use steel wool to apply hard water remover solution

### Storefront Window Cleaning
1. Clean the exterior by soaping the window with water, and squeegeeing window dry. Use pole if necessary
2. Remove water from bottom ledge with small squeegee or towel
3. Detail edges with towel on end of pole
4. Clean interior either with soaping windows and squeegeeing dry, or with Speed Clean Kit & Pure Water
5. Write up Paper Invoice and give to Customer. If paying with cash, check, or credit card, write "Paid by ..." on invoice
6. If they are not paying on date of service, write "Charge" on Invoice and have customer sign it at the bottom. They will use this invoice to mail payment
7. Make sure you gather all your tools and put them in the truck

### Departure (all jobs)
1. Mark Job as "Completed" on Customer Factor before you leave job site
2. Input notes regarding any hazards that you came across
3. Ask Customer to do a Walk Around to make sure they are happy before you leave
4. Give Customer a "Request for Review" Card
5. Remind Customer will receive Invite to leave Review
6. Make sure to secure your ladders
7. Do 5 Arounds
8. Take "After" photos on The Customer Factor app
