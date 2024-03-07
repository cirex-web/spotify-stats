import { z } from "zod";
export const TrackAPISchema = z.object({
  tracks: z.array(
    z.object({
      album: z.object({
        album_type: z.string(),
        total_tracks: z.number(),
        available_markets: z.array(z.string()),
        external_urls: z.object({ spotify: z.string() }),
        href: z.string(),
        id: z.string(),
        images: z.array(
          z.object({ url: z.string(), height: z.number(), width: z.number() })
        ),
        name: z.string(),
        release_date: z.string(),
        release_date_precision: z.string(),
        restrictions: z.object({ reason: z.string() }),
        type: z.string(),
        uri: z.string(),
        artists: z.array(
          z.object({
            external_urls: z.object({ spotify: z.string() }),
            href: z.string(),
            id: z.string(),
            name: z.string(),
            type: z.string(),
            uri: z.string(),
          })
        ),
      }),
      artists: z.array(
        z.object({
          external_urls: z.object({ spotify: z.string() }),
          followers: z.object({ href: z.string(), total: z.number() }),
          genres: z.array(z.string()),
          href: z.string(),
          id: z.string(),
          images: z.array(
            z.object({ url: z.string(), height: z.number(), width: z.number() })
          ),
          name: z.string(),
          popularity: z.number(),
          type: z.string(),
          uri: z.string(),
        })
      ),
      available_markets: z.array(z.string()),
      disc_number: z.number(),
      duration_ms: z.number(),
      explicit: z.boolean(),
      external_ids: z.object({
        isrc: z.string(),
        ean: z.string(),
        upc: z.string(),
      }),
      external_urls: z.object({ spotify: z.string() }),
      href: z.string(),
      id: z.string(),
      is_playable: z.boolean(),
      linked_from: z.object({}),
      restrictions: z.object({ reason: z.string() }),
      name: z.string(),
      popularity: z.number(),
      preview_url: z.string(),
      track_number: z.number(),
      type: z.string(),
      uri: z.string(),
      is_local: z.boolean(),
    })
  ),
});
enum ReasonEnd {
  Backbtn = "backbtn",
  Endplay = "endplay",
  Fwdbtn = "fwdbtn",
  Logout = "logout",
  Remote = "remote",
  Trackdone = "trackdone",
  Trackerror = "trackerror",
  UnexpectedExit = "unexpected-exit",
  UnexpectedExitWhilePaused = "unexpected-exit-while-paused",
  Unknown = "unknown",
}
enum ReasonStart {
  Appload = "appload",
  Backbtn = "backbtn",
  Clickrow = "clickrow",
  Fwdbtn = "fwdbtn",
  Playbtn = "playbtn",
  Remote = "remote",
  Trackdone = "trackdone",
  Trackerror = "trackerror",
}

const SpotifyTrackSchema = z.object({
  ts: z.string(),
  username: z.string(),
  platform: z.string(),
  ms_played: z.number(),
  conn_country: z.string(),
  ip_addr_decrypted: z.string(),
  user_agent_decrypted: z.string().nullable(),
  master_metadata_track_name: z.string(),
  master_metadata_album_artist_name: z.string(),
  master_metadata_album_album_name: z.string(),
  spotify_track_uri: z.string(),
  episode_name: z.null(),
  episode_show_name: z.null(),
  spotify_episode_uri: z.null(),
  reason_start: z.nativeEnum(ReasonStart),
  reason_end: z.nativeEnum(ReasonEnd),
  shuffle: z.boolean(),
  skipped: z.boolean().nullable(),
  offline: z.boolean(),
  offline_timestamp: z.number(),
  incognito_mode: z.boolean(),
});
const SpotifyEpisodeSchema = z.object({
  ts: z.string(),
  username: z.string(),
  platform: z.string(),
  ms_played: z.number(),
  conn_country: z.string(),
  ip_addr_decrypted: z.string(),
  user_agent_decrypted: z.string().nullable(),
  master_metadata_track_name: z.null(),
  master_metadata_album_artist_name: z.null(),
  master_metadata_album_album_name: z.null(),
  spotify_track_uri: z.null(),
  episode_name: z.string(),
  episode_show_name: z.string(),
  spotify_episode_uri: z.string(),
  reason_start: z.nativeEnum(ReasonStart),
  reason_end: z.nativeEnum(ReasonEnd),
  shuffle: z.boolean(),
  skipped: z.boolean().nullable(),
  offline: z.boolean(),
  offline_timestamp: z.number(),
  incognito_mode: z.boolean(),
});

