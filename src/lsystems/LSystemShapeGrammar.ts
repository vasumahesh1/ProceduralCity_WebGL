import { LSystem, LSystemTurtle } from '../core/lsystem/LSystem';
import MeshInstanced from '../geometry/MeshInstanced';

import {
  vec3,
  mat3,
  mat4,
  vec4
} from 'gl-matrix';

var Logger = require('debug');
var logTrace = Logger("mainApp:shapeGrammar:info:instance:transform");
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
  let returnObj: any = {};
  returnObj.lot = this.scope.lotsMap.Square;
  returnObj.localScale = 30;

  let lotPosition = vec4.create();
  vec4.transformMat4(lotPosition, localOrigin, this.turtle.transform);

  returnObj.localTranslation = lotPosition;

  logTrace('Turtle Position:', lotPosition);

  this.scope.resultLots.push(returnObj);
}

function rotateCCW90() {
  let transform = mat4.create();
  mat4.fromYRotation(transform, degreeToRad(-90));
  this.turtle.applyTransform(transform);
}

function moveForward() {
  let transform = mat4.create();
  mat4.fromTranslation(transform,  vec3.fromValues(1, 0, 0));
  this.turtle.applyTransform(transform);
}

class LSystemShapeGrammar {
  system: LSystem;
  scope: any;

  constructor(seed: number) {
    this.system = new LSystem(seed);

    this.system.setAxiom("P");
    this.system.addRule("P", "bF{1}+P");

    this.system.addSymbol('b', drawSquareLot, []);
    this.system.addSymbol('+', rotateCCW90, []);
    this.system.addSymbol('F', moveForward, []);

    this.scope = {
      resultLots: [],
      translation: vec3.fromValues(0,0,0)
    };
  }

  addScope(key: string, val:any) {
    this.scope[key] = val;
  }

  construct(itr: number) {
    this.system.construct(itr);
    this.system.process(this.scope);

    return this.scope.resultLots;
  }
}

export default LSystemShapeGrammar;