import { IFullTrackData, RowData, WindowData } from "./dataSetup";
import { ISpotifyTrack } from "./schemas";

const MS_IN_DAY = 1000 * 60 * 60 * 24;
const MS_IN_YEAR = MS_IN_DAY * 365;
function textFitsWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font?: string
) {
  if (font !== undefined) ctx.font = font;
  return ctx.measureText(text).width <= maxWidth;
}
/** Implicitly requires font to be set to something */
function truncateTextGivenWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  font?: string
) {
  if (font !== undefined) ctx.font = font; //otherwise assumed to be default
  let lo = 0,
    hi = text.length;
  if (textFitsWidth(ctx, text, maxWidth)) return text;
  while (lo <= hi) {
    let mid = Math.floor((lo + hi) / 2);
    if (
      ctx.measureText(text.substring(0, mid).trim() + "...").width <= maxWidth
    ) {
      // makes this O(Nlog(N)) but idc
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  if (hi === -1) return ""; //you can fit absolutely nothing (well at least not ...)
  return text.substring(0, hi).trim() + "...";
}
function drawTextDynamic(
  ctx: CanvasRenderingContext2D,
  options: {
    text: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    fontType: string;
    maxWidth: number;
    maxHeight: number;
    x: number;
    y: number;
    color?: string;
    lineGap: number; // equivalent to CSS line height property (ex. 1.1)
    minFont: number;
    maxFont: number;
  }
) {
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = options.baseline ?? "alphabetic";
  let lo = options.minFont,
    hi = options.maxFont;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    ctx.font = `${mid}px ${options.fontType}`;
    const lines = wrapText(ctx, options.text, options.maxWidth);
    if (
      lines === null ||
      lines.length * (mid * options.lineGap) > options.maxHeight
    ) {
      hi = mid - 1;
    } else {
      lo = mid + 1;
    }
  }
  if (hi < options.minFont) throw new Error("decrease your minFont man");
  drawText(ctx, {
    text: options.text,
    align: options.align,
    baseline: options.baseline,
    font: `${hi}px ${options.fontType}`,
    maxWidth: options.maxWidth,
    x: options.x,
    y: options.y,
    color: options.color,
    multiline: true,
    lineHeight: hi * options.lineGap,
  });
}
function drawText(
  ctx: CanvasRenderingContext2D,
  options: {
    text: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    font: string;
    maxWidth?: number;
    x: number;
    y: number;
    color?: string;
    multiline?: boolean;
    lineHeight?: number;
  }
) {
  ctx.font = options.font;
  ctx.textAlign = options.align ?? "left";
  ctx.textBaseline = options.baseline ?? "alphabetic";
  ctx.fillStyle = options.color ?? "white";
  let text = options.text;
  if (options.multiline) {
    const { lineHeight, maxWidth } = options;
    if (lineHeight === undefined || maxWidth === undefined)
      throw new Error("bro you forgot some params for multiline");

    const lines = wrapText(ctx, text, maxWidth);
    if (lines === null) throw new Error("brooo what have you done");
    lines.forEach((text, i) =>
      ctx.fillText(text, options.x, options.y + i * lineHeight)
    );
  } else {
    if (options?.maxWidth !== undefined)
      text = truncateTextGivenWidth(ctx, text, options.maxWidth);
    ctx.fillText(text, options.x, options.y);
  }
}
function drawVerticalLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + length);
  ctx.closePath();
  ctx.stroke();
}
function drawHorizontalLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  length: number
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + length, y);
  ctx.closePath();
  ctx.stroke();
}
// taken from stack overflow to save 5 minutes lol (but then I modified it anyways oh well)
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
) {
  const words = text.split(" ");
  const lines = [""];

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (ctx.measureText(word).width > maxWidth) return null; // we aren't gonna do character wrapping here, so this width constraint is impossible
    const currentLine = lines[lines.length - 1];
    const newCurrentLine =
      currentLine.length === 0 ? word : currentLine + " " + word;
    if (ctx.measureText(newCurrentLine).width <= maxWidth) {
      lines[lines.length - 1] = newCurrentLine;
    } else {
      lines.push(word);
    }
  }
  return lines;
}
function fillRectStartEnd(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
}

