export class Sun {
  constructor(date, latitude, longitude) {
    this.date = date;
    this.latitude = latitude;
    this.longitude = longitude;

    this.julianDate = getJD(date);
  }

  get solarNoon() {
    return calcSolNoon(this.julianDate, this.longitude, this.date);
  }

  timeAtAngle(angle, rising) {
    return calcSunriseSet(rising, angle, this.julianDate, this.date, this.latitude, this.longitude);
  }
}

function formatDate(date, minutes) {
  const seconds = (minutes - Math.floor(minutes)) * 60;
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes, seconds));
}

function calcTimeJulianCent(jd) {
  const T = (jd - 2451545.0) / 36525.0;
  return T;
}

function radToDeg(angleRad) {
  return (180.0 * angleRad / Math.PI);
}

function degToRad(angleDeg) {
  return (Math.PI * angleDeg / 180.0);
}

function calcGeomMeanLongSun(t) {
  let L0 = 280.46646 + t * (36000.76983 + t * (0.0003032));
  while (L0 > 360.0) {
    L0 -= 360.0;
  }
  while (L0 < 0.0) {
    L0 += 360.0;
  }
  return L0; // in degrees
}

function calcGeomMeanAnomalySun(t) {
  const M = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  return M; // in degrees
}

function calcEccentricityEarthOrbit(t) {
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  return e; // unitless
}

function calcSunEqOfCenter(t) {
  const m = calcGeomMeanAnomalySun(t);
  const mrad = degToRad(m);
  const sinm = Math.sin(mrad);
  const sin2m = Math.sin(mrad + mrad);
  const sin3m = Math.sin(mrad + mrad + mrad);
  const C = sinm * (1.914602 - t * (0.004817 + 0.000014 * t)) + sin2m * (0.019993 - 0.000101 * t) + sin3m * 0.000289;
  return C; // in degrees
}

function calcSunTrueLong(t) {
  const l0 = calcGeomMeanLongSun(t);
  const c = calcSunEqOfCenter(t);
  const O = l0 + c;
  return O; // in degrees
}

function calcSunApparentLong(t) {
  const o = calcSunTrueLong(t);
  const omega = 125.04 - 1934.136 * t;
  const lambda = o - 0.00569 - 0.00478 * Math.sin(degToRad(omega));
  return lambda; // in degrees
}

function calcMeanObliquityOfEcliptic(t) {
  const seconds = 21.448 - t * (46.8150 + t * (0.00059 - t * (0.001813)));
  const e0 = 23.0 + (26.0 + (seconds / 60.0)) / 60.0;
  return e0; // in degrees
}

function calcObliquityCorrection(t) {
  const e0 = calcMeanObliquityOfEcliptic(t);
  const omega = 125.04 - 1934.136 * t;
  const e = e0 + 0.00256 * Math.cos(degToRad(omega));
  return e; // in degrees
}

function calcSunDeclination(t) {
  const e = calcObliquityCorrection(t);
  const lambda = calcSunApparentLong(t);

  const sint = Math.sin(degToRad(e)) * Math.sin(degToRad(lambda));
  const theta = radToDeg(Math.asin(sint));
  return theta; // in degrees
}

function calcEquationOfTime(t) {
  const epsilon = calcObliquityCorrection(t);
  const l0 = calcGeomMeanLongSun(t);
  const e = calcEccentricityEarthOrbit(t);
  const m = calcGeomMeanAnomalySun(t);

  let y = Math.tan(degToRad(epsilon) / 2.0);
  y *= y;

  const sin2l0 = Math.sin(2.0 * degToRad(l0));
  const sinm = Math.sin(degToRad(m));
  const cos2l0 = Math.cos(2.0 * degToRad(l0));
  const sin4l0 = Math.sin(4.0 * degToRad(l0));
  const sin2m = Math.sin(2.0 * degToRad(m));

  const Etime = y * sin2l0 - 2.0 * e * sinm + 4.0 * e * y * sinm * cos2l0 - 0.5 * y * y * sin4l0 - 1.25 * e * e * sin2m;
  return radToDeg(Etime) * 4.0; // in minutes of time
}

function calcHourAngle(angle, lat, solarDec) {
  const latRad = degToRad(lat);
  const sdRad = degToRad(solarDec);
  const HAarg = (Math.cos(degToRad(90 + angle)) / (Math.cos(latRad) * Math.cos(sdRad)) - Math.tan(latRad) * Math.tan(sdRad));
  const HA = Math.acos(HAarg);
  return HA; // in radians (for sunset, use -HA)
}

function isNumber(inputVal) {
  let oneDecimal = false;
  const inputStr = `${inputVal}`;
  for (let i = 0; i < inputStr.length; i++) {
    const oneChar = inputStr.charAt(i);
    if (i === 0 && (oneChar === '-' || oneChar === '+')) {
      continue;
    }
    if (oneChar === '.' && !oneDecimal) {
      oneDecimal = true;
      continue;
    }
    if (oneChar < '0' || oneChar > '9') {
      return false;
    }
  }
  return true;
}

function getJD(date) {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  const day = date.getDate();
  if (month < 3) {
    year--;
    month += 12;
  }

  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  const JD = Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
  return JD;
}

function calcSolNoon(jd, longitude, date) {
  const tnoon = calcTimeJulianCent(jd - longitude / 360.0);
  let eqTime = calcEquationOfTime(tnoon);
  const solNoonOffset = 720.0 - (longitude * 4) - eqTime; // in minutes
  const newt = calcTimeJulianCent(jd + solNoonOffset / 1440.0);
  eqTime = calcEquationOfTime(newt);
  let solNoonLocal = 720 - (longitude * 4) - eqTime; // in minutes
  while (solNoonLocal < 0.0) {
    solNoonLocal += 1440.0;
  }
  while (solNoonLocal >= 1440.0) {
    solNoonLocal -= 1440.0;
  }
  return formatDate(date, solNoonLocal);
  // return timeString(solNoonLocal, 3);
}

function calcSunriseSetUTC(rise, angle, JD, latitude, longitude) {
  const t = calcTimeJulianCent(JD);
  const eqTime = calcEquationOfTime(t);
  const solarDec = calcSunDeclination(t);
  let hourAngle = calcHourAngle(angle, latitude, solarDec);
  //alert("HA = " + radToDeg(hourAngle));
  if (!rise) hourAngle = -hourAngle;
  const delta = longitude + radToDeg(hourAngle);
  const timeUTC = 720 - (4.0 * delta) - eqTime; // in minutes
  return timeUTC;
}

function calcSunriseSet(rise, angle, JD, date, latitude, longitude)
  // rise = 1 for sunrise, 0 for sunset
  {
    const timeUTC = calcSunriseSetUTC(rise, angle, JD, latitude, longitude);
    const newTimeUTC = calcSunriseSetUTC(rise, angle, JD + timeUTC / 1440.0, latitude, longitude);
    if (isNumber(newTimeUTC)) {

      return formatDate(date, newTimeUTC);

    } else { // no sunrise/set found
      return new Date(NaN);
    }
  }
