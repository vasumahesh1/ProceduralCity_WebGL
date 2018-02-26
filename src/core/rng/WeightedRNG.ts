let Noise = require('noisejs').Noise;

class WeightedRNG {
  noiseGen: any;

  weights: { [symbol: string]: number; } = { };
  totalWeight: number;
  seed: number;
  rollItr: number;

  constructor(seed: number) {
    let noise = new Noise(seed);
    this.noiseGen = noise;
    this.seed = seed;
    this.rollItr = 13.0;
    this.totalWeight = 0.0;
  }

  add(key: string, value: number) {
    this.weights[key] = value;
    this.totalWeight += value;
  }

  roll(): string {
    let noise = this.noiseGen.simplex2(this.rollItr * 13, this.rollItr * 29);
    this.rollItr += 19;

    let range = noise * this.totalWeight;

    for(let key in this.weights) {
      let weight = this.weights[key];

      if (weight > range) {
        return key;
      }

      range -= weight;
    }

    return undefined;
  }
}

export default WeightedRNG;
