-- Playlist media is browser-local. Remove the retired realtime relay claim state.
DROP TABLE IF EXISTS class_playlist_relay_claims;
