/*
  Quiet Zone TNC
  Directional Targeting Prototype

  PURPOSE:
  Detect a deliberate phone push toward an unwanted
  sound source.

  USER ACTION:
  1. Point top edge / arrow toward noise.
  2. Touch and hold arrow.
  3. Push phone toward noise.
  4. QZ detects sufficient forward motion.
  5. Phone vibrates: GOT IT.

  This version proves the targeting gesture.
  It does NOT yet perform TNC.
*/


/* =========================================================
   PAGE ELEMENTS
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

const motionVal =
  document.getElementById("motionVal");

const directionVal =
  document.getElementById("directionVal");

const confidenceVal =
  document.getElementById("confidenceVal");

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

const zVal =
  document.getElementById("zVal");

const peakVal =
  document.getElementById("peakVal");

const gestureVal =
  document.getElementById("gestureVal");

const sensorVal =
  document.getElementById("sensorVal");


/* =========================================================
   STATE
   ========================================================= */

let sensorActive = false;

let gestureActive = false;

let acquired = false;

let gestureStart = 0;

let peakAcceleration = 0;

let forwardEnergy = 0;

let sidewaysEnergy = 0;

let sampleCount = 0;


/*
  Phone coordinates when screen is facing upward:

  X = left / right
  Y = top / bottom
  Z = through screen

  A deliberate push toward the TOP edge of the phone
  should primarily appear on the Y axis.

  Different browsers / devices can reverse sign,
  so Prototype One initially measures axis dominance
  rather than trusting one fixed sign.
*/


/* =========================================================
   TUNING
   ========================================================= */

/*
  Minimum useful horizontal acceleration.

  This will almost certainly need tuning on Gary's
  actual phone after the first physical test.
*/

const MIN_ACCELERATION = 0.35;


/*
  Number of meaningful motion samples required before
  QZ is willing to say GOT IT.
*/

const MIN_SAMPLES = 4;


/*
  Forward-axis motion must dominate sideways motion.

  1.5 means Y energy needs to be about 50% stronger
  than X energy.
*/

const DIRECTION_RATIO = 1.5;


/* =========================================================
   INFO
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
   DIAGNOSTICS
   ========================================================= */

diagnosticsBtn.addEventListener("click", () => {

  diagnostics.classList.toggle("open");

});


/* =========================================================
   SENSOR PERMISSION
   ========================================================= */

async function enableMotionSensors() {

  if (sensorActive) {
    return true;
  }


  /*
    iOS requires motion permission to be requested
    from a direct user gesture.

    Android usually does not require this step.
  */

  try {

    if (
      typeof DeviceMotionEvent !== "undefined" &&
      typeof DeviceMotionEvent.requestPermission === "function"
    ) {

      const permission =
        await DeviceMotionEvent.requestPermission();

      if (permission !== "granted") {

        sensorVal.textContent = "denied";

        arrowStatus.textContent =
          "Motion permission denied";

        return false;
      }
    }


    if (
      typeof DeviceMotionEvent === "undefined"
    ) {

      sensorVal.textContent = "unavailable";

      arrowStatus.textContent =
        "Motion sensor unavailable";

      return false;
    }


    window.addEventListener(
      "devicemotion",
      handleMotion,
      { passive: true }
    );

    sensorActive = true;

    sensorVal.textContent = "ready";

    return true;

  } catch (error) {

    console.error(
      "QZ motion sensor error:",
      error
    );

    sensorVal.textContent = "error";

    arrowStatus.textContent =
      "Motion sensor error";

    return false;
  }

}


/* =========================================================
   START TARGETING GESTURE
   ========================================================= */

async function startGesture(event) {

  event.preventDefault();

  const ready =
    await enableMotionSensors();

  if (!ready) {
    return;
  }


  resetGestureData();

  gestureActive = true;

  acquired = false;

  gestureStart =
    performance.now();

  arrowBtn.classList.add("armed");

  arrowBtn.classList.remove("acquired");

  motionVal.textContent = "MOVE";

  directionVal.textContent = "↑";

  confidenceVal.textContent = "0%";

  arrowStatus.textContent =
    "Push phone toward noise";

}


/* =========================================================
   END TARGETING GESTURE
   ========================================================= */

function endGesture(event) {

  if (event) {
    event.preventDefault();
  }

  if (!gestureActive) {
    return;
  }

  gestureActive = false;

  arrowBtn.classList.remove("armed");


  if (!acquired) {

    motionVal.textContent = "TRY";

    arrowStatus.textContent =
      "Not enough direction — try again";

  }

}


