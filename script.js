/*
  QZ Core Engine
  Live cycle detection + timed anti-noise test

  This is a browser proof-of-concept.

  It:
  1. Listens through the phone microphone.
  2. Detects repeating sound onsets.
  3. Estimates the repetition period.
  4. Predicts the next onset.
  5. Fires a short test burst at the predicted time.

  This is NOT yet true real-time ANC.
*/


/* =========================================================
   PAGE ELEMENTS
   ========================================================= */

const infoBtn = document.getElementById("infoBtn");
const infoClose = document.getElementById("infoClose");
const infoSheet = document.getElementById("infoSheet");

const startBtn = document.getElementById("startBtn");

const periodVal = document.getElementById("periodVal");
const lockVal = document.getElementById("lockVal");
const fireVal = document.getElementById("fireVal");

const canvas = document.getElementById("scope");
const ctx = canvas.getContext("2d");


/* =========================================================
   INFO SHEET
   ========================================================= */

infoBtn.addEventListener("click", () => {
  infoSheet.classList.add("open");
});

infoClose.addEventListener("click", () => {
  infoSheet.classList.remove("open");
});

infoSheet.addEventListener("click", (event) => {
  if (event.target === infoSheet) {
    infoSheet.classList.remove("open");
  }
});


/* =========================================================
   AUDIO STATE
   ========================================================= */

let audioCtx = null;
let analyser = null;
let dataArray = null;
let microphoneStream = null;

let running = false;

let onsetTimes = [];

let lockedPeriod = null;

let cyclesLocked = 0;
let firesCount = 0;

let aboveThreshold = false;
let lastOnsetTime = -Infinity;


/* =========================================================
   DETECTION SETTINGS
   ========================================================= */

// Ignore repeated triggers occurring too close together.
const ONSET_MIN_GAP = 0.25;

// RMS amplitude required to count as a sound onset.
const THRESHOLD = 0.12;

// Number of onset timestamps retained.
const MAX_ONSETS = 8;


/* =========================================================
   START LISTENING
   ========================================================= */

startBtn.addEventListener("click", async () => {

  if (running) {
    return;
  }

  try {

    microphoneStream =
      await navigator.mediaDevices.getUserMedia({
        audio: true
      });

    audioCtx =
      new (window.AudioContext || window.webkitAudioContext)();

    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }

    const source =
      audioCtx.createMediaStreamSource(microphoneStream);

    analyser = audioCtx.createAnalyser();

    analyser.fftSize = 2048;

    dataArray =
      new Uint8Array(analyser.fftSize);

    source.connect(analyser);


    /* RESET TEST */

    onsetTimes = [];

    lockedPeriod = null;

    cyclesLocked = 0;
    firesCount = 0;

    aboveThreshold = false;
    lastOnsetTime = -Infinity;

    periodVal.textContent = "—";
    lockVal.textContent = "0";
    fireVal.textContent = "0";


    /* START */

    running = true;

    startBtn.textContent = "Listening…";
    startBtn.classList.add("listening");

    resizeCanvas();

    requestAnimationFrame(loop);

  } catch (error) {

    console.error(
      "QZ microphone access failed:",
      error
    );

    alert(
      "QZ couldn't access the microphone. " +
      "Check microphone permission and try again."
    );
  }
});


/* =========================================================
   MAIN AUDIO LOOP
   ========================================================= */

function loop() {

  if (!running || !analyser) {
    return;
  }

  analyser.getByteTimeDomainData(dataArray);


  /* CALCULATE RMS AMPLITUDE */

  let sumSquares = 0;

  for (
    let i = 0;
    i < dataArray.length;
    i++
  ) {

    const sample =
      (dataArray[i] - 128) / 128;

    sumSquares +=
      sample * sample;
  }

  const rms =
    Math.sqrt(
      sumSquares / dataArray.length
    );


  const now =
    audioCtx.currentTime;


  /* =====================================================
     ONSET DETECTION
     ===================================================== */

  if (
    rms > THRESHOLD &&
    !aboveThreshold &&
    (now - lastOnsetTime) > ONSET_MIN_GAP
  ) {

    aboveThreshold = true;

    lastOnsetTime = now;

    registerOnset(now);

  } else if (
    rms < THRESHOLD * 0.6
  ) {

    aboveThreshold = false;
  }


  drawScope(rms);

  requestAnimationFrame(loop);
}


/* =========================================================
   REGISTER SOUND ONSET
   ========================================================= */

