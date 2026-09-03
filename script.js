/*
  QZ TNC
  Target + live inverted-audio experiment

  This version proves:

  microphone
      ->
  Web Audio processing
      ->
  connected headphones / earbuds

  The target gesture arms QZ.

  Bluetooth latency may prevent useful cancellation.
  That is one of the things this build is designed
  to expose.
*/


/* =========================================================
   ELEMENTS
   ========================================================= */

const infoBtn =
  document.getElementById("infoBtn");

const infoClose =
  document.getElementById("infoClose");

const infoSheet =
  document.getElementById("infoSheet");

const arrowBtn =
  document.getElementById("arrowBtn");

const arrowStatus =
  document.getElementById("arrowStatus");

const audioBtn =
  document.getElementById("audioBtn");

const targetVal =
  document.getElementById("targetVal");

const micVal =
  document.getElementById("micVal");

const qzVal =
  document.getElementById("qzVal");

const gainSlider =
  document.getElementById("gainSlider");

const gainVal =
  document.getElementById("gainVal");

const delaySlider =
  document.getElementById("delaySlider");

const delayVal =
  document.getElementById("delayVal");

const tareBtn =
  document.getElementById("tareBtn");

const diagnosticsBtn =
  document.getElementById("diagnosticsBtn");

const diagnostics =
  document.getElementById("diagnostics");

const xVal =
  document.getElementById("xVal");

const yVal =
  document.getElementById("yVal");

const peakVal =
  document.getElementById("peakVal");

const sensorVal =
  document.getElementById("sensorVal");

const audioStateVal =
  document.getElementById("audioStateVal");

const sampleRateVal =
  document.getElementById("sampleRateVal");


/* =========================================================
   MOTION STATE
   ========================================================= */

let sensorActive = false;

let gestureActive = false;

let targetAcquired = false;

let peakAcceleration = 0;

let forwardEnergy = 0;

let sidewaysEnergy = 0;

let sampleCount = 0;


/* =========================================================
   AUDIO STATE
   ========================================================= */

let audioCtx = null;

let micStream = null;

let micSource = null;

let filterNode = null;

let delayNode = null;

let inverterNode = null;

let limiterNode = null;

let audioRunning = false;


/* =========================================================
   TARGET SETTINGS
   ========================================================= */

const MIN_ACCELERATION =
  0.35;

const MIN_SAMPLES =
  4;

const DIRECTION_RATIO =
  1.5;


/* =========================================================
   INFO
   ========================================================= */

infoBtn.addEventListener(
  "click",
  () => {
    infoSheet.classList.add("open");
  }
);

infoClose.addEventListener(
  "click",
  () => {
    infoSheet.classList.remove("open");
  }
);

infoSheet.addEventListener(
  "click",
  event => {

    if (event.target === infoSheet) {
      infoSheet.classList.remove("open");
    }

  }
);


/* =========================================================
   DIAGNOSTICS
   ========================================================= */

diagnosticsBtn.addEventListener(
  "click",
  () => {

    diagnostics.classList.toggle("open");

  }
);


/* =========================================================
   MOTION SENSOR
   ========================================================= */

async function enableMotionSensors() {

  if (sensorActive) {
    return true;
  }

  try {

    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function"
    ) {

      const permission =
        await DeviceMotionEvent.requestPermission();

      if (permission !== "granted") {

        sensorVal.textContent =
          "denied";

        return false;
      }
    }

    if (
      typeof DeviceMotionEvent === "undefined"
    ) {

      sensorVal.textContent =
        "unavailable";

      return false;
    }

    window.addEventListener(
      "devicemotion",
      handleMotion,
      { passive: true }
    );

    sensorActive = true;

    sensorVal.textContent =
      "ready";

    return true;

  } catch (error) {

    console.error(error);

    sensorVal.textContent =
      "error";

    return false;
  }
}


/* =========================================================
   TARGET GESTURE
   ========================================================= */

async function startGesture(event) {

  event.preventDefault();

  const ready =
    await enableMotionSensors();

  if (!ready) {

    arrowStatus.textContent =
      "Motion sensor unavailable";

    return;
  }

  resetMotion();

  gestureActive = true;

  targetAcquired = false;

  arrowBtn.classList.remove(
    "acquired"
  );

  arrowBtn.classList.add(
    "armed"
  );

  arrowStatus.textContent =
    "Push phone toward noise";

  targetVal.textContent =
    "WAIT";
}


