import { vec2, vec3, vec4, mat4, glMatrix } from 'gl-matrix';
import * as Stats from 'stats-js';
import * as DAT from 'dat-gui';
import Icosphere from './geometry/Icosphere';
import Square from './geometry/Square';
import DynamicRoof from './geometry/DynamicRoof';
import Cube from './geometry/Cube';
import Line from './geometry/Line';
import NoisePlane from './geometry/NoisePlane';
import MeshInstanced from './geometry/MeshInstanced';
import Sky from './geometry/Sky';
import OpenGLRenderer from './rendering/gl/OpenGLRenderer';
import Texture from './rendering/gl/Texture';
import Camera from './Camera';
import { setGL } from './globals';
import { ShaderControls, WaterControls } from './rendering/gl/ShaderControls';
import ShaderProgram, { Shader } from './rendering/gl/ShaderProgram';
import { Building, BuildingComponent, Lot } from './core/shape_grammer/Building';
import PolygonLotConstructor from './core/shape_grammer/PolygonLotConstructor';
import CityGenerator from './core/shape_grammer/CityGenerator';
import AssetLibrary from './core/utils/AssetLibrary';
import WeightedRNG from './core/rng/WeightedRNG';
import LSystemShapeGrammar from './lsystems/LSystemShapeGrammar';

var buildingBlueprints = require('./config/buildings.json');
var baseBuildingComps = require('./config/building_comps.json');
var baseLots = require('./config/lots.json');

localStorage.debug = 'mainApp:*:info*,mainApp:*:error*'; // ,mainApp:*:trace*';

var Logger = require('debug');
var logTrace = Logger("mainApp:main:trace");
var logError = Logger("mainApp:main:error");

(<any>window).Building = Building;

let meshInstances: { [symbol: string]: MeshInstanced; } = { };
let buildingComps: { [symbol: string]: BuildingComponent; } = { };
let lotsMap: { [symbol: string]: Lot; } = { };

let shapeGrammarSystem = new LSystemShapeGrammar(546);

let dynamicConstructors: any = {};

// Define an object with application parameters and button callbacks
// This will be referred to by dat.GUI's functions that add GUI elements.
let controls = {
  createButton: loadAssets,
  toggleCollisionButton: toggleCollision,
  toggleLeavesButton: toggleLeaves,
  saveImage: saveImage,
  axiom: "[F][/-F][*+F][++*F][--*F]",
  seed: 858.739,
  iterations: 4,
  lightDirection: [100, 150, 100],
  influencers: {
    sunlight: 0.0,
    gravity: 5.0,
    collisionCheck: true
  },
  constraints: {
    minCollisionDistance: 0.015,
    rotateTilt: 20,
    rotateSwirl: 45,
    rotateSNoise: 5,
    rotateTNoise: 5,
  }
};

const SM_VIEWPORT_TRANSFORM:mat4 = mat4.fromValues(
  0.5, 0.0, 0.0, 0.0,
  0.0, 0.5, 0.0, 0.0,
  0.0, 0.0, 0.5, 0.0,
  0.5, 0.5, 0.5, 1.0);

const LEAF_COLOR_GRADIENT: Array<any> = [  
  [97, 130, 47, 255],
  [111, 140, 7, 255],
  [242, 206, 22, 255],
  [242, 164, 19, 255],
  [242, 79, 19, 255]
];

let prevTime: number;
let degreePerMS: number = -5.0 / 1000.0;

let FlagIsRenderable: boolean = false;

let boundingLines: Line;
let sky: Sky;
let plane: NoisePlane;
let generator: CityGenerator;
let roofMesh: DynamicRoof;

let shaderControls: ShaderControls;

let testBuilding: Building;
let testRNG: WeightedRNG;
let mainAtlas: Texture;

let assetLibrary: AssetLibrary;
let regularShader: ShaderProgram;
let mainShader: ShaderProgram;
let skyShader: ShaderProgram;
let visualShader: ShaderProgram;
let shadowMapShader: ShaderProgram;

let frameCount: number = 0;

let shouldCapture: boolean = false;

let drawOnlyCollisions: boolean = false;
let drawLeaves: boolean = true;

function toggleLeaves() {
  drawLeaves = !drawLeaves;
}

/**
 * @brief      Loads the geometry assets
 */
