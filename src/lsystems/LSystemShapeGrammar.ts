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
  returnObj.systemHeight = this.scope.forceHeight;

  let lotPosition = vec4.create();
  // vec4.transformMat4(lotPosition, localOrigin, this.turtle.transform);
  vec4.copy(lotPosition, this.turtle.position);

  returnObj.localTranslation = lotPosition;

  logTrace('Turtle Position:', lotPosition);

  this.scope.resultLots.push(returnObj);
}

function drawHalfCircleLot() {
  let scaleRatio = 1.0;
  if (this.ruleData && this.ruleData[0]) {
    scaleRatio = Number.parseFloat(this.ruleData[0]);
  }

  let returnObj: any = {};
  returnObj.lot = this.scope.lotsMap.HalfCircle;
  returnObj.localScale = scaleRatio * (this.scope.property.sideLength / 2.0);
  returnObj.forceHeight = this.scope.forceHeight;

  let lotPosition = vec4.create();
  // vec4.transformMat4(lotPosition, localOrigin, this.turtle.transform);
  vec4.copy(lotPosition, this.turtle.position);

  returnObj.localTranslation = lotPosition;

  logTrace('Turtle Position:', lotPosition);

  this.scope.resultLots.push(returnObj);
}

function drawCircleLot() {
  let scaleRatio = 1.0;
  if (this.ruleData && this.ruleData[0]) {
    scaleRatio = Number.parseFloat(this.ruleData[0]);
  }

  let returnObj: any = {};
  returnObj.lot = this.scope.lotsMap.Circle;
  returnObj.localScale = scaleRatio * (this.scope.property.sideLength / 2.0);
  returnObj.forceHeight = this.scope.forceHeight;

  let lotPosition = vec4.create();
  // vec4.transformMat4(lotPosition, localOrigin, this.turtle.transform);
  vec4.copy(lotPosition, this.turtle.position);

  returnObj.localTranslation = lotPosition;

  logTrace('Turtle Position:', lotPosition);

  this.scope.resultLots.push(returnObj);
}

function drawHalfSquare() {
  let scaleRatio = 1.0;
  if (this.ruleData && this.ruleData[0]) {
    scaleRatio = Number.parseFloat(this.ruleData[0]);
  }

  let returnObj: any = {};
  returnObj.lot = this.scope.lotsMap.TiltedSquare;
  returnObj.localScale = scaleRatio * (this.scope.property.sideLength / 2.0);
  returnObj.forceHeight = this.scope.forceHeight;

  let lotPosition = vec4.create();
  // vec4.transformMat4(lotPosition, localOrigin, this.turtle.transform);
  vec4.copy(lotPosition, this.turtle.position);

  returnObj.localTranslation = lotPosition;

  logTrace('Turtle Position:', lotPosition);

  this.scope.resultLots.push(returnObj);
}

function drawShape(shape: string) {
  let scaleRatio = 1.0;
  if (this.ruleData && this.ruleData[0]) {
    scaleRatio = Number.parseFloat(this.ruleData[0]);
  }

  let returnObj: any = {};
  returnObj.lot = this.scope.lotsMap[shape];
  returnObj.localScale = scaleRatio * (this.scope.property.sideLength / 2.0);
  returnObj.forceHeight = this.scope.forceHeight;

  let lotPosition = vec4.create();
  // vec4.transformMat4(lotPosition, localOrigin, this.turtle.transform);
  vec4.copy(lotPosition, this.turtle.position);

  returnObj.localTranslation = lotPosition;

  logTrace('Turtle Position:', lotPosition);

  this.scope.resultLots.push(returnObj);
}

function setSameSize() {
  this.scope.forceHeight = Number.parseFloat(this.ruleData[0]);
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

  logTrace('Resultant Heading For Forward', headingWorld);

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
    this.system.addWeightedRule("P", "Q", 100);
    this.system.addWeightedRule("P", "F{0.5}+F{0.5}bW", 100);
    this.system.addWeightedRule("P", "E", 100);
    this.system.addWeightedRule("P", "F{0.5}+F{0.5}bR", 100);
    this.system.addWeightedRule("P", "F{0.5}+F{0.5}bT", 100);
    this.system.addWeightedRule("P", "Y", 100);
    this.system.addWeightedRule("P", "U", 100);
    this.system.addWeightedRule("P", "I", 100);
    this.system.addWeightedRule("P", "F{0.5}+F{0.5}zA", 100);
    this.system.addWeightedRule("P", "D", 100);
    
    // Hex Rules
    this.system.addWeightedRule("P", "G", 100);
    this.system.addWeightedRule("P", "F{0.5}+F{0.5}cH", 100);
    this.system.addWeightedRule("P", "J", 100);


    this.system.addRule("Q", "bF{1}+Q");
    this.system.addRule("W", "F{1.0}b{0.5}F{1.0}-W");
    this.system.addRule("E", "[F{0.2}+F{0.2}b{0.75}]F{1.75}+E");

    this.system.addRule("R", "F{1.0}^{0.5}b{0.5}F{1.0}-R");
    this.system.addRule("T", "F{1.0}[^{0.5}b{0.5}]F{1.0}-T");
    this.system.addRule("Y", "S{1}oF{-2}+F{-2}x{-1}");
    this.system.addRule("U", "S{1}oF{-2}+F{-2}o{-1}");

    this.system.addRule("I", "zF{1}+I");
    this.system.addRule("A", "F{1.0}z{0.5}F{1.0}-A");
    this.system.addRule("D", "[F{0.2}+F{0.2}z{0.75}]F{1.75}+D");

    this.system.addRule("G", "cF{1}+G");
    this.system.addRule("H", "F{1.0}c{0.5}F{1.0}-H");
    this.system.addRule("J", "[F{0.2}+F{0.2}c{0.75}]F{1.75}+J");

    this.system.addSymbol('b', drawSquareLot, []);
    this.system.addSymbol('o', drawHalfCircleLot, []);
    this.system.addSymbol('z', drawShape, ['Circle']);
    this.system.addSymbol('x', drawShape, ['TiltedSquare']);
    this.system.addSymbol('c', drawShape, ['Hex']);

    this.system.addSymbol('+', rotateCCW90, []);
    this.system.addSymbol('-', rotateCW90, []);

    this.system.addSymbol('*', rotateCCWAngle, []);
    this.system.addSymbol('/', rotateCWAngle, []);

    this.system.addSymbol('^', moveUp, []);
    this.system.addSymbol('v', moveDown, []);

    this.system.addSymbol('F', moveForward, []);
    this.system.addSymbol('V', moveVector, []);
    
    this.system.addSymbol('S', setSameSize, []);

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
    logTrace('Production', this.system.rootString.join(''));
    this.system.process(this.scope);

    return this.scope.resultLots;
  }
}

export default LSystemShapeGrammar;