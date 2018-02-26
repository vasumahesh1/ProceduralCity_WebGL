import { vec3, vec4, mat4 } from 'gl-matrix';
import Drawable from '../rendering/gl/Drawable';
import { gl } from '../globals';

var Loader = require('webgl-obj-loader');

var Logger = require('debug');
var dCreate = Logger("mainApp:meshInstanced:trace");
var dCreateInfo = Logger("mainApp:meshInstanced:info");

let CHUNK_SIZE = 200;

function concatFloat32Array(first: Float32Array, second: Float32Array) {
  var firstLength = first.length;
  var secondLength = second.length
  var result = new Float32Array(firstLength + secondLength);

  result.set(first);
  result.set(second, firstLength);

  return result;
}

function concatUint32Array(first: Uint32Array, second: Uint32Array) {
  var firstLength = first.length;
  var secondLength = second.length
  var result = new Uint32Array(firstLength + secondLength);

  result.set(first);
  result.set(second, firstLength);

  return result;
}


function degreeToRad(deg: number) {
  return deg * 0.0174533;
}

class MeshInstanced extends Drawable {
  indices: Uint32Array;
  vertices: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  positions: Float32Array;
  scales: Float32Array;
  rotations: Float32Array;

  baseColor: vec4;
  rawMesh: any;

  name: string;

  constructor(n: string = "Unknown Mesh") {
    super();
    this.instanced = true;
    this.name = n;

    this.instances = 0;

    this.positions = new Float32Array([]);
    this.normals = new Float32Array([]);
    this.vertices = new Float32Array([]);
    this.colors = new Float32Array([]);
    this.indices = new Uint32Array([]);
  }

  load(url: string) {
    let ref = this;

    return new Promise(function(resolve, reject) {
      Loader.downloadMeshes({ mesh: url }, function(meshes: any) {
        ref.rawMesh = meshes.mesh;
        resolve();
      });
    });
  }

  setColor(color: vec4) {
    this.baseColor = color;
  }

  addInstance(position: vec4, orient: vec4, scale: vec3) {

    let arr =  new Float32Array([
      position[0],
      position[1],
      position[2],
      position[3]
    ]);

    this.positions = concatFloat32Array(this.positions, arr);

    arr =  new Float32Array([
      scale[0],
      scale[1],
      scale[2],
      0.0
    ]);

    this.scales = concatFloat32Array(this.scales, arr);

    arr =  new Float32Array([
      orient[0],
      orient[1],
      orient[2],
      orient[3]
    ]);

    this.rotations = concatFloat32Array(this.rotations, arr);

    this.instances++;
  }

  create() {
    this.vertices = new Float32Array([]);
    this.colors = new Float32Array([]);
    this.indices = new Uint32Array([]);
    this.normals = new Float32Array([]);

    let vertices = this.rawMesh.vertices;
    let indices = this.rawMesh.indices;
    let vertexNormals = this.rawMesh.vertexNormals;

    let vertexCount = vertices.length;

    dCreate("Loading Vertices: " + vertexCount);
    dCreate("Loading Indices: " + indices.length);
    dCreate("Loading Normals: " + vertexNormals.length);

    let colorArr =  new Float32Array([
      this.baseColor[0],
      this.baseColor[1],
      this.baseColor[2],
      1.0
    ]);

    for (var itr = 0; itr < vertexCount; itr+= 3) {
      let arr =  new Float32Array([
        vertices[itr],
        vertices[itr + 1],
        vertices[itr + 2],
        1.0
      ]);

      let arrN =  new Float32Array([
        vertexNormals[itr],
        vertexNormals[itr + 1],
        vertexNormals[itr + 2],
        1.0
      ]);

      this.vertices = concatFloat32Array(this.vertices, arr);
      this.normals = concatFloat32Array(this.normals, arrN);
      this.colors = concatFloat32Array(this.colors, colorArr);
    }

    this.indices = new Uint32Array(indices);

    this.generateIdx();
    this.generateVert();
    this.generateNor();
    this.generateColor();
    this.generateInstancePos();
    this.generateInstanceRotation();
    this.generateInstanceScale();

    this.count = this.indices.length;

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bufIdx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufNor);
    gl.bufferData(gl.ARRAY_BUFFER, this.normals, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufInstancePosition);
    gl.bufferData(gl.ARRAY_BUFFER, this.positions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufInstanceRotation);
    gl.bufferData(gl.ARRAY_BUFFER, this.rotations, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufInstanceScale);
    gl.bufferData(gl.ARRAY_BUFFER, this.scales, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufVert);
    gl.bufferData(gl.ARRAY_BUFFER, this.vertices, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bufCol);
    gl.bufferData(gl.ARRAY_BUFFER, this.colors, gl.STATIC_DRAW);
      
    dCreateInfo(`Created ${this.name} with ${this.instances} Instances`);
  }
};

export default MeshInstanced;
