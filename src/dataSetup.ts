import { SpotifyAPI } from "./api";
import { ISpotifyHistory, ISpotifyTrack, SpotifyDataSchema } from "./schemas";

export interface RowData {
  id: string;
  val: number;
}

export type Frame = Record<string, number>;
export type WindowData = Record<number, Frame>; //TODO: can probably be generalized to Date as key

export interface IFullTrackData extends ISpotifyTrack {
  img?: HTMLImageElement;
}

export const fetchJSONFromFile = async (fileTitle: string) =>
  await (await fetch(fileTitle)).json();

export const getRawData = async (fileNames: string[]) => {
  let allData: ISpotifyHistory = [];
  for (const fileName of fileNames) {
    // TODO: maybe want to dedupe? doesn't seem necessary tho
    const data = SpotifyDataSchema.parse(await fetchJSONFromFile(fileName));
    allData = allData.concat(data);
  }
  return allData;
};

export const generateDatePoints = async (
  rawData: ISpotifyHistory,
  spotifyAPI: SpotifyAPI
) => {
  const dayData: Record<number, Frame> = {};
  const idToSong: Record<string, IFullTrackData> = {};
  for (const entry of rawData) {
    if (
      !(
        entry.spotify_track_uri !== null &&
        entry.master_metadata_album_album_name !== null &&
        entry.master_metadata_album_artist_name !== null &&
        entry.master_metadata_track_name !== null
      )
    ) {
      continue;
    }
    if (entry.ms_played <= 0) continue; // why do we even have to deal with this lol (mostly the 0 case)
    const day = Math.floor(
      new Date(entry.ts).getTime() / (1000 * 60 * 60 * 24)
    );
    if (!dayData[day]) dayData[day] = {};
    if (dayData[day][entry.spotify_track_uri] === undefined)
      dayData[day][entry.spotify_track_uri] = 0;
    dayData[day][entry.spotify_track_uri] += entry.ms_played;
    idToSong[entry.spotify_track_uri] = entry;
  }
  const promises: Promise<any>[] = [];
  for (const id of Object.keys(idToSong)) {
    promises.push(
      spotifyAPI.getThumbnailUrl(id.split(":")[2]).then((url) => {
        const image = new Image();
        image.src = url;
        idToSong[id].img = image;
      })
    );
  }
  await Promise.all(promises);
  return [dayData, idToSong] as const;
};
export const generateWindowData = (
  dayData: Record<number, Frame>,
  WINDOW_SIZE = 60
) => {
  const windowData: WindowData = {};
  const window: Frame = {};
  const windowNaiveSum: Frame = {};
  const days = Object.keys(dayData).map((x) => parseInt(x));
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);
  for (let curDay = minDay; curDay <= maxDay + WINDOW_SIZE; curDay++) {
    // scale down old stuff
    for (const [id, val] of Object.entries(window)) {
      console.assert(windowNaiveSum[id] !== undefined);
      window[id] -= windowNaiveSum[id] / WINDOW_SIZE;
      if (Math.abs(window[id]) < 1e-5) delete window[id];
    }

    if (dayData[curDay - WINDOW_SIZE] !== undefined) {
      for (const [id, playedMs] of Object.entries(
        dayData[curDay - WINDOW_SIZE]
      )) {
        console.assert(windowNaiveSum[id] !== undefined);
        windowNaiveSum[id] -= playedMs;
        if (windowNaiveSum[id] === 0) delete windowNaiveSum[id];
      }
    }

    // add on new stuff
    if (dayData[curDay] !== undefined) {
      for (const [id, playedMs] of Object.entries(dayData[curDay])) {
        windowNaiveSum[id] = (windowNaiveSum[id] ?? 0) + playedMs;
        window[id] = (window[id] ?? 0) + playedMs;
      }
    }

    // imageURLFetchQueue.addRequest(async () => {
    //   // console.log("finish");
    //   const res = await fetch(
    //     `https://open.spotify.com/oembed?url=https://open.spotify.com/track/${
    //       id.split(":")[2]
    //     }`
    //   );
    //   tempObj.img = (await res.json()).thumbnail_url;
    // });

    windowData[curDay] = { ...window }; //copy
  }
  return windowData;
};
