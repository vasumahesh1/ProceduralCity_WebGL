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
  width: number;
}

class LotConfig {
  type: string;
  mode: string;
  input: string;
  separator: string;
  rng: any;

  roll() {
    let finalStr = "";

    if (this.type == "pattern" && this.mode == "repeat") {
      let repeatCount = Math.round(this.rng.roll());

      finalStr = this.separator;

      for (var i = 0; i < repeatCount; ++i) {
        finalStr = finalStr + this.input + this.separator;
      }
    }

    return finalStr;
  }
}

class LotSide {
  startX: number;
  startY: number;

  endX: number;
  endY: number;

  deltaX: number;
  deltaY: number;

  config: LotConfig;

  sideNormal: vec3;

  constructor(start: any, end: any, config: LotConfig) {
    this.startX = start[0];
    this.startY = start[1];

    this.endX = end[0];
    this.endY = end[1];

    this.deltaX = this.endX - this.startX;
    this.deltaY = this.endY - this.startY;

    let pole = vec3.fromValues(0, 1, 0);
    let p = vec3.fromValues(end[0] - start[0], 0, end[1] - start[1]);

    this.sideNormal  = vec3.create();
    vec3.cross(this.sideNormal, pole, p);

    vec3.normalize(this.sideNormal, this.sideNormal);

    this.config = config;
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
    
    let defaultConfig = new LotConfig();
    defaultConfig.type = "pattern";
    defaultConfig.mode = "repeat";
    defaultConfig.input = "W";
    defaultConfig.separator = "*";
    defaultConfig.rng = this.getRNG({
      seed: 213,
      type: 'RNG',
      min: 3,
      max: 5
    });

    for (var itr = 0; itr < config.sides.length; ++itr) {
      let side = config.sides[itr];

      let lotSide = new LotSide(side.start, side.end, side.config || defaultConfig);
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

    let config = lotSide.config;
    let buildString = config.roll();

    logTrace(`Build String: ${buildString}`);

    for (var itr = 0; itr < buildString.length; itr += 1) {
      let obj = buildString[itr];

      let width = 1;

      if (obj == '*') {
        info.strechable++;
      } else if (obj == 'W') {
        width = wall.width;
      }
      
      info.required += width;
    }

    let starLength = Math.floor((length - info.required) / info.strechable);

    let commands = Array<BuildCommand>();

    let cmd = new BuildCommand();
    cmd.type = 'wall';
    cmd.width = length;

    commands.push(cmd);

    for (var itr = 0; itr < buildString.length; itr += 1) {
      let obj = buildString[itr];

      let width = 1;
      let type: string;

      if (obj == '*') {
        width = starLength;
        type = "translate";
      } else if (obj == 'W') {
        width = 1; // window.width;
        type = 'window';
      }

      let cmd = new BuildCommand();
      cmd.type = type;
      cmd.width = width;

      length -= width;

      commands.push(cmd);
    }

    if (length > 0) {
      logTrace(`Overflow on LotSide detected with Value: ${length}`);
      let distrib = length / 2.0;

      commands[commands.length - 1].width += distrib;
      commands[1].width += distrib;
    }

    logTrace(`Final Commands: `, commands);

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

      let sideNormalVec4 = vec4.fromValues(side.sideNormal[0], side.sideNormal[1], side.sideNormal[2], 0);

      logTrace(`Side Normal: ${side.sideNormal[0]}, ${side.sideNormal[1]}, ${side.sideNormal[2]}`);

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
        let cmd = cmds[cmdItr];

        if (cmd.type == "wall") {
          let localScale = vec3.create();
          vec3.copy(localScale, scale);

          localScale[0] *= cmd.width;

          logTrace('Comp Instance Values: ', translate, quat, localScale);
          selectedWallComp.instance.addInstance(translate, quat, localScale);
        }
        else if (cmd.type == "translate") {
          let widthDirection = vec3.create();
          vec3.scale(widthDirection, direction, cmd.width)
          vec4.add(translate, translate, vec4.fromValues(widthDirection[0], widthDirection[1], widthDirection[2], 0));

          logTrace(`New Translation: ${translate[0]}, ${translate[1]}, ${translate[2]}`);
        }
        else if (cmd.type == "window") {
          let localScale = vec3.create();
          vec3.copy(localScale, scale);

          localScale[0] *= cmd.width;

          let localTranslate = vec4.create();
          vec4.add(localTranslate, translate, sideNormalVec4);

          logTrace('Window Instance Values: ', localTranslate, quat, localScale);
          selectedWallComp.instance.addInstance(localTranslate, quat, localScale);

          let widthDirection = vec3.create();
          vec3.scale(widthDirection, direction, cmd.width)
          vec4.add(translate, translate, vec4.fromValues(widthDirection[0], widthDirection[1], widthDirection[2], 0));
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