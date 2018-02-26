import { vec3, vec4, mat4 } from 'gl-matrix';
import MeshInstanced from '../../geometry/MeshInstanced';
import WeightedRNG from '../rng/WeightedRNG';
import RNG from '../rng/RNG';
import ShapeGrammar from './ShapeGrammar';

var Logger = require('debug');
var logTrace = Logger("mainApp:building:trace");
var logError = Logger("mainApp:building:error");

function axisAngleToQuaternion(axis: vec3, angle: number) {
  let quat = vec4.create();
  let cos = Math.cos(angle / 2.0);
  let sin = Math.sin(angle / 2.0);

  let scaledAxis = vec3.create();
  vec3.scale(scaledAxis, axis, sin);

  quat[0] = scaledAxis[0];
  quat[1] = scaledAxis[1];
  quat[2] = scaledAxis[2];
  quat[3] = cos;

  logTrace(`Converting Axis Angle (${axis[0]}, ${axis[1]}, ${axis[2]}), ${angle} to Quat(${quat[0]}, ${quat[1]}, ${quat[2]}, ${quat[3]})`);

  return quat;
}

class WallConstraint {
  rng: any;
  availability: any;
}

class FloorConstraint {
  rng: any;
}

class BuildCommand {
  type: string;
  length: number;
}

class LotSide {
  startX: number;
  startY: number;

  endX: number;
  endY: number;

  deltaX: number;
  deltaY: number;

  configuration: string;

  constructor(start: any, end: any, config: string) {
    this.startX = start[0];
    this.startY = start[1];

    this.endX = end[0];
    this.endY = end[1];

    this.deltaX = this.endX - this.startX;
    this.deltaY = this.endY - this.startY;

    this.configuration = config;
  }
}

class Lot {
  sides: Array<LotSide>;

  constructor() {
    this.sides = new Array<LotSide>();
  }
}

class BuildingComponent {
  instance: MeshInstanced;
  width: number;
}

class Building {
  components: any;
  config: any;
  name: string;
  grammar: ShapeGrammar;

  lot: Lot;

  defaultWallConstraint: WallConstraint;
  defaultFloorConstraint: FloorConstraint;
  floorBasedWallConstraint: Array<WallConstraint>;