function pickTextColorBasedOnBgColorSimple(
  colorInHex: string,
  lightColor: string,
  darkColor: string
) {
  const color = colorInHex.slice(1);
  var r = parseInt(color.substring(0, 2), 16); // hexToR
  var g = parseInt(color.substring(2, 4), 16); // hexToG
  var b = parseInt(color.substring(4, 6), 16); // hexToB
  return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? darkColor : lightColor;
}
class Bar {
  RECT_HEIGHT: number;
  WIDTH: number; //max width of actual bar, not including image
  LABEL_PADDING_LEFT = 20;
  LABEL_PADDING_RIGHT = 15;
  VALUE_MARGIN_LEFT = 10;
  IMAGE_RECT_GAP = 10;
  TRANSITION_DURATION_MS = 250;
  // x coord where bars start (imageX is thus < x)
  x: number;
  // topY
  y: number;
  desiredI: number; //top left pos (desired y val)
  curI: number;
  prevI: number; //what we're transitioning from
  transitionStartTimeStamp: number | null = null;
  label: string;
  img: HTMLImageElement;
  backgroundColor: string;
  percentFilled: number;
  currentValue: number;
  RECT_GAP: number; // some bleed in of responsibility... we do need this to render the rectangle though if the only thing we're passing in is the index
  IMAGE_PADDING = 6;
  IMAGE_BORDER = 3;
  THIN_RECT_HEIGHT = 6;

