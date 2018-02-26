import {queue} from 'async';

var Loader = require('webgl-obj-loader');

var Logger = require('debug');
var logTrace = Logger("mainApp:assetLibrary:trace");
var logError = Logger("mainApp:assetLibrary:error");

class AssetLibrary {
  meshes: { [symbol: string]: any; } = { };

  queue: any;

  constructor() {
    this.queue = queue(this.loadAsset, 4);
  }

  private loadAsset(task: any, callback: any) {
    logTrace(`Loading Mesh from URL: ${task.url} as name: ${task.key}`);

    Loader.downloadMeshes({ mesh: task.url }, function(meshes: any) {
      if (!meshes.mesh || meshes.mesh.vertices.length == 0) {
        logError('Empty Mesh Found at: ' + task.url);
        callback('EMPTY_MESH');
        return;
      }

      task.ref.meshes[task.key] = meshes.mesh;
      callback();
    });
  }

  load(assets: any) {
    let ref = this;

    return new Promise(function(resolve, reject) {
      ref.queue.drain = function() {
          logTrace('All Assets Loaded');
          resolve();
      };

      for(let key in assets) {
        let url = assets[key];

        let payload:any = {};
        payload.key = key;
        payload.url = url;
        payload.ref = ref;

        ref.queue.push(payload, function(err: any) {
          if (!err) {
            return;
          }

          logError('Error Loading Object', err);
          ref.queue.kill();
          reject(err);
        });
      }
    });
  }
}

export default AssetLibrary;