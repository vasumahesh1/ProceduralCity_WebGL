import { vec2, vec3, vec4, mat4, glMatrix } from 'gl-matrix';
import { Building, Property, GenerationConstraint } from './Building';

var Logger = require('debug');
var logTrace = Logger("mainApp:CityGenerator:trace");
var logError = Logger("mainApp:CityGenerator:error");

const cachedNoise = require('../../config/noise.json');
const populationNoise = cachedNoise['positive_noise_1'];
const simplex2D = cachedNoise['simplex2d'];

function getRandom2D(x: number, y: number) {
  x = Math.floor(x % simplex2D['sizeX']);
  y = Math.floor(y % simplex2D['sizeY']);
  let rng = simplex2D['values'][x][y];
  return rng;
}

class CityGenerator {
  seed: number;
  noiseGen: any;

  meshInstances: any;
  buildingComps: any;
  buildingBlueprints: any;
  grammarSystem: any;
  debugLines: any;
  rootTranslate: vec4;

  properties: Array<Property>;
  blueprints: Array<Building>;

  constructor(seed: number) {
    this.seed = seed;

    this.properties = new Array<Property>();
    this.blueprints = new Array<Building>();
  }

  private fbm2D(p: vec2, octaves: number){
    let s = 0.0;
    let m = 0.0;
    let a = 0.5;
    
    for(let i = 0; i < octaves;  i++) {
      s += a * this.noiseGen.perlin2(p[0], p[1]);
      m += a;
      a *= 0.5;
      vec2.scale(p, p, 2.0);
    }

    return s / m;
  }

  private populationNoise(p: vec2) {
    let x = p[0] % populationNoise['sizeX'];
    let y = p[1] % populationNoise['sizeY'];

    let noiseVal = populationNoise['values'][x][y];

    return  noiseVal > 0 ? noiseVal : 0;

    // return (this.fbm2D(p, 8) + 1.0) / 2.0;
  }

  private  canPlaceProperty(property: Property) {
    for (var idx = this.properties.length - 1; idx >= 0; idx--) {
      let prop = this.properties[idx];

      if (prop.checkOverlap(property)) {
        return false;
      }
    }

    return true;
  }

  private debugProperty(property: Property) {
    let localPosition = property.getEdgeVertex();
    let finalPosition = vec4.create();

    vec4.add(finalPosition, this.rootTranslate, localPosition);

    let tempVec1 = vec4.create();
    let tempVec2 = vec4.create();
    vec4.add(tempVec1, finalPosition, vec4.fromValues(property.sideLength, 0, 0, 0.0));
    vec4.add(tempVec2, finalPosition, vec4.fromValues(property.sideLength, 0, property.sideLength, 0.0));

    logTrace(`Property Edges at: ${finalPosition[0]}, ${finalPosition[1]}, ${finalPosition[2]}`);
    logTrace(`Property Edges at: ${tempVec1[0]}, ${tempVec1[1]}, ${tempVec1[2]}`);
    this.debugLines.add(finalPosition, tempVec1);

    logTrace(`Property Edges at: ${tempVec2[0]}, ${tempVec2[1]}, ${tempVec2[2]}`);
    this.debugLines.add(tempVec1, tempVec2);

    vec4.add(tempVec1, finalPosition, vec4.fromValues(0, 0, property.sideLength, 0.0));

    logTrace(`Property Edges at: ${tempVec1[0]}, ${tempVec1[1]}, ${tempVec1[2]}`);

    this.debugLines.add(tempVec2, tempVec1);
    this.debugLines.add(tempVec1, finalPosition);
  }

  private  constructProperty(property: Property, constraint: GenerationConstraint) {
    logTrace(`Constructing Property at: ${property.center[0]}, ${property.center[1]}, ${property.center[2]}`);

    this.properties.push(property);

    let localPosition = property.getEdgeVertex();
    let finalPosition = vec4.create();

    vec4.add(finalPosition, this.rootTranslate, localPosition);

    this.debugProperty(property);

    logTrace(`Constructing Starting Point at: ${finalPosition[0]}, ${finalPosition[1]}, ${finalPosition[2]}`);

    let selectedBlueprints = [];

    for (var itr = 0; itr < this.blueprints.length; ++itr) {
      let current = this.blueprints[itr];

      let result = constraint.isValid(current.config.constraints);

      if (result) {
        selectedBlueprints.push(result);
      }
    }

    if (selectedBlueprints.length == 0) {
      logError('Unable to Find a Valid Blueprint for given Constraints');
      return;
    }

    let random = (getRandom2D(this.seed * property.center[0] * 31, this.seed * property.center[2] * 729) + 1.0) / 2.0;

    let idx = Math.floor(random * selectedBlueprints.length);

    logError('Blueprint Selected IDX', idx);

    this.blueprints[idx].construct(finalPosition, this.grammarSystem, constraint, property);

    logTrace('Constructed a Plot');
  }

  build(width: number, height: number, rootTranslate: vec4) {
    this.properties = new Array<Property>();
    this.blueprints = new Array<Building>();

    this.rootTranslate = rootTranslate;

    for (let itr = 0; itr < this.buildingBlueprints.buildings.length; ++itr) {
      let building = this.buildingBlueprints.buildings[itr];
      this.blueprints.push(new Building(building, this.buildingComps));
      // testBuilding.construct(vec4.fromValues(0,0,0,1), this.grammarSystem);
    }

    for (var coordX = 0; coordX < width; ++coordX) {
      for (var coordZ = 0; coordZ < height; ++coordZ) {
        let coordVec2 = vec2.fromValues(coordX, coordZ);
        let populationLevel = this.populationNoise(coordVec2);

        let constraint = new GenerationConstraint();
        constraint.setPopulation(populationLevel, populationLevel + 1.0);
        constraint.setPopulation(0.0, 1.0);
        constraint.setLandValue(0.0, 1.0);

        let potentialProperty = new Property(15);
        potentialProperty.setCenter(vec3.fromValues(coordVec2[0], 0, coordVec2[1]));

        if (!this.canPlaceProperty(potentialProperty)) {
          continue;
        }

        this.constructProperty(potentialProperty, constraint);
      }
    }    
  }
}

export default CityGenerator;