  constructor(
    trackData: IFullTrackData,
    width: number,
    height: number,
    gap: number,
    x: number,
    y: number,
    curI: number
  ) {
    this.label =
      trackData.master_metadata_track_name +
      " - " +
      trackData.master_metadata_album_artist_name;
    this.img = trackData.img;
    this.backgroundColor = trackData.averageColor;

    this.WIDTH = width;
    this.RECT_HEIGHT = height;
    this.RECT_GAP = gap;
    this.x = x;
    this.y = y;
    this.desiredI = this.curI = this.prevI = curI; //prev and desired only matter if transitionStartTimeStamp is not null
    this.percentFilled = 1;
    this.currentValue = 1;
  }
  moveTo(
    i: number,
    percentFilled: number,
    currentValue: number,
    timeStamp: number
  ) {
    console.assert(!isNaN(percentFilled));
    if (this.desiredI !== i) {
      // only do the transition stuff IF it's a new dest

      this.desiredI = i;
      this.transitionStartTimeStamp = timeStamp;
      this.prevI = this.curI;
    }
    this.currentValue = currentValue;
    this.percentFilled = percentFilled;
  }
  /**
   * Returns true if done transitioning
   * @param ctx
   * @param timestamp
   */
  draw(ctx: CanvasRenderingContext2D, timestamp: number) {
    if (this.transitionStartTimeStamp !== null) {
      const totalDist = this.desiredI - this.prevI;
      const progressPercent = Math.min(
        1,
        (timestamp - this.transitionStartTimeStamp) /
          this.TRANSITION_DURATION_MS
      );
      this.curI = this.prevI + totalDist * progressPercent;
      if (progressPercent === 1) {
        this.transitionStartTimeStamp = null;
      }
    }
    const rectTopY = this.curI * (this.RECT_HEIGHT + this.RECT_GAP) + this.y;

    // image x pos calculation
    const percentProgress =
      this.curI > 11 // FIXME: grrr magic number
        ? 0
        : Math.floor(this.curI) % 2 === 0
        ? (Math.cos((this.curI % 1) * Math.PI) + 1) / 2
        : 1 - (Math.cos((this.curI % 1) * Math.PI) + 1) / 2; //First row is inwards
    const imageHeight = this.RECT_HEIGHT * 2 + this.RECT_GAP * 2;
    const imageLeftX =
      this.x -
      imageHeight * 2 -
      this.IMAGE_RECT_GAP +
      imageHeight * percentProgress;

    const fullRectStartX = this.x;
    const fullRectEndX = this.x + this.WIDTH;
    const rectWidth = (fullRectEndX - fullRectStartX) * this.percentFilled;
    const labelMaxWidth =
      rectWidth - this.LABEL_PADDING_LEFT - this.LABEL_PADDING_RIGHT;
    const labelFont = "normal 400 22px Oswald";
    const minuteFont = "25px Courier New";
    const rectMiddleY = rectTopY + this.RECT_HEIGHT / 2; // right in the middle
    const rectEndX = fullRectStartX + rectWidth;
    ctx.fillStyle = this.backgroundColor;

    ctx.fillRect(
      imageLeftX + this.IMAGE_PADDING,
      rectMiddleY - imageHeight / 2 + this.IMAGE_PADDING,
      imageHeight - this.IMAGE_PADDING * 2,
      imageHeight - this.IMAGE_PADDING * 2
    );

    ctx.drawImage(
      this.img,
      imageLeftX + this.IMAGE_PADDING + this.IMAGE_BORDER,
      rectMiddleY - imageHeight / 2 + this.IMAGE_PADDING + this.IMAGE_BORDER,
      imageHeight - (this.IMAGE_PADDING + this.IMAGE_BORDER) * 2,
      imageHeight - (this.IMAGE_PADDING + this.IMAGE_BORDER) * 2
    );

    ctx.fillRect(fullRectStartX, rectTopY, rectWidth, this.RECT_HEIGHT);
    fillRectStartEnd(
      ctx,
      imageLeftX + imageHeight - this.IMAGE_PADDING,
      rectMiddleY - this.THIN_RECT_HEIGHT / 2,
      fullRectStartX,
      rectMiddleY + this.THIN_RECT_HEIGHT / 2
    );
    const labelColor = pickTextColorBasedOnBgColorSimple(
      this.backgroundColor,
      "white",
      "black"
    );
    if (textFitsWidth(ctx, this.label, labelMaxWidth, labelFont)) {
      drawText(ctx, {
        text: this.label,
        align: "right",
        baseline: "middle",
        font: labelFont,
        x: rectEndX - this.LABEL_PADDING_RIGHT,
        y: rectMiddleY,
        color: labelColor,
      });
    } else {
      drawText(ctx, {
        text: this.label,
        align: "left",
        baseline: "middle",
        font: labelFont,
        x: fullRectStartX + this.LABEL_PADDING_LEFT,
        y: rectMiddleY,
        maxWidth: this.WIDTH - 50, //arbitrary
        color: "white",
      });
      ctx.save();
      ctx.beginPath();
      ctx.rect(fullRectStartX, rectTopY, rectWidth, this.RECT_HEIGHT);
      ctx.clip();

      drawText(ctx, {
        text: this.label,
        align: "left",
        baseline: "middle",
        font: labelFont,
        x: fullRectStartX + this.LABEL_PADDING_LEFT,
        y: rectMiddleY,
        maxWidth: this.WIDTH - 50, //arbitrary
        color: labelColor,
      });
      ctx.restore();
    }
    if (this.curI <= 0.5) {
      drawText(ctx, {
        text: `${(Math.floor(this.currentValue / 1000) / 60).toFixed(2)} min`,
        align: "left",
        baseline: "middle",
        font: minuteFont,
        x: rectEndX + this.VALUE_MARGIN_LEFT,
        y: rectMiddleY,
      });
    }

    return this.transitionStartTimeStamp === null;
  }
}
class Timeline {
  MARGIN_BOTTOM = 20;
  MARGIN_LEFT = 20;
  MARGIN_RIGHT = 20;
  startDate: number; // keep in mind this is date and not *day*
  endDate: number;
  setTime: (time: Date) => void;
  BUTTON_SIZE = 50;
  TICK_HEIGHT = 20;
  GAP = 30;

