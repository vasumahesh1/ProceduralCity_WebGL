import MeshInstanced from '../../geometry/MeshInstanced';
import WeightedRNG from '../rng/WeightedRNG';
import ShapeGrammar from './ShapeGrammar';

var Logger = require('debug');
var logTrace = Logger("mainApp:building:trace");
var logError = Logger("mainApp:building:error");

class Building {
  meshInstances: any;
  config: any;
  name: string;
  grammar: ShapeGrammar;

  wallsRNG: any;
  floorsRNG: any;

  constructor(config: any, meshInstances: any) {
    this.meshInstances = meshInstances;
    this.config = config;
    this.name = config.name;
    this.grammar = new ShapeGrammar();
    this.loadConfig(config);
  }

  private getRNG(config: any) {
    let returnValue;
    let seed = config.seed ? config.seed : 1723;

    logTrace('Getting RNG for Config', config);

    if (config.type.toUpperCase() == "WEIGHTEDRNG") {
      returnValue = new WeightedRNG(seed);

      for (var key in config.val) {
        returnValue.add(key, config.val[key]);
      }
    }
    else {
      logError('${this.name} Unsupported RNG Detected, BlessRNG _/\\_');
    }

    return returnValue;
  }

  loadConfig(config: any) {
    if (!config.walls) {
      logError(`${this.name} No Walls in Config Provided`);
    }

    if (!config.floor) {
      logError(`${this.name} No Floors in Config Provided`);
    }

    this.wallsRNG = this.getRNG(this.config.walls);

    logTrace(`${this.name} Loaded Config Successfully`);
  }

  construct() {

  }
}

export default Building;