function endGesture(event) {

  if (event) {
    event.preventDefault();
  }

  if (!gestureActive) {
    return;
  }

  gestureActive = false;

  arrowBtn.classList.remove(
    "armed"
  );

  if (!targetAcquired) {

    targetVal.textContent =
      "NO";

    arrowStatus.textContent =
      "Try again";

  }
}


arrowBtn.addEventListener(
  "pointerdown",
  startGesture
);

arrowBtn.addEventListener(
  "pointerup",
  endGesture
);

arrowBtn.addEventListener(
  "pointercancel",
  endGesture
);


/* =========================================================
   MOTION HANDLER
   ========================================================= */

function handleMotion(event) {

  const acceleration =
    event.acceleration ||
    event.accelerationIncludingGravity;

  if (!acceleration) {
    return;
  }

  const x =
    Number(acceleration.x) || 0;

  const y =
    Number(acceleration.y) || 0;

  xVal.textContent =
    x.toFixed(2);

  yVal.textContent =
    y.toFixed(2);

  if (
    !gestureActive ||
    targetAcquired
  ) {

    return;
  }

  const absX =
    Math.abs(x);

  const absY =
    Math.abs(y);

  const magnitude =
    Math.sqrt(
      x * x +
      y * y
    );

  if (
    magnitude <
    MIN_ACCELERATION
  ) {

    return;
  }

  sampleCount++;

  forwardEnergy +=
    absY;

  sidewaysEnergy +=
    absX;

  if (
    magnitude >
    peakAcceleration
  ) {

    peakAcceleration =
      magnitude;

    peakVal.textContent =
      peakAcceleration.toFixed(2);
  }

  const directional =
    forwardEnergy >
    sidewaysEnergy *
    DIRECTION_RATIO;

  if (
    directional &&
    sampleCount >= MIN_SAMPLES
  ) {

    acquireTarget();
  }
}


/* =========================================================
   TARGET ACQUIRED
   ========================================================= */

function acquireTarget() {

  targetAcquired = true;

  gestureActive = false;

  arrowBtn.classList.remove(
    "armed"
  );

  arrowBtn.classList.add(
    "acquired"
  );

  targetVal.textContent =
    "YES";

  arrowStatus.textContent =
    "GOT IT";

  if ("vibrate" in navigator) {

    navigator.vibrate(
      [80, 50, 140]
    );
  }

  updateAudioGain();
}


/* =========================================================
   AUDIO ENGINE
   ========================================================= */

audioBtn.addEventListener(
  "click",
  async () => {

    if (!audioRunning) {

      await startAudio();

    } else {

      stopAudio();

    }

  }
);


async function startAudio() {

  try {

    /*
      Disable browser voice-processing features
      whenever the browser allows it.

      We want the rawest microphone signal possible.
    */

    micStream =
      await navigator.mediaDevices.getUserMedia({

        audio: {

          echoCancellation: false,

          noiseSuppression: false,

          autoGainControl: false

        }

      });


    audioCtx =
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();


    if (
      audioCtx.state === "suspended"
    ) {

      await audioCtx.resume();
    }


    micSource =
      audioCtx.createMediaStreamSource(
        micStream
      );


    /*
      LOW-PASS FILTER

      Start by concentrating on frequencies
      where cancellation has a better chance.

      Music above this frequency still passes
      acoustically, but QZ does not initially
      try to fight it.
    */

    filterNode =
      audioCtx.createBiquadFilter();

    filterNode.type =
      "lowpass";

    filterNode.frequency.value =
      500;

    filterNode.Q.value =
      0.7;


    /*
      ADJUSTABLE DELAY
    */

    delayNode =
      audioCtx.createDelay(0.5);

    delayNode.delayTime.value =
      Number(delaySlider.value);


    /*
      PHASE INVERSION

      Negative gain flips signal polarity.
    */

    inverterNode =
      audioCtx.createGain();


    /*
      LIMITER / SAFETY
    */

    limiterNode =
      audioCtx.createDynamicsCompressor();

    limiterNode.threshold.value =
      -18;

    limiterNode.knee.value =
      10;

    limiterNode.ratio.value =
      12;

    limiterNode.attack.value =
      0.003;

    limiterNode.release.value =
      0.20;


    micSource
      .connect(filterNode);

    filterNode
      .connect(delayNode);

    delayNode
      .connect(inverterNode);

    inverterNode
      .connect(limiterNode);

    limiterNode
      .connect(audioCtx.destination);


    audioRunning =
      true;


    micVal.textContent =
      "LIVE";

    qzVal.textContent =
      targetAcquired
        ? "ON"
        : "ARMED";

    audioStateVal.textContent =
      "running";

    sampleRateVal.textContent =
      audioCtx.sampleRate + " Hz";

    audioBtn.textContent =
      "Stop QZ Audio";

    audioBtn.classList.add(
      "active"
    );


    updateAudioGain();

  } catch (error) {

    console.error(
      "QZ audio error:",
      error
    );

    alert(
      "QZ could not start the microphone. " +
      "Check microphone permission."
    );

  }
}