  constructor(startDay: number, endDay: number, setTime: (time: Date) => void) {
    this.startDate = startDay * MS_IN_DAY;
    this.endDate = endDay * MS_IN_DAY;
    console.assert(this.startDate < this.endDate);
    this.setTime = setTime; // pass data up
  }
  draw(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number
  ) {
    const majorTicks = [this.startDate, this.endDate];
    const multiple = MS_IN_YEAR; // oh unless leap years eek
    let tickDate =
      Math.floor((this.startDate + MS_IN_YEAR - 1) / MS_IN_YEAR) * MS_IN_YEAR; //right we round up on year for first start date

    for (; tickDate <= this.endDate; tickDate += multiple) {
      majorTicks.push(tickDate);
    }
    const timelineStartX = this.MARGIN_LEFT + this.BUTTON_SIZE + this.GAP;
    const timelineEndX = canvasWidth - this.MARGIN_RIGHT;
    const timelineLength = timelineEndX - timelineStartX;
    const timelineY = canvasHeight - this.MARGIN_BOTTOM - this.TICK_HEIGHT;
    drawHorizontalLine(ctx, timelineStartX, timelineY, timelineLength);
    for (const tick of majorTicks) {
      const xPos =
        (timelineLength * (tick - this.startDate)) /
        (this.endDate - this.startDate);
      drawVerticalLine(ctx, xPos + timelineStartX, timelineY, this.TICK_HEIGHT);
    }
  }
}
class TopSong {
  X: number;
  Y: number;
  data?: IFullTrackData;
  startDate?: Date;
  IMG_WIDTH = 210;
  IMAGE_BORDER = 5;
  constructor(x: number, y: number) {
    this.X = x;
    this.Y = y;
  }
  draw(ctx: CanvasRenderingContext2D, timeStamp: number, curDate: Date) {
    if (!this.data) return;
    if (!this.startDate) throw new Error("bro how is this possible");
    const leadDays = Math.floor((+curDate - +this.startDate) / MS_IN_DAY);
    drawText(ctx, {
      text: `#1 for ${leadDays} day${leadDays === 1 ? "" : "s"}`,
      align: "left",
      baseline: "top",
      font: "30px Oswald",
      x: this.X,
      y: this.Y,
    });
    drawTextDynamic(ctx, {
      text: `${this.data.master_metadata_track_name} by ${this.data.master_metadata_album_artist_name}`,
      align: "left",
      baseline: "top",
      fontType: "Oswald",
      x: this.X,
      y: this.Y + this.IMG_WIDTH + 35 + 20,
      maxWidth: this.IMG_WIDTH,
      lineGap: 1.2,
      maxHeight: 90,
      minFont: 10,
      maxFont: 100,
    });
    ctx.fillStyle = this.data.averageColor;
    ctx.fillRect(this.X, this.Y + 35, this.IMG_WIDTH, this.IMG_WIDTH);
    ctx.drawImage(
      this.data.img,
      this.X + this.IMAGE_BORDER,
      this.Y + 35 + this.IMAGE_BORDER,
      this.IMG_WIDTH - 2 * this.IMAGE_BORDER,
      this.IMG_WIDTH - 2 * this.IMAGE_BORDER
    );
  }
  updateTop(newData: IFullTrackData | undefined, curDate: Date) {
    if (newData?.spotify_track_uri !== this.data?.spotify_track_uri) {
      this.data = newData;
      this.startDate = curDate;
    }
  }
}

export class BarAnimator {
  MS_PER_FRAME = MS_IN_DAY / 24;
  RECT_HEIGHT = 42;
  GRAPH_MARGIN_LEFT = 40;
  GRAPH_MARGIN_RIGHT = 140;
  GRAPH_MARGIN_TOP = 20;
  AXIS_HEIGHT = 150; // top axis height
  GRAPH_MARGIN_BOTTOM = 20;
  RECT_GAP = 6;
  NUM_ROWS = 11;
  AXIS_MARGIN_LEFT = 190; // magic number that's approximately the width of entirety of the stacked images
  BAR_MARGIN_RIGHT = 140; //to account for the XXX min after every bar
  windowData: WindowData;
  windowMax: Record<number, number>; //basically more flexible array
  idToSongData: Record<string, IFullTrackData>;
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  range: {
    startDay: number;
    endDay: number;
  };
  curDate: Date;
  activeBarMap: Record<string, Bar> = {};
  //top left corner
  TOP_SONG_X = 240; //relative to right border
  TOP_SONG_Y = 380; //relative to bottom border
  topSongFrame: TopSong;
  timeline: Timeline;
  WIDTH: number;
  HEIGHT: number;
  // so we want a fixed width/height for the canvas - we're then just scaling everything in here maybe x2 to fit dpi. BUT extending the canvas dims by x2 initially does not mean all of that is free real-estate lol