/* =========================================================
   POINTER EVENTS
   ========================================================= */

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

arrowBtn.addEventListener(
  "pointerleave",
  (event) => {

    if (
      event.buttons === 0
    ) {

      endGesture(event);

    }

  }
);


/* =========================================================
   MOTION DATA
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

  const z =
    Number(acceleration.z) || 0;


  /* LIVE DIAGNOSTICS */

  xVal.textContent =
    x.toFixed(2);

  yVal.textContent =
    y.toFixed(2);

  zVal.textContent =
    z.toFixed(2);


  if (!gestureActive || acquired) {
    return;
  }


  const elapsed =
    performance.now() -
    gestureStart;

  gestureVal.textContent =
    Math.round(elapsed) + " ms";


  const absX =
    Math.abs(x);

  const absY =
    Math.abs(y);


  /*
    Ignore tiny movements and sensor noise.
  */

  const horizontalMagnitude =
    Math.sqrt(
      (x * x) +
      (y * y)
    );


  if (
    horizontalMagnitude <
    MIN_ACCELERATION
  ) {

    return;
  }


  sampleCount++;


  /*
    We currently treat the phone's Y axis as the
    forward/back axis because the arrow points toward
    the physical top edge of the phone.
  */

  forwardEnergy += absY;

  sidewaysEnergy += absX;


  if (
    horizontalMagnitude >
    peakAcceleration
  ) {

    peakAcceleration =
      horizontalMagnitude;

    peakVal.textContent =
      peakAcceleration.toFixed(2);

  }


  evaluateDirection();

}


/* =========================================================
   DIRECTION CONFIDENCE
   ========================================================= */

function evaluateDirection() {

  if (sampleCount === 0) {
    return;
  }


  const totalEnergy =
    forwardEnergy +
    sidewaysEnergy;


  if (totalEnergy <= 0) {
    return;
  }


  /*
    Confidence represents how strongly the gesture
    favors the phone's forward/back axis instead of
    left/right motion.
  */

  const axisConfidence =
    forwardEnergy /
    totalEnergy;


  const confidence =
    Math.round(
      axisConfidence * 100
    );


  confidenceVal.textContent =
    confidence + "%";


  const directional =
    forwardEnergy >
    sidewaysEnergy *
    DIRECTION_RATIO;


  if (
    directional &&
    sampleCount >= MIN_SAMPLES
  ) {

    acquireDirection();

  }

}


/* =========================================================
   TARGET ACQUIRED
   ========================================================= */

function acquireDirection() {

  if (acquired) {
    return;
  }


  acquired = true;

  gestureActive = false;


  arrowBtn.classList.remove("armed");

  arrowBtn.classList.add("acquired");


  motionVal.textContent =
    "LOCK";

  directionVal.textContent =
    "↑";

  confidenceVal.textContent =
    "100%";

  arrowStatus.textContent =
    "GOT IT";


  /*
    HAPTIC CONFIRMATION

    Android browsers generally support navigator.vibrate.
    Devices/browsers without vibration simply ignore it.
  */

  if ("vibrate" in navigator) {

    navigator.vibrate(
      [80, 50, 140]
    );

  }


  console.log(
    "QZ TARGET ACQUIRED",
    {
      timestamp:
        new Date().toISOString(),

      forwardEnergy,
      sidewaysEnergy,
      sampleCount,
      peakAcceleration,

      gestureMilliseconds:
        Math.round(
          performance.now() -
          gestureStart
        )
    }
  );

}


/* =========================================================
   RESET / TARE
   ========================================================= */

tareBtn.addEventListener("click", () => {

  resetGestureData();

  gestureActive = false;

  acquired = false;


  arrowBtn.classList.remove(
    "armed",
    "acquired"
  );


  motionVal.textContent =
    "WAIT";

  directionVal.textContent =
    "—";

  confidenceVal.textContent =
    "0%";

  arrowStatus.textContent =
    "Touch arrow to begin";


  gestureVal.textContent =
    "0 ms";

  peakVal.textContent =
    "0.00";

});


function resetGestureData() {

  peakAcceleration = 0;

  forwardEnergy = 0;

  sidewaysEnergy = 0;

  sampleCount = 0;

}


/* =========================================================
   INITIAL SENSOR CHECK
   ========================================================= */

window.addEventListener("load", () => {

  if (
    typeof DeviceMotionEvent === "undefined"
  ) {

    sensorVal.textContent =
      "unavailable";

  } else {

    sensorVal.textContent =
      "available";

  }

});
