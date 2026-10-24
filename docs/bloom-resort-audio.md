# Bloom Resort: audio plan

Sound rules and per-scene audio for the six episodes in [bloom-resort-series.md](bloom-resort-series.md). Beat times match the episode tables there.

## Rules

1. **No human voice, anywhere.** Mute every clip's camera sound by default. A clip's own sound comes back only as a picked effect below, and only after it has been listened through for voices, coughs and TV in the background.
2. **Piano carries every scene.** Each episode has its own solo-piano score. Every section is timed to a scene beat and written for that scene's mood (see "Music"). No other instruments: no drums, strings, synth or vocals.
3. **Background sounds only when the story needs them:** a sound the cat reacts to, or one the picture shows happening (pour, lift, kibble shake, meow, cup set down). No ambience bed and no pool or garden sound. Piano fills the rest.
4. **Meows go only where the mouth can't be seen:** off-screen, behind the door, a turned-away head, or over black. The exception is M12, which has its own real, in-sync meow.
5. **Cliffhanger:** the music and all sound cut hard to black, with no resolve. After 0.5s of silence, the credits tail plays the shared piano sting. That sting is the only place the music resolves.

## Mix

- Final loudness is -16 LUFS integrated, with true peak no higher than -1 dBTP.
- The piano sits about 8 dB under the sound effects. It ducks a further 6-8 dB under each meow and shake (150 ms attack, 400 ms release).
- Each effect gets 10-20 ms fades so nothing clicks.
- The cleaned effects are already level-matched to -22 LUFS (the raw files varied from -17 to -40 LUFS), so the mix only needs the piano level and the ducking. See "Cleaned effects".
- The raw shakes peaked slightly over 0 dBFS (4-5 clipped samples); the cleaned files peak at -2 to -3 dBFS.

## Music (to generate, not generated yet)

Script: `OpenMontage/projects/bloom-pour/series_music.py`. It hasn't been run, and nothing has been spent.
- **How it works:** it uses ElevenLabs music on fal with a composition plan, and each section's duration is enforced.
- **Cost:** about $0.80 per 40s track, about $5 for all seven (estimate, actual fal price unconfirmed).
- **Output:** files go to `Videos/BloomPour/BloomResort_S1/Audio/music/<ep>_piano.mp3`. Tracks that already exist are skipped.
- **Global style:** solo felt piano, close-miked, warm, instrumental.
- **Shared hook (0-3s or 0-4s):** in every episode, one soft high note rings, then a rising three-note signature motif comes on the match cut.
- **Leave space:** sections marked *(space)* are kept very sparse, with long rests, so an effect can sit on top.