  AXIS_INTERVALS = [
    0.25,
    0.5,
    1,
    2,
    4,
    8,
    16,
    32,
    64,
    128,
    256,
    512,
    Infinity,
  ].map((ms) => ms * 1000 * 60); //okay yeah we need the last one lol
  windowAxis: Record<number, number>;
  constructor(
    windowData: WindowData,
    idToSong: Record<string, IFullTrackData>,
    canvas: HTMLCanvasElement
  ) {
    if (Object.keys(windowData).length === 0) throw new Error("Empty data!");
    this.windowData = windowData;
    this.canvas = canvas;
    this.idToSongData = idToSong;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot get context!");
    this.ctx = ctx;

    const days = Object.keys(windowData).map((numStr) => parseInt(numStr));
    this.range = {
      startDay: Math.min(...days),
      endDay: Math.max(...days),
    };
    this.curDate = new Date(this.range.startDay * MS_IN_DAY);
    this.timeline = new Timeline(
      this.range.startDay,
      this.range.endDay,
      () => {}
    );
    this.windowMax = {};
    for (const [day, data] of Object.entries(windowData)) {
      const interpolatedBarValsForThatDay = this.getInterpolatedCurrentData(
        new Date(parseInt(day) * MS_IN_DAY)
      ).map((ar) => ar[1]);
      if (interpolatedBarValsForThatDay.length) {
        this.windowMax[parseInt(day)] = Math.max(
          ...interpolatedBarValsForThatDay
        );
      }
    }
    this.windowAxis = {};
    for (const day of Object.keys(windowData)) {
      const maxValForDay = this.getWeightedAverage(
        this.windowMax,
        new Date(parseInt(day) * MS_IN_DAY)
      );
      for (let i = 1; i < this.AXIS_INTERVALS.length; i++) {
        if (maxValForDay / this.AXIS_INTERVALS[i] < 3) {
          this.windowAxis[parseInt(day)] = i - 1;
          break;
        }
      }
    }

    const dpr = 3;
    const rect = canvas.getBoundingClientRect();
    // Set the "actual" size of the canvas
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // Scale the context to ensure correct drawing operations
    ctx.scale(dpr, dpr);
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
    this.WIDTH = rect.width;
    this.HEIGHT = rect.height;

    this.topSongFrame = new TopSong(
      this.WIDTH - this.TOP_SONG_X,
      this.HEIGHT - this.TOP_SONG_Y
    );
  }

