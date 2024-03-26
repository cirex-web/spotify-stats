import { SpotifyAPI } from "./api";
import { ISpotifyHistory, ISpotifyTrack, SpotifyDataSchema } from "./schemas";
import { FastAverageColor } from "fast-average-color";

export interface RowData {
  id: string;
  val: number;
}

export type Frame = Record<string, number>;
export type WindowData = Record<number, Frame>; //TODO: can probably be generalized to Date as key

export interface IFullTrackData extends ISpotifyTrack {
  img: HTMLImageElement;
  averageColor: string;
}

const fac = new FastAverageColor();

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
  const idToSong: Record<string, ISpotifyTrack> = {};
  const idToSongFull: Record<string, IFullTrackData> = {};
  const promises: Promise<void>[] = [];

  // dict value is map from id to isItsOwnAlbum
  const trackSlugToIds: Record<string, Record<string, boolean>> = {}; // just in case there's duplicates (ie a song swapped between a couple different albums)
  for (const data of rawData) {
    const id = data.spotify_track_uri;
    if (id === null) continue;
    const partOfAlbum =
      data.master_metadata_album_album_name !== data.master_metadata_track_name;
    const trackSlug = `${data.master_metadata_track_name
      .replaceAll(".", "")
      .toLowerCase()}/${data.master_metadata_album_artist_name}`;
    if (trackSlugToIds[trackSlug] === undefined) trackSlugToIds[trackSlug] = {};
    if (trackSlugToIds[trackSlug][id] !== undefined)
      console.assert(trackSlugToIds[trackSlug][id] === partOfAlbum);
    else trackSlugToIds[trackSlug][id] = partOfAlbum;
  }
  const idToSingleId: Record<string, string> = {};
  for (const idMap of Object.values(trackSlugToIds)) {
    console.assert(Object.keys(idMap).length > 0);
    let singleId = Object.keys(idMap)[0]; //what all other ids in idMap will point to
    for (const [id, partOfAlbum] of Object.entries(idMap)) {
      if (!partOfAlbum) {
        singleId = id; //prefer non-album track for better cover art :)
        break;
      }
    }
    for (const id of Object.keys(idMap)) {
      idToSingleId[id] = singleId;
    }
  }
  for (const entry of rawData) {
    if (entry.spotify_track_uri === null) {
      continue;
    }
    if (entry.ms_played <= 0) continue; // why do we even have to deal with this lol (mostly the 0 case)
    const day = Math.floor(
      new Date(entry.ts).getTime() / (1000 * 60 * 60 * 24)
    );
    const trueId = idToSingleId[entry.spotify_track_uri];
    console.assert(trueId !== undefined);
    if (!dayData[day]) dayData[day] = {};

    dayData[day][trueId] = (dayData[day][trueId] ?? 0) + entry.ms_played;
    idToSong[trueId] = entry;
  }

  // gets image + average color
  for (const id of Object.keys(idToSong)) {
    promises.push(
      spotifyAPI.getThumbnailUrl(id.split(":")[2]).then(async (url) => {
        const image = new Image();
        image.src = url;
        image.crossOrigin = "anonymous";
        const color = (await fac.getColorAsync(image)).hexa;
        idToSongFull[id] = { ...idToSong[id], img: image, averageColor: color };
      })
    );
  }
  await Promise.all(promises);
  return [dayData, idToSongFull] as const;
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