| Ep | Time | Scene | Mood written into the music |
|----|------|-------|------------------------------|
| 1 | 0-4 | Hook | Signature motif |
| 1 | 4-12 | The guest | Calm, unhurried, warm major, about 66 bpm, sparse melody |
| 1 | 12-22 | The view | Wistful, hazy, gently melancholic, open fifths, low drones, a touch of minor |
| 1 | 22-30 | The ritual | Flowing arpeggios like water pouring, warm major |
| 1 | 30-34 | The delivery | Light anticipation, playful staccato pickup |
| 1 | 34-37 | Payoff | Warm, content, a soft settled chord |
| 1 | 37-40 | Cliffhanger | Suspended sus chord, one repeated high note like a question |
| 2 | 0-3 | Hook | Signature motif |
| 2 | 3-7 | The critic is in | Dry, deadpan, formal, tentative staccato |
| 2 | 7-12 | Coffee 1, chocolatey | Approving, sweet rich chords |
| 2 | 12-17 | Coffee 2, bright | Sparkling high register, light trills, curious |
| 2 | 17-22 | Coffee 3, caramel | Smooth legato, warm jazzy seventh chords |
| 2 | 22-29 | Mystery cup | Comedic suspicion, a sour dissonant cluster, then a full stop *(space)* |
| 2 | 29-35 | Payoff, the VIP orders | Confident, inviting *(space for the M12 meow)* |
| 2 | 35-39 | Cliffhanger | Curious, two high bell-like notes, unresolved |
| 3 | 0-3 | Hook | Signature motif |
| 3 | 3-7 | Order received | Brisk, cheerful, determined |
| 3 | 7-10 | Through the estate | Nocturnal, mysterious, soft walking left hand |
| 3 | 10-14 | The lift | Held breath, minimal *(space for the chime)* |
| 3 | 14-18 | Our floor | Plucky tiptoe staccato, a small brave toy car |
| 3 | 18-21 | The VIP senses it | Sudden hush, single high notes like ears pricking |
| 3 | 21-25 | Home | Building anticipation, gentle crescendo |
| 3 | 25-28 | The VIP Suite | Near silence, one held low note *(space for the shakes and meow)* |
| 3 | 28-33 | The VIP emerges | Delighted, tender major melody |
| 3 | 33-37 | Payoff | Satisfied, cozy |
| 3 | 37-41 | Cliffhanger | Drowsy lullaby, slowing, descending, suspended |
| 4 | 0-3 | Hook | Signature motif |
| 4 | 3-9 | Falling asleep | Lullaby, slow descending lines, breathing rhythm |
| 4 | 9-12 | Into the dream | Magical shimmer, rolled high chords |
| 4 | 12-27 | The dream glide | Floating, weightless, washes of pedal, rubato, whole-tone colour, soft reverb |
| 4 | 27-31 | Waking | Gentle return, a soft wake-up motif |
| 4 | 31-35 | Payoff | Warm, grounded |
| 4 | 35-39 | Cliffhanger | Puzzled, uneasy, low minor notes |
| 5 | 0-4 | Hook | Signature motif |
| 5 | 4-10 | The grey view | Muted, hushed, minor but cozy |
| 5 | 10-18 | What the cat sees | Foggy, distant, long-decay notes, low drones |
| 5 | 18-26 | The ritual | Warmth returns, flowing major arpeggios |
| 5 | 26-32 | Room service | Cheerful light steps, thinning to rests for the door shakes |
| 5 | 32-36 | Payoff | Cozy, reassuring |
| 5 | 36-39 | Cliffhanger | Mischievous, suspicious staccato |
| 6 | 0-3 | Hook | Signature motif |
| 6 | 3-10 | Who choped the seat | Cheeky, smug reveal |
| 6 | 10-20 | Going fast | Brisk, urgent, quicker, repeated notes like a countdown |
| 6 | 20-26 | Sold out | Sudden stop, then wistful and slow |
| 6 | 26-30 | Fully booked | Small proud flourish, bright major |
| 6 | 30-34 | Payoff | Warm, grateful, inviting |
| 6 | 34-38 | Cliffhanger | Cheeky, expectant *(space)* |
| all | credits (8s) | Credits tail | The signature motif resolves to a warm final major chord |

The Ep 4 "Into the dream" beat runs 9-12 rather than the 9-11 in the series doc, because a music section can't be shorter than 3s. The glide starts at 12s.

## Sound effects per scene

Status: **Have** = file exists. **Record** = record it yourself (phone is fine, no talking, 5s of silence before and after). **AI** = ElevenLabs sound effects on fal (about $0.05 each). **Claude** = processing done in the edit, free.