/* =========================================================
   AUDIO GAIN
   ========================================================= */

function updateAudioGain() {

  if (!inverterNode) {
    return;
  }

  /*
    QZ stays silent until a target
    has been acquired.

    Negative gain = polarity inversion.
  */

  const requestedGain =
    Number(gainSlider.value);

  const actualGain =
    targetAcquired
      ? -requestedGain
      : 0;


  inverterNode.gain.setTargetAtTime(
    actualGain,
    audioCtx.currentTime,
    0.02
  );


  qzVal.textContent =
    targetAcquired
      ? "ON"
      : "ARMED";
}


/* =========================================================
   STOP AUDIO
   ========================================================= */

function stopAudio() {

  audioRunning =
    false;


  if (micStream) {

    micStream
      .getTracks()
      .forEach(
        track => track.stop()
      );

  }


  if (audioCtx) {

    audioCtx.close();

  }


  audioCtx = null;

  micStream = null;

  micSource = null;

  filterNode = null;

  delayNode = null;

  inverterNode = null;

  limiterNode = null;


  micVal.textContent =
    "OFF";

  qzVal.textContent =
    "OFF";

  audioStateVal.textContent =
    "stopped";

  audioBtn.textContent =
    "Start QZ Audio";

  audioBtn.classList.remove(
    "active"
  );
}


/* =========================================================
   SLIDERS
   ========================================================= */

gainSlider.addEventListener(
  "input",
  () => {

    const percent =
      Math.round(
        Number(gainSlider.value) *
        100
      );

    gainVal.textContent =
      percent + "%";

    updateAudioGain();

  }
);


delaySlider.addEventListener(
  "input",
  () => {

    const delay =
      Number(delaySlider.value);

    delayVal.textContent =
      Math.round(
        delay * 1000
      ) +
      " ms";


    if (delayNode && audioCtx) {

      delayNode.delayTime
        .setTargetAtTime(
          delay,
          audioCtx.currentTime,
          0.01
        );

    }

  }
);


/* =========================================================
   RESET TARGET
   ========================================================= */

tareBtn.addEventListener(
  "click",
  () => {

    targetAcquired =
      false;

    gestureActive =
      false;

    resetMotion();


    arrowBtn.classList.remove(
      "armed",
      "acquired"
    );


    targetVal.textContent =
      "NO";

    arrowStatus.textContent =
      "Touch arrow to target";


    if (
      inverterNode &&
      audioCtx
    ) {

      inverterNode.gain
        .setTargetAtTime(
          0,
          audioCtx.currentTime,
          0.02
        );

    }


    if (audioRunning) {

      qzVal.textContent =
        "ARMED";

    }

  }
);


function resetMotion() {

  peakAcceleration =
    0;

  forwardEnergy =
    0;

  sidewaysEnergy =
    0;

  sampleCount =
    0;

  peakVal.textContent =
    "0.00";
}


/* =========================================================
   INITIAL CHECK
   ========================================================= */

window.addEventListener(
  "load",
  () => {

    if (
      typeof DeviceMotionEvent ===
      "undefined"
    ) {

      sensorVal.textContent =
        "unavailable";

    } else {

      sensorVal.textContent =
        "available";

    }

  }
);