  /**
   * Very expensive weighted average done on every id within the given window. somehow this doesn't noticeably slow things down though lol
   * @returns Sorted rows in array given current time (can be between two whole-number dates)
   */
  getInterpolatedCurrentData(curDate: Date = this.curDate) {
    const windowSize = 10.5; // arbitrary number that seems to give pretty smooooth bar lengths
    const leftDay = Math.ceil(+curDate / MS_IN_DAY - windowSize / 2);
    const rightDay = Math.floor(+curDate / MS_IN_DAY + windowSize / 2);
    const curDayFloat = +curDate / MS_IN_DAY;
    let ids: string[] = [];
    for (let day = leftDay; day <= rightDay; day++) {
      if (!this.windowData[day]) continue;
      ids = ids.concat(Object.keys(this.windowData[day]));
    }
    ids = [...new Set(ids)];

    const res: [string, number][] = [];
    for (const id of ids) {
      let weight = 0;
      let sum = 0;
      for (let day = leftDay; day <= rightDay; day++) {
        if (!this.windowData[day]) continue;
        const curWeight =
          Math.cos(((day - curDayFloat) / (windowSize / 2)) * Math.PI) / 2 +
          0.5;
        console.assert(curWeight >= -0.0001);
        sum += curWeight * (this.windowData[day][id] ?? 0);
        weight += curWeight;
      }

      res.push([id, weight === 0 ? 0 : sum / weight]);
    }
    return res.sort((a, b) => b[1] - a[1]);
  }
  getLinearInterpolatedCurrentData() {
    const day = Math.floor(+this.curDate / MS_IN_DAY);
    const skew = (+this.curDate % MS_IN_DAY) / MS_IN_DAY; //how much to favor today vs. tomorrow
    const prevDay = day,
      nextDay = day + 1;
    const prevData = this.windowData[prevDay] ?? {},
      nextData = this.windowData[nextDay] ?? {};
    const ids = Array.from(
      new Set(Object.keys(prevData).concat(Object.keys(nextData)))
    );

    const res: [string, number][] = [];
    for (const id of ids) {
      const prevDuration = prevData[id] ?? 0;
      const nextDuration = nextData[id] ?? 0;
      res.push([id, prevDuration * (1 - skew) + nextDuration * skew]);
    }

    return res.sort((a, b) => b[1] - a[1]);
  }
  getWeightedAverage(
    curWindow: Record<number, number>,
    curDate: Date = this.curDate
  ) {
    const windowSize = 5.5; // decimal val makes it jitter a lot less (probably cuz it prevents the sudden loss + gain of two different datapoints)
    const leftDay = Math.ceil(+curDate / MS_IN_DAY - windowSize / 2);
    const rightDay = Math.floor(+curDate / MS_IN_DAY + windowSize / 2);
    const curDayFloat = +curDate / MS_IN_DAY;
    let weight = 0;
    let sum = 0;

    for (let day = leftDay; day <= rightDay; day++) {
      const curWeight =
        Math.cos(((day - curDayFloat) / (windowSize / 2)) * Math.PI) / 2 + 0.5;
      weight += curWeight;
      sum += (curWindow[day] ?? 0) * curWeight;
    }
    return weight === 0 ? 0 : sum / weight;
  }
  drawFrame(timeStamp: number) {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
    const sortedRows = this.getInterpolatedCurrentData();
    const topRows = sortedRows.slice(0, this.NUM_ROWS); //for actual graph rendering (we still need all rows for reference tho)
    const maxMs = Math.max(
      1000 * 60,
      this.getWeightedAverage(
        this.windowMax,
        new Date(+this.curDate - MS_IN_DAY * 0.4)
      )
    ); //we don't want it dropping to 0 lol
    const axisStepIndex = this.getWeightedAverage(this.windowAxis);
    const axisLength =
      this.WIDTH -
      this.GRAPH_MARGIN_LEFT -
      this.GRAPH_MARGIN_RIGHT -
      this.AXIS_MARGIN_LEFT -
      this.BAR_MARGIN_RIGHT;
    this.drawAxis(axisStepIndex, maxMs, axisLength);

    const idToVal = sortedRows.reduce<Record<string, number>>(
      (obj, [id, val]) => {
        obj[id] = val;
        return obj;
      },
      {}
    );
    const topIdToVal = topRows.reduce<Record<string, number>>(
      (obj, [id, val]) => {
        obj[id] = val;
        return obj;
      },
      {}
    );

    const killedIds = new Set(
      Object.keys(this.activeBarMap).filter(
        (id) => topIdToVal[id] === undefined //no longer in the top
      )
    );

    // update all active bars
    topRows.forEach(([id, val], i) => {
      if (!this.activeBarMap[id])
        this.activeBarMap[id] = new Bar(
          this.idToSongData[id],
          axisLength, // geez okay
          this.RECT_HEIGHT,
          this.RECT_GAP,
          this.GRAPH_MARGIN_LEFT + this.AXIS_MARGIN_LEFT,
          this.GRAPH_MARGIN_TOP + this.AXIS_HEIGHT,
          this.NUM_ROWS + 1
        );
      this.activeBarMap[id].moveTo(i, val / maxMs, val, timeStamp);
    });
    // update non-top bars
    for (const id of killedIds) {
      this.activeBarMap[id].moveTo(
        this.NUM_ROWS + 1,
        (idToVal[id] ?? 0) / maxMs, //data could've evaporated by this point
        idToVal[id] ?? 0,
        timeStamp
      );
    }

    //kill inactive bars if finished transitioning
    for (const id of Object.keys(this.activeBarMap)) {
      const doneAnimating = this.activeBarMap[id].draw(this.ctx, timeStamp);
      if (doneAnimating && killedIds.has(id)) delete this.activeBarMap[id];
    }

    // drawText(this.ctx, {
    //   text: ,
    //   font: dateFont,
    //   align: "right",
    //   baseline: "bottom",
    //   x: this.WIDTH - this.GRAPH_MARGIN_RIGHT,
    //   y: this.HEIGHT - this.GRAPH_MARGIN_BOTTOM,
    // });
    drawText(this.ctx, {
      text: `Most Streamed Spotify Songs by the end of ${
        this.curDate.getMonth() + 1
      }/${this.curDate.getDate()}/${this.curDate.getFullYear() % 100}`,
      align: "left",
      baseline: "top",
      x: this.GRAPH_MARGIN_LEFT,
      y: this.GRAPH_MARGIN_TOP,
      font: "normal 600 50px Oswald",
    });

    this.topSongFrame.updateTop(
      topRows.length ? this.idToSongData[topRows[0][0]] : undefined,
      this.curDate
    );
    this.topSongFrame.draw(this.ctx, timeStamp, this.curDate);
    // this.timeline.draw(this.ctx, this.WIDTH, this.HEIGHT);
  }