function loadAssets(callback?: any) {
  FlagIsRenderable = false;
  if (boundingLines) {
    boundingLines.destory();
  }

  if (plane) {
    plane.destory();
  }

  if (sky) {
    sky.destory();
  }

  plane = new NoisePlane(2000, 2000, 2, 2, 8123);
  plane.create();

  boundingLines = new Line();
  roofMesh = new DynamicRoof();

  dynamicConstructors['PolygonLotConstructor'] = new PolygonLotConstructor();

  mainAtlas = new Texture('./psd/texture_atlas.png');

  // Enable for Debug
  boundingLines.linesArray.push(vec4.fromValues(0, 0, 0, 1.0));
  boundingLines.linesArray.push(vec4.fromValues(30, 0, 0, 1.0));
  boundingLines.linesArray.push(vec4.fromValues(0, 0, 0, 1.0));
  boundingLines.linesArray.push(vec4.fromValues(0, 0, 30, 1.0));
  boundingLines.linesArray.push(vec4.fromValues(0, 0, 0, 1.0));
  boundingLines.linesArray.push(vec4.fromValues(0, 30, 0, 1.0));

  sky = new Sky(vec3.fromValues(0, 0, 0));
  sky.create();

  assetLibrary  = new AssetLibrary();
  (<any>window).AssetLibrary = assetLibrary;

  let assets: any = {};

  for (let itr = 0; itr < baseBuildingComps.components.length; ++itr) {
    let comp = baseBuildingComps.components[itr];
    assets[comp.name] = comp.url;
  }

  for (let itr = 0; itr < baseLots.lots.length; ++itr) {
    let lotData = baseLots.lots[itr];
    let lot = new Lot();
    lot.load(lotData, dynamicConstructors);
    lotsMap[lotData.name] = lot;
  }

  generator = new CityGenerator(controls.seed);

  shapeGrammarSystem.addScope('lotsMap', lotsMap);

  assetLibrary.load(assets)
    .then(function() {
      logTrace('Loaded Asssets', assetLibrary);

      let uvScale = baseBuildingComps.uvScale;

      for (let itr = 0; itr < baseBuildingComps.components.length; ++itr) {
        let comp = baseBuildingComps.components[itr];
        meshInstances[comp.name] = new MeshInstanced(comp.name);
        meshInstances[comp.name].rawMesh = assetLibrary.meshes[comp.name];
        meshInstances[comp.name].uvOffset = vec2.fromValues(comp.uvOffset[0] * uvScale, comp.uvOffset[1] * uvScale);
        meshInstances[comp.name].uvScale = uvScale;
      }

      logTrace('Loaded MeshInstances are:', meshInstances);

      for (let itr = 0; itr < baseBuildingComps.components.length; ++itr) {
        let comp = baseBuildingComps.components[itr];
        let compObj = new BuildingComponent();
        compObj.instance = meshInstances[comp.name];
        compObj.width = comp.width;
        buildingComps[comp.name] = compObj;
      }

      logTrace('Loaded Components are:', buildingComps);
      logTrace('Loaded Blueprints are:', buildingBlueprints);

      generator.meshInstances = meshInstances;
      generator.buildingComps = buildingComps;
      generator.buildingBlueprints = buildingBlueprints;
      generator.grammarSystem = shapeGrammarSystem;
      generator.debugLines = boundingLines;
      generator.roofMesh = roofMesh;

      generator.build(500, 500, vec4.fromValues(0,0,0,0));

      for(let key in meshInstances) {
        meshInstances[key].create();
      }

      boundingLines.create();
      roofMesh.create();

      FlagIsRenderable = true;

      if (callback) {
        callback();
      }
    })
    .catch(function(err) {
      logError('Asset Library Loading Error', err);
    });
}

function saveImage() {
  shouldCapture = true;
}

function toggleCollision() {
  drawOnlyCollisions = !drawOnlyCollisions;
}

function downloadImage() {
  // Dump the canvas contents to a file.
  var canvas = <HTMLCanvasElement>document.getElementById("canvas");
  canvas.toBlob(function(blob) {
    var link = document.createElement("a");
    link.download = "image.png";

    link.href = URL.createObjectURL(blob);
    console.log(blob);

    link.click();

  }, 'image/png');
}

function constructGUI() {
  // Add controls to the gui
  const gui = new DAT.GUI();
  gui.add(controls, 'saveImage').name('Save Image');
}

