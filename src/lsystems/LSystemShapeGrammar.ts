import { LSystem, LSystemTurtle } from '../core/lsystem/LSystem';
import MeshInstanced from '../geometry/MeshInstanced';

import {
  vec3,
  mat3,
  mat4,
  vec4
} from 'gl-matrix';

var Logger = require('debug');
var logTrace = Logger("mainApp:shapeGrammar:trace:instance:transform");
var logInfo = Logger("mainApp:shapeGrammar:info:instance:transform");
var logError = Logger("mainApp:shapeGrammar:error:instance:transform");

let localOrigin = vec4.fromValues(0,0,0,1);

function degreeToRad(deg: number) {
  return deg * 0.0174533;
}

function makeBoundingLine(p0: vec3, p1: vec3, mesh: any) {
  mesh.linesArray.push(vec4.fromValues(p0[0], p0[1], p0[2], 1.0));
  mesh.linesArray.push(vec4.fromValues(p1[0], p1[1], p1[2], 1.0));
}

function drawSquareLot() {
  let scaleRatio = 1.0;
  if (this.ruleData && this.ruleData[0]) {
    scaleRatio = Number.parseFloat(this.ruleData[0]);
  }

  let returnObj: any = {};
  returnObj.lot = this.scope.lotsMap.Square;
  returnObj.localScale = scaleRatio * (this.scope.property.sideLength / 2.0);

  let lotPosition = vec4.create();
  // vec4.transformMat4(lotPosition, localOrigin, this.turtle.transform);
  vec4.copy(lotPosition, this.turtle.position);

  returnObj.localTranslation = lotPosition;

  logInfo('Turtle Position:', lotPosition);

  this.scope.resultLots.push(returnObj);
}

function drawCircleLot() {
  let scaleRatio = 1.0;
  if (this.ruleData && this.ruleData[0]) {
    scaleRatio = Number.parseFloat(this.ruleData[0]);
  }

  let returnObj: any = {};
  returnObj.lot = this.scope.lotsMap.HalfCircle;
  returnObj.localScale = scaleRatio * (this.scope.property.sideLength / 2.0);

  let lotPosition = vec4.create();
  // vec4.transformMat4(lotPosition, localOrigin, this.turtle.transform);
  vec4.copy(lotPosition, this.turtle.position);

  returnObj.localTranslation = lotPosition;

  logInfo('Turtle Position:', lotPosition);

  this.scope.resultLots.push(returnObj);
}

function rotateCCW90() {
  let transform = mat4.create();
  mat4.fromYRotation(transform, degreeToRad(-90));
  this.turtle.applyTransform(transform);
}

function rotateCW90() {
  let transform = mat4.create();
  mat4.fromYRotation(transform, degreeToRad(90));
  this.turtle.applyTransform(transform);
}

function rotateCCWAngle() {
  let magnitude = Number.parseFloat(this.ruleData[0]);

  let transform = mat4.create();
  mat4.fromYRotation(transform, degreeToRad(-magnitude));
  this.turtle.applyTransform(transform);
}

function rotateCWAngle() {
  let magnitude = Number.parseFloat(this.ruleData[0]);

  let transform = mat4.create();
  mat4.fromYRotation(transform, degreeToRad(magnitude));
  this.turtle.applyTransform(transform);
}

function moveForward() {
  let magnitude = Number.parseFloat(this.ruleData[0]);

  let headingWorld = vec4.create();
  vec4.copy(headingWorld, this.turtle.heading);
  vec4.scale(headingWorld, headingWorld, magnitude);

  logError('Resultant Heading For Forward', headingWorld);

  let transform = mat4.create();
  mat4.fromTranslation(transform,  vec3.fromValues(headingWorld[0], headingWorld[1], headingWorld[2]));
  this.turtle.applyTransformPre(transform);
}

function moveUp() {
  let magnitude = Number.parseFloat(this.ruleData[0]);

  let transform = mat4.create();
  mat4.fromTranslation(transform,  vec3.fromValues(0, magnitude, 0));
  this.turtle.applyTransformPre(transform);
}

function moveDown() {
  let magnitude = Number.parseFloat(this.ruleData[0]);

  let transform = mat4.create();
  mat4.fromTranslation(transform,  vec3.fromValues(0, -magnitude, 0));
  this.turtle.applyTransformPre(transform);
}

function moveVector() {
  let x = Number.parseFloat(this.ruleData[0]);
  let y = Number.parseFloat(this.ruleData[1]);
  let z = Number.parseFloat(this.ruleData[2]);

  let transform = mat4.create();
  mat4.fromTranslation(transform,  vec3.fromValues(x, y, z));
  this.turtle.applyTransform(transform);
}

class LSystemShapeGrammar {
  system: LSystem;
  scope: any;

  constructor(seed: number) {
    this.system = new LSystem(seed);

    this.system.setAxiom("P");
    // this.system.addWeightedRule("P", "Q", 100);
    // this.system.addWeightedRule("P", "F{0.5}+F{0.5}bW", 100);
    // this.system.addWeightedRule("P", "E", 100);
    // this.system.addWeightedRule("P", "F{0.5}+F{0.5}bR", 100);
    // this.system.addWeightedRule("P", "F{0.5}+F{0.5}bT", 100);
    this.system.addWeightedRule("P", "o", 100);


    this.system.addRule("Q", "bF{1}+Q");
    this.system.addRule("W", "F{1.0}b{0.5}F{1.0}-W");
    this.system.addRule("E", "[F{0.2}+F{0.2}b{0.75}]F{1.75}+E");

    this.system.addRule("R", "F{1.0}^{0.5}b{0.5}F{1.0}-R");
    this.system.addRule("T", "F{1.0}[^{0.5}b{0.5}]F{1.0}-T");

    // this.system.addRule("W", "V{1.0,0,0}b{0.5}V{1.0,0,0}V{0,0,1.0}b{0.5}");
    // this.system.addWeightedRule("P", "bF{0.5}+P", 50);
    // this.system.addWeightedRule("P", "F{0.5}+F{0.5}b{1}X", 125);
    // this.system.addRule("X", "[F{0.5}b{0.33}]+X");

    this.system.addSymbol('b', drawSquareLot, []);
    this.system.addSymbol('o', drawCircleLot, []);
    this.system.addSymbol('+', rotateCCW90, []);
    this.system.addSymbol('-', rotateCW90, []);

    this.system.addSymbol('*', rotateCCWAngle, []);
    this.system.addSymbol('/', rotateCWAngle, []);

    this.system.addSymbol('^', moveUp, []);
    this.system.addSymbol('v', moveDown, []);

    this.system.addSymbol('F', moveForward, []);
    this.system.addSymbol('V', moveVector, []);

    this.scope = {
      resultLots: [],
      translation: vec3.fromValues(0,0,0)
    };
  }

  addScope(key: string, val:any) {
    this.scope[key] = val;
  }

  construct(itr: number, generationConstraint: any) {
    this.scope.resultLots = [];

    this.system.construct(itr, generationConstraint);
    logInfo('Production', this.system.rootString.join(''));
    this.system.process(this.scope);

    return this.scope.resultLots;
  }
}

export default LSystemShapeGrammar;