  constructor(config: any, components: any) {
    this.components = components;
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

  private loadLot(config: any) {
    let lot = new Lot();
    
    for (var itr = 0; itr < config.sides.length; ++itr) {
      let side = config.sides[itr];
      let lotSide = new LotSide(side.start, side.end, side.configuration || "W*");
      lot.sides.push(lotSide);
    }

    this.lot = lot;
  }

  loadConfig(config: any) {
    if (!config.walls) {
      logError(`${this.name} No Walls in Config Provided`);
    }

    if (!config.floor) {
      logError(`${this.name} No Floors in Config Provided`);
    }

    if (!config.lot) {
      logError(`${this.name} No Lot in Config Provided`);
    }

    this.config = config;

    this.loadWalls(config.walls);
    this.loadFloors(config.floors);
    this.loadLot(config.lot);

    logTrace(`${this.name} Loaded Config Successfully`);
  }

  getBuildCommandsForSide(lotSide: LotSide, window: BuildingComponent, wall: BuildingComponent) {
    let length = (lotSide.endX - lotSide.startX) * (lotSide.endX - lotSide.startX) + (lotSide.endY - lotSide.startY) * (lotSide.endY - lotSide.startY);
    length = Math.sqrt(length);

    let info:any = {};
    info.strechable = 0;
    info.required = 0;

    let configuration = lotSide.configuration;

    for (var itr = 0; itr < configuration.length; itr += 2) {
      let obj = configuration[itr];
      let count = configuration[itr + 1];

      let width = 1;

      if (obj == 'E') {
        width = window.width;
      } else if (obj == 'W') {
        width = wall.width;
      }

      if (count == "*") {
        info.strechable++;
      }
      else {
        info.required += Number.parseInt(count) * width;
      }
    }

    let starLength = Math.floor((length - info.required) / info.strechable);

    let commands = Array<BuildCommand>();

    for (var itr = 0; itr < configuration.length; itr += 2) {
      let obj = configuration[itr];
      let count = configuration[itr + 1];

      let width = 1;
      let type: string;

      if (obj == 'E') {
        width = window.width;
        type = 'window';
      } else if (obj == 'W') {
        width = wall.width;
        type = 'wall';
      }

      if (count == "*") {
        width = starLength;
      }

      let cmd = new BuildCommand();
      cmd.type = type;
      cmd.length = width;

      length -= width;

      commands.push(cmd);
    }

    if (length > 0) {
      logTrace(`Overflow on LotSide detected with Value: ${length}`);
      commands[commands.length - 1].length += length;
    }

    return commands;
  }

  construct() {

    let floors = Math.round(this.defaultFloorConstraint.rng.roll());

    let selectedWallComp = this.components.WallComponent1;

    let windows:any = [];

    // Pre Build Per Side Configuration
    for (var itr = 0; itr < this.lot.sides.length; ++itr) {

    }

    let xAxis = vec3.fromValues(1, 0, 0);

    for (var itr = 0; itr < this.lot.sides.length; ++itr) {
      let side = this.lot.sides[itr];

      let itrX = side.startX;
      let itrY = side.startY;

      let cmds = this.getBuildCommandsForSide(side, null, selectedWallComp);

      logTrace('Got Build Commands for Side: ', cmds);

      let direction = vec3.fromValues(side.deltaX, 0, side.deltaY);
      vec3.normalize(direction, direction);

      let directionVec4 = vec4.fromValues(direction[0], direction[1], direction[2], 0);

      logTrace('Lot Side Direction: ', direction);
      
      let angle = Math.acos(vec3.dot(xAxis, direction));

      let axis = vec3.create();
      vec3.cross(axis, xAxis, direction);
      vec3.normalize(axis, axis);

      let scale = vec3.fromValues(1, 1, 1);
      let translate = vec4.fromValues(side.startX, 0, side.startY, 1);
      let quat = axisAngleToQuaternion(axis, angle);

      let rotationModel = mat4.create();
      mat4.fromRotation(rotationModel, angle, axis);

      let worldX = vec4.create();
      vec4.transformMat4(worldX, vec4.fromValues(1, 0, 0, 0), rotationModel);
      let worldXVec3 = vec3.fromValues(worldX[0], worldX[1], worldX[2]);
      vec3.normalize(worldXVec3, worldXVec3);

      if(vec3.length(axis) <= 0.00001) {
        quat = vec4.fromValues(0, 0, 0, 1);
      }

      if (vec3.dot(direction, worldXVec3) < 0) {
        scale[0] = -scale[0];
      }

      if (angle > Math.PI / 2.0) {
        scale[2] = -scale[2];
      }

      for (var cmdItr = 0; cmdItr < cmds.length; ++cmdItr) {
        let cmd = cmds[0];

        for (var cLenItr = 0; cLenItr < cmd.length; ++cLenItr) {

          let localScale = vec3.create();
          vec3.copy(localScale, scale);

          if (cLenItr + 1 > cmd.length) {
            localScale[0] = cmd.length - cLenItr;
          }

          logTrace('Comp Instance Values: ', translate, quat, localScale);
          selectedWallComp.instance.addInstance(translate, quat, localScale);

          // let widthDirection = vec3.create();
          // vec3.scale(widthDirection, direction, cmd.length)
          vec4.add(translate, translate, directionVec4);
        }
      }
    }

    // for (var i = 0; i < mX; ++i) {
    //   this.components.WallComponent1.instance.addInstance(vec4.fromValues(i,0,0,1), vec4.fromValues(0,0,0,1), vec3.fromValues(1,1,1));
    //   this.components.WallComponent1.instance.addInstance(vec4.fromValues(i,0,mY,1), vec4.fromValues(0,0,0,1), vec3.fromValues(1,1,1)); 
    // }

    // for (var i = 0; i < mY; ++i) {
    //   this.components.WallComponent1.instance.addInstance(vec4.fromValues(0,0,i,1), vec4.fromValues(0, -0.707, 0, 0.707), vec3.fromValues(1,1,1));
    //   this.components.WallComponent1.instance.addInstance(vec4.fromValues(mX,0,i,1), vec4.fromValues(0, -0.707, 0, 0.707), vec3.fromValues(1,1,1));
    // }
  }
}

export {Building, BuildingComponent};

export default Building;