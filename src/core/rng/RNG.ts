let Noise = require('noisejs').Noise;

var Logger = require('debug');
var logTrace = Logger("mainApp:rng:trace");

class RNG {
  noiseGen: any;
  min: number;
  max: number;
  seed: number;
  rollItr: number;

  constructor(seed: number, min: number, max: number) {
    let noise = new Noise(seed);
    this.noiseGen = noise;
    this.seed = seed;
    this.min = min;
    this.max = max;
    this.rollItr = 232;
  }

  roll(): number {
    let noise = this.noiseGen.simplex2(this.rollItr * 13, this.rollItr * 29);
    this.rollItr += 19;

    noise = (noise + 1.0) / 2.0;

    let val = (noise * (this.max - this.min)) + this.min;

    logTrace('RNG Rolled', val);

    return val;
  }
}

export default RNG;