function lookAtMat4(out: any, eye: any, center: any, up: any) {
  let x0, x1, x2, y0, y1, y2, z0, z1, z2, len;
  let eyex = eye[0];
  let eyey = eye[1];
  let eyez = eye[2];
  let upx = up[0];
  let upy = up[1];
  let upz = up[2];
  let centerx = center[0];
  let centery = center[1];
  let centerz = center[2];

  if (Math.abs(eyex - centerx) < glMatrix.EPSILON &&
      Math.abs(eyey - centery) < glMatrix.EPSILON &&
      Math.abs(eyez - centerz) < glMatrix.EPSILON) {
    return mat4.identity(out);
  }

  z0 = eyex - centerx;
  z1 = eyey - centery;
  z2 = eyez - centerz;

  len = 1 / Math.sqrt(z0 * z0 + z1 * z1 + z2 * z2);
  z0 *= len;
  z1 *= len;
  z2 *= len;

  x0 = upy * z2 - upz * z1;
  x1 = upz * z0 - upx * z2;
  x2 = upx * z1 - upy * z0;
  len = Math.sqrt(x0 * x0 + x1 * x1 + x2 * x2);
  if (!len) {
    x0 = 0;
    x1 = 0;
    x2 = 0;
  } else {
    len = 1 / len;
    x0 *= len;
    x1 *= len;
    x2 *= len;
  }

  y0 = z1 * x2 - z2 * x1;
  y1 = z2 * x0 - z0 * x2;
  y2 = z0 * x1 - z1 * x0;

  len = Math.sqrt(y0 * y0 + y1 * y1 + y2 * y2);
  if (!len) {
    y0 = 0;
    y1 = 0;
    y2 = 0;
  } else {
    len = 1 / len;
    y0 *= len;
    y1 *= len;
    y2 *= len;
  }

  out[0] = x0;
  out[1] = y0;
  out[2] = z0;
  out[3] = 0;
  out[4] = x1;
  out[5] = y1;
  out[6] = z1;
  out[7] = 0;
  out[8] = x2;
  out[9] = y2;
  out[10] = z2;
  out[11] = 0;
  out[12] = -(x0 * eyex + x1 * eyey + x2 * eyez);
  out[13] = -(y0 * eyex + y1 * eyey + y2 * eyez);
  out[14] = -(z0 * eyex + z1 * eyey + z2 * eyez);
  out[15] = 1;

  return out;
}

function setShadowMapData(shader: ShaderProgram) {
  let lightDir = controls.lightDirection;
  let lightDirection =  vec3.fromValues(lightDir[0], lightDir[1], lightDir[2]);

  let lightSpaceOrthoProj = mat4.create();
  mat4.ortho(lightSpaceOrthoProj, -8.0, 8.0, -8.0, 8.0, 0.0, 100.0);


  let lightSpaceView = mat4.create();
  lookAtMat4(lightSpaceView, lightDirection, vec3.fromValues(0, 0, 0), vec3.fromValues(0, 1, 0));
  let lightSpaceModel = mat4.create();
  let lightSpaceViewProj = mat4.create();

  mat4.multiply(lightSpaceViewProj, lightSpaceView, lightSpaceModel);
  mat4.multiply(lightSpaceViewProj, lightSpaceOrthoProj, lightSpaceViewProj);

  // Convert Model Space -> Light Space Matrix (outputs NDC) to output texCoords between 0 & 1
  let lightSpaceToViewport = mat4.create();
  mat4.multiply(lightSpaceToViewport, SM_VIEWPORT_TRANSFORM, lightSpaceViewProj);

  shader.setShadowMapMatrices(lightSpaceViewProj, lightSpaceToViewport);
}

function createFrameBuffer(gl: WebGL2RenderingContext, frameRefs: any) {

    // Creating a Framebuffer
    let frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

    // Creating a texture that is outputed to by the frame buffer
    let frameTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, window.innerWidth, window.innerHeight, 0, gl.RGB, gl.UNSIGNED_BYTE, 0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);


    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, frameTexture, 0);

    // Creating a depth buffer
    let depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.FRAMEBUFFER, depthBuffer);

    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT, window.innerWidth, window.innerHeight);

    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer)


    let drawBuffers = [gl.COLOR_ATTACHMENT0];
    gl.drawBuffers(drawBuffers);

    // Adding a safe Check log
    let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if(status != gl.FRAMEBUFFER_COMPLETE) {
        console.error("Error while creating framebuffer");
    }

    frameRefs.frameBuffer = frameBuffer;
    frameRefs.depthBuffer = depthBuffer;
    frameRefs.frameTexture = frameTexture;
}

function createShadowMapFrameBuffer(gl: WebGL2RenderingContext, frameRefs: any) {

    // Creating a Framebuffer
    let frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);

    // Creating a texture that is outputed to by the frame buffer
    let frameTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, frameTexture);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, window.innerWidth, window.innerHeight, 0, gl.RGB, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, frameTexture, 0);

    // Creating a depth buffer
    let depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);

    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, window.innerWidth, window.innerHeight);

    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depthBuffer)


    // Adding a safe Check log
    let status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if(status != gl.FRAMEBUFFER_COMPLETE) {
        console.error("Error while creating framebuffer");
    }

    frameRefs.frameBuffer = frameBuffer;
    frameRefs.depthBuffer = depthBuffer;
    frameRefs.frameTexture = frameTexture;
}

/**
 * @brief      Main execution code
 *
 * @memberof   Main
 */