| Ep | Time | Sound | Why it's needed | Source | Status |
|----|------|-------|-----------------|--------|--------|
| all | 0-3 | Soft pour under the macro bloom, about 8 dB under the other effects | The hook's only real sound, the same in every episode | `clean/pour_short.wav` (your recording) at low level | Have |
| 1, 5 | ritual | Water pouring from the kettle | The cat's ear flick reacts to it (Ep 1) | `clean/pour_short.wav` (4.4s) for the ritual beat, `clean/pour_long.wav` (13s, the pitch rises as the vessel fills) when the pour needs to run long. S2/S3's own sound can replace them | Have |
| 1, 2, 4 | S4 | Cup set down on the platform, short slide | The picture shows it | S4 own sound (record while shooting, felt pad muted) | Record |
| 2 | 22-29 | Instant-coffee packet rustle | Sells the gag before the sniff | `clean/sachet_rustle.wav` (2s, one continuous rustle), or `sachet_rustle_long.wav` (2.9s, three phases) to run under the sniff | Have |
| 2 | turn-away | Discontent meow | "Absolutely not" | `Audio/meow_discontent.mp4` 1.57-2.25s | Have |
| 2 | 29-35 | The VIP's order meow | In sync on camera | `_enhanced/M12_t01_meow.mp4` own sound | Have |
| 2 | 35-39 | Lift chime, heard from the doorstep | Sets up Ep 3 ("Room service is on the way...") | `clean/lift_chime.wav`, your lift's real chime, extracted from the corridor footage (`Z6_7/MVI_0275` 2.5-3.8s). `F9/MVI_0127` has no chime | Have |
| 2 | 35-39 | One muffled kibble shake (optional) | Gives the head turn toward the door a reason | `Audio/shake2.mp4` first hit, low-passed (Claude) | Have |
| 3, 5, 6 | S5 | Cup lid snapped on | The picture shows it (Ep 6: one snap per counter drop) | `clean/cup_lid.wav` (1.4s: lid placed, pressed, snapped), `clean/cup_lid_snap.wav` (0.45s, the snap alone: use it for Ep 6's counter drops), `clean/cup_lid_alt.wav` (second take, several presses and a sharper snap). S5's own sound can replace them | Have |
| 3 | 10-14 | Lift chime plus doors opening | On the cut to the open lift | `clean/lift_chime.wav`, then `clean/lift_door.wav` about 1.2s later (the real gap in the take; the doors start moving then) | Have |
| 3, 5 | courier | Small plastic wheels rolling on tile, motor whir | The tiny car needs a sound to feel alive | Courier shoot own sound (Powered Up motor). If thread-pulled: AI | Record or AI |
| 3, 5 | 25-28 | Two small plastic bumps on the door | The two bumps | Courier shoot own sound, or AI | Record or AI |
| 3, 5 | 25-28 | Two kibble shakes, one on each bump | The series' room-service sound | `Audio/shake1.mp4` 0.80-1.50s (bump 1), `Audio/shake2.mp4` 0.97-1.85s (bump 2) | Have |
| 3 | 25-28 | Begging meow from behind the door | The cat answers the shakes and motivates the exit | `Audio/meow_begforfood.mp4` 3.22-4.51s, muffled through the door (Claude) | Have |
| 3 | 28-33 | Cat flap swinging and clacking | The cat comes out through it | `clean/cat_flap.wav` (your recording: one push through, two swings, 1.65s). `clean/cat_flap_soft.wav` is a single lighter swing for the return | Have |
| 4 | 31-35 | Soft content meow | "Dream resort. Real coffee." (keep the mouth out of frame in S4) | `Audio/meow_soft.mp4` 2.37-3.06s | Have |
| 6 | 20-26 | Paper sign set on the sill | The picture shows it | S9 own sound | Record |
| 6 | over black | Demanding meow | "The VIP wants a refill" | `Audio/meow_demanding.mp4` 8.48-9.80s | Have |

No sound at all for: the estate and night shots, the view shots, the dream glide, the steam, the end cards and the counter changes. Piano only there.

Spare, unused: `meow_invitetoplay.mp4` (trill at 5.13-6.06s, possible for the Ep 6 lens boop) and the rest of `meow_demanding.mp4`.

## Cleaned effects

All files are in `Videos/BloomPour/BloomResort_S1/Audio/clean/`, 48 kHz 24-bit WAV (stereo, the same on both sides). The originals are untouched. Build script: `OpenMontage/projects/bloom-pour/series_audio_clean.py` (free, local, no AI). The measured before/after is in `clean/report.json`.

| File | Source | Window |
|------|--------|--------|
| `shake1`, `shake2` | `Audio/shake1.mp4`, `shake2.mp4` | 0.55-1.95s, 0.75-2.30s |
| `meow_discontent` | `Audio/meow_discontent.mp4` | 1.45-2.45s |
| `meow_begforfood` | `Audio/meow_begforfood.mp4` | 3.05-4.70s |
| `meow_demanding` | `Audio/meow_demanding.mp4` | 8.30-10.00s |
| `meow_soft` | `Audio/meow_soft.mp4` | 2.20-3.25s |
| `meow_m12` | `_enhanced/M12_t01_meow.mp4` own sound | 3.50-5.10s (the on-camera meow; mute the clip's other sound) |
| `lift_chime` | `Z6_7/MVI_0275.MOV` | 2.50-3.80s (two clean tones at about 2.6 and 5.3 kHz, about 0.8s) |
| `lift_door` | `Z6_7/MVI_0275.MOV` | 3.85-5.40s (click, then the door motor and rollers) |
| `cat_flap` | `Audio/catflap.mp4` | 1.15-2.80s (you recorded 4 pushes; this is one clean push through, two swings) |
| `cat_flap_soft` | `Audio/catflap2.mp4` | 5.45-6.65s (the one full swing in that take; the rest are light taps) |
| `pour_long` | `Audio/pourwater2.mp4` | 2.20-15.70s (the whole pour) |
| `pour_short` | `Audio/pourwater1.mp4` | 2.30-6.80s |
| `cup_lid` | `Audio/cuplid2.mp4` | 0.65-2.10s |
| `cup_lid_snap` | `Audio/cuplid2.mp4` | 1.60-2.05s |
| `cup_lid_alt` | `Audio/cuplid1.mp4` | 1.10-2.95s |
| `sachet_rustle` | `Audio/plasticrustle3.mp4` | 0.30-2.50s |
| `sachet_rustle_long` | `Audio/plasticrustle1.mp4` | 0.30-3.40s |

Not used: `plasticrustle2.mp4` (8.6s of fiddling, the same sound as the other two), the quiet taps in `catflap2.mp4`, and the first 2s of both pour takes (handling thumps before the water).

What was done to each, the same way:
1. High-pass (60-400 Hz depending on the sound) to drop room rumble.
2. Noise removal that learns each source's own steady hiss and hum from its quietest frames, then subtracts it. Strength is set per sound (gentle on the clean meows, firmer on the corridor takes).
3. Trimmed to the sound itself with a short fade in and a soft fade out.
4. **Same clarity inside a group:** the meows (5) and the shakes (2) are pulled toward their group's average tone, at most 5 dB either way, so no meow sounds duller or brighter than the others because of the mic.
5. **Same volume for everything:** all files are levelled to -22 LUFS (within 0.5) and kept under -1.5 dBTP. Sharp sounds (flap, rustle, pour splashes) go through a transparent limiter to get there.

Not yet checked by ear. The numbers and the spectrograms look right, but play each file once, especially `lift_door`, and say if any sounds off.

## What's missing

**You still need to record these.** They have to sound like the real place, and you can capture them on the shoot days anyway:

1. **S4 and S9:** keep the camera sound on during these shoots (manual levels, no talking). That covers the cup set-down and slide, and the paper sign.
2. **The courier:** keep the camera sound on during the courier takes. That covers the wheels, the motor and the bumps.

**AI can make these if you'd rather not record:**
- Toy-car wheels, plastic bumps, the cup set-down and the paper sign.
- About $0.05 each.

**Can't be faked well, but you already have them:**
- Meows. AI cat voices sound off and won't match your cat.
- Kibble shakes.
- Five meows and two shakes are enough for all six episodes.

**Claude, in the edit, free:**
- Laying the cleaned effects on the timeline.
- The through-the-door muffling.
- Ducking.
