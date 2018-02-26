import { vec3, vec4 } from 'gl-matrix';
import MeshInstanced from '../../geometry/MeshInstanced';
import WeightedRNG from '../rng/WeightedRNG';
import RNG from '../rng/RNG';
import ShapeGrammar from './ShapeGrammar';

var Logger = require('debug');
var logTrace = Logger("mainApp:building:trace");
var logError = Logger("mainApp:building:error");

class WallConstraint {
  rng: any;
  availability: any;
}

class FloorConstraint {
  rng: any;
}

class Lot {
  maxX: any;
  maxY: any;

  constructor() {
    this.maxX = 15;
    this.maxY = 15;
  }
}

class Building {
  meshInstances: any;
  config: any;
  name: string;
  grammar: ShapeGrammar;

  lot: Lot;

  defaultWallConstraint: WallConstraint;
  defaultFloorConstraint: FloorConstraint;
  floorBasedWallConstraint: Array<WallConstraint>;

  constructor(config: any, meshInstances: any) {
    this.meshInstances = meshInstances;
    this.name = config.name;
    this.grammar = new ShapeGrammar();
    this.lot = new Lot();

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
    else if (config.type.toUpperCase() == "RNG") {
      returnValue = new RNG(seed, config.min, config.max);
    }
    else {
      // Twitch Emote Just FYI
      logError(`${this.name} Unsupported RNG Detected, BlessRNG _/\\_`);
    }

    return returnValue;
  }

  private loadWalls(config: any) {
    let isWallsArray = config.length != undefined ? true : false;

    if (isWallsArray) {
      this.floorBasedWallConstraint = new Array<WallConstraint>();

      for (var i = 0; i < config.length; ++i) {
        let wallConfig = config[i];

        let constraint = new WallConstraint();
        constraint.rng = this.getRNG(wallConfig.rng);
        constraint.availability = wallConfig.availability;

        if (wallConfig.default) {
          this.defaultWallConstraint = constraint;
          continue;
        }

        this.floorBasedWallConstraint.push(constraint);
      }
    } else {
      this.floorBasedWallConstraint = new Array<WallConstraint>();

      let constraint = new WallConstraint();
      constraint.rng = this.getRNG(config.rng);
      constraint.availability = config.availability;
      this.defaultWallConstraint = constraint;
    }
  }

  private loadFloors(config: any) {
    let constraint = new FloorConstraint();
    constraint.rng = this.getRNG(config.rng);
    this.defaultFloorConstraint = constraint;
  }

  loadConfig(config: any) {
    if (!config.walls) {
      logError(`${this.name} No Walls in Config Provided`);
    }

    if (!config.floor) {
      logError(`${this.name} No Floors in Config Provided`);
    }

    this.config = config;

    this.loadWalls(config.walls);
    this.loadFloors(config.floors);

    logTrace(`${this.name} Loaded Config Successfully`);
  }

  construct() {
    let mX = this.lot.maxX;
    let mY = this.lot.maxY;

    let floors = Math.round(this.defaultFloorConstraint.rng.roll());

    for (var i = 0; i < mX; ++i) {
      this.meshInstances.WallComponent1.addInstance(vec4.fromValues(i,0,0,1), vec4.fromValues(0,0,0,1), vec3.fromValues(1,1,1));
      this.meshInstances.WallComponent1.addInstance(vec4.fromValues(i,0,mY,1), vec4.fromValues(0,0,0,1), vec3.fromValues(1,1,1)); 
    }

    for (var i = 0; i < mY; ++i) {
      this.meshInstances.WallComponent1.addInstance(vec4.fromValues(0,0,i,1), vec4.fromValues(0, -0.707, 0, 0.707), vec3.fromValues(1,1,1));
      this.meshInstances.WallComponent1.addInstance(vec4.fromValues(mX,0,i,1), vec4.fromValues(0, -0.707, 0, 0.707), vec3.fromValues(1,1,1));
    }
  }
}

export default Building;