function main() {
  shaderControls = new ShaderControls();

  // Initial display for framerate
  const stats = Stats();
  stats.setMode(0);
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.left = '0px';
  stats.domElement.style.top = '0px';
  document.body.appendChild(stats.domElement);

  constructGUI();

  // get canvas and webgl context
  const canvas = <HTMLCanvasElement>document.getElementById('canvas');
  const gl = <WebGL2RenderingContext>canvas.getContext('webgl2');
 
  if (!gl) {
    alert('WebGL 2 not supported!');
  }
  // `setGL` is a function imported above which sets the value of `gl` in the `globals.ts` module.
  // Later, we can import `gl` from `globals.ts` to access it
  setGL(gl);

  // Initial call to load scene

  const camera = new Camera(vec3.fromValues(75, 75, 75), vec3.fromValues(0, 0, 0));

  const renderer = new OpenGLRenderer(canvas);
  renderer.setClearColor(0.05, 0.05, 0.05, 1);
  gl.enable(gl.DEPTH_TEST);

  mainShader = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/custom-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/custom-frag.glsl')),
  ]);

  regularShader = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/regular-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/regular-frag.glsl')),
  ]);

  visualShader = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/visual-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/visual-frag.glsl')),
  ]);

  skyShader = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/sky-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/sky-frag.glsl')),
  ]);

  shadowMapShader = new ShaderProgram([
    new Shader(gl.VERTEX_SHADER, require('./shaders/sm-vert.glsl')),
    new Shader(gl.FRAGMENT_SHADER, require('./shaders/sm-frag.glsl')),
  ]);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  let shadowMapBuffer:any = {};

  createShadowMapFrameBuffer(gl, shadowMapBuffer);

  function renderScene (instanceShader: ShaderProgram, regularShader: ShaderProgram) {
    renderer.render(camera, regularShader, [plane]);
    for (let key in meshInstances) {
      let mesh = meshInstances[key];
      renderer.render(camera, instanceShader, [mesh]);
    }

    renderer.render(camera, regularShader, [roofMesh]);
    // renderer.render(camera, visualShader, [boundingLines]);
  }

  // This function will be called every frame
  function tick() {
    if (!FlagIsRenderable) {
      requestAnimationFrame(tick);
      return;
    }

    let deltaTime = (new Date()).getTime() - prevTime;

    let degrees = deltaTime * degreePerMS;

    let rotDelta = mat4.create();

    let lightDir = controls.lightDirection;
    let lightDirection =  vec3.fromValues(lightDir[0], lightDir[1], lightDir[2]);

    camera.update();
    let position = camera.getPosition();
    stats.begin();

    /*----------  Render Shadow Map into Buffer  ----------*/
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowMapBuffer.frameBuffer);
    gl.viewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.clear();

    shadowMapShader.setEyePosition(vec4.fromValues(position[0], position[1], position[2], 1));
    setShadowMapData(shadowMapShader);
    renderScene(shadowMapShader, shadowMapShader);

    /*----------  Render Scene  ----------*/
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.clear();

    gl.disable(gl.DEPTH_TEST);

    skyShader.setTime(frameCount);
    skyShader.setEyePosition(vec4.fromValues(position[0], position[1], position[2], 1));
    renderer.render(camera, skyShader, [sky]);

    gl.enable(gl.DEPTH_TEST);

    mainShader.setTime(frameCount);
    mainShader.setEyePosition(vec4.fromValues(position[0], position[1], position[2], 1));
    
    visualShader.setTime(frameCount);
    visualShader.setEyePosition(vec4.fromValues(position[0], position[1], position[2], 1));
    
    regularShader.setEyePosition(vec4.fromValues(position[0], position[1], position[2], 1));

    mainShader.setLightPosition(vec3.fromValues(lightDirection[0], lightDirection[1], lightDirection[2]));
    regularShader.setLightPosition(vec3.fromValues(lightDirection[0], lightDirection[1], lightDirection[2]));

    mainShader.setShadowTexture(1);
    regularShader.setShadowTexture(1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, shadowMapBuffer.frameTexture);

    mainShader.setTexture(0);
    regularShader.setTexture(0);
    mainAtlas.bind(0);

    renderScene(mainShader, regularShader);

    frameCount++;

    stats.end();

    if (shouldCapture) {
      downloadImage();
      shouldCapture = false;
    }

    prevTime = (new Date()).getTime();

    // Tell the browser to call `tick` again whenever it renders a new frame
    requestAnimationFrame(tick);
  }

  window.addEventListener('resize', function() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.setAspectRatio(window.innerWidth / window.innerHeight);
    camera.updateProjectionMatrix();
  }, false);

  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.setAspectRatio(window.innerWidth / window.innerHeight);
  camera.updateProjectionMatrix();

  // Start the render loop
  prevTime = (new Date()).getTime();

  loadAssets(tick);
}

main();
