import { vec3, vec4, mat4 } from 'gl-matrix';
import MeshInstanced from '../../geometry/MeshInstanced';
import WeightedRNG from '../rng/WeightedRNG';
import RNG from '../rng/RNG';
import ShapeGrammar from './ShapeGrammar';

var Logger = require('debug');
var logTrace = Logger("mainApp:building:trace");
var logError = Logger("mainApp:building:error");

const ROOT_TWO = 1.414213562;

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

class WindowConstraint {
  rng: any;
}

class FloorConstraint {
  rng: any;
  typeRng: any;
  heightRng: any;
  separatorRng: any;
  placementRng: any;
}

class RoofConstraint {
  rng: any;
}

class SepConstraint {
  objRng: any;
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

    // let radiusVec = vec3.fromValues(this.startX, 0, this.startY);
    // if (vec3.dot(this.sideNormal, radiusVec) < 0) {
    //   this.sideNormal[0] *= -1;
    //   this.sideNormal[2] *= -1;
    // }

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

  load(config: any, dynamicConstructors: any) {    
    let defaultConfig = new LotConfig();
    defaultConfig.type = "pattern";
    defaultConfig.mode = "repeat";
    defaultConfig.input = "W";
    defaultConfig.separator = "*";
    defaultConfig.rng = this.getRNG({
      seed: 213,
      type: 'RNG',
      min: 1,
      max: 4
    });

    if (config.type == "DYNAMIC") {
      config.sides = dynamicConstructors[config.controller].getSides(config.options);
    }

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
  roofComponent: any;
  sepComponent: any;
  floorCount: number;
  floorHeight: number;
  placeSeparator: boolean;
  floorType: string;
  floorSeparator: string;
  floorSeparatorPlacement: string;
  rootTranslation: vec4;
  overallTranslation: vec4;
}

class Property {
  center: vec3;
  centerVec4: vec4;
  sideLength: number;
  radius: number;

  constructor (sideLength: number) {
    this.sideLength = sideLength;
    this.radius = (sideLength * 0.5 * ROOT_TWO);
    this.center = vec3.create();
  }

  checkOverlap(property: Property) {
    let dist = vec3.create();
    vec3.subtract(dist, this.center, property.center);
    let distVal = vec3.length(dist);
    let distSq = distVal * distVal;
    let radiusVal = this.radius + property.radius;
    let radiusSq = radiusVal * radiusVal;

    return distSq < radiusSq;
  }

  setCenter(value: vec3) {
    this.center = value;
    this.centerVec4 = vec4.fromValues(value[0], value[1], value[2], 1);
  }

  getEdgeVertex() {
    let edgeVertex = vec4.create();
    let diff = this.sideLength / 2.0;

    let diffVector = vec4.fromValues(diff, 0, diff, 0);
    let result = vec4.create();
    vec4.subtract(result, this.centerVec4, diffVector);
    return result;
  }
}

class GenerationConstraint {
  population: any;
  landValue: any;

  constructor () {
    this.population = {};
    this.landValue = {};
  }

  setPopulation(min: number, max: number) {
    this.population = {
      min: min,
      max: max
    };
  }

  setLandValue(min: number, max: number) {
    this.landValue = {
      min: min,
      max: max
    };
  }

  isValid(data: any) {
    if (data.population < this.population.min || data.population > this.population.max) {
      return false;
    }

    if (data.landValue < this.population.min || data.landValue > this.population.max) {
      return false;
    }

    return true;
  }
}

class Building {
  components: any;
  config: any;
  roofMesh: any;
  name: string;
  grammar: ShapeGrammar;
  context : BuildingContext;

  iterationRng: any;
  defaultWallConstraint: WallConstraint;
  defaultWindowConstraint: WindowConstraint;
  defaultFloorConstraint: FloorConstraint;
  defaultRoofConstraint: RoofConstraint;
  defaultSepConstraint: SepConstraint;
  floorBasedWallConstraint: Array<WallConstraint>;

  constructor(config: any, components: any, roofMesh: any) {
    this.components = components;
    this.name = config.name;
    this.roofMesh = roofMesh;
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
    constraint.separatorRng = this.getRNG(config.separator.rng);
    constraint.placementRng = this.getRNG(config.separator.placement.rng);
    this.defaultFloorConstraint = constraint;
  }

  private loadRoofs(config: any) {
    let constraint = new RoofConstraint();
    constraint.rng = this.getRNG(config.rng);
    this.defaultRoofConstraint = constraint;
  }

  private loadSep(config: any) {
    let constraint = new SepConstraint();
    constraint.objRng = this.getRNG(config.obj.rng);
    this.defaultSepConstraint = constraint;
  }

  private loadWindows(config: any) {
    let constraint = new WindowConstraint();
    constraint.rng = this.getRNG(config.rng);
    this.defaultWindowConstraint = constraint;
  }

