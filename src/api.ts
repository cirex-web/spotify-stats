import {
  SpotifyTokenSchema,
  SpotifyTrackBatchDataSchema,
  TrackAPISchema,
} from "./schemas";

export class SpotifyAPI {
  static BATCH_SIZE = 50;
  static LOWEST_RES = 300; //px for image
  _clientID: string;
  _clientToken: string;
  token?: string;
  queuedIds: string[] = [];
  callBacks: Record<string, (imgUrl: string) => void> = {};
  timeoutId?: number;

  constructor(clientID: string, clientToken: string) {
    this._clientID = clientID;
    this._clientToken = clientToken;
  }
  async init() {
    const url = "https://accounts.spotify.com/api/token";

    const headers = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const body = new URLSearchParams();
    body.append("grant_type", "client_credentials");
    body.append("client_id", this._clientID);
    body.append("client_secret", this._clientToken);

    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: body,
    });

    const data = SpotifyTokenSchema.parse(await response.json());
    this.token = data.access_token;
  }
  processBatch() {
    if (!this.token) {
      console.error("didn't initialize Spotify client!");
      return;
    }
    console.assert(this.timeoutId !== undefined);
    clearTimeout(this.timeoutId);
    this.timeoutId = undefined;
    console.info("Fetching", this.queuedIds.length, "images");
    console.assert(this.queuedIds.length <= SpotifyAPI.BATCH_SIZE);

    const url: string = `https://api.spotify.com/v1/tracks?ids=${this.queuedIds.join(
      ","
    )}`;
    this.queuedIds = [];

    fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        const parsedData = SpotifyTrackBatchDataSchema.parse(data);
        parsedData.tracks.forEach((track) => {
          let bestImage = track.album.images[0];
          for (const image of track.album.images) {
            if (image.height >= SpotifyAPI.LOWEST_RES) {
              bestImage = image;
            }
          }
          this.callBacks[track.id](bestImage.url);
          delete this.callBacks[track.id];
        });
      });
  }

  /**
   *
   * @param id Just the id part without the spotify:track: prefix
   */
  async getThumbnailUrl(id: string): Promise<string> {
    this.queuedIds.push(id);
    const promise = new Promise<string>((resolvePromise) => {
      this.callBacks[id] = resolvePromise; // call resolve when done
      // resolvePromise("https://placehold.co/400");
    });
    if (this.timeoutId === undefined) {
      this.timeoutId = setTimeout(() => this.processBatch(), 200);
    }

    if (this.queuedIds.length === SpotifyAPI.BATCH_SIZE) {
      this.processBatch(); //overrides timeout
    }

    return promise; //I promise uwu
  }
}
