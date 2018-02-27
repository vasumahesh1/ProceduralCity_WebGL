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
  typeRng: any;
  heightRng: any;
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
    let p = vec3.fromValues(this.endX - this.startX, 0, this.endY - this.startY);

    this.sideNormal  = vec3.create();
    vec3.cross(this.sideNormal, pole, p);

    vec3.normalize(this.sideNormal, this.sideNormal);

    this.config = config;
  }

  scale(value: number) {
    this.startX = this.startX  * value;
    this.startY = this.startY * value;

    this.endX = this.endX * value;
    this.endY = this.endY * value;

    this.deltaX = this.endX - this.startX;
    this.deltaY = this.endY - this.startY;

    let pole = vec3.fromValues(0, 1, 0);
    let p = vec3.fromValues(this.endX - this.startX, 0, this.endY - this.startY);

    this.sideNormal  = vec3.create();
    vec3.cross(this.sideNormal, pole, p);

    vec3.normalize(this.sideNormal, this.sideNormal);
  }
}

class Lot {
  sides: Array<LotSide>;
  type: string;
  name: string;

  constructor() {
    this.sides = new Array<LotSide>();
    this.type = "FIXED";
    this.name = "Unknown Lot";
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

  load(config: any) {    
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
      this.sides.push(lotSide);
    }

    this.name = config.name;
    this.type = config.type;
  }
}

class BuildingComponent {
  instance: MeshInstanced;
  width: number;
}

class BuildingContext {
  wallComponent: any;
  windowComponent: any;
  floorCount: number;
  floorHeight: number;
  floorType: string;
  rootTranslation: vec4;
  overallTranslation: vec4;
}

class Building {
  components: any;
  config: any;
  name: string;
  grammar: ShapeGrammar;
  context : BuildingContext;

  defaultWallConstraint: WallConstraint;
  defaultFloorConstraint: FloorConstraint;
  floorBasedWallConstraint: Array<WallConstraint>;

  constructor(config: any, components: any) {
    this.components = components;
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
    constraint.typeRng = this.getRNG(config.type.rng);
    constraint.heightRng = this.getRNG(config.height.rng);
    this.defaultFloorConstraint = constraint;
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

  constructLot(lotGenerateConfig: any) {
    let lot = lotGenerateConfig.lot;
    let lotScale = lotGenerateConfig.localScale;

    let xAxis = vec3.fromValues(1, 0, 0);

    let floorCount = this.context.floorCount;
    let floorHeight = this.context.floorHeight;

    if (this.context.floorType == "RANDOM_ACROSS_LOTS") {
      floorCount = Math.round(this.defaultFloorConstraint.rng.roll());
      floorHeight = Math.round(this.defaultFloorConstraint.heightRng.roll());
    }

    for (var itr = 0; itr < lot.sides.length; ++itr) {
      let side = Object.create(lot.sides[itr]);
      side.scale(lotScale);

      let cmds = this.getBuildCommandsForSide(side, null, this.context.wallComponent);

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

      for (var floorIdx = 0; floorIdx < floorCount; ++floorIdx) {
        let floorY = floorHeight * floorIdx;
        let wallYScale = floorHeight / 3.0; // Todo: take from Component

        let translate = vec4.fromValues(side.startX, 0, side.startY, 1);
        vec4.add(translate, translate, this.context.overallTranslation);
        vec4.add(translate, translate, vec4.fromValues(0,floorY,0, 0));

        for (var cmdItr = 0; cmdItr < cmds.length; ++cmdItr) {
          let cmd = cmds[cmdItr];

          if (cmd.type == "wall") {
            let localScale = vec3.create();
            vec3.copy(localScale, scale);

            localScale[0] *= cmd.width;
            localScale[1] = wallYScale;

            logTrace('Comp Instance Values: ', translate, quat, localScale);
            this.context.wallComponent.instance.addInstance(translate, quat, localScale);
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
            localScale[1] = wallYScale;
            localScale[2] *= -1;

            let localTranslate = vec4.create();
            vec4.add(localTranslate, translate, sideNormalVec4);

            logTrace('Window Instance Values: ', translate, quat, localScale);
            this.context.windowComponent.instance.addInstance(translate, quat, localScale);

            let widthDirection = vec3.create();
            vec3.scale(widthDirection, direction, cmd.width)
            vec4.add(translate, translate, vec4.fromValues(widthDirection[0], widthDirection[1], widthDirection[2], 0));
          }
        }
      }
    }
  }

  construct(rootTranslation: vec4, shapeGrammar: any) {
    this.context = new BuildingContext();
    this.context.wallComponent = this.components.WallComponent1;
    this.context.windowComponent = this.components.WindowComponent1;
    this.context.rootTranslation = rootTranslation;

    this.context.floorCount = Math.round(this.defaultFloorConstraint.rng.roll());
    this.context.floorType = this.defaultFloorConstraint.typeRng.roll();
    this.context.floorHeight = Math.round(this.defaultFloorConstraint.heightRng.roll());

    let generatedLots = shapeGrammar.construct(3);

    for (var itr = 0; itr < generatedLots.length; ++itr) {
      let obj = generatedLots[itr];

      let scaledLocal = vec4.create();
      scaledLocal[0] = obj.localTranslation[0] * obj.localScale;
      scaledLocal[1] = obj.localTranslation[1] * obj.localScale;
      scaledLocal[2] = obj.localTranslation[2] * obj.localScale;
      scaledLocal[3] = 0;

      this.context.overallTranslation = vec4.create();
      vec4.add(this.context.overallTranslation, rootTranslation, scaledLocal);

      logTrace(`Overall Translation for Lot:`, this.context.overallTranslation);

      this.constructLot(obj);
    }
  }
}

export {Building, BuildingComponent, Lot};

export default Building;