/** Weirdest one yet (all info fields are null) */
const SpotifyNullSchema = z.object({
  ts: z.string(),
  username: z.string(),
  platform: z.string(),
  ms_played: z.number(),
  conn_country: z.string(),
  ip_addr_decrypted: z.string(),
  user_agent_decrypted: z.string().nullable(),
  master_metadata_track_name: z.null(),
  master_metadata_album_artist_name: z.null(),
  master_metadata_album_album_name: z.null(),
  spotify_track_uri: z.null(),
  episode_name: z.null(),
  episode_show_name: z.null(),
  spotify_episode_uri: z.null(),
  reason_start: z.nativeEnum(ReasonStart),
  reason_end: z.nativeEnum(ReasonEnd),
  shuffle: z.boolean(),
  skipped: z.boolean().nullable(),
  offline: z.boolean(),
  offline_timestamp: z.number(),
  incognito_mode: z.boolean(),
});
export const SpotifyDataSchema = z.array(
  z.union([SpotifyTrackSchema, SpotifyEpisodeSchema, SpotifyNullSchema])
);
export type ISpotifyHistory = z.infer<typeof SpotifyDataSchema>;
export type ISpotifyTrack = z.infer<typeof SpotifyTrackSchema>;

export const SpotifyTokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string(),
  expires_in: z.number(),
});
export const SpotifyTrackBatchDataSchema = z.object({
  tracks: z.array(
    z.union([
      z.object({
        album: z.object({
          album_type: z.string(),
          artists: z.array(
            z.object({
              external_urls: z.object({ spotify: z.string() }),
              href: z.string(),
              id: z.string(),
              name: z.string(),
              type: z.string(),
              uri: z.string(),
            })
          ),
          available_markets: z.array(z.string()),
          external_urls: z.object({ spotify: z.string() }),
          href: z.string(),
          id: z.string(),
          images: z.array(
            z.object({ height: z.number(), url: z.string(), width: z.number() })
          ),
          name: z.string(),
          release_date: z.string(),
          release_date_precision: z.string(),
          total_tracks: z.number(),
          type: z.string(),
          uri: z.string(),
        }),
        artists: z.array(
          z.object({
            external_urls: z.object({ spotify: z.string() }),
            href: z.string(),
            id: z.string(),
            name: z.string(),
            type: z.string(),
            uri: z.string(),
          })
        ),
        available_markets: z.array(z.string()),
        disc_number: z.number(),
        duration_ms: z.number(),
        explicit: z.boolean(),
        external_ids: z.object({ isrc: z.string() }),
        external_urls: z.object({ spotify: z.string() }),
        href: z.string(),
        id: z.string(),
        is_local: z.boolean(),
        name: z.string(),
        popularity: z.number(),
        preview_url: z.string(),
        track_number: z.number(),
        type: z.string(),
        uri: z.string(),
      }),
      z.object({
        album: z.object({
          album_type: z.string(),
          artists: z.array(
            z.object({
              external_urls: z.object({ spotify: z.string() }),
              href: z.string(),
              id: z.string(),
              name: z.string(),
              type: z.string(),
              uri: z.string(),
            })
          ),
          available_markets: z.array(z.unknown()),
          external_urls: z.object({ spotify: z.string() }),
          href: z.string(),
          id: z.string(),
          images: z.array(
            z.object({ height: z.number(), url: z.string(), width: z.number() })
          ),
          name: z.string(),
          release_date: z.string(),
          release_date_precision: z.string(),
          total_tracks: z.number(),
          type: z.string(),
          uri: z.string(),
        }),
        artists: z.array(
          z.object({
            external_urls: z.object({ spotify: z.string() }),
            href: z.string(),
            id: z.string(),
            name: z.string(),
            type: z.string(),
            uri: z.string(),
          })
        ),
        available_markets: z.array(z.unknown()),
        disc_number: z.number(),
        duration_ms: z.number(),
        explicit: z.boolean(),
        external_ids: z.object({ isrc: z.string() }),
        external_urls: z.object({ spotify: z.string() }),
        href: z.string(),
        id: z.string(),
        is_local: z.boolean(),
        name: z.string(),
        popularity: z.number(),
        preview_url: z.null(),
        track_number: z.number(),
        type: z.string(),
        uri: z.string(),
      }),
      z.object({
        album: z.object({
          album_type: z.string(),
          artists: z.array(
            z.object({
              external_urls: z.object({ spotify: z.string() }),
              href: z.string(),
              id: z.string(),
              name: z.string(),
              type: z.string(),
              uri: z.string(),
            })
          ),
          available_markets: z.array(z.string()),
          external_urls: z.object({ spotify: z.string() }),
          href: z.string(),
          id: z.string(),
          images: z.array(
            z.object({ height: z.number(), url: z.string(), width: z.number() })
          ),
          name: z.string(),
          release_date: z.string(),
          release_date_precision: z.string(),
          total_tracks: z.number(),
          type: z.string(),
          uri: z.string(),
        }),
        artists: z.array(
          z.object({
            external_urls: z.object({ spotify: z.string() }),
            href: z.string(),
            id: z.string(),
            name: z.string(),
            type: z.string(),
            uri: z.string(),
          })
        ),
        available_markets: z.array(z.string()),
        disc_number: z.number(),
        duration_ms: z.number(),
        explicit: z.boolean(),
        external_ids: z.object({ isrc: z.string() }),
        external_urls: z.object({ spotify: z.string() }),
        href: z.string(),
        id: z.string(),
        is_local: z.boolean(),
        name: z.string(),
        popularity: z.number(),
        preview_url: z.null(),
        track_number: z.number(),
        type: z.string(),
        uri: z.string(),
      }),
    ])
  ),
});
