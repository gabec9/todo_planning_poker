// STUB - waiting room / session / round logic. Not wired into server.js yet. See /docs/LOBBY_AND_GAME_FLOW.md
// TODO(API-1): backfill project.session + users[].joinedAt/joinSeq (also in db.js read())
// TODO(LOBBY-3): hostOf(project) = active participant with lowest joinSeq (derived, never stored)
// TODO(LOBBY-4): grace period (~15s) so a refresh keeps your place
// TODO(LOBBY-9): reset session to idle when nobody is active
// TODO(API-3..6): vote / reveal / revote / accept; bump session.version on every mutation (RT-1)
// TODO(API-10): average + distribution for results
// TODO(RT-4): keep read-modify-write synchronous (no await between db.read() and db.write())
module.exports = {};