function registerOnset(time) {

  onsetTimes.push(time);


  /* KEEP ROLLING HISTORY */

  if (
    onsetTimes.length > MAX_ONSETS
  ) {

    onsetTimes.shift();
  }


  /* NEED AT LEAST THREE EVENTS */

  if (
    onsetTimes.length < 3
  ) {

    periodVal.textContent = "learning…";

    return;
  }


  /* CALCULATE GAPS */

  const gaps = [];

  for (
    let i = 1;
    i < onsetTimes.length;
    i++
  ) {

    gaps.push(
      onsetTimes[i] -
      onsetTimes[i - 1]
    );
  }


  /* AVERAGE PERIOD */

  const averageGap =
    gaps.reduce(
      (total, gap) =>
        total + gap,
      0
    ) / gaps.length;


  /* VARIANCE */

  const variance =
    gaps.reduce(
      (total, gap) =>
        total +
        Math.pow(
          gap - averageGap,
          2
        ),
      0
    ) / gaps.length;


  const standardDeviation =
    Math.sqrt(variance);


  /*
    Consider the rhythm stable if
    timing variation is less than
    roughly 35% of the average period.
  */

  const stable =
    standardDeviation <
    averageGap * 0.35;


  /* =====================================================
     LOCK ONTO REPEATING SOUND
     ===================================================== */

  if (
    stable &&
    averageGap > 0.15 &&
    averageGap < 3.0
  ) {

    lockedPeriod =
      averageGap;

    cyclesLocked++;

    periodVal.textContent =
      lockedPeriod.toFixed(2) + "s";

    lockVal.textContent =
      cyclesLocked;


    /*
      Predict the next occurrence.
    */

    scheduleAntiNoise(
      time + lockedPeriod
    );

  } else {

    periodVal.textContent =
      "locking…";
  }
}


/* =========================================================
   SCHEDULE TEST ANTI-NOISE BURST
   ========================================================= */

function scheduleAntiNoise(
  targetTime
) {

  if (
    !audioCtx ||
    targetTime <= audioCtx.currentTime
  ) {

    return;
  }


  /*
    TEMPORARY TEST SIGNAL

    This random-noise burst is NOT
    actual phase cancellation.

    Later this will be replaced with
    captured/inverted target audio.
  */

  const duration =
    0.08;

  const bufferSize =
    Math.floor(
      audioCtx.sampleRate *
      duration
    );


  const buffer =
    audioCtx.createBuffer(
      1,
      bufferSize,
      audioCtx.sampleRate
    );


  const channel =
    buffer.getChannelData(0);


  for (
    let i = 0;
    i < bufferSize;
    i++
  ) {

    /*
      Smooth envelope prevents
      hard digital clicks.
    */

    const envelope =
      Math.sin(
        Math.PI *
        i /
        bufferSize
      );


    channel[i] =
      (Math.random() * 2 - 1) *
      envelope *
      0.5;
  }


  const source =
    audioCtx.createBufferSource();


  source.buffer =
    buffer;


  source.connect(
    audioCtx.destination
  );


  source.start(
    targetTime
  );


  firesCount++;

  fireVal.textContent =
    firesCount;
}


/* =========================================================
   CANVAS SIZE
   ========================================================= */

function resizeCanvas() {

  const rect =
    canvas.getBoundingClientRect();


  const pixelRatio =
    window.devicePixelRatio || 1;


  const width =
    Math.max(
      1,
      Math.floor(
        rect.width *
        pixelRatio
      )
    );


  const height =
    Math.max(
      1,
      Math.floor(
        rect.height *
        pixelRatio
      )
    );


  if (
    canvas.width !== width ||
    canvas.height !== height
  ) {

    canvas.width =
      width;

    canvas.height =
      height;
  }
}


window.addEventListener(
  "resize",
  resizeCanvas
);


/* =========================================================
   DRAW LIVE LEVEL SCOPE
   ========================================================= */

function drawScope(rms) {

  resizeCanvas();


  const width =
    canvas.width;

  const height =
    canvas.height;


  if (
    width < 3 ||
    height < 1
  ) {

    return;
  }


  /*
    Shift existing display left
    by two physical pixels.
  */

  ctx.drawImage(
    canvas,
    2,
    0,
    width - 2,
    height,
    0,
    0,
    width - 2,
    height
  );


  /* CLEAR RIGHT EDGE */

  ctx.fillStyle =
    "#0b1220";

  ctx.fillRect(
    width - 2,
    0,
    2,
    height
  );


  /* CURRENT AUDIO LEVEL */

  const normalized =
    Math.min(
      rms * 4,
      1
    );


  const barHeight =
    normalized *
    height;


  ctx.fillStyle =
    aboveThreshold
      ? "#ff5d5d"
      : "#4fb0ff";


  ctx.fillRect(
    width - 2,
    height - barHeight,
    2,
    barHeight
  );
}


/* =========================================================
   INITIAL CANVAS SETUP
   ========================================================= */

window.addEventListener(
  "load",
  () => {

    resizeCanvas();

    ctx.fillStyle =
      "#121b2e";

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );
  }
);
