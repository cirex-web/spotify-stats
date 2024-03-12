import { SpotifyAPI } from "./api";
import { BarAnimator } from "./canvas";
import {
  generateDatePoints,
  generateWindowData,
  getRawData,
} from "./dataSetup";
import { PromiseQueue } from "./queue";

const imageURLFetchQueue = new PromiseQueue(10);

const spotifyAPI = new SpotifyAPI(
  "09a283d0efee438d9c5a7549eea57086",
  "b923ba3aa79f4827a801ed4ce12253ce"
);
await spotifyAPI.init();

// shamelessly taken from stack overflow
function record(canvas: HTMLCanvasElement) {
  const recordedChunks: Blob[] = [];
  var stream = canvas.captureStream(60 /*fps*/);
  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: "video/webm; codecs=vp9",
  });

  //ondataavailable will fire in interval of `time || 4000 ms`
  mediaRecorder.start();

  mediaRecorder.ondataavailable = function (event) {
    recordedChunks.push(event.data);
  };

  mediaRecorder.onstop = function (event) {
    const url = URL.createObjectURL(
      new Blob(recordedChunks, { type: "video/webm" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "video.webm";
    anchor.click();
    window.URL.revokeObjectURL(url);
  };
  setTimeout(() => mediaRecorder.stop(), 10000);
}

const canvas = document.getElementsByTagName(
  "canvas"
)[0] as HTMLCanvasElement | null;
if (!canvas) throw new Error("where art thou canvas");
const rawData = (
  await getRawData(["../history1.json", "../history2.json"])
).splice(0);
const [dayData, idToSong] = await generateDatePoints(rawData, spotifyAPI);
const windowData = generateWindowData(dayData, 30);

console.log(dayData, windowData, idToSong);
// Ok so we pass in the entire Frame (map) for every date, cuz otherwise the interpolated data would be kind of wrong if we truncated and/or sorted the data beforehand.
const barAnimator = new BarAnimator(windowData, idToSong, canvas);
barAnimator.startLoop(new Date("6/1/22"));
// record(canvas);

// okay wait maybe we should only pass in the final sorted data with all relevant properties
