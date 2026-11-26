// PROTOTYPE - NOT FOR PRODUCTION
// Question: Does fluid, floaty-but-visceral traversal across a generated greyscale nullscape, with a blade stroke that is also a movement, make you want to reach the spire again on a new seed?
// Date: 2026-11-25
// Every tuning value lives here, each with value, min, max and step. The game reads them live
// through tune.<name> (index.html); the tweak panel, an add-on, writes them back here.
window.CONFIG = {
  seed: 1, // every gameplay random call reads rng(), seeded from this (or ?seed= / #seed= in the address)
  volume: { value: 0.5, min: 0, max: 1, step: 0.05 },

  // ---- The wanderer: running and momentum (metres, seconds) ----
  run_speed:       { value: 8.6, min: 4, max: 12, step: 0.1 },   // m/s, top speed before momentum
  momentum_max:    { value: 5.2, min: 0, max: 8, step: 0.1 },    // m/s added on top by clean running
  momentum_gain:   { value: 2.6, min: 0.2, max: 5, step: 0.1 },  // m/s per second of clean running
  momentum_decay:  { value: 6, min: 1, max: 20, step: 0.5 },     // m/s per second when stopped or turning hard
  ground_accel:    { value: 48, min: 5, max: 100, step: 1 },     // m/s^2 toward the stick's speed
  air_accel:       { value: 11, min: 1, max: 40, step: 0.5 },    // m/s^2 of steering in the air
  ground_friction: { value: 22, min: 2, max: 80, step: 1 },      // m/s^2 braking with no input
  turn_rate:       { value: 14, min: 2, max: 30, step: 0.5 },    // rad/s the body turns to face its motion

  // ---- Jumping and the held float ----
  jump_speed:      { value: 9.6, min: 5, max: 16, step: 0.1 },   // m/s upward on a jump (apex about 1.9 m)
  gravity_up:      { value: 24, min: 8, max: 50, step: 0.5 },    // m/s^2 while rising
  gravity_down:    { value: 32, min: 8, max: 60, step: 0.5 },    // m/s^2 while falling: the visceral half
  apex_gravity:    { value: 16, min: 4, max: 40, step: 0.5 },    // m/s^2 near the top while jump is held: a hang
  apex_band:       { value: 1.8, min: 0, max: 5, step: 0.1 },    // m/s either side of the top that counts as the hang
  jump_cut:        { value: 0.5, min: 0.2, max: 1, step: 0.05 }, // vertical speed kept when jump is let go early
  float_gravity:   { value: 6, min: 0, max: 20, step: 0.5 },     // m/s^2 while holding jump on the way down
  float_fall_max:  { value: 2.6, min: 0.5, max: 8, step: 0.1 },  // m/s fastest fall while floating
  glide_speed:     { value: 9.5, min: 4, max: 16, step: 0.1 },   // m/s the kite-wing carries you at least
  glide_steer:     { value: 18, min: 2, max: 40, step: 0.5 },    // m/s^2 of steering under the wing
  crane_lift:      { value: 0.07, min: 0, max: 0.2, step: 0.01 }, // each crane found: the wing sinks this much slower (share)
  crane_speed:     { value: 0.35, min: 0, max: 2, step: 0.05 },  // each crane found: m/s more glide speed
  coyote:          { value: 0.12, min: 0, max: 0.3, step: 0.01 }, // s a jump still counts after an edge
  jump_buffer:     { value: 0.12, min: 0, max: 0.3, step: 0.01 }, // s a jump pressed early still counts on landing
  flow_hop_bonus:  { value: 0.4, min: 0, max: 2, step: 0.05 },   // m/s momentum for a jump pressed right on landing

  // ---- Vault, mantle, wall-run, roll, slide ----
  vault_max:       { value: 1.5, min: 0.5, max: 2.5, step: 0.05 }, // m: a ledge this high is vaulted at a run
  mantle_max:      { value: 2.8, min: 1.5, max: 4, step: 0.05 },   // m above the feet a ledge is still caught
  wallrun_time:    { value: 1.4, min: 0.3, max: 3, step: 0.05 },   // s along a wall
  wallrun_gravity: { value: 3.5, min: 0, max: 20, step: 0.5 },     // m/s^2 on the wall
  wallrun_min_speed: { value: 9, min: 4, max: 16, step: 0.25 },    // m/s along the wall at least
  walljump_speed:  { value: 9, min: 4, max: 16, step: 0.25 },      // m/s up off a wall
  walljump_push:   { value: 6, min: 1, max: 12, step: 0.25 },      // m/s away from a wall
  roll_speed_min:  { value: 4, min: 0, max: 10, step: 0.25 },      // m/s needed for a landing to roll
  hard_landing:    { value: 12, min: 4, max: 30, step: 0.5 },      // m/s of fall that makes a landing hard
  slide_time:      { value: 0.8, min: 0.2, max: 2, step: 0.05 },   // s
  slide_boost:     { value: 1.5, min: 0, max: 5, step: 0.1 },      // m/s added at the start of a slide

  // ---- The strike ----
  strike_range:    { value: 9, min: 3, max: 16, step: 0.25 },      // m a critter can be aimed at
  strike_cone:     { value: 55, min: 15, max: 90, step: 1 },       // degrees either side of facing
  dash_speed:      { value: 26, min: 10, max: 50, step: 0.5 },     // m/s toward the target
  dash_time:       { value: 0.34, min: 0.1, max: 0.8, step: 0.01 },// s at most
  air_dash_distance: { value: 4.5, min: 0, max: 10, step: 0.25 },  // m of dash with nothing to cut (once per air)
  strike_pop:      { value: 6.5, min: 0, max: 14, step: 0.25 },    // m/s upward after a cut
  strike_carry:    { value: 1.5, min: 0, max: 6, step: 0.1 },      // m/s forward added per cut, more per chain
  strike_cooldown: { value: 0.3, min: 0, max: 1, step: 0.01 },     // s between strikes on the ground
  hitstop:         { value: 0.06, min: 0, max: 0.2, step: 0.005 }, // s the world holds on a cut

  // ---- Stakes ----
  pips:            { value: 3, min: 1, max: 9, step: 1 },          // hits before going back to the stone
  invuln:          { value: 1.0, min: 0.2, max: 3, step: 0.05 },   // s of safety after a hit
  kill_y:          { value: -14, min: -60, max: 0, step: 1 },      // m: below this, a chasm fall

  // ---- Calm (for younger players) ----
  calm_pips:       { value: 5, min: 1, max: 9, step: 1 },
  calm_float_fall: { value: 1.8, min: 0.5, max: 8, step: 0.1 },
  calm_wallrun_time: { value: 2.1, min: 0.3, max: 4, step: 0.05 },
  calm_mantle_max: { value: 3.3, min: 1.5, max: 5, step: 0.05 },
  calm_critter_speed: { value: 0.6, min: 0.2, max: 1, step: 0.05 }, // critter speed multiplier
  calm_open_mult:  { value: 2, min: 1, max: 4, step: 0.1 },          // sentinel stays open this much longer

  // ---- Critters ----
  crawler_sense:   { value: 9, min: 3, max: 20, step: 0.5 },     // m before it rears up
  crawler_tell:    { value: 0.6, min: 0.2, max: 2, step: 0.05 }, // s of rearing before the lunge
  crawler_lunge:   { value: 13, min: 4, max: 30, step: 0.5 },    // m/s
  crawler_lunge_dist: { value: 7, min: 2, max: 14, step: 0.25 }, // m
  crawler_rest:    { value: 1.2, min: 0.3, max: 4, step: 0.05 }, // s after a lunge
  floater_speed:   { value: 2, min: 0.5, max: 8, step: 0.1 },    // m/s toward you
  floater_sense:   { value: 7, min: 2, max: 20, step: 0.5 },     // m
  sentinel_sweep:  { value: 2.0, min: 0.5, max: 5, step: 0.1 },  // rad/s of the blade arm
  sentinel_open:   { value: 1.3, min: 0.3, max: 4, step: 0.05 }, // s the core shows

  // ---- Camera ----
  cam_distance:    { value: 5.6, min: 2, max: 12, step: 0.1 },   // m behind
  cam_speed_pull:  { value: 2.0, min: 0, max: 6, step: 0.1 },    // m further at top speed
  fov:             { value: 62, min: 40, max: 90, step: 1 },     // degrees
  fov_speed:       { value: 8, min: 0, max: 20, step: 0.5 },     // degrees wider at top speed
  look_sens:       { value: 0.0024, min: 0.0005, max: 0.008, step: 0.0001 }, // rad per mouse pixel
  touch_look_sens: { value: 0.0065, min: 0.001, max: 0.02, step: 0.0005 },  // rad per touch pixel
  pad_look_speed:  { value: 2.6, min: 0.5, max: 6, step: 0.1 },  // rad/s at full right stick
  cam_follow_delay:{ value: 1.0, min: 0, max: 5, step: 0.1 },    // s without look input before the camera swings behind
  cam_follow_rate: { value: 1.6, min: 0, max: 6, step: 0.1 },    // how fast it swings behind

  // ---- Look (values are 0-255 grey, from genscape) ----
  fog_value:       { value: 22, min: 0, max: 80, step: 1 },      // the far-ridge grey everything fades to
  fog_density:     { value: 0.0044, min: 0.0005, max: 0.02, step: 0.0001 }, // exponential fog per metre
  sky_light:       { value: 0.85, min: 0, max: 2, step: 0.01 },  // the dim sky's light (hemisphere)
  moon_light:      { value: 1.35, min: 0, max: 4, step: 0.01 },  // the low moon's light, from behind the spire
  grass_glow:      { value: 0.34, min: 0, max: 1, step: 0.01 },  // moonlight through the blades, looking toward the moon
  bloom_strength:  { value: 0.55, min: 0, max: 2, step: 0.01 },  // soft glow on the pale things
  bloom_radius:    { value: 0.55, min: 0, max: 1, step: 0.01 },
  bloom_threshold: { value: 0.8, min: 0, max: 1, step: 0.01 },  // only what is paler than this glows
  dither_levels:   { value: 40, min: 8, max: 256, step: 1 },     // genscape's ordered dither (it uses 24), on screen pixels

  // ---- Pacing (from visual-interest) ----
  flock_min:       { value: 60, min: 10, max: 300, step: 5 },    // s between distant bird flocks
  flock_max:       { value: 120, min: 10, max: 300, step: 5 },
  glitch_min:      { value: 60, min: 10, max: 300, step: 5 },    // s between glitch slices
  glitch_max:      { value: 150, min: 10, max: 400, step: 5 },
};