  loadConfig(config: any) {
    if (!config.walls) {
      logError(`${this.name} No Walls in Config Provided`);
    }

    if (!config.floor) {
      logError(`${this.name} No Floors in Config Provided`);
    }

    if (!config.windows) {
      logError(`${this.name} No Windows in Config Provided`);
    }

    this.config = config;

    this.loadWalls(config.walls);
    this.loadFloors(config.floors);
    this.loadRoofs(config.roofs);
    this.loadSep(config.floors.separator);
    this.loadWindows(config.windows);



    this.iterationRng = this.getRNG(config.iteration.rng);

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

    let calcLength = length;

    logTrace('Updating BuildString', buildString);

    for (var itr = 0; itr < buildString.length; itr += 1) {
      let obj = buildString[itr];

      if (obj == '*') {
        calcLength--;
      } else if (obj == 'W') {
        calcLength -= window.width;
      }

      if (calcLength <= 0) {
        buildString = buildString.substr(0, itr);
        logTrace('Updated BuildString', buildString);
        break;
      }
    }

    for (var itr = 0; itr < buildString.length; itr += 1) {
      let obj = buildString[itr];

      let width = 1;

      if (obj == '*') {
        info.strechable++;
      } else if (obj == 'W') {
        width = window.width;
        info.required += width;
      }
    }

    let starLength = (length - info.required) / info.strechable;

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
      if (length > 1) {
        commands[1].width += distrib;
      }
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

    let roofComponent = this.context.roofComponent;

    let dynamicSides = [];

    if (this.context.floorType == "RANDOM_ACROSS_LOTS") {
      floorCount = Math.round(this.defaultFloorConstraint.rng.roll());
      floorHeight = Math.round(this.defaultFloorConstraint.heightRng.roll());
    }

    if (lotGenerateConfig.forceHeight) {
      floorCount = this.context.floorCount;
      floorHeight = this.context.floorHeight;
    }

    if (this.context.floorSeparator == "RANDOM_ACROSS_LOTS") {
      this.context.placeSeparator = this.defaultFloorConstraint.placementRng.roll() == "CAN_PLACE";
    }

    let localLotTranslation = lotGenerateConfig.localTranslation;

    let lotStartVector = vec4.fromValues(lot.sides[0].startX, 0, lot.sides[0].startY, 1);

    let roofTranslate = vec4.fromValues(lot.sides[0].startX, 0, lot.sides[0].startY, 1);
    vec4.add(roofTranslate, roofTranslate, this.context.overallTranslation);
    vec4.add(roofTranslate, roofTranslate, vec4.fromValues(0,floorHeight * floorCount,0, 0));

    if (lot.type == "FIXED") {
      roofComponent.instance.addInstance(roofTranslate, vec4.fromValues(0,0,0,1), vec3.fromValues(lotScale / 7.5, lotScale / 7.5, lotScale / 7.5));
    }

    for (var itr = 0; itr < lot.sides.length; ++itr) {
      let side = Object.create(lot.sides[itr]);
      side.scale(lotScale);

      let cmds = this.getBuildCommandsForSide(side, this.context.windowComponent, this.context.wallComponent);

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

      if (lot.type == "DYNAMIC") {
        let dynTrans = vec4.fromValues(side.startX, 0, side.startY, 1);
        vec4.add(dynTrans, dynTrans, this.context.overallTranslation);
        vec4.add(dynTrans, dynTrans, vec4.fromValues(0, floorHeight * floorCount, 0, 0));

        dynamicSides.push(dynTrans);

        if (itr == lot.sides.length - 1) {
          dynTrans = vec4.fromValues(side.endX, 0, side.endY, 1);
          vec4.add(dynTrans, dynTrans, this.context.overallTranslation);
          vec4.add(dynTrans, dynTrans, vec4.fromValues(0, floorHeight * floorCount, 0, 0));

          dynamicSides.push(dynTrans);
        }
      }

      for (var floorIdx = 0; floorIdx < floorCount; ++floorIdx) {
        let floorY = floorHeight * floorIdx;
        let wallYScale = floorHeight / 3.0; // Todo: take from Component

        let translate = vec4.fromValues(side.startX, 0, side.startY, 1);
        vec4.add(translate, translate, this.context.overallTranslation);
        vec4.add(translate, translate, vec4.fromValues(0,floorY,0, 0));

        if (this.context.floorSeparator == "RANDOM_ACROSS_FLOORS") {
          this.context.placeSeparator = this.defaultFloorConstraint.placementRng.roll() == "CAN_PLACE";
        }

        if (this.context.placeSeparator && floorIdx != floorCount - 1 && lot.type == "FIXED") {
          let floorY = floorHeight * (floorIdx + 1);
          let separatorTranslate = vec4.create();
          vec4.copy(separatorTranslate, lotStartVector);
          vec4.add(separatorTranslate, separatorTranslate, this.context.overallTranslation);
          vec4.add(separatorTranslate, separatorTranslate, vec4.fromValues(0, floorY, 0, 0));

          this.context.sepComponent.instance.addInstance(separatorTranslate, vec4.fromValues(0,0,0,1), vec3.fromValues(lotScale / 7.5, 1.0, lotScale / 7.5));
        }

        for (var cmdItr = 0; cmdItr < cmds.length; ++cmdItr) {
          let cmd = cmds[cmdItr];

          if (cmd.type == "wall") {
            let localScale = vec3.create();
            vec3.copy(localScale, scale);

            localScale[0] *= cmd.width;
            localScale[1] = wallYScale;

            logTrace('Comp Instance Values: ', translate, quat, localScale);
            this.context.wallComponent.instance.addInstance(translate, quat, localScale);
            
            // let localScale = vec3.create();
            // vec3.copy(localScale, scale);
            // let localTranslate = vec4.create();
            // vec4.copy(localTranslate, translate);

            // for (var widthItr = 0; widthItr < cmd.width; ++widthItr) {
            //   let scale = 1;
            //   if (widthItr + 1 > cmd.width) {
            //     scale = (widthItr + 1) - cmd.width;
            //   }

            //   localScale[0] = scale;
            //   localScale[1] = wallYScale;

            //   logTrace('Comp Instance Values: ', localTranslate, quat, localScale);
            //   this.context.wallComponent.instance.addInstance(localTranslate, quat, localScale);

            //   vec4.add(localTranslate, localTranslate, directionVec4);
            // }
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

            if (localScale[2] > 0 && lot.type == "DYNAMIC") {
              localScale[2] *= -1;
            }

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

    if (lot.type == "DYNAMIC") {
      logTrace('Dynamic Sides', dynamicSides);
      logTrace('Dynamic Sides', lot.sides);
      for (var idx = 0; idx < dynamicSides.length - 2; idx++) {
        let v1 = dynamicSides[0];
        let v2 = dynamicSides[idx + 1];
        let v3 = dynamicSides[idx + 2];

        this.roofMesh.addTriangle(v1, v2, v3);      
      }
    }
  }

  construct(rootTranslation: vec4, shapeGrammar: any, generationConstraint: any, property: Property) {
    this.context = new BuildingContext();
    this.context.wallComponent = this.components[this.defaultWallConstraint.rng.roll()];
    this.context.windowComponent = this.components[this.defaultWindowConstraint.rng.roll()];
    this.context.rootTranslation = rootTranslation;
    this.context.roofComponent = this.components[this.defaultRoofConstraint.rng.roll()];
    this.context.sepComponent = this.components[this.defaultSepConstraint.objRng.roll()];

    this.context.floorCount = Math.round(this.defaultFloorConstraint.rng.roll());
    this.context.floorType = this.defaultFloorConstraint.typeRng.roll();
    this.context.floorHeight = Math.round(this.defaultFloorConstraint.heightRng.roll());
    this.context.floorSeparator = this.defaultFloorConstraint.separatorRng.roll();
    this.context.floorSeparatorPlacement = this.defaultFloorConstraint.placementRng.roll();
    this.context.placeSeparator = this.context.floorSeparatorPlacement == "CAN_PLACE";

    let valItr = Math.round(this.iterationRng.roll('native'));

    logTrace('Using Iterations:', valItr);

    shapeGrammar.addScope('property', property);
    let generatedLots = shapeGrammar.construct(valItr + 1, generationConstraint);

    let floorGap = (generationConstraint.population.min - 0.6) * 8;
    
    logTrace('Total Lots Generated:', generatedLots.length);

    // this.context.floorCount += floorGap;

    // if (this.context.floorCount < 1) {
    //   this.context.floorCount = 1;
    // }

    for (var itr = 0; itr < generatedLots.length; ++itr) {
      let obj = generatedLots[itr];

      let scaledLocal = vec4.create();
      scaledLocal[0] = (obj.localTranslation[0])  * obj.localScale;
      scaledLocal[1] = (obj.localTranslation[1]) * obj.localScale;
      scaledLocal[2] = (obj.localTranslation[2]) * obj.localScale;
      scaledLocal[3] = 0;

      this.context.overallTranslation = vec4.create();
      vec4.add(this.context.overallTranslation, rootTranslation, scaledLocal);

      logTrace(`Overall Translation for Lot:`, this.context.overallTranslation);
      logTrace(`Lot OBJ from LSystem:`, obj);

      this.constructLot(obj);
    }
  }
}

export {Building, BuildingComponent, Lot, Property, GenerationConstraint};

export default Building;