  private drawAxis(axisStepIndex: number, maxMs: number, axisLength: number) {
    const axisSkew = 1 - (axisStepIndex % 1);
    const floorIndex = Math.floor(axisStepIndex);
    console.assert(floorIndex >= 0);
    drawText(this.ctx, {
      text: "Minutes streamed in 30-day weighted window",
      align: "center",
      x: this.WIDTH / 2,
      y: this.GRAPH_MARGIN_TOP + this.AXIS_HEIGHT - 42,
      baseline: "bottom",
      font: "25px Oswald",
    });
    this.drawAxisHelper(
      this.AXIS_INTERVALS[floorIndex],
      axisSkew,
      maxMs,
      axisLength
    );
    if (floorIndex + 1 < this.AXIS_INTERVALS.length) {
      this.drawAxisHelper(
        this.AXIS_INTERVALS[floorIndex + 1],
        1 - axisSkew,
        maxMs,
        axisLength
      );
    }
  }

  drawAxisHelper(
    step: number,
    opacity: number,
    maxMs: number,
    axisLength: number
  ) {
    const FADE_OFF_DIST = 50; //doesn't include invisible dist
    const INVISIBLE_DIST = 30;
    for (let i = 0; i <= maxMs * 1.5; i += step) {
      const lineX =
        this.GRAPH_MARGIN_LEFT +
        this.AXIS_MARGIN_LEFT +
        (i / maxMs) * axisLength;
      const lineY = this.GRAPH_MARGIN_TOP + this.AXIS_HEIGHT;
      const curOpacity = Math.min(
        opacity,
        Math.min(
          FADE_OFF_DIST,
          Math.max(0, this.WIDTH - INVISIBLE_DIST - lineX)
        ) / FADE_OFF_DIST
      ); // 20 - 30
      // console.log(curOpacity);
      this.ctx.strokeStyle = `rgba(153,153,153,${curOpacity})`;
      this.ctx.lineWidth = 2;
      drawVerticalLine(
        this.ctx,
        lineX,
        lineY,
        this.HEIGHT - this.GRAPH_MARGIN_BOTTOM - this.GRAPH_MARGIN_TOP
      );
      drawText(this.ctx, {
        text: `${Math.round((i / (1000 * 60)) * 10) / 10}`,
        align: "center",
        x: lineX,
        y: lineY - 10,
        baseline: "bottom",
        font: "20px Rubik",
        color: `rgba(153,153,153,${curOpacity})`,
      });
    }
  }

  startLoop(startDate?: Date) {
    this.curDate = startDate ?? new Date(this.range.startDay * MS_IN_DAY);
    const endDate = new Date(this.range.endDay * MS_IN_DAY);
    const intervalId = setInterval(
      () => {
        this.curDate = new Date(this.MS_PER_FRAME + +this.curDate);
        if (this.curDate >= endDate) {
          this.curDate = endDate;
          clearInterval(intervalId);
        }
      },
      1000 / 60 // 60 Hz
    );
    requestAnimationFrame((time) => {
      requestAnimationFrame((time) => this.drawLoop(time));
    });
  }
  drawLoop(time: number) {
    this.drawFrame(time);
    requestAnimationFrame((time) => this.drawLoop(time));
  }
}
